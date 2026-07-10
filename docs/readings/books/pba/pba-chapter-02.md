# Chapter 2. The ELF Format

The *Executable and Linkable Format* is the default binary format on Linux, used for executables, object files, shared libraries, and core dumps. Discussion centers on 64-bit executables; 32-bit differs mainly in the size and order of certain header fields. Type definitions live in `/usr/include/elf.h`.

An ELF binary has four component types:

| Component | Presence | Position |
|---|---|---|
| Executable header | Mandatory | Always at file offset 0 |
| Program headers | Optional | Located via `e_phoff` |
| Sections | — | Located via their headers |
| Section headers | Optional (one per section) | Located via `e_shoff` |

## 2.1 The Executable Header

```c
typedef struct {
    unsigned char e_ident[16]; /* Magic number and other info */
    uint16_t e_type;           /* Object file type */
    uint16_t e_machine;        /* Architecture */
    uint32_t e_version;        /* Object file version */
    uint64_t e_entry;          /* Entry point virtual address */
    uint64_t e_phoff;          /* Program header table file offset */
    uint64_t e_shoff;          /* Section header table file offset */
    uint32_t e_flags;          /* Processor-specific flags */
    uint16_t e_ehsize;         /* ELF header size in bytes */
    uint16_t e_phentsize;      /* Program header table entry size */
    uint16_t e_phnum;          /* Program header table entry count */
    uint16_t e_shentsize;      /* Section header table entry size */
    uint16_t e_shnum;          /* Section header table entry count */
    uint16_t e_shstrndx;       /* Section header string table index */
} Elf64_Ehdr;
```

Inspect with `readelf -h`.

### `e_ident`

16-byte array. Starts with a 4-byte magic value: `0x7f` followed by ASCII `E`, `L`, `F` — lets tools identify ELF files immediately. Then:

| Byte | Values | Meaning |
|---|---|---|
| `EI_CLASS` | `ELFCLASS32` (1), `ELFCLASS64` (2) | 32-bit or 64-bit architecture |
| `EI_DATA` | `ELFDATA2LSB` (1), `ELFDATA2MSB` (2) | Little- or big-endian |
| `EI_VERSION` | `EV_CURRENT` (1) — only valid value | ELF specification version |
| `EI_OSABI` | 0 = UNIX System V ABI (default) | Nonzero signals ABI/OS-specific extensions |
| `EI_ABIVERSION` | Usually 0 | Version of the ABI in `EI_OSABI` |
| `EI_PAD` | Zeroed | Padding, bytes 9–15, reserved |

### Remaining fields

| Field | Notes |
|---|---|
| `e_type` | `ET_REL` (relocatable object), `ET_EXEC` (executable), `ET_DYN` (shared object) |
| `e_machine` | `EM_X86_64`, `EM_386`, `EM_ARM`, ... |
| `e_version` | Same role as `EI_VERSION`; only value is 1 (`EV_CURRENT`) |
| `e_entry` | Entry point virtual address; interpreter transfers control here after loading. Useful start for recursive disassembly |
| `e_phoff`, `e_shoff` | *File offsets* (not virtual addresses) of the program and section header tables; either may be 0 if the table is absent |
| `e_flags` | Architecture-specific flags (used e.g. by embedded ARM); 0 for x86 |
| `e_ehsize` | Executable header size: 64 bytes (64-bit x86), 52 bytes (32-bit x86) |
| `e_phentsize`, `e_phnum` | Size and count of program header entries |
| `e_shentsize`, `e_shnum` | Size and count of section header entries |
| `e_shstrndx` | Section header table index of `.shstrtab`, the string table of section names |

## 2.2 Section Headers

Code and data are logically divided into contiguous, nonoverlapping *sections*. Sections have no predetermined structure; each is described by a section header in the section header table.

The section view exists **for the linker** (link time). It is optional: files that don't need linking may omit the table (`e_shoff = 0`). Execution uses a different organization — *segments* (Section 2.4).

```c
typedef struct {
    uint32_t sh_name;      /* Section name (string tbl index) */
    uint32_t sh_type;      /* Section type */
    uint64_t sh_flags;     /* Section flags */
    uint64_t sh_addr;      /* Section virtual addr at execution */
    uint64_t sh_offset;    /* Section file offset */
    uint64_t sh_size;      /* Section size in bytes */
    uint32_t sh_link;      /* Link to another section */
    uint32_t sh_info;      /* Additional section information */
    uint64_t sh_addralign; /* Section alignment */
    uint64_t sh_entsize;   /* Entry size if section holds table */
} Elf64_Shdr;
```

| Field | Notes |
|---|---|
| `sh_name` | Index into `.shstrtab`; 0 = unnamed |
| `sh_type` | See table below |
| `sh_flags` | `SHF_WRITE` (writable at runtime), `SHF_ALLOC` (loaded into memory at execution — actual loading uses the segment view), `SHF_EXECINSTR` (contains executable instructions) |
| `sh_addr` | Virtual address; 0 if not loaded at runtime. Present because the linker needs runtime addresses for relocations |
| `sh_offset`, `sh_size` | File offset (bytes from file start) and size |
| `sh_link` | Section header table index of a related section — e.g. the string table for a symbol table, or the symbol table for a relocation section |
| `sh_info` | Type-dependent; for relocation sections, index of the section the relocations apply to |
| `sh_addralign` | Required alignment of the base address; 0 and 1 mean no requirement |
| `sh_entsize` | Entry size for table sections (symbol tables, relocation tables); 0 if unused |

| `sh_type` | Contents |
|---|---|
| `SHT_PROGBITS` | Program data (machine instructions, constants); no structure for the linker to parse |
| `SHT_SYMTAB` / `SHT_DYNSYM` | Static / dynamic symbol table (`Elf64_Sym` entries) |
| `SHT_STRTAB` | Array of NULL-terminated strings; first byte NULL by convention |
| `SHT_REL` / `SHT_RELA` | Relocation entries (`Elf64_Rel` / `Elf64_Rela`) for **static** linking: each names a location needing relocation and the symbol to resolve it to |
| `SHT_DYNAMIC` | Dynamic linking information (`Elf64_Dyn` entries) |
| `SHT_NOBITS` | Occupies no file bytes (`.bss`) |
| `SHT_NULL` | First entry of every section header table; fully zeroed, no associated section |

!!! warning "Malware"
    `sh_name` contents are not trustworthy when analyzing malware — section names may be intentionally misleading.

## 2.3 Sections

List with `readelf --sections --wide`.

### `.init` and `.fini`

Executable code run before control transfers to the entry point (`.init` — think constructor) and after the main program completes (`.fini` — destructor).

### `.text`

Main code section: `SHT_PROGBITS`, flags `AX` — executable, **not** writable. Executable sections should almost never be writable: it would let an attacker exploiting a vulnerability overwrite code directly.

Besides user code, gcc places standard functions here: `_start`, `register_tm_clones`, `frame_dummy`, etc. The binary's entry point is `_start`, not `main`: `_start` moves `main`'s address into `rdi` (first x64 parameter register) and calls `__libc_start_main`, which in turn calls `main`.

### `.rodata`, `.data`, and `.bss`

| Section | Contents | Type | Writable |
|---|---|---|---|
| `.rodata` | Constant values | `SHT_PROGBITS` | No |
| `.data` | Default values of initialized variables | `SHT_PROGBITS` | Yes |
| `.bss` | Space reserved for uninitialized (zero-initialized) variables | `SHT_NOBITS` | Yes |

`.bss` ("block started by symbol") occupies no bytes on disk — it is a directive to allocate a zeroed block at load time. Compilers occasionally emit constant data in code sections (Visual Studio does; modern gcc/clang generally don't), which complicates disassembly.

### Lazy Binding: `.plt`, `.got`, and `.got.plt`

Relocations for shared-library functions are typically deferred until a reference is first invoked — *lazy binding*. The dynamic linker thus performs only the relocations actually needed at runtime. Default on Linux; `export LD_BIND_NOW=1` forces immediate resolution (e.g. for real-time guarantees).

Implemented via the *Procedure Linkage Table* (`.plt`, executable code) and the *Global Offset Table* (`.got.plt`, data). The PLT consists of stubs of fixed format: one default stub, then one per library function, each pushing an incremented identifier.

Resolution of a first call to `puts`:

1. `.text` calls `puts@plt`.
2. Stub begins with an indirect `jmp` through its `.got.plt` slot.
3. Before binding, the slot points back to the next instruction of the stub itself, so the jump lands on the following `push`.
4. Stub pushes its identifier (0x0 for the first stub) and jumps to the default stub, which pushes an identifier for the executable itself (from the GOT) and jumps, indirectly through the GOT, to the dynamic linker.
5. Using both identifiers, the dynamic linker resolves `puts` on behalf of the right module (multiple loaded libraries each have their own PLT and GOT), patches the resolved address into the `.got.plt` slot, and transfers control to `puts`.
6. Subsequent calls: the stub's first `jmp` goes straight to `puts`; the dynamic linker is no longer involved.

**Why a GOT instead of patching the PLT code directly?**

- Security: code sections stay non-writable. The GOT is data, so it may be writable; corrupting GOT addresses is a far weaker attack primitive than injecting code.
- Shareability: one physical copy of a library is mapped at different virtual addresses in different processes. Addresses can't be patched into shared code, but each process has a private GOT.

Data references to relocatable symbols also go through the GOT — directly, without a PLT step. Hence the split: `.got` for data references, `.got.plt` for resolved function addresses used by the PLT.

!!! note "RELRO"
    `.got.plt` is runtime-writable; `.got` is not when RELRO (*relocations read-only*, `ld -z relro`) is enabled. RELRO keeps entries that must stay writable for lazy binding in `.got.plt` and all others in read-only `.got`.

!!! note "`.plt.got`"
    An alternative PLT that uses read-only `.got` entries instead of `.got.plt`. Emitted with `ld -z now` ("now binding" — same effect as `LD_BIND_NOW=1`, but known at link time), allowing GOT entries in `.got` for security and 8-byte stubs instead of 16-byte `.plt` stubs.

### `.rel.*` and `.rela.*`

Type `SHT_RELA`: tables of relocation entries, each giving an address to patch and how to compute the value. In a linked executable only **dynamic** relocations remain; static ones were resolved at link time. Common types (`readelf --relocs`):

| Type | Offset located in | Purpose |
|---|---|---|
| `R_X86_64_GLOB_DAT` | `.got` | Compute a data symbol's address and plug it into `.got` |
| `R_X86_64_JUMP_SLOT` | `.got.plt` | *Jump slots*: slots where library function addresses get plugged in; each is the indirect jump target of a PLT stub |

(`readelf` truncates the latter to `R_X86_64_JUMP_SLO` in its output.)

### `.dynamic`

A road map for the OS and dynamic linker when loading: a table of `Elf64_Dyn` structures (*tags*), each a type plus value.

| Tag | Meaning |
|---|---|
| `DT_NEEDED` | A dependency, e.g. `libc.so.6` — must be loaded to run the binary |
| `DT_VERNEED`, `DT_VERNEEDNUM` | Start address and entry count of the version dependency table |
| `DT_STRTAB`, `DT_SYMTAB`, `DT_PLTGOT`, `DT_RELA` | Pointers to the dynamic string table, dynamic symbol table, `.got.plt`, and dynamic relocation section |

### `.init_array` and `.fini_array`

Arrays of function pointers: constructors called in turn before `main`, destructors after. Unlike `.init`'s single startup function, these are data sections holding arbitrarily many pointers — mark C functions with `__attribute__((constructor))` to register them. Easy to modify, hence a convenient hook point for inserting initialization/finalization code. Older gcc emits `.ctors`/`.dtors` instead.

### String and symbol tables

| Section | Type | Contents | Strippable |
|---|---|---|---|
| `.shstrtab` | `SHT_STRTAB` | Names of all sections; indexed by `sh_name` | No |
| `.symtab` | `SHT_SYMTAB` | Static symbol table (`Elf64_Sym`) | Yes |
| `.strtab` | `SHT_STRTAB` | Strings for `.symtab` symbol names | Yes |
| `.dynsym` | `SHT_DYNSYM` | Symbols needed for dynamic linking | No |
| `.dynstr` | `SHT_STRTAB` | Strings for `.dynsym` | No |

The distinct types `SHT_SYMTAB` vs. `SHT_DYNSYM` let `strip` recognize which tables are safe to remove.

## 2.4 Program Headers

The program header table provides the *segment* view: used by the OS and dynamic linker at **execution** time, versus the section view used at link time. A segment encompasses zero or more sections, bundled into one chunk; segments exist only in executable ELF files. `readelf --wide --segments` shows the table plus the section-to-segment mapping.

```c
typedef struct {
    uint32_t p_type;   /* Segment type */
    uint32_t p_flags;  /* Segment flags */
    uint64_t p_offset; /* Segment file offset */
    uint64_t p_vaddr;  /* Segment virtual address */
    uint64_t p_paddr;  /* Segment physical address */
    uint64_t p_filesz; /* Segment size in file */
    uint64_t p_memsz;  /* Segment size in memory */
    uint64_t p_align;  /* Segment alignment */
} Elf64_Phdr;
```

| Field | Notes |
|---|---|
| `p_type` | `PT_LOAD`: loaded into memory at process setup — usually at least two, one non-writable (code) and one writable (data). `PT_INTERP`: contains `.interp` (interpreter path). `PT_DYNAMIC`: contains `.dynamic`. `PT_PHDR`: the program header table itself |
| `p_flags` | Runtime permissions: `PF_X` (executable; `readelf` shows `E`), `PF_W` (writable — data segments only, never code), `PF_R` (readable) |
| `p_offset`, `p_vaddr`, `p_filesz` | Analogous to `sh_offset`, `sh_addr`, `sh_size`. For loadable segments, `p_vaddr ≡ p_offset (mod page size)` — page size typically 4,096 bytes |
| `p_paddr` | Physical load address on some systems; unused (zero) on modern OSes, which execute everything in virtual memory |
| `p_memsz` | May exceed `p_filesz` (e.g. `.bss`: zeros aren't stored on disk); the loader appends the extra bytes and zero-initializes them |
| `p_align` | 0 or 1 = no requirement; otherwise a power of 2, with `p_vaddr ≡ p_offset (mod p_align)` |
