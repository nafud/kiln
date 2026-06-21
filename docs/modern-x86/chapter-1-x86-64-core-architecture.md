# Chapter 1. x86-64 Core Architecture

## Historical Overview

<pre class="ascii-diagram">
x86-32
│
├─ 1985  Intel 80386 -> 32-bit architecture
├─ 1989  Intel 80486 -> Integrated x87 FPU
├─ 1993  Pentium     -> Superscalar execution, MMX
├─ 1995  Pentium Pro -> Out-of-order execution
├─ 1999  Pentium III -> SSE (128-bit SIMD)
├─ 2000  Pentium 4   -> SSE2 / SSE3
│
└─ 2003  AMD64       -> x86-64
                        │
                        ├─ 2011  AVX      -> 256-bit SIMD
                        ├─ 2013  AVX2     -> 256-bit integer SIMD
                        ├─ 2013  FMA      -> Fused Multiply-Add
                        └─ 2017  AVX-512  -> 512-bit SIMD
</pre>