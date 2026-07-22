# CFB1

**Source:** [crackmes.one](https://crackmes.one/crackme/6a1547f42b3df128c1df5ca5){ .external-link }  
**Author:** [CrackNotMe](https://crackmes.one/user/CrackNotMe){ .external-link }  
**Difficulty:** 2.2  
**Quality:** 4.3  
**Language:** C/C++  
**Platform:** Windows  
**Arch:** x86-64

A crackmes.one keygen. There is no stored password to grep for. The program derives the expected serial from the username at runtime and compares it against what you type, so the work is to recover that derivation and reimplement it. The analysis below is static.

| | |
|---|---|
| Target | `CFB1.exe` |
| Image base | `0x140000000` |
| SHA-256 | `2806a1d20c1cc2d1c1bcc7e2e3a90963ad990376ae52f3c0889a88dbd86eb311` |
| Method | Static analysis. No debugger. |

!!! tip "TL;DR"
    For a username of length `n`, the serial is `2n` uppercase hex digits. For each character `c` at index `i` (0-based),

    ```text
    byte = (((i + 0x5A) ^ c) + 0x13) & 0xFF
    ```

    emitted as two uppercase hex digits. A complete keygen is in the [Keygen](#6-keygen) section.

## 1. Triage

A 64-bit MSVC console PE.

=== "Radare2"

    ```console
    $ rabin2 -I CFB1.exe
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

    $ rabin2 -S CFB1.exe
    [Sections]

    nth paddr          size vaddr          vsize perm type name
    ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    0   0x00000400  0x2a400 0x140001000  0x2b000 -r-x ---- .text
    1   0x0002a800  0x12e00 0x14002c000  0x13000 -r-- ---- .rdata
    2   0x0003d600   0x1400 0x14003f000   0x3000 -rw- ---- .data
    3   0x0003ea00   0x2600 0x140042000   0x3000 -r-- ---- .pdata
    4   0x00041000    0x200 0x140045000   0x1000 -rw- ---- .fptable
    5   0x00041200    0xa00 0x140046000   0x1000 -r-- ---- .reloc
    ```

=== "Objdump"

    ```console
    $ file CFB1.exe
    CFB1.exe: PE32+ executable (console) x86-64, for MS Windows, 6 sections

    $ objdump -h CFB1.exe
    Idx Name          Size      VMA               File off
      0 .text         0002a2b8  0000000140001000  00000400
      1 .rdata        00012c36  000000014002c000  0002a800
      2 .data         00001400  000000014003f000  0003d600
    ```

Strings live in the file at a **file offset** but the code refers to them by **virtual address**. Matching a string to the instruction that loads it means converting between the two. Each section lists both, and within a section they differ by a fixed delta, `delta = vaddr - paddr`. The strings sit in `.rdata`, so

```text
delta(.rdata) = 0x14002c000 - 0x2a800 = 0x140001800
vaddr = file_offset + 0x140001800
```

## 2. Strings

`strings` or `rabin2 -z` alone dumps everything, so filter for the program's own markers.

=== "Radare2"

    ```console
    $ rabin2 -z CFB1.exe | grep '\['
    nth paddr      vaddr       len size section type  string
    15  0x0002b038 0x14002c838 51  52   .rdata ascii [+] by pwn.by [+]
    18  0x0002b0e0 0x14002c8e0 34  35   .rdata ascii [+] Enter Username (min 4 chars):
    19  0x0002b110 0x14002c910 65  66   .rdata ascii [-] Error: Username is too short! Must be at least 4 characters.
    21  0x0002b170 0x14002c970 22  23   .rdata ascii [+] Enter Serial Key:
    22  0x0002b188 0x14002c988 21  22   .rdata ascii \n[*] Verifying key...
    24  0x0002b1d8 0x14002c9d8 52  53   .rdata ascii    [+] ACCESS GRANTED! Congratulations!
    26  0x0002b248 0x14002ca48 52  53   .rdata ascii    [-] ACCESS DENIED! Invalid key.

    $ rabin2 -z CFB1.exe | grep basic_stringstream
    1460 0x0003e6b0 0x1400400b0 71 72 .data ascii .?AV?$basic_stringstream@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@
    ```

=== "Objdump"

    ```console
    $ strings -n 6 CFB1.exe | grep -E '\[[-+*]\]'
               [+] by pwn.by [+]
    [+] Enter Username (min 4 chars):
    [-] Error: Username is too short! Must be at least 4 characters.
    [+] Enter Serial Key:
    [*] Verifying key...
       [+] ACCESS GRANTED! Congratulations!
       [-] ACCESS DENIED! Invalid key.

    $ strings CFB1.exe | grep basic_stringstream
    .?AV?$basic_stringstream@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@
    ```

That is the whole contract. Ask for a username of at least four characters, ask for a serial, verify, print one of two verdicts. No serial is stored, which means it is computed.

The RTTI name is worth pulling out. RTTI, or Run-Time Type Information, is data the MSVC compiler emits so a program can identify an object's type while running, which is what `typeid` and `dynamic_cast` rely on. Each polymorphic class leaves its mangled type name in the binary, which is why the pretty name `std::basic_stringstream` finds nothing while the mangled `.?AV?$basic_stringstream@...` does. Seeing a `stringstream` means the expected serial is built through a formatting step rather than compared against a fixed constant, which turns out to be hex. Next, find where these strings are used.

## 3. Locating main

Take the `[+] Enter Username` prompt and find the instruction that loads it.

=== "Radare2"

    ```console
    $ r2 -A CFB1.exe
    [0x140009f8c]> izz~Enter Username
    3439 0x0002b0e0 0x14002c8e0 34 35 .rdata ascii [+] Enter Username (min 4 chars):
    [0x140009f8c]> axt 0x14002c8e0
    main 0x14000758c [DATA:r--] lea rdx, str.___Enter_Username__min_4_chars_:
    [0x140009f8c]> pdf @ main
    ┌ 1605: int main (int argc, char **argv, char **envp);
    │           0x1400074d0      push rbp
    │           0x1400074d2      push rbx
    │           ...
    ```

    r2's analysis (`-A`) resolves the cross-reference into the named function `main` and draws its bounds, so the entry at `0x1400074d0` is given directly. No manual prologue hunt is needed.

=== "Objdump"

    ```console
    $ python3 -c "d=open('CFB1.exe','rb').read(); print(hex(d.find(b'[+] Enter Username')))"
    0x2b0e0

    # convert with the delta from Triage: 0x2b0e0 + 0x140001800 = 0x14002c8e0

    $ objdump -d -M intel --no-show-raw-insn CFB1.exe > dis.txt
    $ grep '# 0x14002c8e0' dis.txt
    14000758c:  lea rdx,[rip+0x2534d]        # 0x14002c8e0
    ```

    That instruction is inside a function. Read upward in `dis.txt` to the prologue. MSVC pads the gap between functions with `int3`, so the first instruction after the padding is the entry point.

    ```nasm
    1400074c7:  ret
    1400074c8:  int3            ; padding between functions
    ...
    1400074d0:  rex push rbp    ; prologue starts here
    1400074d2:  push rbx
    ```
    (objdump prints the REX-prefixed encoding as `rex push rbp`.)

Either way, `main` starts at `0x1400074d0`. Read it from there.

## 4. Reading main

Print the function with `pdf @ main` in the r2 session, or read `dis.txt` around `0x1400074d0`. The listings below are trimmed to the relevant instructions. r2 renders local variables as names like `var_39h` for `[rbp-0x39]`; both forms refer to the same stack slots.

`main` runs four steps in order. Read the username, read the serial, derive the expected serial from the username, compare. Two MSVC patterns appear repeatedly and are noted once here for reference.

Storage. An MSVC `std::string` is a 32-byte object with a 16-byte inline buffer, a size, and a capacity. Text of 15 bytes or fewer lives in the inline buffer. Longer text moves to the heap and the first field becomes a pointer. The pattern `cmp <capacity>, 0xf` followed by a `cmova` selects between the inline buffer and the heap pointer. These instructions manage the string object and are not part of the validation.

Input. Each field is read with `std::getline(std::cin, s)` and then trimmed. The trim calls `0x1400117b0`, which indexes the locale table and masks with `0x8`, the whitespace bit, so it is `isspace`.

After the username is read and trimmed, its length is checked.

```nasm
14000775d:  cmp rsi,0x4             ; rsi = trimmed username length
140007761:  jae 0x140007793        ; length >= 4 continues
140007763:  lea rdx,[rip+...]      ; # 0x14002c910  "... too short ..."
```

The gate is on the trimmed length, so trailing spaces do not help reach four characters. A long enough username falls through to the serial prompt, read and trimmed the same way. Then the core. The username is passed to the derivation routine and the result is written to a fresh string.

```nasm
14000795c:  lea rdx,[rbp-0x39]     ; rdx = username
140007960:  lea rcx,[rbp-0x19]     ; rcx = output string for the expected serial
140007964:  call 0x1400066e0       ; expected = derive(username)
```

The comparison checks length first, then bytes.

```nasm
140007986:  mov r8,[rbp-0x49]      ; length of the entered serial
14000798a:  cmp r8,[rbp-0x9]       ; length of the expected serial
14000798e:  jne 0x1400079ae        ; different length, ACCESS DENIED
140007995:  call 0x1400297a0       ; compare
14000799a:  test eax,eax
14000799c:  jne 0x1400079ae        ; any mismatch, ACCESS DENIED
14000799e:  ...                    ; equal, ACCESS GRANTED
```

`0x1400297a0` takes two pointers and a length and returns zero only when every byte matches, which is `memcmp`. The compare is exact and case sensitive. The one routine left to read is `derive` at `0x1400066e0`.

## 5. The derivation routine

`derive` takes the username and returns the expected serial. It creates a `std::stringstream` and appends to it one character at a time, so reading a single iteration is enough. This function reuses `rbp` as the loop index `i` rather than as a frame pointer.

```nasm
140006712:  xor ebp,ebp                    ; i = 0
```

The body loads `username[i]` (the `cmp ...,0xf` here is the inline-or-heap selection from the previous section) and transforms it.

```nasm
14000672f:  lea eax,[rbp+0x5a]             ; eax = i + 0x5A
140006732:  xor al,BYTE PTR [rcx+rbp*1]    ; al = ((i + 0x5A) & 0xFF) ^ username[i]
140006735:  add al,0x13                    ; al = (al + 0x13) & 0xFF
140006737:  movzx edi,al                   ; edi = the byte, 0..255
```

Each character becomes one byte through a position dependent XOR and an add. The key is `i + 0x5A`, so the same letter maps to different output at different positions. Everything is byte wide, so the key and the result wrap at 8 bits.

The rest of the body formats that byte and appends it. The format-flags field of the stream, written at `[rsp+rcx*1+0x58]`, gets the hex and uppercase bits, the field width is set to two, and the fill character is set to `'0'`, then the byte is inserted as an integer.

```nasm
14000674b:  or DWORD PTR [rsp+rcx*1+0x58],0x800   ; hex
14000675c:  or DWORD PTR [rsp+rcx*1+0x58],0x4     ; uppercase
140006761:  mov edx,0x2                           ; field width = 2
140006797:  mov BYTE PTR [...],0x30               ; fill '0'
1400067a6:  call 0x140003b00                      ; stream << (int)byte
```

Width and fill are reissued every iteration because `setw` only affects the next insertion. The effect is that each byte prints as exactly two uppercase hex digits. The loop advances until `i` reaches the username length.

```nasm
1400067ab:  inc rbp
1400067ae:  cmp rbp,[rbx+0x10]             ; i < length ?
1400067b2:  jb 0x140006720
```

So character `i` produces

```text
byte = (((i + 0x5A) ^ username[i]) + 0x13) & 0xFF
serial += "%02X" % byte
```

and the serial is those two-digit groups joined, twice the username length. Working `test` by hand confirms it.

| i | char | i + 0x5A | ^ char | + 0x13 | out |
|---|------|----------|--------|--------|-----|
| 0 | `t` 0x74 | 0x5A | 0x2E | 0x41 | `41` |
| 1 | `e` 0x65 | 0x5B | 0x3E | 0x51 | `51` |
| 2 | `s` 0x73 | 0x5C | 0x2F | 0x42 | `42` |
| 3 | `t` 0x74 | 0x5D | 0x29 | 0x3C | `3C` |

## 6. Keygen

Complete script. Save as `keygen.py`. It assumes an ASCII username, matching the byte-wise reads in the routine.

```python
#!/usr/bin/env python3
import sys

def keygen(username):
    username = username.strip()
    if len(username) < 4:
        raise SystemExit("username must be at least 4 characters")
    out = []
    for i, ch in enumerate(username):
        byte = (((i + 0x5A) ^ ord(ch)) + 0x13) & 0xFF
        out.append("%02X" % byte)
    return "".join(out)

if __name__ == "__main__":
    name = (sys.argv[1] if len(sys.argv) > 1 else "crackme").strip()
    print(name, keygen(name))
```

<div class="kiln-widget" data-widget="cfb1-keygen"></div>

Type the username and its serial into the program for `ACCESS GRANTED`.

## Appendix

| Address       | Meaning                                 |
| ------------- | --------------------------------------- |
| `0x1400074d0` | `main`                                  |
| `0x14000775d` | username length gate, at least 4        |
| `0x140007964` | call to `derive(username)`              |
| `0x14000798a` | serial length compare                   |
| `0x140007995` | `memcmp(entered, expected)`             |
| `0x14000799e` | ACCESS GRANTED branch                   |
| `0x1400066e0` | serial derivation routine               |
| `0x14000672f` | core transform, `(i + 0x5A) ^ c + 0x13` |
| `0x1400117b0` | `isspace`, used for trimming            |
