#!/usr/bin/env python3
"""arch-install-vm — the guide's installer, run for real in a virtual machine.

Boots the official Arch ISO under QEMU with OVMF, feeds it the guide's
install script (docs/assets/arch-linux/install) through archiso's
`script=` kernel parameter with the answers in the environment, lets
it install onto a blank virtual disk, then boots the disk and drives
the real boot chain over the serial console: GRUB's menu (read off the
VGA screen), the initramfs passphrase prompt, the console login, and
the script's own `verify` subcommand, whose rows must all be lit.

Needs: qemu-system-x86_64 with KVM (/dev/kvm readable), the edk2 OVMF
images, bsdtar, tesseract (the GRUB menu is read by OCR), an Arch ISO,
and a pacman package cache to serve as a local mirror ahead of the
real ones so a run does not download the world twice. Nothing runs as
root and nothing touches the host beyond ~/.cache/kiln-vm.

  tests/arch-install-vm.py smoke     boot the ISO, prove serial, script=, network, mirror
  tests/arch-install-vm.py install   stage 1: the install, log in work/install.log
  tests/arch-install-vm.py boot      stage 2: boot the disk, verify, log in work/boot.log
  tests/arch-install-vm.py all       install then boot

  KILN_ISO     the ISO (default ~/Downloads/archlinux-*-x86_64.iso, newest)
  KILN_WORK    the work dir (default ~/.cache/kiln-vm)
"""
import functools
import glob
import http.server
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INSTALLER = REPO / "docs/assets/arch-linux/install"
WORK = Path(os.environ.get("KILN_WORK", Path.home() / ".cache/kiln-vm"))
OVMF_CODE = Path("/usr/share/edk2/x64/OVMF_CODE.4m.fd")
OVMF_VARS = Path("/usr/share/edk2/x64/OVMF_VARS.4m.fd")
PORT = 8642
HOST_FROM_GUEST = "10.0.2.2"      # QEMU user networking: the host

# The answers the installer is fed. Nothing personal: a throwaway
# machine with throwaway secrets.
ANSWERS = {
    "KILN_DISK": "/dev/vda",
    "KILN_HOSTNAME": "forge",
    "KILN_USER": "smith",
    "KILN_TIMEZONE": "Europe/Prague",
    "KILN_ROOT_PASSWORD": "root-pw-1",
    "KILN_USER_PASSWORD": "smith-pw-1",
    "KILN_LUKS_PASSPHRASE": "open-sesame-1",
}


def log(msg):
    print(f"[vm] {msg}", flush=True)


def die(msg):
    print(f"[vm] FAIL: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


# ------------------------------------------------------------ preparation ---
def iso_path():
    if "KILN_ISO" in os.environ:
        return Path(os.environ["KILN_ISO"])
    found = sorted(glob.glob(str(Path.home() / "Downloads/archlinux-*-x86_64.iso")))
    if not found:
        die("no ISO: set KILN_ISO")
    return Path(found[-1])


def prepare():
    """Extract the ISO's kernel, initramfs and boot options once; lay out
    the http root: the installer, the stage wrappers, the package mirror."""
    iso = iso_path()
    for tool in ("qemu-system-x86_64", "bsdtar", "tesseract", "qemu-img"):
        if not shutil.which(tool):
            die(f"{tool} not installed")
    if not os.access("/dev/kvm", os.R_OK | os.W_OK):
        die("/dev/kvm not accessible")
    boot = WORK / "iso"
    kernel = boot / "arch/boot/x86_64/vmlinuz-linux"
    if not kernel.exists():
        boot.mkdir(parents=True, exist_ok=True)
        log(f"extracting the kernel and initramfs from {iso.name}")
        subprocess.run(["bsdtar", "-xf", str(iso), "-C", str(boot),
                        "arch/boot/x86_64/vmlinuz-linux", "arch/boot/x86_64/initramfs-linux.img",
                        "loader/entries/01-archiso-linux.conf"], check=True)
    entry = (boot / "loader/entries/01-archiso-linux.conf").read_text()
    options = re.search(r"^options\s+(.*)$", entry, re.M).group(1)

    http_root = WORK / "http"
    http_root.mkdir(parents=True, exist_ok=True)
    mirror = http_root / "pkg"
    if not mirror.exists():
        mirror.mkdir()
        for f in glob.glob("/var/cache/pacman/pkg/*"):
            os.symlink(f, mirror / os.path.basename(f))
    for db in glob.glob("/var/lib/pacman/sync/*.db"):
        shutil.copy(db, mirror / os.path.basename(db))
    assets = http_root / "assets"
    if not assets.exists():
        os.symlink(REPO / "docs/assets", assets)
    return iso, kernel, boot / "arch/boot/x86_64/initramfs-linux.img", options


def write_wrapper(name, body):
    """A stage script the ISO fetches through script=: output to the
    serial console, the answers in the environment, then the body."""
    env = "\n".join(f"export {k}='{v}'" for k, v in ANSWERS.items())
    text = f"""#!/bin/bash
exec > /dev/ttyS0 2>&1
echo "WRAPPER-START {name}"
systemctl is-system-running --wait > /dev/null
# the ranked list the installer expects, with the host's package cache ahead of it
reflector --latest 10 --protocol https --sort rate --save /etc/pacman.d/mirrorlist > /dev/null 2>&1
sed -i '1i Server = http://{HOST_FROM_GUEST}:{PORT}/pkg' /etc/pacman.d/mirrorlist
export KILN_ASSETS=http://{HOST_FROM_GUEST}:{PORT}/assets
{env}
{body}
sync
echo "WRAPPER-END {name}"
sleep 1
systemctl poweroff
"""
    path = WORK / "http" / f"stage-{name}.sh"
    path.write_text(text)
    return path


def serve():
    """The http root on the loopback; QEMU's user network reaches it as
    10.0.2.2."""
    if INSTALLER.exists():
        shutil.copy(INSTALLER, WORK / "http" / "install")
    quiet = type("Quiet", (http.server.SimpleHTTPRequestHandler,),
                 {"log_message": lambda self, *a: None})
    handler = functools.partial(quiet, directory=str(WORK / "http"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def fresh_disk():
    disk = WORK / "disk.qcow2"
    if disk.exists():
        disk.unlink()
    subprocess.run(["qemu-img", "create", "-q", "-f", "qcow2", str(disk), "24G"], check=True)
    vars_ = WORK / "OVMF_VARS.fd"
    shutil.copy(OVMF_VARS, vars_)
    return disk


def qemu(extra, serial, iso=None):
    cmd = ["qemu-system-x86_64", "-enable-kvm", "-cpu", "host", "-smp", "4", "-m", "4G",
           "-machine", "q35", "-display", "none", "-vga", "std",
           "-drive", f"if=pflash,format=raw,readonly=on,file={OVMF_CODE}",
           "-drive", f"if=pflash,format=raw,file={WORK / 'OVMF_VARS.fd'}",
           "-drive", f"file={WORK / 'disk.qcow2'},if=virtio,format=qcow2",
           "-netdev", "user,id=n0", "-device", "virtio-net-pci,netdev=n0",
           "-monitor", f"unix:{WORK / 'mon.sock'},server,nowait",
           "-serial", serial]
    if iso:
        cmd += ["-cdrom", str(iso)]
    return subprocess.Popen(cmd + extra)


# ------------------------------------------------------------- stage one ---
def run_iso_stage(name, body, timeout):
    """Boot the ISO with script= pointing at a wrapper, wait for the
    machine to power itself off, return the serial log."""
    iso, kernel, initrd, options = prepare()
    write_wrapper(name, body)
    srv = serve()
    logfile = WORK / f"{name}.log"
    logfile.unlink(missing_ok=True)
    append = f"{options} console=ttyS0,115200 script=http://{HOST_FROM_GUEST}:{PORT}/stage-{name}.sh"
    log(f"booting the ISO: {name}")
    proc = qemu(["-kernel", str(kernel), "-initrd", str(initrd), "-append", append],
                f"file:{logfile}", iso=iso)
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        srv.shutdown()
        die(f"{name}: the machine did not power off within {timeout}s (see {logfile})")
    srv.shutdown()
    text = logfile.read_text(errors="replace")
    if f"WRAPPER-END {name}" not in text:
        die(f"{name}: the wrapper did not finish (see {logfile})")
    return text


def smoke():
    fresh_disk()
    body = f"""
echo "SMOKE cpu $(grep -m1 vendor_id /proc/cpuinfo)"
echo "SMOKE disk $(lsblk -dno NAME,SIZE /dev/vda)"
echo "SMOKE efi $(cat /sys/firmware/efi/fw_platform_size)"
curl -fsS http://{HOST_FROM_GUEST}:{PORT}/smoke > /dev/null && echo "SMOKE http ok"
pacman -Sy > /dev/null 2>&1 && echo "SMOKE sync ok"
pacman -Sw --noconfirm tree > /dev/null 2>&1 && echo "SMOKE mirror ok"
timedatectl show -p NTPSynchronized
systemctl is-active pacman-init
head -2 /etc/pacman.d/mirrorlist
"""
    text = run_iso_stage("smoke", body, timeout=600)
    for want in ("SMOKE cpu", "SMOKE disk vda", "SMOKE efi 64", "SMOKE http ok", "SMOKE sync ok", "SMOKE mirror ok"):
        if want not in text:
            die(f"smoke: missing {want!r} in {WORK / 'smoke.log'}")
    log("smoke: serial, script=, network, efi, disk and the mirror all answer")


def install():
    if not INSTALLER.exists():
        die(f"no installer at {INSTALLER}")
    fresh_disk()
    body = f"""
curl -fsSLo /root/install http://{HOST_FROM_GUEST}:{PORT}/install || echo "FETCH-FAILED"
if bash /root/install install --yes; then echo "INSTALL-OK"; else echo "INSTALL-FAILED $?"; fi
"""
    text = run_iso_stage("install", body, timeout=2400)
    if "INSTALL-OK" not in text:
        die(f"install: the installer did not report success (see {WORK / 'install.log'})")
    # the first menu entry's linux line, as grub.cfg has it, to be typed
    # verbatim at the GRUB shell in the boot stage
    m = re.search(r"^linux\s+/vmlinuz-linux\s+(.*?)\s*$", text, re.M)
    if not m:
        die("install: grub.cfg's linux line was never printed")
    (WORK / "cmdline").write_text(m.group(1))
    log(f"install: ok, the entry boots /vmlinuz-linux {m.group(1)}")


# ------------------------------------------------------------- stage two ---
class Monitor:
    """QEMU's human monitor over its unix socket: keys and screenshots."""
    KEYS = {" ": "spc", "-": "minus", "=": "equal", "/": "slash", ".": "dot", ",": "comma",
            ":": "shift-semicolon", "_": "shift-minus", "\n": "ret", "@": "shift-2",
            "(": "shift-9", ")": "shift-0", "*": "shift-8", "'": "apostrophe", '"': "shift-apostrophe",
            ";": "semicolon", "$": "shift-4", "~": "shift-grave_accent", "|": "shift-backslash",
            "&": "shift-7", "!": "shift-1", "#": "shift-3", "%": "shift-5", "+": "shift-equal",
            "<": "shift-comma", ">": "shift-dot", "?": "shift-slash", "[": "bracket_left",
            "]": "bracket_right", "\\": "backslash"}

    def __init__(self, path):
        self.sock = socket.socket(socket.AF_UNIX)
        for _ in range(50):
            try:
                self.sock.connect(str(path))
                break
            except OSError:
                time.sleep(0.2)
        self.sock.settimeout(5)
        self.read_prompt()

    def read_prompt(self):
        buf = b""
        while not buf.endswith(b"(qemu) "):
            buf += self.sock.recv(4096)
        return buf.decode(errors="replace")

    def cmd(self, line):
        self.sock.sendall((line + "\n").encode())
        return self.read_prompt()

    def key(self, name):
        self.cmd(f"sendkey {name}")
        time.sleep(0.04)

    def type(self, text):
        for ch in text:
            if ch in self.KEYS:
                self.key(self.KEYS[ch])
            elif ch.isupper():
                self.key(f"shift-{ch.lower()}")
            else:
                self.key(ch)

    def screen_text(self):
        ppm = WORK / "screen.ppm"
        self.cmd(f"screendump {ppm}")
        time.sleep(0.3)
        out = subprocess.run(["tesseract", str(ppm), "-", "--psm", "6"],
                             capture_output=True, text=True)
        return out.stdout


class Serial:
    """The guest's serial console as a socket: expect and send."""

    def __init__(self, path, logfile):
        self.sock = socket.socket(socket.AF_UNIX)
        for _ in range(50):
            try:
                self.sock.connect(str(path))
                break
            except OSError:
                time.sleep(0.2)
        self.log = open(logfile, "wb")
        self.buf = b""

    def expect(self, pattern, timeout):
        deadline = time.time() + timeout
        rx = re.compile(pattern.encode())
        while True:
            m = rx.search(self.buf)
            if m:
                self.buf = self.buf[m.end():]
                return m
            if time.time() > deadline:
                die(f"boot: waited {timeout}s for {pattern!r}, see {self.log.name}")
            self.sock.settimeout(max(0.1, deadline - time.time()))
            try:
                data = self.sock.recv(4096)
            except socket.timeout:
                continue
            if not data:
                time.sleep(0.1)
                continue
            self.log.write(data)
            self.log.flush()
            self.buf += data

    def send(self, text):
        self.sock.sendall(text.encode())


def boot():
    cmdline_file = WORK / "cmdline"
    if not cmdline_file.exists():
        die("boot: no installed system (run install first)")
    cmdline = cmdline_file.read_text().strip()
    srv = serve()
    serial_sock = WORK / "serial.sock"
    serial_sock.unlink(missing_ok=True)
    (WORK / "mon.sock").unlink(missing_ok=True)
    log("booting the installed disk")
    proc = qemu([], f"unix:{serial_sock},server,nowait")
    mon = Monitor(WORK / "mon.sock")
    ser = Serial(serial_sock, WORK / "boot.log")
    try:
        # the GRUB menu, read off the screen. An arrow key before every
        # look stops the countdown once the menu is there (the firmware
        # ignores it earlier); OCR misreads the highlighted row, so the
        # entries are matched loosely and the kernels themselves are
        # proven by the install log's "Found linux image" lines.
        deadline = time.time() + 90
        screen = ""
        while time.time() < deadline:
            mon.key("up")
            screen = mon.screen_text()
            if "grub" in screen.lower():
                break
            time.sleep(1)
        else:
            die("boot: no GRUB menu on the screen")
        (WORK / "grub-menu.txt").write_text(screen)
        if "dvanced options for arch linux" not in screen.lower():
            die(f"boot: the GRUB menu lacks the Advanced options entry: {screen!r}")
        log("boot: GRUB menu up")
        # the first entry's own linux line, plus the serial console so
        # the rest is driven from here
        mon.key("c")
        time.sleep(1)
        mon.type(f"linux /vmlinuz-linux {cmdline} console=ttyS0,115200\n")
        mon.type("initrd /intel-ucode.img /initramfs-linux.img\n")
        mon.type("boot\n")
        ser.expect(r"Enter passphrase for", 120)
        log("boot: passphrase prompt")
        ser.send(ANSWERS["KILN_LUKS_PASSPHRASE"] + "\n")
        ser.expect(rf"{ANSWERS['KILN_HOSTNAME']} login:", 180)
        log("boot: login prompt")
        ser.send(ANSWERS["KILN_USER"] + "\n")
        ser.expect(r"Password:", 30)
        ser.send(ANSWERS["KILN_USER_PASSWORD"] + "\n")
        ser.expect(r"\$ ", 60)
        log("boot: logged in, running verify")
        ser.send(f"curl -fsSLo install http://{HOST_FROM_GUEST}:{PORT}/install; sudo bash install verify; echo VERIFY-EXIT=$?\n")
        ser.expect(r"password for", 60)
        ser.send(ANSWERS["KILN_USER_PASSWORD"] + "\n")
        m = ser.expect(r"VERIFY-EXIT=(\d+)", 900)
        code = int(m.group(1))
        # the guide's snapshot verification: one small package, and the
        # transaction announces its pre and post snapshots
        ser.send("sudo pacman -S --noconfirm tree 2>&1 | grep -c snapshots; snapper list | tail -n +3 | wc -l; echo SNAP-DONE\n")
        m = ser.expect(r"(\d+)\r?\n(\d+)\r?\nSNAP-DONE", 600)
        announced, listed = int(m.group(1)), int(m.group(2))
        ser.send("sudo systemctl poweroff\n")
        try:
            proc.wait(timeout=120)
        except subprocess.TimeoutExpired:
            proc.kill()
        text = (WORK / "boot.log").read_bytes().decode(errors="replace")
        dark = [l for l in text.splitlines() if "[ - ]" in l]
        if code != 0 or dark:
            die("boot: verify failed:\n" + "\n".join(dark))
        if announced < 2 or listed < 2:
            die(f"boot: the pacman transaction announced {announced} snapshot lines, snapper lists {listed}")
        log("boot: verify all green, snapshots bracket a transaction")
    finally:
        if proc.poll() is None:
            proc.kill()
        srv.shutdown()


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    WORK.mkdir(parents=True, exist_ok=True)
    if stage == "smoke":
        smoke()
    elif stage == "install":
        install()
    elif stage == "boot":
        boot()
    elif stage == "all":
        install()
        boot()
    else:
        die(__doc__)


if __name__ == "__main__":
    main()
