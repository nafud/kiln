# Radare2

Radare2 usage cheat sheet.

---

## Launch & Config

```bash
r2 <file>              # Open binary (read-only)
r2 -w <file>           # Open in write mode
r2 -d <file>           # Open under debugger
r2 -A <file>           # Auto-analyze on open (runs aaa)
r2 -q -c '<cmd>' <f>   # Run command then quit (scripting)
r2 -i script.r2 <f>    # Execute r2 script on open
```

**In-session config**

```
e                      # List all config variables
e <key>=<val>          # Set config variable
e asm.syntax=att       # Switch to AT&T syntax
e asm.bits=64          # Force 64-bit mode
e cfg.bigendian=true   # Force big-endian
!<cmd>                 # Execute shell command inline
q                      # Quit
```

---

## Analysis

```
aa                     # Analyze all (basic, fast)
aaa                    # Analyze all + extras (recommended)
aaaa                   # Deep analysis (slow, thorough)
af                     # Analyze function at current offset
afl                    # List all analyzed functions
afl~<str>              # Filter function list by string
afn <name>             # Rename current function
afi                    # Show function info / metadata
afv                    # List function local variables
axf                    # List forward xrefs from current addr
axt                    # List xrefs to current address
axt @@ sym.*           # Find all xrefs to all symbols
```

**Strings & References**

```
iz                     # List strings in .data section
izz                    # Search strings in whole binary
axt @ str.<name>       # Find where a string is referenced
ii                     # List imports
iE                     # List exports
is                     # List symbols
```

---

## Navigation

```
s <addr|sym>           # Seek to address or symbol
s+<n>                  # Seek forward n bytes
s-<n>                  # Seek backward n bytes
s-                     # Undo last seek
s+                     # Redo seek
sl                     # List seek history
s sym.main             # Jump to main()
```

**Flags & Bookmarks**

```
f <name> [len] @<addr> # Create named flag (bookmark)
fl                     # List all flags
fs                     # List flag spaces
fs <space>             # Switch to a flag space
f- <name>              # Delete a flag
```

---

## Disassembly

```
pd <n>                 # Disassemble n instructions
pdf                    # Disassemble current function
pdc                    # Pseudo-C decompiler output
pdg                    # Ghidra decompiler (r2ghidra plugin)
pd- <n>                # Disassemble n instructions backwards
pds                    # Disasm summary (calls, jumps only)
pdj                    # Disassembly as JSON
pi <n>                 # Print n instructions (no metadata)
ao                     # Analyze single opcode at cursor
aoj                    # Opcode info as JSON
```

---

## Print & Inspect

```
px <n>                 # Hex dump n bytes
pxw <n>                # Hex dump as 32-bit words
pxq <n>                # Hex dump as 64-bit qwords
ps @ <addr>            # Print string at address
pf <fmt>               # Print formatted struct (e.g. pf xxS)
p8 <n>                 # Raw bytes as hex string
p=e                    # Entropy visualization across file
```

**Visual Mode**

| Key | Action |
|-----|--------|
| `V` | Enter visual mode (hex view) |
| `VV` | Visual graph mode (CFG) |
| `v` | Visual panels (split view) |
| `p` / `P` | Cycle display modes |
| `q` | Exit visual mode |

---

## Searching

```
/ <string>             # Search for ASCII string
/x <hexbytes>          # Search for byte pattern
/a <asm>               # Search by assembly instruction
/c <instr>             # Search code matching instruction
/R <opcode>            # Find ROP gadgets matching pattern
/R/ <regex>            # ROP gadget search with regex
//                     # Repeat last search
```

**Search scope config**

```
e search.in=dbg.maps   # Search across all memory maps
e search.in=io.maps    # Search all mapped IO sections
```

---

## Debugging

```
dc                     # Continue execution
ds                     # Step into (one instruction)
dso                    # Step over (skip call)
dsu <addr>             # Step until address
db <addr>              # Set breakpoint
db- <addr>             # Remove breakpoint
dbl                    # List breakpoints
dr                     # Show register values
dr <reg>=<val>         # Set register value
dm                     # List memory maps
dbt                    # Backtrace (call stack)
doo [args]             # Restart process with args
dk <sig>               # Send signal to process
```

---

## Writing & Patching

!!! warning "Write mode required"
    Open with `r2 -w <file>` before any write operation.

```
wx <hexbytes>          # Write hex bytes at current offset
wa <asm>               # Write assembly instruction
wf <file>              # Write file contents at offset
wz <string>            # Write null-terminated string
wn <n> <byte>          # Write n copies of byte
wao nop                # NOP out current instruction
```

**One-liner patch from shell**

```bash
r2 -qc 'wx 90 @ 0x401234' -w ./binary
```

---

## Binary Info

```
i                      # File info summary
iI                     # Detailed binary info (arch, OS, bits)
ih                     # Section headers
iS                     # Sections with perms and sizes
il                     # Linked libraries
ir                     # Relocations
iM                     # Entry point
ph md5                 # MD5 hash of current block
ph sha256              # SHA256 hash of current block
```

**From shell (no session)**

```bash
rabin2 -I <file>       # Quick binary info
rabin2 -z <file>       # Extract strings
rabin2 -i <file>       # Imports
```

---

## Scripting & Output

```
~<str>                 # Grep output (pipe filter)
~[n]                   # Select column n from output
cmd > file             # Redirect output to file
. script.r2            # Source / execute r2 script
```

**Batch from shell**

```bash
r2 -qc 'cmd' <file>    # Single command, quit
r2 -i script.r2 <file> # Run full script
```

**Iterators**

```
@@                     # Run cmd on each matched address
@@ sym.*               # Iterate over all sym.* flags
afl @@ sym.*           # Analyze each symbol function
```

!!! tip "JSON output"
    Most commands accept a `j` suffix for JSON output — useful for r2pipe scripting: `aflj`, `pdj`, `isj`, etc.

---

## Common Workflows

**Static analysis entry point**

```bash
r2 -A ./binary
# then inside r2:
afl          # list functions
s sym.main   # jump to main
pdf          # disassemble
```

**Find & follow a string reference**

```
izz          # find all strings
axt @ str.interesting_string   # who references it?
s <addr>     # seek there
pdf          # disassemble that function
```

**ROP chain hunting**

```
/R/ pop rdi; ret       # find gadgets
/R/ pop rsi; pop r15   # chain candidates
```

**Patch a jump**

```bash
r2 -w ./binary
# inside r2:
s 0x401234
wa jmp 0x401260        # overwrite instruction
pd 1                   # verify
```
