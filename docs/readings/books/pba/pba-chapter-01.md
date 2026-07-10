# Chapter 1 — Anatomy of a Binary

Machine code executed by the processor is *binary code*. A program's binary code and data are stored in a single self-contained file: a *binary executable file*, or *binary*.

## 1.1 The C Compilation Process

*Compilation* translates human-readable source (C, C++) into machine code. Four phases; modern compilers merge some or all of them in practice.

| Phase | Input | Output | gcc invocation |
|---|---|---|---|
| Preprocessing | `.c` source | Pure C, directives expanded | `gcc -E -P` |
| Compilation | Preprocessed C | Assembly (`.s`) | `gcc -S -masm=intel` |
| Assembly | Assembly | Object file (`.o`) | `gcc -c` |
| Linking | Object files, libraries | Binary executable | `gcc` (default; `-o` to name output) |

!!! note "Interpreted languages"
    Python, JavaScript, etc. are interpreted on the fly rather than compiled as a whole. Parts may be compiled *just in time (JIT)* during execution, producing binary code in memory that can be analyzed with the same techniques, though interpreted languages require language-specific steps.

### Preprocessing

Expands all `#define` macros and `#include` directives. Each included header (`.h`) is copied into the source in its entirety, so preprocessor output is verbose. What remains is pure C ready for compilation.

### Compilation

Translates preprocessed code into assembly. Most optimization happens here (`-O0` through `-O3` in gcc); the optimization level profoundly affects later disassembly.

The output is assembly rather than machine code so that one dedicated assembler can serve every compiled language (C, C++, Objective-C, Go, Haskell, ...) instead of each compiler emitting machine code itself. The emitted assembly is human-readable, with symbolic names and labels intact.

!!! note "Call substitution"
    Compilers may substitute library calls during optimization — gcc replaces `printf` with the simpler `puts` when the format string reduces to a plain string.

### Assembly

Produces *object files* (also *modules*), typically one per assembly file. Object files contain machine instructions, but references between files are unresolved.

`file` reports an object file as `ELF 64-bit LSB relocatable`:

| Field | Meaning |
|---|---|
| ELF | Conforms to the ELF specification |
| 64-bit | Compiled for a 64-bit architecture |
| LSB | Least significant byte first (little-endian) |
| relocatable | Can be placed at any memory address without breaking assumptions |

Object files must be relocatable because they are compiled independently: the assembler cannot know the addresses of other object files, so the linker must be free to arrange them in any order.

!!! note "Relocatable vs. PIE"
    Position-independent *executables* are also relocatable but show up in `file` as shared objects, not relocatable files. They are distinguishable from ordinary shared libraries by having an entry point address.

### Linking

The *linker* (*link editor*) merges all object files into one executable, typically intended for a particular base address. Object files reference functions and variables whose final addresses are unknown before linking; such references rely on *relocation symbols* and are called *symbolic references*. With module layout fixed, the linker resolves most of them. Some systems add *link-time optimization (LTO)* here.

| Library type | Extension (Linux) | Resolution |
|---|---|---|
| Static | `.a` | Merged into the executable; references fully resolved at link time |
| Dynamic (shared) | `.so` | One copy shared in memory by all programs; linker leaves symbolic references, resolved only when the binary is loaded |

`file` on the linked binary reports `executable` (no longer `relocatable`), `dynamically linked`, and the *interpreter* (`/lib64/ld-linux-x86-64.so.2`) that resolves dynamic-library dependencies at load time.

## 1.2 Symbols and Stripped Binaries

Compilers emit *symbols* mapping symbolic names to binary code and data. Function symbols map a name to the function's start address and size. Used by the linker to resolve inter-module references; also aid debugging.

| Flavor | Contents | Format |
|---|---|---|
| Basic (linker) symbols | Name → address, size, type | ELF symbol tables (`readelf --syms`) |
| Debugging symbols | Source line ↔ instruction mapping, function parameters, stack frame info | DWARF (ELF, usually embedded); PDB (PE, separate file) |

Symbols make disassembly far easier: each function symbol is a disassembly starting point, reducing the risk of disassembling data as code, and names help a human compartmentalize the code.

Production binaries typically omit debugging information, and even basic symbols are often *stripped* (`strip --strip-all`) to reduce size and hinder reverse engineering. After stripping, only `.dynsym` remains — the symbols needed to resolve dynamic dependencies at load time; `.symtab` (including `main`) is gone.

## 1.3 Disassembling a Binary

### Object file

- `objdump -sj .rodata` — dump the read-only data section (constants, including string literals).
- `objdump -M intel -d` — disassemble, Intel syntax.

An object file contains only the code defined in its source file. Code and data references are unresolved: the pointer to the `"Hello, world!"` string is zero, and the `call` to `puts` points into the middle of `main`. The `.rela.text` section (`readelf --relocs`) lists the relocations the linker must apply: one resolving the string reference into `.rodata`, one resolving the `puts` call.

The relocation offset equals the offset of the instruction to fix **plus one**: only the operand must be overwritten, not the opcode, and both opcodes here are 1 byte.

### Executable, with symbols

The linked binary contains far more code than the object file, spread over multiple sections (`.init`, `.plt`, `.text`, `.fini`, ...). `.text` holds `main` plus standard gcc-inserted functions such as `_start` (sets up arguments and the runtime environment for `main`) and `__libc_csu_init`. References are resolved: the `puts` call targets its `.plt` stub.

### Executable, stripped

Sections remain distinguishable, but function boundaries are gone — all code in `.text` is one contiguous blob with nothing marking where `_start`, `deregister_tm_clones`, or `main` begin. Only `.plt` stub names survive. This is why accurate automated function detection matters in binary analysis.

## 1.4 Loading and Executing a Binary

A binary's in-memory representation does not correspond one-to-one with its on-disk representation — e.g., large zero-initialized regions are collapsed on disk but expanded in memory; some parts are reordered or never loaded.

Loading, at a high level (ELF on Linux; PE on Windows is similar):

1. OS creates a new process with its own virtual address space.
2. OS maps an *interpreter* into that space — a user-space program that knows how to load the binary and perform relocations. Linux: `ld-linux.so`; Windows: part of `ntdll.dll`. ELF binaries name their interpreter in the `.interp` section (`readelf -p .interp`).
3. Kernel transfers control to the interpreter.
4. Interpreter loads the binary into the same virtual address space, parses it, and maps in the dynamic libraries it uses (via `mmap` or equivalent).
5. Interpreter performs relocations to fill in dynamic-library addresses. In practice most are deferred until first use — *lazy binding*.
6. Interpreter looks up the entry point and transfers control to it.

Resulting memory layout (low → high): code, data, heap (grows up), memory-mapping area (interpreter and shared libraries), stack (grows down; holds arguments and environment), kernel.

!!! note "Virtual memory"
    Each process has an isolated virtual address space; all user-mode memory accesses use virtual memory addresses. The OS pages a program's virtual memory into and out of physical memory as needed, letting many programs transparently share limited physical memory.
