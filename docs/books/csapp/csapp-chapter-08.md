# Chapter 8. Exceptional Control Flow

The sequence of program counter values executed by a processor, where each transition from instruction Ik to Ik+1 is a control transfer, is the flow of control (control flow). Smooth flow, where Ik and Ik+1 are adjacent in memory, is broken by jumps, calls, and returns, which react to changes in program state represented by program variables.

Systems must also react to changes in system state not captured by internal program variables and not necessarily related to the execution of the program: a hardware timer expires, packets arrive at a network adapter, a disk finishes a requested transfer, a child process terminates. Modern systems react through abrupt changes in control flow called exceptional control flow (ECF). ECF exists at every level:

| Level | Mechanism |
|---|---|
| Hardware | Events detected by hardware trigger abrupt control transfers to exception handlers |
| Operating system | The kernel transfers control between user processes via context switches |
| Application to application | A process sends a signal that abruptly transfers control to a signal handler in the recipient |
| Within a program | Nonlocal jumps sidestep the usual stack discipline and jump to arbitrary locations in other functions |

Understanding ECF matters because it is the basic mechanism behind I/O, processes, and virtual memory; system calls (traps) are how applications request OS services; ECF enables application patterns such as shells and servers; it is the first step toward concurrency; and software exception mechanisms (`try`, `catch`, `throw` in C++ and Java) are built on nonlocal jumps, provided in C by `setjmp` and `longjmp`.

The chapter assumes x86-64 Linux.

## 8.1 Exceptions

An exception is an abrupt change in control flow in response to some change in the processor's state. The state is encoded in bits and signals inside the processor; the change in state is an event. The event may relate directly to the current instruction (page fault, arithmetic overflow, divide by zero) or be unrelated to it (timer expiry, I/O completion).

```
Application program              Exception handler
──────────────────               ─────────────────
    Icurr  ← event occurs ──exception──▶ exception
    Inext                                processing
      ▲                                     │
      └────── exception return (optional) ──┘
```

When the processor detects the event, it makes an indirect procedure call (the exception) through a jump table called an exception table to an operating system subroutine (the exception handler) designed to process that kind of event. When the handler finishes, one of three things happens depending on the event type:

1. The handler returns control to Icurr, the instruction executing when the event occurred.
2. The handler returns control to Inext, the instruction that would have executed next had the exception not occurred.
3. The handler aborts the interrupted program.

### 8.1.1 Exception Handling

Each possible exception type is assigned a unique nonnegative integer exception number. Some numbers are assigned by the processor designers (divide by zero, page faults, memory access violations, breakpoints, arithmetic overflows); others by the designers of the operating system kernel, the memory-resident part of the operating system (system calls, signals from external I/O devices).

At system boot time the operating system allocates and initializes the exception table: entry k contains the address of the handler for exception k. At run time the processor detects an event, determines the exception number k, and triggers the exception through an indirect procedure call via entry k. The exception number is an index into the table; the table's starting address is held in a special CPU register, the exception table base register, so the handler address is formed as base plus k times the entry size.

An exception resembles a procedure call, with important differences:

- The return address pushed on the stack is, depending on the exception class, either the current instruction or the next instruction.
- The processor also pushes additional processor state (e.g., the EFLAGS register with the current condition codes) needed to restart the interrupted program.
- When control transfers from a user program to the kernel, these items are pushed onto the kernel's stack, not the user's stack.
- Exception handlers run in kernel mode, with complete access to all system resources.

After the handler processes the event, it optionally returns to the interrupted program by executing a special "return from interrupt" instruction, which pops the saved state back into the processor's control and data registers, restores user mode if a user program was interrupted, and returns control to the interrupted program.

### 8.1.2 Classes of Exceptions

| Class | Cause | Async/sync | Return behavior |
|---|---|---|---|
| Interrupt | Signal from I/O device | Async | Always returns to next instruction |
| Trap | Intentional exception | Sync | Always returns to next instruction |
| Fault | Potentially recoverable error | Sync | Might return to current instruction |
| Abort | Nonrecoverable error | Sync | Never returns |

**Interrupts** occur asynchronously as a result of signals from I/O devices external to the processor; they are not caused by any particular instruction. Devices such as network adapters, disk controllers, and timer chips trigger interrupts by signaling a pin on the processor chip and placing on the system bus the exception number identifying the device. After the current instruction finishes, the processor notices the interrupt pin, reads the exception number from the bus, and calls the handler. The handler returns control to the next instruction; the program continues as though the interrupt had never happened.

Traps, faults, and aborts occur synchronously as a result of executing the current instruction, called the faulting instruction.

**Traps** are intentional exceptions. Their most important use is the system call: a procedure-like interface between user programs and the kernel. To allow controlled access to kernel services (reading a file with `read`, creating a process with `fork`, loading a program with `execve`, terminating with `exit`), processors provide a `syscall n` instruction. Executing it traps to a handler that decodes the argument and calls the appropriate kernel routine, then returns to the next instruction. From the programmer's perspective a system call is identical to a function call, but a regular function runs in user mode on the caller's stack, whereas a system call runs in kernel mode, may execute privileged instructions, and uses a stack in the kernel.

**Faults** result from error conditions a handler might correct. If the handler corrects the condition, it returns control to the faulting instruction, re-executing it; otherwise it returns to a kernel abort routine that terminates the program. The classic example is the page fault: an instruction references a virtual address whose page (a contiguous block of virtual memory, typically 4 KB) is not resident in memory. The handler loads the page from disk and returns to the faulting instruction, which now completes without faulting.

**Aborts** result from unrecoverable fatal errors, typically hardware errors such as parity errors from corrupted DRAM or SRAM bits. Abort handlers never return control to the program; they pass control to a kernel abort routine that terminates it.

### 8.1.3 Exceptions in Linux/x86-64 Systems

x86-64 systems define up to 256 exception types. Numbers 0 to 31 are defined by the Intel architects and are identical on any x86-64 system; numbers 32 to 255 are interrupts and traps defined by the operating system.

| Number | Exception | Class |
|---|---|---|
| 0 | Divide error | Fault |
| 13 | General protection fault | Fault |
| 14 | Page fault | Fault |
| 18 | Machine check | Abort |
| 32 to 255 | OS-defined exceptions | Interrupt or trap |

Divide error (exception 0): an application divides by zero or the divide result is too big for the destination operand. Unix does not attempt recovery; it aborts the program. Linux shells report it as "Floating exception."

General protection fault (exception 13): many causes, usually a reference to an undefined area of virtual memory or a write to a read-only text segment. Linux does not attempt recovery. Shells report it as "Segmentation fault."

Page fault (exception 14): the faulting instruction is restarted after the handler maps the appropriate page of virtual memory on disk into physical memory.

Machine check (exception 18): a fatal hardware error detected during execution of the faulting instruction; the handler never returns control to the application.

**Linux system calls.** Each system call has a unique integer number corresponding to an offset in a jump table in the kernel (distinct from the exception table). Examples:

| Number | Name | Description | Number | Name | Description |
|---|---|---|---|---|---|
| 0 | `read` | Read file | 33 | `pause` | Suspend process until signal arrives |
| 1 | `write` | Write file | 37 | `alarm` | Schedule delivery of alarm signal |
| 2 | `open` | Open file | 39 | `getpid` | Get process ID |
| 3 | `close` | Close file | 57 | `fork` | Create process |
| 4 | `stat` | Get info about file | 59 | `execve` | Execute a program |
| 9 | `mmap` | Map memory page to file | 60 | `_exit` | Terminate process |
| 12 | `brk` | Reset the top of the heap | 61 | `wait4` | Wait for a process to terminate |
| 32 | `dup2` | Copy file descriptor | 62 | `kill` | Send signal to a process |

C programs can invoke any system call directly with the `syscall` function, but this is rarely necessary: the C standard library provides wrapper functions that package the arguments, trap to the kernel, and pass back the return status. System calls and their wrappers are referred to interchangeably as system-level functions.

Register conventions for the `syscall` trapping instruction: all arguments pass through general-purpose registers, not the stack. `%rax` holds the syscall number; up to six arguments go in `%rdi`, `%rsi`, `%rdx`, `%r10`, `%r8`, `%r9` in that order. On return, `%rcx` and `%r11` are destroyed and `%rax` holds the return value. A return value between −4,095 and −1 indicates an error corresponding to negative `errno`.

`hello` implemented directly with system calls:

```asm
.section .data
string:
    .ascii "hello, world\n"
string_end:
    .equ len, string_end - string
.section .text
.globl main
main:
    # write(1, "hello, world\n", 13)
    movq $1, %rax        # write is system call 1
    movq $1, %rdi        # Arg1: stdout has descriptor 1
    movq $string, %rsi   # Arg2: hello world string
    movq $len, %rdx      # Arg3: string length
    syscall
    # _exit(0)
    movq $60, %rax       # _exit is system call 60
    movq $0, %rdi        # Arg1: exit status is 0
    syscall
```

!!! note "Terminology varies by manufacturer"
    The basic ideas are the same on every system, but some manufacturers' manuals use the word "exception" to refer only to changes in control flow caused by synchronous events.

## 8.2 Processes

The classic definition of a process is an instance of a program in execution. Each program runs in the context of some process. The context is the state the program needs to run correctly: code and data in memory, stack, general-purpose register contents, program counter, environment variables, and the set of open file descriptors.

Each time a user runs a program from the shell, the shell creates a new process and runs the executable object file in that context. Applications can likewise create new processes and run their own or other code in them. The process abstraction provides the application with:

- An independent logical control flow: the illusion of exclusive use of the processor.
- A private address space: the illusion of exclusive use of the memory system.

### 8.2.1 Logical Control Flow

The sequence of program counter values corresponding exclusively to instructions in a program's executable object file, or in shared objects linked in dynamically at run time, is the program's logical control flow (flow). The single physical control flow of the processor is partitioned into one logical flow per process. Processes take turns using the processor: each executes a portion of its flow and is preempted (temporarily suspended) while others take their turns. The only evidence against exclusive use is that precise timing would reveal periodic stalls between instructions; after each stall, execution resumes with no change to the program's memory or registers.

### 8.2.2 Concurrent Flows

Exception handlers, processes, signal handlers, and threads are all logical flows. A logical flow whose execution overlaps in time with another flow is a concurrent flow; the flows run concurrently. Precisely, flows X and Y are concurrent if and only if X begins after Y begins and before Y finishes, or Y begins after X begins and before X finishes.

The general phenomenon of multiple flows executing concurrently is concurrency. Processes taking turns is multitasking; each period during which a process executes a portion of its flow is a time slice, so multitasking is also called time slicing.

Concurrency is independent of the number of processor cores or computers involved: two flows overlapping in time are concurrent even on one processor. A proper subset of concurrent flows, those running at the same time on different cores or computers, are parallel flows, said to run in parallel and to have parallel execution.

### 8.2.3 Private Address Space

On a machine with n-bit addresses the address space is the set of 2^n possible addresses. A process provides each program with its own private address space: memory associated with an address in the space cannot in general be read or written by any other process. The contents differ per process, but the general organization is the same:

```
2^48 − 1 ┌────────────────────────────────┐
         │ Kernel memory                  │  (code, data, stack for the
         ├────────────────────────────────┤   kernel, invisible to user code)
         │ User stack                     │  ← %rsp, grows downward
         │        ▼                       │
         │                                │
         │        ▲                       │
         │ Memory-mapped region for       │
         │ shared libraries               │
         │                                │
         │        ▲                       │
         │ Run-time heap (via malloc)     │  ← brk
         ├────────────────────────────────┤
         │ Read/write segment             │  (.data, .bss)
         ├────────────────────────────────┤
         │ Read-only code segment         │  (.init, .text, .rodata)
0x400000 ├────────────────────────────────┤  loaded from the executable file
       0 └────────────────────────────────┘
```

The bottom portion holds the user program with the usual code, data, heap, and stack segments; the code segment always begins at address `0x400000`. The top portion is reserved for the kernel: the code, data, and stack the kernel uses when executing instructions on behalf of the process, e.g., during a system call.

### 8.2.4 User and Kernel Modes

An airtight process abstraction requires a processor mechanism restricting both the instructions an application can execute and the portions of the address space it can access. Processors provide a mode bit in a control register characterizing the current privileges:

| Mode bit | Mode | Capabilities |
|---|---|---|
| Set | Kernel mode (supervisor mode) | Any instruction in the instruction set; any memory location in the system |
| Not set | User mode | No privileged instructions (halting the processor, changing the mode bit, initiating I/O); no direct reference to kernel code or data. Violations cause a fatal protection fault |

User programs access kernel code and data only indirectly, via the system call interface. A process running application code starts in user mode; the only way to switch to kernel mode is an exception (interrupt, fault, or trapping system call). When the exception occurs and control passes to the handler, the processor switches to kernel mode; on return to application code it switches back to user mode.

Linux exposes the contents of many kernel data structures to user mode processes through the /proc filesystem, a hierarchy of text files. The /sys filesystem similarly exports low-level information about system buses and devices.

### 8.2.5 Context Switches

The kernel implements multitasking with a higher-level form of ECF called a context switch, built on top of the exception mechanism.

The kernel maintains a context for each process: the state needed to restart a preempted process, comprising the general-purpose registers, floating-point registers, program counter, user's stack, status registers, kernel's stack, and kernel data structures such as the page table (characterizing the address space), the process table (information about the process), and the file table (open files).

The decision to preempt the current process and restart a previously preempted one is scheduling, handled by kernel code called the scheduler. When the kernel schedules a new process, it performs a context switch that (1) saves the context of the current process, (2) restores the saved context of a previously preempted process, and (3) passes control to the restored process.

Context switches occur:

- During a system call on behalf of the user, if the call blocks (e.g., `read` waiting on a disk access, or an explicit `sleep`). Even a nonblocking system call may result in a switch at the kernel's discretion.
- As a result of an interrupt, e.g., periodic timer interrupts (typically every 1 ms or 10 ms) that let the kernel decide the current process has run long enough.

Example: process A traps into the kernel with a `read` requiring disk access. The trap handler requests a DMA transfer from the disk controller, arranges for a disk interrupt on completion, and rather than waiting tens of milliseconds performs a context switch to process B. There is no separate kernel process: before the switch the kernel executes in kernel mode on behalf of A, then on behalf of B, and after the switch B runs in user mode. When the disk interrupt signals completion, the kernel switches back from B to A, returning control in A to the instruction following the `read` system call.

## 8.3 System Call Error Handling

Unix system-level functions typically indicate errors by returning −1 and setting the global integer variable `errno`. The `strerror` function returns a text string describing the error associated with a given `errno` value. Checking should never be skipped:

```c
if ((pid = fork()) < 0) {
    fprintf(stderr, "fork error: %s\n", strerror(errno));
    exit(0);
}
```

An error-reporting function condenses the check, and error-handling wrappers (pioneered by Stevens) remove it from application code entirely: for a base function `foo`, the wrapper `Foo` has identical arguments, calls the base function, checks for errors, and terminates on any problem.

```c
pid_t Fork(void)
{
    pid_t pid;

    if ((pid = fork()) < 0)
        unix_error("Fork error");
    return pid;
}
```

The call site shrinks to `pid = Fork();`.

!!! note "Wrapper convention"
    The book uses capitalized wrappers (`Fork`, `Kill`, `Waitpid`) throughout its examples so code stays concise without implying that error checking may be ignored. In prose, system-level functions are referred to by their lowercase base names. The wrappers live in `csapp.c` with prototypes in `csapp.h`.

## 8.4 Process Control

### 8.4.1 Obtaining Process IDs

Each process has a unique positive (nonzero) process ID (PID).

```c
#include <sys/types.h>
#include <unistd.h>

pid_t getpid(void);    /* Returns: PID of the caller */
pid_t getppid(void);   /* Returns: PID of the parent */
```

Both return an integer of type `pid_t`, defined on Linux in `types.h` as an `int`.

### 8.4.2 Creating and Terminating Processes

From a programmer's perspective a process is in one of three states:

| State | Meaning |
|---|---|
| Running | Executing on the CPU, or waiting to execute and eventually scheduled by the kernel |
| Stopped | Execution suspended; not scheduled. Entered on receipt of SIGSTOP, SIGTSTP, SIGTTIN, or SIGTTOU; remains stopped until a SIGCONT signal makes it running again |
| Terminated | Stopped permanently, for one of three reasons: (1) receiving a signal whose default action is termination, (2) returning from `main`, (3) calling `exit` |

```c
#include <stdlib.h>
void exit(int status);    /* Does not return */
```

`exit` terminates the process with exit status `status`; the other way to set the exit status is to return an integer from `main`.

A parent process creates a new running child process by calling `fork`:

```c
#include <sys/types.h>
#include <unistd.h>

pid_t fork(void);
/* Returns: 0 to child, PID of child to parent, −1 on error */
```

The child is almost, but not quite, identical to the parent: it gets an identical but separate copy of the parent's user-level virtual address space (code and data segments, heap, shared libraries, user stack) and identical copies of the parent's open file descriptors, so it can read and write any file open in the parent at the time of the call. The most significant difference is the PIDs.

Key properties of `fork`:

- **Call once, return twice.** `fork` is called once by the parent but returns twice: in the parent with the PID of the child, and in the child with 0. Since a child's PID is always nonzero, the return value unambiguously distinguishes parent from child. Programs with multiple `fork` calls require careful reasoning.
- **Concurrent execution.** Parent and child run concurrently; the kernel interleaves the instructions of their logical control flows arbitrarily. No assumption about the interleaving is ever valid.
- **Duplicate but separate address spaces.** Immediately after `fork` returns, both address spaces are identical: same user stack, local variable values, heap, global values, and code. Subsequent changes by either process are private and not reflected in the other's memory.
- **Shared files.** The child inherits all of the parent's open files, e.g., an inherited `stdout` directed at the screen.

**Process graphs.** A process graph is a precedence graph capturing the partial ordering of program statements: vertex a corresponds to executing a statement; edge a → b means a happens before b. Edges can be labeled with variable values, `printf` vertices with their output. The graph starts at a vertex for the parent calling `main`; each process's vertex sequence ends at an `exit` vertex. For a single-processor program, any topological sort of the graph is a feasible total ordering of the statements: drawing a vertex permutation left to right, it is a topological sort if and only if every edge points left to right. A program that calls `Fork()` twice then `printf` runs four processes, each printing once, in any order corresponding to some topological sort.

### 8.4.3 Reaping Child Processes

A terminated process is not removed immediately; it is kept in a terminated state until reaped by its parent. On reaping, the kernel passes the child's exit status to the parent and discards the process, which then ceases to exist. A terminated but not yet reaped process is a zombie. Zombies do not run but still consume system memory resources.

When a parent terminates, the kernel arranges for the `init` process (PID 1, created at system startup, never terminates, ancestor of every process) to adopt its orphaned children and reap any zombies. Long-running programs such as shells and servers must nevertheless always reap their own zombie children.

A process waits for its children to terminate or stop with `waitpid`:

```c
#include <sys/types.h>
#include <sys/wait.h>

pid_t waitpid(pid_t pid, int *statusp, int options);
/* Returns: PID of child if OK, 0 (if WNOHANG), or −1 on error */
```

By default (`options == 0`) `waitpid` suspends the caller until a child in its wait set terminates; if one has already terminated at the time of the call, it returns immediately. Either way it returns the PID of the terminated child, which is then reaped and removed from the system.

Wait set membership, determined by `pid`:

| `pid` | Wait set |
|---|---|
| > 0 | Singleton: the child whose PID equals `pid` |
| −1 | All of the parent's child processes |

Default behavior, modified by ORing `options` constants:

| Option | Behavior |
|---|---|
| `WNOHANG` | Return immediately with 0 if no child in the wait set has terminated yet, instead of suspending the caller |
| `WUNTRACED` | Suspend until a process in the wait set terminates or stops; return its PID. Default returns only for terminated children |
| `WCONTINUED` | Suspend until a process in the wait set terminates or a stopped process resumes via SIGCONT |

If `statusp` is non-NULL, `waitpid` encodes status information about the causing child in `*statusp`, interpreted with macros from `wait.h`:

| Macro | Meaning |
|---|---|
| `WIFEXITED(status)` | True if the child terminated normally, via `exit` or a return |
| `WEXITSTATUS(status)` | Exit status of a normally terminated child; defined only if `WIFEXITED` returned true |
| `WIFSIGNALED(status)` | True if the child terminated because of an uncaught signal |
| `WTERMSIG(status)` | Number of the signal that caused termination; defined only if `WIFSIGNALED` returned true |
| `WIFSTOPPED(status)` | True if the causing child is currently stopped |
| `WSTOPSIG(status)` | Number of the signal that caused the stop; defined only if `WIFSTOPPED` returned true |
| `WIFCONTINUED(status)` | True if the child was restarted by receipt of SIGCONT |

Error conditions: with no children, `waitpid` returns −1 and sets `errno` to `ECHILD`; if interrupted by a signal, it returns −1 with `errno` set to `EINTR`.

The `wait` function is a simpler version: `wait(&status)` is equivalent to `waitpid(-1, &status, 0)`.

```c
#include <sys/types.h>
#include <sys/wait.h>

pid_t wait(int *statusp);
/* Returns: PID of child if OK or −1 on error */
```

Reaping in no particular order uses `waitpid` as a `while` loop test: with first argument −1 the call blocks until an arbitrary child terminates, and when all children have been reaped the next call returns −1 with `errno == ECHILD`:

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

The order in which children are reaped this way is nondeterministic; either outcome of any race is equally correct and no assumption about ordering is valid. Reaping in creation order eliminates the nondeterminism: store child PIDs in an array as they are forked and call `waitpid(pid[i++], &status, 0)` in sequence.

### 8.4.4 Putting Processes to Sleep

```c
#include <unistd.h>

unsigned int sleep(unsigned int secs);
/* Returns: seconds left to sleep */

int pause(void);
/* Always returns −1 */
```

`sleep` suspends the process for a specified time, returning 0 if the requested time elapsed and the number of seconds remaining otherwise, which happens when the sleep is interrupted by a signal that is not ignored. `pause` puts the caller to sleep until it receives a signal.

### 8.4.5 Loading and Running Programs

```c
#include <unistd.h>

int execve(const char *filename, const char *argv[], const char *envp[]);
/* Does not return if OK; returns −1 on error */
```

`execve` loads and runs the executable object file `filename` with argument list `argv` and environment variable list `envp` in the context of the current process. It returns to the caller only on error, such as an unlocatable `filename`: unlike `fork`, which is called once and returns twice, `execve` is called once and never returns.

`argv` points to a null-terminated array of pointers to argument strings; by convention `argv[0]` is the name of the executable object file. `envp` points to a null-terminated array of pointers to environment variable strings, each a name-value pair of the form `name=value`.

After `execve` loads `filename`, it calls the startup code (Section 7.9), which sets up the stack and passes control to `main`:

```c
int main(int argc, char **argv, char **envp);
```

User stack organization when `main` begins, from the bottom (highest address) to the top (lowest):

```
Bottom of stack (highest address)
┌───────────────────────────────────┐
│ Argument and environment strings  │
├───────────────────────────────────┤
│ envp[n−1] … envp[0]  (NULL-term.) │ ◀── environ (global var)
├───────────────────────────────────┤
│ argv[argc]=NULL … argv[0]         │
├───────────────────────────────────┤
│ Stack frame for libc_start_main   │
├───────────────────────────────────┤
│ Future stack frame for main       │
└───────────────────────────────────┘
Top of stack (lowest address)
```

The three arguments to `main` are passed in registers per the x86-64 convention: `argc` (number of non-null pointers in `argv[]`) in `%rdi`, `argv` (pointer to the first `argv[]` entry) in `%rsi`, `envp` (pointer to the first `envp[]` entry) in `%rdx`. The global variable `environ` points to `envp[0]`.

Environment array manipulation:

```c
#include <stdlib.h>

char *getenv(const char *name);
/* Returns: pointer to value if name exists, NULL if no match */

int setenv(const char *name, const char *newvalue, int overwrite);
/* Returns: 0 on success, −1 on error */

void unsetenv(const char *name);
/* Returns: nothing */
```

If the environment contains `name=oldvalue`, `unsetenv` deletes it and `setenv` replaces `oldvalue` with `newvalue`, but only if `overwrite` is nonzero. If `name` does not exist, `setenv` adds `name=newvalue`.

!!! note "Programs versus processes"
    A program is a collection of code and data; programs exist as object files on disk or as segments in an address space. A process is a specific instance of a program in execution; a program always runs in the context of some process. `fork` runs the same program in a new process that duplicates the parent. `execve` loads and runs a new program in the context of the current process: it overwrites the address space but does not create a new process, so the PID is unchanged and all files open at the time of the call are inherited.

### 8.4.6 Using fork and execve to Run Programs

Programs such as Unix shells and web servers make heavy use of `fork` and `execve`. A shell is an interactive application-level program that runs other programs on behalf of the user; the original `sh` was followed by `csh`, `tcsh`, `ksh`, and `bash`. A shell performs a sequence of read/evaluate steps: read a command line from the user, then parse it and run programs on the user's behalf.

Structure of a simple shell:

1. **Main loop.** Print a prompt, read a command line from `stdin` with `Fgets`, exit on EOF, and pass the line to `eval`.
2. **`eval`.** Call `parseline` to parse the space-separated arguments into the `argv` vector eventually passed to `execve`. The first argument is either a built-in command interpreted immediately or an executable object file to run in a new child. `parseline` returns 1 if the last argument is `&` (run the job in the background, without waiting) and 0 otherwise (run in the foreground and wait).
3. **`builtin_command`.** If the first argument is a built-in command (here only `quit`, which terminates the shell), interpret it immediately and return 1; otherwise return 0. Real shells have numerous built-ins such as `pwd`, `jobs`, and `fg`.
4. **Job execution.** If not a built-in, `Fork` a child and `execve` the requested program inside it (reporting "Command not found" if `execve` fails). For a foreground job the shell calls `waitpid` to wait for termination; for a background job it prints the PID and returns to the prompt.

```c
if (!builtin_command(argv)) {
    if ((pid = Fork()) == 0) {                     /* Child runs user job */
        if (execve(argv[0], argv, environ) < 0) {
            printf("%s: Command not found.\n", argv[0]);
            exit(0);
        }
    }

    if (!bg) {                    /* Parent waits for foreground job */
        int status;
        if (waitpid(pid, &status, 0) < 0)
            unix_error("waitfg: waitpid error");
    }
    else
        printf("%d %s", pid, cmdline);
}
```

This simple shell is flawed: it does not reap its background children. Correcting the flaw requires signals.

## 8.5 Signals

A Linux signal is a higher-level software form of ECF, allowing processes and the kernel to interrupt other processes. A signal is a small message notifying a process that an event of some type has occurred in the system. Linux supports 30 signal types:

| Number | Name | Default action | Corresponding event |
|---|---|---|---|
| 1 | SIGHUP | Terminate | Terminal line hangup |
| 2 | SIGINT | Terminate | Interrupt from keyboard |
| 3 | SIGQUIT | Terminate | Quit from keyboard |
| 4 | SIGILL | Terminate | Illegal instruction |
| 5 | SIGTRAP | Terminate and dump core | Trace trap |
| 6 | SIGABRT | Terminate and dump core | Abort signal from abort function |
| 7 | SIGBUS | Terminate | Bus error |
| 8 | SIGFPE | Terminate and dump core | Floating-point exception |
| 9 | SIGKILL | Terminate (cannot be caught or ignored) | Kill program |
| 10 | SIGUSR1 | Terminate | User-defined signal 1 |
| 11 | SIGSEGV | Terminate and dump core | Invalid memory reference (seg fault) |
| 12 | SIGUSR2 | Terminate | User-defined signal 2 |
| 13 | SIGPIPE | Terminate | Wrote to a pipe with no reader |
| 14 | SIGALRM | Terminate | Timer signal from alarm function |
| 15 | SIGTERM | Terminate | Software termination signal |
| 16 | SIGSTKFLT | Terminate | Stack fault on coprocessor |
| 17 | SIGCHLD | Ignore | A child process has stopped or terminated |
| 18 | SIGCONT | Ignore | Continue process if stopped |
| 19 | SIGSTOP | Stop until next SIGCONT (cannot be caught or ignored) | Stop signal not from terminal |
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

!!! note "Dumping core"
    Main memory was once implemented with core memory technology; "dumping core" is the historical term for writing an image of the code and data memory segments to disk.

Each signal type corresponds to a system event. Low-level hardware exceptions are processed by the kernel's exception handlers and would not normally be visible to user processes; signals expose such events to them. A process attempting to divide by zero receives SIGFPE (8); an illegal instruction yields SIGILL (4); an invalid memory reference yields SIGSEGV (11). Signals also notify processes of higher-level software events: Ctrl+C in the shell makes the kernel send SIGINT (2) to each process in the foreground process group; SIGKILL (9) forcibly terminates a process; SIGCHLD (17) is sent to the parent whenever a child terminates or stops.

### 8.5.1 Signal Terminology

Signal transfer occurs in two distinct steps:

- **Sending a signal.** The kernel sends (delivers) a signal to a destination process by updating some state in the destination's context, for one of two reasons: (1) the kernel detected a system event such as a divide-by-zero error or child termination; (2) a process invoked the `kill` function to explicitly request delivery. A process can send a signal to itself.
- **Receiving a signal.** The destination process receives a signal when it is forced by the kernel to react to the delivery. It can ignore the signal, terminate, or catch it by executing a user-level function called a signal handler.

A signal that has been sent but not yet received is a pending signal. At any time there is at most one pending signal of a particular type: if a process has a pending signal of type k, subsequent type-k signals are not queued but simply discarded. A process can selectively block the receipt of certain signals; a blocked signal can be delivered, but the resulting pending signal is not received until the signal is unblocked.

The kernel maintains, per process, a `pending` bit vector of pending signals (bit k set on delivery of type k, cleared on receipt) and a `blocked` bit vector, also known as the signal mask, of blocked signals.

### 8.5.2 Sending Signals

All Unix mechanisms for sending signals rely on process groups.

**Process groups.** Every process belongs to exactly one process group, identified by a positive integer process group ID. A child belongs by default to its parent's process group.

```c
#include <unistd.h>

pid_t getpgrp(void);
/* Returns: process group ID of calling process */

int setpgid(pid_t pid, pid_t pgid);
/* Returns: 0 on success, −1 on error */
```

`setpgid` changes the process group of process `pid` to `pgid`. If `pid` is 0, the caller's PID is used; if `pgid` is 0, the PID of the process named by `pid` becomes the group ID. If process 15213 calls `setpgid(0, 0)`, it creates and joins a new process group with ID 15213.

**Sending with the /bin/kill program.** `/bin/kill -9 15213` sends signal 9 (SIGKILL) to process 15213. A negative PID targets every process in a process group: `/bin/kill -9 -15213` sends SIGKILL to every process in group 15213. The full path is used because some shells have a built-in `kill` command.

**Sending from the keyboard.** Unix shells use the abstraction of a job for the processes created by evaluating one command line. At any time there is at most one foreground job and zero or more background jobs; a pipeline such as `ls | sort` creates one foreground job of two processes connected by a pipe. The shell creates a separate process group per job, typically taking the group ID from one of the parent processes in the job. Typing Ctrl+C causes the kernel to send SIGINT, and Ctrl+Z to send SIGTSTP, to every process in the foreground process group.

**Sending with the kill function.**

```c
#include <sys/types.h>
#include <signal.h>

int kill(pid_t pid, int sig);
/* Returns: 0 if OK, −1 on error */
```

| `pid` | Effect |
|---|---|
| > 0 | Send `sig` to process `pid` |
| = 0 | Send `sig` to every process in the caller's process group, including the caller |
| < 0 | Send `sig` to every process in process group \|pid\| |

**Sending with the alarm function.**

```c
#include <unistd.h>

unsigned int alarm(unsigned int secs);
/* Returns: remaining seconds of previous alarm, or 0 if none */
```

`alarm` arranges for the kernel to send SIGALRM to the caller in `secs` seconds; 0 schedules no new alarm. Any call cancels pending alarms and returns the seconds remaining until any pending alarm would have been delivered, or 0 if none were pending.

### 8.5.3 Receiving Signals

When the kernel switches a process p from kernel mode to user mode (returning from a system call or completing a context switch), it checks the set of unblocked pending signals, `pending & ~blocked`. If the set is empty (the usual case), control passes to Inext in p's logical control flow. If nonempty, the kernel chooses some signal k in the set, typically the smallest, and forces p to receive it. Receipt triggers some action; once complete, control passes back to Inext. Each signal type has one of four predefined default actions:

- The process terminates.
- The process terminates and dumps core.
- The process stops (suspends) until restarted by a SIGCONT signal.
- The process ignores the signal.

A process can modify the default action with the `signal` function, except for SIGSTOP and SIGKILL, whose default actions cannot be changed.

```c
#include <signal.h>
typedef void (*sighandler_t)(int);

sighandler_t signal(int signum, sighandler_t handler);
/* Returns: pointer to previous handler if OK, SIG_ERR on error (does not set errno) */
```

The `handler` argument changes the action associated with `signum`:

| `handler` | Action |
|---|---|
| `SIG_IGN` | Ignore signals of type `signum` |
| `SIG_DFL` | Revert to the default action for `signum` |
| Address of a user-defined function | Signal handler, called whenever the process receives a signal of type `signum`. Passing a handler address is installing the handler; invoking it is catching the signal; executing it is handling the signal |

A handler for signal k is invoked with a single integer argument set to k, so one handler function can catch different signal types. When the handler executes its `return` statement, control usually passes back to the instruction where the process was interrupted; on some systems, interrupted system calls instead return immediately with an error.

```c
void sigint_handler(int sig)      /* SIGINT handler */
{
    printf("Caught SIGINT!\n");
    exit(0);
}

int main()
{
    if (signal(SIGINT, sigint_handler) == SIG_ERR)
        unix_error("signal error");
    pause();                      /* Wait for the receipt of a signal */
    return 0;
}
```

Handlers are yet another example of concurrency: a handler interrupting the main program is conceptually a separate logical flow, not a separate process, running concurrently with it. Handlers can themselves be interrupted by other handlers: if the main program catches signal s and handler S is running when the process catches a different signal t, handler T interrupts S; when T returns, S resumes where it was interrupted, and when S returns, the main program resumes.

### 8.5.4 Blocking and Unblocking Signals

Linux blocks signals implicitly and explicitly:

- **Implicit.** By default the kernel blocks any pending signals of the type currently being processed by a handler: while handler S for signal s runs, another s becomes pending but is not received until S returns.
- **Explicit.** Applications block and unblock selected signals with `sigprocmask` and its helpers.

```c
#include <signal.h>

int sigprocmask(int how, const sigset_t *set, sigset_t *oldset);
int sigemptyset(sigset_t *set);
int sigfillset(sigset_t *set);
int sigaddset(sigset_t *set, int signum);
int sigdelset(sigset_t *set, int signum);
/* Return: 0 if OK, −1 on error */

int sigismember(const sigset_t *set, int signum);
/* Returns: 1 if member, 0 if not, −1 on error */
```

`sigprocmask` changes the `blocked` bit vector according to `how`:

| `how` | Behavior |
|---|---|
| `SIG_BLOCK` | `blocked = blocked \| set` |
| `SIG_UNBLOCK` | `blocked = blocked & ~set` |
| `SIG_SETMASK` | `blocked = set` |

If `oldset` is non-NULL, the previous `blocked` vector is stored there. `sigemptyset` initializes `set` to the empty set; `sigfillset` adds every signal; `sigaddset` and `sigdelset` add and delete `signum`; `sigismember` tests membership.

Temporarily blocking SIGINT:

```c
sigset_t mask, prev_mask;

Sigemptyset(&mask);
Sigaddset(&mask, SIGINT);

Sigprocmask(SIG_BLOCK, &mask, &prev_mask);   /* Block SIGINT, save prev set */
/* Code region that will not be interrupted by SIGINT */
Sigprocmask(SIG_SETMASK, &prev_mask, NULL);  /* Restore prev set */
```

### 8.5.5 Writing Signal Handlers

Handlers are tricky: they run concurrently with the main program and with each other, they share the same global variables and thus can interfere with the main program and other handlers, correct signal handling follows nonintuitive rules, and different systems have different signal-handling semantics.

**Safe signal handling.** Conservative guidelines that avoid concurrency errors, which otherwise fail unpredictably and unrepeatably:

- **G0. Keep handlers as simple as possible.** For example, set a global flag and return immediately; the main program periodically checks and resets the flag and does all processing.
- **G1. Call only async-signal-safe functions in handlers.** A function is async-signal-safe (safe) if it can be safely called from a handler, either because it is reentrant (accesses only local variables) or because it cannot be interrupted by a handler. Linux guarantees a specific list of system-level functions to be safe, including `_exit`, `write`, `wait`, `waitpid`, `sleep`, `kill`, and the `sigprocmask`/sigset family; popular functions such as `printf`, `sprintf`, `malloc`, and `exit` are not on the list. The only safe way to generate output from a handler is `write`.
- **G2. Save and restore `errno`.** Many safe functions set `errno` on error, which can interfere with other program code relying on it. Save `errno` to a local on handler entry and restore it before returning; unnecessary if the handler terminates the process via `_exit`.
- **G3. Protect accesses to shared global data structures by blocking all signals.** Accessing a shared data structure d usually takes a sequence of instructions; a handler interrupting the sequence may find d inconsistent, with unpredictable results. Both handlers and the main program temporarily block all signals while reading or writing d.
- **G4. Declare global variables with `volatile`.** If a handler updates a global g that `main` periodically reads, an optimizing compiler may cache g in a register, and `main` never sees updates. `volatile int g;` forces the compiler to read g from memory at every reference. As with any shared data, accesses should still be protected by temporarily blocking signals.
- **G5. Declare flags with `sig_atomic_t`.** For the common design where a handler writes a global flag that `main` polls, C provides the `sig_atomic_t` integer type with guaranteed atomic reads and writes: individual flag reads and writes need no signal blocking. Atomicity does not extend to updates such as `flag++` or `flag = flag + 1`, which may require multiple instructions.

These guidelines are conservative: e.g., calling `printf` from a handler is safe if no instance of `printf` can be interrupted by that handler, but such assertions are very difficult to prove in general.

The Sio (Safe I/O) package prints simple messages from handlers using only `write` and reentrant helpers (`sio_strlen`, `sio_ltoa`, the async-signal-safe `_exit`):

```c
ssize_t sio_puts(char s[]);   /* Emit string to stdout */
ssize_t sio_putl(long v);     /* Emit long to stdout */
void sio_error(char s[]);     /* Emit error message and _exit(1) */
```

**Correct signal handling.** Pending signals are not queued: the `pending` bit vector has exactly one bit per type, so at most one signal of a type can be pending. The existence of a pending signal means only that at least one signal of that type has arrived since the last receipt. Signals cannot be used to count events in other processes.

Consequence: a parent reaping children in a SIGCHLD handler must not assume one signal per terminated child. If three children terminate while the handler is processing the first SIGCHLD, the second becomes pending (SIGCHLD is implicitly blocked during the handler) and the third is discarded; a handler that reaps one child per invocation leaves a zombie. The fix reaps as many zombies as possible per invocation:

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

**Portable signal handling.** Signal-handling semantics differ across Unix systems:

- The semantics of `signal` varies: some older systems reset the action for signal k to its default after k is caught, requiring the handler to reinstall itself on every run.
- System calls can be interrupted: slow system calls such as `read`, `wait`, and `accept` that can block for long periods do not, on some older Unix versions, resume after a handler returns; they return immediately with an error and `errno == EINTR`, requiring manual restart code.

The Posix `sigaction` function lets users specify exact signal-handling semantics when installing a handler, but it is unwieldy, requiring a complicated structure. The cleaner approach, proposed by Stevens, is a `Signal` wrapper invoked like `signal`:

```c
handler_t *Signal(int signum, handler_t *handler)
{
    struct sigaction action, old_action;

    action.sa_handler = handler;
    sigemptyset(&action.sa_mask);   /* Block sigs of type being handled */
    action.sa_flags = SA_RESTART;   /* Restart syscalls if possible */

    if (sigaction(signum, &action, &old_action) < 0)
        unix_error("Signal error");
    return (old_action.sa_handler);
}
```

Semantics installed by `Signal`: only signals of the type currently being processed are blocked; signals are not queued; interrupted system calls are automatically restarted whenever possible; the handler remains installed until `Signal` is called with `SIG_IGN` or `SIG_DFL`.

### 8.5.6 Synchronizing Flows to Avoid Nasty Concurrency Bugs

The problem of concurrent flows: somehow synchronize them to allow the largest set of feasible interleavings such that each produces a correct result.

Example of the shell structure: the parent tracks children in a global job list, calling `addjob` after `fork` in the main routine and `deletejob` in the SIGCHLD handler after reaping. This contains a race, a classic synchronization error, between `addjob` and `deletejob`:

1. The parent forks and the kernel schedules the child instead of the parent.
2. The child terminates before the parent runs again, becoming a zombie; the kernel delivers SIGCHLD to the parent.
3. When the parent next becomes runnable, before it executes, the kernel notices the pending SIGCHLD and has the parent receive it.
4. The handler reaps the child and calls `deletejob`, which does nothing: the child was never added.
5. The parent then returns from `fork` and calls `addjob`, incorrectly adding a nonexistent child that will never be removed.

Interleavings where the parent runs first produce the correct order; the program is only sometimes wrong. The fix blocks SIGCHLD before `fork` and unblocks it only after `addjob`, guaranteeing the child is reaped after it is added to the job list. Children inherit their parent's blocked set, so the child must unblock SIGCHLD before calling `execve`:

```c
int main(int argc, char **argv)
{
    int pid;
    sigset_t mask_all, mask_one, prev_one;

    Sigfillset(&mask_all);
    Sigemptyset(&mask_one);
    Sigaddset(&mask_one, SIGCHLD);
    Signal(SIGCHLD, handler);
    initjobs();

    while (1) {
        Sigprocmask(SIG_BLOCK, &mask_one, &prev_one);    /* Block SIGCHLD */
        if ((pid = Fork()) == 0) {                       /* Child */
            Sigprocmask(SIG_SETMASK, &prev_one, NULL);   /* Unblock SIGCHLD */
            Execve("/bin/date", argv, NULL);
        }
        Sigprocmask(SIG_BLOCK, &mask_all, NULL);         /* Parent */
        addjob(pid);
        Sigprocmask(SIG_SETMASK, &prev_one, NULL);       /* Unblock SIGCHLD */
    }
    exit(0);
}
```

### 8.5.7 Explicitly Waiting for Signals

A main program sometimes must explicitly wait for a handler to run, e.g., a shell waiting for a foreground job to terminate and be reaped by the SIGCHLD handler before accepting the next command. The handler reaps a child and stores its nonzero PID in a global `pid`; the parent zeroes `pid`, unblocks SIGCHLD, and waits for `pid` to become nonzero. Candidate wait loops:

| Loop | Property |
|---|---|
| `while (!pid) ;` | Correct, but the spin loop wastes processor resources |
| `while (!pid) pause();` | Serious race: if SIGCHLD is received after the `while` test but before `pause`, the `pause` sleeps forever. A loop is still required because `pause` can be interrupted by SIGINT signals |
| `while (!pid) sleep(1);` | Correct but too slow: a signal received between the test and the `sleep` costs up to a full second per iteration. No higher-resolution interval (`nanosleep`) is acceptable either: too small approaches a spin loop, too large is too slow |

The solution is `sigsuspend`:

```c
#include <signal.h>

int sigsuspend(const sigset_t *mask);
/* Returns: −1 */
```

`sigsuspend` temporarily replaces the current blocked set with `mask` and suspends the process until receipt of a signal whose action is to run a handler or to terminate the process. If the action is termination, the process terminates without returning; if a handler runs, `sigsuspend` returns after the handler returns, restoring the blocked set to its state at the call. It is equivalent to an atomic (uninterruptible) version of:

```c
sigprocmask(SIG_BLOCK, &mask, &prev);
pause();
sigprocmask(SIG_SETMASK, &prev, NULL);
```

The atomicity eliminates the race where a signal arrives between `sigprocmask` and `pause`. Usage replacing the spin loop: block SIGCHLD before each iteration, then

```c
pid = 0;
while (!pid)
    sigsuspend(&prev);          /* Temporarily unblocks SIGCHLD, sleeps */
Sigprocmask(SIG_SETMASK, &prev, NULL);   /* Optionally unblock SIGCHLD */
```

If a SIGINT is caught, the loop test succeeds and `sigsuspend` is called again; if SIGCHLD is caught, the handler sets `pid`, the test fails, and the loop exits with SIGCHLD blocked. The `sigsuspend` version is less wasteful than spinning, avoids the `pause` race, and is more efficient than `sleep`.

## 8.6 Nonlocal Jumps

C provides a user-level form of ECF, the nonlocal jump, transferring control directly from one function to another currently executing function without going through the normal call-and-return sequence.

```c
#include <setjmp.h>

int setjmp(jmp_buf env);
int sigsetjmp(sigjmp_buf env, int savesigs);
/* Returns: 0 from setjmp, nonzero from longjmps */

void longjmp(jmp_buf env, int retval);
void siglongjmp(sigjmp_buf env, int retval);
/* Never returns */
```

`setjmp` saves the current calling environment (program counter, stack pointer, general-purpose registers) in the `env` buffer for later use by `longjmp`, and returns 0. The value `setjmp` returns should not be assigned to a variable, but can safely be used as a test in a `switch` or conditional statement.

`longjmp` restores the calling environment from `env` and triggers a return from the most recent `setjmp` call that initialized `env`; that `setjmp` then returns with the nonzero value `retval`.

`setjmp` is called once but returns multiple times: once when first called and once for each corresponding `longjmp`. `longjmp` is called once but never returns.

**Application 1: immediate return from a deeply nested call**, usually on detecting an error condition, instead of laboriously unwinding the call stack. The main routine calls `setjmp` to save the environment, then calls the nested functions; any function detecting an error returns directly to the `setjmp` site via `longjmp`, whose nonzero return value encodes the error type, decoded and handled in one place:

```c
jmp_buf buf;

int main()
{
    switch(setjmp(buf)) {
    case 0:  foo(); break;
    case 1:  printf("Detected an error1 condition in foo\n"); break;
    case 2:  printf("Detected an error2 condition in foo\n"); break;
    default: printf("Unknown error condition in foo\n");
    }
    exit(0);
}

void foo(void) { if (error1) longjmp(buf, 1); bar(); }
void bar(void) { if (error2) longjmp(buf, 2); }
```

Skipping all intermediate calls has unintended consequences: data structures allocated in intermediate functions with the intention of deallocating them at function end are never freed, creating memory leaks.

**Application 2: branch out of a signal handler** to a specific code location rather than returning to the interrupted instruction. `sigsetjmp` and `siglongjmp` are the versions usable by signal handlers; the initial `sigsetjmp` call saves the calling environment and signal context, including the pending and blocked signal vectors. Soft-restart pattern: the handler for SIGINT performs a nonlocal jump back to the start of `main` instead of returning to the interrupted processing loop:

```c
sigjmp_buf buf;

void handler(int sig)
{
    siglongjmp(buf, 1);
}

int main()
{
    if (!sigsetjmp(buf, 1)) {
        Signal(SIGINT, handler);
        Sio_puts("starting\n");
    }
    else
        Sio_puts("restarting\n");

    while(1) {
        Sleep(1);
        Sio_puts("processing...\n");
    }
    exit(0);   /* Control never reaches here */
}
```

Two subtleties: (1) the handler must be installed after the `sigsetjmp` call, otherwise the handler risks running before the calling environment for `siglongjmp` is set up; (2) `sigsetjmp` and `siglongjmp` are not async-signal-safe, because `siglongjmp` can in general jump into arbitrary code, so only safe functions may be called in any code reachable from a `siglongjmp` (here the safe `sio_puts` and `sleep`; the unsafe `exit` is unreachable).

!!! note "Software exceptions in C++ and Java"
    The exception mechanisms of C++ and Java (`try`, `catch`, `throw`) are higher-level, more structured versions of the C `setjmp` and `longjmp` functions: `catch` clauses inside a `try` statement act like `setjmp`, and a `throw` statement acts like `longjmp`.

## 8.7 Tools for Manipulating Processes

| Tool | Function |
|---|---|
| `strace` | Prints a trace of each system call invoked by a running program and its children. Compile with `-static` for a cleaner trace without shared library output |
| `ps` | Lists processes, including zombies, currently in the system |
| `top` | Prints information about the resource usage of current processes |
| `pmap` | Displays the memory map of a process |
| `/proc` | Virtual filesystem exporting the contents of numerous kernel data structures as ASCII text readable by user programs, e.g., `cat /proc/loadavg` |

## 8.8 Summary

Exceptional control flow occurs at all levels of a computer system and is the basic mechanism for providing concurrency. At the hardware level, exceptions are abrupt control transfers to kernel handlers in response to events detected by the processor. The four classes: interrupts occur asynchronously when an external I/O device sets the interrupt pin, returning to the next instruction; faults and aborts occur synchronously as a result of instruction execution, fault handlers restarting the faulting instruction and abort handlers never returning; traps are function-call-like exceptions implementing system calls, the controlled entry points into the operating system.

At the operating system level, the kernel uses ECF to provide the process abstraction: logical control flows giving each program the illusion of exclusive use of the processor, and private address spaces giving the illusion of exclusive use of main memory.

At the interface between operating system and applications, processes create child processes, wait for them to stop or terminate, run new programs, and catch signals from other processes. Signal-handling semantics is subtle and varies across systems, but Posix mechanisms allow programs to specify the expected semantics explicitly.

At the application level, C programs use nonlocal jumps to bypass the normal call/return stack discipline and branch directly from one function to another.
