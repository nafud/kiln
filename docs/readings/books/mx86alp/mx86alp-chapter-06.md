# Chapter 6. Run-Time Calling Conventions

## Calling Convention Overview

A run-time calling convention is a specification that governs data exchange between a calling function and a called function. It defines how arguments are passed (which registers, when the stack is used), the requirements for function prologues and epilogues, any constraints imposed by the host OS or compiler, and how return values are delivered to the caller.

An x86-64 function is logically partitioned into three sections.

| SECTION  | RESPONSIBILITY                                                                       |
| -------- | ------------------------------------------------------------------------------------ |
| Prologue | Preserves non-volatile registers, establishes a stack frame, allocates local storage |
| Body     | Carries out the computation                                                          |
| Epilogue | Releases local storage, deconstructs the stack frame, restores non-volatile registers |

A prologue or epilogue may include some, all, or none of these elements depending on the function's computational requirements.

### Volatile vs Non-volatile Registers

Both Visual C++ and GNU C++ classify every general-purpose register as volatile or non-volatile. A called function may freely modify volatile registers. It must not alter a non-volatile register unless it preserves the caller's original value, typically by saving it in the prologue and restoring it in the epilogue.

### Leaf vs Non-leaf Functions

| KIND     | DEFINITION                     | TYPICAL PROPERTIES                                                                                     |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Leaf     | Calls no other functions       | Straightforward calculations using only volatile registers; often needs no explicit prologue or epilogue |
| Non-leaf | Calls one or more functions    | Uses volatile and non-volatile registers, consumes stack space, must keep RSP and the stack properly arranged for callees |

!!! note "Scope"
    The chapter covers only the calling convention aspects used by the book's code. Variadic functions, bit fields, and passing or returning structures and unions by value are out of scope.

## Visual C++ Calling Convention (Windows x64)

### Argument Passing and Return Values

- The first four arguments are passed in registers, selected by position and type: RCX or XMM0, RDX or XMM1, R8 or XMM2, R9 or XMM3. Remaining arguments are passed on the stack.
- 8, 16, and 32-bit integer arguments occupy the low-order bits of the corresponding quadword register or stack slot; the high-order bits are undefined. Sign or zero extension is the callee's responsibility.
- Scalar single and double-precision arguments use XMM bits 31:0 or 63:0; the remaining bits are undefined.
- Integer return values use RAX/EAX/AX/AL. Floating-point return values use XMM0.

### Home Area

The caller must allocate 32 bytes of stack space (four quadwords) immediately above the return address: the home area for RCX, RDX, R8, and R9. The callee may spill the argument registers there or use the space for arbitrary temporary storage. When used for alternative storage, the home area should not be referenced before the `.endprolog` directive.

### Stack Alignment

RSP must maintain 16-byte alignment outside the prologue. A `call` pushes an 8-byte return address, so the prologue must restore alignment. With `NUM_PUSHREG` register pushes, the required pad is:

```
STK_PAD   = ((NUM_PUSHREG AND 1) XOR 1) * 8      ; 0 or 8 bytes
STK_TOTAL = STK_LOCAL1 + STK_LOCAL2 + STK_PAD
```

### Stack Frames and MASM Frame Directives

Functions that reference both stack arguments and local variables typically build a stack frame. RBP is the customary frame pointer, though any non-volatile register may be used. Declaring a procedure with the `frame` attribute (`proc frame`) tells MASM the function uses a frame pointer and instructs it to emit static unwind data for run-time exception handling.

Each prologue action must be paired with a directive that records it in the exception handling tables. Directives are assembler instructions, not executable code.

| DIRECTIVE            | FOLLOWS                          | RECORDS                                                        |
| -------------------- | -------------------------------- | -------------------------------------------------------------- |
| `.pushreg reg`       | `push reg`                       | Stack offset of a saved non-volatile GP register               |
| `.allocstack size`   | `sub rsp,size`                   | Local stack allocation size                                    |
| `.setframe reg,off`  | `mov`/`lea` initializing the FP  | Frame pointer register and its byte offset from RSP            |
| `.savexmm128 reg,off`| `vmovdqa [mem],xmmN`             | Stack displacement (relative to RSP) of a saved XMM register   |
| `.endprolog`         | Last prologue instruction        | End of prologue                                                |

!!! note "Constraints"
    The `.setframe` offset must be an even multiple of 16 and no greater than 240. The XMM save area (STK_LOCAL2) must be at least 16 bytes per saved XMM register. Argument registers may alternatively be spilled to the home area before `push rbp` using RSP-relative addressing.

Minimal frame prologue and epilogue pattern:

```asm
SumIntegers_a proc frame
    push rbp                    ;save caller's RBP
    .pushreg rbp
    sub rsp,STK_LOCAL           ;allocate local stack space
    .allocstack STK_LOCAL
    mov rbp,rsp                 ;set frame pointer
    .setframe rbp,0
    .endprolog
    ...
    add rsp,STK_LOCAL           ;release local stack space
    pop rbp                     ;restore caller's RBP
    ret
```

### Split Local Area

Placing the frame pointer above part of the local area, e.g. `lea rbp,[rsp+STK_LOCAL2]` with `.setframe rbp,STK_LOCAL2`, splits local storage into a region below RBP (negative displacements) and a region above it (positive displacements). This lets more of the local area be reached with 8-bit signed displacements instead of 32-bit ones, producing smaller machine code, and simplifies non-volatile XMM save and restore.

### Non-volatile XMM Registers

XMM0 to XMM5 are volatile; XMM6 to XMM15 are non-volatile. A function using XMM6 to XMM15 must save them in its prologue with 16-byte aligned `vmovdqa` stores, each followed by `.savexmm128`, and restore them in the epilogue before restoring GP registers.

```asm
vmovdqa xmmword ptr [rbp-STK_LOCAL2+16],xmm14
.savexmm128 xmm14,16
vmovdqa xmmword ptr [rbp-STK_LOCAL2],xmm15
.savexmm128 xmm15,0
```

!!! warning "Alignment fault"
    `vmovdqa` requires its memory operand aligned to 16 bytes (32 for YMM); the processor raises an exception otherwise. `vmovdqu` performs the same move without the alignment requirement.

### Epilogue Rules

- RSP must be restored using either `lea rsp,[RFP+X]` or `add rsp,X`, where RFP is the frame pointer register and X a constant. This limits the instruction patterns the run-time exception handler must recognize.
- Epilogues must contain no processing logic, including setting a return value: only stack release, register pops, and `ret`.

### Calling External Functions

Before calling any function, the caller must allocate the callee's 32-byte home area (`sub rsp,32`) and keep RSP 16-byte aligned. Values needed across a call must be held in non-volatile registers or on the stack, since the callee may destroy every volatile register. Library functions are declared with `extern name:proc` and invoked with `call`.

The book's `MacrosX86-64-AVX.asmh` include file automates prologue and epilogue coding against a fixed generic stack layout:

| MACRO               | FUNCTION                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `CreateFrame_M`     | Pushes listed non-volatile GP registers, allocates locals, sets RBP; generates symbolic offsets (prefix + `OffsetHomeRCX`, `OffsetStackArgs`, etc.) |
| `SaveXmmRegs_M`     | Saves listed non-volatile XMM registers to the XMM save area                                       |
| `EndProlog_M`       | Marks end of prologue                                                                              |
| `RestoreXmmRegs_M`  | Restores XMM registers; list must match `SaveXmmRegs_M`                                            |
| `DeleteFrame_M`     | Restores RSP from RBP and pops GP registers; list must match `CreateFrame_M`                       |

`CreateFrame_M` takes a prefix string plus StkSizeLocal1 and StkSizeLocal2, both evenly divisible by 16; StkSizeLocal2 must be at most 240 and at least 16 bytes per saved XMM register. Because `DeleteFrame_M` restores RSP from RBP, home space allocated for callees (`sub rsp,32`) needs no explicit release.

## GNU C++ Calling Convention (System V AMD64)

### Argument Passing and Return Values

- The first six integer arguments are passed in RDI, RSI, RDX, RCX, R8, R9. The first eight floating-point arguments are passed in XMM0 to XMM7. Remaining arguments are passed on the stack.
- Narrow integer arguments occupy the low-order bits of their register or stack slot with undefined high-order bits, and scalar FP arguments use XMM bits 31:0 or 63:0, as in Visual C++.
- Integer return values use RAX/EAX/AX/AL. Floating-point return values use XMM0.
- There is no home area. Stack arguments begin at `[rsp+8]` on function entry (directly above the return address).

### Red Zone

The 128 bytes below RSP are the red zone. A leaf function may use this area for temporary storage without adjusting RSP, since nothing (signal handlers excluded by the ABI design) will overwrite it. Non-leaf functions have no usable red zone because their own calls push data below RSP.

```asm
RZ_A equ -8
...
mov [rsp+RZ_A],rdi          ;store in red zone, no allocation needed
```

### Stack Frames

Frame pointer usage is optional. A conventional prologue pushes RBP (and any other non-volatile registers), copies RSP to RBP, then subtracts local storage. Locals then have negative displacements from RBP and stack arguments positive ones.

Splitting arguments and locals across the frame pointer has two benefits: many operands encode with 8-bit rather than 32-bit displacements, and new arguments or locals can be added without disturbing existing offsets. The cost is the loss of one general-purpose register. When no frame pointer is used, RBP is available as an ordinary non-volatile register.

An epilogue may restore RSP with `mov rsp,rbp` (frame pointer form) or `add rsp,STK_LOCAL+STK_PAD` (RSP-relative form) before the pops and `ret`.

### Stack Alignment

RSP must be aligned on a 16-byte boundary before any `call`. Since the return address plus an odd number of pushes can misalign the stack, a pad constant (normally 0 or 8) is added to the local allocation. Defining the pad symbol even when zero documents that it must be revisited if the stack layout changes.

### Calling External Functions

Position-independent code calls shared library functions through the Procedure Linkage Table. In NASM the special symbol `wrt ..plt` directs the assembler to emit the call through the function's PLT entry:

```asm
extern pow
...
call pow wrt ..plt          ;xmm0 = pow(xmm0, xmm1)
```

The PLT holds function addresses that cannot be resolved until run time, such as functions in shared object libraries. All XMM registers are volatile under this convention, so any XMM value needed after a call must be spilled to the stack or recomputed; integer values are best kept in non-volatile GP registers to avoid reloads.

## Summary

### Visual C++ Register Usage

| REGISTER    | TYPE         | USAGE                                        |
| ----------- | ------------ | -------------------------------------------- |
| RAX         | Volatile     | Integer return value                         |
| RBX         | Non-volatile | Scratch                                      |
| RCX         | Volatile     | Integer argument 1                           |
| RDX         | Volatile     | Integer argument 2                           |
| RSI         | Non-volatile | Scratch                                      |
| RDI         | Non-volatile | Scratch                                      |
| RBP         | Non-volatile | Stack frame pointer or scratch               |
| RSP         | Non-volatile | Stack pointer                                |
| R8          | Volatile     | Integer argument 3                           |
| R9          | Volatile     | Integer argument 4                           |
| R10, R11    | Volatile     | Scratch                                      |
| R12–R15     | Non-volatile | Scratch                                      |
| XMM0        | Volatile     | FP argument 1, FP return value               |
| XMM1–XMM3   | Volatile     | FP arguments 2–4                             |
| XMM4, XMM5  | Volatile     | Scratch                                      |
| XMM6–XMM15  | Non-volatile | Scratch                                      |

Wide-register volatility: bits 255:128 of YMM0 to YMM15 are volatile. With AVX-512, bits 511:256 of ZMM0 to ZMM15 are volatile and ZMM16 to ZMM31 are fully volatile.

### GNU C++ Register Usage

| REGISTER    | TYPE         | USAGE                                        |
| ----------- | ------------ | -------------------------------------------- |
| RAX         | Volatile     | Integer return value                         |
| RBX         | Non-volatile | Scratch                                      |
| RDI         | Volatile     | Integer argument 1                           |
| RSI         | Volatile     | Integer argument 2                           |
| RDX         | Volatile     | Integer argument 3                           |
| RCX         | Volatile     | Integer argument 4                           |
| R8          | Volatile     | Integer argument 5                           |
| R9          | Volatile     | Integer argument 6                           |
| RBP         | Non-volatile | Stack frame pointer or scratch               |
| RSP         | Non-volatile | Stack pointer                                |
| R10, R11    | Volatile     | Scratch                                      |
| R12–R15     | Non-volatile | Scratch                                      |
| XMM0        | Volatile     | FP argument 1, FP return value               |
| XMM1–XMM7   | Volatile     | FP arguments 2–8                             |
| XMM8–XMM15  | Volatile     | Scratch                                      |

Wide-register volatility: bits 255:128 of YMM0 to YMM15 are volatile. With AVX-512, ZMM16 to ZMM31 are volatile.

### Convention Comparison

| ASPECT                     | VISUAL C++                                  | GNU C++                                     |
| -------------------------- | ------------------------------------------- | ------------------------------------------- |
| Register integer arguments | 4 (RCX, RDX, R8, R9)                        | 6 (RDI, RSI, RDX, RCX, R8, R9)              |
| Register FP arguments      | 4 (XMM0–XMM3, shared positions with GP)     | 8 (XMM0–XMM7, independent of GP positions)  |
| Home area                  | Required, 32 bytes allocated by caller      | None                                        |
| Red zone                   | None                                        | 128 bytes below RSP, leaf functions only    |
| Non-volatile XMM           | XMM6–XMM15                                  | None, all XMM volatile                      |
| RSP alignment              | 16 bytes outside prologue                   | 16 bytes before any call                    |
| Unwind directives          | `.pushreg` `.allocstack` `.setframe` `.savexmm128` `.endprolog` | None                    |
| Epilogue constraints       | `lea rsp,[RFP+X]` or `add rsp,X`; no logic  | No mandated pattern                         |
| Shared library calls       | Direct `call`                               | `call fn wrt ..plt` in PIC code             |

!!! warning "RFLAGS.DF and MXCSR.RC"
    Both conventions designate RFLAGS.DF and MXCSR.RC as non-volatile. Failure to preserve them may cause C++ library functions to behave erratically or fail.
