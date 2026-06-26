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

!!! note "Runtime detection required"
    AVX, AVX2, and AVX-512 are not universally supported across processors. A binary must query CPUID before executing any SIMD code path. Detection methods are covered in Chapter 16.

### Miscellaneous Data Types

| TYPE | DEFINITION | KEY INSTRUCTIONS |
| --- | --- | --- |
| String | Contiguous block of bytes, words, doublewords, or quadwords | `MOVS` `CMPS` `SCAS` `LODS` `STOS` |
| Bit field | Contiguous bit sequence starting at any byte boundary, up to 32 or 64 bits wide | Used in masking operations |
| Bit string | Contiguous bit sequence of arbitrary length | `BT` `BTS` `BTR` `BTC` `BSF` `BSR` |

## x86-64 Processor Architecture

### General-Purpose Registers

| ┌63-bit | ┌31-bit | ┌15-bit | ┌7-bit |
| --- | --- | --- | --- |
| RAX | EAX | AX | AH AL |
| RBX | EBX | BX | BH BL |
| RCX | ECX | CX | CH CL |
| RDX | EDX | DX | DH DL |
| RSI | ESI | SI | SIL |
| RDI | EDI | DI | DIL |
| RBP | EBP | BP | BPL |
| RSP | ESP | SP | SPL |
| R8 | R8D | R8W | R8B |
| R9 | R9D | R9W | R9B |
| R10 | R10D | R10W | R10B |
| R11 | R11D | R11W | R11B |
| R12 | R12D | R12W | R12B |
| R13 | R13D | R13W | R13B |
| R14 | R14D | R14W | R14B |
| R15 | R15D | R15W | R15B |
