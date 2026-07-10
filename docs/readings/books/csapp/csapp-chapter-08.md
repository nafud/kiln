# Chapter 8. Exceptional Control Flow

Control flow: the sequence of instruction addresses executed by the processor. Smooth flow means each instruction is adjacent in memory to the previous one; jumps, calls, and returns cause abrupt changes in response to *program state*. Systems must also react to changes in *system state* not captured by program variables (timer expiry, packet arrival, I/O completion, child termination). Abrupt control changes in response to such events are **exceptional control flow (ECF)**.

ECF exists at every level:

| Level | Mechanism |
|---|---|
| Hardware | Exceptions → exception handlers |
| Operating system | Context switches between processes |
| Application ↔ OS | Traps / system calls; signals |
| Application | Nonlocal jumps (`setjmp`/`longjmp`) |

ECF is the basic mechanism behind I/O, processes, and virtual memory; system calls are the interface through which applications request OS services; and ECF is the first form of concurrency (handlers, processes, signal handlers all interleave with other flows). Software exceptions (`try`/`catch`/`throw`) are an application-level analogue of nonlocal jumps.

## 8.1 Exceptions

An **exception** is an abrupt change in control flow in response to a change in processor state. The state change is an **event**. On detecting an event, the processor makes an indirect procedure call through an **exception table** to an OS subroutine, the **exception handler**. After handling, one of three things happens:

1. Return to the current instruction `I_curr` (the one executing when the event occurred).
2. Return to `I_next` (the instruction that would have executed next).
3. Abort the interrupted program.

### 8.1.1 Exception handling

- Each exception type has a unique nonnegative **exception number**: some assigned by the processor designers (divide by zero, page faults, protection faults, breakpoints, overflow), others by the OS kernel designers (system calls, I/O device signals).
- At boot, the OS allocates and initializes the exception table: entry *k* holds the address of the handler for exception *k*.
- At run time, the processor determines the exception number *k* and calls indirectly through entry *k*. The table's start address sits in a special CPU register, the **exception table base register**; the handler address is formed by adding the base to *k* scaled by the entry size.

Differences from a procedure call:

- The pushed return address is either `I_curr` or `I_next`, depending on the exception class.
- The processor also pushes additional state (e.g., the EFLAGS register with current condition codes) needed to restart the interrupted program.
- On a user→kernel transfer, all of these items are pushed onto the **kernel's stack**, not the user's stack.
- Handlers run in **kernel mode**: complete access to all system resources.

The handler returns via a special "return from interrupt" instruction that pops the saved state back into the control and data registers, restores user mode if a user program was interrupted, and resumes the interrupted program.

### 8.1.2 Classes of exceptions

| Class | Cause | Async/sync | Return behavior |
|---|---|---|---|
| Interrupt | Signal from I/O device | Async | Always returns to next instruction |
| Trap | Intentional exception | Sync | Always returns to next instruction |
| Fault | Potentially recoverable error | Sync | Might return to current instruction |
| Abort | Nonrecoverable error | Sync | Never returns |

Synchronous exceptions result from executing the current instruction, called the **faulting instruction**; interrupts are not caused by any particular instruction.

**Interrupts.** I/O devices (timer chips, disk controllers, network adapters) raise a pin on the processor and place the exception number of the device on the system bus. After the current instruction finishes, the processor reads the number and calls the interrupt handler; on return, execution continues at the next instruction as if the interrupt never happened.

**Traps and system calls.** Traps are intentional exceptions, produced by executing an instruction; the handler returns to the next instruction. Their most important use is the **system call**: a procedure-like interface between user programs and the kernel. A `syscall n` instruction traps to a handler that decodes the argument and dispatches to the appropriate kernel routine. From the programmer's view a system call looks like a function call, but a regular function runs in user mode on the caller's stack, while a system call runs in kernel mode, may execute privileged instructions, and uses a stack private to the kernel.

**Faults.** A fault handler either corrects the error and returns to the faulting instruction, re-executing it, or returns to a kernel abort routine that terminates the program. Classic example: **page fault** — the referenced virtual page (typically 4 KB) is not resident; the handler loads it from disk and restarts the faulting instruction, which then completes.

**Aborts.** Unrecoverable fatal errors, typically hardware (e.g., parity errors from corrupted DRAM/SRAM bits). The handler never returns to the application; control passes to a routine that terminates it.

### 8.1.3 Exceptions in Linux/x86-64

Up to 256 exception types. Numbers 0–31 are defined by the Intel architects, identical on any x86-64 system; 32–255 are OS-defined interrupts and traps.

| # | Exception | Class | Notes |
|---|---|---|---|
| 0 | Divide error | Fault | Divide by zero, or quotient too big for destination. Unix does not recover; it aborts the program. Shells report it as "Floating point exception". |
| 13 | General protection fault | Fault | Reference to an undefined area of virtual memory, or write to a read-only text segment. Not recovered; shells report "Segmentation fault". |
| 14 | Page fault | Fault | Handler maps the page into physical memory and restarts the faulting instruction. |
| 18 | Machine check | Abort | Fatal hardware error detected during the faulting instruction; never returns. |

**System calls.** Each has a unique number, an offset into a jump table in the kernel (distinct from the exception table). Popular examples:

| # | Name | # | Name |
|---|---|---|---|
| 0 | `read` | 37 | `alarm` |
| 1 | `write` | 39 | `getpid` |
| 2 | `open` | 57 | `fork` |
| 3 | `close` | 59 | `execve` |
| 4 | `stat` | 60 | `_exit` |
| 9 | `mmap` | 61 | `wait4` |
| 12 | `brk` | 62 | `kill` |
| 33 | `dup2` | 34 | `pause` |

> CSAPP Figure 8.10 lists `dup2` = 32 and `pause` = 33; the actual Linux x86-64 table has `dup` = 32, `dup2` = 33, `pause` = 34.

The C standard library provides wrapper functions for most system calls; wrappers package arguments, trap with `syscall`, and pass back the return status. System calls and their wrappers are referred to interchangeably as **system-level functions**.

Register convention (x86-64):

- `%rax`: syscall number; also holds the return value.
- Arguments (up to six, in order): `%rdi`, `%rsi`, `%rdx`, `%r10`, `%r8`, `%r9`. All arguments pass through registers, never the stack.
- `%rcx` and `%r11` are destroyed by the call.
- A return value in −4,095 … −1 indicates an error: it is the negated `errno`.

`hello` implemented directly with system calls:

```asm
    movq $1, %rax        # write is system call 1
    movq $1, %rdi        # arg1: stdout has descriptor 1
    movq $string, %rsi   # arg2: string address
    movq $len, %rdx      # arg3: string length
    syscall
    movq $60, %rax       # _exit is system call 60
    movq $0, %rdi        # arg1: exit status 0
    syscall
```

## 8.2 Processes

A **process** is an instance of a program in execution. Every program runs in the context of some process; the **context** is the state the program needs to run correctly: code and data in memory, stack, general-purpose register contents, program counter, environment variables, open file descriptors.

Key abstractions a process provides:

1. An independent **logical control flow** — illusion of exclusive use of the processor.
2. A **private address space** — illusion of exclusive use of the memory system.

### 8.2.1 Logical control flow

The sequence of program-counter values corresponding exclusively to instructions in the program's executable (or dynamically linked shared objects) is its logical control flow, or **flow**. The single physical control flow of the processor is partitioned among processes; each runs a portion of its flow and is then **preempted** (temporarily suspended) while others take turns. The only evidence against exclusive processor use is that precise timing would reveal periodic stalls — after which execution resumes with memory and registers unchanged.

### 8.2.2 Concurrent flows

Flows X and Y are **concurrent** iff X begins after Y begins and before Y finishes, or Y begins after X begins and before X finishes (i.e., their executions overlap in time). Exception handlers, processes, signal handlers, and threads are all logical flows.

- The general phenomenon of multiple overlapping flows: **concurrency**.
- Processes taking turns: **multitasking** (time slicing); each execution period is a **time slice**.
- Concurrency is independent of the number of cores: overlapping flows on one processor are concurrent.
- **Parallel flows** are the proper subset of concurrent flows running at the same time on different cores or computers.

### 8.2.3 Private address space

On a machine with *n*-bit addresses, the address space is the 2ⁿ addresses 0 … 2ⁿ−1. Memory associated with an address in a process's private space cannot in general be read or written by any other process. Classic x86-64 Linux organization, bottom to top:

- Read-only code segment, starting at `0x400000` (`.init`, `.text`, `.rodata`)
- Read/write segment (`.data`, `.bss`)
- Run-time heap, grown by `malloc`; top marked by `brk`
- Memory-mapped region for shared libraries
- User stack, growing downward from `%rsp`
- Kernel virtual memory at the top — code, data, and stack the kernel uses when executing on the process's behalf; invisible to user code

### 8.2.4 User and kernel modes

A mode bit in a control register defines current privilege:

- **Kernel (supervisor) mode**: any instruction, any memory location.
- **User mode**: no privileged instructions (halt, change mode bit, initiate I/O) and no direct reference to kernel code or data; any attempt causes a fatal protection fault. Kernel services are reached only via the system call interface.

A process starts in user mode; the only way into kernel mode is an exception (interrupt, fault, or trapping system call). The handler runs in kernel mode; returning to application code switches back to user mode.

The `/proc` filesystem exports kernel data structures as a hierarchy of text files readable by user-mode processes (e.g., `/proc/cpuinfo`, `/proc/<pid>/maps`); `/sys` exports low-level information about system buses and devices.

### 8.2.5 Context switches

The kernel maintains a **context** per process: general-purpose and floating-point registers, program counter, user's stack, status registers, kernel's stack, and kernel data structures (page table, process table, file table). **Scheduling** — the kernel's decision to preempt the current process and restart a previously preempted one — is done by the **scheduler**. A **context switch** (1) saves the context of the current process, (2) restores the saved context of a previously preempted process, (3) passes control to it.

Switches occur:

- During a system call, if it blocks (e.g., `read` awaiting a disk transfer, or `sleep`) — the kernel may also switch even if the call does not block.
- On interrupts, notably periodic timer interrupts (every 1 ms or 10 ms), when the kernel decides the current process has run long enough.

There is no separate kernel process: the kernel executes in kernel mode *on behalf of* some process, and mid-switch it begins executing on behalf of the next one.

## 8.3 System call error handling

Unix system-level functions typically return −1 on error and set the global integer `errno`; `strerror(errno)` yields a descriptive string. Idiomatic reporting:

```c
void unix_error(char *msg)
{
    fprintf(stderr, "%s: %s\n", msg, strerror(errno));
    exit(0);
}
```

**Error-handling wrappers** (Stevens): for base function `foo`, wrapper `Foo` has identical arguments, calls `foo`, checks for errors, and terminates on failure:

```c
pid_t Fork(void)
{
    pid_t pid;
    if ((pid = fork()) < 0)
        unix_error("Fork error");
    return pid;
}
```

Text convention: functions are discussed by their lowercase base names regardless of wrapper use.

## 8.4 Process control

### 8.4.1 Process IDs

```c
pid_t getpid(void);    /* PID of caller */
pid_t getppid(void);   /* PID of parent */
```

`pid_t` is defined as `int` on Linux (`types.h`).

### 8.4.2 Creating and terminating processes

Process states from the programmer's view:

- **Running** — executing on the CPU or waiting to be scheduled.
- **Stopped** — suspended, not scheduled; entered on SIGSTOP, SIGTSTP, SIGTTIN, or SIGTTOU; leaves on SIGCONT.
- **Terminated** — stopped permanently, by (1) a signal whose default action is termination, (2) return from `main`, or (3) calling `exit(status)` (which does not return).

```c
pid_t fork(void);   /* Returns: 0 to child, child's PID to parent, -1 on error */
```

The child gets an identical but **separate** copy of the parent's user-level virtual address space (code, data, heap, shared libraries, user stack) and identical copies of the parent's open file descriptors. The processes differ in PID. Properties:

- **Called once, returns twice**: once in the parent (child's PID) and once in the child (0). Since a child's PID is always nonzero, the return value disambiguates parent from child.
- **Concurrent execution**: parent and child run concurrently; the kernel interleaves their instructions arbitrarily. No assumption about interleaving is valid.
- **Duplicate but separate address spaces**: immediately after `fork`, both spaces are identical (same local/global variable values, heap, code); subsequent changes are private to each process.
- **Shared files**: the child inherits the parent's open files (e.g., an open `stdout` directed to the screen).

**Process graphs**: vertices are statement executions; edge a → b means a happens before b; edges may be labeled with variable values, `printf` vertices with output. For a program on a single processor, any **topological sort** of the graph is a feasible total ordering of its statements; orderings that are not topological sorts are infeasible.

### 8.4.3 Reaping child processes

A terminated process is kept in a terminated state until **reaped** by its parent: the kernel passes the child's exit status to the parent, then discards the process. A terminated-but-unreaped process is a **zombie**; zombies consume system memory even though they do not run.

The `init` process (PID 1, created at boot, never terminates, ancestor of every process) becomes the adopted parent of orphaned children and reaps zombies whose parent terminated without reaping them. Long-running programs (shells, servers) must reap their own zombies.

```c
pid_t waitpid(pid_t pid, int *statusp, int options);
/* Returns: PID of child if OK, 0 (if WNOHANG), -1 on error */
```

By default (`options = 0`), suspends the caller until a child in the **wait set** terminates; if one has already terminated, returns immediately. Returns the PID of the reaped child.

Wait set:

- `pid > 0` — the single child with that PID.
- `pid = -1` — all of the parent's children. (Other wait sets involving process groups exist.)

Options (combinable by OR):

- `WNOHANG` — return 0 immediately if no child in the wait set has terminated yet.
- `WUNTRACED` — also return for stopped children (default reports only terminated ones).
- `WCONTINUED` — also return when a stopped child resumes on SIGCONT.

Status macros (`wait.h`) on `*statusp`:

| Macro | Meaning |
|---|---|
| `WIFEXITED(status)` | True if child terminated normally (`exit` or return) |
| `WEXITSTATUS(status)` | Exit status; defined only if `WIFEXITED` |
| `WIFSIGNALED(status)` | True if child terminated by an uncaught signal |
| `WTERMSIG(status)` | Number of the terminating signal; only if `WIFSIGNALED` |
| `WIFSTOPPED(status)` | True if the returned-for child is stopped |
| `WSTOPSIG(status)` | Number of the stopping signal; only if `WIFSTOPPED` |
| `WIFCONTINUED(status)` | True if child was restarted by SIGCONT |

Errors: no children → −1, `errno = ECHILD`; interrupted by a signal → −1, `errno = EINTR`.

```c
pid_t wait(int *statusp);   /* ≡ waitpid(-1, statusp, 0) */
```

Reaping in no particular order:

```c
while ((pid = waitpid(-1, &status, 0)) > 0) {
    if (WIFEXITED(status))
        printf("child %d terminated normally with exit status=%d\n",
               pid, WEXITSTATUS(status));
    else
        printf("child %d terminated abnormally\n", pid);
}
if (errno != ECHILD)
    unix_error("waitpid error");
```

The reap order is nondeterministic; no ordering assumption is correct. To reap in creation order, store child PIDs in an array and call `waitpid(pid[i++], &status, 0)` in a loop.

### 8.4.4 Putting processes to sleep

```c
unsigned int sleep(unsigned int secs);
/* Returns: 0 if the full time elapsed, else seconds left to sleep
   (possible when interrupted by a signal) */

int pause(void);   /* Sleeps until a signal is received. Always returns -1 */
```

### 8.4.5 Loading and running programs

```c
int execve(const char *filename, const char *argv[], const char *envp[]);
/* Does not return if OK; returns -1 on error */
```

Loads and runs executable `filename` with argument list `argv` and environment list `envp`. Called **once and never returns** (contrast `fork`: once, twice). Both lists are null-terminated arrays of string pointers; `argv[0]` is by convention the executable's name; environment strings have the form `name=value`.

After loading, the startup code sets up the stack and passes control to `main(int argc, char **argv, char **envp)`. Stack organization at entry, from bottom (highest address) to top: argument and environment strings; null-terminated `envp[]` array (global `environ` points to `envp[0]`); null-terminated `argv[]` array; stack frame for `libc_start_main`. Arguments to `main`: `argc` in `%rdi`, `argv` in `%rsi`, `envp` in `%rdx`.

```c
char *getenv(const char *name);
/* Returns: pointer to value if name exists, NULL otherwise */

int setenv(const char *name, const char *newvalue, int overwrite);
/* Adds name=newvalue, or replaces existing value iff overwrite is nonzero.
   Returns: 0 on success, -1 on error */

void unsetenv(const char *name);   /* Deletes name=value if present */
```

### 8.4.6 Using fork and execve to run programs

**Program vs. process**: a program is a collection of code and data (an object file, or segments in an address space); a process is a specific instance of a program in execution. `fork` runs the *same* program in a *new* (duplicate) process. `execve` loads and runs a *new* program in the context of the *current* process — it overwrites the address space but does not create a new process; the PID is unchanged and open file descriptors are inherited.

A **shell** is an interactive application-level program that runs programs on behalf of the user (sh, csh, tcsh, ksh, bash) via a read/evaluate loop:

1. **Read** a command line from stdin.
2. **Evaluate**: `parseline` splits the space-separated words into an `argv` vector; a trailing `&` means run the job in the background (shell does not wait), otherwise foreground (shell waits). If `argv[0]` is a built-in command, interpret it immediately. Otherwise `fork` a child, `execve(argv[0], argv, environ)` inside it (printing "Command not found" and exiting if it fails); for a foreground job the parent blocks in `waitpid`, for a background job it prints the PID and command line and continues.

A shell with only this logic is flawed: it never reaps background children. Fixing that requires signals.

## 8.5 Signals

A **signal** is a small message notifying a process that an event of some type occurred. Signals expose low-level hardware exceptions (normally processed invisibly by the kernel) to user processes, and also convey higher-level events: e.g., SIGSEGV for a page-fault-detected illegal reference; SIGINT to each process in the foreground process group on Ctrl+C; SIGKILL to forcibly terminate a process; SIGCHLD to a parent when a child terminates or stops.

The 30 Linux signal types:

| # | Name | Default action | Event |
|---|---|---|---|
| 1 | SIGHUP | Terminate | Terminal line hangup |
| 2 | SIGINT | Terminate | Interrupt from keyboard |
| 3 | SIGQUIT | Terminate + dump core | Quit from keyboard |
| 4 | SIGILL | Terminate + dump core | Illegal instruction |
| 5 | SIGTRAP | Terminate + dump core | Trace trap |
| 6 | SIGABRT | Terminate + dump core | Abort signal from `abort` |
| 7 | SIGBUS | Terminate | Bus error |
| 8 | SIGFPE | Terminate + dump core | Floating-point exception |
| 9 | SIGKILL | Terminate¹ | Kill program |
| 10 | SIGUSR1 | Terminate | User-defined signal 1 |
| 11 | SIGSEGV | Terminate + dump core | Invalid memory reference |
| 12 | SIGUSR2 | Terminate | User-defined signal 2 |
| 13 | SIGPIPE | Terminate | Wrote to a pipe with no reader |
| 14 | SIGALRM | Terminate | Timer signal from `alarm` |
| 15 | SIGTERM | Terminate | Software termination signal |
| 16 | SIGSTKFLT | Terminate | Stack fault on coprocessor |
| 17 | SIGCHLD | Ignore | Child process stopped or terminated |
| 18 | SIGCONT | Ignore | Continue process if stopped |
| 19 | SIGSTOP | Stop until next SIGCONT¹ | Stop signal not from terminal |
| 20 | SIGTSTP | Stop until next SIGCONT | Stop signal from terminal |
| 21 | SIGTTIN | Stop until next SIGCONT | Background process read from terminal |
| 22 | SIGTTOU | Stop until next SIGCONT | Background process wrote to terminal |
| 23 | SIGURG | Ignore | Urgent condition on socket |
| 24 | SIGXCPU | Terminate | CPU time limit exceeded |
| 25 | SIGXFSZ | Terminate | File size limit exceeded |
| 26 | SIGVTALRM | Terminate | Virtual timer expired |
| 27 | SIGPROF | Terminate | Profiling timer expired |
| 28 | SIGWINCH | Ignore | Window size changed |
| 29 | SIGIO | Terminate | I/O now possible on a descriptor |
| 30 | SIGPWR | Terminate | Power failure |

¹ Cannot be caught or ignored. ("Dumping core" writes an image of the code and data memory segments to disk; "core" is a historical term for main memory.)

### 8.5.1 Signal terminology

Signal transfer has two distinct steps:

- **Sending (delivering)**: the kernel updates state in the destination process's context, either because it detected a system event (divide-by-zero, child termination) or because a process invoked `kill` (a process can signal itself).
- **Receiving**: the destination process is forced by the kernel to react — ignore, terminate, or **catch** the signal by executing a user-level **signal handler**.

A sent-but-not-yet-received signal is **pending**. There is at most **one** pending signal of each type per process: the pending bit vector has one bit per type, set on delivery and cleared on receipt. Additional signals of an already-pending type are **discarded, not queued**. A process may **block** receipt of selected signals: a blocked signal can be delivered and stays pending, but is not received until unblocked. The blocked bit vector is also called the **signal mask**.

### 8.5.2 Sending signals

All Unix sending mechanisms rely on **process groups**. Every process belongs to exactly one group, identified by a positive integer process group ID; a child belongs to its parent's group by default.

```c
pid_t getpgrp(void);                     /* group ID of caller */
int setpgid(pid_t pid, pid_t pgid);      /* 0 on success, -1 on error */
```

`setpgid(pid, pgid)` moves process `pid` to group `pgid`; `pid = 0` means the caller, `pgid = 0` means use the PID of the process named by `pid` as the group ID (so `setpgid(0, 0)` creates a new group whose ID is the caller's PID).

**From the shell**: `/bin/kill -9 15213` sends SIGKILL to process 15213; a negative PID (`/bin/kill -9 -15213`) sends it to every process in group 15213. (Full path because some shells have a built-in `kill`.)

**From the keyboard**: shells represent each evaluated command line as a **job**; at any time there is at most one foreground job and zero or more background jobs, each in its own process group (typically ID taken from one of the job's parent processes). Ctrl+C makes the kernel send SIGINT, Ctrl+Z SIGTSTP, to every process in the foreground process group.

**From a program**:

```c
int kill(pid_t pid, int sig);   /* 0 if OK, -1 on error */
```

- `pid > 0`: signal to process `pid`.
- `pid = 0`: signal to every process in the caller's process group, including the caller.
- `pid < 0`: signal to every process in group `|pid|`.

```c
unsigned int alarm(unsigned int secs);
/* Returns: seconds remaining on any previously pending alarm, else 0 */
```

Arranges for SIGALRM to be sent to the caller in `secs` seconds; `secs = 0` schedules no new alarm. Any pending alarm is canceled.

### 8.5.3 Receiving signals

When the kernel switches a process from kernel to user mode (return from a system call, or completion of a context switch), it checks the set of unblocked pending signals (`pending & ~blocked`). If empty, control passes to the next instruction of the process's logical flow. Otherwise the kernel chooses some signal *k* in the set (typically the smallest) and forces the process to receive it; after the resulting action, control passes to the next instruction. Each type has one of four predefined **default actions**: terminate; terminate and dump core; stop until SIGCONT; ignore.

```c
typedef void (*sighandler_t)(int);
sighandler_t signal(int signum, sighandler_t handler);
/* Returns: pointer to previous handler if OK, SIG_ERR on error (errno not set) */
```

`handler` may be `SIG_IGN` (ignore signum), `SIG_DFL` (restore default action), or the address of a user function — **installing** the handler; invoking it is **catching**, executing it is **handling** the signal. The defaults of SIGSTOP and SIGKILL cannot be changed. The handler receives the signal number as its argument, allowing one function to catch several types. When the handler returns, control (usually) passes back to the instruction where the process was interrupted — on some systems interrupted system calls instead return immediately with an error.

Handlers are a form of concurrency: a handler can itself be interrupted by a handler for a *different* signal type, which runs to completion before the first resumes.

### 8.5.4 Blocking and unblocking signals

- **Implicit**: the kernel blocks pending signals of the type currently being handled.
- **Explicit**:

```c
int sigprocmask(int how, const sigset_t *set, sigset_t *oldset);
int sigemptyset(sigset_t *set);              /* set := {} */
int sigfillset(sigset_t *set);               /* set := all signals */
int sigaddset(sigset_t *set, int signum);
int sigdelset(sigset_t *set, int signum);
/* All return 0 if OK, -1 on error */
int sigismember(const sigset_t *set, int signum);  /* 1 if member, 0 if not, -1 on error */
```

`how`: `SIG_BLOCK` (`blocked |= set`), `SIG_UNBLOCK` (`blocked &= ~set`), `SIG_SETMASK` (`blocked = set`). If `oldset` is non-NULL, the previous blocked vector is stored there.

Temporarily blocking SIGINT:

```c
sigset_t mask, prev_mask;
Sigemptyset(&mask);
Sigaddset(&mask, SIGINT);
Sigprocmask(SIG_BLOCK, &mask, &prev_mask);
/* ... code not interruptible by SIGINT ... */
Sigprocmask(SIG_SETMASK, &prev_mask, NULL);
```

### 8.5.5 Writing signal handlers

Handlers run concurrently with the main program and with each other; concurrent access to shared global data yields unpredictable results. Conservative guidelines:

- **G0. Keep handlers as simple as possible.** E.g., set a global flag and return; the main program periodically checks and resets the flag and does the processing.
- **G1. Call only async-signal-safe functions.** A function is async-signal-safe if it is reentrant (accesses only local variables) or cannot be interrupted by a handler. Linux guarantees a specific list (`man 7 signal`), including `_exit`, `write`, `wait`, `waitpid`, `sleep`, `kill`, `signal`, `sigprocmask` — but **not** `printf`, `sprintf`, `malloc`, or `exit`. The only safe way to produce output from a handler is `write`; the Sio (Safe I/O) package wraps it:

```c
ssize_t sio_puts(char s[]);   /* emit string to stdout */
ssize_t sio_putl(long v);     /* emit long to stdout */
void sio_error(char s[]);     /* emit message, _exit(1) */
```

- **G2. Save and restore `errno`.** Many safe functions set `errno` on error, which can interfere with code that relies on it. Save it to a local on handler entry and restore before returning; unnecessary if the handler ends with `_exit`.
- **G3. Protect accesses to shared global data structures by blocking all signals** (in both handlers and the main program) around the access. Accessing a structure usually takes several instructions; a handler interrupting mid-sequence may see it in an inconsistent state.
- **G4. Declare global variables `volatile`.** Otherwise an optimizing compiler may cache a variable in a register, and the main routine never sees handler updates; `volatile` forces every reference to read memory.
- **G5. Declare flags `sig_atomic_t`.** Reads and writes of such flags are guaranteed atomic and need no signal blocking — but only individual reads and writes; `flag++` or `flag = flag + 1` may take multiple instructions and is not covered.

These are conservative: e.g., if a handler provably cannot modify `errno`, saving it is unnecessary — but such proofs are hard in general.

**Correct handling — signals are not queued.** A pending signal only means *at least one* signal of that type has arrived. Consequence: signals cannot be used to count events in other processes. Flawed pattern: a SIGCHLD handler that reaps exactly one child per invocation. If three children terminate in quick succession, the first SIGCHLD is caught; the second becomes pending (SIGCHLD is implicitly blocked during the handler); the third is discarded because one is already pending. Only two children ever get reaped; the third remains a zombie (`<defunct>` in `ps`). Fix — reap as many zombies as possible per invocation:

```c
void handler2(int sig)
{
    int olderrno = errno;
    while (waitpid(-1, NULL, 0) > 0) {
        Sio_puts("Handler reaped child\n");
    }
    if (errno != ECHILD)
        Sio_error("waitpid error");
    Sleep(1);
    errno = olderrno;
}
```

**Portable handling.** Older Unix variants differ: some reset the action for signal *k* to the default after it is caught, requiring the handler to reinstall itself; on some, slow system calls (`read`, `wait`, `accept`, …) interrupted by a caught signal do not resume but return −1 with `errno = EINTR`, requiring manual restart code. Posix `sigaction` lets the user specify the semantics explicitly; since it is unwieldy, use the Stevens-style wrapper:

```c
handler_t *Signal(int signum, handler_t *handler)
{
    struct sigaction action, old_action;

    action.sa_handler = handler;
    sigemptyset(&action.sa_mask); /* Block sigs of type being handled */
    action.sa_flags = SA_RESTART; /* Restart syscalls if possible */

    if (sigaction(signum, &action, &old_action) < 0)
        unix_error("Signal error");
    return (old_action.sa_handler);
}
```

Semantics installed: only signals of the type being handled are blocked; signals are not queued; interrupted system calls restart automatically whenever possible; the handler stays installed until `Signal` is called with `SIG_IGN` or `SIG_DFL`.

### 8.5.6 Synchronizing flows to avoid nasty concurrency bugs

Race example — a shell that `addjob`s each child in the main routine and `deletejob`s it in the SIGCHLD handler:

1. Parent calls `fork`; the kernel schedules the child first.
2. The child terminates before the parent runs again; the kernel delivers SIGCHLD to the parent.
3. When the parent next becomes runnable, the kernel notices the pending SIGCHLD and the parent receives it before executing further.
4. The handler reaps the child and calls `deletejob` — which does nothing, since the child was never added.
5. The parent resumes after `fork` and calls `addjob` for a child that no longer exists; the entry is never removed.

`deletejob` can thus run before `addjob` — a **race**. Other interleavings (parent scheduled first) are correct; correctness must hold for all interleavings. Fix — block SIGCHLD before `fork` and unblock only after `addjob`, guaranteeing the child is reaped after it is added:

```c
Sigprocmask(SIG_BLOCK, &mask_one, &prev_one);   /* Block SIGCHLD */
if ((pid = Fork()) == 0) {                      /* Child */
    Sigprocmask(SIG_SETMASK, &prev_one, NULL);  /* Unblock SIGCHLD */
    Execve("/bin/date", argv, NULL);
}
Sigprocmask(SIG_BLOCK, &mask_all, NULL);        /* Parent */
addjob(pid);
Sigprocmask(SIG_SETMASK, &prev_one, NULL);      /* Unblock SIGCHLD */
```

Children inherit their parent's blocked set, so the child must unblock SIGCHLD before `execve`.

### 8.5.7 Explicitly waiting for signals

A main program sometimes must wait for a handler to run (e.g., a shell waiting for a foreground job to be reaped by the SIGCHLD handler). With SIGCHLD unblocked and a global `volatile sig_atomic_t`-style `pid` set by the handler:

| Approach | Verdict |
|---|---|
| `while (!pid) ;` | Correct, but the spin loop wastes processor resources |
| `while (!pid) pause();` | Race: if SIGCHLD is received after the `!pid` test but before `pause`, `pause` sleeps forever. (The loop is still needed because `pause` may be interrupted by other signals, e.g., SIGINT.) |
| `while (!pid) sleep(1);` | Correct but too slow — up to a full second of delay per receipt; no principled interval exists for `nanosleep` variants (too small → wasteful, too large → slow) |
| `while (!pid) sigsuspend(&prev);` | Correct and efficient |

```c
int sigsuspend(const sigset_t *mask);   /* Returns: -1 */
```

Atomically (uninterruptibly) equivalent to:

```c
sigprocmask(SIG_SETMASK, &mask, &prev);
pause();
sigprocmask(SIG_SETMASK, &prev, NULL);
```

It temporarily replaces the blocked set with `mask`, then suspends the process until a signal is received whose action is to run a handler (sigsuspend returns after the handler returns, with the blocked set restored) or to terminate the process (the process exits without returning). Atomicity closes the test–`pause` window. Usage: block SIGCHLD, fork; in the parent set `pid = 0`, then `while (!pid) sigsuspend(&prev);` — each call temporarily unblocks SIGCHLD and sleeps; on exit from the loop SIGCHLD is blocked again and may optionally be unblocked.

## 8.6 Nonlocal jumps

A **nonlocal jump** transfers control directly from one function to another currently executing function, bypassing the normal call-and-return discipline.

```c
int setjmp(jmp_buf env);                    /* Returns: 0 from setjmp,
                                               nonzero from longjmps */
int sigsetjmp(sigjmp_buf env, int savesigs);

void longjmp(jmp_buf env, int retval);      /* Never returns */
void siglongjmp(sigjmp_buf env, int retval);
```

`setjmp` saves the current **calling environment** (program counter, stack pointer, general-purpose registers) in `env` and returns 0. Its return value must not be assigned to a variable (`rc = setjmp(env)` is wrong); it may be used as a test in a `switch` or conditional. `longjmp` restores the environment from `env` and triggers a return from the most recent `setjmp` on `env`, which then returns the nonzero value `retval`. `setjmp` is called once but returns multiple times; `longjmp` is called once but never returns.

Applications:

- **Immediate return from deeply nested calls** on an error condition, jumping straight to a localized error handler instead of unwinding the stack. Caveat: intermediate functions' cleanup code is skipped — e.g., deallocations never run, leaking memory.
- **Branching out of a signal handler** to a specific code location instead of returning to the interrupted instruction — e.g., a soft restart on Ctrl+C using `sigsetjmp`/`siglongjmp`, the handler-safe variants that additionally save and restore the signal context (pending and blocked bit vectors). Two subtleties: the handler must be installed *after* the initial `sigsetjmp`, or it could run before the environment is set up; and since `siglongjmp` can jump into arbitrary code, everything reachable from it must call only async-signal-safe functions (`sigsetjmp` and `siglongjmp` themselves are not on the safe list).

C++/Java exception mechanisms are a higher-level, more structured version of this: `catch` clauses act like `setjmp`, `throw` like `longjmp`.

## 8.7 Tools for manipulating processes

| Tool | Function |
|---|---|
| `strace` | Traces each system call of a running program and its children (compile with `-static` for a cleaner trace) |
| `ps` | Lists processes, including zombies |
| `top` | Resource usage of current processes |
| `pmap` | Memory map of a process |
| `/proc` | Virtual filesystem exporting kernel data structures as text (e.g., `cat /proc/loadavg`) |

## 8.8 Summary

ECF occurs at all levels. Hardware: four exception classes — interrupts (async, from I/O devices, return to next instruction), traps (intentional; implement system calls, the controlled entry points into the OS), faults (handler restarts the faulting instruction or aborts), aborts (never return). OS: the kernel uses ECF for context switches, implementing processes, whose two key illusions are exclusive processor use (logical control flows) and exclusive memory use (private address spaces). OS/application boundary: process creation (`fork`), reaping (`waitpid`), program loading (`execve`), and signals — whose semantics are subtle and system-dependent, with Posix `sigaction` allowing explicit specification. Application level: nonlocal jumps bypass the call/return discipline entirely.
