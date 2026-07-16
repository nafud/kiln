# CFB2

**Source:** [crackmes.one](https://crackmes.one/crackme/6a15496417539b5175d12386){ .external-link }  
**Author:** [CrackNotMe](https://crackmes.one/user/CrackNotMe){ .external-link }  
**Difficulty:** 2.0  
**Quality:** 4.0  
**Language:** C/C++  
**Platform:** Windows  
**Arch:** x86-64

A crackmes.one maze runner. The key is not a serial, it is a path. The program reads a string of `W/A/S/D` moves and walks them across a 10x10 grid that is stored as data in the binary, accepting any route that starts at the top left and ends on the goal. The work is to recover the grid and the movement rules, then search for a path. The analysis below is static.

| | |
|---|---|
| Target | `CFB2.exe` |
| Image base | `0x140000000` |
| SHA-256 | `20aa2133b4694a036e349a28b2203d729fa3964cde3a07f641e33e1abe26596b` |
| Method | Static analysis. No debugger. |

!!! tip "TL;DR"
    The maze is a 10x10 grid at `0x14002b3c0`, one byte per cell (`0` open, `1` wall, `2` goal). Start is `(0,0)`, goal is `(9,9)`, and moves are `W` up, `S` down, `A` left, `D` right. Any wall-free route works. The shortest is

    ```text
    SDDSSASSDDSSDDDSSDDD
    ```

    A solver that reads the grid and searches for a path is in the [Solving](#6-solving) section.

## 1. Triage

A 64-bit MSVC console PE.

=== "Radare2"

    ```console
    $ rabin2 -I CFB2.exe
    arch     x86
    baddr    0x140000000
    bintype  pe
    bits     64
    class    PE32+
    cc       ms
    endian   little
    lang     c
    machine  AMD 64
    os       windows
    subsys   Windows CUI

    $ rabin2 -S CFB2.exe
    [Sections]

    nth paddr          size vaddr          vsize perm type name
    ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    0   0x00000400  0x29a00 0x140001000  0x2a000 -r-x ---- .text
    1   0x00029e00  0x12a00 0x14002b000  0x13000 -r-- ---- .rdata
    2   0x0003c800   0x1400 0x14003e000   0x3000 -rw- ---- .data
    3   0x0003dc00   0x2600 0x140041000   0x3000 -r-- ---- .pdata
    4   0x00040200    0x200 0x140044000   0x1000 -rw- ---- .fptable
    5   0x00040400    0xa00 0x140045000   0x1000 -r-- ---- .reloc
    ```

=== "Objdump"

    ```console
    $ file CFB2.exe
    CFB2.exe: PE32+ executable (console) x86-64, for MS Windows, 6 sections

    $ objdump -h CFB2.exe
    Idx Name          Size      VMA               File off
      0 .text         00029868  0000000140001000  00000400
      1 .rdata        000129a6  000000014002b000  00029e00
      2 .data         00001400  000000014003e000  0003c800
    ```

Strings live in the file at a **file offset** but the code refers to them by **virtual address**. Matching a string to the instruction that loads it means converting between the two. Each section lists both, and within a section they differ by a fixed delta, `delta = vaddr - paddr`. The strings and the maze both sit in `.rdata`, so

```text
delta(.rdata) = 0x14002b000 - 0x29e00 = 0x140001200
vaddr = file_offset + 0x140001200
```

## 2. Strings

Filter for the program's own markers.

=== "Radare2"

    ```console
    $ rabin2 -z CFB2.exe | grep -E '\[[-+*]\]'
    nth paddr      vaddr       len size section type  string
    14  0x0002a4f8 0x14002b6f8 51  52   .rdata ascii [+] by pwn.by [+]
    17  0x0002a5a0 0x14002b7a0 39  40   .rdata ascii [*] Welcome to CFB2 - The Maze Runner.\n
    18  0x0002a5c8 0x14002b7c8 46  47   .rdata ascii [*] Enter your solution path (using W/A/S/D):\n
    19  0x0002a5f8 0x14002b7f8 9   10   .rdata ascii [+] Key:
    20  0x0002a608 0x14002b808 32  33   .rdata ascii [-] Error: Key cannot be empty!\n
    23  0x0002a660 0x14002b860 19  20   .rdata ascii \n[-] Invalid move '
    24  0x0002a678 0x14002b878 33  34   .rdata ascii [-] Only W, A, S, D are allowed.\n
    27  0x0002a6b0 0x14002b8b0 27  28   .rdata ascii \n[-] Out of bounds at step
    28  0x0002a6d0 0x14002b8d0 19  20   .rdata ascii [-] ACCESS DENIED!\n
    29  0x0002a6e8 0x14002b8e8 24  25   .rdata ascii \n[-] Hit a wall at step
    31  0x0002a740 0x14002b940 52  53   .rdata ascii    [+] ACCESS GRANTED! Congratulations!\n
    33  0x0002a7b0 0x14002b9b0 52  53   .rdata ascii    [-] ACCESS DENIED!\n
    34  0x0002a7f0 0x14002b9f0 67  68   .rdata ascii    [-] You reached the end, but didn't finish the input key there!\n
    35  0x0002a838 0x14002ba38 52  53   .rdata ascii    [-] You did not reach the finish point (9,9).\n
    36  0x0002a870 0x14002ba70 29  30   .rdata ascii    [-] Current position: (x:
    ```

=== "Objdump"

    ```console
    $ strings -n 4 CFB2.exe | grep -iE 'maze|w/a/s/d|access|wall|bounds|step|invalid move|finish|empty'
    [*] Welcome to CFB2 - The Maze Runner.
    [*] Enter your solution path (using W/A/S/D):
    [-] Error: Key cannot be empty!
    [-] Invalid move '
    [-] Out of bounds at step
    [-] Hit a wall at step
       [+] ACCESS GRANTED! Congratulations!
       [-] You reached the end, but didn't finish the input key there!
       [-] You did not reach the finish point (9,9).
    ```

The contract is spelled out. Read a `W/A/S/D` path, then reject it for one of three reasons, an invalid move, stepping out of bounds, or hitting a wall. The finish is `(9,9)`, which means a 10x10 grid indexed `0` through `9`. One message stands out, "You reached the end, but didn't finish the input key there," so the final position matters as much as the moves. Next, find where these strings are used.

## 3. Locating main

Take the `[*] Enter your solution path` prompt and find the instruction that loads it.

=== "Radare2"

    ```console
    $ r2 -A CFB2.exe
    [0x14000949c]> izz~solution path
    3430 0x0002a5c8 0x14002b7c8 46 47 .rdata ascii [*] Enter your solution path (using W/A/S/D):\n
    [0x14000949c]> axt 0x14002b7c8
    main 0x140006407 [DATA:r--] lea rdx, str.___Enter_your_solution_path__using_W_A_S_D_:_n
    [0x14000949c]> pdf @ main
                ; CALL XREF from entry0 @ 0x140009427(x)
    ┌ 1471: int main (int argc, char **argv, char **envp);
    │           0x140006370      push rbp
    │           0x140006372      push rbx
    │           ...
    ```

    r2's analysis (`-A`) resolves the cross-reference into the named function `main` and draws its bounds, so the entry at `0x140006370` is given directly.

=== "Objdump"

    ```console
    $ python3 -c "d=open('CFB2.exe','rb').read(); print(hex(d.find(b'[*] Enter your solution path')))"
    0x2a5c8

    # convert with the delta from Triage: 0x2a5c8 + 0x140001200 = 0x14002b7c8

    $ objdump -d -M intel --no-show-raw-insn CFB2.exe > dis.txt
    $ grep '# 0x14002b7c8' dis.txt
    140006407:  lea rdx,[rip+0x253ba]        # 0x14002b7c8
    ```

    That instruction is inside a function. Read upward in `dis.txt` to the prologue. MSVC pads the gap between functions with `int3`, so the first instruction after the padding is the entry point.

    ```nasm
    14000636f:  int3            ; padding between functions
    140006370:  rex push rbp    ; prologue starts here
    140006372:  push rbx
    ```

Either way, `main` starts at `0x140006370`. Read it from there.

## 4. Reading main

Print the function with `pdf @ main` in the r2 session, or read `dis.txt` around `0x140006370`. The listings below are trimmed to the relevant instructions.

`main` prints a banner, reads one line with `std::getline`, trims whitespace with an `isspace` helper at `0x140010cc0`, and rejects an empty key. The input is an MSVC `std::string`, so the recurring `cmp <capacity>, 0xf` followed by a `cmova` is the small-string check that selects between the inline buffer and a heap pointer. None of that is the validation. The validation is a single loop that walks the path.

Before the loop, the state is cleared and the maze base is loaded.

```nasm
140006607:  xor esi,esi            ; x = 0
140006609:  xor edi,edi            ; y = 0
14000660b:  xor bl,bl              ; won = 0
14000660d:  xor r15d,r15d          ; i = 0
140006619:  lea r14,[rip+0x24da0]  ; # 0x14002b3c0  maze base
```

Each character is upper-cased with `toupper` at `0x140010fe8`, then dispatched. The four moves change one coordinate each.

```nasm
14000662e:  movzx ecx,BYTE PTR [rax+r15*1]  ; ecx = key[i]
140006633:  call 0x140010fe8                ; toupper
140006638:  cmp al,0x41   ; 'A' -> dec esi  (x -= 1)
14000663c:  cmp al,0x44   ; 'D' -> inc esi  (x += 1)
140006640:  cmp al,0x53   ; 'S' -> inc edi  (y += 1)
140006644:  cmp al,0x57   ; 'W' -> dec edi  (y -= 1)
140006646:  jne 0x1400066eb                 ; anything else, invalid move
```

So `x` is the column moved by `A` and `D`, `y` is the row moved by `W` and `S`. After each move the position is bounds checked. The compare is unsigned, so a coordinate that dropped below zero wraps to a large value and fails the same `ja`, covering both edges with one test.

```nasm
14000665a:  cmp esi,0x9 ; ja 0x1400067e9    ; x > 9, out of bounds
140006663:  cmp edi,0x9 ; ja 0x1400067e9    ; y > 9, out of bounds
```

The cell is read from the grid with a row-major index, `y * 10 + x`.

```nasm
14000666c:  lea eax,[rdi+rdi*4]             ; y * 5
14000666f:  lea eax,[rsi+rax*2]             ; x + y * 10
140006674:  movzx edx,BYTE PTR [rax+r14*1]  ; cell = maze[y*10 + x]
140006679:  cmp dl,r12b   ; r12b = 1        ; cell == 1 ?
14000667c:  je 0x14000677d                  ; hit a wall
140006686:  cmp dl,0x2                      ; cell == 2 ?
140006689:  jne 0x140006699
14000668b:  lea rax,[rcx-0x1] ; rcx = len   ; rax = len - 1
140006692:  cmp r15,rax                     ; i == last index ?
140006695:  cmove ebx,r12d                  ; won = 1 if on goal at the final move
```

Cell value `1` is a wall and ends the walk. Cell value `2` is the goal, and the `won` flag is set only when the goal is occupied on the last character of the input. That is the "finish the input key there" rule. The loop then advances.

```nasm
140006699:  inc r15
14000669c:  cmp r15,rcx ; jb 0x140006620    ; i < len
```

After the loop, three conditions must all hold.

```nasm
1400066a5:  test bl,bl  ; je 0x1400067f2    ; won == 1
1400066ad:  cmp esi,0x9 ; jne 0x1400067f2   ; x == 9
1400066b6:  cmp edi,esi ; jne 0x1400067f2   ; y == x, so y == 9
1400066be:  ...                             ; ACCESS GRANTED
```

The path must end on the goal cell on its last move and finish at `(9,9)`. The start cell `(0,0)` is never wall checked, since validation only inspects a cell after a move lands on it, which makes `(0,0)` the implicit start. Everything needed is now known except the grid itself.

## 5. The maze

The grid base came from the loop, `0x14002b3c0`. Read 100 bytes there and reshape to 10 rows of 10.

=== "Radare2"

    ```text
    [0x14000949c]> px 100 @ 0x14002b3c0
    - offset -   C0C1 C2C3 C4C5 C6C7 C8C9 CACB CCCD CECF  0123456789ABCDEF
    0x14002b3c0  0001 0101 0101 0101 0101 0000 0001 0000  ................
    0x14002b3d0  0000 0001 0101 0001 0001 0101 0001 0100  ................
    0x14002b3e0  0000 0001 0000 0001 0100 0101 0101 0001  ................
    0x14002b3f0  0101 0100 0000 0100 0000 0001 0101 0100  ................
    0x14002b400  0101 0101 0001 0100 0000 0000 0001 0001  ................
    0x14002b410  0100 0101 0101 0001 0000 0101 0101 0101  ................
    0x14002b420  0000 0002                                ....
    ```

=== "Objdump"

    ```console
    # maze base 0x14002b3c0 -> paddr 0x14002b3c0 - 0x140001200 = 0x2a1c0
    $ python3 -c "d=open('CFB2.exe','rb').read(); print(list(d[0x2a1c0:0x2a1c0+100]))"
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, ...]
    ```

Reshaped, with `.` for open, `#` for wall, `S` at the start and `G` at the goal, the maze is

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

## 6. Solving

The rules reduce to a shortest-path search on a 10x10 grid. Any route from `(0,0)` to `(9,9)` that avoids walls is accepted, and because the goal is the only cell that ends the walk successfully, ending there satisfies the "finish the key there" rule automatically. A breadth-first search reads the grid straight from the binary and returns the shortest path.

```python
#!/usr/bin/env python3
import sys
from collections import deque

MOVES = {"W": (0, -1), "S": (0, 1), "A": (-1, 0), "D": (1, 0)}

def load_maze(path):
    data = open(path, "rb").read()
    base = 0x2a1c0  # maze vaddr 0x14002b3c0 - .rdata delta 0x140001200
    cells = data[base:base + 100]
    return [list(cells[r * 10:(r + 1) * 10]) for r in range(10)]

def solve(maze):
    start, goal = (0, 0), (9, 9)
    queue = deque([(start, "")])
    seen = {start}
    while queue:
        (x, y), path = queue.popleft()
        if (x, y) == goal:
            return path
        for move, (dx, dy) in MOVES.items():
            nx, ny = x + dx, y + dy
            if 0 <= nx <= 9 and 0 <= ny <= 9 and maze[ny][nx] != 1 and (nx, ny) not in seen:
                seen.add((nx, ny))
                queue.append(((nx, ny), path + move))
    return None

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "CFB2.exe"
    print(solve(load_maze(path)))
```

```console
$ python3 solve.py CFB2.exe
SDDSSASSDDSSDDDSSDDD
```

Type that path at the prompt for `ACCESS GRANTED`.

## Appendix

| Address       | Meaning                                      |
| ------------- | -------------------------------------------- |
| `0x140006370` | `main`                                       |
| `0x140006607` | validation loop setup, `x`, `y`, `won`, `i`  |
| `0x140006619` | maze base load, `0x14002b3c0`                |
| `0x140006638` | move dispatch, `W` `A` `S` `D`               |
| `0x14000665a` | bounds check, unsigned `> 9`                 |
| `0x140006674` | cell read, `maze[y*10 + x]`                  |
| `0x140006695` | goal-at-final-step flag                      |
| `0x1400066a5` | win gate, `won` and `x == 9` and `y == 9`    |
| `0x14002b3c0` | maze grid, 100 bytes                         |
| `0x140010cc0` | `isspace`, used for trimming                 |
| `0x140010fe8` | `toupper`, applied to each move              |
