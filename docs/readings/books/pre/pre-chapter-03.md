# Chapter 3. The Windows Kernel

Reverse engineering Windows drivers is roughly 90% knowing how Windows works and 10% reading assembly. Because drivers interact with the OS through well-defined interfaces, the analytical task decomposes into: understanding core OS components, the structure of a driver, the user–driver and driver–OS interfaces, how driver constructs appear in binary form, and applying that knowledge to a target. Unless noted, examples are taken from Windows 8 RTM.

## Memory Layout

Windows splits the virtual address space into user and kernel halves. Running processes see only their user space; kernel-mode code sees both. The kernel half is largely identical across all process contexts (session and hyperspace ranges vary). User and kernel pages are distinguished by a bit in the page table entry.

| Architecture | User space                    | Kernel space                    | First usable kernel address |
| ------------ | ----------------------------- | ------------------------------- | --------------------------- |
| x86 / ARM    | `0` – `0x7fffffff` (lower 2GB) | `0x80000000`+ (upper 2GB)       | `0x80000000`                |
| x64          | `0` – `0x000007ff'ffffffff`   | `0xffff0800'00000000`+          | `0xffff8000'00000000`       |

- `MmSystemRangeStart` and `MmHighestUserAddress` hold the kernel start and user end; both are viewable in a kernel debugger.
- On x86/ARM a 64KB **no-access region** sits between the two halves so the kernel cannot accidentally cross into user memory.
- On x64 the separator `0xffff0800'00000000` is a non-canonical (unusable) address; real kernel memory begins at `0xffff8000'00000000`.
- Per-process translation uses the page directory base register: **CR3** on x86/x64, **TTBR** on ARM. It is reloaded on context switch so each process sees its own user space.

!!! note "/3GB switch"
    The boot option `/3GB` enlarges user space to 3GB and shrinks the kernel to 1GB.

## Processor Initialization (PCR and PRCB)

At boot the kernel performs per-processor initialization built around two undocumented structures.

| Structure | Scope          | Holds                                                                    |
| --------- | -------------- | ------------------------------------------------------------------------ |
| PCR (`_KPCR`)  | Per-processor | IDT base (x86), current IRQL, self-pointer, pointer to the PRCB          |
| PRCB (`_KPRCB`) | Per-processor | CPU type/model/speed, current thread, next thread, DPC queue, timer table |

The PCR is always reachable from kernel mode through a segment or coprocessor register.

| Architecture | PCR access register |
| ------------ | ------------------- |
| x86          | `FS`                |
| x64          | `GS`                |
| ARM          | system coprocessor  |

On x64 the PRCB begins at offset `0x180` of the PCR, and `CurrentThread` is at `+0x8` of the PRCB — hence `gs:[0x188]`.

```asm
PsGetCurrentThread:
    mov rax, gs:188h            ; PCR(gs:0) + PRCB(0x180) + CurrentThread(0x8)
    ret

PsGetCurrentProcess:
    mov rax, gs:188h            ; current ETHREAD
    mov rax, [rax+0B8h]         ; ETHREAD.ApcState.Process
    ret
```

## System Calls

A system call is a kernel function that services an I/O request from user mode; it runs in the kernel because only privileged code can manage the underlying resources. User-mode APIs ultimately decompose into one or more system calls.

### Service Tables

Windows describes syscalls with a **service table descriptor** plus an array of function pointers or offsets. A syscall number is an index into that array.

```c
typedef struct _KSERVICE_TABLE_DESCRIPTOR {
    PULONG Base;    // array of addresses (x86) or encoded offsets (x64/ARM)
    PULONG Count;
    ULONG  Limit;   // number of entries
    PUCHAR Number;
    ...
} KSERVICE_TABLE_DESCRIPTOR, *PKSERVICE_TABLE_DESCRIPTOR;
```

| Global descriptor                    | Contains                                    |
| ------------------------------------ | ------------------------------------------- |
| `KeServiceDescriptorTable`           | Native (non-GUI) syscall table only         |
| `KeServiceDescriptorTableShadow`     | Native table **and** the GUI (win32k) table |

| Global table pointer  | Target                       |
| --------------------- | ---------------------------- |
| `KiServiceTable`      | Non-GUI syscall array        |
| `W32pServiceTable`    | GUI (win32k) syscall array   |

- **x86:** `Base` is a plain array of function pointers.
- **x64 / ARM:** `Base` is an array of 32-bit integers. The top 20 bits encode the offset from `KiServiceTable`; the bottom 4 bits encode the count of stack arguments.

```text
real_address = KiServiceTable + (KiServiceTable[index] >> 4)
stack_args   = KiServiceTable[index] & 0xF
```

!!! example "Resolving NtCreateFile on x64"
    `NtCreateFile` uses syscall number `0x53` and takes 11 arguments (4 in registers, 7 on the stack, so the low nibble is `7`). Its encoded entry `KiServiceTable[0x53]` is `0x03ea2c07`; the address is `KiServiceTable + (0x03ea2c07 >> 4)`.

### Dispatch Mechanisms

The concept is uniform; the transition instruction and dispatcher differ by platform.

| Platform         | Trigger      | Dispatcher entry     | Notes                                                                    |
| ---------------- | ------------ | -------------------- | ------------------------------------------------------------------------ |
| x86 (pre-P2)     | `INT 2Eh`    | `KiSystemService`    | IDT vector `0x2e`. Legacy path.                                          |
| x86              | `SYSENTER`   | `KiFastCallEntry`    | Entry from MSR `0x176`.                                                  |
| x64              | `SYSCALL`    | `KiSystemCall64`     | Entry from `IA32_LSTAR` MSR (`0xC0000082`).                             |
| ARM              | `SVC` (`SWI`) | `KiSWIException`     | Reached through the exception vector table.                             |

- **INT 2E path:** the stub reads `KUSER_SHARED_DATA.SystemCall` (at `0x7ffe0300`) and calls it. `KUSER_SHARED_DATA` is mapped at `0x7ffe0000` in every process. The IDT entry `0x2e` points at `KiSystemService`.
- **SYSCALL (x64):** the stub sets `R10 = RCX` (SYSCALL overwrites `RCX` with the return address) and `EAX = syscall number`, then executes `SYSCALL`. `KiSystemCall64` swaps to the kernel stack, saves user context, copies stack arguments, indexes `KiServiceTable`/`W32pServiceTable`, invokes the call, and returns via `SYSRET` (which restores `RIP` from `RCX`).
- **SYSENTER (x86):** unlike SYSCALL, `SYSENTER` saves no return address in a register. The return address is already on the stack; the stub stores the stack pointer in `EDX` before entering. `SYSEXIT` sets `EIP = EDX` (`ntdll!KiSystemCallRet`) and `ESP = ECX`.
- **SVC (ARM):** the syscall number is placed in `R12`. `KiSWIException` builds a `_KTRAP_FRAME`, saves the return address (already in `LR`) and syscall number in the thread, then branches to `KiSystemService`; return is via `KiSystemServiceExit`.

## Faults, Traps, and Interrupts

| Event               | Source     | Timing        | Resumes at                        |
| ------------------- | ---------- | ------------- | --------------------------------- |
| Hardware interrupt  | Device     | Asynchronous  | Instruction after the interrupted one |
| Fault               | Instruction | Synchronous  | The **same** instruction (re-executed after correction) |
| Trap                | Instruction | Synchronous  | The instruction **after** the trap |

A **fault** is a correctable exception (e.g., a page fault: save state, page in the data, re-execute). A **trap** is caused by a special instruction (e.g., `SYSCALL`). The defining difference is where execution resumes. System calls are implemented through traps or dedicated exceptions.

### The IDT

The Intel architecture defines a 256-entry **interrupt descriptor table**; its base lives in `IDTR`. An interrupt number indexes the table.

| Vector      | Meaning              |
| ----------- | -------------------- |
| `0x0`       | Divide error         |
| `0x3`       | Software breakpoint  |
| `0xe`       | Page fault           |
| `32`–`255`  | User-defined         |

```c
// x86 _KIDTENTRY (8 bytes) — handler address is split across two fields
+0x000 Offset          : Uint2B
+0x002 Selector        : Uint2B
+0x004 Access          : Uint2B
+0x006 ExtendedOffset  : Uint2B   // handler = (ExtendedOffset << 16) | Offset
```

On x64 the handler address is divided across three members (`_KIDTENTRY64`), and `IDTR` is 48 bits wide (base + limit). In WinDbg, `!idt 0x2e` shows which routine services a vector.

## Interrupt Request Level (IRQL)

IRQL is a per-processor number (type `KIRQL`, a `UCHAR`) that orders interrupt handling. An interrupt at IRQL *X* masks every interrupt below *X*. IRQL is **per-processor, not per-thread**; different processors may run at different IRQLs simultaneously. It is unrelated to thread priority.

| IRQL              | Value | Runs                                                       |
| ----------------- | ----- | ---------------------------------------------------------- |
| `PASSIVE_LEVEL`   | 0     | All user-mode and most kernel code                        |
| `APC_LEVEL`       | 1     | Asynchronous procedure calls                              |
| `DISPATCH_LEVEL`  | 2     | Thread dispatcher and DPCs; **code here cannot wait**     |
| (hardware / IPI)  | >2    | Device interrupts; `IPI_LEVEL` for inter-processor signals |

IRQL maps onto hardware. On x86/x64 the LAPIC exposes a writable **task priority register (TPR)** and a read-only **processor priority register (PPR)**; the CPU delivers only interrupts whose priority exceeds the PPR. `KeRaiseIrql`/`KeLowerIrql` program the TPR. On x64, `CR8` is a shadow of the LAPIC TPR:

```asm
KzRaiseIrql:  mov rax, cr8      ; return old IRQL
              movzx ecx, cl
              mov cr8, rcx
              ret
KzLowerIrql:  movzx eax, cl
              mov cr8, rax
              ret
```

Code at a high IRQL cannot be preempted by code at a lower IRQL.

## Pool Memory

Pool memory is the kernel's run-time heap, allocated and freed with the `ExAllocatePool*` / `ExFreePool*` families.

| Pool type          | Pageable | Consequence                                       |
| ------------------ | -------- | ------------------------------------------------- |
| Paged pool         | Yes      | Access may fault and page in from disk            |
| Non-paged pool     | No       | Access never faults; safe at `DISPATCH_LEVEL`+    |

Code at `DISPATCH_LEVEL` must reside in and touch only non-paged memory: a page fault would invoke the fault handler, which needs the dispatcher (itself running at `DISPATCH_LEVEL`), producing a bugcheck.

| Pool                          | x86  | x64  | ARM  |
| ----------------------------- | ---- | ---- | ---- |
| `NonPagedPool`                | RWX  | RWX  | NX   |
| `NonPagedPoolNX` (Win 8)      | RW   | RW   | RW   |
| Paged pool                    | RWX  | NX   | NX   |

## Memory Descriptor Lists (MDLs)

An MDL describes the set of physical pages backing a virtual address range. Each entry describes one contiguous buffer; entries can be chained. To use one: allocate (`IoAllocateMdl`), probe and lock the pages (`MmProbeAndLockPages`), then map them (`MmMapLockedPagesSpecifyCache`).

Two common uses:

- Map kernel memory into a process's user space (or vice versa).
- Remap read-only pages (e.g., a code section) at a second virtual address **with write permission** — a kernel-mode equivalent of `VirtualProtect`.

## Processes and Threads

A thread is defined by two structures; likewise a process. In each pair the `K`-structure (scheduling data) is embedded at the start of the `E`-structure (housekeeping data). All are opaque, and field offsets change between releases.

| Object  | `E`-structure (housekeeping)                    | `K`-structure (scheduling)                          |
| ------- | ----------------------------------------------- | --------------------------------------------------- |
| Thread  | `ETHREAD` — thread id, owning process, debug state | `KTHREAD` (`Tcb` at `+0`) — stack, target processor, alertable state |
| Process | `EPROCESS` — pid, token, thread list, `ActiveProcessLinks` | `KPROCESS` (`Pcb` at `+0`) — directory table base, ideal processor, times |

The scheduler operates on threads. User-mode analogues store per-process/per-thread data: the **PEB** (`ntdll!_PEB`: base load address, loaded modules, heaps) and the **TEB** (`ntdll!_TEB`: thread scheduling data and process pointers).

| Access                          | x86           | x64          | ARM                        |
| ------------------------------- | ------------- | ------------ | -------------------------- |
| Current thread (kernel)         | `fs:124h`     | `gs:188h`    | coprocessor 15 (c13)       |
| TEB (user)                      | `fs:18h`      | `gs:30h`     | coprocessor 15 (c13)       |

!!! warning "Rootkit relevance"
    Rootkits modify undocumented fields directly — e.g., unlinking a process from `EPROCESS.ActiveProcessLinks` to hide it. Because the structures are opaque, hardcoded offsets break across builds.

## Execution Context

Every thread runs in an execution context: an address space, security token, and other thread properties. In kernel mode the context determines which address space and privileges apply.

| Context   | Meaning                                                        |
| --------- | ------------------------------------------------------------- |
| Thread    | A specific thread (usually the requesting user thread)        |
| System    | A thread in the System process                                |
| Arbitrary | Whatever thread happened to be running                        |

| Situation                          | Context                       |
| ---------------------------------- | ----------------------------- |
| `DriverEntry`                      | System                        |
| IOCTL handler                      | Thread (requestor)            |
| APC                                | Thread (where queued)         |
| DPC / timer                        | Arbitrary                     |
| Work item                          | System                        |
| System thread (`ProcessHandle` NULL) | System                      |

To run in another process's address space, a driver calls `KeStackAttachProcess` (useful for reading/writing that process's memory).

## Kernel Synchronization Primitives

| Primitive  | Structure                     | Init                              | Notes                                                             |
| ---------- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Event      | `KEVENT`                      | `KeInitializeEvent`               | Signaled / non-signaled; waited on with `KeWaitForSingleObject`   |
| Timer      | `KTIMER`                      | `KeInitializeTimer[Ex]`           | Optional DPC on expiry; per-processor `TimerTable` in the PRCB    |
| Mutex      | `FAST_MUTEX` / `GUARDED_MUTEX` | `ExInitialize{Fast,Guarded}Mutex` | Exclusive access; guarded mutexes are faster (Windows 2003+)      |
| Spin lock  | `KSPIN_LOCK`                  | `KeInitializeSpinLock`            | For resources touched at `DISPATCH_LEVEL`+; holder and its memory must be resident |

## Linked Lists

Linked lists underlie most dynamic kernel data structures (loaded-module list, active-process list, wait queues, DPC/timer queues). The WDK exposes three list types; all share the same source-level usage.

| List type                    | Structure  | Property                                    |
| ---------------------------- | ---------- | ------------------------------------------- |
| Singly-linked                | `Next`     | One forward pointer                         |
| Sequenced singly-linked      | `Next`     | Singly-linked with atomic operations        |
| Circular doubly-linked       | `LIST_ENTRY` | Forward (`Flink`) and backward (`Blink`) — the common case |

```c
typedef struct _LIST_ENTRY {
    struct _LIST_ENTRY *Flink;   // +0x0
    struct _LIST_ENTRY *Blink;   // +0x8 (x64) / +0x4 (x86)
} LIST_ENTRY, *PLIST_ENTRY;
```

A `LIST_ENTRY` acts as either a list head (stores no payload) or a list entry (embedded inside a larger structure). List routines operate only on the `LIST_ENTRY`; to reach the enclosing record use `CONTAINING_RECORD`.

!!! note "List routines are always inlined"
    `InitializeListHead`, `InsertHeadList`, `InsertTailList`, `RemoveHeadList`, `RemoveTailList`, `RemoveEntryList`, and `IsListEmpty` are inlined by the compiler. They never appear as a `call`/branch target, so they must be recognized by their code pattern.

`InitializeListHead` sets both pointers to the head — recognizable as two write-only stores at `+0` and `+Blink` using one register:

```asm
; x64
lea r11, [rbx+48h]
mov [r11+8], r11        ; Blink = head
mov [r11], r11          ; Flink = head
```

`CONTAINING_RECORD` recovers the base of the enclosing structure from a pointer to one of its fields:

```c
#define CONTAINING_RECORD(address, type, field) \
    ((type *)((PCHAR)(address) - (ULONG_PTR)(&((type *)0)->field)))
```

!!! example "Walk-through: locating PsLoadedModuleList (Windows XP)"
    A rootkit reads the PCR at the hardcoded address `0xFFDFF000`, follows `KdVersionBlock` at `+0x34`, and reads `+0x70` to obtain the head of `PsLoadedModuleList`. It then walks the list (entries of type `KLDR_DATA_TABLE_ENTRY`, whose first field is a `LIST_ENTRY`) matching `FullDllName` against the substring `"krnl"` to find the NT kernel image.

    Fragilities of this approach: the PCR/`KdVersionBlock` offsets are XP-specific; `KdVersionBlock` is valid only for the first processor's PCR (crashes if rescheduled elsewhere); the `KLDR_DATA_TABLE_ENTRY` layout is undocumented; the offsets differ on x64; and the unlocked walk can hit a unlinked/stale module. The documented `AuxKlibQueryModuleInformation` achieves the same goal safely.

---

## Asynchronous and Ad-Hoc Execution

Mechanisms a driver uses to run code later, elsewhere, or in response to events.

### System Threads

Created with `PsCreateSystemThread`. A **NULL** `ProcessHandle` creates the thread in the System process with the supplied start routine. Used for background work or waiting on events.

### Work Items

A lighter alternative to a dedicated thread: no thread object is created. A work item is an entry on a queue drained by a pool of pre-existing system threads (`ExpWorkerThread`).

```c
0: kd> dt nt!_IO_WORKITEM
    +0x000 WorkItem : _WORK_QUEUE_ITEM   // list entry + routine + parameter
    +0x020 Routine  : Ptr64 void
    +0x028 IoObject : Ptr64 Void
    +0x030 Context  : Ptr64 Void
```

- Allocate with `IoAllocateWorkItem` (non-paged pool), queue with `IoQueueWorkItem`.
- Queues hang off each processor's node: `KPRCB.ParentNode` → `KNODE` → `ENODE.ExWorkerQueues[7]` (`_EX_WORK_QUEUE`).
- Work items run in the **System** process context at **`PASSIVE_LEVEL`** (because `ExpWorkerThread` does).
- Common pattern: queue a work item from inside a DPC (to escape `DISPATCH_LEVEL`).

### Asynchronous Procedure Calls (APCs)

APCs are functions executed in a particular thread context; they are always associated with an `ETHREAD`. Undocumented from a kernel perspective.

| APC kind          | IRQL             | Mode   | Executes when                        |
| ----------------- | ---------------- | ------ | ------------------------------------ |
| Kernel, normal    | `PASSIVE_LEVEL`  | Kernel | Scheduled                            |
| Kernel, special   | `APC_LEVEL`      | Kernel | Scheduled                            |
| User              | `PASSIVE_LEVEL`  | User   | Thread enters an **alertable** state |

An APC is a `KAPC`, initialized by `KeInitializeApc` and queued with `KeInsertQueueApc`. The `Environment` parameter (`OriginalApcEnvironment`, `AttachedApcEnvironment`, …) selects the process context. The two queues live in `KTHREAD.ApcState` (`_KAPC_STATE.ApcListHead[2]`: kernel and user).

- **Thread suspension** is implemented with an APC: `KTHREAD.SchedulerApc`, initialized in `KeInitThread` with `KiSchedulerApc` as its normal routine, waits on the thread's `SuspendEvent`; `KeResumeThread` releases it.
- Rootkits queue **user-mode APCs** to inject code into user mode from the kernel.

### Deferred Procedure Calls (DPCs)

DPCs run at `DISPATCH_LEVEL`, in **arbitrary** thread context, on a specific processor. The canonical use: an ISR runs at high IRQL, queues a DPC, and returns immediately so the system can service other interrupts; the DPC then does the deferred work (often by queuing a work item).

```c
0: kd> dt nt!_KDPC
    +0x000 Type            : UChar      // normal or threaded
    +0x001 Importance      : UChar      // position in the queue (KeSetImportanceDpc)
    +0x002 Number          : Uint2B     // target processor (KeSetTargetProcessorDpc)
    +0x008 DpcListEntry    : _LIST_ENTRY
    +0x018 DeferredRoutine : Ptr64 void // runs at DISPATCH_LEVEL
    +0x020 DeferredContext : Ptr64 Void
    +0x028 SystemArgument1 : Ptr64 Void
    +0x030 SystemArgument2 : Ptr64 Void
    +0x038 DpcData         : Ptr64 Void // -> _KDPC_DATA
```

- Init with `KeInitializeDpc`, queue with `KeInsertQueueDpc`. Each core keeps its queues in `KPRCB.DpcData[2]` (`[0]` normal, `[1]` threaded); each `KDPC_DATA` tracks `DpcListHead`, `DpcLock`, `DpcQueueDepth`, `DpcCount`.
- Three processing paths: the idle loop (`KiIdleLoop` → `KiRetireDpcList`); on IRQL drop to `DISPATCH_LEVEL` (`KiDispatchInterrupt`); and a per-processor DPC thread created by `KiStartDpcThread` (`KiExecuteDpc`).
- A DPC **cannot wait** and **cannot take a page fault**: `KeWaitForSingleObject` and `KeDelayExecutionThread` are forbidden, since the dispatcher itself runs at `DISPATCH_LEVEL`.

!!! warning "DPC watchdog"
    A DPC that runs too long bugchecks with `DPC_WATCHDOG_VIOLATION` (`0x133`). Query the timer with `KeQueryDpcWatchdogInformation`.

### Timers

A timer signals that an interval has elapsed, once or periodically, optionally firing a DPC on expiry.

```c
0: kd> dt nt!_KTIMER
    +0x000 Header        : _DISPATCHER_HEADER
    +0x018 DueTime       : _ULARGE_INTEGER
    +0x020 TimerListEntry: _LIST_ENTRY
    +0x030 Dpc           : Ptr64 _KDPC
    +0x038 Processor     : Uint4B
    +0x03c Period        : Uint4B
```

- `KeInitializeTimer`, then `KeSetTimer` (one-shot) or `KeSetTimerEx` (recurring). Cancel with `KeCancelTimer`.
- Timers queue into the PRCB's `TimerTable` (`_KTIMER_TABLE`). On each clock interrupt the system checks for expiring entries and requests a DPC interrupt to process them — so timers are serviced at `DISPATCH_LEVEL`.
- OS examples: `ExpTimeRefreshDpcRoutine` (time sync / license check), `ExpCenturyDpcRoutine` (century rollover).

### Process, Thread, and Image Callbacks

Drivers register notifications through documented APIs: `PsSetCreateProcessNotifyRoutine`, `PsSetCreateThreadNotifyRoutine`, `PsSetLoadImageNotifyRoutine`.

- `PspInitializeCallbacks` builds three global arrays (`PspCreateProcessNotifyRoutine`, `PspCreateThreadNotifyRoutine`, `PspLoadImageNotifyRoutine`); registrations land here.
- A global flag `PspNotifyEnableMask` gates which notifications are live; it is checked on the thread creation/termination paths (`PspInsertThread`, `PspExitThread`).
- The object and configuration managers expose their own callbacks via `ObRegisterCallbacks` and `CmRegisterCallback`.
- Antivirus products use these to monitor the system; rootkits pair them with APCs to inject into new processes.

### Completion Routines

Notify a driver that an IRP completed, was cancelled, or failed. Run in arbitrary context and set with `IoSetCompletionRoutine[Ex]`.

`IoSetCompletionRoutine` is **forced-inline** — it never appears in an import table or as a call. Recognize it by a write to the `CompletionRoutine` field of an `IO_STACK_LOCATION`. Its three boolean parameters map to `Control` flags `SL_INVOKE_ON_SUCCESS`, `SL_INVOKE_ON_ERROR`, `SL_INVOKE_ON_CANCEL`. The I/O manager invokes the routine from `IopfCompleteRequest`.

### I/O Request Packets (IRPs)

An IRP describes an I/O request and is the unit of communication between layered devices. It has two parts:

| Part    | Contents                                                                          |
| ------- | --------------------------------------------------------------------------------- |
| Static  | The `IRP` header: requestor mode, thread, status block, user buffer               |
| Dynamic | An array of `IO_STACK_LOCATION` structures, one per device in the stack           |

```c
0: kd> dt nt!_IO_STACK_LOCATION
    +0x000 MajorFunction    : UChar
    +0x001 MinorFunction    : UChar
    +0x002 Flags            : UChar
    +0x003 Control          : UChar
    +0x008 Parameters       : <union — depends on major/minor function>
    +0x028 DeviceObject     : Ptr64 _DEVICE_OBJECT
    +0x030 FileObject       : Ptr64 _FILE_OBJECT
    +0x038 CompletionRoutine: Ptr64 long
    +0x040 Context          : Ptr64 Void
```

!!! note "The 'next' stack location is above the current one"
    The next `IO_STACK_LOCATION` is the array element **immediately above** (lower address than) the current one. `IoGetCurrentIrpStackLocation`, `IoGetNextIrpStackLocation`, and `IoSkipCurrentIrpStackLocation` are pointer arithmetic over this array. On x64, `sizeof(_IO_STACK_LOCATION) == 0x48`.

A driver can also build an IRP from scratch (`IoAllocateIrp`), fill in the major/minor code and stack location, and send it downstream with `IoCallDriver` — a technique rootkits use to reach the file-system driver directly and bypass syscall hooks.

---

## Structure of a Driver

A driver is code loaded into kernel space that runs at kernel privilege. It has no main thread; it is a collection of routines the kernel calls under defined circumstances — much like a DLL.

| Driver type                    | Role                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| Legacy software driver         | Ring-0 code interfacing the kernel; most rootkits and security drivers  |
| Legacy filter driver           | Attaches to another driver to modify its input                          |
| File system minifilter driver  | Intercepts file I/O (AV scanning, on-disk encryption)                   |

The standard model is **WDM** (Windows Driver Model), defining required interfaces and rules since Windows 2000. **WDF** is a library layer on top of WDM: **KMDF** (kernel-mode) and **UMDF** (user-mode). Analyzed drivers are WDM-based.

### Entry Point and DRIVER_OBJECT

Every driver has an entry point (conventionally `DriverEntry`) called by the I/O manager after the image is mapped and a `DRIVER_OBJECT` is created.

```c
NTSTATUS DriverEntry(PDRIVER_OBJECT DriverObject, PUNICODE_STRING RegistryPath);
```

The primary job of `DriverEntry` is to initialize driver state and register IRP dispatch routines in `MajorFunction`.

| `DRIVER_OBJECT` field | x86 offset | Meaning                                             |
| --------------------- | ---------- | --------------------------------------------------- |
| `DriverUnload`        | `0x34`     | Unload routine (absent → driver stays until reboot) |
| `MajorFunction[28]`   | `0x38`     | Array of IRP dispatch handlers, indexed by `IRP_MJ_*` |

Uninitialized `MajorFunction` slots default to `IopInvalidDeviceRequest`, which returns an error. `RegistryPath` is the driver's registry key. Many rootkits omit an unload routine.

### Driver and Device Objects

A driver may create one or more device objects (`IoCreateDevice`, usually in `DriverEntry`). Without a device object, nothing can send it requests.

```c
typedef struct _DEVICE_OBJECT {
    ...
    struct _DRIVER_OBJECT *DriverObject;    // owning driver
    struct _DEVICE_OBJECT *NextDevice;      // next device on this driver
    struct _DEVICE_OBJECT *AttachedDevice;  // device we are attached to
    ...
    PVOID DeviceExtension;                   // driver-specific data (non-paged pool)
    ...
} DEVICE_OBJECT, *PDEVICE_OBJECT;
```

- `DeviceExtension` is a driver-defined structure whose size is passed to `IoCreateDevice`; **recovering its layout is a top analysis priority**.
- A device can **attach** to another (`IoAttachDevice` family) so IRPs bound for the target are routed to the attacher first — the basis of filter drivers.

### IRP Handling

Dispatch routines share one prototype:

```c
NTSTATUS XxxDispatch(PDEVICE_OBJECT DeviceObject, PIRP Irp);
```

A handler reads its `IO_STACK_LOCATION` (`IoGetCurrentIrpStackLocation`), inspects the major function and parameters, and then either completes the request (`IoCompleteRequest`), returns an error, forwards the IRP (`IoCallDriver`), or pends it. To forward the same IRP it must either copy the current parameters to the next location (`IoCopyCurrentIrpStackLocationToNext`) or skip (`IoSkipCurrentIrpStackLocation`).

!!! note "STATUS_PENDING (0x103)"
    A driver returns `STATUS_PENDING` (`0x103`) when the operation is incomplete and awaiting another driver. Recognize this constant when analyzing dispatch routines.

### User–Kernel Communication (IOCTL)

Several channels exist (shared memory, events, custom interrupt handlers), but the standard interface is **device I/O control** over `IRP_MJ_DEVICE_CONTROL`, invoked from user mode via `DeviceIoControl`.

1. The driver defines an IOCTL code per operation.
2. Each code specifies a buffering method for accessing user data.
3. The `IRP_MJ_DEVICE_CONTROL` handler reads the code from its `IO_STACK_LOCATION` and processes the data accordingly.

### Buffering Methods

| Method                                 | Constant                            | Kernel access to the buffer                                       |
| -------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Buffered I/O                           | `METHOD_BUFFERED`                   | Kernel validates, allocates non-paged pool, copies in/out via `Irp->AssociatedIrp.SystemBuffer` |
| Direct I/O                             | `METHOD_IN_DIRECT` / `METHOD_OUT_DIRECT` | I/O manager builds and locks an MDL; driver reads `Irp->MdlAddress` |
| Neither                                | `METHOD_NEITHER`                    | No validation; raw pointer in `Parameters.DeviceIoControl.Type3InputBuffer` |

Buffered I/O is the common choice for software drivers (simple and reasonably safe). Direct I/O suits large hardware transfers. `METHOD_NEITHER` leaves all validation to the developer and is the most vulnerable to kernel memory corruption or disclosure.

### I/O Control Codes

An IOCTL is a 32-bit value encoding device type, function, buffering method, and access rights.

```c
#define CTL_CODE(DeviceType, Function, Method, Access) ( \
    ((DeviceType) << 16) | ((Access) << 14) | ((Function) << 2) | (Method) )
```

| Field        | Convention                                                    |
| ------------ | ------------------------------------------------------------- |
| `DeviceType` | A `FILE_DEVICE_*` constant; third-party drivers use `>0x8000` |
| `Function`   | Driver-specific; recommended `>0x800`                         |
| `Method`     | One of the buffering methods                                  |
| `Access`     | `FILE_ANY_ACCESS`, `FILE_READ_ACCESS`, `FILE_WRITE_ACCESS`    |

Decode with `DEVICE_TYPE_FROM_CTL_CODE` (`>>16 & 0xffff`) and `METHOD_FROM_CTL_CODE` (`& 3`).

---

## Miscellaneous Mechanisms

### CR0 and the WP Bit

Kernel code is mapped read-only; patching it faults. On x86/x64 this is enforced by the **WP (write-protect) bit, bit 16 of CR0**, which — when set (the default) — forbids writes to read-only pages even in ring 0. Rootkits toggle it to hook kernel code:

```asm
mov eax, cr0
mov [esp+...], eax        ; save original
and eax, 0FFFEFFFFh       ; clear bit 16 (WP)
mov cr0, eax
```

Alternatives that avoid touching CR0 use MDLs to remap the target pages writable.

!!! warning "PatchGuard"
    On x64 and ARM, Kernel Patch Protection (PatchGuard) detects modifications to security-critical structures and bugchecks. Hooking therefore persists mainly on x86.

### Accessing the Service Table

`KiServiceTable` is not exported, so hooking rootkits reach it through the exported `KeServiceDescriptorTable` (a `KSERVICE_TABLE_DESCRIPTOR` whose `Base` is the table). On **x64 this symbol is not exported either.** To locate a specific call, rootkits either hardcode the syscall index or disassemble the `Nt*`/`Zw*` stub to recover it — both brittle across service packs.

!!! example "Reading a syscall number from a stub (x86, Win 7)"
    The first instruction of `ZwQuerySystemInformation` is `b8 05010000` (`mov eax, 105h`). `0xb8` is the `MOV EAX` opcode; the following dword is the syscall number, so reading the byte at offset `+1` yields the index used to overwrite the corresponding `KiServiceTable` entry.

### Sections

A section object describes memory backed by storage.

| Backing              | Behavior of modifications                    |
| -------------------- | -------------------------------------------- |
| File-backed          | Written through to the file on disk          |
| Page-file-backed     | Discarded when the section is closed         |

Create with `ZwCreateSection`, map a **view** (a virtual range onto the section) with `ZwMapViewOfSection`. One section can have multiple views.

---

## Walk-Through: x86 Syscall-Table Rootkit (Sample A)

Demonstrates the standard software-driver skeleton plus a service-table overwrite.

- **`DriverEntry`** creates a device `\Device\fsodhfn2m` with a symbolic link `\DosDevices\fsodhfn2m`, registers one handler for `IRP_MJ_READ`, `IRP_MJ_CLOSE`, and `IRP_MJ_DEVICE_CONTROL`, and sets an unload routine (delete link, delete device).
- **The IOCTL handler** accepts code `0x22c004`, which decodes to `FILE_DEVICE_UNKNOWN`, function `1`, `METHOD_BUFFERED`, `FILE_READ_DATA | FILE_WRITE_DATA`. Input arrives in `Irp->AssociatedIrp.SystemBuffer`.
- **The operation:** raise IRQL to `DISPATCH_LEVEL`, build an MDL over `KiServiceTable` and map it **writable** at a second address (`IoAllocateMdl` → `MmProbeAndLockPages` → `MmMapLockedPagesSpecifyCache`), then overwrite entries from a user-supplied array laid out as `[count][addr₁][addr₂]…`. Finally unmap/unlock/free the MDL and lower IRQL.

The net effect is an IOCTL that lets user mode replace arbitrary native syscall pointers — trivially exploitable for ring-0 code execution, and unsafe on multiprocessor systems.

## Walk-Through: x64 File-Deletion Rootkit (Sample B)

Demonstrates callbacks, MDL cleanup, a hand-built IRP, and reading optimized x64 code.

- A **process-termination callback** (registered via the documented notify API) fires only when `Create == FALSE`, running in the dying process's context. It walks a `LIST_ENTRY` of tracked (injected) processes; on a name match it unmaps/unlocks/frees the MDL stored in the entry and unlinks it with `RemoveEntryList`. (Injected pages must be released before the process dies or the system bugchecks.)
- A separate routine **deletes a file without `ZwDeleteFile`** by crafting an IRP directly: `IoGetRelatedDeviceObject` → `IoAllocateIrp` (sized by the device's `StackSize`) → fill the next `IO_STACK_LOCATION` with `IRP_MJ_SET_INFORMATION`, `FileInformationClass = FileDispositionInformation`, and a one-byte buffer of `1` → set a completion routine → `IoCallDriver`. If the driver returns `STATUS_PENDING`, it waits on an event the completion routine signals. This bypasses security software that hooks the deletion syscall.

!!! note "x64 optimizer: negative offsets for the next stack location"
    Because `IO_STACK_LOCATION` is `0x48` bytes and the next element sits at a lower address, the compiler emits accesses like `[rcx-48h]`, `[rcx-20h]` off the current location instead of computing a fresh base pointer. Recognize this pattern as `IoGetNextIrpStackLocation` followed by field writes.

---

## Analysis Checklist for a Driver

1. Identify `DriverEntry` and its IRP dispatch handlers.
2. Determine whether the driver attaches to another device (and which).
3. If it creates a device object, recover its name and `DeviceExtension` size.
4. Recover the `DeviceExtension` layout from field usage.
5. If it supports IOCTL, enumerate the codes, their functionality, and buffering methods.
6. Identify DPCs, work items, APCs, timers, completion routines, callbacks, and system threads.
7. Reconstruct how the pieces fit together.
