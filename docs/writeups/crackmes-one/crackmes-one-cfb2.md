# CFB2 — The Maze Runner

**Platform:** Windows x86-64  
**Difficulty:** Easy  
**Author:** pwn.by  
**Source:** [crackmes.one](https://crackmes.one/){ .external-link }

A keygen-style crackme where the "key" is not a serial or a hash pre-image — it is a route through a maze embedded as raw data in the binary. Solving it is entirely static: locate the grid, recover the movement and validation semantics from the disassembly, and run a shortest-path search.

| | |
|---|---|
| **Target** | `CFB2.exe` — PE32+ console executable, x86-64 |
| **Toolchain** | MSVC (C++, iostreams, `std::string`) |
| **Image base** | `0x140000000` |
| **SHA-256** | `20aa2133b4694a036e349a28b2203d729fa3964cde3a07f641e33e1abe26596b` |
| **Tools used** | `file`, `strings`, `objdump -d -M intel`, Python |
| **Method** | Pure static analysis — no debugger, no execution |

!!! tip "TL;DR — key"
    `SDDSSASSDDSSDDDSSDDD`

---

## 1. Triage

```bash
$ file CFB2.exe
CFB2.exe: PE32+ executable (console) x86-64, for MS Windows, 6 sections
```

Section table (relevant for mapping file offsets ↔ virtual addresses later):

| Section | VMA | File offset | Notes |
|---|---|---|---|
| `.text` | `0x140001000` | `0x000400` | code |
| `.rdata` | `0x14002b000` | `0x029e00` | string literals + the maze |
| `.data` | `0x14003e000` | `0x03c800` | globals (`__security_cookie`, iostream ptrs) |

Any `.rdata` VMA maps back to disk as `fileoff = 0x29e00 + (vma − 0x14002b000)`. That single relation is all we need to pull embedded data out by hand — no PE-aware tooling required.

## 2. Strings define the checker's contract

`strings` alone reveals the entire state machine before a single instruction is read:

```bash
$ strings -n 6 CFB2.exe
[*] Welcome to CFB2 - The Maze Runner.
[*] Enter your solution path (using W/A/S/D):
[-] Invalid move '
[-] Only W, A, S, D are allowed.
[-] Out of bounds at step
[-] Hit a wall at step
[-] You did not reach the finish point (9,9).
[-] You reached the end, but didn't finish the input key there!
   [+] ACCESS GRANTED! Congratulations!
```

From these we can already state the checker's contract:

- Input is a string of moves drawn from `{W, A, S, D}`.
- There is a grid with **walls** and **bounds**; the finish is fixed at **`(9,9)`**, implying a 10×10 grid indexed `0..9`.
- Two distinct end-state failures exist: *not reaching the finish*, and *"reaching the end but not finishing the key there"* — i.e. the terminal move, not merely some intermediate move, must land on the goal.

Everything after this is confirming the exact numeric encoding and pulling the grid bytes.

## 3. Locating main

MSVC loads each literal with a RIP-relative `lea`, and `objdump` helpfully resolves the target in a trailing comment. The verdict strings all resolve into `.rdata`; grepping the disassembly for that address band collapses to one function:

```bash
$ objdump -d -M intel --no-show-raw-insn CFB2.exe > disasm.txt
$ grep -nE '# 0x14002b[789ab]' disasm.txt
140006407: lea rdx,[rip+0x253ba]  # 0x14002b7c8   ; "Enter your solution path"
1400066be: lea rdx,[rip+0x25243]  # 0x14002b908   ; ACCESS GRANTED block
14000677d: lea rdx,[rip+0x25164]  # 0x14002b8e8   ; "Hit a wall at step"
...
```

Every hit lands inside the function starting at **`0x140006370`** — this is `main`.

## 4. Input acquisition (MSVC std::string, SSO)

Before the maze logic, the program reads one line and trims it. Two implementation details are worth calling out because they generate most of the surrounding branch noise:

- The line is read with a `'\n'` delimiter (`mov dl,0xa` before the stream call) — a `std::getline(std::cin, s)`.
- The `std::string` uses **SSO (small string optimization)**. Its layout on the stack is: buffer at `[rbp-0x38]`, size at `[rbp-0x28]`, capacity at `[rbp-0x20]`, initialized to `0xf`:

```asm
14000643c: mov QWORD PTR [rbp-0x20],0xf     ; capacity = 15 (SSO threshold)
140006444: mov BYTE  PTR [rbp-0x38],0x0     ; buffer[0] = '\0'
```

The recurring pattern `cmp QWORD PTR [rbp-0x20],0xf` / `cmova rax,[rbp-0x38]` throughout is simply "is this string heap-allocated or inline?": if capacity > 15 the data pointer is dereferenced from `[rbp-0x38]`, otherwise the buffer *is* `[rbp-0x38]`. Recognizing this prevents mistaking pointer bookkeeping for validation logic. Leading/trailing whitespace is stripped with an `isspace` helper (`0x140010cc0`), then an empty result is rejected:

```asm
1400065f6: test r14,r14                     ; r14 = trimmed length
1400065f9: jne  0x140006607
1400065fb: lea  rdx,[rip+...] # 0x14002b808  ; "[-] Error: Key cannot be empty!"
```

## 5. The validation loop

State is initialized as `x = 0`, `y = 0`, a "won" flag, and the loop index `i`, plus the maze base pointer:

```asm
140006607: xor esi,esi          ; x   = 0
140006609: xor edi,edi          ; y   = 0
14000660b: xor bl,bl            ; won = 0
14000660d: xor r15d,r15d        ; i   = 0
140006619: lea r14,[rip+0x24da0] ; r14 = 0x14002b3c0  <-- MAZE BASE
```

### 5.1 Move decode

Each character is upper-cased (`0x140010fe8`, a `toupper` whose fast path is `lea eax,[rcx-0x61]; cmp eax,0x19; ja …; add ecx,-0x20`) and dispatched:

```asm
140006638: cmp al,'A' -> dec esi   ; x -= 1
14000663c: cmp al,'D' -> inc esi   ; x += 1
140006640: cmp al,'S' -> inc edi   ; y += 1
140006644: cmp al,'W' -> dec edi   ; y -= 1
140006646: jne 0x1400066eb         ; anything else -> "Invalid move"
```

| Key | Δ | Direction |
|---|---|---|
| `W` | `y − 1` | up |
| `S` | `y + 1` | down |
| `A` | `x − 1` | left |
| `D` | `x + 1` | right |

### 5.2 Bounds — unsigned on purpose

```asm
14000665a: cmp esi,0x9 ; ja out_of_bounds
140006663: cmp edi,0x9 ; ja out_of_bounds
```

`ja` is an **unsigned** compare. A coordinate that decremented below zero wraps to a large unsigned value, so the single `> 9` test rejects both `< 0` and `> 9` in one branch. `x`/`y` are treated as 32-bit here but only ever hold `0..9` on the valid path.

### 5.3 Cell lookup and encoding

The index is row-major with stride 10, computed with two `lea`s:

```asm
14000666c: lea eax,[rdi+rdi*4]   ; eax = y*5
14000666f: lea eax,[rsi+rax*2]   ; eax = x + (y*5)*2 = x + y*10
140006674: movzx edx,BYTE PTR [rax+r14*1]   ; dl = maze[y*10 + x]
```

The byte is then interpreted (`r12b` holds the constant `1`):

```asm
140006679: cmp dl,1  ; je hit_wall            ==> 1 = WALL
140006686: cmp dl,2  ; jne next               ==> 2 = GOAL
14000668b: lea rax,[rcx-1]      ; rcx = len ; rax = len-1
140006692: cmp r15,rax          ; i == len-1 ?
140006695: cmove ebx,r12d       ; won = 1  iff on a goal cell at the FINAL step
```

Cell encoding: **`0` = open, `1` = wall, `2` = goal.** The `won` flag is set only when a goal cell is occupied on the last input character — this is the mechanism behind the *"finished the key there"* rule. The start tile `(0,0)` is never wall-checked; validation only inspects tiles *entered by a move*, making `(0,0)` the implicit valid origin.

## 6. Win gate and failure dispatch

After the loop:

```asm
1400066a5: test bl,bl  ; je  fail    ; won == 1 ?
1400066ad: cmp esi,0x9 ; jne fail    ; x == 9 ?
1400066b6: cmp edi,esi ; jne fail    ; y == x  (== 9) ?
1400066be: ...                       ; ACCESS GRANTED
```

Success requires **all three**: finished on a goal tile at the final step, and terminal position exactly `(9,9)`.

The failure handlers form a compact dispatch. Mapping each verdict to the condition that produces it:

| Verdict string | Trigger | Extra info printed |
|---|---|---|
| `Key cannot be empty!` | trimmed input length 0 | — |
| `Invalid move '<c>' at step N` + `Only W, A, S, D are allowed.` | char ∉ {W,A,S,D} | offending char, 1-based step |
| `Out of bounds at step N! (x:…, y:…)` + `ACCESS DENIED!` | `x>9` or `y>9` (unsigned) | step, coords |
| `Hit a wall at step N! (x:…, y:…)` + `ACCESS DENIED!` | `maze[y*10+x] == 1` | step, coords |
| `You did not reach the finish point (9,9).` + current position | loop finished, `(x,y) ≠ (9,9)` | terminal coords |
| `You reached the end, but didn't finish the input key there!` | loop finished, `(x,y) == (9,9)` **but** `won == 0` | — |

Displayed step numbers are 1-based (`lea rdx,[r15+1]`).

**A note on the "didn't finish the key there" branch.** With this data set it is effectively dead code. `won` is set whenever a goal tile is occupied at `i == len-1`, and `(9,9)` is the *only* goal tile; therefore any run whose terminal position is `(9,9)` must have entered `(9,9)` on the final move, which sets `won = 1` and diverts to *ACCESS GRANTED*. Reaching the post-loop gate with `(x,y) == (9,9)` and `won == 0` is unreachable unless the grid contained a second goal tile. It's a reasonable defensive branch, but it cannot fire against the shipped maze.

## 7. Extracting the maze

Base VMA `0x14002b3c0` → file offset `0x29e00 + (0x14002b3c0 − 0x14002b000) = 0x2a1c0`. Read 100 bytes:

```python
g = open('CFB2.exe','rb').read()[0x2a1c0:0x2a1c0+100]
for y in range(10):
    print(' '.join(f'{c}' for c in g[y*10:(y+1)*10]))
```

```text
      x = 0 1 2 3 4 5 6 7 8 9
 y=0:     0 1 1 1 1 1 1 1 1 1
 y=1:     0 0 0 1 0 0 0 0 0 1
 y=2:     1 1 0 1 0 1 1 1 0 1
 y=3:     1 0 0 0 0 1 0 0 0 1
 y=4:     1 0 1 1 1 1 0 1 1 1
 y=5:     1 0 0 0 1 0 0 0 0 1
 y=6:     1 1 1 0 1 1 1 1 0 1
 y=7:     1 0 0 0 0 0 0 1 0 1
 y=8:     1 0 1 1 1 1 0 1 0 0
 y=9:     1 1 1 1 1 1 0 0 0 2
```

As a map (`S` start `(0,0)`, `G` goal `(9,9)`, `#` wall, `.` open):

```text
S # # # # # # # # #
. . . # . . . . . #
# # . # . # # # . #
# . . . . # . . . #
# . # # # # . # # #
# . . . # . . . . #
# # # . # # # # . #
# . . . . . . # . #
# . # # # # . # . .
# # # # # # . . . G
```

## 8. Solving

The constraints reduce to: find a walk from `(0,0)` to `(9,9)` over 4-connected open tiles, avoiding `1`s. Because `(9,9)` is the sole goal and must also be the terminal tile, *any* wall-free path is a valid key; a BFS yields the shortest one and guarantees the terminal-step-on-goal condition for free.

```python
from collections import deque
maze = [g[y*10:(y+1)*10] for y in range(10)]
MOVES = {'W':(0,-1),'S':(0,1),'A':(-1,0),'D':(1,0)}

q, seen = deque([((0,0),"")]), {(0,0)}
while q:
    (x,y), p = q.popleft()
    if (x,y) == (9,9):
        print(p); break
    for ch,(dx,dy) in MOVES.items():
        nx,ny = x+dx, y+dy
        if 0<=nx<=9 and 0<=ny<=9 and maze[ny][nx]!=1 and (nx,ny) not in seen:
            seen.add((nx,ny)); q.append(((nx,ny), p+ch))
```

Result — the shortest solution (20 moves):

```text
SDDSSASSDDSSDDDSSDDD
```

Path overlay (`*` = route):

```text
S # # # # # # # # #
* * * # . . . . . #
# # * # . # # # . #
# * * . . # . . . #
# * # # # # . # # #
# * * * # . . . . #
# # # * # # # # . #
# . . * * * * # . #
# . # # # # * # . .
# # # # # # * * * G
```

## 9. Verification by reimplementation

Rather than execute the binary, the checker is reimplemented byte-for-byte from §5–§6 and the key is replayed through it:

```python
def verify(maze, s):
    x = y = 0; won = False
    for i, c in enumerate(s.upper()):
        if c not in MOVES: return f"invalid move at step {i}"
        dx, dy = MOVES[c]; x += dx; y += dy
        if not (0 <= x <= 9 and 0 <= y <= 9): return f"out of bounds at step {i}"
        if maze[y][x] == 1: return f"wall at step {i}"
        if maze[y][x] == 2 and i == len(s)-1: won = True
    return "ACCESS GRANTED" if won and (x,y) == (9,9) else "denied"

# verify(maze, "SDDSSASSDDSSDDDSSDDD") -> "ACCESS GRANTED"
```

Expected runtime behavior:

```text
[+] Key: SDDSSASSDDSSDDDSSDDD

   [+] ACCESS GRANTED! Congratulations!
   You have successfully solved CFB2!
```

## 10. Summary

The challenge is a data-driven maze validator. Its only non-obvious pieces are (a) the SSO bookkeeping that clutters the input-handling prologue, (b) the unsigned bounds check that folds the negative case into a single comparison, (c) the `x + y*10` addressing and `0/1/2` cell encoding, and (d) the terminal-step goal flag whose "didn't finish the key there" failure path is unreachable against the shipped grid. Once the 100 maze bytes at `0x14002b3c0` are recovered, the key is any wall-free route from `(0,0)` to `(9,9)`:

```text
SDDSSASSDDSSDDDSSDDD
```

---

### Appendix — key addresses

| Address | Meaning |
|---|---|
| `0x140006370` | `main` |
| `0x140006607` | validation loop init |
| `0x140006620` | per-character move decode |
| `0x14000665a` | unsigned bounds check |
| `0x140006674` | `maze[y*10 + x]` load |
| `0x1400066a5` | win gate (`won && x==9 && y==9`) |
| `0x14002b3c0` | maze grid (100 bytes, file offset `0x2a1c0`) |
| `0x140010fe8` | `toupper` helper |
| `0x140010cc0` | `isspace` helper (whitespace trim) |
