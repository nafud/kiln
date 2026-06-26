# Chapter 1. x86-64 Core Architecture

## Historical Overview

```text
x86-32
│
├─ 1985  Intel 80386    > 32-bit architecture
├─ 1989  Intel 80486    > Integrated x87 FPU
├─ 1993  Pentium        > Superscalar execution, MMX
├─ 1995  Pentium Pro    > Out-of-order execution
├─ 1999  Pentium III    > SSE (128-bit SIMD)
├─ 2000  Pentium 4      > SSE2 / SSE3
│
└─ 2003  AMD64          > x86-64
                          │
                          ├─ 2011  AVX       > 256-bit SIMD
                          ├─ 2013  AVX2      > 256-bit integer SIMD
                          ├─ 2013  FMA3      > Fused Multiply-Add
                          └─ 2017  AVX-512   > 512-bit SIMD
```

## Data Types

Four categories — fundamental · numerical · SIMD · miscellaneous

### Fundamental Data Types

The elementary units the processor manipulates directly. All sizes are powers of two. Bit numbering is right-to-left with bit 0 as the LSB. Multibyte types are stored in memory using little-endian byte ordering, meaning the least significant byte sits at the lowest address.

| TYPE | SIZE | TYPICAL USE |
| --- | --- | --- |
| Byte | 8 bit | Characters, small integers |
| Word | 16 bit | Characters, integers |
| Doubleword | 32 bit | Integers, single-precision FP |
| Quadword | 64 bit | Integers, double-precision FP, pointers |
| Double quadword | 128 bit | Packed integers, packed FP |

!!! note "Alignment"
    A type is properly aligned when its address is an integer multiple of its size in bytes. The processor does not enforce alignment by default. Misaligned access is legal but incurs a performance penalty.

### Numerical Data Types

Scalar arithmetic values built on top of the fundamental types. The instruction set supports signed and unsigned integers at 8, 16, 32, and 64-bit widths, and floating-point values at 32 and 64 bits.

| TYPE | BITS | C++ | CSTDINT |
| --- | --- | --- | --- |
| Signed int | 8 | `char` | `int8_t` |
| | 16 | `short` | `int16_t` |
| | 32 | `int` | `int32_t` |
| | 64 | `long long` | `int64_t` |
| Unsigned int | 8 | `unsigned char` | `uint8_t` |
| | 16 | `unsigned short` | `uint16_t` |
| | 32 | `unsigned int` | `uint32_t` |
| | 64 | `unsigned long long` | `uint64_t` |
| Float | 32 | `float` | n/a |
| Double | 64 | `double` | n/a |

### SIMD Data Types

A fixed-width container holding multiple instances of the same fundamental type, all processed by a single instruction. Bit numbering and byte ordering follow the same convention as fundamental types.

| REGISTER | WIDTH | ASSEMBLER TERM | REQUIRED ISA |
| --- | --- | --- | --- |
| XMM | 128-bit | `xmmword` | SSE / AVX |
| YMM | 256-bit | `ymmword` | AVX / AVX2 |
| ZMM | 512-bit | `zmmword` | AVX-512 |

Element capacity per register width.

| ELEMENT TYPE | XMM (128) | YMM (256) | ZMM (512) |
| --- | --- | --- | --- |
| 8-bit integer | 16 | 32 | 64 |
| 16-bit integer | 8 | 16 | 32 |
| 32-bit integer | 4 | 8 | 16 |
| 64-bit integer | 2 | 4 | 8 |
| FP16 half-precision | 8 | 16 | 32 |
| FP32 single-precision | 4 | 8 | 16 |
| FP64 double-precision | 2 | 4 | 8 |

!!! warning "Runtime detection required"
    AVX, AVX2, and AVX-512 are not universally supported across processors. A binary must query CPUID before executing any SIMD code path. Detection methods are covered in Chapter 16.

### Miscellaneous Data Types

| TYPE | DEFINITION | KEY INSTRUCTIONS |
| --- | --- | --- |
| String | Contiguous block of bytes, words, doublewords, or quadwords | `MOVS` `CMPS` `SCAS` `LODS` `STOS` |
| Bit field | Contiguous bit sequence starting at any byte boundary, up to 32 or 64 bits wide | Used in masking operations |
| Bit string | Contiguous bit sequence of arbitrary length | `BT` `BTS` `BTR` `BTC` `BSF` `BSR` |

## x86-64 Processor Architecture

### General-Purpose Registers

X86-64 provides 16 64-bit general-purpose registers. Each register is sub-accessible at 32, 16, and 8-bit widths through aliased names. The sub-register aliases share physical storage with their parent — a write to `EAX` zeros the upper 32 bits of `RAX`; a write to `AL` or `AH` leaves the remaining bytes of `RAX` untouched.

<div class="register-grid">
  <div class="register-card">
    <div class="register-name">RAX</div>
    <div class="register-aliases">EAX · AX · AL / AH</div>
    <div class="register-desc">Accumulator; implicit in MUL, IMUL, DIV, IDIV</div>
  </div>
  <div class="register-card">
    <div class="register-name">RBX</div>
    <div class="register-aliases">EBX · BX · BL / BH</div>
    <div class="register-desc">General purpose</div>
  </div>
  <div class="register-card">
    <div class="register-name">RCX</div>
    <div class="register-aliases">ECX · CX · CL / CH</div>
    <div class="register-desc">Count register; implicit in REP string ops and shifts</div>
  </div>
  <div class="register-card">
    <div class="register-name">RDX</div>
    <div class="register-aliases">EDX · DX · DL / DH</div>
    <div class="register-desc">High half of 128-bit products/dividends (RDX:RAX)</div>
  </div>
  <div class="register-card">
    <div class="register-name">RSI</div>
    <div class="register-aliases">ESI · SI · SIL</div>
    <div class="register-desc">String source pointer</div>
  </div>
  <div class="register-card">
    <div class="register-name">RDI</div>
    <div class="register-aliases">EDI · DI · DIL</div>
    <div class="register-desc">String destination pointer</div>
  </div>
  <div class="register-card">
    <div class="register-name">RSP</div>
    <div class="register-aliases">ESP · SP · SPL</div>
    <div class="register-desc">Stack pointer; always points to the topmost stack item</div>
  </div>
  <div class="register-card">
    <div class="register-name">RBP</div>
    <div class="register-aliases">EBP · BP · BPL</div>
    <div class="register-desc">Frame pointer; general purpose when frame is omitted</div>
  </div>
  <div class="register-card">
    <div class="register-name">R8–R15</div>
    <div class="register-aliases">R8D–R15D · R8W–R15W · R8B–R15B</div>
    <div class="register-desc">Added in x86-64; no legacy aliases</div>
  </div>
</div>

!!! note "Stack alignment"
    RSP must be aligned to an 8-byte boundary at minimum. Both Windows and Linux x86-64 ABIs enforce 16-byte alignment of RSP at function call boundaries to support SIMD stack operations.

!!! note "Implicit register use"
    Several instructions fix their operands by convention. IMUL and MUL store a 128-bit product in RDX:RAX. IDIV and DIV read the dividend from RDX:RAX. String instructions use RSI as source, RDI as destination, and RCX as the repeat count. This behavior is inherited from the 8086 and cannot be overridden.

### Instruction Pointer (RIP)

RIP holds the logical address of the next instruction to execute. The processor updates it automatically after each instruction. It cannot be read or written directly by application code.

Control-transfer instructions modify RIP in specific ways. `CALL` pushes the return address onto the stack then loads the target into RIP. `RET` pops the top 8 bytes of the stack into RIP. `JMP` and `Jcc` update RIP without touching the stack.

RIP is also used as the base for RIP-relative memory addressing. The effective address is computed as RIP plus a signed 32-bit displacement encoded in the instruction, giving a reachable window of ±2 GB. This is the default addressing mode for global and static data in x86-64, replacing the absolute 64-bit addresses used in x86-32.

### RFLAGS Register

RFLAGS is a 64-bit register carrying processor status and control bits. Arithmetic, logical, shift, and compare instructions update the status flags. System bits are managed by the OS and must not be modified by application code. Bits 22 through 63 are reserved.

| BIT | SYMBOL | NAME | TYPE | SET WHEN |
| --- | --- | --- | --- | --- |
| 0 | CF | Carry | Status | Unsigned overflow; also used by rotates and shifts |
| 2 | PF | Parity | Status | LSB of result has an even number of 1 bits |
| 4 | AF | Auxiliary carry | Status | Carry out of bit 3; used by BCD arithmetic |
| 6 | ZF | Zero | Status | Result is zero |
| 7 | SF | Sign | Status | Result is negative (MSB is 1) |
| 8 | TF | Trap | System | Single-step debugging mode |
| 9 | IF | Interrupt enable | System | Maskable interrupts are enabled |
| 10 | DF | Direction | Control | 0 = string ops increment RSI/RDI; 1 = decrement |
| 11 | OF | Overflow | Status | Signed overflow (result too large or too small) |
| 12–13 | IOPL | I/O privilege level | System | Controls I/O port access privilege |
| 16 | RF | Resume | System | Suppresses debug faults on next instruction |
| 17 | VM | Virtual 8086 mode | System | Enables virtual 8086 execution mode |
| 18 | AC | Alignment check | System | Enables alignment fault on misaligned memory access |
| 21 | ID | ID | System | CPUID instruction is supported if this bit can be toggled |

!!! note "Condition code convention"
    Instructions `Jcc`, `CMOVcc`, and `SETcc` evaluate condition codes derived from these flags. Conditions using "above" and "below" test CF and ZF and apply to unsigned comparisons. Conditions using "greater" and "less" test SF, OF, and ZF and apply to signed comparisons.

### Floating-Point and SIMD Registers

The register file scales across three ISA generations. Each wider register tier aliases the lower tiers, so XMM0 is the low 128 bits of YMM0, which is the low 256 bits of ZMM0.

| ISA | REGISTERS | WIDTH | COUNT | USAGE |
| --- | --- | --- | --- | --- |
| SSE / AVX | XMM0–XMM15 | 128-bit | 16 | Scalar FP (low 32 or 64 bits used); packed integer and FP |
| AVX / AVX2 | YMM0–YMM15 | 256-bit | 16 | Packed integer and FP; low 128 bits alias XMM |
| AVX-512 | ZMM0–ZMM31 | 512-bit | 32 | Packed integer and FP; ZMM0-15 alias YMM/XMM |
| AVX-512 | K0–K7 | 64-bit | 8 | Opmask registers for merge masking, zero masking, and compare results |

!!! note "Scalar FP usage"
    For scalar single-precision operations, the processor uses the low 32 bits of an XMM register. For scalar double-precision, the low 64 bits. The upper bits may be modified by some AVX scalar instructions. The legacy x87 FPU is still accessible but is not used in x86-64 code in practice — XMM scalar operations are preferred.

### MXCSR Register

MXCSR is a 32-bit control and status register governing floating-point behavior for SSE and AVX operations. Bits 0–5 are sticky error flags set when a FP exception occurs. Bits 7–12 are masks; when a mask bit is set, the corresponding exception is suppressed silently. Bits 16–31 are reserved.

| BITS | SYMBOL | NAME | DESCRIPTION |
| --- | --- | --- | --- |
| 0 | IE | Invalid operation flag | Set on invalid FP operation |
| 1 | DE | Denormal flag | Set when a denormal operand is used |
| 2 | ZE | Divide-by-zero flag | Set on FP division by zero |
| 3 | OE | Overflow flag | Set on FP overflow |
| 4 | UE | Underflow flag | Set on FP underflow |
| 5 | PE | Precision flag | Set when a result is rounded |
| 6 | DAZ | Denormals are zero | Treats all denormal inputs as zero before the operation |
| 7–12 | IM DM ZM OM UM PM | Exception masks | Suppress the corresponding exception when set; all masked by default |
| 13–14 | RC | Rounding control | 00 = round to nearest (default), 01 = toward −∞, 10 = toward +∞, 11 = toward zero (truncate) |
| 15 | FZ | Flush to zero | Forces underflowed results to zero when the underflow mask is set |

!!! note "Default state"
    At process startup all exception mask bits are set, meaning FP exceptions are suppressed and produce IEEE 754 substitute values rather than signals. Application code modifies RC to control rounding mode. DAZ and FZ are off by default and are enabled in performance-sensitive code to avoid the cost of denormal handling.

## Instruction Operands

Most x86-64 instructions take one or more source operands and a single destination operand. Operands must be explicitly specified by the programmer in most cases, though some instructions impose fixed register requirements by design. There are three operand types.

An immediate operand is a constant value encoded directly into the instruction. A register operand refers to a value currently held in a general-purpose or SIMD register. A memory operand designates a location in memory, computed at runtime from an address expression. Only one memory operand is permitted per instruction — either the source or the destination, never both simultaneously.

| TYPE | EXAMPLE | C++ EQUIVALENT |
| --- | --- | --- |
| Immediate | `mov rax, 42` | `rax = 42` |
| Immediate | `imul r12, -47` | `r12 *= -47` |
| Immediate | `xor ecx, 80000000h` | `ecx ^= 0x80000000` |
| Register | `add rbx, r10` | `rbx += r10` |
| Register (implicit) | `mul rbx` | `rdx:rax = rax * rbx` |
| Memory | `mov rax, [r13]` | `rax = *r13` |
| Memory | `or rcx, [rbx+rsi*8]` | `rcx \|= *(rbx+rsi*8)` |
| Memory | `mov qword ptr [r8], 17` | `*(long long*)r8 = 17` |

!!! note "Immediate value size limit"
    Except for `MOV`, the maximum size of an immediate operand in x86-64 is 32 bits. When used with a 64-bit register or memory operand, the immediate is sign-extended to 64 bits before the operation executes. Only `MOV reg64, imm64` accepts a full 64-bit constant.

!!! note "Size operators"
    When a memory operand's size cannot be inferred from the instruction context alone, a size operator is required. MASM uses `qword ptr`, `dword ptr`, `word ptr`, and `byte ptr`. NASM uses `qword`, `dword`, `word`, and `byte`. Without one, the assembler cannot determine whether to operate on 8, 16, 32, or 64 bits at the given address.

## Memory Addressing

A memory operand in x86-64 is computed from up to four components. Any component may be omitted; the processor substitutes a default of zero for absent displacement values and one for an absent scale factor. The effective address is always 64 bits wide regardless of which components are present.

```text
EffectiveAddress = BaseReg + (IndexReg × ScaleFactor) + Displacement
```

| COMPONENT | CONSTRAINTS |
| --- | --- |
| BaseReg | Any general-purpose register |
| IndexReg | Any general-purpose register except RSP |
| ScaleFactor | 1 (default), 2, 4, or 8 |
| Displacement | Signed 8, 16, or 32-bit constant encoded in the instruction |

| FORM | EXAMPLE | TYPICAL USE |
| --- | --- | --- |
| RIP + Disp | `mov rax, [Val]` | Global and static variables |
| BaseReg | `mov rax, [rbx]` | Pointer dereference |
| BaseReg + Disp | `mov rax, [rbx+16]` | Struct member access |
| IndexReg × SF + Disp | `mov rax, [r15*8+48]` | Array element without a base pointer |
| BaseReg + IndexReg | `mov rax, [rbx+r15]` | Two-register offset |
| BaseReg + IndexReg + Disp | `mov rax, [rbx+r15+32]` | Struct in an array |
| BaseReg + IndexReg × SF | `mov rax, [rbx+r15*8]` | Array of qwords with base pointer |
| BaseReg + IndexReg × SF + Disp | `mov rax, [rbx+r15*8+64]` | Matrix element access |

!!! note "RIP-relative addressing"
    The processor adds a signed 32-bit displacement encoded in the instruction to the current value of RIP to produce the effective address. This limits the reachable range to ±2 GB relative to the instruction, which is sufficient for virtually all programs. RIP-relative addressing is the default mode for global and static data in x86-64 because it produces position-independent code and avoids the overhead of encoding 64-bit absolute addresses. The assembler or linker computes the displacement automatically.

## Condition Codes

Arithmetic, logical, shift, and rotate instructions update one or more status flags in RFLAGS after execution. The `Jcc`, `CMOVcc`, and `SETcc` instruction families test these flags through named condition codes. Each condition code maps to a specific flag expression. Most conditions have one or more alias suffixes that encode the same test under a different mnemonic for readability.

The naming convention follows a consistent rule. Conditions using "above" and "below" test CF and ZF and are intended for unsigned comparisons. Conditions using "greater" and "less" test SF, OF, and ZF and are intended for signed comparisons.

| SUFFIX | ALIAS | RFLAGS CONDITION | INTENDED FOR |
| --- | --- | --- | --- |
| A | NBE | CF=0 and ZF=0 | Unsigned above |
| AE | NB | CF=0 | Unsigned above or equal |
| B | NAE | CF=1 | Unsigned below |
| BE | NA | CF=1 or ZF=1 | Unsigned below or equal |
| E | Z | ZF=1 | Equal / zero |
| NE | NZ | ZF=0 | Not equal / not zero |
| G | NLE | ZF=0 and SF=OF | Signed greater |
| GE | NL | SF=OF | Signed greater or equal |
| L | NGE | SF≠OF | Signed less |
| LE | NG | ZF=1 or SF≠OF | Signed less or equal |
| S | | SF=1 | Result is negative |
| NS | | SF=0 | Result is positive or zero |
| O | | OF=1 | Signed overflow occurred |
| NO | | OF=0 | No signed overflow |
| C | | CF=1 | Carry set / unsigned overflow |
| NC | | CF=0 | No carry |
| P | PE | PF=1 | Parity even |
| NP | PO | PF=0 | Parity odd |
