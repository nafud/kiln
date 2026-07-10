# Chapter 2. ARM

The Acorn RISC Machine (later Advanced RISC Machine) is a 32-bit RISC architecture designed by Acorn Computers in the late 1980s and now licensed by ARM Holdings. It is dominant in embedded devices — phones, automobile electronics, media players, televisions. The architecture specifications are numbered ARMv1 through ARMv7; most devices run ARMv4, 5, 6, or 7. This chapter covers ARMv7 as defined in the *ARM Architecture Reference Manual: ARMv7-A and ARMv7-R Edition* (ARM DDI 0406B).

ARM licenses the architecture rather than manufacturing chips. Companies such as Apple, NVIDIA, Qualcomm, and Texas Instruments build processors (A, Tegra, Snapdragon, OMAP) on licensed cores. Optional extensions are each denoted by a letter: Jazelle (J) runs Java bytecode natively; Thumb (T) adds 16/32-bit instructions for higher code density; Debug (D) enables hardware debugging. Pre-ARMv7 cores append these letters (e.g., ARM1156T2). ARMv7 replaces this with three profiles — Application, Real-time, Microcontroller — and Cortex model names (Cortex-A, Cortex-M).

## Basic Features

Differences from CISC (x86/x64):

- The instruction set is small but there are more general-purpose registers.
- Instruction length is fixed: 16 or 32 bits depending on state.
- Memory access uses a load-store model. Data must be moved into registers (`LDR`) before being operated on, and results stored back (`STR`). Incrementing a value in memory takes three instructions.

ARM defines eight privilege modes rather than four rings:

| MODE | NAME                    |
| ---- | ----------------------- |
| USR  | User                    |
| FIQ  | Fast interrupt request  |
| IRQ  | Interrupt request       |
| SVC  | Supervisor              |
| MON  | Monitor                 |
| ABT  | Abort                   |
| UND  | Undefined               |
| SYS  | System                  |

USR is least privileged and cannot modify system registers. As a loose analogy, USR resembles ring 3 and SVC resembles ring 0; operating systems implement user mode in USR and kernel mode in SVC.

### ARM and Thumb State

The processor executes in one of two states, which determine only the instruction set, not privilege. In ARM state, instructions are always 32 bits wide. In Thumb state, instructions are 16 or 32 bits wide. State is selected two ways:

- On a `BX`/`BLX` branch, if the destination register's least significant bit is 1, the processor switches to Thumb. The LSB is ignored for alignment.
- If the `T` bit in the CPSR is set, the processor is in Thumb.

A core boots in ARM state and stays there until an explicit or implicit switch. Modern OS code often prefers Thumb for higher code density. 32-bit Thumb instructions carry a `.W` suffix.

!!! note "Thumb is not real mode"
    ARM/Thumb states are unrelated to x86 real/protected modes and unrelated to the privilege modes above. ARM and Thumb code execute interchangeably at any privilege level. Thumb-1 (ARMv6 and earlier) is always 16-bit; Thumb-2 (required by ARMv7) allows 16 or 32 bits. "Thumb" here means Thumb-2.

### Conditional Execution and the Barrel Shifter

Most ARM instructions can execute conditionally: the instruction encodes a condition, and if unmet the instruction becomes a no-op. This reduces branches (which are expensive) and raises code density. In ARM state all instructions support conditional execution but default to unconditional; in Thumb state the `IT` instruction is required to enable it.

The barrel shifter lets certain instructions embed a shift or rotate of a register operand, collapsing two instructions into one. `MOV R1, R0, LSL #1` computes `R1 = R0 * 2` in a single instruction.

## Data Types and Registers

Supported data types are 8-bit (byte), 16-bit (half-word), 32-bit (word), and 64-bit (double-word).

There are sixteen 32-bit general-purpose registers, `R0`–`R15`. The first twelve are general use; the last three are special:

| REGISTER | ALIAS | ROLE                                                     |
| -------- | ----- | -------------------------------------------------------- |
| `R13`    | SP    | Stack pointer; points to the top of the stack           |
| `R14`    | LR    | Link register; holds the return address during a call   |
| `R15`    | PC    | Program counter                                          |

`LR` corresponds to nothing in x86, which always stores the return address on the stack; when unused for that purpose `LR` is a general register.

!!! note "PC reads ahead"
    When read directly, `PC` is the current instruction plus 8 in ARM state (two instructions ahead) or plus 4 in Thumb state. This reflects legacy pipelining and is retained for compatibility. Under a debugger, `PC` instead shows the instruction about to execute. Writing an address to `PC` immediately transfers execution there.

The current program status register (CPSR) holds execution state, analogous to `EFLAGS`. The application program status register (APSR) is an alias for its condition-flag fields.

| BIT | NAME             | MEANING                                          |
| --- | ---------------- | ------------------------------------------------ |
| E   | Endianness       | 0 = little endian (typical), 1 = big endian      |
| T   | Thumb            | Set when in Thumb state                          |
| M   | Mode             | Current privilege mode (USR, SVC, ...)           |

## System-Level Controls and Settings

System settings live in coprocessors rather than dedicated control registers. There are 16 coprocessors, `CP0`–`CP15` (written `P0`–`P15` in code). The first 13 are optional or reserved; `CP10`/`CP11` typically provide floating-point and NEON. `CP14` handles debug; `CP15`, the system control coprocessor, holds most system settings (caching, paging, exceptions).

!!! note "NEON"
    NEON is the single-instruction multiple-data (SIMD) instruction set for multimedia, comparable to SSE/MMX on x86.

Each coprocessor has 16 registers and eight opcodes. They are accessed only through `MRC` (read) and `MCR` (write), which take a coprocessor number, register numbers, and opcodes:

```
MRC p15, 0, r0, c2, c0, 0   ; read CP15 C2/C0 (translation base) into R0
```

`MRC`/`MCR` do not require high privilege, but some coprocessor registers are accessible only in SVC mode; an under-privileged access faults. These instructions appear mostly in low-level code — ROM, boot loaders, firmware, kernel.

## Introduction to the Instruction Set

Two properties distinguish ARM instructions from x86:

Some instructions operate on a range of registers. `STM R1, {R6-R10}` stores `R6` at `R1`, `R7` at `R1+4`, and so on. Non-consecutive registers are listed with commas (`{R1,R5,R8}`).

Some instructions optionally update the base register after the operation, marked with `!` (writeback). `STM R1!, {R6-R10}` updates `R1` to the address just past where `R10` was stored.

## Loading and Storing Data

The only instructions that touch memory are `LDR`/`STR`, `LDM`/`STM`, and `PUSH`/`POP`.

### LDR and STR

`LDR`/`STR` load and store 1, 2, or 4 bytes. Each takes a base register and an offset. There are three offset forms and three addressing modes.

| OFFSET FORM       | FORMAT                       | TYPICAL USE                         |
| ----------------- | ---------------------------- | ----------------------------------- |
| Immediate         | `LDR Ra, [Rb, imm]`          | Structure/vtable field at a fixed offset |
| Register          | `LDR Ra, [Rb, Rc]`           | Array access with a runtime index   |
| Scaled register   | `LDR Ra, [Rb, Rc, <shifter>]`| Loop over an array; shifter scales the index |

The immediate form corresponds to `MOV Reg, [Reg + Imm]` on x86, the register form to `MOV Reg, [Reg + Reg]`, and the scaled form to `MOV Reg, [Reg + idx*scale]`.

| ADDRESSING MODE | SYNTAX                    | EFFECT                                         |
| --------------- | ------------------------- | ---------------------------------------------- |
| Offset          | `LDR Rd, [Rn, offset]`    | Base register unchanged                        |
| Pre-indexed     | `LDR Rd, [Rn, offset]!`   | Address computed, then written back to base (prefix `++`/`--`) |
| Post-indexed    | `LDR Rd, [Rn], offset`    | Base used as address, then base updated (postfix `++`/`--`) |

```
12 F9 01 3D  LDRSB.W R3, [R2,#-1]!  ; R3 = *(R2-1);  R2 = R2-1   (pre-indexed)
10 F9 01 6B  LDRSB.W R6, [R0],#1    ; R6 = *R0;      R0 = R0+1   (post-indexed)
```

!!! note "Recognizing addressing modes"
    If there is a `!`, it is pre-indexed. If the base register stands alone in brackets, it is post-indexed. Anything else is offset mode.

### Other Uses for LDR

`LDR Rd, =value` is a pseudo-instruction that loads a 32-bit constant, string address, or imported-function offset from the literal pool — a data area within the code section — using PC-relative addressing. It lets a full 32-bit constant be loaded in one instruction.

```
01: .text:0100B134 35 4B  LDR R3, =0x68DB8BAD   ; actually LDR R3, [PC, #0xD4]
03: .text:0100B20C ...    dword_100B20C DCD 0x68DB8BAD
```

`ADR` computes a label or function address relative to `PC` and places it in a register, used for jump tables and callbacks.

### LDM and STM

`LDM`/`STM` load and store multiple words at a base register, useful for block copies. Syntax is `LDM<mode> Rn[!], {Rm}`, with `!` requesting writeback.

| MODE | NAME             | BEHAVIOR                                                     |
| ---- | ---------------- | ----------------------------------------------------------- |
| IA   | Increment After  | Start at base; writeback = address 4 bytes above last (default) |
| IB   | Increment Before | Start 4 bytes above base; writeback = last address          |
| DA   | Decrement After  | Last location is base; writeback = 4 bytes below lowest      |
| DB   | Decrement Before | Last location is 4 bytes below base; writeback = first address |

Inlined `memcpy` is recognizable as `LDM`/`STM` with writeback moving the same register set between a source and destination pointer. At function boundaries in ARM state they serve as prologue/epilogue.

```
01: F0 4F 2D E9  STMFD SP!, {R4-R11,LR}  ; save regs + return address
03: F0 8F BD E8  LDMFD SP!, {R4-R11,PC}  ; restore regs and return
```

!!! note "STM/LDM suffixes"
    `FD`, `FA`, `ED`, `EA` are pseudo-instruction aliases for `LDM`/`STM` modes: `STMFD`/`STMDB`, `STMFA`/`STMIB`, `STMED`/`STMDA`, `STMEA`/`STMIA`, and the mirror `LDM` forms. Drawing the stack for each is the most reliable way to keep them straight.

### PUSH and POP

`PUSH`/`POP` are `LDM`/`STM` specialized to `SP`: they implicitly use `SP` as the base and always write back. `PUSH` is `STMDB SP!`; `POP` is `LDMIA SP!`. The stack grows downward. They are the standard Thumb-state prologue/epilogue and are sometimes used by disassemblers as a heuristic for function boundaries.

```
01: 2D E9 F0 4F  PUSH.W {R4-R11,LR}   ; save registers + return address
03: BD E8 F0 8F  POP.W  {R4-R11,PC}   ; restore registers and return
```

## Functions and Function Invocation

Unlike x86 with its single `CALL` and `JMP`, ARM has several branch instructions. The return address may be stored in `LR` or on the stack. The ARM calling convention passes the first four 32-bit parameters in `R0`–`R3`, the rest on the stack, and returns the result in `R0`.

| INSTRUCTION | NAME                    | BEHAVIOR                                                    |
| ----------- | ----------------------- | ---------------------------------------------------------- |
| `B`         | Branch                  | Unconditional branch to an offset (like `JMP`); no state switch, no `LR` update |
| `BX`        | Branch and Exchange     | Branch to a register target; switches ARM/Thumb by target LSB. `BX LR` returns (like `RET`) |
| `BL`        | Branch with Link        | Stores return address in `LR`, then branches to an offset (closest to `CALL`) |
| `BLX`       | Branch with Link/Exchange | Like `BL` but takes a register or offset and can switch state |

`BL` is used when the target is within a 32MB range; `BLX` is used for undetermined ranges such as function pointers. In Thumb state `BLX` typically calls library routines; in ARM state `BL` is used.

## Arithmetic Operations

`MOV` moves a constant, register, or barrel-shifter result. A 32-bit constant that cannot be encoded as an immediate is loaded either via the barrel shifter or by `MOVW` (bottom 16 bits) plus `MOVT` (top 16 bits).

```
01: 4F F0 0A 00  MOV.W R0, #0xA        ; r0 = 0xa
03: A4 4A A0 E1  MOV R4, R4, LSR #21   ; r4 = r4 >> 21 (barrel shifter)
```

Basic operations are `ADD`, `SUB`, `MUL`, `AND`, `ORR`, `EOR`.

!!! note "The S suffix"
    ARM arithmetic instructions do not set condition flags by default. The `S` suffix (`ADDS`, `ANDS`, `ORRS`) makes the instruction update the flags. This differs from x86, where arithmetic updates flags implicitly.

`MUL` keeps only the low 32 bits of the product; full 64-bit results use `SMULL`/`UMULL`. ARM (ARMv7-A) has no native divide instruction — division calls a software routine such as `__rt_udiv`. (`SDIV`/`UDIV` exist on ARMv7-R and ARMv7-M.)

## Branching and Conditional Execution

Condition flags live in the APSR (an alias of the CPSR).

| FLAG | NAME     | SET WHEN                                              |
| ---- | -------- | ---------------------------------------------------- |
| N    | Negative | Result's most significant bit is 1                   |
| Z    | Zero     | Result is zero                                        |
| C    | Carry    | Unsigned operation overflows                          |
| V    | Overflow | Signed operation overflows                            |

N, Z, C, V correspond to SF, ZF, CF, OF on x86.

| SUFFIX | MEANING                    | FLAGS               |
| ------ | -------------------------- | ------------------- |
| EQ     | Equal                      | `Z==1`              |
| NE     | Not equal                  | `Z==0`              |
| MI     | Minus / negative           | `N==1`              |
| PL     | Plus / positive or zero    | `N==0`              |
| HI     | Unsigned higher            | `C==1 and Z==0`     |
| LS     | Unsigned lower or same     | `C==0 or Z==1`      |
| GE     | Signed greater or equal    | `N==V`              |
| LT     | Signed less than           | `N!=V`              |
| GT     | Signed greater than        | `Z==0 and N==V`     |
| LE     | Signed less or equal       | `Z==1 or N!=V`      |

Any suffix appended to a branch makes it conditional (`BLT` = branch if less than, like `JL`). Comparison instructions update flags automatically.

| INSTRUCTION | SEMANTIC                                                    |
| ----------- | ---------------------------------------------------------- |
| `CMP Rn, X` | `Rn - X`, set flags, discard result (like x86 `CMP`)       |
| `TST Rn, X` | `Rn & X`, set flags, discard result (like x86 `TEST`)      |
| `CBZ Rn, label`  | Branch to label if `Rn` is zero (Thumb-2)             |
| `CBNZ Rn, label` | Branch to label if `Rn` is non-zero (Thumb-2)        |
| `CMN` / `TEQ`    | Addition / exclusive-or forms, uncommon               |

Instruction-level conditional execution can eliminate branches entirely:

```
01: 00 00 50 E3  CMP R0, #0          ; if (a == NULL)
02: 01 00 A0 03  MOVEQ R0, #1        ;   return 1
03: 68 00 D0 15  LDRNEB R0, [R0,#0x68]  ; else return a->off_48
04: 1E FF 2F E1  BX LR
```

### Thumb State: The IT Instruction

Thumb instructions cannot be conditional (except `B`) without the `IT` (if-then) instruction, which conditionalizes up to four following instructions. Syntax is `ITxyz cc`, where `cc` is the condition for the first instruction and `x`, `y`, `z` describe the second through fourth: `T` means match `cc`, `E` means the inverse of `cc`.

```
01: 00 2B  CMP R3, #0
02: 12 BF  ITEE NE            ; NE, then E/E/E = inverse for the next three
03: ...    CLZNE.W R0, R12    ; executes if NE
04: ...    CLZEQ.W R0, R6     ; executes if EQ (inverse)
05: ...    ADDEQ R0, #0x20    ; executes if EQ
```

### Switch-Case

Compilers build a jump table of addresses (ARM) or offsets (Thumb) and branch indirectly by loading the destination into `PC`. In ARM state this is `LDR PC, [PC, Rn, LSL#2]`; because `PC` reads 8 bytes ahead, the table sits 8 bytes past the `LDR`.

```
02: 0B 00 51 E3  CMP R1, #0xB              ; range check
03: 01 F1 9F 97  LDRLS PC, [PC,R1,LSL#2]   ; index into table, branch
04: 14 00 00 EA  B loc_DD10                ; default
05: 3C DD 00 00  DCD loc_DD3C              ; jump table
```

Thumb uses table-branch instructions with compact offsets: `TBB` (byte entries) and `TBH` (half-word entries). Each entry is multiplied by two and added to `PC`. Because Thumb `PC` reads 4 bytes ahead, the table follows the `TBB`/`TBH`. These are Thumb-only.

## Miscellaneous

### JIT and Self-Modifying Code

The core has separate instruction (i-cache) and data (d-cache) caches that are not guaranteed coherent. Code that writes new instructions to memory (JIT compilers, self-modifying shellcode) may execute stale instructions from the i-cache. The fix is to flush the i-cache via CP15; operating systems expose this as `__clear_cache` (Linux) or `FlushInstructionCache` (Windows).

### Synchronization Primitives

ARM has no `cmpxchg`. Instead `LDREX` and `STREX` acquire exclusive access to a memory address before load/store, together implementing compare-and-exchange — this is how `InterlockedCompareExchange` is built on Windows. The barrier instructions `DMB`, `DSB`, and `ISB` synchronize memory access and instruction fetch, and appear in lock implementations because memory access and fetches can occur out of order.

## System Services and Mechanisms

On boot the core executes ARM code at `0x00000000` or `0xFFFF0000`, selected by the vector (V) bit in CP15 C1/C0. This region holds the exception vectors, with the RESET handler first. RESET performs basic hardware configuration and begins the boot process, then jumps to a bootloader (often U-Boot) in flash or removable media, which initializes hardware, maps the OS image into memory, and transfers control.

User code (USR) requests OS services through a software interrupt, since ARM has no dedicated syscall instruction. `SWI`/`SVC` (identical, differently named) trigger the interrupt and switch to supervisor mode. Both take an immediate; conventions differ:

| PLATFORM     | SYSCALL NUMBER              | ARGUMENTS         |
| ------------ | --------------------------- | ----------------- |
| Linux (ARM)  | `R7`                        | `R0`–`R2`         |
| Windows RT   | `R12`                       | —                 |

```
Linux:                          Windows RT (ZwCreateFile):
MOV R7, #0x92   ; syscall no.    MOV.W R12, #0x53
SVC 0                            SVC 1
                                 BX LR
```

On entering SVC, the return address is copied to `R14_svc`, a banked register — one with meaning only in a particular processor mode. `R13_svc` and `R14_svc` hold different values than their USR counterparts.

Software breakpoints are implemented via the `BKPT` instruction (triggers the prefetch abort handler) or via an undefined instruction (triggers the undefined-instruction handler); the ARM encoding reserves a guaranteed-undefined range.

## Instructions and the 0xE Pattern

Every ARM-state instruction encodes a condition in the top four bits (28–31). The default `AL` (always) is `0b1110` = `0xE`. Consequently ARM-state machine code shows a recurring `0xE*` byte every four bytes.

```
FE FF FF EA FE FF FF EA FE FF FF EA FE FF FF EA
FE FF FF EA 1C F1 9F E5 00 00 A0 E1 18 01 9F E5
```

!!! note "Guessing architecture from a raw dump"
    Recognizing the `0xE*`-every-four-bytes pattern helps identify ARM code in a context-free memory dump, ROM image, or extracted shellcode where no file format is present.

## Walk-Through: Structure Recovery

The chapter's walk-through decompiles an unknown Thumb-2 function, deriving facts before inferring types:

- **State**: Thumb-2, from the `PUSH`/`POP` prologue/epilogue, 16/32-bit instruction sizes, and `.W` suffixes.
- **Prototype**: four arguments (`R0`–`R3`) and a Boolean return (`R0`), from the ABI. `R0`/`R1` are structure pointers, evident from base-plus-offset loads at non-sequential offsets (`0x10`, `0x18`, `0x1C`).
- **Field types**: an `LDRH` implies a `short` field; an equality `CMP` between two fields implies both are integers of the same type; `AND`/`ORR` against integer arguments imply integer fields.

Chained loads recover nested structures: a load using a previously loaded field as a new base reveals a pointer member. A multiply-by-24 scaling (`R2*3*8`, where `R2` is an index) reveals an array whose element size is `0x18`.

!!! note "Adjacent AND on two fields"
    An `AND` applied across two adjacent integer fields (each in its own register/memory location) usually indicates a 64-bit value split into two 32-bit halves — a common pattern for handling 64-bit constants on 32-bit architectures.

Approaching an unknown function: state the certain facts first (state, preserved registers, prototype, exit paths), then use them to infer structure field types (width and signedness) from the instructions and conditional codes that touch each field.
