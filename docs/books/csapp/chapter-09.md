# Chapter 9. Virtual Memory

Virtual memory (VM) is an abstraction of main memory built from hardware exceptions, hardware address translation, main memory, disk files, and kernel software. It gives each process a large, uniform, private address space and provides three capabilities:

1. **Caching** — treats main memory as a cache for an address space stored on disk; only active areas reside in DRAM.
2. **Memory management** — gives every process a uniform address space.
3. **Protection** — isolates each process's address space from corruption by others.

## 9.1 Physical and Virtual Addressing

- Main memory: array of M contiguous byte-size cells; each byte has a unique **physical address (PA)** starting at 0.
- **Physical addressing**: CPU uses PAs directly. Used by early PCs, DSPs, embedded microcontrollers, Cray supercomputers.
- **Virtual addressing**: CPU generates a **virtual address (VA)**, converted to a PA before reaching main memory. The conversion is **address translation**, performed on the fly by the **memory management unit (MMU)** on the CPU chip, using a lookup table in main memory managed by the OS.

## 9.2 Address Spaces

- An **address space** is an ordered set of nonnegative integer addresses; **linear** if consecutive (assumed throughout).
- **Virtual address space**: N = 2ⁿ addresses {0, …, N−1}; an *n-bit* address space. Modern systems: 32- or 64-bit.
- **Physical address space**: {0, …, M−1} for M bytes of physical memory; assume M = 2ᵐ.
- Key idea: each byte of main memory has a VA from the virtual address space *and* a PA from the physical address space — one data object, multiple independent addresses.

## 9.3 VM as a Tool for Caching

- Virtual memory: array of N contiguous byte-size cells on disk, cached in DRAM.
- Transfer unit: **virtual pages (VPs)** of P = 2ᵖ bytes; physical memory partitioned into **physical pages (PPs)** (**page frames**) of the same size.
- Every virtual page is in exactly one state:

| State | Meaning | Disk space used? |
|---|---|---|
| Unallocated | Not yet created by the VM system | No |
| Cached | Allocated, resident in DRAM | Yes |
| Uncached | Allocated, not resident in DRAM | Yes |

### 9.3.1 DRAM Cache Organization

- Terminology: **SRAM cache** = L1/L2/L3; **DRAM cache** = VM's page cache in main memory.
- DRAM ≈ 10× slower than SRAM; disk ≈ 100,000× slower than DRAM; first byte of a disk sector ≈ 100,000× slower than successive bytes. Misses served from disk are enormously expensive, which drives the whole design:
  - Pages are large: 4 KB–2 MB.
  - Fully associative — any VP can go in any PP.
  - Sophisticated OS replacement algorithms (vs. simple hardware policies for SRAM).
  - Always write-back, never write-through.

### 9.3.2 Page Tables

- A **page table** in physical memory maps virtual pages to physical pages: an array of **page table entries (PTEs)**, one per virtual page at a fixed offset.
- PTE (simplified) = valid bit + n-bit address field:
  - valid = 1: address = start of the PP caching this VP.
  - valid = 0, address null: VP unallocated.
  - valid = 0, address non-null: VP's location on disk.
- Translation hardware reads the page table on every translation; the OS maintains its contents and moves pages between disk and DRAM.

### 9.3.3 Page Hits

Reference to a word in a cached VP: hardware uses the VA to locate the PTE, sees valid = 1, and uses the PTE's physical address to build the word's PA. Handled entirely in hardware.

### 9.3.4 Page Faults

- **Page fault** = DRAM cache miss. Hardware reads the PTE, sees valid = 0, triggers a page fault exception → kernel handler:
  1. Selects a victim page; writes it to disk if modified; marks its PTE not cached.
  2. Copies the requested page from disk into the freed PP; updates its PTE.
  3. Returns, restarting the faulting instruction, which now hits.
- VM terminology: blocks = **pages**; transferring pages = **swapping**/**paging** (swapped/paged in and out).
- **Demand paging**: wait until a miss to swap a page in. All modern systems use it.

### 9.3.5 Allocating Pages

`malloc`-style allocation of a new VP: create room on disk and point the PTE at it. No physical memory is involved until the page is first touched.

### 9.3.6 Locality to the Rescue

- Programs tend to work on a **working set** (**resident set**) of active pages. After the initial overhead of paging it in, references hit with no further disk traffic.
- If the working set exceeds physical memory: **thrashing** — pages swap in and out continuously. When a program crawls, suspect thrashing.

## 9.4 VM as a Tool for Memory Management

- The OS keeps a **separate page table — hence a separate virtual address space — per process**. Multiple VPs (from different processes) can map to the same shared PP.
- Some early systems (DEC PDP-11/70) had virtual address spaces *smaller* than physical memory; VM was still valuable for management and protection.
- Consequences:
  - **Simplifies linking**: every process uses the same memory-image format regardless of physical placement (64-bit Linux: code segment starts at 0x400000, data follows after an alignment gap, stack at the top of the user space).
  - **Simplifies loading**: the loader allocates VPs for code/data areas, marks them invalid, and points PTEs into the object file — no copying; pages fault in on first reference. Mapping contiguous VPs to an arbitrary file location = **memory mapping** (`mmap`).
  - **Simplifies sharing**: map different processes' VPs to the same PPs (kernel code, C standard library).
  - **Simplifies allocation**: k contiguous *virtual* pages can map to k *arbitrary* physical pages; no contiguity needed in DRAM.

## 9.5 VM as a Tool for Memory Protection

- Permission bits added to each PTE, checked on every translation. Example scheme:
  - **SUP**: page requires kernel (supervisor) mode.
  - **READ**, **WRITE**: read/write access control.
- A violating instruction triggers a general protection fault → kernel sends SIGSEGV to the process. Reported by Linux shells as a "segmentation fault."

## 9.6 Address Translation

Symbols:

| VA component | | PA component | |
|---|---|---|---|
| VPO | virtual page offset (bytes) | PPO | physical page offset (bytes) |
| VPN | virtual page number | PPN | physical page number |
| TLBI | TLB index | CO | byte offset within cache block |
| TLBT | TLB tag | CI | cache index |
| | | CT | cache tag |

- Formally: MAP: VAS → PAS ∪ ∅; MAP(A) = A′ if the data at VA A is at PA A′, else ∅.
- **PTBR** (page table base register) points to the current page table.
- n-bit VA = (n−p)-bit **VPN** ∥ p-bit **VPO**. VPN indexes the page table (VPN 0 → PTE 0, …). PA = **PPN** (from PTE) ∥ **VPO**. Since pages are P bytes on both sides, **PPO = VPO**.

**Page hit (all hardware):**
1. CPU sends VA to MMU.
2. MMU computes the PTE address (PTEA) and requests it from cache/main memory.
3. Cache/main memory returns the PTE.
4. MMU builds the PA and sends it to cache/main memory.
5. Cache/main memory returns the data word to the CPU.

**Page fault (hardware + kernel):**
1–3. Same as above.
4. Valid bit = 0 → MMU triggers an exception; control transfers to the kernel's page fault handler.
5. Handler picks a victim PP; pages it out to disk if modified.
6. Handler pages in the new page; updates the PTE.
7. Handler returns; the faulting instruction restarts and now takes the page-hit path.

### 9.6.1 Integrating Caches and VM

Most systems use **physically addressed** SRAM caches: translation happens before cache lookup. This lets processes share cache blocks without aliasing problems, and moves protection checks into translation. PTEs are cached like any other data.

### 9.6.2 TLB

- Worst-case PTE fetch costs tens–hundreds of cycles from memory (a few from L1). The **translation lookaside buffer (TLB)** — a small, virtually addressed cache inside the MMU, one PTE per line, high associativity — usually eliminates even that.
- With T = 2ᵗ sets: **TLBI** = t low-order bits of the VPN; **TLBT** = remaining VPN bits.

**TLB hit (all steps inside the on-chip MMU — fast):**
1. CPU generates a VA.
2–3. MMU fetches the PTE from the TLB.
4. MMU translates and sends the PA to cache/main memory.
5. Cache/main memory returns the data word.

**TLB miss:** MMU fetches the PTE from the L1 cache (or memory); the fetched PTE is stored in the TLB, possibly evicting an entry.

### 9.6.3 Multi-Level Page Tables

- Single-level problem: 32-bit space, 4 KB pages, 4-byte PTEs → 4 MB page table always resident; far worse for 64-bit.
- **Hierarchy** (2-level example, 32-bit/4 KB/4-byte PTEs):
  - Each level-1 PTE covers a 4 MB chunk (1,024 pages); 1,024 L1 PTEs cover the 4 GB space.
  - L1 PTE = null if its whole chunk is unallocated; else points to a level-2 page table whose PTEs each map one 4 KB page.
  - Each L1/L2 table is 4-byte × 1,024 = 4 KB = exactly one page.
- Savings: (1) null L1 PTE → the L2 table need not exist (most of a typical address space is unallocated); (2) only the L1 table must stay resident — L2 tables are paged in/out on demand.
- k-level translation: VA = VPN₁ ∥ … ∥ VPNₖ ∥ VPO; VPNᵢ indexes the level-i table; level-j PTEs (j < k) point to level-(j+1) tables; level-k PTEs hold a PPN or disk address. PA = PPN ∥ VPO (PPO = VPO). The MMU must access k PTEs, but the TLB caches PTEs from all levels, so in practice multi-level translation is not significantly slower than single-level.

### 9.6.4 End-to-End Example

Assumptions: byte-addressable, 1-byte accesses, n = 14, m = 12, P = 64 (so VPO/PPO = 6 bits, VPN = 8 bits, PPN = 6 bits); TLB: 4-way set associative, 16 entries (4 sets → TLBI = 2 low VPN bits, TLBT = 6 high VPN bits); L1 d-cache: physically addressed, direct-mapped, 4-byte lines, 16 sets (CO = 2 bits, CI = 4 bits, CT = 6 bits).

Load of byte at VA 0x03d4:
1. VA 0x03d4 = 00 0011 1101 0100₂ → VPN = 0x0F, VPO = 0x14, TLBI = 0x3, TLBT = 0x03.
2. TLB hit in set 0x3 → PPN = 0x0D.
3. PA = PPN ∥ VPO = 0x354.
4. PA 0x354 → CO = 0x0, CI = 0x5, CT = 0x0D. Cache hit → byte 0x36 returned.

Other paths: TLB miss → fetch PTE from the page table; invalid PTE → page fault; valid PTE but cache miss → fetch block from memory.

## 9.7 Case Study: Intel Core i7 / Linux

- Haswell allows full 64-bit spaces; implementations support **48-bit (256 TB) virtual** and **52-bit (4 PB) physical** address spaces (plus a 32-bit compatibility mode).
- Per core: L1 i-TLB 128 entries / L1 d-TLB 64 entries (both 4-way); L2 unified TLB 512 entries, 4-way; L1 i/d caches 32 KB, 8-way; L2 256 KB, 8-way. Shared: L3 8 MB, 16-way; DDR3 memory controller. Caches physically addressed, 64-byte blocks. Page size: 4 KB or 4 MB (configured at startup); Linux uses 4 KB.

### 9.7.1 Core i7 Address Translation

- **Four-level** page table hierarchy; one hierarchy per process. Page tables of allocated pages are memory-resident while the process runs (architecture permits swapping them).
- **CR3** holds the physical address of the L1 table; part of the process context, restored on context switch.
- 36-bit VPN split into four 9-bit chunks, each indexing one level. Reach per entry: L1 PTE = 512 GB, L2 = 1 GB, L3 = 2 MB, L4 = 4 KB page. PPN = 40 bits, PPO = VPO = 12 bits.
- Level 1–3 PTE fields (P = 1 always under Linux): P (child table present), R/W and U/S (permissions for all reachable pages), WT, CD (cache policy for child table), A (reference bit, set by MMU, cleared by software), PS (4 KB vs. 4 MB pages; L1 only), 40-bit base address of the child table (forces 4 KB alignment), XD (disable instruction fetch from reachable pages).
- Level 4 PTE additionally: **D** (dirty bit, set by MMU on writes) and **G** (global — don't evict from TLB on task switch); base address points to a 4 KB physical page.
- Permission bits: R/W (read-only vs. read/write), U/S (user vs. kernel-only), XD (no-execute — lets the kernel restrict execution to the code segment, mitigating buffer-overflow attacks).
- A and D bits support the kernel's replacement policy and write-back decision; cleared via a kernel-mode instruction.
- Cache/VPO orchestration: with 64 sets × 64-byte blocks, CI + CO = 12 bits = VPO exactly. While the MMU queries the TLB with the VPN, L1 uses the VPO bits to read the set's 8 tags and words; when the PPN arrives, the cache matches it against those tags. The sizing is deliberate.

### 9.7.2 Linux Virtual Memory System

- Per-process virtual memory layout: code (from 0x400000), data, bss, heap (grows up via `brk`), shared-library region, user stack (grows down from below the kernel region), kernel virtual memory on top.
- Kernel VM regions shared by all processes: kernel code/data; plus a **direct mapping of a contiguous VP range onto all of physical DRAM** — gives the kernel a window onto any physical location (page tables, memory-mapped I/O).
- Kernel VM regions per process: page tables, kernel stack for this process's context, address-space bookkeeping structures.
- **Areas (segments)**: contiguous chunks of *existing* allocated VM whose pages are related (code, data, shared libraries, stack). Any VP not in some area does not exist and costs nothing. Kernel data structures:
  - `task_struct` per process → `mm_struct` → `pgd` (base of the L1 table — loaded into CR3 when the process runs) and `mmap` (list of `vm_area_struct`s).
  - `vm_area_struct`: `vm_start`, `vm_end`, `vm_prot` (page permissions), `vm_flags` (shared vs. private, etc.), `vm_next`.
- **Page fault handling** for faulting address A:
  1. Legal address? Search area structs for `vm_start ≤ A < vm_end` (a tree over the list makes this fast). No area → **segmentation fault**, process terminated.
  2. Legal access? Check `vm_prot` (e.g., write to read-only code, user-mode read of kernel memory). No → **protection exception**, process terminated.
  3. Otherwise a normal fault: select a victim, swap it out if dirty, swap in the page, update the PTE, restart the instruction.

## 9.8 Memory Mapping

- Linux initializes an area's contents by associating it with an **object on disk**:
  1. **Regular file**: area mapped to a contiguous file section, split into page-size pieces holding initial page contents; demand paging defers all loading until first touch; area longer than the section is zero-padded.
  2. **Anonymous file** (kernel-created, all zeros): first touch finds a victim, zeroes it, and marks the page resident — **demand-zero pages**; nothing is transferred from disk.
- Once initialized, pages swap to/from the kernel's **swap file** (**swap space**). Swap space bounds the total VPs allocatable by all running processes.

### 9.8.1 Shared Objects, Private Objects, Copy-on-Write

- An object can be mapped **shared** or **private** into an area (shared area / private area).
- **Shared**: writes are visible to other processes that mapped it and propagate to the file on disk. The kernel keeps a single physical copy; each mapping's PTEs point at it (VAs may differ per process).
- **Private (copy-on-write)**: one physical copy initially; PTEs flagged read-only; area flagged private COW. A write faults; the handler notices the COW flag, copies the page to a new PP, redirects the PTE, restores write permission, and re-executes the write. Writes are invisible to other processes and never reach the disk object. Copying is deferred to the last possible moment, conserving physical memory.

### 9.8.2 fork

`fork` creates the child's `mm_struct`, area structs, and page tables as exact copies of the parent's; every page in *both* processes is flagged read-only, every area private COW. Subsequent writes by either process create new pages via COW, preserving private address spaces.

### 9.8.3 execve

`execve("a.out", NULL, NULL)` replaces the current program:
1. Delete the existing user-area structs.
2. Map private COW areas: `.text`/`.data` map to the file; bss is demand-zero (size from the file); stack and heap are demand-zero, initially empty.
3. Map shared areas: dynamically link shared objects (e.g., libc.so) into the shared region.
4. Set the PC to the entry point. Pages fault in on demand.

### 9.8.4 mmap / munmap

```c
void *mmap(void *start, size_t length, int prot, int flags, int fd, off_t offset);
        /* pointer to mapped area, or MAP_FAILED (-1) */
int munmap(void *start, size_t length);   /* 0, or -1 */
```

- Maps `length` bytes of the object `fd`, starting at file offset `offset`, into a new area preferably at `start` (a hint; use NULL).
- `prot`: PROT_EXEC, PROT_READ, PROT_WRITE, PROT_NONE — the area's `vm_prot` bits.
- `flags`: MAP_ANON (demand-zero backing), MAP_PRIVATE (COW), MAP_SHARED.
- `munmap` deletes the region; later references segfault.

## 9.9 Dynamic Memory Allocation

- A **dynamic memory allocator** manages the **heap**: a demand-zero area starting after bss, growing upward; kernel variable **brk** marks its top.
- Heap = collection of blocks, each contiguous and either **allocated** or **free**. Allocated blocks stay allocated until freed explicitly (by the program) or implicitly (by the allocator).
- **Explicit allocators**: application frees (C `malloc`/`free`; C++ `new`/`delete`). **Implicit allocators** (**garbage collectors**): allocator detects and frees unused blocks (Lisp, ML, Java).

### 9.9.1 malloc and free

```c
void *malloc(size_t size);   /* block of ≥ size bytes, or NULL (sets errno) */
void free(void *ptr);        /* ptr must come from malloc/calloc/realloc */
void *sbrk(intptr_t incr);   /* grow heap by incr; returns old brk, or -1 (ENOMEM) */
```

- Alignment: returned address is a multiple of 8 (32-bit mode) or 16 (64-bit mode).
- `malloc` does not initialize memory; `calloc` zeroes; `realloc` resizes.
- Allocators get heap memory via `mmap`/`munmap` or `sbrk`. `sbrk(0)` returns current brk; negative `incr` is legal but the return value points past the new top.
- `free` on a bad pointer is undefined behavior and returns no error indication.

### 9.9.2 Why Dynamic Allocation

Data-structure sizes are often unknown until run time. Hard-coded maximum sizes are arbitrary, unrelated to available VM, and a maintenance hazard; allocating at run time after the size is known bounds the structure only by available virtual memory.

### 9.9.3 Requirements and Goals

Constraints on an explicit allocator:
- Handle arbitrary request sequences (frees must match prior allocations; no other ordering assumptions).
- Respond immediately (no reordering or buffering of requests).
- Use only the heap for its own non-scalar data.
- Align blocks to hold any data type.
- Never modify or move allocated blocks (no compaction).

Goals in tension:
- **Throughput**: requests completed per unit time. Reasonable target: allocate in time linear in the number of free blocks; free in constant time.
- **Peak utilization**: with aggregate payload Pₖ after request Rₖ and heap size Hₖ (monotonically nondecreasing), Uₖ = (maxᵢ≤ₖ Pᵢ)/Hₖ; maximize Uₙ₋₁. Throughput is easy to buy at utilization's expense; balancing the two is the design challenge.

### 9.9.4 Fragmentation

- **Internal**: allocated block larger than its payload (minimum block size, alignment padding). Quantifiable from past requests alone: sum of (block size − payload).
- **External**: enough aggregate free memory, but no single free block large enough. Depends also on *future* requests, hence hard to quantify; allocators use heuristics favoring few large free blocks over many small ones.

### 9.9.5 Implementation Issues

A practical allocator must decide: **free block organization**, **placement** (which free block to use), **splitting** (what to do with the remainder), **coalescing** (what to do with a freed block).

### 9.9.6 Implicit Free Lists

- Block = one-word **header** (block size + allocated bit) + payload + optional padding. With double-word alignment, sizes are multiples of 8, so the 3 low size bits are free; the LSB stores allocated/free.
  - Allocated, 24 (0x18) bytes: header 0x00000018 | 0x1 = **0x00000019**. Free, 40 (0x28) bytes: **0x00000028**.
- The free list is *implicit*: free blocks are linked by the size fields in the headers of all blocks; traversing the heap traverses the free set. Requires a marked end block (terminating header: allocated, size 0).
- Advantage: simplicity. Disadvantage: any free-list search (e.g., placement) is linear in the *total* number of blocks.
- Alignment + block format ⇒ a **minimum block size** (here: 2 words — header plus one word of alignment), imposed even on 1-byte requests.

### 9.9.7 Placing Allocated Blocks

| Policy | Method | Tradeoffs |
|---|---|---|
| First fit | Search from the start; take the first fit | Keeps large blocks at the end; leaves splinters at the front, slowing later searches |
| Next fit | First fit, resuming where the last search ended | Can be much faster than first fit; studies suggest worse utilization |
| Best fit | Take the smallest fitting free block | Best utilization; exhaustive search with simple list organizations |

### 9.9.8 Splitting

On a fit: use the whole block (fast; internal fragmentation) or split it — first part becomes the allocated block, remainder a new free block.

### 9.9.9 Getting Additional Heap Memory

If no fit: coalesce free blocks; if still no fit, request more memory via `sbrk`, turn it into one large free block, insert it into the free list, and place the request there.

### 9.9.10 Coalescing

- **False fragmentation**: adjacent free blocks chopped into unusable pieces; merging them is **coalescing**.
- **Immediate** coalescing (at each free): constant time, but can thrash — repeated coalesce/split cycles on some request patterns.
- **Deferred** coalescing (e.g., scan the heap when an allocation fails): fast allocators often use some form of it. This text assumes immediate coalescing.

### 9.9.11 Boundary Tags

- Coalescing the *next* block is easy: current header locates the next header; check its allocated bit.
- For the *previous* block, an implicit list would require a linear scan. **Boundary tags** (Knuth): a **footer** replicating the header at the end of each block; the previous block's footer sits one word before the current block, giving its status and size in constant time.
- Four free cases (prev/next: alloc/alloc, alloc/free, free/alloc, free/free); each coalesces in constant time by updating the surviving header and footer with the combined size.
- Overhead: header + footer is significant for many small blocks. Optimization: store the *previous* block's allocated bit in a spare low-order bit of the current header; then **allocated blocks need no footer** (free blocks still do).

### 9.9.12 A Simple Implicit-List Allocator

- Design: implicit free list, immediate boundary-tag coalescing, first fit, minimum block size 16 bytes, maximum block size 2³² = 4 GB; 64-bit clean (runs in 32- and 64-bit modes).
- Memory model (`memlib.c`): `mem_init` models the heap as a large double-word-aligned byte array; `mem_sbrk(incr)` extends the model heap like `sbrk` but rejects shrinking.
- Interface: `mm_init` (0/−1), `mm_malloc`, `mm_free` — same semantics as the system versions.
- **Heap invariant**: [padding word] [prologue block: 8-byte allocated, header+footer only, never freed] [regular blocks…] [epilogue: size-0 allocated header]. Prologue and epilogue eliminate coalescing edge cases. Static `heap_listp` points to the prologue block.
- Block pointers (`bp`) point to the first payload byte; headers/footers are computed relative to `bp`.

Constants and macros:

```c
#define WSIZE      4         /* word, header/footer size (bytes) */
#define DSIZE      8         /* double word */
#define CHUNKSIZE  (1<<12)   /* heap extension increment */

#define MAX(x, y)  ((x) > (y) ? (x) : (y))
#define PACK(size, alloc)  ((size) | (alloc))
#define GET(p)        (*(unsigned int *)(p))
#define PUT(p, val)   (*(unsigned int *)(p) = (val))
#define GET_SIZE(p)   (GET(p) & ~0x7)
#define GET_ALLOC(p)  (GET(p) & 0x1)
#define HDRP(bp)      ((char *)(bp) - WSIZE)
#define FTRP(bp)      ((char *)(bp) + GET_SIZE(HDRP(bp)) - DSIZE)
#define NEXT_BLKP(bp) ((char *)(bp) + GET_SIZE(((char *)(bp) - WSIZE)))
#define PREV_BLKP(bp) ((char *)(bp) - GET_SIZE(((char *)(bp) - DSIZE)))
```

Composable, e.g. size of the next block: `GET_SIZE(HDRP(NEXT_BLKP(bp)))`.

Function logic:

- **`mm_init`**: get 4 words from `mem_sbrk`; write alignment padding, prologue header/footer `PACK(DSIZE,1)`, epilogue header `PACK(0,1)`; advance `heap_listp` to the prologue block; `extend_heap(CHUNKSIZE/WSIZE)` to create the initial free block.
- **`extend_heap(words)`**: round `words` up to even (double-word alignment); `mem_sbrk(size)`; overwrite the old epilogue: write the new free block's header/footer `PACK(size,0)` and a new epilogue header after it; return `coalesce(bp)` (the previous heap likely ended in a free block).
- **`mm_free(bp)`**: rewrite header and footer with `PACK(size, 0)`; `coalesce(bp)`.
- **`coalesce(bp)`** — read prev's footer and next's header allocated bits; four cases:
  1. both allocated → return `bp`;
  2. next free → size += next's size; update current header, (combined) footer;
  3. prev free → size += prev's size; update current footer, prev's header; `bp = PREV_BLKP(bp)`;
  4. both free → size += both; update prev's header, next's footer; `bp = PREV_BLKP(bp)`.
- **`mm_malloc(size)`**: return NULL if `size == 0`. Adjust: `asize = 2*DSIZE` if `size <= DSIZE`, else `DSIZE * ((size + DSIZE + (DSIZE-1)) / DSIZE)` (add header/footer overhead, round up to 8). `find_fit(asize)`; on success `place(bp, asize)` and return. Else `extend_heap(MAX(asize, CHUNKSIZE)/WSIZE)`, then `place` and return (NULL if extension fails).
- **`find_fit(asize)`** (first fit): scan from `heap_listp` via `NEXT_BLKP` until `GET_SIZE(HDRP(bp)) == 0` (epilogue); return the first block that is free and ≥ `asize`; else NULL.
- **`place(bp, asize)`**: if remainder `csize - asize >= 2*DSIZE` (minimum block size), write the allocated block's header/footer with `asize`, then write the remainder's header/footer as free — the split must happen *after* placing, before moving to the next block. Otherwise allocate the whole block.

### 9.9.13 Explicit Free Lists

- Implicit lists: allocation linear in *total* blocks — unsuited to general-purpose allocators.
- Free blocks' bodies are unused, so link them into a **doubly linked list** with `pred`/`succ` pointers stored in the payload area. Allocation becomes linear in the number of *free* blocks.
- Ordering policies:
  - **LIFO** (insert freed block at head): insertion is constant time; with boundary tags, coalescing — and hence the whole free — is constant time too.
  - **Address order** (each block's address < successor's): freeing needs a linear search for the predecessor, but utilization is better, approaching best fit.
- Cost: free blocks must hold the pointers plus header (and possibly footer) → larger minimum block size → more potential internal fragmentation.

### 9.9.14 Segregated Free Lists

**Segregated storage**: partition block sizes into **size classes** (e.g., powers of 2, or one class per small size and powers of 2 above) and keep one free list per class, ordered by increasing size.

**Simple segregated storage** — each class's list holds blocks of one uniform size (the class maximum); no splitting, no coalescing:
- Allocate: pop the head of the matching list; if empty, get a page-multiple chunk from the OS and carve it into equal blocks. Free: push onto the list head.
- Constant-time allocate and free; minimal overhead — block size inferred from address, so no header or footer needed; singly linked suffices; minimum block size = one word (the `succ` pointer).
- Susceptible to internal fragmentation (no splitting) and, worse, unbounded external fragmentation (no coalescing).

**Segregated fits** — each list holds variable sizes within its class, as explicit or implicit lists:
- Allocate: first-fit search of the matching list; on failure try the next larger class; if all fail, `sbrk`. Optionally split, putting the fragment on the appropriate list. Free: coalesce, insert into the appropriate list.
- Fast (searches limited to part of the heap) and memory-efficient: first fit over segregated lists approximates best fit over the whole heap. Popular for production allocators, including GNU malloc.

**Buddy systems** — segregated fits with power-of-2 classes only:
- Heap of 2ᵐ words; one free list per size 2ᵏ, 0 ≤ k ≤ m. Requests round up to a power of 2.
- Allocate 2ᵏ: find the first free 2ʲ, k ≤ j ≤ m; split in half recursively until j = k, putting each remaining half (**buddy**) on its list. Free: coalesce with free buddies until an allocated buddy stops it.
- A block and its buddy differ in exactly one address bit (size-32 block at xxx…x00000 ↔ buddy at xxx…x10000), so buddy addresses are trivially computable.
- Fast search and coalescing; power-of-2 rounding causes bad internal fragmentation — suitable only for workloads with power-of-2 block sizes.

## 9.10 Garbage Collection

- A **garbage collector** automatically reclaims allocated blocks the program no longer needs (**garbage**). The application never calls `free`; the collector does. Dates to McCarthy's Lisp (early 1960s); used in Java, ML, Perl, Mathematica.

### 9.10.1 Basics

- Memory as a directed **reachability graph**: nodes = root nodes (registers, stack variables, global variables — locations outside the heap containing pointers into it) + heap nodes (one per allocated block); edge p → q iff a location in block p points into block q.
- A node is **reachable** if some path from a root reaches it. Unreachable nodes are garbage; the collector's job is to maintain (a representation of) the graph and periodically free unreachable nodes.
- ML/Java collectors control pointer creation and keep an *exact* graph. C/C++ collectors cannot: they are **conservative** — every reachable block is classified reachable, but some unreachable blocks may be too.
- Collectors may run on demand or concurrently. On-demand integration with malloc: when `malloc` finds no fit, it invokes the collector, which calls `free` on garbage blocks; `malloc` retries, then asks the OS, and finally returns NULL.

### 9.10.2 Mark&Sweep

- **Mark phase**: mark every reachable allocated block (using a spare low-order header bit). **Sweep phase**: free every unmarked allocated block.
- Helpers (with `typedef void *ptr`): `isPtr(p)` — if p points into an allocated block, return the block's start, else NULL; `blockMarked(b)`; `blockAllocated(b)`; `markBlock(b)`; `length(b)` (words, excluding header); `unmarkBlock(b)`; `nextBlock(b)`.

```c
void mark(ptr p) {                     void sweep(ptr b, ptr end) {
    if ((b = isPtr(p)) == NULL)            while (b < end) {
        return;                                if (blockMarked(b))
    if (blockMarked(b))                            unmarkBlock(b);
        return;                                else if (blockAllocated(b))
    markBlock(b);                                  free(b);
    len = length(b);                           b = nextBlock(b);
    for (i = 0; i < len; i++)              }
        mark(b[i]);                    }
}
```

- Mark is called once per root; it recursively marks all unmarked reachable descendants. After marking, unmarked allocated blocks are exactly the (conservatively identified) garbage; sweep frees them.

### 9.10.3 Conservative Mark&Sweep for C

- Works in place (no block motion) — appropriate for C. The hard part is `isPtr`:
  1. C memory is untyped: no way to tell whether a word *is* a pointer.
  2. Even for a known pointer, it may point into the middle of a payload.
- Middle-pointer solution: keep allocated blocks in a **balanced binary tree** ordered by address (two extra header fields, `left`/`right`); `isPtr` binary-searches, using each block's size field to test whether p falls within its extent.
- Fundamental reason C collectors must be conservative: an `int` or `float` whose value happens to equal an address inside block b is indistinguishable from a pointer, so b must be treated as reachable.

## 9.11 Common Memory-Related Bugs in C

Memory bugs manifest at a distance in time and space from their cause.

1. **Dereferencing bad pointers** — holes in the address space → segmentation exception; read-only areas → protection exception. Classic: `scanf("%d", val)` instead of `&val` passes the contents of `val` as an address.
2. **Reading uninitialized memory** — bss is zeroed by the loader; heap memory is not. Assuming `malloc`'d memory is zero (e.g., accumulating into `y[i] +=` without zeroing) is a bug; zero explicitly or use `calloc`.
3. **Stack buffer overflows** — writing to a stack buffer without bounding input size (`gets`); use `fgets`.
4. **Assuming pointers and their referents are the same size** — e.g., `malloc(n * sizeof(int))` for an array of `int *`. Runs on platforms where sizes coincide; on ones where pointers are wider, writes past the block — often smashing the boundary-tag footer, so the crash appears much later, in `free`/coalescing.
5. **Off-by-one errors** — `for (i = 0; i <= n; i++)` over an n-element array overwrites the word past the end.
6. **Referencing a pointer instead of its referent** — `*size--` decrements the pointer, not the integer: unary `*` and `--` share precedence and associate right-to-left. Intent requires `(*size)--`; parenthesize when in doubt.
7. **Misunderstanding pointer arithmetic** — pointer arithmetic is in units of the referenced type. `p += sizeof(int)` on an `int *` advances 4 elements, scanning every fourth integer; correct is `p++`.
8. **Referencing nonexistent variables** — returning the address of a local: the pointer outlives the stack frame; later writes through it corrupt some other function's frame.
9. **Referencing data in free heap blocks** — reading a freed block that may already be reallocated and overwritten.
10. **Memory leaks** — allocating without freeing. Gradually fills the heap; especially serious in daemons and servers, which never terminate.

## 9.12 Summary

- VM = abstraction of main memory via virtual addressing; the MMU translates VAs using OS-maintained page tables.
- Three capabilities: caching (pages; faults handled by the kernel, evicted pages written back), memory management (simplifies linking, sharing, allocation, loading), protection (permission bits in every PTE).
- Translation integrates with hardware caches: PTEs are cached; the TLB usually removes the PTE-access cost.
- Memory mapping lets processes create/destroy VM areas and map them to file sections or demand-zero pages, sharing objects and using copy-on-write for private mappings; basis of `fork`, `execve`, and `mmap`.
- Dynamic allocators manage the heap directly, below the type system. Explicit allocators (malloc) require the application to free; implicit allocators (garbage collectors) reclaim unreachable blocks automatically.
- Recurring C errors: bad-pointer dereference, uninitialized reads, buffer overflows, size confusions, pointer/referent confusion, pointer-arithmetic mistakes, dangling stack and heap references, leaks.
