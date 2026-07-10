# Chapter 6. Run-Time Calling Conventions

## Overview

A calling convention specifies data exchange between caller and callee: which registers carry arguments, when the stack is used, prologue/epilogue obligations, and how return values are delivered.

Function structure:

| Section | Responsibility |
|---|---|
| Prologue | Preserve non-volatile registers, establish stack frame, allocate local stack storage (any subset, possibly none) |
| Body | The computation |
| Epilogue | Release local storage, tear down frame, restore non-volatile registers, `ret` |

Register classes:

- **Volatile**: callee may freely modify; caller must not expect the value to survive a call.
- **Non-volatile**: callee must preserve; if it needs the register, it saves the caller's value (prologue) and restores it (epilogue).

Function classes:

- **Leaf**: calls no other function. Often needs no explicit prologue/epilogue; typically works entirely in volatile registers.
- **Non-leaf**: calls other functions. Must keep RSP and the stack correctly arranged for its callees (alignment, home area on Windows).

## Visual C++ (Windows x64)

### Register usage

| Register | Class | Role |
|---|---|---|
| RAX | Volatile | Integer return value |
| RCX, RDX, R8, R9 | Volatile | Integer arguments 1–4 |
| R10, R11 | Volatile | Scratch |
| RBX, RSI, RDI, R12–R15 | Non-volatile | Scratch |
| RBP | Non-volatile | Frame pointer or scratch |
| RSP | Non-volatile | Stack pointer |
| XMM0–XMM3 | Volatile | FP arguments 1–4; XMM0 = FP return value |
| XMM4, XMM5 | Volatile | Scratch |
| XMM6–XMM15 | Non-volatile | Scratch |

Wide-register volatility: bits 255:128 of YMM0–YMM15 are volatile; with AVX-512, bits 511:256 of ZMM0–ZMM15 and all of ZMM16–ZMM31 are volatile. Net effect: only the low 128 bits of registers 6–15 are preserved.

### Argument passing

- Arguments 1–4 go in RCX/RDX/R8/R9 or XMM0–XMM3; the register slot is positional, so an FP argument in position 2 consumes XMM1 and leaves RDX unused. Arguments 5+ go on the stack.
- Sub-64-bit integers occupy the low bits of their register or stack slot; the high bits are undefined — the callee sign- or zero-extends as needed (`movsx`, `movsxd`).
- Scalar FP arguments occupy XMM bits 31:0 (single) or 63:0 (double); remaining bits undefined.
- Returns: RAX (integer), XMM0 (scalar FP).

### Home area

The caller allocates 32 bytes of stack (four quadword slots) directly above the return address before every call. The callee may spill RCX/RDX/R8/R9 there, or use the slots as scratch storage. Stack arguments begin immediately above the home area.

### Stack alignment

RSP must be 16-byte aligned outside the prologue. Since `call` pushes an 8-byte return address, alignment depends on the number of prologue pushes plus local allocation. Pattern used throughout the book:

```asm
STK_PAD   equ ((NUM_PUSHREG AND 1) XOR 1) * 8   ; 8 if push count even, else 0
STK_TOTAL equ STK_LOCAL1 + STK_LOCAL2 + STK_PAD
RBP_RA    equ NUM_PUSHREG * 8 + STK_LOCAL1 + STK_PAD  ; RBP-to-return-address distance
```

### Prologue directives (MASM)

A function using a frame pointer declares `proc frame`; MASM then emits static unwind data for run-time exception handling. Each prologue action needs a matching directive:

| Directive | Follows | Purpose / constraints |
|---|---|---|
| `.pushreg reg` | `push reg` | Records the non-volatile GPR save |
| `.allocstack n` | `sub rsp,n` | Records local stack allocation |
| `.setframe reg,off` | `mov`/`lea` establishing frame pointer | `off` = RSP-to-frame-pointer distance; must be a multiple of 16 and ≤ 240 |
| `.savexmm128 xmmN,off` | `vmovdqa [mem],xmmN` | Records a non-volatile XMM save; `off` relative to RSP |
| `.endprolog` | last prologue instruction | Marks prologue end |

Directives assemble to metadata, not instructions. Any non-volatile register may serve as the frame pointer; RBP is conventional.

### Frame layout conventions

- Placing the frame pointer *between* two local areas (`lea rbp,[rsp+STK_LOCAL2]`) lets more of the frame be reached with 8-bit signed displacements and simplifies XMM save/restore addressing.
- The XMM save area (STK_LOCAL2) must be ≥ 16 bytes × number of saved XMM registers, and `vmovdqa` demands 16-byte-aligned slots.
- Home-area slots must not be touched before `.endprolog` when repurposed as scratch.

### Epilogue rules

- Restore RSP with `lea rsp,[RFP+X]` or `add rsp,X` only (fixed patterns the unwinder can recognize).
- Restore non-volatile XMM registers, then non-volatile GPRs (reverse push order), then `ret`.
- No processing logic in the epilogue — not even setting the return value.

### Calling external functions

- Caller allocates the callee's 32-byte home area (`sub rsp,32`) and keeps RSP 16-byte aligned at the call.
- Values needed across a call must live in non-volatile registers or memory; XMM0/XMM1 etc. are clobbered.
- Book macros (`MacrosX86-64-AVX.asmh`) automate the boilerplate:

| Macro | Emits |
|---|---|
| `CreateFrame_M prefix,L1,L2,regs…` | GPR pushes, stack allocation, frame pointer setup, unwind directives; generates `prefix_OffsetHomeRCX…`, `prefix_OffsetStackArgs` symbols. L1 and L2 must be multiples of 16; L2 ≤ 240 and ≥ 16 × XMM saves |
| `SaveXmmRegs_M xmm…` | Aligned XMM saves + `.savexmm128` |
| `EndProlog_M` | `.endprolog` |
| `RestoreXmmRegs_M xmm…` | XMM restores (same register order as save) |
| `DeleteFrame_M regs…` | RSP restore from RBP + GPR pops (same register list as `CreateFrame_M`) |

Because `DeleteFrame_M` restores RSP from RBP, home space allocated for callees needs no explicit release.

## GNU C++ (System V x86-64)

### Register usage

| Register | Class | Role |
|---|---|---|
| RDI, RSI, RDX, RCX, R8, R9 | Volatile | Integer arguments 1–6 |
| RAX | Volatile | Integer return value |
| R10, R11 | Volatile | Scratch |
| RBX, R12–R15 | Non-volatile | Scratch |
| RBP | Non-volatile | Frame pointer or scratch |
| RSP | Non-volatile | Stack pointer |
| XMM0–XMM7 | Volatile | FP arguments 1–8; XMM0 = FP return value |
| XMM8–XMM15 | Volatile | Scratch |

All XMM/YMM registers are volatile (bits 255:128 of YMM0–YMM15 included); with AVX-512, ZMM0–ZMM31 are volatile. Nothing SIMD survives a call.

### Argument passing

- Six integer-register slots and eight FP-register slots are assigned independently (not positional as on Windows). Overflow arguments go on the stack.
- On entry, stack arguments begin at `[rsp+8]` (just above the return address). There is no home area.
- Sub-64-bit and scalar-FP rules match Windows: high bits undefined, callee extends.
- Returns: RAX (integer), XMM0 (scalar FP).

### Red zone

The 128 bytes below RSP are guaranteed untouched by the ABI — signal and interrupt handlers will not clobber them. A leaf function may use the red zone as scratch storage without adjusting RSP. Non-leaf functions have no usable red zone, since their own `call`s write below RSP.

### Stack frames and alignment

- Frame pointer is optional. Typical framed prologue: push non-volatiles, `mov rbp,rsp`, `sub rsp,LOCAL`. Epilogue: `mov rsp,rbp` (or `add rsp,LOCAL`), pops in reverse order, `ret`.
- Splitting the frame — stack arguments at positive RBP offsets, locals at negative — favors 8-bit displacement encodings and lets new values be added without renumbering existing offsets. Cost of a frame pointer: one fewer GPR.
- RSP must be 16-byte aligned before any `call`; add 0 or 8 pad bytes to local allocation as required. Defining an explicit `STK_PAD` symbol (even when 0) documents the invariant for future maintenance.

### Calling external functions

- Calls into shared libraries go through the Procedure Linkage Table: NASM `call pow wrt ..plt`. The PLT holds addresses resolved at run time (shared-object functions).
- Volatile-register return values needed later (e.g., XMM0 from `pow`) must be spilled to non-volatile storage or the stack before the next call.

## Convention Comparison

| | Visual C++ (Windows) | GNU C++ (SysV Linux) |
|---|---|---|
| Integer register args | 4: RCX, RDX, R8, R9 | 6: RDI, RSI, RDX, RCX, R8, R9 |
| FP register args | 4: XMM0–XMM3 (positional with GPR slots) | 8: XMM0–XMM7 (independent of GPR slots) |
| Home area | 32 bytes, caller-allocated | None |
| Red zone | None | 128 bytes below RSP |
| First stack arg on entry | `[rsp+8+32]` (above home area) | `[rsp+8]` |
| Non-volatile GPRs | RBX, RSI, RDI, RBP, RSP, R12–R15 | RBX, RBP, RSP, R12–R15 |
| Non-volatile XMM | XMM6–XMM15 (low 128 bits) | None |
| Unwind directives | `.pushreg`, `.allocstack`, `.setframe`, `.savexmm128`, `.endprolog` required | None |
| Epilogue constraints | Fixed RSP-restore patterns; no logic | No mandated pattern |
| RSP alignment at call | 16 bytes | 16 bytes |

## Shared Requirements

Both conventions treat RFLAGS.DF and MXCSR.RC as non-volatile: a function that changes either must restore it before returning, or library functions may misbehave.
