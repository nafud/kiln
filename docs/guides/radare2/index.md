# Radare2

Commands for triage, analysis, debugging, and patching. Every command runs at
the current seek unless `@` redirects it.
{: .plain-intro }

## Launch & Config

```bash
r2 <file>              # Open read-only (safe default)
r2 -w <file>           # Open in read/write (needed for any patching)
r2 -d <file>           # Open under the debugger (spawns the process)
r2 -A <file>           # Load + run aaa (one -A = aaa, -AA = aaaa)
r2 -AA <file>          # Load + run aaaa (experimental, slower analysis)
r2 -q -c '<cmd>' <f>   # Run command(s) then quit — scripting/one-liners
r2 -i script.r2 <f>    # Run an r2 script on load
r2 -n <file>           # Skip header parsing / analysis (raw/corrupt files)
```

`r2 -A` is the everyday launch. Reach for `-AA` only when function boundaries or
jump tables come back wrong; it costs real time on large binaries.

**In-session config (`e`)**

```bash
e                      # Dump every config var (huge; grep it)
e~asm.                 # List only asm.* vars
e <key>=<val>          # Set a var
e asm.syntax=att       # AT&T instead of the default Intel
e asm.bits=64          # Pin word size when auto-detect is wrong
e asm.pseudo=true      # Render disasm as pseudocode inline
e cfg.bigendian=true   # Force big-endian (MIPS/PPC blobs)
e dbg.bep=main         # Break at main on launch instead of the ELF entry
!<cmd>                 # Run a host shell command
q                      # Quit  (q! to skip the "are you sure" on write mode)
```

Config is the lever behind most "why does it look like that" questions.
Syntax, bits, endianness, and pseudocode are all `e` toggles.

---

## Analysis

```bash
aa                     # Analyze all — fast, symbols + entrypoints only
aaa                    # aa + function calls, refs, strings (the sane default)
aaaa                   # aaa + experimental passes (jump tables, emu); slow
af                     # Analyze the function at the current offset
afl                    # List analyzed functions (addr, size, name)
afl~<str>              # Grep the function list  (e.g. afl~main)
aflj                   # Same, as JSON (feed to r2pipe)
afn <name>             # Rename the current function
afi                    # Function metadata (size, refs, stack frame, cc)
afv                    # Local variables + arguments of the function
axf                    # Xrefs FROM here (what this code calls/reads)
axt                    # Xrefs TO here (who reaches this address)
axt @@ sym.*           # Xrefs to every symbol, in one pass
```

`axt` is the backbone of static tracing. Seek to a function or string, run
`axt`, and follow the callers up. `af` earns its place because `aaa` regularly
misses functions reached only indirectly, which a manual seek to the byte
followed by `af` recovers.

**Strings & references**

```bash
iz                     # Strings in data sections (the usual list)
izz                    # Strings scanned across the whole binary
izzz                   # Raw scan, every string incl. unmapped regions
axt @ str.<name>       # Who references this string
ii                     # Imports
iE                     # Exports
is                     # Symbols
```

The `iz`, `izz`, `izzz` ladder trades noise for completeness. `iz` is the
starting point, and escalation pays off only when an expected string is absent
(packed or obfuscated data often surfaces only under `izzz`). r2 auto-creates
`str.*` flags, so `axt @ str.<name>` is the fast path from an interesting
string to the code that uses it.

---

## Navigation

```bash
s <addr|sym>           # Seek to an address, symbol, or flag
s sym.main             # Jump to main()
s+<n> / s-<n>          # Seek n bytes forward / back (relative)
s-                     # Undo last seek  (bare, no number)
s+                     # Redo seek       (bare, no number)
s*                     # Show seek history (undo_/redo_ flags)
```

The `s-` form is overloaded. `s-4` moves back four bytes, but bare `s-` undoes
the last jump. In visual mode the same undo/redo is `u` / `U`. Everything in r2
is relative to the current seek (`$$`), so seeking is what moves the cursor.

**Flags (bookmarks)**

```bash
f <name> [len] @ <addr># Create a named flag
fl                     # List flags
fs                     # List flag spaces
fs <space>             # Switch flag space (symbols, strings, etc.)
f- <name>              # Delete a flag
```

Flags are namespaced by flag space (`sym`, `str`, `reloc`, …). When `afl~foo`
finds nothing, the flag may live in another space, and `fs *` searches all of
them.

---

## Disassembly

```bash
pdf                    # Disassemble the current function (most-used)
pd <n>                 # Disassemble n instructions from here
pd -<n>                # Disassemble n instructions BEFORE here
pi <n>                 # n instructions, opcodes only (no addr/bytes column)
pds                    # Function summary — just the calls/strings/jumps
pdc                    # Built-in pseudo-decompiler (no plugin needed)
pdg                    # Ghidra decompiler        (needs r2ghidra)
pdd                    # r2dec decompiler         (needs r2dec)
pdj                    # Disassembly as JSON
ao                     # Analyze the opcode under the cursor (esil, type, size)
aoj                    # Same, JSON
```

`pdf` is the everyday command. `pds` is underrated for triage, collapsing a
function down to its calls and string refs so its relevance is clear without
reading every instruction. Decompiler quality varies per target. `pdc` always
works, while `pdg` and `pdd` are better but need their plugin installed.

---

## Print & Inspect

```bash
px <n>                 # Hexdump n bytes
pxw <n>                # Dump as 32-bit words
pxq <n>                # Dump as 64-bit qwords
pxr <n>                # Dump words + resolve each as a pointer/flag (stacks!)
ps @ <addr>            # Print the string at an address
pf <fmt> @ <addr>      # Print a formatted struct (e.g. pf xxs = int,int,str)
p8 <n>                 # Raw bytes as a hex string
p=e                    # Entropy graph across the file (spot packed regions)
```

`pxr` is the one to remember for stack and heap inspection, since it
dereferences each word and labels known addresses, rendering a stack frame
readable at a glance. `pf` takes a format string (`x` dword, `q` qword, `s`
string, `z` null-term, a leading number for arrays) and overlays a struct on
raw bytes.

**Visual mode**

| Key   | Action                                            |
| ----- | ------------------------------------------------- |
| `V`   | Hex/disasm view (Enter to open, `q` to leave)     |
| `VV`  | Graph mode — control-flow graph of the function   |
| `Vv`  | Function/analysis menu (rename, set types, xrefs) |
| `v`   | Visual panels (split dashboard view)              |
| `Vpp` | Visual debugger layout                            |

Inside any visual view, `p`/`P` cycle print modes, `hjkl` move, `:` drops to a
command prompt, and `?` shows context help. `VV` graph mode is the single
biggest quality-of-life feature for reading branchy functions.

---

## Searching

```bash
/ <string>             # Search ASCII
/i <string>            # Search ASCII, case-insensitive
/x <hexbytes>          # Search a byte pattern
/x ff..33              # ... with nibble wildcards ( .. = any )
/x ff0033:ff00ff       # ... with a bitmask (value:mask)
/a <asm>               # Search for an assembled instruction
/c <instr>             # Search analyzed code matching an instruction
/R <opcode>            # ROP gadgets ending in a matching instruction
/R/ <regex>            # ROP gadget search by regex
//                     # Repeat the last search
```

The masked `/x` forms are the workhorses. `/x 80..80` finds a byte, anything,
then a byte, and `value:mask` matches only the bits set in the mask. Results
land as `hit0_*` flags, iterable with `@@ hit*`.

**Search scope**

```bash
e search.in=dbg.maps   # Search all debugger memory maps
e search.in=io.maps    # Search all mapped IO sections
e search.in=block      # Search only the current block (default varies)
```

Scope is the usual "search finds nothing" culprit, since by default r2 may
search only the current section. Widen `search.in` before assuming the pattern
is absent.

---

## Debugging

```bash
dc                     # Continue
ds                     # Step one instruction (into)
dso                    # Step over (skips the call)
dsu <addr>             # Step until an address
dcu <addr>             # Continue until an address (faster "run to here")
db <addr>              # Set a breakpoint
db- <addr>             # Remove a breakpoint
db                     # List breakpoints  (dbl also lists)
dr                     # Show registers
dr <reg>=<val>         # Set a register
dr <reg>               # Read one register
dm                     # Memory maps
dmh                    # Heap layout (glibc; great for heap work)
dbt                    # Backtrace / call stack
doo [args]             # Reopen under debugger with args (alias of ood)
dk <sig>               # Send a signal to the process
```

For running to a given line, `dcu <addr>` beats stepping, since it continues at
full speed and stops at the target. `dso` versus `ds` matters constantly. `ds`
into a `call` descends into the callee, while `dso` runs the call and returns.
After any `dc` or `ds`, `V` (or `Vpp`) gives a live register and disasm
dashboard.

---

## Writing & Patching

!!! warning "Write mode required"
    Open with `r2 -w <file>` (or `oo+` mid-session) before any write. Writes hit
    the file on disk — work on a copy.

```bash
wx <hexbytes>          # Write raw hex at the current offset
wa <asm>               # Assemble and write an instruction
wao nop                # NOP out the current instruction (auto-sizes)
wf <file>              # Write a file's contents at the offset
wz <string>            # Write a null-terminated string
wn <byte> <n>          # Write n copies of a byte
```

`wao` is smarter than `wx 90` because it fills the whole instruction correctly
(right length, right no-op for the arch). `wa` assembles the instruction, so
`wa jmp 0x401260` replaces hand-encoding. Writes combine with iterators.

```bash
wx 90 @@ sym.*         # Write a byte at every symbol (batch patch)
```

**One-liner patch from the shell**

```bash
r2 -w -qc 'wx 90 @ 0x401234' ./binary
r2 -w -qc 's 0x401234; wa jmp 0x401260; pd 1' ./binary   # patch + verify
```

---

## Binary Info

```bash
i                      # File info summary
iI                     # Detailed: arch, bits, OS, endian, PIC/NX/canary
ih                     # File/format header fields (ELF/PE/Mach-O header)
iS                     # Sections — name, perms, size, vaddr/paddr
il                     # Linked libraries
ir                     # Relocations
ie                     # Entrypoints (the real start address(es))
iM                     # Address of the main symbol
ph md5                 # MD5 of the current block
ph sha256              # SHA-256 of the current block
ph md5 <len>           # Hash a specific length instead of the block size
```

Two easy mix-ups arise here. `ih` is the format *header* while `iS` is
*sections*, which are different things. And `ie` gives the entrypoint(s) while
`iM` gives `main`, since the CRT entry is not `main`. `iI` is the fastest
security-posture check (NX, PIE, canary, RELRO) without leaving r2.

**From the shell (no session)**

```bash
rabin2 -I <file>       # Info summary (mirrors iI)
rabin2 -z <file>       # Strings
rabin2 -i <file>       # Imports
rabin2 -e <file>       # Entrypoints
rabin2 -s <file>       # Symbols
```

`rabin2` is the same engine r2 uses for parsing, so it fits scripts and quick
triage where a full session is unwanted.

---

## Scripting & Output

```bash
~<str>                 # Grep r2 output   (afl~main)
~[n]                   # Keep column n of each line (afl~[0] = addresses)
~:0                    # Keep row 0 (first line)
cmd > file             # Redirect output to a file
cmd | host_cmd         # Pipe output to a host program (| less, | grep)
. script.r2            # Source an r2 script
.<cmd>                 # Run a command and interpret its output AS commands
```

The internal grep (`~`) is column- and row-aware, which is why r2 scripting
rarely needs external `grep`/`awk`. The `.` prefix is the metaprogramming hook.
`.(cmd)` runs a command and executes whatever it prints, turning a listing into
a batch of actions.

**Batch from the shell**

```bash
r2 -qc 'aaa; aflj' <file>        # Analyze, dump functions as JSON, quit
r2 -i script.r2 <file>           # Run a full script on load
```

**Iterators (`@@`)**

```bash
@@ <flag-glob>         # Run the command at each matching flag
@@ sym.*               # ... at every symbol
@@ hit*                # ... at every search hit
afl @@ sym.*           # Analyze each symbol's function
@@f                    # At every function (see aflq)
@@b                    # At every basic block of the current function
@@@ <type>             # Extended foreach over a class (functions, imports, …)
```

`@@` is r2's `for`-loop; anything flaggable is iterable. Paired with `~` and
`j` output, most one-off analysis scripts collapse to a single line.

!!! note "JSON everywhere"
    Append `j` to almost any command for machine-readable output: `aflj`,
    `pdj`, `isj`, `izj`, `drj`. This is the intended interface for r2pipe.

---

## Common Workflows

**Static triage entry point**

```bash
r2 -A ./binary
afl              # what functions exist
iI               # arch, protections (NX/PIE/canary)
s sym.main ; pdf # read main
```

**Follow a string to its use site**

```bash
izz                            # find the string
axt @ str.interesting_string   # who references it
s <ref-addr> ; pdf             # read that function
```

**ROP hunting**

```bash
/R/ pop rdi; ret               # gadget by regex
/R/ pop rsi; pop r15           # multi-instruction candidates
```

**Patch and verify a jump**

```bash
r2 -w ./binary
s 0x401234
wa jmp 0x401260                # or: wao nop  to kill a check
pd 1                           # confirm the new instruction
```

**Debug to a target, inspect the stack**

```bash
r2 -d ./binary
db 0x401234 ; dc               # break and run to it
dr                             # registers
pxr 64 @ rsp                   # stack with pointers resolved
```
