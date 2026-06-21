# Chapter 1. x86-64 Core Architecture

## Historical Overview

The x86 architecture has evolved from a 32-bit processor family into the modern x86-64 platform used by contemporary desktop, server, and workstation systems. Each generation introduced architectural features that improved performance, memory addressing, and parallel processing capabilities.

| Year | Processor / Technology | Significance |
|------|------------------------|--------------|
| 1985 | Intel 80386 | Introduced the x86-32 architecture with 32-bit registers, 32-bit arithmetic, virtual memory support, and a 4 GB address space. |
| 1989 | Intel 80486 | Integrated the x87 Floating-Point Unit (FPU) into the processor and added on-chip caches. |
| 1993 | Pentium | Introduced superscalar execution and MMX, the first SIMD extension for packed integer operations. |
| 1995 | Pentium Pro (P6) | Introduced out-of-order execution, speculative execution, and improved branch prediction. |
| 1999 | Pentium III | Introduced SSE and 128-bit XMM registers for SIMD floating-point operations. |
| 2000 | Pentium 4 | Introduced SSE2 and later SSE3, expanding SIMD support for floating-point and integer calculations. |
| 2003 | AMD64 | Extended x86-32 into x86-64 by introducing 64-bit registers, native 64-bit arithmetic, additional general-purpose registers, and a larger address space. Modern x86-64 is based on this extension. |
| 2011 | AVX | Expanded SIMD registers from 128 bits to 256 bits and introduced a three-operand instruction format. |
| 2013 | AVX2 + FMA | Extended 256-bit SIMD operations to packed integers and introduced Fused Multiply-Add (FMA) instructions. |
| 2017 | AVX-512 | Expanded SIMD registers to 512 bits and added masking, merging, and advanced vector-processing features. |

### Architectural Progression

```text
x86-32
   │
   ├─ 80386      → 32-bit architecture
   ├─ 80486      → Integrated FPU
   ├─ Pentium    → Superscalar execution, MMX
   ├─ Pentium Pro→ Out-of-order execution
   ├─ Pentium III→ SSE (128-bit SIMD)
   ├─ Pentium 4  → SSE2 / SSE3
   │
   └─ AMD64      → x86-64
                     │
                     ├─ AVX      (256-bit SIMD)
                     ├─ AVX2     (256-bit integer SIMD)
                     ├─ FMA
                     └─ AVX-512  (512-bit SIMD)
```

### Key Developments

The evolution of x86 can be viewed through three major trends:

- Expansion of the programming model from 32-bit to 64-bit operation.
- Increasing instruction-level parallelism through superscalar and out-of-order execution.
- Continuous growth of SIMD capabilities from MMX to AVX-512.

Modern x86-64 processors combine these developments into a single architecture that supports large address spaces, advanced execution engines, and wide vector-processing instructions.