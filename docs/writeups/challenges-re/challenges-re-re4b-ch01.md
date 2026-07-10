# Challenges.re — RE4B Chapter 1 Exercises

Solutions to the [challenges.re](https://challenges.re/){ .external-link } exercises referenced in *Reverse Engineering for Beginners*, Chapter 1. Each challenge gives a short disassembly and asks two questions: what the function does (one sentence) and its C equivalent. Book notes: [RE4B Chapter 1](../../readings/books/re4b/re4b-chapter-01.md).

| # | Book section | Topic |
| --- | --- | --- |
| [48](#challenge-48-messagebeep-wrapper) | [1.5.6](../../readings/books/re4b/re4b-chapter-01.md#156-exercises) | win32 library wrapper (x86) |
| [49](#challenge-49-sleep-wrapper) | [1.5.6](../../readings/books/re4b/re4b-chapter-01.md#156-exercises) | Linux library wrapper (x64, AT&T) |
| [51](#challenge-51-printf-with-missing-arguments) | [1.9.5](../../readings/books/re4b/re4b-chapter-01.md#195-exercises) | stack noise, missing arguments |
| [52](#challenge-52-printf-of-time) | [1.9.5](../../readings/books/re4b/re4b-chapter-01.md#195-exercises) | timestamp, 64-bit `time_t` truncation |

## Challenge #48 — MessageBeep wrapper

Tags: X86, WINDOWS, ASM, L1.

```asm
main:
    push 0xFFFFFFFF
    call MessageBeep
    xor  eax,eax
    retn
```

**Analysis.** One argument (`0xFFFFFFFF`) is pushed and `MessageBeep` is called. The Win32 `MessageBeep(UINT uType)` takes a sound type; `0xFFFFFFFF` (`-1` / `(UINT)MB_ICONERROR`-none) selects the simple standard beep, generated through the PC speaker if no sound device is present. `xor eax, eax` sets the return value to 0 (see the `xor` idiom in [§1.5.1](../../readings/books/re4b/re4b-chapter-01.md#151-x86)); `retn` returns. No stack cleanup is needed because `MessageBeep` uses the stdcall convention and cleans its own argument.

**One sentence.** Plays a simple system beep and returns 0.

**C.**

```c
#include <windows.h>
int main() { MessageBeep(0xFFFFFFFF); return 0; }
```

## Challenge #49 — sleep wrapper

Tags: X64, LINUX, ASM, L1. AT&T syntax.

```asm
main:
    pushq %rbp
    movq  %rsp, %rbp
    movl  $2, %edi
    call  sleep
    popq  %rbp
    ret
```

**Analysis.** Non-optimizing GCC output: `push rbp` / `mov rbp, rsp` is the prologue, `pop rbp` the epilogue ([§1.6](../../readings/books/re4b/re4b-chapter-01.md#16-function-prologue-and-epilogue)). Under System V x86-64 the first integer argument is passed in `RDI`; `movl $2, %edi` places `2` there — writing the 32-bit `EDI` zeroes the upper half of `RDI` ([§1.5.2](../../readings/books/re4b/re4b-chapter-01.md#152-x86-64)). `sleep(2)` suspends execution for two seconds. The return value is not set, so `main` returns whatever `sleep` left in `EAX` (its count of unslept seconds, normally 0).

**One sentence.** Sleeps for two seconds.

**C.**

```c
#include <unistd.h>
int main() { sleep(2); return 0; }
```

## Challenge #51 — printf with missing arguments

Tags: L1 (stack).

```c
#include <stdio.h>
int main()
{
    printf("%d, %d, %d\n");
    return 0;
}
```

**Analysis.** The format string demands three `int`s, but none are supplied. `printf` reads three arguments regardless, from wherever the calling convention says they should be — and prints whatever noise is there ([§1.9.4](../../readings/books/re4b/re4b-chapter-01.md#194-noise-in-the-stack)).

- **MSVC, 32-bit, cdecl.** Only the format-string pointer is pushed; `printf` then reads its 2nd–4th arguments from `[esp+4]`, `[esp+8]`, `[esp+0xC]`. Those slots hold stale values left by earlier code (CRT startup, prior calls) — unpredictable but not random.
- **MSVC with `/Ox`.** Still stack-passed, but optimization changes which prior code ran and what it left behind, so the three slots hold different leftovers and the printed numbers change.
- **GCC, x86-64, System V.** The first arguments after the format string are passed in **registers** (`ESI`, `EDX`, `ECX`), not on the stack. `printf` therefore prints whatever those registers happened to contain at the call site — a completely different origin from the stack-based values MSVC prints. This is why the situation differs entirely between compilers: the numbers' source is dictated by the calling convention ([§1.11](../../readings/books/re4b/re4b-chapter-01.md#1114-conclusion)), not by the C source.

**One sentence.** Prints three unpredictable "garbage" values read from wherever the (absent) arguments would live — stack slots under 32-bit cdecl (MSVC), registers under x86-64 System V (GCC).

**C.** Undefined behavior as written; the values have no defined source. It is not reconstructable to well-defined C because the program itself is the bug.

## Challenge #52 — printf of time()

Tags: stack (X86, ARM, MIPS).

x86 (MSVC):

```asm
$SG3103 DB '%d', 0aH, 00H
_main PROC
    push 0
    call DWORD PTR __imp___time64
    push edx
    push eax
    push OFFSET $SG3103            ; '%d'
    call DWORD PTR __imp__printf
    add  esp, 16
    xor  eax, eax
    ret  0
_main ENDP
```

ARM (Thumb / ARM mode, condensed):

```asm
main PROC
    PUSH {r4,lr}
    MOV  r0,#0
    BL   time
    MOV  r1,r0
    ADR  r0,|L0.32|
    BL   __2printf
    MOV  r0,#0
    POP  {r4,pc}
ENDP
|L0.32| DCB "%d\n",0
```

**Analysis.** `time(NULL)` / `_time64(0)` returns the number of seconds since the Unix epoch (1970-01-01 00:00:00 UTC); the result is handed to `printf("%d\n", ...)`. The x86 listing pushes arguments in reverse cdecl order ([§1.11.1](../../readings/books/re4b/re4b-chapter-01.md#1111-x86)): `push 0` is `time`'s argument, then the 64-bit return value (`EDX:EAX`) is pushed as two 32-bit words, then the format pointer. `add esp, 16` cleans four 4-byte slots.

**Additional questions.**

- *Why did MSVC replace `time()` with `_time64()`?* In MSVC, `time_t` defaults to the 64-bit `__time64_t`, and `time()` is a wrapper over `_time64()`. This is deliberate: a 32-bit `time_t` overflows in 2038.
- *Is it correct? Dangerous?* The type is mismatched. `_time64` returns 64 bits (`EDX:EAX`), but the format specifier is `%d`, which consumes a single 32-bit `int`. `printf` reads only the low word (`EAX`) and never consumes the high word (`EDX`) pushed above it — leaving a stray 32-bit value on the stack relative to the format string. It works today only because the current timestamp fits in the low 32 bits. It is technically incorrect and fragile; the correct specifier for a 64-bit `time_t` is `%lld`.
- *What will `printf` print after 2038?* `%d` interprets the low 32 bits as a **signed** `int`. After 2038-01-19 03:14:07 UTC that value crosses 0x7FFFFFFF and reads as negative, so `printf` prints a negative number even though the underlying 64-bit `_time64` value is still correct — the bug is the truncation to signed 32-bit through `%d`, not the timekeeping.

**One sentence.** Prints the current Unix timestamp (seconds since 1970-01-01 UTC).

**C.**

```c
#include <stdio.h>
#include <time.h>
int main() { printf("%d\n", (int)time(NULL)); return 0; }
```
