# Arch Linux

A manual Arch Linux installation. The result is a LUKS2-encrypted btrfs
system with automatic snapshots and the niri workspace from
[dotfiles](https://github.com/nafud/dotfiles){ .external-link } deployed
in one command.

## Objectives

| Topic | Choice | Rationale |
| --- | --- | --- |
| Filesystem | btrfs on LUKS2 | Subvolumes share one pool; snapper makes upgrades reversible |
| Bootloader | GRUB | grub-btrfs generates boot entries for snapshots |
| `/boot` | Unencrypted ext4 | GRUB never unlocks LUKS; the LUKS2 argon2id defaults stay |
| Kernels | `linux`, `linux-lts` | Snapshots do not cover `/boot`; LTS answers a broken kernel |
| Swap | zram | Compressed swap in RAM; no partition, no hibernation |
| Secure Boot | Off | The Arch ISO is unsigned |

## ISO and USB

```bash
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/sha256sums.txt
sha256sum -c --ignore-missing sha256sums.txt
```

```bash
lsblk -d -o NAME,SIZE,MODEL
sudo dd if=archlinux-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

Secure Boot must be disabled first (firmware setup, commonly F1, F2, or
Del at power-on); the Arch ISO is unsigned and the firmware refuses it
otherwise. Then boot the target machine through its boot menu (commonly
F12).

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

Ethernet needs none of the iwctl part, and `device list` inside iwctl
names the interface when it is not `wlan0`. From the second machine,
connect and open a multiplexer immediately; a Wi-Fi hiccup then suspends
the SSH session without killing a package transaction mid-write, and
`tmux attach` resumes it.

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
partition's type to `1` (EFI System), and `w` writes it out. `n` asks
three questions per partition, and the rhythm matters. Partition number
and first sector both take their defaults with a plain Enter; only the
last-sector answer carries a size (`+1G`), and a size typed at the
first-sector prompt bounces with "Value out of range". When a partition
lands where the outgoing OS kept a filesystem, fdisk offers to remove the
old signature; answer `Y`, it is the previous system's metadata.

| Partition | Size | Type | Purpose |
| --- | --- | --- | --- |
| `nvme0n1p1` | 1G | EFI System | ESP, mounted at `/boot/efi` |
| `nvme0n1p2` | 1G | Linux | `/boot`, unencrypted ext4 |
| `nvme0n1p3` | rest of the disk | Linux | LUKS2 container |

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
30 to 50 percent saving on system files at negligible CPU cost on modern
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
without once the live ISO is gone. Type it as one continuous line; a
package list split across shell continuation lines is easy to lose, and
pacstrap invoked with no packages silently installs bare `base` alone.

```bash
pacstrap -K /mnt base linux linux-lts linux-firmware intel-ucode sof-firmware btrfs-progs cryptsetup e2fsprogs dosfstools grub efibootmgr networkmanager base-devel sudo vim git man-db man-pages openssh
```

`-K` initializes a fresh pacman keyring in the target. Two provider
prompts appear mid-run (`iptables` and the initramfs generator); a plain
Enter takes the correct default on both, `iptables` and `mkinitcpio`.
Near the end, "Possibly missing firmware for module" warnings during
initramfs generation name hardware the machine does not have and are
expected noise.

| Packages | Reason |
| --- | --- |
| `base linux linux-firmware` | The core system |
| `linux-lts` | The fallback kernel from the decisions table |
| `intel-ucode` | CPU microcode, picked up by GRUB automatically (`amd-ucode` on AMD) |
| `sof-firmware` | Audio firmware for recent Intel laptops (Sound Open Firmware). Without it the desktop works and the speakers stay silent |
| `btrfs-progs cryptsetup` | Root filesystem tools and the LUKS unlock inside the initramfs |
| `e2fsprogs dosfstools` | fsck for the ext4 `/boot` and the FAT32 ESP |
| `grub efibootmgr` | Bootloader, installed and configured in the chroot |
| `networkmanager` | Network after the reboot |
| `base-devel git` | `git` clones the workspace repository, `base-devel` builds its AUR set |
| `sudo vim man-db man-pages openssh` | `base` alone ships no editor, no sudo, and no man pages |

??? note "If pacstrap fails at checking keys"
    A failure at "(N/N) checking keys in keyring" with `Public keyring
    not found`, a wall of `keyring is not writable`, and `required key
    missing from keyring` means the live ISO's own keyring was never
    initialized. The archiso initializes it in a boot service
    (`pacman-init`) ordered after time synchronization; on a network
    that blocks NTP the sync never completes and the service sits
    queued forever (`systemctl status pacman-init` shows `inactive
    (dead)` with a pending `Job:`, and `timedatectl` shows
    `System clock synchronized: no` under an otherwise correct clock).
    Do the service's work by hand, refresh the keys, and rerun without
    `-K`, so the now-working host keyring is copied into the target.

    ```bash
    systemctl cancel
    pacman-key --init
    pacman-key --populate
    pacman -Sy archlinux-keyring
    rm -rf /mnt/etc/pacman.d/gnupg
    pacstrap /mnt <the same package list>
    ```

    The failed run already downloaded every package into the target's
    own cache (the `@pkg` subvolume), so the retry re-verifies from
    disk and is fast. `/etc/pacman.d/gnupg` on the live ISO is a
    pre-mounted ramdisk; it cannot be removed, only initialized in
    place, which is why the fix never `rm`s it.

Generate fstab and read it before moving on. Everything about how the
system mounts at boot flows from this file, and this is the cheapest moment
to catch a mistake from the previous section.

```bash
genfstab -U /mnt >> /mnt/etc/fstab
cat /mnt/etc/fstab
```

Three things must hold. Root is the btrfs filesystem's UUID with
`subvol=/@` (all five btrfs entries share that one UUID, one filesystem
seen through five subvolumes, resolved through the unlocked mapper at
boot); the four other subvolume mounts are present and carry
`compress=zstd` and `noatime`; `/boot` (ext4) and `/boot/efi` (vfat) both
appear.

## System Configuration

`arch-chroot /mnt` enters the new system (the prompt changes). Identity
and accounts first. The `filesystem` package already ships the
`localhost` entries in `/etc/hosts`, so only the machine's own line is
appended.

```bash
ln -sf /usr/share/zoneinfo/<Region/City> /etc/localtime
hwclock --systohc
sed -i 's/^#en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen
locale-gen
echo 'LANG=en_US.UTF-8' > /etc/locale.conf
echo 'KEYMAP=us' > /etc/vconsole.conf

echo '<hostname>' > /etc/hostname
echo '127.0.1.1 <hostname>' >> /etc/hosts

passwd                          # root password
useradd -m -G wheel <user>
passwd <user>
EDITOR=vim visudo
```

In visudo, the sudo grant is one uncomment. Find the
`%wheel ALL=(ALL:ALL) ALL` line without `NOPASSWD` (`/wheel` searches)
and delete its leading `# `, then save. Verify the round with
`groups <user>` (must list `wheel`) and
`grep '^%wheel' /etc/sudoers` (must print the uncommented line).

**Graphics.** For Intel graphics, mesa carries OpenGL, `vulkan-intel`
Vulkan, and `intel-media-driver` VA-API hardware video decode, which is
what keeps video playback off the CPU and the battery alive (another GPU
vendor swaps in its own Vulkan and VA-API packages; mesa stays).
`xf86-video-intel` is a deprecated Xorg driver and stays uninstalled; a
Wayland compositor talks to the kernel driver through mesa.

```bash
pacman -S mesa vulkan-intel intel-media-driver
```

**Initramfs.** The initramfs is what prompts for the LUKS passphrase at
boot, and it only learns how from the `encrypt` hook. Order matters twice
in the hook list. The keyboard hooks precede `encrypt` so the passphrase
prompt has a working keyboard, and `microcode` embeds the CPU microcode
into the image. `kms` brings the GPU driver up early for a proper
console. Edit `/etc/mkinitcpio.conf`, replacing the whole existing
`HOOKS=` line with

```text
HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block encrypt filesystems fsck)
```

and regenerate for both kernels.

```bash
mkinitcpio -P
```

In each build's hook scroll, `[encrypt]` must appear between `[block]`
and `[filesystems]`. A `consolefont: no font found in configuration`
warning is expected (`/etc/vconsole.conf` sets only the keymap; the
kernel's default font stands), as is the missing-firmware noise from
pacstrap.

**GRUB.** The kernel command line tells the initramfs which device to
unlock and what to call it. The UUID is the raw partition's
(`nvme0n1p3`), never the mapper device's, a classic mix-up.
`allow-discards` passes TRIM through the encryption layer. A 36-character
UUID invites transcription errors, so capture it in a variable and let
`sed` write the line; the anchored pattern replaces only
`GRUB_CMDLINE_LINUX` and leaves `GRUB_CMDLINE_LINUX_DEFAULT` alone.

```bash
UUID=$(blkid -s UUID -o value /dev/nvme0n1p3)
echo $UUID                      # must print the UUID; stop if empty
sed -i "s|^GRUB_CMDLINE_LINUX=.*|GRUB_CMDLINE_LINUX=\"cryptdevice=UUID=$UUID:cryptroot:allow-discards root=/dev/mapper/cryptroot\"|" /etc/default/grub
grep ^GRUB_CMDLINE_LINUX /etc/default/grub
```

The grep must show the full line with the real UUID embedded. Then
install and generate. The generated config picks up both kernels, so the
LTS fallback entry from the decisions table materializes here at no extra
cost.

```bash
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --recheck
grub-mkconfig -o /boot/grub/grub.cfg
```

`grub-install` must end "Installation finished. No error reported."
`grub-mkconfig` prints a Found line for each kernel with `intel-ucode.img`
prepended to every initrd (the microcode loading), warns that os-prober
will not run (correct, there is no other OS), and ends "done".

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
timedatectl                     # NTP synced, chosen timezone applied
free -h                         # full RAM visible; swap 0B until the Swap section
findmnt /                       # /dev/mapper/cryptroot, subvol=/@, compress=zstd
```

`findmnt` also shows `discard=async`; that is `allow-discards` from the
kernel command line arriving at the filesystem.

**If it does not boot.** A bare `grub>` prompt or a rescue shell means the
initramfs hooks or the `cryptdevice=` line went wrong. The fix is never a
reinstall. Boot the ISO again, unlock and remount everything as in Disk
Layout, `arch-chroot /mnt`, correct the mistake, regenerate
(`mkinitcpio -P`, `grub-mkconfig`), and reboot.

**Standby.** `cat /sys/power/mem_sleep` shows the firmware's suspend
modes, the bracketed one active. Where `deep` (S3) is offered alongside a
default `s2idle` and standby drain ever becomes noticeable, appending
`mem_sleep_default=deep` to `GRUB_CMDLINE_LINUX` is the test; until then
the default stands.

## Snapshots

The payoff of the btrfs decision. The strategy is automatic
transaction-driven snapshots. An Arch upgrade moves the whole system in
one transaction (partial upgrades are unsupported), so no line separates
minor updates from major ones, and whether an upgrade was risky is only
known in hindsight; bracketing every pacman transaction instead makes the
revert point exist by construction, and the snapshot list stays a clean
history of system changes. Timeline and per-boot snapshots were considered
and rejected as noise that buries the meaningful pre-update points, and
Timeshift was rejected because on Arch it fights snapper's layout and
needs AUR glue. Ad-hoc points before risky experiments remain one command
away (`snapper create --description "before X"`).

```bash
sudo pacman -S snapper snap-pac grub-btrfs inotify-tools
```

`snap-pac` hooks pacman so every transaction gets a pre/post snapshot pair
with zero configuration, and its pairs carry the `number` cleanup
algorithm, so the cleanup timer below disposes of old ones automatically
under `NUMBER_LIMIT`. `grub-btrfs` turns snapshots into boot menu entries,
and `inotify-tools` lets its daemon watch for new ones.

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
TIMELINE_CREATE="no"          # transaction-driven only
NUMBER_LIMIT="20"
NUMBER_LIMIT_IMPORTANT="10"
```

**Services and boot entries.** The snapper package ships
`snapper-timeline.timer` enabled; under the transaction-only policy it is
disabled outright, and any timeline snapshot it fired off before the
config edit (`snapper list` shows it with cleanup `timeline`) is deleted
by number. Snapper snapshots are read-only, and booting one cleanly needs
a tmpfs overlay on top, provided by the `grub-btrfs-overlayfs` initramfs
hook. Append it to the end of the HOOKS line from System Configuration,
regenerate, and refresh GRUB once; the daemon keeps the snapshot submenu
current from then on. A booted snapshot is an inspection environment.
Changes made inside it evaporate on reboot.

```bash
sudo systemctl disable --now snapper-timeline.timer
sudo systemctl enable --now snapper-cleanup.timer   # prunes per NUMBER_LIMIT
sudo systemctl enable --now grub-btrfsd             # watches /.snapshots

# append grub-btrfs-overlayfs to the end of HOOKS in /etc/mkinitcpio.conf, then
sudo mkinitcpio -P
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

The `grub-mkconfig` run now also prints "Detecting snapshots" and lists
what it found; that is grub-btrfs generating the submenu.

**Scrub.** Snapshots answer bad changes; scrubbing answers bad disks. A
monthly scrub reads everything and verifies btrfs checksums, surfacing
silent corruption instead of waiting for a read to stumble over it.

```bash
sudo systemctl enable --now btrfs-scrub@-.timer     # "-" escapes the path /
```

**Verify.** Install any small package. The transaction itself announces
the machinery ("Performing snapper pre snapshots" before the install,
"post snapshots" after), and `snapper list` then shows the pre/post pair
with cleanup `number` and the pacman command as its description; after a
reboot the GRUB menu carries an Arch Linux snapshots submenu.

```bash
sudo pacman -S tree
snapper list                    # a pre/post pair for the transaction
```

**Rollback.** Two tools for two failure sizes. A bad config change or one
broken package reverts in place with
`sudo snapper undochange <pre>..<post>`. A system that no longer works
rolls back whole by swapping `@` out, from a booted snapshot or the live
ISO (unlock and mount the top level first, as in Disk Layout).

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

zram is compressed swap in RAM, no partition and no swapfile. The
half-of-RAM device costs about a sixth of total memory when completely
full (zstd holds roughly 3 to 1 on swapped pages) and nothing at rest,
while extending effective memory well past physical.

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
zramctl                         # zram0, zstd, half of RAM, near-zero used
swapon --show                   # /dev/zram0 active, priority 100
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
