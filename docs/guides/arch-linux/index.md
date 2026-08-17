# Arch Linux

A manual Arch Linux installation. The result is a LUKS2-encrypted btrfs
system with automatic snapshots and the niri workspace from
[dotfiles](https://github.com/nafud/dotfiles){ .external-link } deployed
in one command.

## Objectives

| Topic | Choice | Rationale |
| --- | --- | --- |
| Filesystem | btrfs on LUKS2 | Subvolumes share one pool, and snapper makes upgrades reversible |
| Bootloader | GRUB | grub-btrfs generates boot entries for snapshots |
| `/boot` | Unencrypted ext4 | GRUB never unlocks LUKS, so the LUKS2 argon2id defaults stay |
| Kernels | `linux`, `linux-lts` | Snapshots do not cover `/boot`, so the LTS kernel answers a broken one |
| Swap | zram | Compressed swap in RAM, with no partition and no hibernation |
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

The Arch ISO is unsigned, so Secure Boot must be disabled in firmware
setup (commonly F1, F2, or Del at power-on) before the stick will boot.
Boot the target machine through its boot menu, commonly F12.

## Network

The installation requires a network connection. A wired connection with
DHCP works without configuration, and Wi-Fi authenticates through iwd.
If the wireless interface is not named `wlan0`, `device list` inside
iwctl prints the actual name.

```console
# iwctl
[iwd]# station wlan0 connect "SSID"
[iwd]# exit
# ping -c1 archlinux.org
```

## Remote Session (Optional)

The remaining steps can run over SSH from another machine. The live ISO
already runs sshd, but root has no password yet, and SSH rejects empty
passwords. Set one, read the machine's address, and connect from the
other side. Opening tmux after connecting keeps the installation alive
if the connection drops, and `tmux attach` resumes it.

```console
# passwd
# ip -br addr
```

```bash
ssh root@<ip>
tmux
```

## Disk Layout

!!! warning "Full wipe"
    Partitioning erases the entire disk, including the installed
    operating system.

Confirm UEFI mode and identify the target disk.

```bash
cat /sys/firmware/efi/fw_platform_size    # 64 on UEFI
lsblk -d -o NAME,SIZE,MODEL
```

UEFI boots from GPT disks, and the firmware locates the EFI system
partition by its partition type rather than by name or position.
`fdisk /dev/nvme0n1` builds the table from four commands.

| Command | Effect |
| --- | --- |
| `g` | New GPT disklabel |
| `n` | New partition. The number and first-sector prompts take their defaults, and the last-sector prompt takes the size, `+1G` for the first two partitions and the default for the third |
| `t` | Partition type. Partition `1` becomes type `1`, EFI System |
| `w` | Write the table and exit |

| Partition | Size | Type | Purpose |
| --- | --- | --- | --- |
| `nvme0n1p1` | 1G | EFI System | ESP, mounted at `/boot/efi`, read by the firmware |
| `nvme0n1p2` | 1G | Linux filesystem | `/boot`, ext4, read by GRUB |
| `nvme0n1p3` | rest of the disk | Linux filesystem | LUKS2 container |

One gigabyte on `/boot` is sized for two kernels, each with a regular
and a fallback initramfs image.

Format the two plain partitions, then create and open the encrypted
container. `luksFormat` asks for an uppercase `YES` as confirmation and
reads the passphrase twice without echo. This passphrase unlocks the
disk at every boot. The defaults give LUKS2 with argon2id, a memory-hard
key derivation function, and they need no adjustment here because
`/boot` sits outside the container and the bootloader never has to open
it. `open` maps the decrypted view of the partition to
`/dev/mapper/cryptroot`, the device that every following step operates
on.

```bash
mkfs.fat -F32 /dev/nvme0n1p1
mkfs.ext4 /dev/nvme0n1p2

cryptsetup luksFormat /dev/nvme0n1p3
cryptsetup open /dev/nvme0n1p3 cryptroot
```

A btrfs subvolume is an independently mountable file tree inside one
filesystem. Subvolumes share the pool's free space, need no fixed
sizes, and can be snapshotted on their own. This layout uses five of
them. `@` holds the root filesystem and `@home` keeps user data apart
from it, so a root rollback leaves `/home` untouched. `@log` and `@pkg`
exclude the system logs and the package cache from those snapshots,
which keeps a rollback from reverting the logs that explain a failure
or discarding downloaded packages. `@snapshots` stores the snapshots
themselves outside `@`, so replacing the root subvolume never destroys
its own history.

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

Mount the tree, each subvolume by name. `compress=zstd` enables
transparent compression, which typically saves 30 to 50 percent on
system files at negligible CPU cost, and `noatime` drops access-time
updates, which otherwise turn every read into a small metadata write.
`--mkdir` creates each mountpoint on the way.

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

`findmnt -R /mnt` shows the assembled tree, five btrfs subvolume mounts
plus `/boot` and `/boot/efi`.

## Base System

pacstrap installs packages into the mounted target at `/mnt`. One call
covers the kernel, firmware, filesystem tools, bootloader, and the
utilities the first boot depends on. Type it as one continuous line.

```bash
pacstrap -K /mnt base linux linux-lts linux-firmware intel-ucode sof-firmware btrfs-progs cryptsetup e2fsprogs dosfstools grub efibootmgr networkmanager base-devel sudo vim git man-db man-pages openssh
```

`-K` initializes a fresh pacman keyring inside the target. The run
pauses twice for provider prompts, once for `iptables` and once for the
initramfs generator, and a plain Enter accepts the correct default on
both. `Possibly missing firmware for module` warnings during initramfs
generation name drivers for hardware the machine does not have and can
be ignored.

| Packages | Reason |
| --- | --- |
| `base linux linux-firmware` | The core system |
| `linux-lts` | The fallback kernel |
| `intel-ucode` | CPU microcode, picked up by GRUB automatically (`amd-ucode` on AMD) |
| `sof-firmware` | Audio firmware for recent Intel laptops. Without it the system runs but the speakers stay silent |
| `btrfs-progs cryptsetup` | Root filesystem tools and the LUKS unlock inside the initramfs |
| `e2fsprogs dosfstools` | fsck for the ext4 `/boot` and the FAT32 ESP |
| `grub efibootmgr` | Bootloader, installed and configured in the chroot |
| `networkmanager` | Network after the reboot |
| `base-devel git` | `git` clones the workspace repository, `base-devel` builds its AUR set |
| `sudo vim man-db man-pages openssh` | `base` alone ships no editor, no sudo, and no man pages |

!!! note "If pacstrap fails at checking keys"
    A failure at `checking keys in keyring` with `Public keyring not
    found`, `keyring is not writable`, and `required key missing from
    keyring` means the live ISO never initialized its own keyring. The
    archiso does this in the `pacman-init` boot service, which is
    ordered after time synchronization. On a network that blocks NTP
    the synchronization never completes and the service stays queued.
    `systemctl status pacman-init` then reports `inactive (dead)` with
    a pending job, and `timedatectl` shows the clock as not
    synchronized. The fix performs the service's work by hand,
    refreshes the keys, and reruns pacstrap without `-K`, which copies
    the now-working host keyring into the target.

    ```bash
    systemctl cancel
    pacman-key --init
    pacman-key --populate
    pacman -Sy archlinux-keyring
    rm -rf /mnt/etc/pacman.d/gnupg
    pacstrap /mnt <the same package list>
    ```

    The failed run already downloaded every package into the target's
    cache on the `@pkg` subvolume, so the retry verifies from disk
    instead of downloading again. `/etc/pacman.d/gnupg` on the live ISO
    is a pre-mounted ramdisk, which can only be initialized in place,
    and this is why the fix removes the target's keyring rather than
    the host's.

Generate the fstab and inspect it before moving on. The installed
system assembles its mounts from this file at every boot, so an error
here surfaces later as a system that fails to come up.

```bash
genfstab -U /mnt >> /mnt/etc/fstab
cat /mnt/etc/fstab
```

Three properties must hold. All five btrfs entries share one UUID, the
UUID of the single filesystem inside the LUKS container, and each
selects its own subvolume through a `subvol=` option, `/@` for root.
Every btrfs line carries `compress=zstd` and `noatime`. `/boot` appears
as ext4 and `/boot/efi` as vfat, each under its own UUID.

## System Configuration

`arch-chroot /mnt` enters the new system, and every command from here
on runs inside it. The first block sets time, locale, identity, and
accounts. The `filesystem` package already ships the `localhost`
entries in `/etc/hosts`, so the machine's own line is the only
addition.

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

visudo opens the sudoers file behind a syntax check that a plain editor
skips, and the grant itself is one uncomment. Find the
`%wheel ALL=(ALL:ALL) ALL` line without `NOPASSWD`, remove its leading
`# `, and save. `groups <user>` must then list `wheel`, and
`grep '^%wheel' /etc/sudoers` must print the uncommented line.

### Graphics

On Intel graphics, mesa provides OpenGL, `vulkan-intel`
provides Vulkan, and `intel-media-driver` provides VA-API hardware
video decode, which moves video playback off the CPU. Another GPU
vendor swaps in its own Vulkan and VA-API packages while mesa stays.
`xf86-video-intel` is a deprecated Xorg driver and stays uninstalled,
since a Wayland compositor reaches the kernel driver through mesa.

```bash
pacman -S mesa vulkan-intel intel-media-driver
```

### Initramfs

The initramfs prompts for the LUKS passphrase at boot,
and the `encrypt` hook is what gives it that ability. Order matters in
the hook list. The keyboard hooks precede `encrypt` so the passphrase
prompt has a working keyboard, `microcode` embeds the CPU microcode
into the image, and `kms` brings the GPU driver up early for a
native-resolution console. Edit `/etc/mkinitcpio.conf` and replace the
whole existing `HOOKS=` line with

```text
HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block encrypt filesystems fsck)
```

and regenerate for both kernels.

```bash
mkinitcpio -P
```

In each build's hook list, `[encrypt]` must appear between `[block]`
and `[filesystems]`. Two warnings are expected. `consolefont` reports
that no font is configured because `/etc/vconsole.conf` sets only the
keymap, and the missing-firmware warnings repeat what pacstrap already
showed.

### GRUB

The kernel command line tells the initramfs which device to
unlock and what to name the mapping. The UUID belongs to the raw
partition, never to the mapper device it opens into, and
`allow-discards` passes TRIM through the encryption layer. A
36-character UUID invites transcription errors, so capture it in a
variable and let `sed` write the line. The anchored pattern replaces
only `GRUB_CMDLINE_LINUX` and leaves `GRUB_CMDLINE_LINUX_DEFAULT`
untouched.

```bash
UUID=$(blkid -s UUID -o value /dev/nvme0n1p3)
echo $UUID                      # stop if this prints nothing
sed -i "s|^GRUB_CMDLINE_LINUX=.*|GRUB_CMDLINE_LINUX=\"cryptdevice=UUID=$UUID:cryptroot:allow-discards root=/dev/mapper/cryptroot\"|" /etc/default/grub
grep ^GRUB_CMDLINE_LINUX /etc/default/grub
```

The grep must print the full line with the real UUID embedded. Install
GRUB and generate its config. The config generator picks up both
kernels, so the LTS fallback entry appears without further work.

```bash
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --recheck
grub-mkconfig -o /boot/grub/grub.cfg
```

`grub-install` must end with `Installation finished. No error
reported`. `grub-mkconfig` prints a Found line for each kernel,
prepends `intel-ucode.img` to every initrd so the microcode loads
first, warns that os-prober will not run, which is correct on a
single-OS disk, and ends with `done`.

### Services

Enable the units the first boot relies on. NetworkManager
brings the network up, `fstrim.timer` runs a weekly TRIM pass over the
SSD, `systemd-timesyncd` keeps the clock synchronized, and `sshd` is
optional for working over SSH after the reboot.

```bash
systemctl enable NetworkManager
systemctl enable fstrim.timer
systemctl enable systemd-timesyncd
systemctl enable sshd
```

No display manager is enabled here. The workspace bootstrap installs
and configures greetd later, and the next section only needs a login
prompt on the console.

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

The LUKS passphrase is a pre-boot prompt, answered at the console. The
expected sequence, in order. The GRUB menu with entries for both `linux`
and `linux-lts`; the passphrase prompt from the initramfs; a console
login. Log in as the user and join the network with `nmtui`. An SSH
session from the optional section ended with the reboot; reconnect as the
user once the network is up (root logins are refused, and the address may
have changed).

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
