# Chapter 1. Anatomy of a Binary

A binary executable file (binary) is a self contained file holding the machine code and data of a program. Machine code executed by the processor is called binary code. This chapter covers how binaries are produced from source, what symbolic information they carry, how their contents look under a disassembler, and how they are loaded for execution.

## The C Compilation Process

Compilation translates human readable source code (C, C++) into machine code the processor can execute. Compiling C involves four phases. One of them is confusingly also named compilation. Modern compilers merge some or all phases in practice, but conceptually they remain distinct.

```
file-1.c ┐                                      file-1.o ┐
file-2.c ├─> C preprocessor ─> C/C++ compiler   file-2.o ├─> Linker ─> a.out
file-n.c ┘   (+ header.h)          │            file-n.o ┘  (+ library.a)
                                   └─> Assembler ──┘
   Source                                        Object files      Binary executable
```

| PHASE         | INPUT              | OUTPUT              | GCC FLAG          |
| ------------- | ------------------ | ------------------- | ----------------- |
| Preprocessing | Source files       | Pure expanded C     | `-E -P`           |
| Compilation   | Preprocessed C     | Assembly (`.s`)     | `-S`              |
| Assembly      | Assembly files     | Object files (`.o`) | `-c`              |
| Linking       | Object files, libs | Binary executable   | default, `-o` name |

!!! note "Interpreted languages"
    Languages such as Python and JavaScript are interpreted on the fly rather than compiled as a whole. Parts may be compiled just in time (JIT) during execution, producing binary code in memory that is analyzable with the same techniques.

### Preprocessing Phase

The preprocessor expands all `#define` macros and `#include` directives. Every included header file is copied into the source in its entirety, with all type definitions, global variables, and function prototypes, so preprocessor output is verbose. Macro uses are replaced by the constants or expressions they represent. The result is pure C code ready to be compiled.

```
$ gcc -E -P compilation_example.c
```

`-E` stops gcc after preprocessing, `-P` omits debugging information for cleaner output.

### Compilation Phase

The compilation phase translates preprocessed code into assembly language, in human readable form with symbolic information intact. Most heavy optimization happens here, configurable through optimization levels (`-O0` through `-O3` in gcc). The optimization level has a profound effect on later disassembly.

The phase emits assembly rather than machine code for a practical reason. Many compiled languages exist (C, C++, Objective-C, Go, Haskell, and others). Emitting assembly per language and letting a single dedicated assembler handle the final translation is far less work than writing a machine code backend for every language.

```
$ gcc -S -masm=intel compilation_example.c
```

`-S` stores the assembly to a `.s` file, `-masm=intel` selects Intel syntax over the default AT&T syntax. In the output, constants and variables have symbolic names (an automatically generated label such as `.LC0` for a nameless string constant), and functions have explicit labels. Compilers may substitute library calls during optimization, for example replacing `printf` with the simpler `puts` when the format string reduces to a plain string.

### Assembly Phase

The assembler turns each assembly file into an object file (also called a module) containing machine instructions. Typically one source file corresponds to one assembly file and one object file.

```
$ gcc -c compilation_example.c
$ file compilation_example.o
compilation_example.o: ELF 64-bit LSB relocatable, x86-64, version 1 (SYSV), not stripped
```

| FILE OUTPUT FIELD | MEANING                                                      |
| ----------------- | ------------------------------------------------------------ |
| ELF 64-bit        | Conforms to the ELF specification, 64 bit variant             |
| LSB               | Least significant byte first in memory (little endian)        |
| relocatable       | Object file, not an executable                                |
| not stripped      | Symbolic information present                                  |

Relocatable files do not rely on placement at any particular memory address and can be moved without breaking assumptions in the code. Object files are compiled independently of each other, so the assembler cannot know the memory addresses of other modules. Relocatability is what allows linking them together in any order into a complete executable.

!!! note "Relocatable vs position independent executables"
    Position independent (relocatable) executables show up in `file` as shared objects, not relocatable files. They are distinguishable from ordinary shared libraries by having an entry point address.

### Linking Phase

The linker (link editor) merges all object files of a program into a single coherent executable, typically intended for loading at a particular memory address. It is usually a separate program from the compiler. Modern systems may add a link time optimization (LTO) pass here.

Before linking, the final addresses of referenced code and data are unknown. Object files contain relocation symbols specifying how function and variable references must eventually be resolved. References relying on a relocation symbol are called symbolic references, including references an object makes to its own functions or variables by absolute address. With module arrangement known, the linker resolves most symbolic references.

Library references resolve depending on library type.

| LIBRARY TYPE     | LINUX EXTENSION | RESOLUTION                                                                 |
| ---------------- | --------------- | -------------------------------------------------------------------------- |
| Static           | `.a`            | Merged into the executable, references fully resolved at link time         |
| Dynamic (shared) | `.so`           | One copy shared in memory by all programs, references left symbolic until load time |

```
$ gcc compilation_example.c
$ file a.out
a.out: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically
linked, interpreter /lib64/ld-linux-x86-64.so.2, ..., not stripped
```

The file is now an executable rather than relocatable. `dynamically linked` means it depends on shared libraries not merged into it. The `interpreter` field names the dynamic linker that resolves the remaining dynamic library dependencies at load time.

## Symbols and Stripped Binaries

Compilers emit symbols that track symbolic names from the source and record which binary code and data correspond to each name. Function symbols map high level function names to the start address and size of each function. Symbols serve the linker when combining object files (resolving inter module references) and aid debugging.

### Viewing Symbolic Information

```
$ readelf --syms a.out
```

For the `main` symbol the output shows its virtual address (`Value`), code size in bytes (`Size`), and type `FUNC`.

Symbolic information comes in flavors and locations.

| KIND              | CONTENT                                                                     | FORMAT / LOCATION                              |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Basic (linker)    | Names, addresses, sizes of functions and data                               | Embedded in the binary                          |
| Debugging symbols | Full source line to instruction mapping, function parameters, stack frames  | ELF: DWARF, usually embedded. PE: PDB, separate file |

Symbols can be parsed with `readelf`, programmatically with `libbfd`, or with dedicated libraries such as `libdwarf` for DWARF data.

Symbol value for analysis: function symbols give reliable disassembly starting points, reduce the chance of disassembling data as code, and let an analyst compartmentalize the binary into named functions. Even basic linker symbols are a large advantage.

### Stripping a Binary

Production binaries usually omit debugging information, and even basic symbols are often stripped to reduce file size and hinder reverse engineering (common for malware and proprietary software).

```
$ strip --strip-all a.out
```

After stripping, only the `.dynsym` symbol table remains. Its few entries are needed to resolve dynamic dependencies when the binary is loaded, and are of little use for disassembly. All static symbols, including `main`, are gone. This book assumes minimal symbolic information and focuses on stripped binaries.

## Disassembling a Binary

### Inside an Object File

`objdump` is a simple disassembler included with most Linux distributions.

```
$ objdump -sj .rodata compilation_example.o    # dump the .rodata section
$ objdump -M intel -d compilation_example.o    # disassemble, Intel syntax
```

`.rodata` (read only data) stores all constants, including string literals. The disassembly of the object file contains only the functions defined in the source file.

Two artifacts of unresolved references appear in the object file disassembly:

```
f:   bf 00 00 00 00    mov  edi, 0x0            ; pointer to string is zero
14:  e8 00 00 00 00    call 19 <main+0x19>      ; call target is nonsensical
```

Both operands are placeholders waiting for the linker. `readelf --relocs` lists the relocation symbols that instruct the linker how to patch them:

```
Offset            Type              Sym. Name + Addend
000000000010      R_X86_64_32       .rodata + 0
000000000015      R_X86_64_PC32     puts - 4
```

The relocation offset equals the offset of the instruction to fix plus one. Only the operand must be overwritten, not the opcode, and for these instructions the opcode is one byte long, so the relocation skips past the opcode byte.

### Examining a Complete Binary Executable

The linked executable contains far more code than the object file, spread over multiple sections.

| SECTION | CONTENT                                                             |
| ------- | ------------------------------------------------------------------- |
| `.init` | Program initialization code                                          |
| `.plt`  | Stubs for calling shared library functions                           |
| `.text` | Main code section: `main` plus standard gcc functions (`_start`, `__libc_csu_init`, and others) |
| `.fini` | Program finalization code                                            |

`_start` and its companions set up command line arguments and the runtime environment for `main` and clean up afterward. They are present in any ELF binary produced by gcc. All previously incomplete references are resolved: the call to `puts` now targets its PLT stub for the shared library containing `puts`.

Disassembling the stripped equivalent shows the cost of missing symbols. Sections remain distinguishable, but all functions in `.text` merge into one unlabeled blob of code. `_start`, `deregister_tm_clones`, and `main` begin at plain addresses with nothing marking them as function starts. Only `.plt` entries keep their names. This is why accurate automated function detection matters in binary analysis.

| PROPERTY            | OBJECT FILE            | EXECUTABLE (SYMBOLS)      | EXECUTABLE (STRIPPED)      |
| ------------------- | ---------------------- | ------------------------- | -------------------------- |
| Code present        | Defined functions only | Full program plus startup | Full program plus startup  |
| References          | Unresolved, placeholder operands | Resolved         | Resolved                   |
| Function boundaries | Labeled                | Labeled                   | Not marked, except PLT stubs |

## Loading and Executing a Binary

A binary's representation in memory does not correspond one to one to its on disk representation. Large zero initialized regions may be collapsed on disk and expanded in memory. Parts may be reordered in memory or not loaded at all. Details depend on the binary format.

```
        ┌──────────────────┐  high addresses
        │      Kernel      │
        ├──────────────────┤
        │      Stack       │ <- environment, arguments
        │        ↓         │
        ├──────────────────┤
        │  Memory mapping  │ <- interpreter, lib1.so, lib2.so
        │      area        │
        ├──────────────────┤
        │        ↑         │
        │       Heap       │
        ├──────────────────┤
        │       Data       │ <- data sections of the binary
        ├──────────────────┤
        │       Code       │ <- code sections; entry point receives control
        └──────────────────┘  address 0x0
           Virtual memory
```

Loading steps on a Linux based platform (loading a PE binary on Windows is similar at a high level):

1. The OS sets up a new process with its own virtual address space.
2. The OS maps an interpreter into the process's virtual memory. This is a user space program that knows how to load the binary and perform relocations. On Linux it is typically `ld-linux.so`. On Windows the interpreter functionality is part of `ntdll.dll`.
3. The kernel transfers control to the interpreter, which runs in user space.
4. The interpreter loads the binary into the same virtual address space, parses it to determine which dynamic libraries it uses, and maps them in (via `mmap` or equivalent).
5. The interpreter performs last minute relocations in the code sections, filling in correct addresses for dynamic library references.
6. The interpreter looks up the binary's entry point and transfers control to it, beginning normal execution.

ELF binaries carry a `.interp` section naming the interpreter path:

```
$ readelf -p .interp a.out
String dump of section '.interp':
  [ 0]  /lib64/ld-linux-x86-64.so.2
```

!!! note "Lazy binding"
    Resolution of references to dynamic library functions is often deferred. Instead of resolving all references at load time, the interpreter resolves each reference only when it is first invoked.

!!! note "Virtual memory"
    Each process has its own virtual address space, isolated from other processes. User mode memory accesses use virtual memory addresses. The OS moves parts of a program's virtual memory into and out of physical memory as needed, letting many programs transparently share limited physical memory.
