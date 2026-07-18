# Chapter 3. The PE Format: A Brief Introduction

The *Portable Executable* format is the main binary format on Windows — relevant chiefly for malware analysis. PE is a modified version of the *Common Object File Format* (COFF), which preceded ELF on Unix; hence the name PE/COFF. The 64-bit version is called *PE32+*, differing only slightly from PE. Data structures are defined in `WinNT.h` (Windows SDK).

File layout, top to bottom: MS-DOS header → MS-DOS stub → PE signature → PE file header → PE optional header → section headers → sections.

## 3.1 The MS-DOS Header and Stub

Present for backward compatibility: during the transition from MS-DOS binaries, every PE file could also be interpreted (in a limited sense) as an MS-DOS binary. The header describes how to load the *MS-DOS stub* that follows it — usually a small program that prints "This program cannot be run in DOS mode" and exits, though in principle it can be a full MS-DOS version of the program.

| Field | Meaning |
|---|---|
| `e_magic` | ASCII "MZ" (hence *MZ header*; the initials of Mark Zbikowski, designer of the original MS-DOS executable format) |
| `e_lfanew` | File offset where the real PE binary begins — a PE-aware loader reads this and skips the header and stub |

## 3.2 The PE Signature, File Header, and Optional Header

The equivalent of ELF's executable header, split into three parts. `WinNT.h` wraps all three in `IMAGE_NT_HEADERS64`, but in practice they are treated as separate entities. Dump with `objdump -x`.

### PE signature

ASCII "PE" followed by two NULL characters. Analogous to ELF's magic bytes.

### PE file header (`IMAGE_FILE_HEADER`)

```c
typedef struct {
    WORD  Machine;
    WORD  NumberOfSections;
    DWORD TimeDateStamp;
    DWORD PointerToSymbolTable;
    DWORD NumberOfSymbols;
    WORD  SizeOfOptionalHeader;
    WORD  Characteristics;
} IMAGE_FILE_HEADER;
```

| Field | Notes |
|---|---|
| `Machine` | Target architecture, like ELF's `e_machine`; x86-64 = `0x8664` |
| `NumberOfSections` | Entry count of the section header table |
| `SizeOfOptionalHeader` | Size in bytes of the optional header that follows |
| `Characteristics` | Flags: endianness, DLL or not, stripped or not, ... |
| `PointerToSymbolTable`, `NumberOfSymbols` | **Deprecated** — PE files should no longer embed symbols/debug info; symbols are optionally emitted in a separate debugging file (PDB) |

### PE optional header (`IMAGE_OPTIONAL_HEADER64`)

Not actually optional for executables (may be missing in object files). Key fields:

| Field | Notes |
|---|---|
| `Magic` | `0x020b` for 64-bit PE (PE32+) |
| `MajorLinkerVersion` / `MinorLinkerVersion` | Linker used to create the binary; other fields give the minimum OS version required |
| `ImageBase` | Address at which to load the binary — PE binaries are designed for a specific virtual address |
| `AddressOfEntryPoint` | Entry point, as an RVA |
| `BaseOfCode` | Base of the code sections, as an RVA |
| `DataDirectory[16]` | See below |

*Relative virtual addresses (RVAs)* are added to `ImageBase` to obtain virtual addresses: base VA of code = `ImageBase + BaseOfCode`.

The `DataDirectory` is an array of `IMAGE_DATA_DIRECTORY` entries, each an RVA plus size describing an important portion of the binary; interpretation depends on the array index. It serves as a shortcut for the loader — no need to iterate the section header table.

| Index | Describes |
|---|---|
| 0 | Export directory (table of exported functions) — `.edata` |
| 1 | Import directory (table of imported functions) — `.idata` |
| 5 | Base relocation table — `.reloc` |

## 3.3 The Section Header Table

An array of `IMAGE_SECTION_HEADER` structures, one per section:

| Field | Meaning | Nearest ELF analog |
|---|---|---|
| `Name[8]` | Section name as an inline 8-byte character array — names limited to 8 characters; no string table | `sh_name` (indexes `.shstrtab`) |
| `SizeOfRawData` | Size in the file | `sh_size` |
| `VirtualSize` | Size in memory | — (segment-level `p_memsz` is the closest concept) |
| `PointerToRawData` | File offset | `sh_offset` |
| `VirtualAddress` | Virtual address | `sh_addr` |
| `Characteristics` | Flags: executable, readable, writable, ... | `sh_flags` |

Unlike ELF, PE has no explicit section/segment distinction: there is no program header table, and the section header table is used for both linking and loading. The closest thing to ELF's execution view is the `DataDirectory`.

## 3.4 Sections

Overview with `objdump -x`. Common sections:

| PE section | Contents | ELF analog |
|---|---|---|
| `.text` | Code | `.text` |
| `.rdata` | Read-only data | `.rodata` (roughly) |
| `.data` | Readable/writable data | `.data` |
| `.bss` | Zero-initialized data (sometimes absent) | `.bss` |
| `.pdata` | Exception information | — |
| `.rsrc` | Resources | — |
| `.reloc` | Relocation information | `.rela.*` |

!!! warning "Data in code sections"
    PE compilers like Visual Studio sometimes place read-only data in `.text`, mixed with code, instead of in `.rdata` — making it possible to accidentally interpret constant data as instructions during disassembly.

### `.edata` and `.idata`

The important PE sections with no direct ELF equivalent; referenced by DataDirectory entries 0 and 1. `.idata` specifies the symbols (functions and data) imported from shared libraries — *DLLs* in Windows terminology; `.edata` lists the symbols the binary exports, with their addresses. To resolve external references, the loader matches required imports against the export tables of the providing DLLs. In practice both sections are often absent as separate sections and merged into `.rdata`; contents and workings are unchanged.

The *Import Address Table (IAT)* — part of `.idata`, analogous to ELF's GOT — is a table of pointer slots. Initially each slot points to the name or identifying number of the symbol to import; the dynamic loader replaces it with a pointer to the actual function or variable. A library call is then implemented as a call to a *thunk*: nothing more than an indirect `jmp` through the function's IAT slot. Thunks typically appear grouped together; their jump targets are the IAT jump slots in the import directory (inside `.rdata`).

### Padding in code sections

Visual Studio pads between functions/blocks with `int3` instructions (gcc uses `nop`) to align code for efficient access. `int3` is the debugger breakpoint instruction — it traps to the debugger, or crashes without one — which is acceptable since padding is never meant to execute.

!!! note "/hotpatch"
    With Visual Studio's `/hotpatch` option, 5 `int3` bytes precede every function and a 2-byte do-nothing instruction (usually `mov edi, edi`) sits at the entry point. To hot patch at runtime: overwrite the 5 bytes with a long `jmp` to the patched function, then overwrite the 2-byte instruction with a relative jump to that long jump — redirecting the entry point.

## Summary

PE shares most of its structure with ELF: headers describing the file, a section table, comparable section contents, and load-time import resolution through a table of patched pointers. The principal differences: the legacy MS-DOS header/stub, a three-part header with RVA-based addressing against a preferred `ImageBase`, the `DataDirectory` in place of a segment view, inline 8-character section names, and IAT thunks in place of PLT/GOT stubs.
