# Chapter 1. X86-64 Core Architecture

## Historical Overview

| Year | Processor / µarch | Relevant additions |
|---|---|---|
| 1985 | Intel 80386 | First x86-32 silicon: 32-bit registers and arithmetic, flat memory model, 4 GB logical address space, paged virtual memory |
| 1989 | Intel 80486 | On-chip caches; integrated x87 FPU (most versions) |
| 1993 | Pentium (P5) | Dual-pipeline superscalar execution, 64-bit external data bus, split code/data caches |
| 1997 | P5 refresh | MMX: SIMD on packed integers using 64-bit registers |
| 1995–1997 | Pentium Pro / II (P6) | Three-way superscalar, out-of-order execution, speculative execution, improved branch prediction |
| 1999 | Pentium III (P6) | SSE: eight 128-bit registers, packed single-precision FP |
| 2000 | Pentium 4 (Netburst) | SSE2: packed double-precision FP; packed integer and scalar FP ops in XMM registers |
| 2003 | AMD Opteron (K8) | x86-64: 64-bit execution environment, larger address space, 8 additional GPRs. Intel adopted in 2004 (Pentium 4 variants) |
| 2004 | Netburst update | SSE3, hyper-threading |
| 2006 | Core | SSSE3, SSE4.1 (new instructions only; no new registers or types) |
| 2008 | Nehalem | SSE4.2 (string processing, application-specific accelerators); final SSE extension |
| 2011 | Sandy Bridge | AVX: 256-bit packed FP, three-operand instruction syntax |
| 2011–2012 | AMD Bulldozer / Piledriver | AVX, FMA4 (AMD-only); Piledriver adds FMA3 |
| 2013 | Haswell | AVX2: 256-bit packed integer; broadcast/gather/permute; FMA3 |
| 2017 | Skylake-X | AVX-512: 512-bit registers, opmask masking/merging, per-instruction rounding control, broadcasts |
| 2022 | AMD Zen 4 | AVX-512 support; no FMA4 since Zen |

## Fundamental Data Types

| Type | Size (bits) | Typical use |
|---|---|---|
| Byte | 8 | Characters, small integers |
| Word | 16 | Characters, integers |
| Doubleword | 32 | Integers, single-precision FP |
| Quadword | 64 | Integers, double-precision FP, memory addresses |
| Double quadword | 128 | Integers, packed integers, packed FP |

- Bits are numbered right to left: 0 = least significant, size−1 = most significant.
- Multibyte values are stored little-endian: least significant byte at the lowest address.
- A value is properly aligned when its address is an integral multiple of its size.
- The processor does not require alignment unless the OS enables enforcement; misaligned access is legal but can incur a performance penalty. Align anyway.

## Numerical Data Types

| Type | Size (bits) | C++ type | `<cstdint>` |
|---|---|---|---|
| Signed integer | 8 | `char` | `int8_t` |
| | 16 | `short` | `int16_t` |
| | 32 | `int`, `long`* | `int32_t` |
| | 64 | `long`*, `long long` | `int64_t` |
| Unsigned integer | 8–64 | `unsigned` counterparts | `uint8_t`–`uint64_t` |
| Floating-point | 32 | `float` | — |
| | 64 | `double` | — |

\* `long` is 64 bits on 64-bit Linux, 32 bits on 64-bit Windows. Prefer `<cstdint>` types at ASM/C++ boundaries.

## SIMD Data Types

A SIMD type is a container holding multiple instances of one fundamental type. Bit numbering and little-endian storage follow the fundamental-type rules. `xmmword`, `ymmword`, and `zmmword` denote 128-, 256-, and 512-bit operands.

| Element type | xmmword (128) | ymmword (256) | zmmword (512) |
|---|---|---|---|
| 8-bit integer | 16 | 32 | 64 |
| 16-bit integer | 8 | 16 | 32 |
| 32-bit integer | 4 | 8 | 16 |
| 64-bit integer | 2 | 4 | 8 |
| Half-precision FP | 8 | 16 | 32 |
| Single-precision FP | 4 | 8 | 16 |
| Double-precision FP | 2 | 4 | 8 |

AVX, AVX2, and AVX-512 are not universally supported. SSE2 is guaranteed on every x86-64 processor; anything beyond it must be verified at run time (`cpuid`) before use.

## Miscellaneous Data Types

- **String**: contiguous block of bytes, words, doublewords, or quadwords. Core instructions provide compare, load, move, scan, and store; usable on numeric arrays as well.
- **Bit field**: contiguous bit sequence starting at *any bit position* within a byte, up to 32 or 64 bits long. Used by bit-extraction/masking instructions.
- **Bit string**: contiguous bit sequence; instructions exist to clear, set, scan, and test individual bits.

## General-Purpose Registers

Sixteen 64-bit GPRs. The low byte, word, and doubleword of each are independently addressable.

| 64-bit | 32-bit | 16-bit | 8-bit |
|---|---|---|---|
| RAX | EAX | AX | AL |
| RBX | EBX | BX | BL |
| RCX | ECX | CX | CL |
| RDX | EDX | DX | DL |
| RSI | ESI | SI | SIL |
| RDI | EDI | DI | DIL |
| RBP | EBP | BP | BPL |
| RSP | ESP | SP | SPL |
| R8–R15 | R8D–R15D | R8W–R15W | R8B–R15B |

Legacy registers AH, BH, CH, DH alias the high bytes of AX, BX, CX, DX.

Partial-register write rules:

- Writing a 32-bit register zeros the upper 32 bits of its 64-bit parent (`add eax,10` clears RAX[63:32]).
- Writing an 8- or 16-bit register leaves the remaining parent bits unmodified.

Implicit register usage (8086 legacy):

- One-operand `mul`/`imul` and `idiv` use RDX:RAX / EDX:EAX / DX:AX / AX as the product or dividend. (Two- and three-operand `imul` forms do not.)
- String instructions: RSI = source, RDI = destination, RCX = repeat count.
- Variable shift/rotate counts use CL.
- RSP is the stack pointer; push/pop operate on 64-bit operands, so the stack must be at least 8-byte aligned. Windows and Linux 64-bit C++ run-times keep RSP 16-byte aligned for SIMD stack traffic.
- RBP conventionally serves as the frame pointer; usable as a general register when no frame pointer is needed.

## Instruction Pointer (RIP)

Holds the address of the next instruction. Updated automatically; modified by `call` (pushes RIP), `ret` (pops into RIP), `jmp`, and `jcc`. Jumps do not touch the stack. RIP also serves as the base for RIP-relative addressing. It cannot be directly read or written by application code.

## RFLAGS

64-bit control/status register. System bits (TF, IF, IOPL, NT, RF, VM, AC, VIF, VIP, ID) belong to the OS and must not be modified. Reserved bits (1, 3, 5, 15, 22–63) must never be modified or assumed.

Application-relevant bits:

| Bit | Flag | Type | Meaning |
|---|---|---|---|
| 0 | CF | Status | Unsigned overflow / carry; used by rotates and shifts |
| 2 | PF | Status | Even number of 1-bits in the result's low byte; also used by some scalar FP compares |
| 4 | AF | Status | Carry out of bit 3 (BCD arithmetic) |
| 6 | ZF | Status | Result is zero |
| 7 | SF | Status | Result is negative (sign bit set) |
| 10 | DF | Control | String-op direction: 0 = RSI/RDI auto-increment, 1 = auto-decrement |
| 11 | OF | Status | Signed overflow |

## Floating-Point and SIMD Registers

| Register set | Width | Count | Requires |
|---|---|---|---|
| XMM0–XMM15 | 128 | 16 | SSE2 (baseline) |
| YMM0–YMM15 | 256 | 16 | AVX/AVX2; low 128 bits alias XMM |
| ZMM0–ZMM31 | 512 | 32 | AVX-512; low 256/128 bits alias YMM/XMM. ZMM16–ZMM31 (and their YMM/XMM aliases) are new with AVX-512 |
| K0–K7 (opmask) | 64 | 8 | AVX-512; merge/zero masking and SIMD compare results |

Scalar FP uses XMM registers: bits 31:0 for single precision, bits 63:0 for double. The upper XMM bits are not operated on, though some AVX scalar instructions overwrite them in the destination.

The x87 FPU still exists and works, but XMM-based scalar FP is preferred; x87 (and MMX) are not recommended for new x86-64 code.

## MXCSR

32-bit SSE/AVX control-status register.

| Bits | Symbol | Meaning |
|---|---|---|
| 0–5 | IE, DE, ZE, OE, UE, PE | Error flags: invalid op, denormal, divide-by-zero, overflow, underflow, precision |
| 6 | DAZ | Treat denormal inputs as zero |
| 7–12 | IM, DM, ZM, OM, UM, PM | Exception masks corresponding to bits 0–5 |
| 13–14 | RC | Rounding control: 00 nearest, 01 toward −∞, 10 toward +∞, 11 toward zero |
| 15 | FZ | Flush underflowed results to zero (when underflow is masked) |
| 16–31 | — | Reserved |

Programs normally leave the exception masks alone (C++ run-times expose callback mechanisms for FP exceptions) but may legitimately change RC.

## Instruction Operands

Three operand types:

| Type | Example | C++ analog |
|---|---|---|
| Immediate | `mov rax,42` | `rax = 42` |
| Register | `add rbx,r10` | `rbx += r10` |
| Memory | `or rcx,[rbx+rsi*8]` | `rcx \|= *(rbx+rsi*8)` |

- Most instructions allow a memory operand as source *or* destination, not both (string instructions are the exception).
- Some instructions use implicit operands (`mul rbx` → RDX:RAX = RAX × RBX).
- When operand size cannot be inferred (e.g., immediate to memory), a size operator is required: MASM `qword ptr [r8]`, NASM `word [r12]`.

## Memory Addressing

```text
EffectiveAddress = BaseReg + IndexReg * ScaleFactor + Disp
```

- BaseReg: any GPR. IndexReg: any GPR except RSP. ScaleFactor: 1 (default), 2, 4, 8. Disp: 8-, 16-, or 32-bit signed constant, default 0.
- Any component may be omitted; the effective address is always computed at 64 bits.

| Form | Example |
|---|---|
| RIP + Disp | `mov rax,[Val]` |
| Base | `mov rax,[rbx]` |
| Base + Disp | `mov rax,[rbx+16]` |
| Index·SF + Disp | `mov rax,[r15*8+48]` |
| Base + Index | `mov rax,[rbx+r15]` |
| Base + Index + Disp | `mov rax,[rbx+r15+32]` |
| Base + Index·SF | `mov rax,[rbx+r15*8]` |
| Base + Index·SF + Disp | `mov rax,[rbx+r15*8+64]` |

RIP-relative addressing: effective address = RIP + signed 32-bit displacement encoded in the instruction. Lets global/static data be referenced with a 32-bit rather than 64-bit displacement and enables position-independent code. Constraint: the target must lie within ±2 GB of RIP; the assembler/linker computes the displacement.

## Condition Codes

Used by `jcc`, `cmovcc`, `setcc`. "Above/below" = unsigned comparisons; "greater/less" = signed.

| Condition | Suffix | RFLAGS test |
|---|---|---|
| Above / not below-or-equal | A / NBE | CF==0 && ZF==0 |
| Above-or-equal / not below | AE / NB | CF==0 |
| Below / not above-or-equal | B / NAE | CF==1 |
| Below-or-equal / not above | BE / NA | CF==1 \|\| ZF==1 |
| Equal / zero | E / Z | ZF==1 |
| Not equal / not zero | NE / NZ | ZF==0 |
| Greater / not less-or-equal | G / NLE | ZF==0 && SF==OF |
| Greater-or-equal / not less | GE / NL | SF==OF |
| Less / not greater-or-equal | L / NGE | SF!=OF |
| Less-or-equal / not greater | LE / NG | ZF==1 \|\| SF!=OF |
| Sign / not sign | S / NS | SF==1 / SF==0 |
| Carry / not carry | C / NC | CF==1 / CF==0 |
| Overflow / not overflow | O / NO | OF==1 / OF==0 |
| Parity even / parity odd | P (PE) / NP (PO) | PF==1 / PF==0 |

## X86-64 vs X86-32 Differences

- **Immediates are 32-bit max** (sign-extended to 64 bits when used with a 64-bit operand). Only `mov` accepts a 64-bit immediate. Consequence: `or rdx,80000000h` sign-extends to `0xFFFFFFFF80000000` — to OR in a plain `0x80000000`, load it via `mov r64,imm64` first.
- **Relative `jmp`/`call` displacements are also 32-bit**: target must be within ±2 GB of RIP; farther targets require indirect forms (`jmp rax`, `call [rax]`).
- **32-bit writes zero the upper half** of the 64-bit register; 8-/16-bit writes do not (see GPR section).
- **Memory operands should use 64-bit registers.** Addressing via 32-bit registers (`mov r10,[eax]`) is legal but confines the operand to the low 4 GB and obfuscates code; avoid.
- **Byte-register mixing restriction**: AH/BH/CH/DH cannot appear in an instruction that also uses SIL, DIL, BPL, SPL, or R8B–R15B (`mov ah,bl` valid; `mov ah,r8b` invalid).
- **Invalid in 64-bit mode**: `aaa`, `aad`, `aam`, `aas`, `daa`, `das`, `bound`, `into`, `pusha`/`pushad`, `popa`/`popad`.
- `lahf`/`sahf` were absent on early x86-64 processors; available on most CPUs since 2006 — confirm via the `cpuid` LAHF/SAHF feature flag.

## Legacy Instruction Sets

SSE2 is guaranteed on all x86-64 processors, so SSE2 packed-integer instructions replace MMX and SSE2/AVX scalar FP replaces the x87 FPU. MMX and x87 remain functional (relevant only when porting x86-32 legacy code) but should not be used in new code.
