# Chapter 1. Code Patterns (1.1–1.11)

Notes on *Reverse Engineering for Beginners* (Dennis Yurichev), Chapter 1, sections 1.1 through 1.11.5. The chapter builds a working knowledge of assembly by compiling minimal C functions and reading the output across four instruction sets — x86, x86-64, ARM, and MIPS — with GCC, MSVC, Keil, and LLVM. The method is comparative: the same C source is fed to different compilers and architectures, and the divergence in output teaches what each part of the code compiles to.

Exercise solutions are kept separately in the [Challenges.re writeups](../../writeups/challenges-re/re4b-ch01.md).

## 1.1 The Method

Write a small piece of C, compile it, read the assembly. Repetition imprints the mapping between source constructs and generated code until a rough outline of the assembly can be predicted from the C, and vice versa. [Compiler Explorer](https://godbolt.org/){ .external-link } does the same across many compilers without a local toolchain.

**Optimization level and debug information.**

A compiler exposes roughly three optimization levels. Level zero disables optimization: output is verbose but readable, and debug builds carry a line-to-address mapping between each source line and its machine code. Optimizing builds are the opposite — faster code, entire source lines folded away or absent from the output. A reverse engineer meets both, because some developers ship optimized binaries and some do not, so examples throughout the book appear in both debug and release form where it matters.

## 1.2 Some Basics

### 1.2.1 A Short Introduction to the CPU

The CPU executes machine code. A short glossary:

| Term | Meaning |
| --- | --- |
| Instruction | A primitive CPU command (move data, access memory, primitive arithmetic). Each CPU has its own instruction set architecture (ISA). |
| Machine code | Code the CPU processes directly. Each instruction is encoded in one or more bytes. |
| Assembly language | Mnemonics plus conveniences (macros) mapping onto machine code. |
| CPU register | A fixed set of general-purpose registers (GPRs): ~8 in x86, ~16 in x86-64, ~16 in ARM. Treat a register as an untyped temporary variable. |

Humans work more easily in a high-level language; the CPU works more easily at a lower level of abstraction. The program translating one to the other is the compiler.

**A note on ISAs.**

x86 has always used variable-length instructions, so the 64-bit extension (x64) altered the ISA little; instructions inherited from the 16-bit 8086 still appear in modern CPUs. ARM is a RISC design built around fixed-length instructions.

| ARM mode | Instruction width | Notes |
| --- | --- | --- |
| ARM | 4 bytes | Original fixed-length encoding. |
| Thumb | 2 bytes | Denser encoding of the most common instructions; limited subset. |
| Thumb-2 | 2 and 4 bytes | Extends Thumb to full processor features (ARMv7); competitive with ARM mode. Not a mix of ARM and Thumb. |
| ARM64 (AArch64) | 4 bytes | 64-bit ISA; no Thumb mode. |

ARM, Thumb (incl. Thumb-2), and ARM64 are effectively three distinct ISAs that intersect partially. Code compiled for ARM mode and Thumb mode can coexist in one program. MIPS is another RISC ISA with fixed 32-bit instructions.

### 1.2.2 Numeral Systems

The radix (base) is the count of digits a system uses: decimal 10, binary 2, hexadecimal 16, octal 8. A number's value is independent of radix; only its written notation changes. A *number* is a value; a *digit* is a single character in a writing system.

### 1.2.3 Converting Between Radices

Positional notation gives each digit a weight by position. The value of a written number is the sum of each digit times its base raised to the digit's position index (rightmost = 0):

```text
1234    (decimal) = 10^3·1 + 10^2·2 + 10^1·3 + 10^0·4
0b101011 (binary) =  2^5·1 +  2^3·1 +  2^1·1 + 2^0·1 = 43
```

Hexadecimal is the common shorthand for bit patterns: one hex digit maps to exactly 4 bits, so binary↔hex conversion is mechanical. Radix is signalled by prefix or suffix:

| Radix | Prefixes / suffixes |
| --- | --- |
| Decimal | plain (`1234`), sometimes `d` suffix (`1234d`) |
| Binary | `0b` prefix (`0b100110111`) or `b` suffix (`100110111b`) |
| Hexadecimal | `0x` prefix (`0x1234ABCD`) or `h` suffix (`1234ABCDh`; leading `0` if it starts with A–F, e.g. `0ABCDEFh`); `$` prefix on 8-bit machines |
| Octal | leading `0` in C; used by `chmod` for POSIX permission bits (each octal digit = 3 permission bits, `rwx`) |

Multi-precision numbers (RSA keys, etc.) can be viewed as digits in a large radix: a number spread over bytes is radix 2^8 = 256; over 32-bit words, radix 2^32.

## 1.3 An Empty Function

The simplest function does nothing: `void f() { return; }`. Optimized, it reduces to a single control-transfer back to the caller.

| ISA | Output | Mechanism |
| --- | --- | --- |
| x86 / x64 | `ret` | Pops the return address off the stack and jumps to it. |
| ARM | `bx lr` | Jumps to the address held in the link register (LR); the return address is not on the stack. |
| MIPS | `j $31` (`jr $ra`) + `nop` | Jumps to the return address in `$31`/`$RA` (ARM's LR analogue). The `nop` fills the branch delay slot. |

MIPS registers have two naming conventions: by number (`$0`–`$31`) or pseudo-name (`$V0`, `$A0`). GCC listings use numbers; IDA uses pseudo-names.

### 1.3.4 Empty Functions in Practice

Empty functions are common in real code. A debug logger compiled without `_DEBUG` collapses to nothing yet is still called at every site. A demo build with `#ifndef DEMO` around the real body leaves a callable stub with no effect — enabling a disabled menu item in a cracked demo only invokes the empty function. IDA labels such stubs `nullsub_00`, `nullsub_01`, etc.

## 1.4 Returning Values

Returning a constant (`int f() { return 123; }`) loads the value into the return register, then returns.

| ISA | Return register | Load instruction |
| --- | --- | --- |
| x86 / x64 | `EAX` | `mov eax, 123` |
| ARM | `R0` | `mov r0, #0x7b` |
| MIPS | `$2` (`$V0`) | `li $2, 123` (LI = Load Immediate) |

The caller reads the result from the return register. `MOV` is a misnomer — data is copied, not moved (other ISAs call this LOAD/STORE). On MIPS the load and jump appear swapped in the listing because of the **branch delay slot**: the instruction textually after a branch or jump executes *before* the transfer takes effect, so branch instructions always trade places with the instruction that logically precedes them. Functions returning only 0 or 1 are ubiquitous (`/bin/true`, `/bin/false`).

## 1.5 Hello, world!

```c
#include <stdio.h>
int main() { printf("hello, world\n"); return 0; }
```

### 1.5.1 x86

The string literal has type `const char[]` and no name in source, so the compiler assigns an internal label (MSVC: `$SG3830`) and stores it null-terminated in a data segment (`CONST`/`.rodata`). `main` opens with a prologue and closes with an epilogue.

MSVC output, annotated:

```asm
push    ebp                     ; prologue: save frame pointer
mov     ebp, esp                ; prologue: set new frame pointer
push    OFFSET $SG3830          ; push string pointer (the printf argument)
call    _printf
add     esp, 4                  ; caller cleans the 1 argument (4 bytes) off the stack
xor     eax, eax                ; return 0
pop     ebp                     ; epilogue
ret     0
```

Recurring idioms:

| Idiom | Purpose | Alternative forms |
| --- | --- | --- |
| `add esp, 4` after a call | Discard pushed argument(s); equivalent to a `POP` without touching a register | `pop ecx` (Intel C++, MSVC) — 1-byte opcode vs 3-byte `add`, clobbers ECX but modifies flags either way |
| `xor eax, eax` | Set return value to 0 | `mov eax, 0` (5 bytes) or `sub eax, eax` — `xor` is 2 bytes |

GCC (non-optimizing) differs: it aligns the stack with `and esp, 0FFFFFFF0h` (16-byte boundary — the CPU is faster on aligned data), allocates 16 bytes with `sub esp, 10h` (rounded up even though 4 are used), stores the string pointer directly with `mov [esp], eax` instead of `push`, and ends with `leave` (equivalent to `mov esp, ebp` / `pop ebp`). Non-optimizing GCC emits the longer `mov eax, 0`.

**GCC: AT&T syntax.**

`gcc -S` emits AT&T syntax (the UNIX default). Differences from Intel syntax:

| Aspect | Intel | AT&T |
| --- | --- | --- |
| Operand order | `dst, src` (read as `dst = src`) | `src, dst` (read as `src → dst`) |
| Registers | `eax` | `%eax` |
| Immediates | `123` | `$123` |
| Memory | `[ebx+8]` | `8(%ebx)` |
| Operand size | inferred / `ptr` | suffix: `q` (64), `l` (32), `w` (16), `b` (8) |

`$-16` in AT&T equals Intel's `0FFFFFFF0h`; for a 32-bit type, `-0x10` is `0xFFFFFFF0`.

**String patching.**

The literal can be found in the binary (Hiew, radare2) and overwritten in place, provided the replacement is no longer than the original (trailing zero bytes are risky to reuse — they may be needed elsewhere). This was the standard MS-DOS-era localization technique and is why old localized software used cramped abbreviations. In radare2: `/ hello` searches, `s <addr>` seeks, `oo+` reopens read-write, `w hola, mundo\x00` writes.

### 1.5.2 x86-64

In 64-bit mode registers gain an `R` prefix and arguments move into registers (fastcall-style) to reduce memory traffic.

| ABI | First integer/pointer arguments | Overflow |
| --- | --- | --- |
| Win64 (MSVC) | `RCX, RDX, R8, R9` | stack; caller reserves 40 bytes of "shadow space" |
| System V (Linux/*BSD/macOS, GCC) | `RDI, RSI, RDX, RCX, R8, R9` | stack |

The register aliasing hierarchy (`RAX` ⊃ `EAX` ⊃ `AX` ⊃ `AH`/`AL`) means `int` returns clear `EAX`, the 32-bit part, keeping `int` 32-bit for portability. GCC writes the string pointer with `mov edi, ...` rather than `mov rdi, ...`: **any write to a 32-bit register in 64-bit mode zeroes the upper 32 bits**, and the 32-bit form is a shorter (5-byte vs 7-byte) opcode, safe because the data segment sits below 4 GiB. Under System V, `xor eax, eax` before a variadic call reports the number of vector registers used (here zero).

### 1.5.3 ARM

Keil (ARM mode), annotated:

```asm
STMFD  SP!, {R4,LR}        ; save R4 and LR to stack (generalized PUSH)
ADR    R0, aHelloWorld     ; PC-relative address of the string into R0 (arg 1)
BL     __2printf           ; save return addr in LR, jump to printf
MOV    R0, #0              ; return 0
LDMFD  SP!, {R4,PC}        ; restore R4 and PC from stack (generalized POP)
```

| Instruction | Role |
| --- | --- |
| `STMFD SP!, {...}` | Store Multiple Full Descending — pushes any set of registers; generalizes x86 `PUSH`. `PUSH`/`POP` exist only in Thumb mode. |
| `ADR R0, label` | Computes a PC-relative address (position-independent code): adds a fixed offset to PC so the string's absolute address is derived wherever the code loads. |
| `BL target` | Branch with Link — stores the address after `BL` into LR, then jumps to `target`. The callee returns by jumping to LR. |
| `LDMFD SP!, {...}` | Load Multiple Full Descending — inverse of `STMFD`. Restoring into `PC` returns from the function, so no separate `BX LR` is needed. |

LR (link register) holds the return address in RISC style, versus the stack in CISC x86. The prologue saves LR because `main` itself calls `printf` (which overwrites LR); the epilogue restores it into PC. `BL`'s offset is encoded in 24 bits; since ARM-mode instructions are 4-byte aligned the low 2 bits are implied, giving a 26-bit reach of PC ± ~32 MB. In Thumb mode instructions are 2 bytes, so `BL` is two 16-bit halves (10 high bits + 11 low bits of offset), reach PC ± ~2 MB. `DCB` declares bytes/strings (ARM analogue of x86 `DB`).

Optimizing LLVM may replace `printf` with `puts` when the format string has no `%` conversions — `puts` is cheaper. `MOVT R0, #x` (Move Top) writes the high 16 bits of a register, used with `MOV`/`ADD PC` to build a full address in ARM mode.

### 1.5.4 MIPS

The string address is passed in a register, yet the function still sets up a local stack frame: `RA` and `GP` must be saved somewhere because `printf` is called. A **leaf function** (one calling nothing) could omit the prologue/epilogue entirely. The argument goes in `$A0`; the call uses `jalr`; branch delay slots are filled with `nop`/`or $at, $zero`.

### 1.5.5 Conclusion

The only substantive difference between the 32-bit (x86/ARM) and 64-bit (x64/ARM64) versions is pointer width: pointers are now 64 bits, because cheaper, more abundant memory outgrew the 4 GiB an unsigned 32-bit pointer can address.

### 1.5.6 Exercises

- [Challenge #48](../../writeups/challenges-re/re4b-ch01.md#challenge-48-messagebeep-wrapper) — win32 function, x86.
- [Challenge #49](../../writeups/challenges-re/re4b-ch01.md#challenge-49-sleep-wrapper) — Linux function, x64 (AT&T).

## 1.6 Function Prologue and Epilogue

The prologue sets up the frame; the epilogue tears it down.

```asm
; prologue                 ; epilogue
push  ebp                  mov   esp, ebp
mov   ebp, esp             pop   ebp
sub   esp, X               ret   0
```

The prologue saves EBP, points EBP at the current stack top, and reserves `X` bytes for local variables. EBP stays fixed for the function's duration and serves as a stable base for accessing locals and arguments (ESP works too but shifts as data is pushed/popped). The epilogue releases the locals, restores EBP, and returns. Disassemblers use prologue/epilogue patterns to delimit functions.

### 1.6.1 Recursion

Prologues and epilogues add per-call overhead, which penalizes recursion.

## 1.7 An Empty Function: redux

Non-optimizing GCC compiles the empty function *with* prologue and epilogue:

```asm
f: push rbp
   mov  rbp, rsp
   nop
   pop  rbp
   ret
```

Only `ret` is effective; the frame setup and `nop` are un-optimized artifacts.

## 1.8 Returning Values: redux

Non-optimizing GCC for `int f() { return 123; }`:

```asm
f: push rbp
   mov  rbp, rsp
   mov  eax, 123
   pop  rbp
   ret
```

`mov eax, 123` and `ret` are effective; the rest is prologue/epilogue.

## 1.9 Stack

The stack is a LIFO block of process memory addressed by a pointer register (`ESP`/`RSP` on x86/x64, `SP` on ARM).

| Operation | Effect (32-bit / 64-bit) |
| --- | --- |
| `PUSH x` | Subtract 4 / 8 from SP, then write `x` at `[SP]`. |
| `POP r` | Read `[SP]` into `r`, then add 4 / 8 to SP. |

After allocation SP points at the bottom (the lowest-address end of the block); `PUSH` moves it lower, `POP` moves it higher. ARM supports both descending (`STMFD`/`LDMFD`, `STMED`/`LDMED`) and ascending (`STMFA`/`LDMFA`, `STMEA`/`LDMEA`) stacks.

### 1.9.1 Why the Stack Grows Backwards

Historical. On early machines memory was split with the heap growing up from a low address and the stack growing down from the highest address, so the two regions could expand toward each other and only collide if total space ran out (UNIX, 1974: the stack segment "automatically grows downward as the hardware's stack pointer fluctuates"). Analogy: two sets of lecture notes in one notebook, the second written from the back, flipped.

### 1.9.2 What the Stack Is Used For

**Saving the return address.**

`CALL` = `PUSH address_after_call` + `JMP operand`. `RET` = `POP tmp` + `JMP tmp`. Unbounded recursion (`void f() { f(); }`) overflows the stack; MSVC warns (C4717) but still emits correct code, and with `/Ox` converts the tail call into a `jmp` loop that never overflows. On ARM the return address is in LR; a function that calls another must save LR (typically `PUSH {R4-R7, LR}` in the prologue, `POP {R4-R7, PC}` in the epilogue). A leaf function does not modify LR, so it need not save it and, if small, may avoid the stack entirely — faster, and usable when stack memory is not yet available.

**Passing arguments.**

The common x86 convention is **cdecl**: push arguments in reverse order, call, then clean the stack in the caller.

```asm
push arg3
push arg2
push arg1
call f
add  esp, 12        ; caller cleanup, 3 args × 4 bytes
```

Argument layout at the callee's first instruction:

| Address | Contents |
| --- | --- |
| `ESP` | return address |
| `ESP+4` | argument #1 (`arg_0` in IDA) |
| `ESP+8` | argument #2 (`arg_4`) |
| `ESP+0xC` | argument #3 (`arg_8`) |

The callee is not told how many arguments were passed; variadic functions like `printf` infer the count from `%` specifiers in the format string. `printf("%d %d %d", 1234)` prints 1234 then two unpredictable stack values. The CRT calls `main` as `push envp / push argv / push argc / call main`, so `argc`/`argv`/`envp` are always present regardless of how `main` is declared.

Nothing forces arguments through the stack. Alternatives: **global variables** (breaks recursion and thread-safety, since the function would clobber its own arguments), and **registers** — as in MS-DOS (`mov ah, 9 / int 21h`), where the carry flag (CF) often carried a boolean error result.

**Local variable storage.**

A function reserves local space by decrementing SP, so allocation cost is constant regardless of variable count. Storing locals (and, on Windows, SEH records) on the stack means they are freed automatically at function exit with one SP adjustment, unlike heap memory which must be freed explicitly. `alloca()` allocates on the stack rather than the heap and needs no matching `free`.

### 1.9.3 A Typical Stack Layout

32-bit frame at function entry (before the first instruction):

| Address | Contents |
| --- | --- |
| `ESP-0xC` | local variable #2 (`var_8`) |
| `ESP-8` | local variable #1 (`var_4`) |
| `ESP-4` | saved EBP |
| `ESP` | return address |
| `ESP+4` | argument #1 (`arg_0`) |
| `ESP+8` | argument #2 (`arg_4`) |
| `ESP+0xC` | argument #3 (`arg_8`) |

### 1.9.4 Noise in the Stack

"Garbage" or "noise" values are leftovers from earlier function executions, not random in the strict sense but unpredictable. If several functions with the same argument count run in sequence, SP is identical at each entry, so their locals occupy the same addresses and one function sees the previous one's stale values. The C standard does not fix the allocation order of local variables — MSVC 2010 and MSVC 2013 order the same three locals differently, changing which stale values surface.

### 1.9.5 Exercises

- [Challenge #51](../../writeups/challenges-re/re4b-ch01.md#challenge-51-printf-with-missing-arguments) — `printf` with missing arguments (stack).
- [Challenge #52](../../writeups/challenges-re/re4b-ch01.md#challenge-52-printf-of-time) — `printf` of `time()` (stack).

## 1.10 Almost Empty Function

A wrapper that forwards its arguments unchanged (a thunk):

```c
int main(int argc, char **argv) { return boolector_main(argc, argv); }
```

Non-optimizing GCC emits a prologue, redundant argument shuffling, `call boolector_main`, epilogue, `ret`. Optimizing GCC reduces the whole thing to a **tail call**:

```asm
main: jmp boolector_main
```

Registers and stack are untouched and the callee sees the same arguments, so control simply transfers to another address.

## 1.11 printf() with Several Arguments

```c
int main() { printf("a=%d; b=%d; c=%d", 1, 2, 3); return 0; }
```

### 1.11.1 x86

Arguments are pushed in reverse order — the first argument ends up on top of the stack:

```asm
push 3
push 2
push 1
push OFFSET $SG3830     ; format string
call _printf
add  esp, 16            ; cdecl caller cleanup: 4 args × 4 bytes
```

With cdecl in a 32-bit environment, the argument count can often be recovered by dividing the stack-cleanup constant by 4 (here 16/4 = 4). When several calls are adjacent, the compiler may merge their cleanups into a single `add esp, X` after the last one. `printf` returns the number of characters printed (in EAX). Critically, cdecl makes the **caller** restore ESP — after the call, ESP and the pushed arguments are still in place; the callee does not clean up. ECX/EDX may be freely clobbered by the callee (they are volatile).

### 1.11.2 ARM

The first four arguments go in `R0`–`R3`; further arguments go on the stack. To pass eight `int`s plus a format string, the prologue saves LR (`STR LR, [SP,#var_4]!`, pre-indexed, like `PUSH`), reserves 5×4 = 20 bytes for the five stacked arguments, stages four of them in `R0`–`R3` and block-stores them to the stack with `STMIA`/`STMFA` (`STMFA` = Store Multiple Full Ascending = `STMIB`), then loads the register-passed arguments. Optimizing compilers reorder instructions to expose parallelism — two instructions writing different registers (`MOVT R0` and `MOV R2`) can issue together, whereas two touching the same register cannot.

### 1.11.3 MIPS

The first four arguments go in `$A0`–`$A3` (`$4`–`$7`), the rest on the stack (`SW $reg, N($sp)`). The frame is set up in the prologue, `GP` and `RA` saved, `printf` reached via `$T9`/`jalr`, and return value zeroed with `move $v0, $zero`.

### 1.11.4 Conclusion

Skeleton of a call across ISAs:

| ISA | Argument passing |
| --- | --- |
| x86 (cdecl) | `PUSH` args in reverse order → `CALL` → adjust SP if needed |
| x64 (Win64) | `RCX, RDX, R8, R9`, then stack → `CALL` |
| x64 (System V) | `RDI, RSI, RDX, RCX, R8, R9`, then stack → `CALL` |
| ARM | `R0, R1, R2, R3`, then stack → `BL` |
| ARM64 | `X0`–`X7`, then stack → `BL` |
| MIPS (O32) | `$A0`–`$A3` (`$4`–`$7`), then stack → `JALR` |

On x64, 8 bytes are reserved per stacked argument even for types shorter than 64 bits (32-bit environments reserve 4), which keeps every argument at an aligned address and makes address arithmetic uniform.

### 1.11.5 By the Way

The variety of passing conventions across x86, x64, fastcall, ARM, and MIPS shows that **the CPU is oblivious to calling conventions** — it does not know or enforce how arguments reach a function. A compiler could pass everything through a dedicated structure with no stack at all. The MIPS `$A0`–`$A3` labels are conventional (O32) only; any register (except perhaps `$ZERO`) could be used. Beginners passing arguments via registers in arbitrary order, or via global variables, still produce working code.
