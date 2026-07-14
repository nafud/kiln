# RE4B Chapter 1

Solutions to the [challenges.re](https://challenges.re/){ .external-link } exercises referenced in *Reverse Engineering for Beginners*, Chapter 1. Each challenge gives a short listing and asks what the code does. Where a challenge adds follow-up questions, they are answered in place. Book notes are at [RE4B Chapter 1](../../readings/books/re4b/re4b-chapter-01.md).

| Challenge | Book section | Topic |
| --------- | ------------ | ----- |
| [48](#challenge-48-messagebeep-wrapper) | [1.5.6](../../readings/books/re4b/re4b-chapter-01.md#156-exercises) | win32 library wrapper (x86) |
| [49](#challenge-49-sleep-wrapper) | [1.5.6](../../readings/books/re4b/re4b-chapter-01.md#156-exercises) | Linux library wrapper (x64, AT&T) |
| [51](#challenge-51-printf-with-missing-arguments) | [1.9.5](../../readings/books/re4b/re4b-chapter-01.md#195-exercises) | stack noise, missing arguments |
| [52](#challenge-52-printf-of-time) | [1.9.5](../../readings/books/re4b/re4b-chapter-01.md#195-exercises) | timestamp, 64-bit time_t truncation |

## Challenge #48, MessageBeep wrapper

**Source** [challenges.re/48](https://challenges.re/48/){ .external-link }<br>
**Tags** X86, WINDOWS, ASM, L1

```asm
main:
    push 0xFFFFFFFF
    call MessageBeep
    xor  eax,eax
    retn
```

`push 0xFFFFFFFF` places the single argument, then `call MessageBeep` invokes the Win32 function `MessageBeep(UINT uType)`. The value `0xFFFFFFFF` selects a simple standard beep, which Windows plays through the PC speaker when no sound device is configured. `xor eax, eax` sets the return value to 0, and `retn` returns. `MessageBeep` uses the stdcall convention and removes its own argument, so `main` needs no stack cleanup.

**In one line.** Plays a simple system beep and returns 0.

**C.**

```c
#include <windows.h>
int main() { MessageBeep(0xFFFFFFFF); return 0; }
```

## Challenge #49, sleep wrapper

**Source** [challenges.re/49](https://challenges.re/49/){ .external-link }<br>
**Tags** X64, LINUX, ASM, L1 (AT&T syntax)

```asm
main:
    pushq %rbp
    movq  %rsp, %rbp
    movl  $2, %edi
    call  sleep
    popq  %rbp
    ret
```

This is non-optimizing GCC output. `push rbp` with `mov rbp, rsp` is the prologue and `pop rbp` is the epilogue. Under the System V x86-64 convention the first integer argument goes in `RDI`, and `movl $2, %edi` writes `2` there, where the 32-bit store to `EDI` clears the upper half of `RDI`. `call sleep` then runs `sleep(2)`, which suspends the thread for two seconds. `main` never sets its own return value, so it returns whatever `sleep` left in `EAX`, which is normally 0 for the count of unslept seconds.

**In one line.** Sleeps for two seconds.

**C.**

```c
#include <unistd.h>
int main() { sleep(2); return 0; }
```

## Challenge #51, printf with missing arguments

**Source** [challenges.re/51](https://challenges.re/51/){ .external-link }<br>
**Tags** L1

```c
#include <stdio.h>

int main()
{
    printf("%d, %d, %d\n");
    return 0;
}
```

The format string promises three `int` values and none are supplied. `printf` reads three anyway, from wherever the calling convention says the arguments should be, and prints whatever is there. The challenge asks where those numbers come from under three build settings.

Under 32-bit MSVC (cdecl), only the format-string pointer is pushed, so `printf` fetches its second through fourth arguments from `[esp+4]`, `[esp+8]`, and `[esp+0xC]`. Those slots hold stale values left by earlier code such as the CRT startup, so the numbers are leftover stack contents rather than random.

Under MSVC with `/Ox`, the arguments are still passed on the stack, but optimization changes which earlier code ran and what it left in those slots, so the three printed numbers differ from the unoptimized build.

Under GCC on x86-64 (System V), the first varargs after the format string are passed in registers `ESI`, `EDX`, and `ECX`, not on the stack. `printf` prints whatever those registers held at the call site, a different source entirely from the stack slots MSVC reads. That is why the behavior is not comparable between the two compilers. The origin of the values is fixed by the calling convention, not by the C source.

**In one line.** It prints three leftover values read from where the absent arguments would have been, stack slots under 32-bit MSVC and registers under x86-64 GCC. The program is undefined behavior as written, so there is no well-defined C to reconstruct.

## Challenge #52, printf of time()

**Source** [challenges.re/52](https://challenges.re/52/){ .external-link }<br>
**Tags** X86, ARM, MIPS, ARM64, ASM, L1

x86 (optimizing MSVC)

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

ARM (optimizing Keil, ARM mode)

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

`time(NULL)` returns the number of seconds since the Unix epoch, 1970-01-01 UTC, and the result is handed to `printf("%d\n", ...)`. In the x86 listing, `push 0` supplies `time`'s `NULL` argument, and `_time64` returns a 64-bit value in the `EDX:EAX` pair. The two `push` instructions place that value on the stack as two 32-bit words, high word then low word, followed by the format-string pointer. `add esp, 16` removes the four 4-byte slots after the call. The ARM version does the same job without the split, since 32-bit `time` returns a single 32-bit value in `r0` that is moved to `r1` as the second `printf` argument.

**Why did MSVC use `_time64` instead of `time`.** In modern MSVC, `time_t` is 64-bit by default and `time` is a thin wrapper over `_time64`. This is deliberate, since a 32-bit `time_t` overflows in 2038.

**Is it correct, and is it dangerous.** The types do not match. `_time64` returns 64 bits, but `%d` consumes a single 32-bit `int`, so `printf` reads only the low word in `EAX` and ignores the high word in `EDX` that was pushed above it. It works today only because the current timestamp fits in the low 32 bits and is positive. It is technically incorrect and fragile, and the correct specifier for a 64-bit `time_t` is `%lld`.

**What `printf` prints after 2038.** `%d` reads the low 32 bits as a signed `int`. After 2038-01-19 that value passes `0x7FFFFFFF` and is read as negative, so `printf` prints a negative number while the underlying 64-bit `_time64` value stays correct. The defect is the truncation to signed 32 bits through `%d`, not the timekeeping.

**In one line.** Prints the current Unix timestamp, the seconds since 1970-01-01 UTC.

**C.**

```c
#include <stdio.h>
#include <time.h>
int main() { printf("%d\n", (int)time(NULL)); return 0; }
```
