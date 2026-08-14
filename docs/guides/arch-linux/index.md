# Arch Linux

A manual installation, no archinstall, run over SSH from a second machine.
The result is a LUKS2-encrypted btrfs system with manual pre-upgrade
snapshots, GRUB with bootable snapshot entries, zram swap, and the niri
workspace deployed from
[dotfiles](https://github.com/nafud/dotfiles){ .external-link } in one
command. Written against one specific laptop. The shape transfers to any
UEFI machine; the device names, sizes, and firmware keys may not.

## Target

| Component | Detail |
| --- | --- |
| Machine | Lenovo ThinkBook 14 G2 ITL (20VD) |
| CPU | Intel Core i7-1165G7 (Tiger Lake, 4c/8t) |
| GPU | Intel Iris Xe, kernel `i915` driver |
| RAM | 24 GB |
| Disk | 477 GB NVMe at `/dev/nvme0n1` |
| Wireless | Intel Wi-Fi 6 AX201 on `iwlwifi`; its Bluetooth half stays soft-blocked and unused |
| Camera | UVC device, works with no packages |
| Firmware | UEFI. Secure Boot on under the outgoing OS, disabled for good below |

**Decisions.** Settled up front, since the whole disk layout follows from
them.

| Topic | Choice | Rationale |
| --- | --- | --- |
| Filesystem | btrfs on LUKS2, no LVM | Subvolumes share one pool instead of fixed-size volumes, and snapper plus grub-btrfs give a manual revert point before major upgrades. ZFS was considered and rejected as an out-of-tree module on a rolling kernel whose multi-disk strengths a single NVMe never uses |
| Bootloader | GRUB | grub-btrfs generates boot menu entries for snapshots; systemd-boot has no equivalent |
| `/boot` | Separate unencrypted ext4 | GRUB never has to unlock LUKS, so the LUKS2 argon2id defaults stay |
| Kernels | `linux` and `linux-lts` | Snapshots do not cover `/boot`. The LTS entry answers a broken kernel the way snapshots answer broken userspace |
| Swap | zram only | No partition, no swapfile, no hibernation. Plain suspend covers the use case |
| Secure Boot | Off, for the install and after | The Arch ISO is unsigned. Re-enabling later with `sbctl` and custom keys is possible and out of scope |

## Preparation

Two things before the ISO ever boots.

**Backup.** The install wipes the disk whole. Anything not in a remote
repository dies with it, so sweep the outgoing system first. SSH keys
(`~/.ssh`) matter twice over, once as data and once because pushing to the
dotfiles repository from the new system depends on them. GPG keys, browser
profiles, documents, and any uncommitted configs round out the list.

**Secure Boot.** The outgoing OS boots through a Microsoft-signed shim; the
Arch ISO is unsigned and the firmware will refuse it. Enter firmware setup
(F1 at power-on on ThinkBooks), then Security, Secure Boot, Disabled. It
stays off after the install.

## ISO and USB

Download `archlinux-x86_64.iso` and its checksum file from the
[Arch download page](https://archlinux.org/download/){ .external-link },
then verify and write the stick.

```bash
sha256sum -c --ignore-missing sha256sums.txt

lsblk -d -o NAME,SIZE,MODEL     # identify the stick, not a hard disk
sudo dd if=archlinux-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

Boot the target machine with F12 and pick the `UEFI:`-prefixed entry for
the stick. A legacy entry may sit next to it in the menu, and booting that
one lands in BIOS mode, which fails the first sanity check below.

## Remote Session

The install runs over SSH for copy-paste, scrollback, and documentation in
a browser. Only this bootstrap and the LUKS passphrase ever need the target
machine's own keyboard. The live ISO already runs sshd, but root's password
is empty and SSH refuses empty passwords, so at the target's console set
one, join the network, and note the address.

```console
# passwd
# iwctl
[iwd]# station wlan0 connect "SSID"
[iwd]# exit
# ip -br addr
```

Ethernet needs none of the iwctl part. From the second machine, connect and
open a multiplexer immediately; a Wi-Fi hiccup then suspends the SSH
session without killing a package transaction mid-write, and `tmux attach`
resumes it.

```bash
ssh root@<ip>
tmux
```

## Disk Layout

!!! warning "Full wipe"
    Everything from `fdisk` on destroys the previous contents of
    `/dev/nvme0n1`, the outgoing OS included.

Confirm UEFI mode and the target disk first.

```bash
cat /sys/firmware/efi/fw_platform_size    # must print 64
lsblk -d -o NAME,SIZE,MODEL               # confirm nvme0n1 is the target
```

`fdisk /dev/nvme0n1` drives the whole table. `g` writes a fresh GPT label,
`n` three times creates the partitions sized as below, `t` sets the first
partition's type to `1` (EFI System), and `w` writes it out.

| Partition | Size | Type | Purpose |
| --- | --- | --- | --- |
| `nvme0n1p1` | 1G | EFI System | ESP, mounted at `/boot/efi` |
| `nvme0n1p2` | 1G | Linux | `/boot`, unencrypted ext4 |
| `nvme0n1p3` | rest (~475G) | Linux | LUKS2 container |

Format the plain partitions, then create the encrypted container. The
`cryptsetup` defaults already mean LUKS2 with argon2id, and since `/boot`
lives outside the container, GRUB never needs to read through the
encryption and the defaults stand.

```bash
mkfs.fat -F32 /dev/nvme0n1p1
mkfs.ext4 /dev/nvme0n1p2

cryptsetup luksFormat /dev/nvme0n1p3
cryptsetup open /dev/nvme0n1p3 cryptroot
```

btrfs goes directly on the mapper device. Five subvolumes carve up the
pool. `@` and `@home` split system from data without fixing either one's
size. `@log` and `@pkg` exist to be excluded from snapshots, so a rollback
never reverts the logs that explain what went wrong and never re-downloads
the package cache. `@snapshots` is where snapper will live, kept top-level
so a root rollback cannot take the snapshots down with itself.

```bash
mkfs.btrfs -L arch /dev/mapper/cryptroot

mount /dev/mapper/cryptroot /mnt
btrfs subvolume create /mnt/@            # /
btrfs subvolume create /mnt/@home        # /home
btrfs subvolume create /mnt/@log         # /var/log
btrfs subvolume create /mnt/@pkg         # /var/cache/pacman/pkg
btrfs subvolume create /mnt/@snapshots   # /.snapshots
umount /mnt
```

Mount the tree. `compress=zstd` is transparent compression, typically a
30 to 50 percent saving on system files at negligible CPU cost on this
hardware.

```bash
o=compress=zstd,noatime
mount -o subvol=@,$o /dev/mapper/cryptroot /mnt
mount --mkdir -o subvol=@home,$o      /dev/mapper/cryptroot /mnt/home
mount --mkdir -o subvol=@log,$o       /dev/mapper/cryptroot /mnt/var/log
mount --mkdir -o subvol=@pkg,$o       /dev/mapper/cryptroot /mnt/var/cache/pacman/pkg
mount --mkdir -o subvol=@snapshots,$o /dev/mapper/cryptroot /mnt/.snapshots
mount --mkdir /dev/nvme0n1p2 /mnt/boot
mount --mkdir /dev/nvme0n1p1 /mnt/boot/efi
```

## Base System

One pacstrap call carries everything the installed system cannot live
without once the live ISO is gone. `-K` initializes a fresh pacman keyring
in the target instead of copying the ISO's.

```bash
pacstrap -K /mnt \
  base linux linux-lts linux-firmware intel-ucode sof-firmware \
  btrfs-progs cryptsetup e2fsprogs dosfstools \
  grub efibootmgr \
  networkmanager \
  base-devel sudo vim git man-db man-pages openssh
```

| Packages | Reason |
| --- | --- |
| `base linux linux-firmware` | The core system |
| `linux-lts` | The fallback kernel from the decisions table |
| `intel-ucode` | Microcode for the i7-1165G7; GRUB picks it up automatically |
| `sof-firmware` | Tiger Lake audio runs Sound Open Firmware. Without this package the desktop works and the speakers stay silent |
| `btrfs-progs cryptsetup` | Root filesystem tools and the LUKS unlock inside the initramfs |
| `e2fsprogs dosfstools` | fsck for the ext4 `/boot` and the FAT32 ESP |
| `grub efibootmgr` | Bootloader, installed and configured in the chroot |
| `networkmanager` | Network after the reboot |
| `base-devel git` | `git` clones the workspace repository, `base-devel` builds its AUR set |
| `sudo vim man-db man-pages openssh` | `base` alone ships no editor, no sudo, and no man pages |

Generate fstab and read it before moving on. Everything about how the
system mounts at boot flows from this file, and this is the cheapest moment
to catch a mistake from the previous section.

```bash
genfstab -U /mnt >> /mnt/etc/fstab
cat /mnt/etc/fstab
```

Three things must hold. Root is `/dev/mapper/cryptroot` with `subvol=/@`;
the four other subvolume mounts are present and carry `compress=zstd` and
`noatime`; `/boot` (ext4) and `/boot/efi` (vfat) both appear.

## System Configuration

`arch-chroot /mnt` enters the new system. Identity and accounts first.

```bash
ln -sf /usr/share/zoneinfo/Asia/Baku /etc/localtime
hwclock --systohc
sed -i 's/^#en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen
locale-gen
echo 'LANG=en_US.UTF-8' > /etc/locale.conf
echo 'KEYMAP=us' > /etc/vconsole.conf

echo 'thinkbook' > /etc/hostname
cat >> /etc/hosts <<'EOF'
127.0.0.1   localhost
::1         localhost
127.0.1.1   thinkbook
EOF

passwd                          # root password
useradd -m -G wheel nafud
passwd nafud
EDITOR=vim visudo               # uncomment  %wheel ALL=(ALL:ALL) ALL
```

**Graphics.** Iris Xe needs mesa for OpenGL, `vulkan-intel` for Vulkan,
and `intel-media-driver` for VA-API hardware video decode, which is what
keeps video playback off the CPU and the battery alive. `xf86-video-intel`
is a deprecated Xorg driver and stays uninstalled; a Wayland compositor
talks to the kernel driver through mesa.

```bash
pacman -S mesa vulkan-intel intel-media-driver
```

**Initramfs.** The initramfs is what prompts for the LUKS passphrase at
boot, and it only learns how from the `encrypt` hook. Order matters twice
in the hook list. The keyboard hooks precede `encrypt` so the passphrase
prompt has a working keyboard, and `microcode` embeds the CPU microcode
into the image. `kms` brings `i915` up early for a proper console. Edit
`/etc/mkinitcpio.conf` to read

```text
HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block encrypt filesystems fsck)
```

and regenerate for both kernels.

```bash
mkinitcpio -P
```

**GRUB.** The kernel command line tells the initramfs which device to
unlock and what to call it. The UUID is the raw partition's
(`nvme0n1p3`), never the mapper device's, a classic mix-up.
`allow-discards` passes TRIM through the encryption layer.

```bash
blkid -s UUID -o value /dev/nvme0n1p3
```

Edit `/etc/default/grub` so the line reads

```text
GRUB_CMDLINE_LINUX="cryptdevice=UUID=<that-uuid>:cryptroot:allow-discards root=/dev/mapper/cryptroot"
```

then install and generate. The generated config picks up both kernels, so
the LTS fallback entry from the decisions table materializes here at no
extra cost.

```bash
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --recheck
grub-mkconfig -o /boot/grub/grub.cfg
```

**Services.**

```bash
systemctl enable NetworkManager
systemctl enable fstrim.timer            # weekly SSD TRIM
systemctl enable systemd-timesyncd
systemctl enable sshd                    # optional; post-install work over SSH
```

No display manager is enabled here. The workspace bootstrap installs and
configures greetd later, and a login prompt on the console is all the next
section needs.

## First Boot

Leave the chroot and tear down in order. The explicit `cryptsetup close` is
a cheap verification that nothing still holds the filesystem open; a
"device busy" here is worth understanding before the reboot rather than
after.

```bash
exit
umount -R /mnt
cryptsetup close cryptroot
reboot                          # remove the USB stick when the screen blanks
```

The SSH session dies with the reboot, and the LUKS passphrase is a
pre-boot prompt that only the physical keyboard can answer. The expected
sequence on screen, in order. The GRUB menu with entries for both `linux`
and `linux-lts`; the passphrase prompt from the initramfs; a console
login. Log in as the user, join the network with `nmtui`, and the rest of
the work can return to SSH (as the user; root logins are refused, and the
address may have changed).

```bash
ping -c3 archlinux.org
timedatectl                     # NTP synced
free -h                         # 24 GB visible
findmnt /                       # /dev/mapper/cryptroot, subvol=/@, compress=zstd
```

**If it does not boot.** A bare `grub>` prompt or a rescue shell means the
initramfs hooks or the `cryptdevice=` line went wrong. The fix is never a
reinstall. Boot the ISO again, unlock and remount everything as in Disk
Layout, `arch-chroot /mnt`, correct the mistake, regenerate
(`mkinitcpio -P`, `grub-mkconfig`), and reboot.

**Standby.** The firmware defaults to `s2idle` and also advertises `deep`
(S3). If standby drain ever becomes noticeable, append
`mem_sleep_default=deep` to `GRUB_CMDLINE_LINUX` and test; until then the
default stands.

## Snapshots

The payoff of the btrfs decision. The strategy is manual snapshots before
major upgrades only, an emergency revert point and nothing more. One
command creates it, and the `--cleanup-algorithm number` flag is
load-bearing; a manual snapshot created without one is invisible to the
cleanup timer and accumulates forever, while with it old snapshots age out
under `NUMBER_LIMIT`.

```bash
sudo snapper create --cleanup-algorithm number -d "pre upgrade"
```

The alternatives were considered and rejected. Per-transaction pairs
(snap-pac) and timeline and per-boot snapshots all bury the meaningful
pre-upgrade points in noise the policy does not want, and Timeshift on
Arch fights snapper's layout and needs AUR glue. The accepted tradeoff of
manual-only is that a routine upgrade that breaks something has no
automatic pre-point; the fallback there is the LTS kernel entry and chroot
repair.

```bash
sudo pacman -S snapper grub-btrfs inotify-tools
```

`grub-btrfs` turns snapshots into boot menu entries, and `inotify-tools`
lets its daemon watch for new ones.

**Config.** `snapper create-config` insists on creating its own
`.snapshots` as a subvolume nested inside `@`, which is exactly what the
layout avoids; nested there, a root rollback would revert the snapshots
too. Let it create the config, then swap its nested subvolume for the
top-level `@snapshots`.

```bash
sudo umount /.snapshots
sudo rm -r /.snapshots
sudo snapper -c root create-config /
sudo btrfs subvolume delete /.snapshots
sudo mkdir /.snapshots
sudo mount -a
sudo chmod 750 /.snapshots
sudo chown :wheel /.snapshots
```

In `/etc/snapper/configs/root`, four values.

```text
ALLOW_GROUPS="wheel"          # snapper list without sudo
TIMELINE_CREATE="no"          # manual pre-upgrade snapshots only
NUMBER_LIMIT="20"
NUMBER_LIMIT_IMPORTANT="10"
```

**Services and boot entries.** Snapper snapshots are read-only, and
booting one cleanly needs a tmpfs overlay on top, provided by the
`grub-btrfs-overlayfs` initramfs hook. Append it to the end of the HOOKS
line from System Configuration, regenerate, and refresh GRUB once; the
daemon keeps the snapshot submenu current from then on. A booted snapshot
is an inspection environment. Changes made inside it evaporate on reboot.

```bash
sudo systemctl enable --now snapper-cleanup.timer   # prunes per NUMBER_LIMIT
sudo systemctl enable --now grub-btrfsd             # watches /.snapshots

# append grub-btrfs-overlayfs to HOOKS in /etc/mkinitcpio.conf, then
sudo mkinitcpio -P
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

**Scrub.** Snapshots answer bad changes; scrubbing answers bad disks. A
monthly scrub reads everything and verifies btrfs checksums, surfacing
silent corruption instead of waiting for a read to stumble over it.

```bash
sudo systemctl enable --now btrfs-scrub@-.timer     # "-" escapes the path /
```

**Verify.** Create a test snapshot and `snapper list` should show it with
`number` in its Cleanup column; after a reboot the GRUB menu carries an
Arch Linux snapshots submenu. The test snapshot can be dropped with
`snapper delete` or left to age out.

```bash
sudo snapper create --cleanup-algorithm number -d "test snapshot"
snapper list                    # the snapshot, Cleanup column "number"
```

**Rollback.** Two tools for two failure sizes. A system that still boots
reverts in place with `sudo snapper undochange <N>..0`, which undoes
everything changed since snapshot N (0 names the current state). A system
that no longer works rolls back whole by swapping `@` out, from a booted
snapshot or the live ISO (unlock and mount the top level first, as in Disk
Layout).

```bash
sudo mount -o subvolid=5 /dev/mapper/cryptroot /mnt
sudo mv /mnt/@ /mnt/@.broken
sudo btrfs subvolume snapshot /mnt/@snapshots/<N>/snapshot /mnt/@
sudo umount /mnt
reboot
```

Kernels live outside btrfs, so after a full rollback
`sudo pacman -S linux linux-lts` resyncs `/boot` with the rolled-back
modules. Delete `@.broken` once the system proves out.

## Swap

zram is compressed swap in RAM, no partition and no swapfile. At 24 GB the
half-of-RAM device costs about 4 GB of memory when completely full (zstd
holds roughly 3 to 1 on swapped pages) while extending effective memory
well past physical.

```bash
sudo pacman -S zram-generator
```

`/etc/systemd/zram-generator.conf`

```text
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
```

zram inverts the usual swap cost model. Swapping to it is nearly free and
readahead is pointless, so the stock VM defaults point the wrong way.
`/etc/sysctl.d/99-vm-zram.conf` carries the documented values; swappiness
above 100 deliberately prefers moving cold anonymous pages to zram over
dropping file cache, and `page-cluster = 0` disables swap readahead.

```text
vm.swappiness = 180
vm.watermark_boost_factor = 0
vm.watermark_scale_factor = 125
vm.page-cluster = 0
```

The generator creates the device from the config on every boot; nothing to
enable.

```bash
sudo systemctl daemon-reload
sudo systemctl start systemd-zram-setup@zram0.service
sudo sysctl --system
zramctl                         # zram0, zstd, 12G
swapon --show                   # /dev/zram0 active
```

## Workspace

One command deploys the entire workspace.

```bash
curl -fsSL https://raw.githubusercontent.com/nafud/dotfiles/main/bootstrap.sh | bash
```

The bootstrap clones the repository into `~/dotfiles` over HTTPS (receiving
needs no SSH key; the push URL is set to SSH for when the backed-up key
returns) and hands off to `setup.sh`, which is idempotent end to end. One
run installs the packages (the niri stack, the terminal tools, PipeWire,
the browsers, the desktop apps, `tlp` and `thermald`), bootstraps paru for
the AUR set (Mullvad VPN, Chrome, Mullvad Browser, Spotify), installs and
enables greetd with tuigreet, enables the maintenance timers, links
`config/` into `~/.config` and `bin/` into `~/.local/bin`, writes the
shell block and system defaults, validates the niri config, and prints a
probed component summary.

A reboot lands in tuigreet; pick the `niri` session. The first-session
sweep, in order. The bar is up and notifications work (`notify-send
test`); the launcher (Mod+D), terminal (Mod+T), and lock (Mod+Shift+L)
answer; `pulsemixer` sees PipeWire sinks and Print takes a screenshot; the
bar's updates badge counts pending pacman and AUR updates; `mullvad
account login` brings the vpn module to life; `bash ~/dotfiles/setup.sh
summary` reports every row green.
