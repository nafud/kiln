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

## x86-64 Processor Architecture
### General-Purpose Registers

| ┌63-bit | ┌31-bit | ┌15-bit | ┌7-bit |
|---------|---------|---------|--------|
| RAX | EAX | AX | AH AL |
| RBX | EBX | BX | BH BL |
| RCX | ECX | CX | CH CL |
| RDX | EDX | DX | DH DL |
| RSI | ESI | SI | SIL |
| RDI | EDI | DI | DIL |
| RBP | EBP | BP | BPL |
| RSP | ESP | SP | SPL |
| R8  | R8D  | R8W  | R8B |
| R9  | R9D  | R9W  | R9B |
| R10 | R10D | R10W | R10B |
| R11 | R11D | R11W | R11B |
| R12 | R12D | R12W | R12B |
| R13 | R13D | R13W | R13B |
| R14 | R14D | R14W | R14B |
| R15 | R15D | R15W | R15B |

!!! note
    RIP always points to the next instruction.

!!! warning
    Stack layout differs between Windows and System V ABI.

??? note "Windows Process Creation Details"
    Long explanation here.
