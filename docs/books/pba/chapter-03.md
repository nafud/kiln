# Chapter 3. The PE Format: A Brief Introduction

The Portable Executable (PE) format is the main binary format on Windows and is common in malware analysis. PE is a modified version of the Common Object File Format (COFF), so it is sometimes called PE/COFF. The 64 bit variant is named PE32+; its differences from 32 bit PE are minor. This chapter highlights the differences from ELF. PE structures are defined in `WinNT.h` (Windows SDK).

Now that ELF is understood, PE is easier to learn because most binary formats share many concepts.

```
┌────────────────────┐
│ MS-DOS header      │  IMAGE_DOS_HEADER, starts with "MZ"
│ MS-DOS stub        │  small DOS program
├────────────────────┤
│ PE signature       │  "PE\0\0"
│ PE file header      │  IMAGE_FILE_HEADER          ┐
│ PE optional header  │  IMAGE_OPTIONAL_HEADER64    ┘ = IMAGE_NT_HEADERS64
├────────────────────┤
│ Section headers    │  IMAGE_SECTION_HEADER[]
├────────────────────┤
│ Sections           │  .text .rdata .data .idata .edata .reloc .rsrc .pdata ...
└────────────────────┘
```

## MS-DOS Header and MS-DOS Stub

Every PE file starts with an MS-DOS header for backward compatibility, so the file can also be interpreted as an MS-DOS binary. The header describes how to load and execute the MS-DOS stub that follows it. The stub is a small DOS program run instead of the main program under MS-DOS, typically printing a message such as "This program cannot be run in DOS mode" and exiting.

| FIELD       | ROLE                                                        |
| ----------- | ----------------------------------------------------------- |
| `e_magic`   | Magic value, ASCII "MZ" (hence "MZ header")                 |
| `e_lfanew`  | File offset where the real PE binary begins                 |

A PE aware loader reads the MS-DOS header, then uses `e_lfanew` to skip past it and the stub to the PE headers.

!!! note "MZ"
    MZ stands for Mark Zbikowski, who designed the original MS-DOS executable format.

## PE Signature, File Header, and Optional Header

PE splits the equivalent of ELF's executable header into three parts. `IMAGE_NT_HEADERS64` in `WinNT.h` encompasses all three, but in practice they are treated as separate entities.

| PART               | STRUCT                     | ANALOGOUS TO ELF                       |
| ------------------ | -------------------------- | -------------------------------------- |
| PE signature       | (4 byte string)            | Magic bytes in `e_ident`               |
| PE file header     | `IMAGE_FILE_HEADER`        | Part of the executable header          |
| PE optional header | `IMAGE_OPTIONAL_HEADER64`  | Part of the executable header          |

Dump PE headers with `objdump -x hello.exe`.

### The PE Signature

The ASCII characters "PE" followed by two null bytes (`"PE\0\0"`). Analogous to the ELF magic value.

### The PE File Header

```c
typedef struct {
  WORD  Machine;
  WORD  NumberOfSections;
  DWORD TimeDateStamp;
  DWORD PointerToSymbolTable;   /* deprecated */
  DWORD NumberOfSymbols;        /* deprecated */
  WORD  SizeOfOptionalHeader;
  WORD  Characteristics;
} IMAGE_FILE_HEADER;
```

| FIELD                  | MEANING                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `Machine`              | Target architecture, like ELF `e_machine`; x86-64 is `0x8664`            |
| `NumberOfSections`     | Number of entries in the section header table                            |
| `SizeOfOptionalHeader` | Size in bytes of the optional header that follows                        |
| `Characteristics`      | Flags: endianness, DLL or not, stripped or not, large address aware, etc |

The symbol table fields (`PointerToSymbolTable`, `NumberOfSymbols`) are deprecated. PE symbols and debugging information are optionally emitted in a separate debugging file rather than embedded.

### The PE Optional Header

Despite the name, this header is not optional for executables (it may be absent in object files). Present in essentially any PE executable.

Key fields:

| FIELD                 | MEANING                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `Magic`               | 16 bit magic, `0x020b` for 64 bit PE                                                  |
| linker/OS versions    | Major/minor linker version and minimal OS version to run the binary                  |
| `ImageBase`           | Virtual address at which to load the binary (PE binaries target a specific address)   |
| `BaseOfCode`          | Base of code sections as an RVA; base virtual address = `ImageBase + BaseOfCode`      |
| `AddressOfEntryPoint` | Entry point address, specified as an RVA                                             |
| `DataDirectory[16]`   | Array of `IMAGE_DATA_DIRECTORY` entries, each an RVA and a size (see below)           |

!!! note "Relative virtual addresses"
    Pointer fields in the optional header often hold RVAs (relative virtual addresses), meant to be added to `ImageBase` to yield the actual virtual address.

The `DataDirectory` gives the loader a shortcut to important portions of the binary without iterating the section header table. Each entry's meaning is fixed by its index.

| INDEX | ENTRY                        | DESCRIBES                                        |
| ----- | ---------------------------- | ----------------------------------------------- |
| 0     | Export Directory (`.edata`)  | Table of exported functions                     |
| 1     | Import Directory (`.idata`)  | Table of imported functions                     |
| 5     | Base Relocation Directory (`.reloc`) | Relocation table                        |

## The Section Header Table

Analogous to ELF's section header table: an array of `IMAGE_SECTION_HEADER` structures, one per section.

```c
typedef struct {
  BYTE  Name[8];
  union {
    DWORD PhysicalAddress;
    DWORD VirtualSize;
  } Misc;
  DWORD VirtualAddress;
  DWORD SizeOfRawData;
  DWORD PointerToRawData;
  DWORD PointerToRelocations;
  DWORD PointerToLinenumbers;
  WORD  NumberOfRelocations;
  WORD  NumberOfLinenumbers;
  DWORD Characteristics;
} IMAGE_SECTION_HEADER;
```

| FIELD             | MEANING                                            | ELF ANALOG   |
| ----------------- | -------------------------------------------------- | ------------ |
| `Name[8]`         | Section name, inline char array, max 8 characters  | `sh_name` (via string table) |
| `VirtualSize`     | Size in memory                                     | `sh_size`    |
| `SizeOfRawData`   | Size in the file                                   |              |
| `VirtualAddress`  | Virtual address                                    | `sh_addr`    |
| `PointerToRawData`| File offset                                        | `sh_offset`  |
| `Characteristics` | Flags: executable, readable, writable              | `sh_flags`   |

Unlike ELF, PE names sections with an inline 8 byte array rather than referencing a string table, limiting names to 8 characters.

Key structural difference from ELF: PE does not explicitly distinguish sections from segments. There is no separate program header table; the section header table serves both linking and loading. The closest thing to ELF's execution view is the `DataDirectory`, which shortcuts the loader to portions needed for setup.

## Sections

Many PE sections correspond directly to ELF sections, often with nearly identical names. Inspect with `objdump -x hello.exe`.

| PE SECTION | CONTENTS                                    | ELF EQUIVALENT      |
| ---------- | ------------------------------------------- | ------------------- |
| `.text`    | Code                                        | `.text`             |
| `.rdata`   | Read only data                              | `.rodata`           |
| `.data`    | Readable/writable data                      | `.data`             |
| `.bss`     | Zero initialized data (may be absent)       | `.bss`              |
| `.reloc`   | Relocation information                      | `.rela.*`           |
| `.edata`   | Exported functions table                    | (none)              |
| `.idata`   | Imported functions table                    | (none)              |

!!! note "Mixed code and data"
    Visual Studio sometimes places read only data in `.text` mixed with code instead of in `.rdata`, which makes disassembly harder because constant data can be misread as instructions.

### .edata and .idata

The most important PE sections with no direct ELF equivalent. The export and import directory entries in `DataDirectory` point to them.

- `.idata` lists the symbols (functions and data) the binary imports from DLLs (Windows shared libraries).
- `.edata` lists the symbols the binary exports along with their addresses.

To resolve external references, the loader matches a binary's required imports against the export table of the DLL that provides them.

In practice `.idata` and `.edata` are often absent as separate sections and merged into `.rdata`, with contents and behavior unchanged.

The Import Address Table (IAT), part of `.idata`, is analogous to the ELF GOT: a table of resolved pointers, one slot per imported symbol. Initially each slot points to the name or ordinal of the symbol to import. The dynamic loader replaces these with pointers to the actual imported functions or variables.

A library function call is implemented as a call to a thunk, an indirect jump through the function's IAT slot.

```
140001cd0: jmp QWORD PTR [rip+0x3b2]   # -> IAT slot 0x140002088
140001cd6: jmp QWORD PTR [rip+0x3a4]   # -> IAT slot 0x140002080
140001cdc: jmp QWORD PTR [rip+0x406]   # -> IAT slot 0x1400020e8
```

Thunks are usually grouped together. Their jump targets are IAT jump slots stored in the import directory within `.rdata`.

### Padding in PE Code Sections

Visual Studio emits `int3` instructions as padding to align functions and code blocks for efficient access, where gcc uses `nop`. `int3` is the debugger breakpoint instruction; it traps to the debugger, or crashes if none is present. This is acceptable for padding since padding is never executed.

!!! note "int3 and /hotpatch"
    With Visual Studio's `/hotpatch` option, `int3` padding serves a dual purpose. It inserts 5 `int3` bytes before every function and a 2 byte do nothing instruction (usually `mov edi, edi`) at the entry point. Hot patching overwrites the 5 `int3` bytes with a long `jmp` to a patched function and the 2 byte instruction with a short relative jump to that long jump, redirecting the entry point.
