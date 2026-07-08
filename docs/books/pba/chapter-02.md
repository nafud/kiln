# Chapter 2. The ELF Format

The Executable and Linkable Format (ELF) is the default binary format on Linux based systems. It is used for executable files, object files, shared libraries, and core dumps. This chapter centers on 64 bit ELF executables. The 32 bit format is similar, differing mainly in the size and order of certain header fields.

An ELF binary consists of four kinds of components.

| COMPONENT           | PRESENCE  | PURPOSE                                                  |
| ------------------- | --------- | ------------------------------------------------------- |
| Executable header   | Mandatory | Identifies the file and locates all other contents      |
| Program headers     | Optional  | Segment view, used at load and execution time            |
| Sections            | Present   | Contiguous chunks of code and data                       |
| Section headers     | Optional  | Section view, one header per section, used at link time |

Standard layout order: executable header first, then program headers, then sections, then section headers. Only the executable header is guaranteed to sit at a fixed location (the file start).

```
┌────────────────────┐
│ Executable header  │  Elf64_Ehdr, always at offset 0
├────────────────────┤
│ Program headers    │  Elf64_Phdr[], located via e_phoff
├────────────────────┤
│ Sections           │  .interp .init .plt .text .fini .rodata .data .bss ...
├────────────────────┤
│ Section headers    │  Elf64_Shdr[], located via e_shoff
└────────────────────┘
```

Type definitions live in `/usr/include/elf.h` and the ELF specification.

## The Executable Header

```c
typedef struct {
  unsigned char e_ident[16];  /* Magic number and other info      */
  uint16_t      e_type;       /* Object file type                 */
  uint16_t      e_machine;    /* Architecture                     */
  uint32_t      e_version;    /* Object file version              */
  uint64_t      e_entry;      /* Entry point virtual address      */
  uint64_t      e_phoff;      /* Program header table file offset */
  uint64_t      e_shoff;      /* Section header table file offset */
  uint32_t      e_flags;      /* Processor-specific flags         */
  uint16_t      e_ehsize;     /* ELF header size in bytes         */
  uint16_t      e_phentsize;  /* Program header table entry size  */
  uint16_t      e_phnum;      /* Program header table entry count */
  uint16_t      e_shentsize;  /* Section header table entry size  */
  uint16_t      e_shnum;      /* Section header table entry count */
  uint16_t      e_shstrndx;   /* Section header string table idx  */
} Elf64_Ehdr;
```

Inspect it with `readelf -h a.out`.

### The e_ident Array

A 16 byte array beginning the file. It starts with the 4 byte magic value `0x7f 'E' 'L' 'F'`, which lets tools such as `file` and the loader quickly identify an ELF file. Bytes at indexes 4 through 15 are symbolically named.

| INDEX NAME     | BYTE(S) | MEANING                                                                 |
| -------------- | ------- | ----------------------------------------------------------------------- |
| EI_CLASS       | 4       | Architecture width: `ELFCLASS32` (1) or `ELFCLASS64` (2)                 |
| EI_DATA        | 5       | Endianness: `ELFDATA2LSB` (1, little endian) or `ELFDATA2MSB` (2, big)   |
| EI_VERSION     | 6       | ELF spec version, only valid value `EV_CURRENT` (1)                      |
| EI_OSABI       | 7       | ABI / OS; 0 means UNIX System V. Nonzero signals ABI or OS extensions    |
| EI_ABIVERSION  | 8       | Specific version of the ABI named in EI_OSABI, usually 0                 |
| EI_PAD         | 9 to 15 | Reserved padding, currently zero                                        |

Nonzero EI_OSABI can change the meaning of other fields or signal nonstandard sections.

### e_type, e_machine, e_version

| FIELD       | ROLE                        | COMMON VALUES                                                     |
| ----------- | --------------------------- | ---------------------------------------------------------------- |
| `e_type`    | Type of the binary          | `ET_REL` (relocatable object), `ET_EXEC` (executable), `ET_DYN` (shared object / dynamic library) |
| `e_machine` | Target architecture         | `EM_X86_64`, `EM_386` (32 bit x86), `EM_ARM`                      |
| `e_version` | ELF spec version            | Only `EV_CURRENT` (1)                                            |

### e_entry

Virtual address at which execution starts. The interpreter (typically `ld-linux.so`) transfers control here after loading the binary. Also a useful starting point for recursive disassembly.

### e_phoff and e_shoff

File offsets (byte counts into the file, not virtual addresses) to the program header table and section header table. Either may be zero to indicate the table is absent. Because these tables are located by offset, they need not sit at any fixed position.

### Remaining Fields

| FIELD         | MEANING                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `e_flags`     | Architecture specific flags; typically 0 for x86                           |
| `e_ehsize`    | Executable header size: 64 bytes for 64 bit x86, 52 bytes for 32 bit x86   |
| `e_phentsize` | Size of one program header entry                                           |
| `e_phnum`     | Number of program header entries                                           |
| `e_shentsize` | Size of one section header entry                                           |
| `e_shnum`     | Number of section header entries                                           |
| `e_shstrndx`  | Section header table index of the `.shstrtab` string table                 |

`.shstrtab` is a section holding null terminated ASCII strings that store the names of all sections. `e_shstrndx` lets tools like `readelf` locate it and resolve section names.

## Section Headers

Code and data are logically divided into contiguous nonoverlapping sections. Sections have no predetermined structure; often a section is an unstructured blob. Each section is described by a section header; all section headers form the section header table.

The section view exists for the linker (and static analysis tools). Not every section is needed to execute the binary; some hold only symbolic or relocation data. The section header table is therefore optional, and when absent, `e_shoff` is zero. Execution uses a different organization, segments, described by program headers.

```c
typedef struct {
  uint32_t sh_name;       /* Section name (string tbl index)     */
  uint32_t sh_type;       /* Section type                        */
  uint64_t sh_flags;      /* Section flags                       */
  uint64_t sh_addr;       /* Section virtual addr at execution   */
  uint64_t sh_offset;     /* Section file offset                 */
  uint64_t sh_size;       /* Section size in bytes               */
  uint32_t sh_link;       /* Link to another section             */
  uint32_t sh_info;       /* Additional section information      */
  uint64_t sh_addralign;  /* Section alignment                   */
  uint64_t sh_entsize;    /* Entry size if section holds table   */
} Elf64_Shdr;
```

| FIELD         | MEANING                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `sh_name`     | Index into `.shstrtab`. Zero means the section has no name                                       |
| `sh_type`     | Structure of the section contents (see below)                                                   |
| `sh_flags`    | Additional properties (see below)                                                               |
| `sh_addr`     | Virtual address at runtime; 0 if not loaded into memory                                          |
| `sh_offset`   | File offset in bytes from the file start                                                         |
| `sh_size`     | Section size in bytes                                                                            |
| `sh_link`     | Index of a related section (for example, a symbol table's associated string table)              |
| `sh_info`     | Extra info, meaning varies by type (for relocation sections, index of the section being patched)|
| `sh_addralign`| Required base address alignment; 0 or 1 means none                                               |
| `sh_entsize`  | Size of each entry when the section holds a table; 0 if unused                                   |

!!! note "sh_addr in a link time structure"
    A virtual address in a section header seems out of place for a link time only view, but the linker sometimes needs runtime addresses to perform relocations.

### Section Types (sh_type)

| TYPE          | CONTENTS                                                                          |
| ------------- | --------------------------------------------------------------------------------- |
| `SHT_PROGBITS`| Program data: machine instructions or constants, no structure for the linker      |
| `SHT_SYMTAB`  | Static symbol table (`Elf64_Sym` entries); may be absent if stripped              |
| `SHT_DYNSYM`  | Dynamic symbol table, used by the dynamic linker                                  |
| `SHT_STRTAB`  | String table: array of null terminated strings, first byte null by convention     |
| `SHT_REL` / `SHT_RELA` | Relocation entries (`Elf64_Rel` / `Elf64_Rela`) for static linking       |
| `SHT_DYNAMIC` | Dynamic linking information (`Elf64_Dyn`)                                          |

!!! note "Untrusted section names"
    When analyzing malware, do not rely on `sh_name`. Malware may use intentionally misleading section names.

### Section Flags (sh_flags)

| FLAG            | MEANING                                                          |
| --------------- | ---------------------------------------------------------------- |
| `SHF_WRITE`     | Writable at runtime (distinguishes variables from constants)     |
| `SHF_ALLOC`     | Loaded into virtual memory at execution (actual load uses segments) |
| `SHF_EXECINSTR` | Contains executable instructions                                 |

## Sections

`readelf --sections --wide a.out` lists them. The first entry of every ELF section header table is a `SHT_NULL` entry with all fields zeroed: a header with no name and no section.

### .init and .fini

`.init` holds executable code that runs before any other code in the binary, analogous to a constructor. `.fini` runs after the main program completes, analogous to a destructor. Both carry the `SHF_EXECINSTR` flag (shown as `X` by readelf).

### .text

The main code section, type `SHT_PROGBITS`, flags executable but not writable (`AX`). Executable sections should almost never be writable, since a writable code section would let an attacker overwrite program code through a vulnerability.

Besides application code, `.text` from gcc contains standard functions such as `_start`, `register_tm_clones`, and `frame_dummy`. The binary entry point points to `_start`, not `main`.

Path from entry point to `main`:

1. `_start` moves the address of `main` into `rdi` (a parameter register on x64).
2. `_start` calls `__libc_start_main` (resolved through the PLT).
3. `__libc_start_main` initializes, then calls `main` to begin user code.

### .bss, .data, .rodata

| SECTION   | TYPE          | WRITABLE | ON DISK | CONTENTS                                   |
| --------- | ------------- | -------- | ------- | ------------------------------------------ |
| `.rodata` | `SHT_PROGBITS`| No       | Yes     | Constant values (read only data)           |
| `.data`   | `SHT_PROGBITS`| Yes      | Yes     | Default values of initialized variables    |
| `.bss`    | `SHT_NOBITS`  | Yes      | No      | Space for uninitialized (zero) variables   |

`.bss` occupies no bytes on disk. It is a directive to allocate a zero initialized block of memory at load time. The name historically stands for "block started by symbol."

!!! note "Mixed code and data"
    Modern gcc and clang generally keep code and data separate. Visual Studio sometimes mixes constant data into code sections, which complicates disassembly because it becomes unclear which bytes are instructions.

### Lazy Binding and the .plt, .got, .got.plt Sections

Lazy binding defers resolution of dynamic references until the first actual reference, so the dynamic linker performs only relocations truly needed at runtime. It is the default on Linux. Setting `LD_BIND_NOW=1` forces all relocations at load time, used mainly for real time performance guarantees.

| SECTION    | KIND | CONTENTS                                                                 |
| ---------- | ---- | ----------------------------------------------------------------------- |
| `.plt`     | Code | Procedure Linkage Table: stubs directing calls to library functions      |
| `.got`     | Data | Global Offset Table: resolved addresses of data items                    |
| `.got.plt` | Data | GOT entries for library function addresses resolved via the PLT           |

`.got` and `.got.plt` were historically the same. With RELRO (`ld -z relro`), entries that must remain writable for lazy binding go in `.got.plt`, and all others go in a read only `.got`, defending against GOT overwriting attacks.

PLT structure: a default stub first, then one function stub per library function. Each stub begins with an indirect jump through a `.got.plt` slot, followed by a `push` of an integer identifier (incremented per stub) and a jump to the default stub.

```
.text                         .plt                              .got.plt
<main>:                       <default stub>:                   .got.plt[n]:
  ...            ┌─(4)──────>   push [rip+off]  ─(5)──>            <addr> ──(6)──> dynamic linker
  call puts@plt ─┘(1)           jmp  [rip+off]                      ▲
        │                     <puts@plt>:                           │
        └───────(1)──────────>  jmp  [rip+off] ─(2)────────────────┘
                                push 0x0        (3) initially points to next insn
                                jmp  <default stub>
```

First call to `puts@plt`:

1. `main` calls the PLT stub `puts@plt` instead of `puts` directly.
2. The stub jumps indirectly through its `.got.plt` slot.
3. Initially that slot points back to the next instruction in the stub (the `push`), so control falls through.
4. `push` places the stub identifier on the stack, then jumps to the default stub.
5. The default stub pushes an identifier for the executable and jumps (through the GOT) to the dynamic linker.
6. The dynamic linker resolves `puts`, writes its real address into the GOT slot, and transfers control to `puts`.

Subsequent calls: the GOT slot already holds the real address, so the initial indirect jump goes straight to `puts` without the dynamic linker.

Why a GOT rather than patching addresses into PLT code:

- Security. `.text` and `.plt` can stay read only. Only the writable data section `.got` is patched. Overwriting GOT addresses is a weaker attack than injecting arbitrary code into writable executable sections.
- Code shareability. A shared library maps to a different virtual address per process. Addresses patched into shared code would work in only one process. Each process has its own private GOT, so patching the GOT works everywhere.

Data references from code also route through the GOT to avoid patching data addresses into code, but go directly through `.got` without the PLT intermediate step. This is the distinction: `.got` for data items, `.got.plt` for library function addresses reached via the PLT.

### .rel.* and .rela.* Sections

Type `SHT_RELA` (and `SHT_REL`); each is a table of relocation entries. Each entry gives an offset where a relocation applies and how to resolve the value plugged in there. In a linked executable, only dynamic relocations remain; static relocations were resolved during static linking.

Common types shown by `readelf --relocs`:

| RELOCATION TYPE      | OFFSET IN  | PURPOSE                                                         |
| -------------------- | ---------- | -------------------------------------------------------------- |
| `R_X86_64_GLOB_DAT`  | `.got`     | Compute the address of a data symbol and store it in `.got`     |
| `R_X86_64_JUMP_SLO`  | `.got.plt` | Jump slot: address of a library function used by a PLT stub     |

The full computation per type is in the ELF specification and is usually not needed for normal analysis.

### .dynamic Section

A road map for the OS and dynamic linker when loading an ELF. It is a table of `Elf64_Dyn` structures (tags), each a type and an associated value.

| TAG TYPE                  | MEANING                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `DT_NEEDED`               | A shared library dependency (for example `libc.so.6`)       |
| `DT_VERNEED` / `DT_VERNEEDNUM` | Address and entry count of the version dependency table |
| `DT_STRTAB`               | Dynamic string table                                       |
| `DT_SYMTAB`               | Dynamic symbol table                                       |
| `DT_PLTGOT`               | `.got.plt` section                                         |
| `DT_RELA`                 | Dynamic relocation section                                 |

### .init_array and .fini_array

`.init_array` is a data section holding an array of pointers to constructor functions, each called during initialization before `main`. Unlike the single function in `.init`, it can hold arbitrarily many pointers, including custom constructors marked in C with `__attribute__((constructor))`. `.fini_array` is analogous but holds destructor pointers.

These pointer arrays are easy to modify, making them convenient hook points for adding initialization or finalization code. Older gcc versions use `.ctors` and `.dtors` instead.

### .shstrtab, .symtab, .strtab, .dynsym, .dynstr

| SECTION     | ROLE                                                                                | STRIPPABLE |
| ----------- | ----------------------------------------------------------------------------------- | ---------- |
| `.shstrtab` | Null terminated strings naming all sections, indexed by section headers             | No         |
| `.symtab`   | Static symbol table (`Elf64_Sym`), names mapped to code or data                     | Yes        |
| `.strtab`   | Strings pointed to by `.symtab` entries                                             | Yes        |
| `.dynsym`   | Symbols needed for dynamic linking (type `SHT_DYNSYM`)                              | No         |
| `.dynstr`   | Strings for `.dynsym`                                                               | No         |

The static table type `SHT_SYMTAB` versus dynamic `SHT_DYNSYM` lets `strip` recognize which symbol tables it can safely remove.

## Program Headers

The program header table provides the segment view, used by the OS and dynamic linker when loading an ELF into a process. A segment bundles zero or more sections into one chunk. Segments are needed only for executable ELF files, not for relocatable objects.

```c
typedef struct {
  uint32_t p_type;    /* Segment type            */
  uint32_t p_flags;   /* Segment flags           */
  uint64_t p_offset;  /* Segment file offset     */
  uint64_t p_vaddr;   /* Segment virtual address */
  uint64_t p_paddr;   /* Segment physical address*/
  uint64_t p_filesz;  /* Segment size in file    */
  uint64_t p_memsz;   /* Segment size in memory  */
  uint64_t p_align;   /* Segment alignment       */
} Elf64_Phdr;
```

Inspect with `readelf --wide --segments a.out`, which also prints the section to segment mapping, showing segments as bundles of sections.

### p_type

| TYPE          | MEANING                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `PT_LOAD`     | Loaded into memory at process setup. Usually at least two exist, one for nonwritable sections and one for writable data |
| `PT_INTERP`   | Contains `.interp`, the interpreter name used to load the binary          |
| `PT_DYNAMIC`  | Contains `.dynamic`, telling the interpreter how to prepare the binary    |
| `PT_PHDR`     | Encompasses the program header table itself                               |

### p_flags

| FLAG   | MEANING                                                            |
| ------ | ----------------------------------------------------------------- |
| `PF_X` | Executable; set for code segments (readelf shows `E`)              |
| `PF_W` | Writable; set for data segments, never for code                   |
| `PF_R` | Readable; normal for both code and data                           |

### p_offset, p_vaddr, p_paddr, p_filesz, p_memsz

| FIELD       | MEANING                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| `p_offset`  | File offset where the segment starts                                                   |
| `p_vaddr`   | Virtual address to load the segment at                                                 |
| `p_paddr`   | Physical load address; unused and zero on modern virtual memory systems like Linux     |
| `p_filesz`  | Segment size in the file                                                               |
| `p_memsz`   | Segment size in memory                                                                 |

For loadable segments, `p_vaddr` must equal `p_offset` modulo the page size (typically 4096 bytes).

`p_memsz` can exceed `p_filesz` because sections like `.bss` allocate memory without occupying file bytes. The loader appends the extra bytes at the end of the segment and zero initializes them.

### p_align

Required memory alignment in bytes, analogous to `sh_addralign`. Values 0 or 1 mean no alignment. Otherwise the value must be a power of 2, and `p_vaddr` must equal `p_offset` modulo `p_align`.
