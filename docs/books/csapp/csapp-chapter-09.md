# Chapter 9. Virtual Memory

Virtual memory is an abstraction of main memory: an elegant interaction of hardware exceptions, hardware address translation, main memory, disk files, and kernel software that provides each process with a large, uniform, and private address space. With one clean mechanism it provides three capabilities:

1. **Caching.** Main memory is used efficiently by treating it as a cache for an address space stored on disk, keeping only active areas in memory and transferring data between disk and memory as needed.
2. **Memory management.** Each process gets a uniform address space, which simplifies linking, loading, sharing, and allocation.
3. **Protection.** The address space of each process is protected from corruption by other processes.

Virtual memory works silently and automatically, but programmers should understand it because it is central (it pervades exceptions, assemblers, linkers, loaders, shared objects, files, and processes), powerful (it enables creating and destroying chunks of memory, mapping memory to disk files, and sharing memory between processes), and dangerous (every variable reference, pointer dereference, and `malloc` call interacts with it; misuse produces perplexing bugs, from immediate segmentation faults to programs that run to completion with incorrect results).

## 9.1 Physical and Virtual Addressing

Main memory is organized as an array of M contiguous byte-size cells, each with a unique physical address (PA): 0, 1, 2, and so on. With physical addressing the CPU generates an effective physical address and passes it directly to main memory over the memory bus. Early PCs used physical addressing; digital signal processors, embedded microcontrollers, and Cray supercomputers still do.

Modern processors use virtual addressing: the CPU generates a virtual address (VA), which is converted to the appropriate physical address before being sent to main memory. The conversion is address translation and, like exception handling, requires close cooperation between CPU hardware and the operating system. Dedicated hardware on the CPU chip, the memory management unit (MMU), translates virtual addresses on the fly using a lookup table stored in main memory whose contents are managed by the operating system.

```
Physical addressing:   CPU ──PA──▶ Main memory
Virtual addressing:    CPU ──VA──▶ MMU ──PA──▶ Main memory
```

## 9.2 Address Spaces

An address space is an ordered set of nonnegative integer addresses `{0, 1, 2, ...}`. If the integers are consecutive the address space is linear (assumed throughout).

| Address space          | Definition                        | Size                    |
| ---------------------- | --------------------------------- | ----------------------- |
| Virtual address space  | `{0, 1, 2, ..., N − 1}`           | N = 2^n (n-bit space)   |
| Physical address space | `{0, 1, 2, ..., M − 1}`           | M bytes of physical memory; assume M = 2^m |

Modern systems support 32-bit or 64-bit virtual address spaces. The key idea of virtual memory: each byte of main memory has a virtual address chosen from the virtual address space and a physical address chosen from the physical address space.

## 9.3 VM as a Tool for Caching

Conceptually, a virtual memory is an array of N contiguous byte-size cells stored on disk, indexed by virtual address and cached in main memory. Disk data (lower level) is partitioned into blocks that serve as transfer units to main memory (upper level): virtual memory is partitioned into fixed-size virtual pages (VPs) of P = 2^p bytes, and physical memory into physical pages (PPs, also called page frames) of the same size.

At any time the set of virtual pages is partitioned into three disjoint subsets:

| Subset      | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| Unallocated | Not yet created by the VM system; no data associated, no space occupied on disk     |
| Cached      | Allocated pages currently cached in physical memory                                 |
| Uncached    | Allocated pages not cached in physical memory                                       |

### 9.3.1 DRAM Cache Organization

Terminology: SRAM cache denotes the L1, L2, and L3 caches between CPU and main memory; DRAM cache denotes the VM system's cache of virtual pages in main memory.

The DRAM cache's position in the hierarchy dictates its organization. DRAM is at least 10x slower than SRAM, and disk is about 100,000x slower than DRAM; reading the first byte from a disk sector is about 100,000x slower than reading successive bytes. The enormous miss cost drives every design decision:

| Property                | Consequence of huge miss penalty                                        |
| ----------------------- | ----------------------------------------------------------------------- |
| Large pages             | Typically 4 KB to 2 MB                                                  |
| Fully associative       | Any virtual page can be placed in any physical page                     |
| Sophisticated replacement | OS uses far more elaborate algorithms than SRAM cache hardware        |
| Write-back              | Always, never write-through, because of the large disk access time      |

### 9.3.2 Page Tables

The VM system must determine whether a virtual page is cached in DRAM, and if so where; on a miss it must determine where the page is stored on disk, select a victim in physical memory, and copy the page in. These capabilities are provided by a combination of OS software, MMU address translation hardware, and a page table: a data structure in physical memory mapping virtual pages to physical pages. The hardware reads the page table on every translation; the OS maintains its contents and transfers pages between disk and DRAM.

A page table is an array of page table entries (PTEs), one per virtual page at a fixed offset. Assume each PTE holds a valid bit and an address field:

| Valid bit | Address field | Meaning                                        |
| --------- | ------------- | ----------------------------------------------- |
| 1         | PPN           | Page cached in DRAM at that physical page       |
| 0         | null          | Page not yet allocated                          |
| 0         | disk address  | Page allocated but not cached; resides on disk  |

Because the DRAM cache is fully associative, any physical page can contain any virtual page.

### 9.3.3 Page Hits

When the CPU reads a word in a cached virtual page, the address translation hardware uses the virtual address as an index to locate the PTE and read it from memory. The valid bit is set, so the hardware uses the physical page address in the PTE to construct the physical address of the word. Hits are handled entirely by hardware.

### 9.3.4 Page Faults

A DRAM cache miss is a page fault. The hardware reads the PTE, infers from the valid bit that the page is not cached, and triggers a page fault exception, invoking the kernel's page fault handler:

1. The handler selects a victim page; if the victim has been modified, the kernel copies it back to disk.
2. The kernel updates the victim's PTE to reflect that it is no longer cached.
3. The kernel copies the faulted page from disk into the victim's physical page and updates its PTE.
4. The handler returns and restarts the faulting instruction, which resends the virtual address; the reference is now a hit and is handled normally by hardware.

VM predates SRAM caches (invented in the early 1960s), so it uses different terminology: blocks are pages; transferring a page between disk and memory is swapping or paging (swapped/paged in and out). Waiting until a miss occurs to swap in a page is demand paging; all modern systems use it.

### 9.3.5 Allocating Pages

When the OS allocates a new page of virtual memory (e.g., as a result of `malloc`), it creates room on disk and updates the page's PTE to point to the newly created disk page. No physical memory is involved until the page is first touched.

### 9.3.6 Locality to the Rescue Again

Despite the large miss penalties, virtual memory works well because of locality. Although the total number of distinct pages a program touches over its run may exceed physical memory, at any point in time the program tends to work on a smaller set of active pages, the working set (resident set). After the initial overhead of paging in the working set, subsequent references hit with no additional disk traffic.

If the working set exceeds physical memory, the program thrashes: pages are swapped in and out continuously and performance slows to a crawl. When a program crawls, suspect thrashing.

## 9.4 VM as a Tool for Memory Management

Operating systems provide a separate page table, and thus a separate virtual address space, for each process. Multiple virtual pages (from the same or different processes) can be mapped to the same shared physical page. Some early systems (DEC PDP-11/70) had virtual address spaces smaller than physical memory; VM was still valuable purely for management and protection.

Demand paging plus separate address spaces simplifies:

- **Linking.** Each process uses the same basic memory image format regardless of where code and data reside physically. On 64-bit Linux the code segment always starts at `0x400000`, data follows after an alignment gap, and the stack occupies the top of the user address space. Uniformity greatly simplifies linker design and implementation.
- **Loading.** To load `.text` and `.data` from an executable, the loader allocates virtual pages, marks them invalid, and points their PTEs to locations in the object file. The loader never copies data from disk; pages are paged in automatically on first reference. Mapping contiguous virtual pages to an arbitrary location in an arbitrary file is memory mapping (`mmap`, Section 9.8).
- **Sharing.** Normally the OS maps each process's virtual pages to disjoint physical pages. When sharing is desirable (kernel code, the standard C library), the OS maps the appropriate virtual pages in different processes to the same physical pages, keeping one copy in memory.
- **Allocation.** When a process requests additional heap space, the OS allocates k contiguous virtual pages and maps them to k arbitrary physical pages scattered anywhere in physical memory; contiguity in physical memory is never required.

## 9.5 VM as a Tool for Memory Protection

A user process must not modify its read-only code section, read or modify kernel code and data, read or write private memory of other processes, or modify shared pages without permission. Since the address translation hardware reads a PTE on every access, access control falls out naturally by adding permission bits to each PTE:

| Bit   | Controls                                                                    |
| ----- | ---------------------------------------------------------------------------- |
| SUP   | Whether the process must be in kernel (supervisor) mode to access the page  |
| READ  | Read access                                                                  |
| WRITE | Write access                                                                 |

Processes in kernel mode can access any page; processes in user mode may access only pages with SUP = 0. If an instruction violates the permissions, the CPU triggers a general protection fault, transferring control to a kernel exception handler, which sends a SIGSEGV signal to the offending process. Linux shells report this as a segmentation fault.

## 9.6 Address Translation

Address translation symbols:

| Symbol | Meaning                        | Symbol | Meaning                        |
| ------ | ------------------------------ | ------ | ------------------------------ |
| N = 2^n | Virtual address space size    | VPO    | Virtual page offset (bytes)    |
| M = 2^m | Physical address space size   | VPN    | Virtual page number            |
| P = 2^p | Page size (bytes)             | TLBI   | TLB index                      |
| PPO    | Physical page offset (bytes)   | TLBT   | TLB tag                        |
| PPN    | Physical page number           | CO     | Byte offset within cache block |
| CI     | Cache index                    | CT     | Cache tag                      |

Formally, address translation is a mapping between an N-element virtual address space (VAS) and an M-element physical address space (PAS):

```
MAP: VAS → PAS ∪ ∅

MAP(A) = A'  if data at virtual address A are present at physical address A'
         ∅   if data at virtual address A are not present in physical memory
```

A CPU control register, the page table base register (PTBR), points to the current page table. The n-bit virtual address has two components: a p-bit VPO and an (n − p)-bit VPN. The MMU uses the VPN to select the PTE (VPN 0 selects PTE 0, VPN 1 selects PTE 1, ...). The physical address is the concatenation of the PPN from the PTE and the VPO from the virtual address. Since pages are P bytes, PPO = VPO.

```
Virtual address:   │    VPN    │  VPO  │      VPN indexes the page table
                        │          │
                        ▼          │
                   page table ─▶ PPN   │      valid = 0 → page fault
                        │          │
                        ▼          ▼
Physical address:  │    PPN    │  PPO  │      PPO = VPO
```

**Page hit (hardware only):**

1. Processor generates a virtual address and sends it to the MMU.
2. MMU generates the PTE address (PTEA) and requests it from cache/main memory.
3. Cache/main memory returns the PTE to the MMU.
4. MMU constructs the physical address and sends it to cache/main memory.
5. Cache/main memory returns the requested data word to the processor.

**Page fault (hardware plus kernel):**

1 to 3. Same as above.
4. The PTE valid bit is zero; the MMU triggers an exception, transferring control to the kernel's page fault handler.
5. The handler identifies a victim page in physical memory; if modified, pages it out to disk.
6. The handler pages in the new page and updates the PTE in memory.
7. The handler returns to the original process, restarting the faulting instruction; the access now hits.

### 9.6.1 Integrating Caches and VM

In systems with both VM and SRAM caches, most systems access the SRAM cache with physical addresses. Address translation occurs before the cache lookup. With physical addressing, multiple processes can hold blocks in the cache simultaneously and share blocks from the same virtual pages, and the cache need not deal with protection, since access rights are checked during translation. Page table entries are cached just like any other data words.

### 9.6.2 Speeding Up Address Translation with a TLB

Every translation requires the MMU to read a PTE: tens to hundreds of cycles from memory in the worst case, a handful of cycles if the PTE is in L1. Many systems eliminate even this cost with a translation lookaside buffer (TLB): a small, virtually addressed cache in the MMU where each line holds a block consisting of a single PTE. A TLB usually has a high degree of associativity. With T = 2^t sets, the TLB index (TLBI) is the t least significant bits of the VPN and the TLB tag (TLBT) is the remaining VPN bits:

```
n−1              p+t  p+t−1        p  p−1        0
│      TLBT       │      TLBI       │    VPO     │
└──────────── VPN ──────────────────┘
```

**TLB hit** (all steps inside the on-chip MMU, hence fast):

1. CPU generates a virtual address.
2, 3. MMU fetches the PTE from the TLB.
4. MMU translates the address and sends it to cache/main memory.
5. Cache/main memory returns the data word to the processor.

**TLB miss:** the MMU fetches the PTE from the L1 cache or main memory and stores it in the TLB, possibly overwriting an existing entry, then proceeds as above.

### 9.6.3 Multi-Level Page Tables

A single page table is prohibitively large: 32-bit address space, 4 KB pages, and 4-byte PTEs require a 4 MB page table resident in memory at all times even if the application touches only a small chunk of the address space. The problem is compounded for 64-bit spaces. The common solution is a hierarchy of page tables.

Two-level example (32-bit space, 4 KB pages, 4-byte PTEs): each level 1 PTE maps a 4 MB chunk of the virtual address space (1,024 contiguous pages); 1,024 level 1 PTEs cover the full 4 GB. If every page in chunk i is unallocated, level 1 PTE i is null; otherwise it points to the base of a level 2 page table whose PTEs each map one 4 KB page. With 4-byte PTEs, each level 1 and level 2 table is exactly 4 KB, one page.

The hierarchy reduces memory requirements in two ways:

1. If a level 1 PTE is null, the corresponding level 2 table need not exist at all. Most of a typical program's address space is unallocated, so the savings are significant.
2. Only the level 1 table must be memory resident at all times; level 2 tables are created and paged in and out on demand, with only the most heavily used ones cached in main memory.

With a k-level hierarchy, the virtual address is partitioned into k VPNs and a VPO. VPN i indexes a table at level i; each PTE at level j (j < k) points to the base of some table at level j + 1; each level k PTE contains either the PPN of a physical page or a disk address. The PPO equals the VPO as before. The MMU must access k PTEs per translation; the TLB makes this practical by caching PTEs from different levels, so multi-level translation is not significantly slower than single-level in practice.

### 9.6.4 Putting It Together: End-to-End Address Translation

Example system: byte-addressable memory, 1-byte word accesses, n = 14, m = 12, P = 64 bytes, a 4-way set associative TLB with 16 entries (4 sets), and a physically addressed, direct-mapped L1 d-cache with 4-byte lines and 16 sets.

Address partitioning: pages are 2^6 = 64 bytes, so the low 6 bits are VPO/PPO; the high 8 virtual bits are the VPN; the high 6 physical bits are the PPN. Within the VPN, the low 2 bits are the TLBI (4 sets) and the high 6 bits are the TLBT. Within the physical address, the low 2 bits are CO (4-byte blocks), the next 4 bits are CI (16 sets), and the remaining 6 bits are CT.

Load of the byte at VA `0x03d4` (`00 0011 1101 0100`):

| Step | Field extraction | Result |
| ---- | ---------------- | ------ |
| 1 | VPN = `0x0F`, VPO = `0x14`, TLBI = `0x3`, TLBT = `0x03` | MMU checks the TLB for PTE `0x0F` |
| 2 | TLB set `0x3` has a valid matching tag | TLB hit, returns PPN `0x0D` |
| 3 | PA = PPN ∘ VPO = `0x354` (`0011 0101 0100`) | CO = `0x0`, CI = `0x5`, CT = `0x0D` |
| 4 | Cache set `0x5` tag matches CT | Cache hit, returns byte `0x36` |

Other paths: on a TLB miss the MMU fetches the PPN from a PTE in the page table; if the PTE is invalid, a page fault occurs and the kernel pages in the appropriate page and reruns the instruction; if the PTE is valid, the memory block may still miss in the cache.

## 9.7 Case Study: The Intel Core i7/Linux Memory System

The Haswell microarchitecture allows full 64-bit virtual and physical address spaces; current Core i7 implementations support a 48-bit (256 TB) virtual address space and a 52-bit (4 PB) physical address space, plus a 32-bit compatibility mode. The processor package contains four cores, a shared L3 cache, and a DDR3 memory controller. Per core:

| Structure  | Organization                          |
| ---------- | ------------------------------------- |
| L1 i-TLB   | 128 entries, 4-way set associative    |
| L1 d-TLB   | 64 entries, 4-way set associative     |
| L2 unified TLB | 512 entries, 4-way                |
| L1 i-cache, L1 d-cache | 32 KB, 8-way, 64-byte blocks |
| L2 unified cache | 256 KB, 8-way                   |
| L3 unified cache (shared) | 8 MB, 16-way           |

TLBs are virtually addressed; caches are physically addressed with 64-byte blocks. Page size is configurable at startup as 4 KB or 4 MB; Linux uses 4 KB.

### 9.7.1 Core i7 Address Translation

The Core i7 uses a four-level page table hierarchy; each process has its own private hierarchy. While a Linux process runs, the page tables of allocated pages are all memory resident (though the architecture allows paging them). The CR3 control register contains the physical address of the level 1 (L1) page table; CR3 is part of each process context and is restored on every context switch.

The 36-bit VPN is partitioned into four 9-bit chunks (VPN1 through VPN4), each an offset into a page table at the corresponding level. CR3 locates the L1 table; VPN1 selects an L1 PTE, which holds the base of the L2 table, and so on; the L4 PTE supplies the 40-bit PPN, concatenated with the 12-bit VPO/PPO. Reach per entry: an L1 PTE maps a 512 GB region, L2 a 1 GB region, L3 a 2 MB region, L4 a 4 KB page.

Level 1 to 3 PTE format (references a 4 KB child page table; 40-bit base address imposes 4 KB alignment on page tables):

| Field | Meaning                                                            |
| ----- | ------------------------------------------------------------------ |
| P     | Child page table present in physical memory (always 1 under Linux) |
| R/W   | Read-only or read-write permission for all reachable pages         |
| U/S   | User or supervisor mode permission for all reachable pages         |
| WT    | Write-through or write-back cache policy for the child page table  |
| CD    | Caching disabled or enabled for the child page table               |
| A     | Reference bit, set by MMU on reads and writes, cleared by software |
| PS    | Page size, 4 KB or 4 MB (level 1 PTEs only)                        |
| Base addr | 40 most significant bits of the child page table's physical base |
| XD    | Disable instruction fetches from all pages reachable from this PTE |

Level 4 PTE format (references a 4 KB page) adds:

| Field | Meaning                                                        |
| ----- | -------------------------------------------------------------- |
| D     | Dirty bit, set by MMU on writes, cleared by software           |
| G     | Global page, do not evict from TLB on task switch              |

Permission bits: R/W determines read/write vs read-only; U/S protects kernel code and data from user programs; XD (execute disable, introduced with 64-bit systems) lets the kernel reduce buffer overflow risk by restricting execution to the read-only code segment. As the MMU translates, it maintains two bits for the kernel's fault handler: A (reference bit, used for page replacement) and D (dirty bit, tells the kernel whether a victim page must be written back before replacement). The kernel clears them with a special kernel-mode instruction.

An orchestration detail: the 8-way, 64-set, 64-byte-block L1 d-cache needs 6 offset bits and 6 index bits, exactly the 12-bit VPO. This is no accident. While the MMU requests the PTE from the TLB using the VPN, the L1 cache concurrently uses the VPO bits to select the set and read out the eight tags and data words; when the PPN arrives from the TLB, the cache is ready to match it against the tags.

### 9.7.2 Linux Virtual Memory System

Linux maintains a separate virtual address space for each process: code, data, heap, shared library, and stack segments in user space, and kernel virtual memory above the user stack. Kernel virtual memory contains kernel code and data structures. Some regions are mapped to physical pages shared by all processes (kernel code, global data structures); Linux also maps a set of contiguous virtual pages, equal in size to total DRAM, to the corresponding contiguous physical pages, giving the kernel a convenient window onto any physical location (for page tables and memory-mapped I/O). Other kernel regions differ per process: page tables, the kernel stack used while executing in the process's context, and structures tracking the address space layout.

**Areas.** Linux organizes virtual memory as a collection of areas (segments): contiguous chunks of existing, allocated virtual memory whose pages are related (code segment, data segment, shared library segment, user stack). Every existing virtual page belongs to some area; pages outside all areas do not exist and cannot be referenced. Areas allow the address space to have gaps that consume no resources in memory, on disk, or in the kernel.

Kernel data structures:

```
task_struct ──▶ mm_struct ──▶ pgd    (base of the level 1 page table;
                    │                 loaded into CR3 when the process runs)
                    └───────▶ mmap ──▶ vm_area_struct list
```

Each `vm_area_struct` contains:

| Field    | Meaning                                            |
| -------- | --------------------------------------------------- |
| vm_start | Beginning of the area                               |
| vm_end   | End of the area                                     |
| vm_prot  | Read/write permissions for all pages in the area    |
| vm_flags | Shared with other processes or private, among others |
| vm_next  | Next area struct in the list                        |

**Page fault handling.** When the MMU faults translating virtual address A, control transfers to the kernel's page fault handler:

1. **Is A legal?** Does A lie within some area, i.e., vm_start ≤ A < vm_end for some area struct? The handler searches the area list (in practice a tree superimposed on the list). If not, it triggers a segmentation fault and terminates the process.
2. **Is the access legal?** Does the process have permission to read, write, or execute pages in this area (e.g., a store to the read-only code segment, or a user-mode read of kernel memory)? If not, the handler triggers a protection exception and terminates the process.
3. Otherwise the fault is a normal page fault on a legal address: the kernel selects a victim page, swaps it out if dirty, swaps in the new page, and updates the page table. When the handler returns, the CPU restarts the faulting instruction.

## 9.8 Memory Mapping

Linux initializes the contents of a virtual memory area by associating it with an object on disk, a process known as memory mapping. Areas map to one of two object types:

1. **Regular file.** A contiguous section of a disk file (e.g., an executable object file) divided into page-size pieces, each containing the initial contents of one virtual page. Because of demand paging, no page is swapped into physical memory until the CPU first touches it. If the area is larger than the file section, the area is padded with zeros.
2. **Anonymous file.** A kernel-created file of all binary zeros. On first touch, the kernel finds a victim page, swaps it out if dirty, overwrites it with zeros, and marks the page resident; no data transfers between disk and memory. Such pages are called demand-zero pages.

Once initialized, a virtual page is swapped back and forth between a special kernel-maintained swap file (swap space, swap area). At any point in time the swap space bounds the total virtual pages that can be allocated by all running processes.

### 9.8.1 Shared Objects Revisited

Memory mapping arose from the insight that integrating the VM system with the file system yields a simple, efficient way to load programs and data. Many processes share identical read-only code (every `bash` process, every user of `printf`); duplicating it in physical memory would be wasteful.

An object can be mapped as a shared object or a private object. Writes to an area mapped to a shared object are visible to other processes that mapped the same object and are reflected to the object on disk. Writes to an area mapped to a private object are invisible to other processes and are not written back to disk. The corresponding areas are shared areas and private areas.

**Shared objects.** When process 2 maps a shared object already mapped by process 1 (not necessarily at the same virtual address), the kernel recognizes the object by its unique filename and points process 2's PTEs to the existing physical pages. Only one copy of the shared object resides in physical memory, regardless of how many processes map it.

**Private objects: copy-on-write.** A private object begins life like a shared object, with one physical copy. In each mapping process, the PTEs for the private area are flagged read-only and the area struct is flagged private copy-on-write. Reads proceed normally. When a process writes a page in the area, the write triggers a protection fault; the handler recognizes the copy-on-write area, creates a new copy of the page in physical memory, updates the PTE to point to the copy, and restores write permission. On return, the CPU re-executes the write, which proceeds on the new page. Deferring copying until the last possible moment makes the most efficient use of physical memory.

### 9.8.2 The fork Function Revisited

When `fork` is called, the kernel creates data structures for the new process, assigns it a PID, and creates exact copies of the current process's `mm_struct`, area structs, and page tables. It flags every page in both processes read-only and every area struct in both processes private copy-on-write. When `fork` returns, the new process has an exact copy of the parent's virtual memory; subsequent writes by either process create new pages via copy-on-write, preserving the abstraction of private address spaces.

### 9.8.3 The execve Function Revisited

`execve("a.out", NULL, NULL)` loads and runs the program in `a.out` within the current process, replacing the current program:

1. **Delete existing user areas.** Remove the area structs in the user portion of the current address space.
2. **Map private areas.** Create new area structs for code, data, bss, and stack, all private copy-on-write. Code and data areas map to the `.text` and `.data` sections of `a.out`; bss is demand-zero, mapped to an anonymous file whose size comes from `a.out`; stack and heap are demand-zero, initially of zero length.
3. **Map shared areas.** Dynamically link any shared objects (e.g., `libc.so`) and map them into the shared region of the user address space.
4. **Set the program counter** in the process context to the entry point of the code area.

Linux swaps in code and data pages on demand when the process next runs.

### 9.8.4 User-Level Memory Mapping with the mmap Function

```
#include <unistd.h>
#include <sys/mman.h>

void *mmap(void *start, size_t length, int prot, int flags,
           int fd, off_t offset);
        /* Returns: pointer to mapped area if OK, MAP_FAILED (−1) on error */
```

`mmap` asks the kernel to create a new virtual memory area, preferably starting at `start` (a hint, usually NULL), and to map the contiguous chunk of `length` bytes beginning at `offset` in the object identified by descriptor `fd` into that area.

`prot` bits (access permissions of the new area, the `vm_prot` bits):

| Bit        | Meaning                                      |
| ---------- | -------------------------------------------- |
| PROT_EXEC  | Pages consist of executable instructions     |
| PROT_READ  | Pages may be read                            |
| PROT_WRITE | Pages may be written                         |
| PROT_NONE  | Pages cannot be accessed                     |

`flags` bits (type of mapped object): MAP_ANON for an anonymous object with demand-zero pages, MAP_PRIVATE for a private copy-on-write object, MAP_SHARED for a shared object. Example, a private demand-zero read-only area:

```
bufp = Mmap(NULL, size, PROT_READ, MAP_PRIVATE|MAP_ANON, 0, 0);
```

```
#include <sys/mman.h>

int munmap(void *start, size_t length);
        /* Returns: 0 if OK, −1 on error */
```

`munmap` deletes the area starting at `start` spanning `length` bytes; subsequent references to the deleted region cause segmentation faults.

## 9.9 Dynamic Memory Allocation

Although `mmap` and `munmap` can create and delete areas directly, C programmers typically use a dynamic memory allocator, which is more convenient and portable. An allocator maintains the heap: an area of demand-zero memory beginning just after the uninitialized data area and growing upward. The kernel maintains a variable `brk` pointing to the top of the heap.

An allocator maintains the heap as a collection of various-size blocks, each a contiguous chunk of virtual memory that is either allocated (explicitly reserved for the application) or free (available for allocation). Two allocator styles, both requiring explicit allocation:

| Style    | Freeing responsibility                                                     | Examples                          |
| -------- | --------------------------------------------------------------------------- | --------------------------------- |
| Explicit | Application explicitly frees blocks                                         | C `malloc`/`free`, C++ `new`/`delete` |
| Implicit | Allocator detects unused blocks and frees them (garbage collection)         | Lisp, ML, Java                    |

### 9.9.1 The malloc and free Functions

```
#include <stdlib.h>

void *malloc(size_t size);   /* Returns: ptr to block of ≥ size bytes, NULL + errno on error */
void free(void *ptr);        /* Returns: nothing */
```

`malloc` returns a block suitably aligned for any data object: multiples of 8 in 32-bit mode, multiples of 16 in 64-bit mode. It does not initialize the memory; `calloc` is a thin wrapper that zeros the block, and `realloc` resizes a previously allocated block. `free`'s argument must point to the beginning of a block obtained from `malloc`, `calloc`, or `realloc`; otherwise behavior is undefined, and since `free` returns nothing, it gives no indication of the error.

Allocators can acquire heap memory with `mmap`/`munmap` or with `sbrk`:

```
#include <unistd.h>

void *sbrk(intptr_t incr);   /* Returns: old brk pointer, −1 + ENOMEM on error */
```

`sbrk` grows or shrinks the heap by adding `incr` to the kernel's `brk` pointer. Zero `incr` returns the current `brk`; negative `incr` is legal but tricky, since the return value points `abs(incr)` bytes past the new heap top.

### 9.9.2 Why Dynamic Memory Allocation?

Programs often do not know the sizes of certain data structures until run time. Statically defining arrays with hard-coded maximum sizes is a bad idea: the bound is arbitrary, unrelated to available virtual memory, and exceeding it forces recompilation, a maintenance nightmare in large products. Allocating at run time, after the size is known, limits the structure only by available virtual memory.

### 9.9.3 Allocator Requirements and Goals

Explicit allocators operate under stringent constraints:

| Requirement                        | Meaning                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Handle arbitrary request sequences | No assumptions about ordering of allocate and free requests (only that frees match prior allocations) |
| Immediate responses                | No reordering or buffering of requests to improve performance                              |
| Use only the heap                  | Any nonscalar allocator data structures must live in the heap itself                       |
| Align blocks                       | Blocks must be able to hold any type of data object                                        |
| Not modify allocated blocks        | Only free blocks may be manipulated; no modifying or moving allocated blocks, so compaction is not permitted |

Two conflicting goals:

1. **Maximizing throughput:** requests completed per unit time, maximized by minimizing average request time. Reasonable targets: allocate in time linear in the number of free blocks, free in constant time.
2. **Maximizing memory utilization.** Virtual memory is finite, bounded by swap space. The most useful metric is peak utilization: given requests R0, ..., Rn−1, let aggregate payload Pk be the sum of currently allocated payloads after request Rk and Hk the current (monotonically nondecreasing) heap size; then Uk = (max i≤k Pi) / Hk, and the allocator maximizes Un−1.

Throughput and utilization are in tension; balancing them is the central challenge of allocator design.

### 9.9.4 Fragmentation

Fragmentation, the primary cause of poor heap utilization, occurs when otherwise unused memory is unavailable to satisfy allocate requests.

| Form     | Cause                                                                                             | Quantification                                                        |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Internal | Allocated block larger than its payload: minimum block sizes, alignment padding                    | Simple: sum of differences between block sizes and payloads; depends only on past requests and the implementation |
| External | Enough aggregate free memory exists, but no single free block is large enough                       | Difficult: depends also on the pattern of future requests              |

Because external fragmentation is hard to quantify and impossible to predict, allocators employ heuristics that maintain small numbers of larger free blocks rather than large numbers of smaller ones.

### 9.9.5 Implementation Issues

A practical allocator balancing throughput and utilization must address:

| Issue                   | Question                                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| Free block organization | How do we keep track of free blocks?                                   |
| Placement               | How do we choose a free block for a new allocation?                    |
| Splitting               | What do we do with the remainder of a free block after placement?      |
| Coalescing              | What do we do with a block that has just been freed?                   |

### 9.9.6 Implicit Free Lists

An allocator needs a data structure that distinguishes block boundaries and allocated vs free blocks; most embed this information in the blocks. Simple block format: a one-word header encoding the block size (including header and padding) and an allocated bit, followed by the payload and optional padding. With double-word alignment, block sizes are multiples of 8, so the 3 low-order size bits are free; the least significant bit is the allocated bit (a = 1 allocated, a = 0 free).

```
Header:  │ block size │ 0 0 a │        e.g., allocated 24-byte block:
         31           3       0        0x00000018 | 0x1 = 0x00000019
Payload  (malloc returns pointer here)
Padding  (optional)
```

The heap is then a sequence of contiguous allocated and free blocks; free blocks are linked implicitly by the size fields in the headers, so the allocator traverses all blocks to walk the free set. A specially marked end block is needed: a terminating header with the allocated bit set and size zero.

Advantage: simplicity. Disadvantage: any operation requiring a free list search (e.g., placement) costs time linear in the total number of blocks, allocated and free.

The alignment requirement and block format together impose a minimum block size. With double-word alignment and this format the minimum is two words: one for the header, one to maintain alignment; even a 1-byte request produces a two-word block.

### 9.9.7 Placing Allocated Blocks

The placement policy determines how the allocator searches the free list for a block that fits a k-byte request:

| Policy    | Search                                                            | Tradeoffs                                                                                      |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| First fit | From the beginning, choose the first block that fits              | Retains large blocks at the end of the list; leaves splinters of small blocks near the front, increasing search time |
| Next fit  | Like first fit, but start where the previous search left off      | Proposed by Knuth; can run significantly faster than first fit, especially with a splinter-littered front, but studies suggest worse utilization |
| Best fit  | Examine every free block, choose the smallest that fits           | Generally best utilization, but requires an exhaustive search with simple organizations         |

Segregated free list organizations (Section 9.9.14) approximate best fit without exhaustive search.

### 9.9.8 Splitting Free Blocks

After locating a fitting free block, the allocator decides how much of it to allocate. Using the entire block is simple and fast but introduces internal fragmentation, acceptable only if the placement policy produces good fits. Otherwise the allocator splits the free block: the first part becomes the allocated block, the remainder becomes a new free block.

### 9.9.9 Getting Additional Heap Memory

If no fit is found, the allocator first tries to coalesce physically adjacent free blocks. If that fails or the free blocks are already maximally coalesced, it requests additional heap memory from the kernel via `sbrk`, transforms the new memory into one large free block, inserts it into the free list, and places the requested block there.

### 9.9.10 Coalescing Free Blocks

Adjacent free blocks cause false fragmentation: available free memory chopped into small, unusable blocks (two adjacent 3-word free blocks cannot satisfy a 4-word request). Practical allocators merge adjacent free blocks, a process called coalescing, with a policy decision on timing:

| Policy    | Behavior                                                              | Tradeoff                                                                 |
| --------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Immediate | Merge adjacent blocks each time a block is freed                       | Straightforward, constant time; can thrash (repeated coalesce/split cycles) |
| Deferred  | Coalesce later, e.g., scan the whole heap when an allocation fails     | Preferred by fast allocators                                                |

### 9.9.11 Coalescing with Boundary Tags

Coalescing the next block is easy: the current header points to the next header, which reveals whether the next block is free. Coalescing the previous block with header-only implicit lists would require a linear search of the entire list on every free. Knuth's boundary tags solve this: add a footer at the end of each block that is a replica of the header. The allocator determines the starting location and status of the previous block by inspecting its footer, one word before the current block, giving constant-time coalescing of the previous block.

Four cases when freeing the current block:

| Case | Previous | Next     | Action                                                                                          |
| ---- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| 1    | Allocated | Allocated | No coalescing; mark current block free                                                          |
| 2    | Allocated | Free      | Merge current with next: update current header and next footer with combined size               |
| 3    | Free      | Allocated | Merge previous with current: update previous header and current footer with combined size       |
| 4    | Free      | Free      | Merge all three: update previous header and next footer with combined size                      |

All cases complete in constant time. Disadvantage: header plus footer overhead is significant when applications manipulate many small blocks (with two-word graph nodes, the tags consume half of each block). Optimization: the footer of the previous block is needed only when the previous block is free, so store the previous block's allocated/free bit in one of the excess low-order bits of the current block's header; allocated blocks then need no footer (the space becomes payload), while free blocks still need one.

### 9.9.12 Putting It Together: Implementing a Simple Allocator

A working allocator based on an implicit free list with immediate boundary-tag coalescing. Maximum block size 2^32 = 4 GB; the code is 64-bit clean.

**Memory system model (memlib.c).** `mem_init` models available virtual memory as a large double-word aligned array of bytes; `mem_sbrk` extends the heap by `incr` bytes with the same interface and semantics as `sbrk`, except it rejects requests to shrink the heap.

**Interface.** `mm_init` initializes the allocator (0 on success, −1 otherwise); `mm_malloc` and `mm_free` have the same interfaces and semantics as their system counterparts.

**Heap invariant.** Minimum block size 16 bytes. The heap begins with an unused padding word for double-word alignment, then a prologue block (an 8-byte allocated block of header and footer only, created at initialization, never freed), then zero or more regular blocks, then an epilogue block (a zero-size allocated block consisting of only a header). Prologue and epilogue are tricks that eliminate the edge conditions during coalescing; without them the code would need per-free checks for blocks at the heap boundaries. A single static global `heap_listp` points to the prologue block.

**Constants and macros:**

```
#define WSIZE     4             /* Word and header/footer size (bytes) */
#define DSIZE     8             /* Double word size (bytes) */
#define CHUNKSIZE (1<<12)       /* Extend heap by this amount (bytes) */

#define MAX(x, y) ((x) > (y) ? (x) : (y))

/* Pack a size and allocated bit into a word */
#define PACK(size, alloc)  ((size) | (alloc))

/* Read and write a word at address p */
#define GET(p)       (*(unsigned int *)(p))
#define PUT(p, val)  (*(unsigned int *)(p) = (val))

/* Read the size and allocated fields from address p */
#define GET_SIZE(p)   (GET(p) & ~0x7)
#define GET_ALLOC(p)  (GET(p) & 0x1)

/* Given block ptr bp, compute address of its header and footer */
#define HDRP(bp)  ((char *)(bp) - WSIZE)
#define FTRP(bp)  ((char *)(bp) + GET_SIZE(HDRP(bp)) - DSIZE)

/* Given block ptr bp, compute address of next and previous blocks */
#define NEXT_BLKP(bp)  ((char *)(bp) + GET_SIZE(((char *)(bp) - WSIZE)))
#define PREV_BLKP(bp)  ((char *)(bp) - GET_SIZE(((char *)(bp) - DSIZE)))
```

Block pointers (`bp`) point to the first payload boundary. Macros compose, e.g., size of the next block: `GET_SIZE(HDRP(NEXT_BLKP(bp)))`.

**Initialization:**

```
int mm_init(void)
{
    /* Create the initial empty heap */
    if ((heap_listp = mem_sbrk(4*WSIZE)) == (void *)-1)
        return -1;
    PUT(heap_listp, 0);                          /* Alignment padding */
    PUT(heap_listp + (1*WSIZE), PACK(DSIZE, 1)); /* Prologue header */
    PUT(heap_listp + (2*WSIZE), PACK(DSIZE, 1)); /* Prologue footer */
    PUT(heap_listp + (3*WSIZE), PACK(0, 1));     /* Epilogue header */
    heap_listp += (2*WSIZE);

    /* Extend the empty heap with a free block of CHUNKSIZE bytes */
    if (extend_heap(CHUNKSIZE/WSIZE) == NULL)
        return -1;
    return 0;
}

static void *extend_heap(size_t words)
{
    char *bp;
    size_t size;

    /* Allocate an even number of words to maintain alignment */
    size = (words % 2) ? (words+1) * WSIZE : words * WSIZE;
    if ((long)(bp = mem_sbrk(size)) == -1)
        return NULL;

    /* Initialize free block header/footer and the epilogue header */
    PUT(HDRP(bp), PACK(size, 0));           /* Free block header */
    PUT(FTRP(bp), PACK(size, 0));           /* Free block footer */
    PUT(HDRP(NEXT_BLKP(bp)), PACK(0, 1));   /* New epilogue header */

    /* Coalesce if the previous block was free */
    return coalesce(bp);
}
```

`extend_heap` runs when the heap is initialized and when `mm_malloc` cannot find a fit. The header of the old epilogue becomes the header of the new free block, and the last word of the new chunk becomes the new epilogue header.

**Freeing and coalescing:**

```
void mm_free(void *bp)
{
    size_t size = GET_SIZE(HDRP(bp));

    PUT(HDRP(bp), PACK(size, 0));
    PUT(FTRP(bp), PACK(size, 0));
    coalesce(bp);
}

static void *coalesce(void *bp)
{
    size_t prev_alloc = GET_ALLOC(FTRP(PREV_BLKP(bp)));
    size_t next_alloc = GET_ALLOC(HDRP(NEXT_BLKP(bp)));
    size_t size = GET_SIZE(HDRP(bp));

    if (prev_alloc && next_alloc) {            /* Case 1 */
        return bp;
    }
    else if (prev_alloc && !next_alloc) {      /* Case 2 */
        size += GET_SIZE(HDRP(NEXT_BLKP(bp)));
        PUT(HDRP(bp), PACK(size, 0));
        PUT(FTRP(bp), PACK(size, 0));
    }
    else if (!prev_alloc && next_alloc) {      /* Case 3 */
        size += GET_SIZE(HDRP(PREV_BLKP(bp)));
        PUT(FTRP(bp), PACK(size, 0));
        PUT(HDRP(PREV_BLKP(bp)), PACK(size, 0));
        bp = PREV_BLKP(bp);
    }
    else {                                     /* Case 4 */
        size += GET_SIZE(HDRP(PREV_BLKP(bp))) +
                GET_SIZE(FTRP(NEXT_BLKP(bp)));
        PUT(HDRP(PREV_BLKP(bp)), PACK(size, 0));
        PUT(FTRP(NEXT_BLKP(bp)), PACK(size, 0));
        bp = PREV_BLKP(bp);
    }
    return bp;
}
```

**Allocating:**

```
void *mm_malloc(size_t size)
{
    size_t asize;       /* Adjusted block size */
    size_t extendsize;  /* Amount to extend heap if no fit */
    char *bp;

    /* Ignore spurious requests */
    if (size == 0)
        return NULL;

    /* Adjust block size to include overhead and alignment reqs. */
    if (size <= DSIZE)
        asize = 2*DSIZE;
    else
        asize = DSIZE * ((size + (DSIZE) + (DSIZE-1)) / DSIZE);

    /* Search the free list for a fit */
    if ((bp = find_fit(asize)) != NULL) {
        place(bp, asize);
        return bp;
    }

    /* No fit found. Get more memory and place the block */
    extendsize = MAX(asize, CHUNKSIZE);
    if ((bp = extend_heap(extendsize/WSIZE)) == NULL)
        return NULL;
    place(bp, asize);
    return bp;
}
```

The requested size is adjusted for header and footer overhead and double-word alignment: minimum 16 bytes (8 for alignment, 8 for header and footer); requests over 8 bytes add the overhead and round up to the nearest multiple of 8.

**find_fit and place** (first-fit search; split when the remainder would meet the 16-byte minimum):

```
static void *find_fit(size_t asize)
{
    void *bp;

    for (bp = heap_listp; GET_SIZE(HDRP(bp)) > 0; bp = NEXT_BLKP(bp)) {
        if (!GET_ALLOC(HDRP(bp)) && (asize <= GET_SIZE(HDRP(bp)))) {
            return bp;
        }
    }
    return NULL;  /* No fit */
}

static void place(void *bp, size_t asize)
{
    size_t csize = GET_SIZE(HDRP(bp));

    if ((csize - asize) >= (2*DSIZE)) {
        PUT(HDRP(bp), PACK(asize, 1));
        PUT(FTRP(bp), PACK(asize, 1));
        bp = NEXT_BLKP(bp);
        PUT(HDRP(bp), PACK(csize-asize, 0));
        PUT(FTRP(bp), PACK(csize-asize, 0));
    }
    else {
        PUT(HDRP(bp), PACK(csize, 1));
        PUT(FTRP(bp), PACK(csize, 1));
    }
}
```

### 9.9.13 Explicit Free Lists

Because allocation with an implicit free list is linear in the total number of heap blocks, it suits only special-purpose allocators with a small, known number of blocks. A better approach organizes free blocks into an explicit data structure whose pointers are stored inside the free blocks' bodies (unused by definition), e.g., a doubly linked free list with `pred` and `succ` pointers in each free block.

Allocation time drops from linear in total blocks to linear in the number of free blocks. Freeing time depends on the ordering policy:

| Ordering            | Free cost                                        | Utilization                                       |
| ------------------- | ------------------------------------------------- | -------------------------------------------------- |
| LIFO (insert at head) | Constant time (constant with boundary tags for coalescing) | Worse                                    |
| Address order       | Linear-time search for the predecessor            | Better; first fit approaches best-fit utilization |

Disadvantage: free blocks must hold the pointers plus header and possibly footer, increasing the minimum block size and the potential for internal fragmentation.

### 9.9.14 Segregated Free Lists

Segregated storage reduces allocation time by maintaining multiple free lists, each holding blocks of roughly equal size: the set of possible block sizes is partitioned into equivalence classes called size classes, e.g., by powers of 2

```
{1}, {2}, {3, 4}, {5–8}, ..., {1,025–2,048}, {2,049–4,096}, {4,097–∞}
```

or with each small size in its own class and powers of 2 for large blocks. The allocator maintains an array of free lists ordered by increasing size class; a request of size n searches the appropriate list, then the next larger, and so on.

**Simple segregated storage.** Each list holds blocks of exactly one size, the maximum of its class. To allocate, take the first block of the appropriate list; blocks are never split. If the list is empty, request a fixed-size chunk from the OS (typically a multiple of the page size), divide it into equal-size blocks, and link them. To free, insert the block at the front of its list.

Advantages: constant-time allocate and free; minimal per-block overhead, since same-size blocks per chunk with no splitting or coalescing mean block size can be inferred from address, allocated blocks need no header or footer, and singly linked lists suffice, giving a minimum block size of one word (the `succ` pointer). Disadvantage: susceptible to internal fragmentation (no splitting) and severe external fragmentation (no coalescing).

**Segregated fits.** Each list is associated with a size class, organized as an explicit or implicit list of potentially different-size blocks within the class. To allocate, determine the size class and do a first-fit search of its list; on success, optionally split and insert the fragment into the appropriate list; on failure, search the next larger class; if no list yields a fit, request additional heap memory, allocate from it, and place the remainder in the largest class. To free, coalesce and place the result on the appropriate list. Segregated fits is fast (searches are limited to parts of the heap) and memory efficient (first fit on a segregated list approximates best fit on the whole heap); it is the popular choice for production allocators such as GNU malloc.

**Buddy systems.** A special case of segregated fits with power-of-2 size classes. Given a heap of 2^m words, maintain a free list per block size 2^k, 0 ≤ k ≤ m; round requests up to powers of 2. To allocate 2^k, find the first available block of size 2^j, k ≤ j ≤ m, and recursively split in half until j = k, placing each remaining half (a buddy) on its free list. To free, coalesce with free buddies, stopping at an allocated buddy. The addresses of a block and its buddy differ in exactly one bit position (a 32-byte block at `xxx...x00000` has its buddy at `xxx...x10000`), so buddies are computed trivially. Advantage: fast searching and coalescing. Disadvantage: power-of-2 sizes cause significant internal fragmentation, so buddy systems suit only workloads whose block sizes are known powers of 2.

## 9.10 Garbage Collection

With explicit allocators, forgetting to free a block that is no longer needed creates garbage: memory that remains allocated for the lifetime of the program, needlessly occupying heap space.

A garbage collector is a dynamic storage allocator that automatically frees allocated blocks (garbage) no longer needed by the program. In a garbage-collected system, applications explicitly allocate but never explicitly free; in C terms, the application calls `malloc` but never `free`, and the collector periodically identifies garbage blocks and calls `free` on them. Garbage collection dates to Lisp systems developed by John McCarthy at MIT in the early 1960s and is integral to Java, ML, Perl, and Mathematica. The discussion covers McCarthy's original Mark&Sweep algorithm, which can be built on top of an existing malloc package to provide collection for C and C++ programs.

### 9.10.1 Garbage Collector Basics

A collector views memory as a directed reachability graph. Nodes are partitioned into root nodes and heap nodes; each heap node corresponds to an allocated heap block. A directed edge p → q means some location in block p points to some location in block q. Root nodes are locations outside the heap containing pointers into the heap: registers, stack variables, and global variables in the read/write data area.

A node p is reachable if a directed path exists from some root node to p. Unreachable nodes are garbage that can never be used again. The collector maintains some representation of the reachability graph and periodically reclaims unreachable nodes, returning them to the free list.

| Collector type | Languages                    | Property                                                                                        |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Exact          | ML, Java                      | Tight control over pointer creation and use permits an exact reachability graph; reclaims all garbage |
| Conservative   | C, C++                        | Every reachable block is correctly identified as reachable, but some unreachable blocks may be incorrectly retained |

Collectors can run on demand or as separate threads in parallel with the application. Integration with a C malloc package: the application calls `malloc` as usual; if `malloc` cannot find a fit, it invokes the collector, which identifies garbage and returns it to the heap by calling `free` (the collector, not the application, calls `free`); `malloc` then retries, asks the OS for more memory if necessary, and returns a pointer or NULL.

### 9.10.2 Mark&Sweep Garbage Collectors

A Mark&Sweep collector runs a mark phase, marking all reachable and allocated descendants of the root nodes, followed by a sweep phase, freeing each unmarked allocated block. A spare low-order bit in the block header typically serves as the mark bit. Assumed helpers (with `typedef void *ptr`):

| Function              | Behavior                                                                       |
| --------------------- | ------------------------------------------------------------------------------ |
| `isPtr(p)`            | If p points into an allocated block, returns a pointer b to the block start; else NULL |
| `blockMarked(b)`      | True if block b is already marked                                              |
| `blockAllocated(b)`   | True if block b is allocated                                                   |
| `markBlock(b)`        | Marks block b                                                                  |
| `length(b)`           | Length of b in words, excluding the header                                     |
| `unmarkBlock(b)`      | Changes b from marked to unmarked                                              |
| `nextBlock(b)`        | Successor of b in the heap                                                     |

```
void mark(ptr p) {
    ptr b;

    if ((b = isPtr(p)) == NULL)
        return;
    if (blockMarked(b))
        return;
    markBlock(b);
    len = length(b);
    for (i = 0; i < len; i++)
        mark(b[i]);
    return;
}

void sweep(ptr b, ptr end) {
    while (b < end) {
        if (blockMarked(b))
            unmarkBlock(b);
        else if (blockAllocated(b))
            free(b);
        b = nextBlock(b);
    }
    return;
}
```

The mark phase calls `mark` once per root node; each call marks the unmarked reachable descendants of that root, recursing on every word of every marked block. At the end of the mark phase, any allocated unmarked block is guaranteed unreachable, hence garbage. The sweep phase iterates over every heap block, freeing unmarked allocated blocks.

### 9.10.3 Conservative Mark&Sweep for C Programs

Mark&Sweep suits C because it works in place without moving blocks. The C language complicates `isPtr`:

1. C does not tag memory with type information, so there is no way to determine whether an input word p is a pointer.
2. Even for a known pointer, there is no obvious way to determine whether p points into the payload of an allocated block.

A solution to the second problem: maintain the set of allocated blocks as a balanced binary tree ordered by address (blocks in the left subtree at smaller addresses, right subtree at larger). Each allocated block header gains two fields, `left` and `right`, pointing to the headers of other allocated blocks; `isPtr` performs a binary search, using the size field at each step to decide whether p falls within the block's extent.

The first problem is why C collectors must be conservative: scalars can masquerade as pointers. If a reachable block contains an `int` whose value happens to equal an address in the payload of some unrelated allocated block b, the collector cannot infer that it is not a pointer and must conservatively treat b as reachable.

## 9.11 Common Memory-Related Bugs in C Programs

Memory-related bugs are among the most frightening because they often manifest at a distance, in time and space, from their source: write the wrong data to the wrong location and the program may run for hours before failing in a distant part of the code.

**Dereferencing bad pointers.** Large holes in the virtual address space map to nothing; dereferencing into a hole terminates the program with a segmentation exception, and writing a read-only area terminates it with a protection exception. Classic scanf bug: `scanf("%d", val)` instead of `scanf("%d", &val)` passes the contents of `val` as an address.

**Reading uninitialized memory.** bss locations (uninitialized globals) are zeroed by the loader; heap memory is not. Assuming `malloc`ed memory is zero (e.g., accumulating into `y[i] +=` without zeroing `y`) is an error; explicitly zero or use `calloc`.

**Allowing stack buffer overflows.** Writing to a stack buffer without checking the input size, e.g., `gets(buf)` into `char buf[64]`; use `fgets`, which limits input length.

**Assuming pointers and the objects they point to are the same size.** `Malloc(n * sizeof(int))` for an array of `int *` works where `sizeof(int) == sizeof(int *)` but overruns the array on machines like the Core i7 where pointers are larger. The overrun likely clobbers the boundary-tag footer of the block, so the failure surfaces only when the block is freed much later, when the allocator's coalescing code fails dramatically: action at a distance.

**Making off-by-one errors.** Allocating an n-element array and initializing with `for (i = 0; i <= n; i++)` overwrites memory beyond the array.

**Referencing a pointer instead of the object it points to.** `*size--` decrements the pointer, not the integer it points to, because unary `--` and `*` have the same precedence and associate right to left; the intent requires `(*size)--`. Use parentheses whenever in doubt about precedence and associativity.

**Misunderstanding pointer arithmetic.** Pointer arithmetic operates in units of the pointed-to object size, not bytes: `p += sizeof(int)` on an `int *` advances 4 elements, scanning every fourth integer; the correct increment is `p++`.

**Referencing nonexistent variables.** Returning `&val` for a local stack variable yields a pointer to a valid address that no longer refers to a valid variable; after the frame is reused by later calls, writes through the pointer corrupt some other function's stack frame with disastrous and baffling consequences.

**Referencing data in free heap blocks.** Referencing a block after freeing it: depending on intervening `malloc` and `free` calls, the memory may belong to some other allocated block and may have been overwritten.

**Introducing memory leaks.** Allocating blocks and returning without freeing them. Frequent leaks gradually fill the heap with garbage, in the worst case consuming the entire virtual address space; leaks are particularly serious in daemons and servers, which never terminate.

## 9.12 Summary

Virtual memory is an abstraction of main memory. The processor generates virtual addresses that are translated into physical addresses before reaching main memory; dedicated hardware translates them using page tables whose contents are supplied by the operating system. VM provides three capabilities: it caches recently used pages of the disk-resident virtual address space in main memory (a miss is a page fault, handled by a kernel fault handler that copies the page in, writing back the evicted page if necessary); it simplifies memory management, and thereby linking, data sharing, allocation, and program loading; and it simplifies protection via permission bits in every PTE. Translation integrates with hardware caches: most PTEs are found in L1, and the TLB, an on-chip cache of PTEs, usually eliminates even that cost.

Memory mapping initializes virtual memory areas with the contents of file system objects, providing an efficient mechanism for sharing data, creating processes, and loading programs. The `mmap` function lets applications create and delete areas manually, but most programs rely on a dynamic memory allocator managing the heap. Allocators are explicit (the application frees blocks, as in `malloc`) or implicit (garbage collectors free unused, unreachable blocks automatically), and their design balances throughput against memory utilization while contending with internal and external fragmentation.

Managing and using memory is a difficult and error-prone task for C programmers. Common errors: dereferencing bad pointers, reading uninitialized memory, stack buffer overflows, assuming pointers and their referents have the same size, referencing a pointer instead of its referent, misunderstanding pointer arithmetic, referencing nonexistent variables, referencing freed blocks, and memory leaks.
