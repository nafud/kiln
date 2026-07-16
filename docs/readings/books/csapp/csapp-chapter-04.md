# Chapter 4. Processor Architecture

!!! tip "TL;DR"
    Y86-64 is a simplified x86-64 with 15 registers (%r15 dropped), condition codes ZF, SF, and OF, a PC, a flat memory, and a program status code Stat. Instructions encode in 1 to 10 bytes as an `icode:ifun` byte, an optional register-specifier byte, and an optional 8-byte constant, with absolute branch and call addresses. Processing any instruction decomposes into six uniform stages, fetch, decode, execute, memory, write back, and PC update. SEQ performs all six within one long clock cycle; the clocked state (PC, condition codes, register file, data memory) updates only on the rising clock edge, and no instruction reads back state it updated itself. PIPE separates five stages with pipeline registers F, D, E, M, and W, predicts conditional branches as always taken and everything else exactly, and preserves ISA behavior against hazards by forwarding five result signals into the decode stage, stalling one cycle on a load/use hazard (load interlock), stalling three cycles while ret drains, and canceling the two misfetched instructions after a mispredicted branch. Exceptions ride each instruction's stat field to the write-back stage, where the pipeline halts after suppressing any visible-state updates by later instructions. Typical instruction frequencies give CPI ≈ 1.27, dominated by branch mispredictions.

The chapter builds processors for Y86-64, a simplified x86-64, first as a sequential design and then as a five-stage pipeline, with the control logic described in HCL.

## 4.1 The Y86-64 Instruction Set Architecture

An ISA defines the processor state, the set of instructions and their byte-level encodings, programming conventions, and the handling of exceptional events. It is the abstraction layer between compiler writers, who need only know what instructions exist and how they encode, and processor designers, who must build machines executing them. The processor may implement the state and the execution order however it likes, as long as machine-level programs appear to have sequential access to the programmer-visible state.

### 4.1.1 Programmer-Visible State

- 15 program registers, `%rax`, `%rcx`, `%rdx`, `%rbx`, `%rsp`, `%rbp`, `%rsi`, `%rdi`, and `%r8` through `%r14`, each holding a 64-bit word. `%r15` is omitted to simplify the encoding. `%rsp` serves as stack pointer for push, pop, call, and return; the rest carry no fixed meaning.
- Three single-bit condition codes ZF, SF, and OF, describing the most recent arithmetic or logical instruction.
- The program counter (PC), holding the address of the instruction currently executing.
- Memory, conceptually a large byte array holding program and data, addressed by virtual addresses that hardware and OS translate to physical ones.
- A status code Stat, indicating normal operation or the exception that has occurred (Section 4.1.4).

### 4.1.2 Y86-64 Instructions

The set is a subset of x86-64 restricted to 8-byte integer operations ("words" here, without ambiguity), fewer addressing modes, and fewer operations, in ATT-style assembly.

- The x86-64 `movq` splits into four explicit instructions named by source and destination type, `irmovq` (immediate→register), `rrmovq` (register→register), `mrmovq` (memory→register), and `rmmovq` (register→memory). Memory references use only base + displacement, with no index register and no scaling. Memory-to-memory and immediate-to-memory transfers do not exist.
- Four integer operations, `addq`, `subq`, `andq`, and `xorq` (collectively `OPq`), operate on registers only and set ZF, SF, and OF.
- Seven jumps, `jmp`, `jle`, `jl`, `je`, `jne`, `jge`, and `jg` (collectively `jXX`), with the same branch conditions as x86-64.
- Six conditional moves, `cmovle`, `cmovl`, `cmove`, `cmovne`, `cmovge`, and `cmovg` (collectively `cmovXX`), formatted like `rrmovq` but updating the destination only when the condition holds.
- `call` pushes the return address and jumps; `ret` returns. `pushq` and `popq` behave as in x86-64.
- `halt` stops execution and sets the status to HLT. The x86-64 counterpart `hlt` is forbidden to application code because it suspends the whole system.

### 4.1.3 Instruction Encoding

Each instruction occupies 1 to 10 bytes, an initial instruction-specifier byte, possibly a register-specifier byte, and possibly an 8-byte constant word.

| Instruction | Byte 0 | Byte 1 | Bytes 2-9 |
| --- | --- | --- | --- |
| `halt` | `00` | | |
| `nop` | `10` | | |
| `rrmovq rA, rB` | `20` | rA:rB | |
| `cmovXX rA, rB` | `2` fn | rA:rB | |
| `irmovq V, rB` | `30` | F:rB | V (bytes 2-9) |
| `rmmovq rA, D(rB)` | `40` | rA:rB | D (bytes 2-9) |
| `mrmovq D(rB), rA` | `50` | rA:rB | D (bytes 2-9) |
| `OPq rA, rB` | `6` fn | rA:rB | |
| `jXX Dest` | `7` fn | | Dest (bytes 1-8) |
| `call Dest` | `80` | | Dest (bytes 1-8) |
| `ret` | `90` | | |
| `pushq rA` | `A0` | rA:F | |
| `popq rA` | `B0` | rA:F | |

The initial byte splits into a high-order code part and a low-order function part. Codes run 0 to 0xB; the function part matters only where related instructions share a code.

| `OPq` | fn | `jXX` | fn | `cmovXX` | fn |
| --- | --- | --- | --- | --- | --- |
| `addq` | `60` | `jmp` | `70` | `rrmovq` | `20` |
| `subq` | `61` | `jle` | `71` | `cmovle` | `21` |
| `andq` | `62` | `jl` | `72` | `cmovl` | `22` |
| `xorq` | `63` | `je` | `73` | `cmove` | `23` |
| | | `jne` | `74` | `cmovne` | `24` |
| | | `jge` | `75` | `cmovge` | `25` |
| | | `jg` | `76` | `cmovg` | `26` |

`rrmovq` shares the code of the conditional moves and is the "unconditional move" with function code 0, just as `jmp` is the unconditional jump.

Each register carries a 4-bit identifier matching the x86-64 numbering. The registers live in a register file, a small random access memory addressed by these IDs.

| ID | Register | ID | Register |
| --- | --- | --- | --- |
| 0 | `%rax` | 8 | `%r8` |
| 1 | `%rcx` | 9 | `%r9` |
| 2 | `%rdx` | A | `%r10` |
| 3 | `%rbx` | B | `%r11` |
| 4 | `%rsp` | C | `%r12` |
| 5 | `%rbp` | D | `%r13` |
| 6 | `%rsi` | E | `%r14` |
| 7 | `%rdi` | F | No register |

ID 0xF marks the absence of a register, both in encodings (the unused half of the specifier byte for `irmovq`, `pushq`, and `popq`) and inside the hardware when no register should be accessed.

The 8-byte constant word serves as immediate data for `irmovq`, displacement for `rmmovq` and `mrmovq`, and destination for branches and calls. Branch and call targets are absolute addresses, not the PC-relative offsets of x86-64; PC-relative encoding is more compact and lets code shift in memory without patching targets, but absolute addressing is simpler. Integers are little endian, so the constant appears byte-reversed in disassembled form.

**Worked encoding.** `rmmovq %rsp,0x123456789abcd(%rdx)`. The initial byte is `40`. Source `%rsp` (4) goes in rA and base `%rdx` (2) in rB, giving specifier byte `42`. The displacement padded to 8 bytes is `00 01 23 45 67 89 ab cd`, byte-reversed to `cd ab 89 67 45 23 01 00`. Encoding, `4042cdab896745230100`.

Byte encodings have a unique interpretation. Every instruction has a unique code and function combination in its first byte, and that byte determines the length and meaning of the rest, so an arbitrary byte sequence either encodes a unique instruction sequence or is illegal. Given the first byte of a code sequence, decoding is unambiguous; without knowing the starting position, splitting a byte stream into instructions is unreliable, which is the standing problem of disassemblers.

!!! note "Y86-64 between RISC and CISC"
    Compared with x86-64, the Y86-64 encoding is simpler but less compact. Register fields sit at fixed positions, and constants are always 8 bytes, where x86-64 packs fields variably and encodes constants in 1, 2, 4, or 8 bytes. Y86-64 keeps CISC attributes (condition codes, variable-length instructions, return addresses on the stack) and RISC attributes (load/store architecture, regular encoding, register argument passing). It can be read as x86 simplified by RISC principles. Historically, the 1980s RISC position (fewer, fixed-length, register-only instructions suiting pipelines) and the CISC position (fewer instructions per task) converged; modern x86 processors fetch CISC instructions and dynamically translate them into RISC-like operations (Section 5.7).

### 4.1.4 Y86-64 Exceptions

| Value | Name | Meaning |
| --- | --- | --- |
| 1 | AOK | Normal operation |
| 2 | HLT | `halt` instruction encountered |
| 3 | ADR | Invalid address encountered |
| 4 | INS | Invalid instruction encountered |

ADR covers instruction fetch and data reads or writes beyond an implementation-defined maximum address. In this design the processor stops on any code other than AOK; a complete design would invoke an exception handler as described in Chapter 8.

### 4.1.5 Y86-64 Programs

The Y86-64 and x86-64 compilations of the same C function differ in predictable ways.

```c
long sum(long *start, long count) {
    long sum = 0;
    while (count) {
        sum += *start;
        start++;
        count--;
    }
    return sum;
}
```

```asm
# x86-64 (gcc)                        # Y86-64
sum:                                  sum:
  movl    $0, %eax    sum = 0          irmovq $8,%r8        Constant 8
  jmp     .L2         Goto test        irmovq $1,%r9        Constant 1
.L3:                                    xorq %rax,%rax       sum = 0
  addq    (%rdi), %rax                  andq %rsi,%rsi       Set CC
  addq    $8, %rdi    start++           jmp    test          Goto test
  subq    $1, %rsi    count--         loop:
.L2:                                    mrmovq (%rdi),%r10   Get *start
  testq   %rsi, %rsi                    addq %r10,%rax       Add to sum
  jne     .L3                           addq %r8,%rdi        start++
  rep; ret                              subq %r9,%rsi        count--. Set CC
                                      test:
                                        jne    loop          Stop when 0
                                        ret
```

Three differences. Y86-64 loads constants into registers first, since arithmetic instructions take no immediates. Reading memory and adding it to a register takes two instructions (`mrmovq` then `addq`) where x86-64 does both in one `addq`. The hand-written code exploits `subq` setting the condition codes, dropping the `testq`, which in turn requires an `andq` before the loop to set the codes for the first `jne`.

A complete program file adds assembler directives, words beginning with `.`, that place code and data. `.pos 0` starts code generation at address 0, the starting address of every Y86-64 program; the first instructions set up `%rsp` (a label placed by `.pos 0x200` at the end) and `call main`, then `halt`. `.align 8` aligns data, `.quad` emits 8-byte words. The programmer handles what compiler, linker, and run-time system normally would, which suffices for small programs. The stack grows from its label toward lower addresses and must not overwrite code or data.

The assembler `yas` turns the source into object code listing an address and 1 to 10 bytes per line. The instruction set simulator `yis` models execution of the machine code without modeling any hardware, reporting the step count, final PC, status, condition codes, and every register and memory word that changed. It serves for debugging programs before hardware exists and as the reference against which hardware simulations are checked.

### 4.1.6 Some Y86-64 Instruction Details

Two instruction combinations are ambiguous because the pushed or popped register is also being changed by the instruction. Y86-64 adopts the x86-64 conventions, established by experiment rather than documentation.

- `pushq %rsp` pushes the **original** value of `%rsp`, not the decremented one. (Determined by pushing, popping to another register, and subtracting; the result is 0.)
- `popq %rsp` sets `%rsp` to the value **read from memory**, not to the incremented stack pointer. It behaves exactly like `mrmovq (%rsp), %rsp`.

!!! note "The cost of inconsistency"
    Intel's own documentation notes that the 8086 pushed the decremented SP while every processor from the 286 on pushes the original value. The inconsistency decreases code portability and complicates documentation; working out such details in advance and enforcing consistency avoids both.

## 4.2 Logic Design and the Hardware Control Language HCL

Circuits represent bit values as voltages (about 1.0 V for logic 1, 0.0 V for logic 0). A digital system needs three components, combinational logic to compute functions on bits, memory elements to store bits, and a clock to regulate when the memory elements update. HCL ("hardware control language") describes the control portions of the processor designs; it expresses only control logic, with a limited operation set and no modularity, but control logic is the hardest part of a microprocessor design, and HCL translates mechanically to Verilog for synthesis.

!!! note "Modern logic design"
    Designs are written in hardware description languages (Verilog with C-like syntax, VHDL with Ada-like syntax) rather than drawn as schematics. Logic synthesis programs generate circuit designs from HDL descriptions, a shift comparable to compilers replacing hand-written assembly.

### 4.2.1 Logic Gates

Gates compute Boolean functions of single-bit inputs, written in HCL with C's logical operators, `&&` (and), `||` (or), `!` (not), not the bit-level `&`, `|`, `~`, because gates operate on bits, not words. n-way gates are written as chained binary operators (`a && b && c`). Gates are always active; an input change propagates to the output within a small delay.

### 4.2.2 Combinational Circuits and HCL Boolean Expressions

A combinational circuit is a network of gates under three restrictions. Every input connects to exactly one source (a primary input, a memory element output, or a gate output); gate outputs are never wired together (they could fight); and the network is acyclic (loops make the computed function ambiguous).

Bit equality is `bool eq = (a && b) || (!a && !b);`. A single-bit multiplexor selecting a when control s is 1 and b when s is 0 is `bool out = (s && a) || (!s && b);`. The `=` names an expression; nothing is computed and stored. Combinational logic differs from C logical expressions in three ways. Outputs respond continuously to input changes rather than at evaluation points; inputs are bits, not arbitrary integers read as truthy; and there is no short-circuit evaluation, since gates react to all inputs at all times.

### 4.2.3 Word-Level Combinational Circuits and HCL Integer Expressions

Words are groups of bit-level signals representing an integer or control pattern; the processor designs use word sizes from 4 to 64 bits. HCL declares any word-level signal as `int` without a size. Word-level equality (64 bit-equality circuits and an and gate) is written `bool Eq = (A == B);`. Diagrams draw word signals as medium lines and bit signals as dashed lines.

Multiplexors are described with case expressions.

```c
[
    select1 : expr1;
    select2 : expr2;
    ...
    selectk : exprk;
]
```

Selection expressions are evaluated in sequence and the first yielding 1 is selected, so unlike a C switch they need not be mutually exclusive; a final `1 :` case is the default, and nearly all case expressions end with one. The word-level MUX is

```c
word Out = [
    s : A;
    1 : B;
];
```

A 4-way MUX controlled by bits s1, s0 read as a 2-bit number exploits sequential matching, `!s1 && !s0 : A;` then `!s1 : B;` (s0 must be 1 by then), then `!s0 : C;`, then `1 : D;`. Selection expressions may be arbitrary Boolean expressions, so a minimum-of-three circuit is

```c
word Min3 = [
    A <= B && A <= C : A;
    B <= A && B <= C : B;
    1                : C;
];
```

A synthesis program resolves nonexclusive selects into mutually exclusive hardware controls.

The arithmetic/logic unit (ALU) is a combinational circuit with data inputs A and B and a function input. Its four operations are exactly the four Y86-64 integer operations, with control values matching their function codes (0 add, 1 subtract, 2 and, 3 xor), and subtraction computes B input minus A input, anticipating the operand order of `subq`.

### 4.2.4 Set Membership

Comparing a signal against a set of candidate values, such as classifying an instruction code, is written `iexpr in { iexpr1, iexpr2, ..., iexprk }`. Splitting a 2-bit code into MUX controls becomes `bool s1 = code in { 2, 3 };` and `bool s0 = code in { 1, 3 };`.

### 4.2.5 Memory and Clocking

Combinational circuits store nothing. Sequential circuits, systems with state, need storage devices, all controlled by a single periodic clock signal that determines when new values load. Two classes appear.

- **Clocked registers** store individual bits or words. The output stays fixed at the current state while the clock is low, even as the input changes; on the rising clock edge the input is captured as the new state. Registers thereby act as barriers between blocks of combinational logic, letting values cross once per cycle. In hardware, "register" means this device; in machine-level programming it means the addressable program registers in the register file. Where ambiguous, "hardware register" versus "program register". The Y86-64 processors keep the PC, the condition codes, and the program status in clocked registers.
- **Random access memories** store multiple words selected by an address, here the register file (register IDs as addresses) and the data memory.

The register file has two read ports (addresses srcA, srcB, outputs valA, valB) and two write ports in the full design; reading behaves like combinational logic, an address in produces the stored word out after a delay. Writing is clocked, the word on the data input is written to the addressed program register as the clock rises, and address 0xF means no write. If the same register is read and written in one cycle, the read output transitions from the old to the new value as the clock rises, a property the processor design must account for.

The data memory likewise reads combinationally (address in, data out, with an error signal for out-of-range addresses computed combinationally) and writes on the rising clock when the write control is set. A separate read-only instruction memory serves fetches; real systems merge the two into one memory with separate ports.

## 4.3 Sequential Y86-64 Implementations

SEQ ("sequential" processor) performs all steps of a complete instruction on every clock cycle. The clock must run slowly enough for the whole chain of actions to finish within one cycle, so performance is poor, but SEQ is the basis from which the pipelined design is derived.

### 4.3.1 Organizing Processing into Stages

Every instruction is forced through one uniform sequence of stages, with the detailed processing per stage depending on the instruction. Uniformity lets the instructions share hardware; each design contains, for example, a single ALU used differently per instruction type, because duplicating logic in hardware is far more expensive than duplicating code in software.

- **Fetch.** Read instruction bytes from memory at address PC. Extract icode and ifun from the specifier byte, possibly a register byte giving rA and rB, possibly the 8-byte constant valC. Compute valP, the address of the next sequential instruction (PC plus instruction length).
- **Decode.** Read up to two operands from the register file, valA and valB, usually from registers rA and rB, but for some instructions from `%rsp`.
- **Execute.** The ALU either performs the operation given by ifun, computes an effective address, or increments or decrements the stack pointer; the result is valE. Condition codes are possibly set. For `cmovXX`, the codes and ifun decide whether the destination register updates; for `jXX`, whether the branch is taken.
- **Memory.** Write to or read from memory; a read value is valM.
- **Write back.** Write up to two results to the register file.
- **PC update.** Set the PC to the next instruction's address.

The processor loops through these stages indefinitely, stopping on any exception in this simplified design.

The per-instruction computations are specified as tables of assignments, read top to bottom, in a form that maps directly onto hardware (the hardware will not need strict sequential evaluation). M1[x] and M8[x] denote 1- and 8-byte memory accesses.

| Stage | `OPq rA, rB` | `rrmovq rA, rB` | `irmovq V, rB` |
| --- | --- | --- | --- |
| Fetch | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] |
| | rA:rB ← M1[PC+1] | rA:rB ← M1[PC+1] | rA:rB ← M1[PC+1] |
| | | | valC ← M8[PC+2] |
| | valP ← PC+2 | valP ← PC+2 | valP ← PC+10 |
| Decode | valA ← R[rA] | valA ← R[rA] | |
| | valB ← R[rB] | | |
| Execute | valE ← valB OP valA | valE ← 0 + valA | valE ← 0 + valC |
| | Set CC | | |
| Memory | | | |
| Write back | R[rB] ← valE | R[rB] ← valE | R[rB] ← valE |
| PC update | PC ← valP | PC ← valP | PC ← valP |

The four `OPq` instructions share one icode and hence one flow, with only the ALU function varying by ifun. The operand order valB OP valA matches the convention that `subq %rax,%rdx` computes R[%rdx] − R[%rax]. `rrmovq` and `irmovq` run valA or valC through the ALU with 0 added, and neither touches the condition codes.

| Stage | `rmmovq rA, D(rB)` | `mrmovq D(rB), rA` |
| --- | --- | --- |
| Fetch | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] |
| | rA:rB ← M1[PC+1] | rA:rB ← M1[PC+1] |
| | valC ← M8[PC+2] | valC ← M8[PC+2] |
| | valP ← PC+10 | valP ← PC+10 |
| Decode | valA ← R[rA] | |
| | valB ← R[rB] | valB ← R[rB] |
| Execute | valE ← valB + valC | valE ← valB + valC |
| Memory | M8[valE] ← valA | valM ← M8[valE] |
| Write back | | R[rA] ← valM |
| PC update | PC ← valP | PC ← valP |

The ALU forms the effective address (displacement plus base) as valE, used as the memory address.

| Stage | `pushq rA` | `popq rA` |
| --- | --- | --- |
| Fetch | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] |
| | rA:rB ← M1[PC+1] | rA:rB ← M1[PC+1] |
| | valP ← PC+2 | valP ← PC+2 |
| Decode | valA ← R[rA] | valA ← R[%rsp] |
| | valB ← R[%rsp] | valB ← R[%rsp] |
| Execute | valE ← valB + (−8) | valE ← valB + 8 |
| Memory | M8[valE] ← valA | valM ← M8[valA] |
| Write back | R[%rsp] ← valE | R[%rsp] ← valE |
| | | R[rA] ← valM |
| PC update | PC ← valP | PC ← valP |

These are the hardest instructions, combining a memory access with a stack-pointer update. `pushq` writes at the decremented address valE, honoring the decrement-then-write convention even though `%rsp` itself is not updated until write back. `popq` reads two redundant copies of `%rsp` so its flow resembles the other instructions, and reads memory at the unincremented valA, honoring read-then-increment. Fed through these steps, `pushq %rsp` pushes the original stack pointer and `popq %rsp` leaves `%rsp` holding the value read from memory, matching the conventions of Section 4.1.6 (for `popq %rsp` the M-port write must win over the E-port write).

| Stage | `jXX Dest` | `call Dest` | `ret` |
| --- | --- | --- | --- |
| Fetch | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] | icode:ifun ← M1[PC] |
| | valC ← M8[PC+1] | valC ← M8[PC+1] | |
| | valP ← PC+9 | valP ← PC+9 | valP ← PC+1 |
| Decode | | | valA ← R[%rsp] |
| | | valB ← R[%rsp] | valB ← R[%rsp] |
| Execute | Cnd ← Cond(CC, ifun) | valE ← valB + (−8) | valE ← valB + 8 |
| Memory | | M8[valE] ← valP | valM ← M8[valA] |
| Write back | | R[%rsp] ← valE | R[%rsp] ← valE |
| PC update | PC ← Cnd ? valC : valP | PC ← valC | PC ← valM |

Jumps need no register byte. The execute stage combines condition codes and jump type into the 1-bit signal Cnd, consumed by PC update (`x ? a : b` as in C). `call` and `ret` are `pushq` and `popq` applied to program counter values, pushing valP and jumping to valC, or popping valM into the PC.

`cmovXX` extends `rrmovq` by computing Cnd ← Cond(CC, ifun) in execute and writing R[rB] ← valE only when Cnd holds. `nop` flows through incrementing the PC by 1; `halt` sets the status to HLT.

### 4.3.2 SEQ Hardware Structure

The hardware places one unit group per stage, with information flowing from the PC register at the bottom upward through fetch, decode, execute, memory, and write back, and feedback paths on the side carrying the register write-back values and the new PC down again. Drawing conventions used throughout, clocked registers as white rectangles (the PC is SEQ's only one), hardware units as blue boxes treated as black boxes (memories, ALU, register file), control logic blocks as gray rounded rectangles (these are what the HCL describes), word-wide connections as medium lines, byte-or-narrower connections as thin lines, and single-bit signals as dotted lines.

Per stage, the units are the instruction memory and PC incrementer (fetch); the register file read ports A and B (decode); the ALU, the condition code register, and the Cnd computation (execute); the data memory (memory); the register file write ports, E for ALU results and M for memory reads (write back); and the new-PC selection (PC update). Four register ID signals join the values already named, srcA and srcB for the read ports and dstE and dstM for the write ports.

### 4.3.3 SEQ Timing

The tables read as sequential assignments, but the hardware runs them as one combinational wave per clock cycle. Combinational logic and memory reads (register file, instruction memory, data memory reads all behave combinationally) need no sequencing; only four units are explicitly clocked, the PC, the condition code register, the data memory writes, and the register file writes. The PC loads every cycle, the CC only on `OPq`, the data memory only on `rmmovq`, `pushq`, and `call`, and register writes are suppressed with port address 0xF.

This clocking suffices because the design obeys one principle.

**No reading back.** The processor never needs to read back state updated by an instruction to complete that same instruction.

`pushq` illustrates it. Decrementing `%rsp` in the register file and then reading the new `%rsp` as the write address would read back updated state; instead the decremented value exists as the signal valE, feeding both the register write and the memory address, so both writes happen together on the rising edge. Likewise instructions set or read the condition codes, but no instruction does both, so codes written at the next rising edge are always ready before any consumer.

Within a cycle, the state elements hold values from the previous instruction while the combinational logic computes the current instruction's results; those results are loaded into the state elements only as the clock rises to begin the next cycle, at which point the next instruction starts. The processor therefore computes exactly what the sequential tables specify, even though all state updates occur simultaneously.

### 4.3.4 SEQ Stage Implementations

The control logic blocks are HCL case and Boolean expressions over the instruction fields and named constants (uppercase by convention), `IHALT`=0, `INOP`=1, `IRRMOVQ`=2, `IIRMOVQ`=3, `IRMMOVQ`=4, `IMRMOVQ`=5, `IOPQ`=6, `IJXX`=7, `ICALL`=8, `IRET`=9, `IPUSHQ`=A, `IPOPQ`=B; `FNONE`=0; `RESP`=4, `RNONE`=F; `ALUADD`=0; and status codes `SAOK`=1, `SADR`=2, `SINS`=3, `SHLT`=4.

**Fetch.** The instruction memory reads 10 bytes starting at PC. Byte 0 splits into icode and ifun, replaced by the nop encoding when imem_error signals an invalid instruction address. Three 1-bit signals derive from icode, instr_valid (legal instruction), need_regids (has a register byte), and need_valC (has a constant word).

```c
bool need_regids =
    icode in { IRRMOVQ, IOPQ, IPUSHQ, IPOPQ,
               IIRMOVQ, IRMMOVQ, IMRMOVQ };
```

The align unit produces rA and rB from byte 1 when need_regids holds, else 0xF, and valC from bytes 1-8 or 2-9 accordingly. The PC incrementer computes valP = p + 1 + r + 8i for need_regids r and need_valC i.

**Decode and write back.** Both stages access the register file, so their logic is combined. Four blocks generate the register IDs from icode, rA, rB, and (for conditional moves) Cnd.

```c
word srcA = [
    icode in { IRRMOVQ, IRMMOVQ, IOPQ, IPUSHQ } : rA;
    icode in { IPOPQ, IRET } : RESP;
    1 : RNONE;
];

word dstE = [
    icode in { IRRMOVQ } : rB;   # conditional move handled below
    icode in { IIRMOVQ, IOPQ } : rB;
    icode in { IPUSHQ, IPOPQ, ICALL, IRET } : RESP;
    1 : RNONE;
];
```

srcB selects rB for `OPq`, `rmmovq`, and `mrmovq`, and `%rsp` for the stack instructions; dstM is rA for `mrmovq` and `popq`. For `popq %rsp` both write ports address the same register with different data, and the M port must take priority so the memory value wins.

**Execute.** The ALU inputs come from two selection blocks (aluB listed first so `subq` computes valB − valA).

```c
word aluA = [
    icode in { IRRMOVQ, IOPQ } : valA;
    icode in { IIRMOVQ, IRMMOVQ, IMRMOVQ } : valC;
    icode in { ICALL, IPUSHQ } : -8;
    icode in { IRET, IPOPQ } : 8;
];

word alufun = [
    icode == IOPQ : ifun;
    1 : ALUADD;
];

bool set_cc = icode in { IOPQ };
```

The ALU always produces the zero, sign, and overflow signals, but set_cc gates loading them into the CC register to `OPq` only. The cond unit combines the codes with ifun into Cnd, used for conditional moves (gating dstE to rB only when Cnd holds) and for branches.

**Memory.** The address is always valE or valA, the write data always valA or valP.

```c
word mem_addr = [
    icode in { IRMMOVQ, IPUSHQ, ICALL, IMRMOVQ } : valE;
    icode in { IPOPQ, IRET } : valA;
];

bool mem_read = icode in { IMRMOVQ, IPOPQ, IRET };
bool mem_write = icode in { IRMMOVQ, IPUSHQ, ICALL };
```

The stage also computes Stat from icode, imem_error, instr_valid, and dmem_error.

**PC update.**

```c
word new_pc = [
    icode == ICALL : valC;
    icode == IJXX && Cnd : valC;
    icode == IRET : valM;
    1 : valP;
];
```

SEQ implements the full ISA with few units and a single clock, but it is too slow. A `ret` must read the instruction, read `%rsp`, add 8 in the ALU, and read the return address from memory, all within one cycle, and every unit sits idle for most of that cycle. Pipelining fixes the utilization.

## 4.4 General Principles of Pipelining

A pipelined system divides a task into discrete stages and lets multiple customers proceed at once, like a cafeteria line or car wash. Pipelining raises throughput (customers served per unit time) while slightly raising latency (time per individual customer).

### 4.4.1 Computational Pipelines

For hardware, the customers are instructions. In an unpipelined system with 300 ps of combinational logic and a 20 ps register, one instruction completes per 320 ps cycle, a throughput of 1/(320 ps) ≈ 3.12 GIPS (giga-instructions per second) at 320 ps latency. Splitting the logic into three 100 ps stages A, B, C with pipeline registers between them allows a 100 + 20 = 120 ps cycle. In steady state one instruction enters and one leaves every cycle, throughput 8.33 GIPS, a 2.67× gain, at latency 3 × 120 = 360 ps, a 1.12× increase caused by the added register overhead.

### 4.4.2 A Detailed Look at Pipeline Operation

Between rising clock edges, each stage's signals propagate through its combinational logic toward the next pipeline register's input; the register states, and hence outputs, change only as the clock rises, moving every in-flight instruction forward one stage simultaneously. Slowing the clock changes nothing (results wait at register inputs); running it too fast is disastrous, since inputs are captured before they are valid. Clocked registers between combinational blocks are the entire control mechanism.

### 4.4.3 Limitations of Pipelining

**Nonuniform partitioning.** The clock period is set by the slowest stage plus register delay. Stages of 50, 150, and 100 ps force a 170 ps cycle (5.88 GIPS, latency 510 ps), leaving the faster stages idle most of each cycle. Some units, like the ALU and memories, resist subdivision, making balanced stages a major design challenge.

**Diminishing returns of deep pipelining.** Splitting the same 300 ps into six 50 ps stages gives a 70 ps cycle and 14.29 GIPS, only 1.71× better than three stages despite halving the per-stage logic, because the fixed 20 ps register delay now consumes 28.6% of the cycle. Commercial processors use 15 or more stages to maximize clock rate, and circuit designers fight to minimize register delay and clock skew.

### 4.4.4 Pipelining a System with Feedback

Instructions are not independent. A result written to a register may be read by the next instruction (data dependency), and a conditional branch determines which instruction runs next (control dependency). In SEQ these dependencies flow through the feedback paths carrying register writes and the new PC. Naively inserting pipeline registers into a system with feedback changes its behavior; where the unpipelined system fed each instruction's result to the next, the three-stage version feeds I1's result to I4. A pipelined Y86-64 must handle data and control dependencies so the observable behavior still matches the ISA.

## 4.5 Pipelined Y86-64 Implementations

The design proceeds in steps. SEQ+ retimes the PC computation of SEQ, PIPE− inserts pipeline registers without yet handling dependencies, and modifications for forwarding and pipeline control yield the final PIPE processor.

### 4.5.1 SEQ+, Rearranging the Computation Stages

SEQ computes the new PC at the end of the cycle and loads it into the PC register. SEQ+ removes that register; state registers instead hold the signals the PC computation needs (pIcode, pCnd, pValM, pValC, pValP, values from the previous instruction), and at the start of each cycle the same selection logic computes the current instruction's PC from them. This is circuit retiming, changing the state representation without changing logical behavior, commonly used to balance pipeline stage delays.

!!! note "Where is the PC in SEQ+?"
    SEQ+ has no hardware register holding the program counter; the PC is derived dynamically from state left by the previous instruction. A processor need not encode state in the form the ISA implies, so long as it can produce correct values for every part of the programmer-visible state. Out-of-order processors (Section 5.7) take the same license to an extreme.

### 4.5.2 Inserting Pipeline Registers

PIPE− inserts pipeline registers between the stages of SEQ+, five stages now, since PC selection merges into fetch. The registers, whose fields are real hardware, are

- **F**, holding the predicted PC;
- **D**, between fetch and decode, holding the fetched instruction;
- **E**, between decode and execute, holding the decoded instruction and register values;
- **M**, between execute and memory, holding execution results plus branch condition and target information;
- **W**, between memory and the feedback paths, supplying write-back values to the register file and the return address to PC selection.

An instruction fetched in cycle 1 writes back after cycle 5; with the pipeline full, one instruction occupies every stage. Diagrams draw the pipeline flowing bottom (fetch) to top (write back) so that instructions in the stages read in program order, matching a listing.

### 4.5.3 Rearranging and Relabeling Signals

With up to five instructions in flight, signals like valC, srcA, and valE exist in multiple versions, and mixing versions across instructions is a serious error (writing one instruction's result to another's destination register). The naming scheme prefixes a pipeline-register field with the register name in uppercase (D_stat, E_stat, M_stat, W_stat) and a signal computed within a stage with the stage initial in lowercase (f_stat, m_stat). M_stat is the status field of pipeline register M; m_stat is the status computed in the memory stage.

Unlike SEQ+, the dstE and dstM IDs are not consumed at decode; they travel through the pipeline and address the register file only from the write-back stage, so the write port addresses and data always belong to the same instruction. The general principle is to keep all information about one instruction within one pipeline stage.

The decode-stage block "Select A" merges valP into valA. Only `call` needs valP in the memory stage and only `jXX` needs valP in the execute stage (for the not-taken address), and neither reads register port A, so the two signals travel the pipeline as one, shrinking pipeline register state. Merging signals after analyzing their uses is routine hardware practice.

Each pipeline register also carries a status field stat, computed in fetch and possibly modified in memory, the backbone of exception handling (Section 4.5.6).

### 4.5.4 Next PC Prediction

The goal is issuing one new instruction per cycle, which requires knowing the fetch address one cycle after fetching the current instruction. For `call` and `jmp` the next address is valC, for most instructions valP, both known at fetch. A conditional jump's outcome is known only after execute, and a `ret` target only after memory. PIPE predicts, guessing the branch direction and fetching accordingly (branch prediction, used in some form by virtually all processors). The strategy here is always taken, predicting valC.

```c
word f_predPC = [
    f_icode in { IJXX, ICALL } : f_valC;
    1 : f_valP;
];
```

No prediction is attempted for `ret` (return addresses are unbounded); the pipeline instead stalls until the `ret` reaches write back. The fetch stage both predicts the next PC (stored into F) and selects the current fetch address from three sources, the predicted PC, valP of a mispredicted branch arriving in M (M_valA), or the return address arriving in W (W_valM).

!!! note "Prediction strategies"
    Always taken succeeds about 60% of the time, never taken about 40%. Backward taken, forward not taken (BTFNT) reaches about 65%, because backward branches close loops that iterate while forward branches guard conditionals. High-performance processors also predict return addresses with a hardware stack of return addresses inside the fetch unit, pushed by calls and popped by returns, not programmer-visible and highly reliable.

### 4.5.5 Pipeline Hazards

Dependencies between instructions in the pipeline become hazards when they can produce a wrong computation, data hazards (a result feeds a following instruction's operand) and control hazards (an instruction determines the next fetch address).

**How data hazards arise.** Operands are read at decode, but results reach the register file only after write back, three cycles later, so an instruction's operand can be stale if any of the three preceding instructions writes it. With three `nop` instructions between two `irmovq` writes and an `addq` reading them, the writes complete before the `addq` decodes and everything is correct. With two `nop`s, the second write is still in write back when the `addq` decodes (one stale operand); with one `nop`, the writes sit in write back and memory (both operands stale); with none, they sit in memory and execute.

!!! note "Classes of data hazards"
    Checking every piece of program state. Program registers, read and written in different stages, the real hazard. Program counter, hazards only on mispredicted branches and `ret`, handled as control hazards. Memory, read and written in the same stage, so no hazard (instruction fetch versus data write collides only for self-modifying code, assumed absent). Condition codes, written at execute, read at execute (`cmovXX`) or memory (`jXX`), always after the writer has passed, no hazard. Status register, handled by the per-instruction stat mechanism. Only register data hazards, control hazards, and exceptions need treatment.

**Stalling.** The pipeline can hold an instruction in the decode stage until its source writers have passed write back, keeping F and D fixed (refetching the following instruction) and injecting a bubble into the execute stage each held cycle. A bubble is a dynamically generated `nop`, changing no register, memory, condition code, or status. This effectively re-creates the three-`nop` spacing at run time, correct but slow, since register reuse across adjacent instructions is common and each occurrence costs up to three cycles.

**Forwarding.** Instead of waiting for the register file, the decode stage takes the value directly from wherever it currently is. A pending E-port write in write back is picked up as W_valE; one in memory as M_valE; and the ALU output itself, e_valE, can feed decode within the same cycle, since decode only needs valA and valB ready by the end of the cycle, and the ALU output is valid before then. Memory-read values forward the same way, m_valM from the memory stage and W_valM from write back. Five forwarding sources in total (e_valE, m_valM, M_valE, W_valM, W_valE), each with a destination register ID, matched against srcA and srcB, feeding two destinations (valA, valB). PIPE extends PIPE− with these bypass paths into the decode-stage blocks "Sel+Fwd A" (which also merges valP) and "Fwd B".

**Load/use hazards.** Memory reads happen too late to forward to an immediately following user. If `mrmovq` is in execute while its user is in decode, the loaded value does not exist until the next cycle's memory stage; forwarding would need the value to travel backward in time. The fix combines a one-cycle stall with forwarding, the load interlock. Pipeline control detects the pattern, holds the using instruction in decode one cycle (bubble into execute), after which m_valM forwards from the memory stage to decode. Load interlocks plus forwarding handle all data hazards, and only load interlocks cost throughput.

**Control hazards.** Only `ret` and mispredicted jumps cause them. For `ret`, the pipeline stalls three cycles; the fetch stage cannot be idle, so it repeatedly fetches the instruction after the `ret` (the predicted valP), and the control logic replaces it with a bubble in decode each time, until the `ret` reaches write back and the PC selection logic takes W_valM. For a mispredicted branch, the wrong-path instructions fetched in the two cycles after the jump have not yet touched programmer-visible state (that first happens at execute, via condition codes), so when the execute stage discovers the misprediction the pipeline cancels (squashes) them by injecting bubbles into decode and execute on the next cycle while fetching the fall-through instruction from M_valA. Two cycles of work are lost.

### 4.5.6 Exception Handling

The three internal exceptions are `halt`, an invalid `icode:ifun` combination, and an invalid instruction or data address. The desired ISA behavior is that all instructions before the excepting one complete and none after it affects programmer-visible state, with the processor halting (a full design would invoke an OS exception handler, Chapter 8). Three subtleties.

- Multiple stages can raise exceptions in the same cycle (a `halt` fetching while a memory write faults). Priority goes to the instruction furthest along the pipeline, since it is earliest in program order.
- An instruction fetched down a mispredicted path can raise an exception (fetching an invalid byte at a predicted target) and later be canceled; the exception must not surface.
- Later instructions can update state before the excepting instruction completes, for example an `addq` setting condition codes in execute while a `pushq` ahead of it faults in memory (its decremented `%rsp` wrapped to 0xfffffffffffffff8).

The stat field solves all three. An exception sets the instruction's status, which travels the pipeline like any other field; fetching and executing continue as if nothing happened. When an excepting instruction reaches the memory stage, the control logic disables condition-code updates by the execute stage, injects bubbles into the memory stage to block data-memory writes, and stalls the write-back stage once the excepting instruction arrives there, halting the pipeline with W's status recorded as the program status. Instructions reach write back in program order, so the first excepting instruction arrives there first; a canceled instruction's status is canceled with it; and nothing after the excepting instruction alters visible state.

### 4.5.7 PIPE Stage Implementations

Most blocks are the SEQ blocks with prefixed signal names, for example SEQ's srcA becomes

```c
word d_srcA = [
    D_icode in { IRRMOVQ, IRMMOVQ, IOPQ, IPUSHQ } : D_rA;
    D_icode in { IPOPQ, IRET } : RESP;
    1 : RNONE;
];
```

**PC selection and fetch.** Three PC sources, the not-taken address of a mispredicted branch in M, the return address in W, otherwise the prediction in F.

```c
word f_pc = [
    M_icode == IJXX && !M_Cnd : M_valA;
    W_icode == IRET : W_valM;
    1 : F_predPC;
];
```

Status computation splits in two, fetch detects instruction-address errors, illegal instructions, and `halt`; data-address errors must wait for the memory stage.

**Decode and write back.** The write-port addresses come from W (W_dstE, W_dstM), not from decode. The forwarding logic in "Sel+Fwd A" is

```c
word d_valA = [
    D_icode in { ICALL, IJXX } : D_valP; # Use incremented PC
    d_srcA == e_dstE : e_valE;    # Forward valE from execute
    d_srcA == M_dstM : m_valM;    # Forward valM from memory
    d_srcA == M_dstE : M_valE;    # Forward valE from memory
    d_srcA == W_dstM : W_valM;    # Forward valM from write back
    d_srcA == W_dstE : W_valE;    # Forward valE from write back
    1 : d_rvalA; # Use value read from register file
];
```

d_valB is identical without the valP case. The order of the five forwarding cases is a correctness matter, not style. Multiple in-flight instructions can target the same register, and the machine must behave as if instructions ran one at a time, so the forwarded value must come from the latest writer in program order, which is the one in the earliest pipeline stage. Hence execute before memory before write back. Within one stage the E/M port order matters only for `popq %rsp`, the sole instruction writing the same register twice, where the M value (memory read) must win, matching Section 4.1.6.

The overall processor status comes from W, with a bubble reading as normal operation.

```c
word Stat = [
    W_stat == SBUB : SAOK;
    1 : W_stat;
];
```

**Execute.** Identical to SEQ apart from naming, except that "Set CC" also takes m_stat and W_stat as inputs so that condition-code updates are suppressed while an excepting instruction is downstream. e_valE and e_dstE feed back to decode as a forwarding source.

**Memory.** The SEQ "Mem. data" block (choosing valA versus valP as write data) disappears, since "Sel+Fwd A" already merged valP into valA. The stage completes the status computation by folding in dmem_error, and many M and W fields are tapped by the forwarding and control logic.

### 4.5.8 Pipeline Control Logic

Four cases exceed what forwarding and prediction can do, load/use hazards, `ret` processing, mispredicted branches, and exceptions. The control logic detects each condition combinationally during the cycle and drives per-register stall and bubble inputs that take effect as the clock rises.

**Detection.**

| Condition | Trigger |
| --- | --- |
| Processing `ret` | IRET in { D_icode, E_icode, M_icode } |
| Load/use hazard | E_icode in { IMRMOVQ, IPOPQ } && E_dstM in { d_srcA, d_srcB } |
| Mispredicted branch | E_icode == IJXX && !e_Cnd |
| Exception | m_stat in { SADR, SINS, SHLT } \|\| W_stat in { SADR, SINS, SHLT } |

The exception test uses m_stat, computed in the stage, rather than M_stat, so a data-address fault is seen the cycle it occurs.

**Mechanisms.** Each pipeline register gains stall and bubble control inputs. Normal (both 0) loads the input on the rising clock. Stall (stall=1) keeps the previous state, holding an instruction in place. Bubble (bubble=1) resets the register to a nop-equivalent configuration (icode INOP, register fields RNONE where present). Setting both is an error.

**Actions.**

| Condition | F | D | E | M | W |
| --- | --- | --- | --- | --- | --- |
| Processing `ret` | stall | bubble | normal | normal | normal |
| Load/use hazard | stall | stall | bubble | normal | normal |
| Mispredicted branch | normal | bubble | bubble | normal | normal |

**Combinations.** At most one condition per cycle is the naive assumption; failing to analyze simultaneous conditions is a classic design bug. A load/use hazard and a misprediction are mutually exclusive (execute would need both a load and a jump), but two combinations can co-occur.

- **Combination A.** A not-taken jump in execute with a `ret` in decode (the `ret` sits at the branch target). Merging the actions gives F stall, D bubble, E bubble, which handles it like a misprediction with an extra fetch stall; the PC selection logic overrides F next cycle anyway, so behavior is correct without special handling.
- **Combination B.** A load into `%rsp` in execute with a `ret` in decode (the `ret` needs `%rsp` to pop the return address). Merging naively sets both bubble and stall on D, an error. The load/use actions alone are correct, delaying the `ret` processing one cycle, so the `ret` bubble must be suppressed under a load/use hazard. The original design got this wrong and passed many simulation tests anyway; only systematic case analysis exposed the bug.

**Implementation.** The detections and actions combine directly into HCL.

```c
bool F_stall =
    # Load/use hazard
    E_icode in { IMRMOVQ, IPOPQ } &&
     E_dstM in { d_srcA, d_srcB } ||
    # ret passing through the pipeline
    IRET in { D_icode, E_icode, M_icode };

bool D_bubble =
    # Mispredicted branch
    (E_icode == IJXX && !e_Cnd) ||
    # ret in the pipeline, but not when combined with a load/use hazard
    !(E_icode in { IMRMOVQ, IPOPQ } && E_dstM in { d_srcA, d_srcB }) &&
      IRET in { D_icode, E_icode, M_icode };
```

D_stall is the load/use condition; E_bubble covers misprediction and load/use; set_cc requires an `OPq` in execute and no excepting instruction in memory or write back; M_bubble and W_stall implement the exception freeze. All other control signals stay zero.

!!! note "Testing and verifying the design"
    Running "typical" programs is not sufficient testing. The Y86-64 designs ship with scripts that systematically generate tests, all instructions with varied registers (optest, 49 tests), jumps and calls taken and not taken (jtest, 64), conditional moves (cmtest, 28), data hazard combinations with varying nop spacing (htest, 600), control combinations (ctest, 22), and exception interactions (etest, 12), each checked against the yis simulator. Formal verification went further on an earlier version, proving by induction that PIPE and SEQ have identical effects on programmer-visible state for arbitrary programs, with the ALU abstracted as an uninterpreted function. Across all verified variants exactly one bug surfaced, a combination-B error in a homework variant that the test suite had missed.

### 4.5.9 Performance Analysis

Every special control case injects bubbles, unused pipeline cycles, a `ret` three, a mispredicted branch two, a load/use hazard one. CPI (cycles per instruction), the reciprocal of throughput in clock cycles, estimates the cost. If the execute stage processes Ci real instructions and Cb bubbles,

```text
CPI = (Ci + Cb) / Ci = 1.0 + Cb/Ci = 1.0 + lp + mp + rp
```

with the penalty split by cause (load, mispredict, return). With representative frequencies, loads (`mrmovq`, `popq`) 25% of instructions with 20% causing load/use hazards, conditional branches 20% with 40% not taken, and returns 2%,

| Cause | Frequency | Condition | Bubbles | Product |
| --- | --- | --- | --- | --- |
| Load/use | 0.25 | 0.20 | 1 | 0.05 |
| Mispredict | 0.20 | 0.40 | 2 | 0.16 |
| Return | 0.02 | 1.00 | 3 | 0.06 |

CPI = 1.27 against the goal of 1.0. Mispredictions dominate the 0.27 penalty, since conditional branches are common, always-taken often fails, and each failure cancels two instructions. A BTFNT predictor (65% success) would cut mp to 0.20 × 0.35 × 2 = 0.14.

!!! note "Beyond five stages"
    A five-stage pipeline was state of the art in the mid-1980s (early SPARC, MIPS, and the i486 all used one) and is capped at CPI 1.0. Superscalar processors fetch, decode, and execute multiple instructions in parallel, pushing CPI below 1.0 (the preferred measure flips to IPC, instructions per cycle), and out-of-order execution reorders instructions freely while preserving the sequential ISA model (Section 5.7). Simple pipelines survive in embedded processors, where cost and power outweigh peak performance.

### 4.5.10 Unfinished Business

**Multicycle instructions.** Real instruction sets include operations needing several cycles, roughly 3 or 4 for floating-point addition up to 64 for integer division. The simple approach holds the instruction in execute while fetch and decode stall. Better designs issue such instructions to independent functional units (typically one for integer multiply/divide, one for floating point, itself pipelined) while the main pipeline continues, synchronizing through the same stalling and forwarding techniques.

**Interfacing with the memory system.** The design assumes one-cycle instruction and data access and ignores address translation and self-modifying code. In practice, translation look-aside buffers and first-level caches (one for instructions, one for data) make one-cycle access true most of the time. A cache miss stalls the pipeline in the fetch or memory stage for the 3 to 20 cycles a higher cache level or main memory needs, handled purely in hardware as extra stall conditions. A reference to a page held on disk raises a page fault exception; the OS handler loads the page and returns, and the faulting instruction re-executes, its thousands of handler cycles negligible against the millions a disk access costs. Stalling for short misses and exceptions for long ones absorb all the unpredictability of the memory hierarchy.
