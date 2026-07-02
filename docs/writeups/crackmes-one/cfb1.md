# CFB1 — pwn.by

**Platform:** Windows x86-64  
**Difficulty:** Easy  
**Author:** pwn.by / pwned.space  
**Source:** [crackmes.one](https://crackmes.one)

A serial-based crackme. The program takes a username (minimum 4 characters) and a serial key, then validates the key against a value derived from the username. The goal is to understand the derivation algorithm and generate a valid key for any username.

---

## Initial Recon

### File type

```bash
file CFB1.exe
```

```text
CFB1.exe: PE32+ executable (console) x86-64, for MS Windows, 6 sections
```

64-bit Windows PE, console application. No packer signature or anything unusual in the header.

### String analysis

```bash
strings CFB1.exe | grep -iE "enter|key|granted|denied|error|username|serial"
```

```text
[+] Enter Username (min 4 chars): 
[-] Error: Username is too short! Must be at least 4 characters.
[+] Enter Serial Key: 
[*] Verifying key...
   [+] ACCESS GRANTED! Congratulations!
   You have successfully solved CFB1!
   [-] ACCESS DENIED! Invalid key.
   Keep reversing and try again!
```

Key takeaways:

- Two inputs: username (≥ 4 chars) and a serial key.
- The "verifying key" message suggests no anti-debug tricks — it runs the check in one shot.
- No hardcoded serial visible. The key is computed at runtime, likely from the username.

---

## Static Analysis with radare2

### Loading and analyzing

```bash
r2 -A CFB1.exe
```

`-A` (`aaa` internally) runs recursive analysis: it disassembles all reachable code, identifies functions, resolves calls, and names known library stubs. This is the starting point for any static session.

### Listing functions

```
[0x140009f8c]> afl
```

```text
0x140009f8c   22 398  -> 373  entry0
0x1400074d0   79 1605         main
0x1400066e0    9 405          fcn.1400066e0
0x140001580    ...            fcn.140001580
...
```

`afl` (Analyze Functions List) prints every function radare2 found, with its address, basic-block count, size, and name. `entry0` is the CRT entry point; `main` is 1605 bytes — large enough to hold all the program logic in one function. `fcn.1400066e0` is a 405-byte function called from main; it will turn out to be the serial generator.

### Disassembling main

```
[0x140009f8c]> pdf @main
```

`pdf` (Print Disassembly of Function) renders the full function at the given address with arrows for branches and cross-references. The address `main` resolves to `0x1400074d0`.

---

## Tracing Control Flow in main

`main` is a straight-line function with a few branches. Working top-to-bottom:

**1. Banner printing** — several `call fcn.140001220` with string literals passed in `rdx`. This is a C++ stream write (`operator<<`). Purely cosmetic.

**2. Username input and trimming:**

```asm
lea rdx, str.___Enter_Username__min_4_chars_:_
call fcn.140001220              ; print prompt

call fcn.140002780              ; getline into var_39h (username string)

; --- trim leading whitespace ---
0x140007650  movzx ecx, byte [rdi]
0x140007653  call fcn.1400117b0  ; isspace()
0x140007658  test eax, eax
0x14000765a  je 0x140007664
0x14000765c  inc rdi
0x14000765f  cmp rdi, rbx
0x140007662  jne 0x140007650

; --- trim trailing whitespace ---
0x1400076f0  lea rdi, [rbx - 1]
0x1400076f4  movzx ecx, byte [rdi]
0x1400076f7  call fcn.1400117b0  ; isspace()
...
```

`fcn.1400117b0` is `isspace()`. Both leading and trailing spaces are stripped from the username before the length check.

**3. Length check:**

```asm
0x140007756  lea rcx, [0x140040770]
0x14000775d  cmp rsi, 4          ; compare trimmed length with 4
0x140007761  jae 0x140007793     ; ok if >= 4
0x140007763  lea rdx, str.____Error:_Username_is_too_short_...
             ; print error and exit
```

The trimmed length must be at least 4. If not, the program exits immediately.

**4. Serial key input** — identical to the username input: getline, trim leading/trailing whitespace, store in `var_59h`.

**5. Key generation and comparison:**

```asm
0x140007957  call fcn.140001220       ; print "[*] Verifying key..."

0x140007964  lea rdx, [var_39h]       ; arg2 = username string
0x140007960  lea rcx, [var_19h]       ; arg1 = output buffer
0x140007964  call fcn.1400066e0       ; GENERATE expected serial → var_19h

; compare lengths first
0x14000798a  cmp r8, qword [var_9h]   ; user-entered length vs expected length
0x14000798e  jne ACCESS_DENIED

; if length is zero, skip memcmp (vacuously equal)
0x140007993  je ACCESS_GRANTED

; compare bytes
0x140007995  call fcn.1400297a0       ; memcmp(expected, user_serial, len)
0x14000799c  test eax, eax
0x14000799e  je ACCESS_GRANTED
             jmp ACCESS_DENIED
```

`fcn.1400297a0` is a hand-optimised `memcmp` (aligns to 8-byte boundaries, then compares 8 bytes at a time). Returned zero means equal. The comparison is **case-sensitive, character-exact** — there is no normalisation after the trim.

The critical function is `fcn.1400066e0`. Everything depends on what it computes.

---

## Key Generation: fcn.1400066e0

### Inspecting the function

```
[0x140009f8c]> pdf @fcn.1400066e0
```

The function signature (reconstructed):

```c
void generate_serial(std::string *output, const std::string *username);
```

`rcx` → output buffer, `rdx` → username. The function initialises a `std::ostringstream`, iterates over every character in the username, applies a transformation to each one, and appends the result to the stream. At the end, it calls `str()` and copies the result into `output`.

### The transformation loop

```asm
0x140006712  xor ebp, ebp              ; rbp = loop counter i = 0
0x140006714  cmp qword [rbx + 0x10], rbp
0x140006718  jbe EXIT                  ; exit if username.length() == 0

LOOP:
0x140006720  cmp qword [rbx + 0x18], 0xf
0x140006725  jbe SHORT_STRING
0x140006727  mov rcx, qword [rbx]      ; long string: rcx = ptr to heap buffer
0x14000672a  jmp GOT_PTR
SHORT_STRING:
0x14000672c  mov rcx, rbx             ; short string: rcx = ptr to SSO buffer
GOT_PTR:
0x14000672f  lea eax, [rbp + 0x5a]    ; eax  = i + 0x5A
0x140006732  xor al, byte [rcx + rbp] ; al  ^= username[i]
0x140006735  add al, 0x13             ; al  += 0x13
0x140006737  movzx edi, al            ; edi  = (uint8_t) result

; ... format edi and append to stream ...

0x1400067ab  inc rbp                  ; i++
0x1400067ae  cmp rbp, qword [rbx + 0x10]
0x1400067b2  jb LOOP                  ; continue while i < length
```

Three instructions do all the mathematical work:

| Instruction | Operation |
|---|---|
| `lea eax, [rbp + 0x5a]` | `eax = i + 0x5A` (the loop index offset by 90) |
| `xor al, byte [rcx + rbp]` | XOR the low byte with the character at position i |
| `add al, 0x13` | add 19, wrapping in 8-bit |

The `movzx edi, al` zero-extends the 8-bit result into a 32-bit register for the formatter, discarding the upper bits of `eax`. The arithmetic is entirely modulo 256.

!!! note "SSO branch"
    The `cmp qword [rbx + 0x18], 0xf` / `jbe` pair is the MSVC Small String Optimisation check. If the string length ≤ 15, the characters live in the object itself (`rbx`); otherwise they live in a heap-allocated buffer pointed to by `[rbx]`. The actual character data is always reached via `rcx + rbp`.

### Detecting the output format

Before calling the stream's `operator<<`, the code sets three things:

```asm
; 1. Set hex flag: clear dec (0x200) and oct (0x400), set hex (0x800)
0x140006743  and dword [rsp + rcx + 0x58], 0xfffff9ff   ; ~(dec|oct)
0x14000674b  or  dword [rsp + rcx + 0x58], 0x800        ; hex

; 2. Set uppercase flag (0x004)
0x14000675c  or  dword [rsp + rcx + 0x58], 4

; 3. setw(2) — call the setw manipulator with width = 2
0x140006761  mov edx, 2
0x140006766  lea rcx, [var_130h]
0x14000676e  call fcn.1400087e8        ; stores width=2 in the manipulator object

; 4. Set fill character to '0' (0x30)
0x140006797  mov byte [rsp + rcx + 0x98], 0x30
```

The MSVC `ios_base` format flag layout (relevant bits):

| Flag | Value | Meaning |
|---|---|---|
| `uppercase` | `0x0004` | uppercase hex digits A–F |
| `dec` | `0x0200` | decimal base |
| `oct` | `0x0400` | octal base |
| `hex` | `0x0800` | hexadecimal base |

Clearing `dec|oct` and setting `hex` switches the stream to hexadecimal. Setting `uppercase` makes the digits A–F. `setw(2)` with fill `'0'` zero-pads to exactly 2 characters.

Each byte value is therefore formatted as **2-digit zero-padded uppercase hexadecimal**.

`fcn.1400087e8` confirms `setw`:

```
[0x140009f8c]> pdf @fcn.1400087e8
```

```asm
; 18-byte function
0x1400087e8  lea rax, [0x1400087fc]   ; vtable pointer for setw manipulator
0x1400087ef  mov qword [rcx + 8], rdx ; store width (2) at offset 8
0x1400087f3  mov qword [rcx], rax     ; store vtable
0x1400087f6  mov rax, rcx
0x1400087f9  ret
```

It simply constructs a `setw` object with `width = 2`.

---

## The Algorithm

Putting it together:

```
for i = 0 to len(username) - 1:
    value = ( (i + 0x5A) XOR ord(username[i]) ) + 0x13   (mod 256)
    serial += format(value, "02X")
```

In pseudocode with Python types:

```python
serial = ""
for i, c in enumerate(username):
    val = ((i + 0x5A) ^ ord(c)) + 0x13
    serial += format(val & 0xFF, '02X')
```

The key is always exactly `2 * len(username)` characters long and consists only of hex digits `0–9, A–F`.

---

## Keygen

```python
#!/usr/bin/env python3
"""
CFB1.exe keygen — pwn.by / crackmes.one

Algorithm (reversed from fcn.1400066e0):
  serial = ""
  for i, c in enumerate(username):
      val = ((i + 0x5A) ^ ord(c)) + 0x13
      serial += format(val & 0xFF, '02X')
"""

import sys

def generate_serial(username: str) -> str:
    serial = ""
    for i, c in enumerate(username):
        val = ((i + 0x5A) ^ ord(c)) + 0x13
        serial += format(val & 0xFF, '02X')
    return serial

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: keygen.py <username>")
        sys.exit(1)
    name = sys.argv[1]
    if len(name) < 4:
        print("Error: username must be at least 4 characters")
        sys.exit(1)
    print(f"Username : {name}")
    print(f"Serial   : {generate_serial(name)}")
```

Example outputs:

| Username | Serial |
|---|---|
| `test` | `4151423C` |
| `admin` | `4E52444743` |
| `angmar` | `4E5244474552` |

---

## Verification

Run the keygen, then pass the result to the crackme:

```bash
python3 keygen.py test
```

```text
Username : test
Serial   : 4151423C
```

```bash
wine CFB1.exe
```

```text
===================================================
            Crackme #1
           [+] by pwn.by [+]
         --> pwned.space <--
===================================================

[+] Enter Username (min 4 chars): test
[+] Enter Serial Key: 4151423C
[*] Verifying key...

===================================================
   [+] ACCESS GRANTED! Congratulations!
   You have successfully solved CFB1!
===================================================
```

---

## Summary

| What | Detail |
|---|---|
| Binary | PE32+ x86-64 console, no packer |
| Input | Username (≥ 4 chars) + serial key |
| Keygen function | `fcn.1400066e0` at `0x1400066e0` |
| Algorithm | `((i + 0x5A) ^ char) + 0x13` per character |
| Output format | 2-digit uppercase hex per byte, concatenated |
| Key length | `2 × len(username)` characters |
| Tools used | radare2 (`r2 -A`, `afl`, `pdf`) |
