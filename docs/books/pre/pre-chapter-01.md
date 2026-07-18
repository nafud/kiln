# Chapter 1. x86 and x64

x86 is a little-endian architecture derived from the Intel 8086. Here it denotes the 32-bit implementation of the Intel architecture (IA-32) defined in the Intel Software Developer's Manual. The processor operates in two principal modes. Real mode is the power-on state and supports only a 16-bit instruction set. Protected mode supports virtual memory, paging, and the other features on which modern operating systems depend, and is the mode discussed throughout this chapter. The 64-bit extension is called x64 or x86-64.

x86 enforces privilege separation through ring levels, numbered 0 to 3. Ring 0 is the most privileged and can modify all system settings; ring 3 is the least privileged. Modern operating systems use only two: user-mode code runs in ring 3, the kernel in ring 0. The current ring level is encoded in the `CS` register and is referred to as the current privilege level (CPL).

## Register Set and Data Types

In protected mode there are eight 32-bit general-purpose registers (GPRs): `EAX`, `EBX`, `ECX`, `EDX`, `EDI`, `ESI`, `EBP`, and `ESP`. Several can be accessed at narrower widths through aliased names. The instruction pointer is `EIP`. Status of arithmetic operations and execution state is held in the 32-bit `EFLAGS` register.

| REGISTER | PURPOSE                             |
| -------- | ----------------------------------- |
| `ECX`    | Counter in loops                    |
| `ESI`    | Source in string/memory operations  |
| `EDI`    | Destination in string/memory operations |
| `EBP`    | Base frame pointer                  |
| `ESP`    | Stack pointer                       |

Sub-register aliasing follows the legacy 8086 layout. `EAX` (32-bit) contains `AX` (low 16 bits), which splits into `AH` (high byte) and `AL` (low byte). The same pattern applies to `EBX`, `ECX`, `EDX`. `ESI`, `EDI`, `EBP`, `ESP` expose only 16-bit aliases (`SI`, `DI`, `BP`, `SP`).

| DATA TYPE   | WIDTH  | EXAMPLES              |
| ----------- | ------ | --------------------- |
| Byte        | 8-bit  | `AL`, `BL`, `CL`      |
| Word        | 16-bit | `AX`, `BX`, `CX`      |
| Doubleword  | 32-bit | `EAX`, `EBX`, `ECX`   |
| Quadword    | 64-bit | Register pair, usually `EDX:EAX` |

x86 has no 64-bit GPRs, but pairs two 32-bit registers (typically `EDX:EAX`) to hold quadword values in specific instructions. `RDTSC`, for example, writes a 64-bit result to `EDX:EAX`.

!!! note "EFLAGS and conditional branching"
    Flags in `EFLAGS` record the outcome of arithmetic and are the basis for conditional branching. If an `add` yields zero, `ZF` is set to 1. See the Control Flow section for the full flag set.

Beyond the GPRs, `EIP`, and `EFLAGS`, control registers govern low-level mechanisms: `CR0` toggles paging, `CR2` holds the linear address that caused a page fault, `CR3` is the base of the paging structure, and `CR4` controls hardware virtualization settings. `DR0`–`DR7` are the debug registers.

!!! note "Debug registers"
    Although there are seven usable debug registers, only four (`DR0`–`DR3`) set memory breakpoints. The remainder hold status.

Model-specific registers (MSRs) vary between processors and vendors. Each is identified by a name and a 32-bit number and is accessed with `RDMSR`/`WRMSR` from ring 0 only. `SYSENTER`, for instance, transfers execution to the address in the `IA32_SYSENTER_EIP` MSR (`0x176`), normally the OS system call handler.

## Instruction Set

x86 permits flexible data movement between registers and memory, classifiable into five methods:

| METHOD                     | SUPPORT      |
| -------------------------- | ------------ |
| Immediate to register      | All architectures |
| Register to register       | All architectures |
| Immediate to memory        | All architectures |
| Register to/from memory    | All architectures |
| Memory to memory           | x86-specific |

A classical RISC architecture such as ARM is load/store: memory is touched only by `LDR` and `STR`, so incrementing a value in memory takes three instructions (load, add, store). x86 can operate on memory directly, so the same operation is a single `INC` or `ADD`; `MOVS` even reads and writes memory in one instruction.

x86 uses variable-length instructions, from 1 to 15 bytes. ARM instructions are fixed at 2 or 4 bytes.

## Syntax

Two notations exist for x86 assembly: Intel and AT&T. They encode identical instructions.

| DIFFERENCE            | INTEL              | AT&T                        |
| --------------------- | ------------------ | --------------------------- |
| Registers/immediates  | plain              | `%` before registers, `$` before immediates |
| Operation width       | implicit           | mnemonic suffix (`MOVL`, `MOVB`) |
| Operand order         | `dst, src`         | `src, dst`                  |

```text
Intel                       AT&T
mov ecx, AABBCCDDh          movl $0xAABBCCDD, %ecx
mov ecx, [eax]              movl (%eax), %ecx
mov ecx, eax                movl %eax, %ecx
```

Windows tools (IDA Pro, OllyDbg, MASM) use Intel notation; UNIX tools (GCC) frequently use AT&T. Intel notation is used throughout the book.

## Data Movement

`MOV` is the most common instruction. Its simplest forms move an immediate or register into a register. Memory access is written with square brackets.

```asm
01: C7 00 01 00 00 00  mov dword ptr [eax], 1   ; *eax = 1
02: 8B 08              mov ecx, [eax]           ; ecx = *eax
03: 89 18              mov [eax], ebx           ; *eax = ebx
04: 89 46 34           mov [esi+34h], eax       ; *(esi+34) = eax
05: 8B 46 34           mov eax, [esi+34h]       ; eax = *(esi+34)
06: 8B 14 01           mov edx, [ecx+eax]       ; edx = *(ecx+eax)
```

!!! note "LEA is not a memory access"
    `LEA` uses bracket syntax but does not reference memory. It evaluates the address expression and stores the result in the destination register. If `EBP = 0x1000`, then `lea edi, [ebp-0C0h]` sets `EDI = 0xF40`.

The base-plus-offset form `[base + offset]` accesses structure members and buffers computed at runtime. Writing a wider value than a field's declared size intentionally initializes adjacent fields. Given a `KDPC` whose first three fields are `Type` (1 byte), `Importance` (1 byte), and `Number` (2 bytes), `mov dword ptr [ecx], 113h` sets all three at once: `Type = 0x13`, `Importance = 0x1`, `Number = 0x0`. The compiler folds three stores into one because the constants are known at compile time; the doubleword form is 6 bytes versus 13 for the byte/word/word sequence.

Memory access granularity is byte, word, or doubleword. The default is 4 bytes, overridden to 1 or 2 with a prefix (e.g., `C6` for byte, `66` for word).

The array form is `[base + index * scale]`, where scale matches element size:

```asm
01: 8B 34 B5 40 05 ...  mov esi, [_KdLogBuffer + esi*4]  ; 4-byte elements
02: 89 04 F7            mov [edi+esi*8], eax             ; 8-byte elements
```

### String Instructions

`MOVSB`/`MOVSW`/`MOVSD` copy 1, 2, or 4 bytes between memory addresses, implicitly using `ESI` (source) and `EDI` (destination) and auto-adjusting both per the direction flag (`DF`) in `EFLAGS`. When `DF` is 0 the addresses decrement; otherwise they increment. The `REP` prefix repeats the instruction up to `ECX` times.

```asm
01: BE 28 B5 41 00  mov esi, offset _RamdiskBootDiskGuid
02: 8D BD 40 FF FF  lea edi, [ebp-0C0h]
03: A5             movsd    ; four movsd = memcpy of a 16-byte GUID
```

| INSTRUCTION | ACTION                                                        |
| ----------- | ------------------------------------------------------------ |
| `MOVS`      | Copy from `[ESI]` to `[EDI]`                                  |
| `SCAS`      | Compare `AL`/`AX`/`EAX` with `[EDI]`; used with `REP` to scan a buffer |
| `STOS`      | Write `AL`/`AX`/`EAX` to `[EDI]`; used to initialize a buffer (like `memset`) |
| `LODS`      | Read from `[ESI]` into `AL`/`AX`/`EAX`                        |

`SCAS` underlies `strlen`: zero `AL`, save the pointer, `repne scasb` to the NUL byte, then subtract. `STOS` with `REP` implements `memset`: `rep stosd` with `ECX = 9` writes 36 zero bytes.

## Arithmetic Operations

Addition, subtraction, and the bit operations (`AND`, `OR`, `XOR`, `NOT`, shifts) map directly to instructions.

```asm
01: 83 C4 14  add esp, 14h        ; esp = esp + 0x14
02: 2B C8     sub ecx, eax        ; ecx = ecx - eax
04: 41        inc ecx             ; ecx = ecx + 1
06: 83 C8 FF  or  eax, 0FFFFFFFFh ; eax = eax | 0xFFFFFFFF
08: 33 C0     xor eax, eax        ; eax = 0
09: F7 D7     not edi             ; edi = ~edi
10: C0 E1 04  shl cl, 4           ; cl = cl << 4
11: D1 E9     shr ecx, 1          ; ecx = ecx >> 1
12: C0 C0 03  rol al, 3           ; rotate AL left 3
13: D0 C8     ror al, 1           ; rotate AL right 1
```

!!! note "Strength reduction"
    Shifts frequently replace multiplication and division by powers of two. `100 >> 1` is `100 / 2`; `100 << 1` is `100 * 2`. This substitution of a cheap operation for an expensive one is called strength reduction.

### Multiplication and Division

Unsigned uses `MUL`, signed uses `IMUL`. `MUL reg/mem` multiplies the operand by `AL`/`AX`/`EAX` and stores the result in `AX`, `DX:AX`, or `EDX:EAX`, depending on operand width. The double-width result accommodates products that overflow one register: `3 * 0x80000000` yields `EDX=1, EAX=0x80000000`.

`IMUL` has three forms:

| FORM                          | SEMANTIC              |
| ----------------------------- | --------------------- |
| `IMUL reg/mem`                | Same as `MUL`         |
| `IMUL reg1, reg2/mem`         | `reg1 = reg1 * reg2/mem` |
| `IMUL reg1, reg2/mem, imm`    | `reg1 = reg2 * imm`   |

`DIV`/`IDIV reg/mem` take a single divisor. The dividend is `AX`, `DX:AX`, or `EDX:EAX` by size; quotient and remainder land in `AL`/`AH`, `AX`/`DX`, or `EAX`/`EDX`. `0xA / 2` gives quotient `5` in `AL`, remainder `0` in `AH`.

## Stack Operations and Function Invocation

The stack is a contiguous region pointed to by `ESP` that grows toward lower addresses. `PUSH` decrements `ESP` then writes at `[ESP]`; `POP` reads `[ESP]` then increments `ESP`. The default adjustment is 4 bytes because the OS requires doubleword alignment. `ESP` can also be modified directly by `ADD`/`SUB`.

The processor has no native function abstraction; functions are built on the stack. `CALL` performs two steps: it pushes the return address (the address after `CALL`) and sets `EIP` to the target. `RET` pops the top of stack into `EIP`. The pair `push 0x12345678` / `ret` transfers control to `0x12345678`.

A calling convention is defined by the platform ABI: how parameters are passed, in what order, who cleans the stack, and where the return value goes.

| ASPECT              | CDECL                              | STDCALL              | FASTCALL                            |
| ------------------- | ---------------------------------- | -------------------- | ----------------------------------- |
| Parameters          | Stack, right-to-left               | Stack, right-to-left | First two in `ECX`/`EDX`, rest on stack |
| Stack cleanup       | Caller                             | Callee               | Callee                              |
| Return value        | `EAX`                              | `EAX`                | `EAX`                               |
| Non-volatile regs   | `EBP`, `ESP`, `EBX`, `ESI`, `EDI`  | Same                 | Same                                |

The function prologue establishes a new frame; the epilogue restores the previous one.

```asm
addme:
01: 55        push ebp            ; prologue: save caller's frame
02: 8B EC     mov  ebp, esp       ; prologue: new frame base
04: 0F BF 45 08  movsx eax, word ptr [ebp+8]  ; first parameter
05: 0F BF 4D 0C  movsx ecx, word ptr [ebp+0Ch]; second parameter
06: 03 C1     add  eax, ecx
08: 8B E5     mov  esp, ebp       ; epilogue: restore stack pointer
09: 5D        pop  ebp            ; epilogue: restore frame
10: C3        retn
```

When used as the frame base, `EBP` lets parameters and locals be addressed by fixed offsets: parameters at positive offsets (`[ebp+8]`, `[ebp+0Ch]`), locals at negative offsets after the stack is grown. Frame pointer omission is a compiler optimization that addresses everything relative to `ESP`, freeing `EBP` as a general register.

Under CDECL the caller cleans the stack after the call (`add esp, 8`).

## Control Flow

Higher-level constructs (`if`/`else`, `switch`, `while`/`for`) are built from `CMP`, `TEST`, `JMP`, `Jcc`, and `EFLAGS`.

| FLAG | NAME     | SET WHEN                                              |
| ---- | -------- | ---------------------------------------------------- |
| `ZF` | Zero     | Result is zero                                       |
| `SF` | Sign     | Most significant bit of the result is 1              |
| `CF` | Carry    | Result requires a carry (applies to unsigned)        |
| `OF` | Overflow | Result overflows the max size (applies to signed)    |

`CMP` subtracts one operand from the other, sets flags, and discards the result. `TEST` performs a logical AND instead. `Jcc` branches on the resulting flags.

| CODE     | MEANING                             | FLAGS                |
| -------- | ----------------------------------- | -------------------- |
| `B`/`NAE`  | Below (unsigned)                  | `CF=1`               |
| `NB`/`AE`  | Above or equal (unsigned)         | `CF=0`               |
| `E`/`Z`    | Equal / zero                      | `ZF=1`               |
| `NE`/`NZ`  | Not equal / not zero              | `ZF=0`               |
| `L`        | Less than (signed)                | `(SF ^ OF) = 1`      |
| `GE`/`NL`  | Greater or equal (signed)         | `(SF ^ OF) = 0`      |
| `G`/`NLE`  | Greater than (signed)             | `((SF ^ OF) \| ZF) = 0` |

!!! note "Signedness from conditional codes"
    Assembly has no type system. The choice of conditional code reveals signedness: "above/below" implies unsigned operands, "greater/less" implies signed.

### If-Else

An if-else is a compare or test followed by a `Jcc`. `test edx, edx` followed by `jz` is the standard idiom for testing whether a register is zero.

### Switch-Case

A switch is a sequence of if-else comparisons. When cases are dense and consecutive, the compiler builds a jump table: an array of handler addresses indexed directly by the case value, eliminating per-case comparisons.

```asm
01: cmp edi, 5                    ; range check
02: ja  short loc_10001141        ; default
03: jmp ds:off_100011A4[edi*4]    ; index into jump table
...
19: off_100011A4 dd offset loc_10001125   ; the table
```

### Loops

Loops are `Jcc` and `JMP` combinations — equivalent to if-else plus goto. A `for` loop compiles to an initialization, a body, an increment, a compare, and a conditional jump back. The compiler may omit the initial comparison when the counter's starting value makes the first iteration certain. The conditional code again reveals signedness: `JL` means the counter is signed.

The `LOOP` instruction executes a block up to `ECX` times, decrementing `ECX` each iteration:

```asm
01: 8B CA     mov ecx, edx
02: loc:
03: AD        lodsd
04: F7 D0     not eax
05: AB        stosd
06: E2 FA     loop loc          ; ecx--, jump if ecx != 0
```

## System Mechanism

### Address Translation

Physical memory is divided into 4KB pages. Virtual addresses are used by instructions when paging is enabled; the memory management unit (MMU) translates each to a physical address before access.

On x86 with physical address extension (PAE), a virtual address decomposes into indices into three tables plus an offset:

| STRUCTURE | DESCRIPTION                                        |
| --------- | -------------------------------------------------- |
| PDPT      | Page directory pointer table: 4 eight-byte entries, each pointing to a PD |
| PD        | Page directory: 512 eight-byte entries, each pointing to a PT |
| PT        | Page table: 512 eight-byte entries, each a PTE     |
| PTE       | Page table entry: describes the page and its permissions |

The bit layout of a virtual address under PAE:

| FIELD            | BITS   |
| ---------------- | ------ |
| Index into PDPT  | 2      |
| Index into PD    | 9      |
| Index into PT    | 9      |
| Page offset      | 12     |

`CR3` holds the physical base of the PDPT. Translation walks PDPT → PD → PT → page, clearing the low 12 bits (flags/reserved, including the NX bit at bit 63) of each entry to obtain the next base. Each process has its own `CR3`, giving process-specific address translation and the illusion of a private address space.

### Interrupts and Exceptions

A hardware interrupt is raised by a device requiring attention; it is associated with a number that indexes an array of function pointers. The processor calls the handler and resumes where it left off. Hardware interrupts are asynchronous.

Exceptions arise during instruction execution and fall into two categories:

| CATEGORY | DESCRIPTION                                                    | RESUMES              |
| -------- | ------------------------------------------------------------- | -------------------- |
| Fault    | Correctable (e.g., page fault); state saved, handler corrects, instruction re-executed | Same instruction |
| Trap     | Caused by a special instruction (e.g., `SYSENTER`)            | Next instruction     |

Operating systems commonly implement system calls through this mechanism.

## Walk-Through: DllMain

The chapter closes with a full analysis of Sample J's `DllMain`. Key techniques demonstrated:

The `SIDT` instruction writes the 6-byte IDT register to memory: the top 4 bytes are the IDT base, the bottom 2 the table limit. The code reads the IDT base and checks whether it lies in `(0x8003F400, 0x80047400)`, returning early if so. `0x8003F400` is the known IDT base on Windows XP x86 core 0; the check is a crude anti-virtualization or environment heuristic.

!!! note "Hardcoded IDT bases are fragile"
    Each core has its own IDT and IDTR, so the base differs per core. On later Windows versions the IDT base changes between reboots. Hardcoding a base address does not generalize.

The function then calls `CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)`, iterates processes with `Process32First`/`Process32Next`, and compares each `szExeFile` against `"explorer.exe"` using `stricmp`. Win32 API functions follow STDCALL. The local `PROCESSENTRY32` structure is identified by its `0x128` size and the required `dwSize` initialization. Finally, based on `fdwReason`, the code calls `CreateThread` with start address `0x100032D0`.

Recovered intent: verify a sane IDT, confirm `explorer.exe` is running (a user is logged on), then spawn a thread that infects the machine.

## x64

x64 extends x86; most properties carry over, with differences in register size and some removed instructions (e.g., `PUSHAD`).

### Register Set

There are 18 64-bit GPRs. 64-bit registers take the `R` prefix (`RAX`, `RBP`). Each aliases narrower widths: `RAX` → `EAX` → `AX` → `AH`/`AL`.

!!! note "RBP as a general register"
    `RBP` can still serve as the frame pointer but rarely does in compiler-generated x64 code. Most x64 compilers treat `RBP` as an ordinary GPR and reference locals relative to `RSP`.

### Data Movement

x64 adds RIP-relative addressing: instructions reference data at an offset from `RIP`, primarily to support position-independent code.

```asm
01: 48 8B 05 00 00 00 00  mov rax, qword ptr cs:loc_A  ; "mov rax, [rip]"
03: loc_A:
```

Most arithmetic is promoted to 64 bits even with 32-bit operands. Writing to a 32-bit register clears the upper 32 bits of its 64-bit parent: `xor eax, eax` zeroes all of `RAX`.

### Canonical Address

Virtual addresses are 64 bits wide, but current Intel/AMD processors implement only 48. An address is canonical if bits 63 down to the most significant implemented bit are all identical — in practice, bits 48–63 must match bit 47. Dereferencing a non-canonical address raises an exception.

```text
0xfffff801`c9c11000   canonical
0x000007f7`bdb67000   canonical
0xffff0800`00000000   non-canonical (bits 48-63 do not match bit 47)
0xffff8000`00000000   canonical
```

### Function Invocation

Where x86 conventions often pass parameters on the stack, x64 conventions favor registers.

| PLATFORM     | PARAMETER REGISTERS                    | OVERFLOW           |
| ------------ | -------------------------------------- | ------------------ |
| Windows x64  | `RCX`, `RDX`, `R8`, `R9`               | Stack, right-to-left |
| Linux x64    | `RDI`, `RSI`, `RDX`, `RCX`, `R8`, `R9` | Stack              |

Windows x64 defines a single calling convention.
