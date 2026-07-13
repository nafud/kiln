# CFB1

A crackmes.one keygen challenge. The expected serial is computed from the username at runtime and compared against the entered value. Cracking it means recovering that derivation and turning it into a keygen. This is done entirely statically, with no debugger and no execution.

| | |
|---|---|
| Source | [crackmes.one](https://crackmes.one/crackme/6a1547f42b3df128c1df5ca5){ .external-link } |
| Author | [CrackNotMe](https://crackmes.one/user/CrackNotMe){ .external-link } |
| Difficulty | 2.2 |
| Quality | 4.3 |
| Language | C/C++ |
| Platform | Windows |
| Arch | x86-64 |

| | |
|---|---|
| Target | `CFB1.exe` |
| Image base | `0x140000000` |
| SHA-256 | `2806a1d20c1cc2d1c1bcc7e2e3a90963ad990376ae52f3c0889a88dbd86eb311` |
| Method | Static analysis. No debugger. |

!!! tip "TL;DR"
    ```python
    def keygen(username):                       # username trimmed, len >= 4
        return "".join(f"{(((i+0x5A)&0xFF) ^ ord(c)) + 0x13 & 0xFF:02X}"
                       for i, c in enumerate(username))
    ```

    Example: `crackme` → `4C3C5051484518`.

---

## 1. Triage

```bash
$ file CFB1.exe
CFB1.exe: PE32+ executable (console) x86-64, for MS Windows, 6 sections
```

Sections and the offset↔VMA relation used throughout:

| Section | VMA | File offset |
|---------|-----|-------------|
| `.text` | `0x140001000` | `0x000400` |
| `.rdata` | `0x14002c000` | `0x02a800` |
| `.data` | `0x14003f000` | `0x03d600` |

For `.rdata`: `fileoff = 0x2a800 + (vma − 0x14002c000)`.

## 2. Strings: the checker's contract

```bash
$ strings -n 6 CFB1.exe
[+] Enter Username (min 4 chars):
[-] Error: Username is too short! Must be at least 4 characters.
[+] Enter Serial Key:
[*] Verifying key...
   [+] ACCESS GRANTED! Congratulations!
   [-] ACCESS DENIED! Invalid key.
```

This is a **username + serial keygen-me**: read a username (minimum 4 characters), read a serial, verify. The presence of `std::basic_stringstream` in the RTTI strings is an early hint that the expected serial is *formatted* (assembled digit by digit) rather than compared byte-for-byte against a stored constant.

## 3. Locating `main`

MSVC emits each string literal as a RIP-relative `lea`; `objdump` resolves the target in a comment. Grepping the disassembly for the verdict-string address band collapses to a single function:

```bash
$ objdump -d -M intel --no-show-raw-insn CFB1.exe > dis.txt
$ grep -nE '# 0x14002c[89a]' dis.txt
140007546: lea rdx,[rip+0x2535b]  # 0x14002c8a8   ; banner
14000758c: lea rdx,[rip+0x2534d]  # 0x14002c8e0   ; "Enter Username"
140007946: lea rdx,[rip+0x2503b]  # 0x14002c988   ; "Verifying key..."
1400079a5: lea rsi,[rip+0x2502c]  # 0x14002c9d8   ; ACCESS GRANTED
1400079b5: lea rsi,[rip+0x2508c]  # 0x14002ca48   ; ACCESS DENIED
```

All hits are inside the function at **`0x1400074d0`**, which is `main`.

## 4. Input handling (getline, SSO, trim, length gate)

Both inputs are read the same way: `std::getline(std::cin, s)` (the `'\n'` delimiter is passed as `mov dl,0xa` before the stream call), then whitespace-trimmed, then measured.

Two MSVC details generate most of the surrounding branch noise and are worth naming so they aren't mistaken for validation logic:

- **Small String Optimization.** Each `std::string` is 32 bytes on the stack: `{ data[16] / ptr, size, capacity }`. The username lives at `[rbp-0x39]` (size `[rbp-0x29]`, capacity `[rbp-0x21]`); the serial at `[rbp-0x59]` (size `[rbp-0x49]`, capacity `[rbp-0x41]`). The recurring idiom `cmp <cap>,0xf` / `cmova rax,<buf>` is just "is this string inline or heap-allocated?": when capacity ≤ 15 the buffer *is* the object, otherwise the data pointer is loaded.
- **Trim predicate.** The two scan loops call `0x1400117b0`, which indexes the locale ctype table and masks with `0x8` (the `_SPACE` bit), i.e. `isspace`. Leading and trailing whitespace is stripped before measuring.

The username length gate:

```asm
14000775d: cmp rsi,0x4              ; rsi = trimmed username length
140007761: jae 0x140007793         ; >= 4  -> continue to serial prompt
140007763: lea rdx,[rip+...]        ; # 0x14002c910  "... too short ..."
```

`jae` is unsigned: length ≥ 4 proceeds, otherwise it prints the error and exits. The **trimmed** username is what feeds the derivation.

## 5. The verification: derive, then compare

After the serial is read and trimmed, `main` prints `Verifying key...` and calls the derivation routine, passing the **username** in and receiving the expected serial in a fresh `std::string` at `[rbp-0x19]`:

```asm
14000795c: lea rdx,[rbp-0x39]       ; arg = username string
140007960: lea rcx,[rbp-0x19]       ; RVO out = expected-serial string
140007964: call 0x1400066e0         ; expected = derive(username)
```

The comparison that follows is a plain string equality: length first, then `memcmp`:

```asm
140007986: mov r8,QWORD PTR [rbp-0x49]  ; r8 = entered serial length
14000798a: cmp r8,QWORD PTR [rbp-0x9]   ; vs expected serial length
14000798e: jne 0x1400079ae             ; differ -> ACCESS DENIED
140007990: test r8,r8                   ; both empty -> accept
140007993: je  0x14000799e
140007995: call 0x1400297a0             ; memcmp(entered, expected, len)
14000799a: test eax,eax
14000799c: jne 0x1400079ae             ; nonzero -> ACCESS DENIED
14000799e: ...                          ; ACCESS GRANTED
```

The `memcmp` operands are resolved SSO-aware just above the call (`cmova` on each capacity). Because `memcmp` is byte-exact, the entered serial must match the derived one **including case**, and since the derivation emits uppercase hex (next section), a lowercase serial fails.

## 6. The derivation routine (`0x1400066e0`)

The routine constructs a `std::ostringstream` and appends two hex digits per username character. The core loop:

```asm
140006712: xor ebp,ebp                    ; i = 0   (rbp reused as counter)
; --- loop body ---
140006720: cmp QWORD PTR [rbx+0x18],0xf    ; SSO: capacity > 15 ?
140006725: jbe 0x14000672c
140006727: mov rcx,QWORD PTR [rbx]         ;   rcx = heap data ptr
14000672a: jmp 0x14000672f
14000672c: mov rcx,rbx                     ;   rcx = inline buffer
14000672f: lea eax,[rbp+0x5a]              ; eax = i + 0x5A
140006732: xor al,BYTE PTR [rcx+rbp*1]     ; al  = ((i+0x5A) & 0xFF) ^ username[i]
140006735: add al,0x13                     ; al  = al + 0x13
140006737: movzx edi,al                    ; edi = byte value (0..255)

; --- stream formatting flags (applied every iteration) ---
140006743: and DWORD PTR [rsp+rcx*1+0x58],0xfffff9ff  ; clear dec(0x200)|oct(0x400)
14000674b: or  DWORD PTR [rsp+rcx*1+0x58],0x800       ; set hex
14000675c: or  DWORD PTR [rsp+rcx*1+0x58],0x4         ; set uppercase
140006761: mov edx,0x2 ; ... width(2)                 ; setw(2)
140006797: mov BYTE PTR [rsp+rcx*1+0x98],0x30         ; fill '0'
14000679f: mov edx,edi ; call 0x140003b00             ; stream << (int)byte

1400067ab: inc rbp
1400067ae: cmp rbp,QWORD PTR [rbx+0x10]    ; i < username length ?
1400067b2: jb  0x140006720
```

The `ios_base::fmtflags` manipulation is exactly `stream << std::hex << std::uppercase << std::setw(2) << std::setfill('0')`: the `and 0xfffff9ff` clears the `dec` (`0x200`) and `oct` (`0x400`) bits of `basefield`, `or 0x800` sets `hex`, and `or 0x4` sets `uppercase`. Each byte (`0..255`) is inserted as an `int`, producing exactly two zero-padded uppercase hex digits.

So, for a username of length *n*, the serial is `2n` uppercase hex characters, where character *i* contributes:

```
b_i = ( ((i + 0x5A) & 0xFF) XOR username[i] + 0x13 ) & 0xFF
serial += "%02X" % b_i
```

Note the operator order fixed by the instructions: XOR first (`xor al,...`), then add (`add al,0x13`), all in 8-bit registers, so both the intermediate and the result are taken mod 256. The XOR key is position-dependent (`i + 0x5A`), which is why identical characters at different offsets map to different digits.

### Worked example: `test`

| i | char | `(i+0x5A)` | `⊕ char` | `+0x13` | out |
|---|------|-----------|----------|---------|-----|
| 0 | `t` 0x74 | 0x5A | 0x2E | 0x41 | `41` |
| 1 | `e` 0x65 | 0x5B | 0x3E | 0x51 | `51` |
| 2 | `s` 0x73 | 0x5C | 0x2F | 0x42 | `42` |
| 3 | `t` 0x74 | 0x5D | 0x29 | 0x3C | `3C` |

`test` → `4151423C`.

## 7. Keygen

```python
def keygen(username: str) -> str:
    username = username.strip()
    if len(username) < 4:
        raise ValueError("username must be >= 4 chars after trimming")
    out = []
    for i, ch in enumerate(username):
        b = (((i + 0x5A) & 0xFF) ^ (ord(ch) & 0xFF)) & 0xFF
        b = (b + 0x13) & 0xFF
        out.append(f"{b:02X}")
    return "".join(out)
```

Sample output:

| Username | Serial |
|---|---|
| `crackme` | `4C3C5051484518` |
| `pwn.by` | `3D3F45864F39` |
| `test` | `4151423C` |
| `reverse` | `3B513D4B3F3F18` |

## 8. Verification by reimplementation

Reproducing `main`'s exact accept condition (equal length, then byte-exact compare) confirms every generated pair:

```python
def verify(username, serial):
    expected = keygen(username)
    return len(serial) == len(expected) and serial == expected   # case-sensitive
```

Expected runtime behavior:

```
[+] Enter Username (min 4 chars): crackme
[+] Enter Serial Key: 4C3C5051484518
[*] Verifying key...

   [+] ACCESS GRANTED! Congratulations!
   You have successfully solved CFB1!
```

## 9. Summary

CFB1 is a username/serial keygen check. The program derives the expected serial from the trimmed username with a per character, position dependent transform and formats it as uppercase hex, then compares it to the entered serial. Recovering that transform yields a keygen for any username.

---

### Appendix: key addresses

| Address | Meaning |
|---|---|
| `0x1400074d0` | `main` |
| `0x14000775d` | username length gate (`>= 4`) |
| `0x140007964` | `call derive(username)` |
| `0x14000798a` | serial length compare |
| `0x140007995` | `memcmp(entered, expected)` |
| `0x14000799e` | ACCESS GRANTED branch |
| `0x1400066e0` | serial derivation routine |
| `0x14000672f`–`0x140006737` | core transform (`(i+0x5A) ^ c + 0x13`) |
| `0x1400117b0` | `isspace` (whitespace trim) |
