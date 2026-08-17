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
| `/boot` | Unencrypted ext4 | A single passphrase prompt and simple ISO recovery, traded against tamperable boot files |
| Kernels | `linux`, `linux-lts` | Snapshots do not cover `/boot`, so the LTS kernel answers a broken one |
| Swap | zram | Compressed swap in RAM, with no partition and no hibernation |
| Secure Boot | Off for the install | The ISO is unsigned, and re-enabling with custom keys is a post-install option |

## ISO and USB

Download the ISO with its detached signature and verify authenticity,
not integrity alone. A checksum from the same mirror as the ISO proves
only that the download is intact, since a compromised mirror serves
matching sums. The signature check instead retrieves the release
signing key over WKD from the archlinux.org domain, which no mirror can
substitute, and the verify must report a good signature from
`pierre@archlinux.org`.

```bash
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso.sig
gpg --auto-key-locate clear,wkd --locate-external-key pierre@archlinux.org
gpg --verify archlinux-x86_64.iso.sig
```

```bash
lsblk -d -o NAME,SIZE,MODEL
sudo dd if=archlinux-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

The ISO's bootloader carries no Secure Boot signature, so Secure Boot
must be disabled in firmware setup (commonly F1, F2, or Del at
power-on) before the stick will boot.
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
key derivation function, and they stand unchanged. Keeping `/boot`
outside the container is a deliberate trade-off. The bootloader never
handles the encryption, so boot stays fast with a single passphrase
prompt and recovery from the ISO stays simple, while the kernel and
initramfs sit unencrypted, open to tampering by anyone with physical
access to the disk. `open` maps the decrypted view of the partition to
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

pacstrap installs packages into the mounted target at `/mnt`, and it
downloads from the mirrors the live ISO ranked with reflector when the
network came up. `head /etc/pacman.d/mirrorlist` shows the result. A
stale or empty list is rewritten with
`reflector --latest 10 --protocol https --sort rate --save /etc/pacman.d/mirrorlist`
before pacstrap rather than after a failed one, since a bare
`reflector` only prints its ranking and writes nothing. One call
covers the kernel,
firmware, filesystem tools, bootloader, and the utilities the first
boot depends on. Type it as one continuous line.

```bash
head /etc/pacman.d/mirrorlist

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
selects its own subvolume through a `subvol=` option, `/@` for root,
with no `subvolid=` beside it, since the rollback in Snapshots
replaces `@` with a subvolume of a different id. Every btrfs line
carries `compress=zstd` and `noatime`. `/boot` appears as ext4 and
`/boot/efi` as vfat, each under its own UUID.

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
reported`. `grub-mkconfig` prints a Found line for each kernel and
lists `intel-ucode.img` beside each initramfs. That entry duplicates
the microcode the `microcode` hook already embedded and loads it
harmlessly twice. The run also warns that os-prober will not run, which
is correct on a single-OS disk, and ends with `done`.

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

Leave the chroot and tear down the mounts in order. The explicit
`cryptsetup close` verifies that nothing still holds the filesystem
open, and a device-busy error here is easier to investigate before the
reboot than after it.

```bash
exit
umount -R /mnt
cryptsetup close cryptroot
reboot                          # remove the USB stick when the screen blanks
```

The machine now boots in three stages. GRUB shows a menu with entries
for both `linux` and `linux-lts`, the initramfs prompts for the LUKS
passphrase, and a console login follows. Log in as the user and join
the network with `nmtui`. Any SSH session from the optional section
ended with the reboot, so reconnect as the user once the network is up,
since root logins are refused and the address may have changed.

Four checks confirm the installed system.

```bash
ping -c3 archlinux.org
timedatectl
free -h
findmnt /
```

`ping` proves the network. `timedatectl` must show NTP synchronized and
the chosen timezone. `free -h` must show the full RAM, and swap stays
at zero until the Swap section. `findmnt /` must show root mounted from
`/dev/mapper/cryptroot` with `subvol=/@` and `compress=zstd`, and its
`discard=async` option is `allow-discards` from the kernel command line
arriving at the filesystem.

### Header Backup

The LUKS header at the start of the partition holds the key material
that turns the passphrase into the disk. If it is damaged, the data is
unrecoverable with or without the passphrase, and no snapshot can help,
since snapshots live inside the container. Back the header up once and
store the file away from this disk.

```bash
sudo cryptsetup luksHeaderBackup /dev/nvme0n1p3 --header-backup-file luks-header.img
```

`luksHeaderRestore` writes it back should the header ever corrupt. A
restored header accepts the passphrases that existed when the backup
was made, so refresh the backup after any passphrase change.

### Recovery

A bare `grub>` prompt or a rescue shell in place of the login means the
initramfs hooks or the `cryptdevice=` line went wrong, and no reinstall
is needed. Boot the ISO again, unlock and remount everything as in Disk
Layout, enter the chroot, correct the mistake, rerun `mkinitcpio -P`
and `grub-mkconfig -o /boot/grub/grub.cfg`, and reboot.

### Standby

`cat /sys/power/mem_sleep` lists the suspend modes the firmware offers
and brackets the active one. `s2idle` is the usual default. When the
list also contains `deep`, appending `mem_sleep_default=deep` to
`GRUB_CMDLINE_LINUX` selects the deeper S3 state, a change worth making
only if standby drain becomes noticeable.

## Snapshots

Snapshots are the point of the btrfs layout, and the strategy is
automatic transaction-driven snapshots. Arch moves the whole system in
one transaction because partial upgrades are unsupported, so no line
separates minor updates from major ones, and whether an upgrade was
risky becomes clear only in hindsight. Bracketing every pacman
transaction instead makes the revert point exist by construction, and
the snapshot list stays a clean history of system changes. The scope
is the system alone, since `@home` sits outside every snapshot, and a
second snapper config for `/home` extends the same machinery to user
data if that is ever wanted. An ad-hoc point before a risky experiment
remains one command away with
`snapper create --description "before X"`.

```bash
sudo pacman -S snapper snap-pac grub-btrfs inotify-tools
```

`snap-pac` hooks pacman so every transaction receives a pre and post
snapshot pair with no configuration. The pairs carry the `number`
cleanup algorithm, which lets the cleanup timer below dispose of old
ones under `NUMBER_LIMIT`. `grub-btrfs` turns snapshots into boot menu
entries, and `inotify-tools` lets its daemon watch for new ones.

### Configuration

`snapper create-config` insists on creating `.snapshots` as a subvolume
nested inside `@`, which the layout deliberately avoids, since a root
rollback would revert nested snapshots along with it. Let it create the
config, then swap the nested subvolume for the top-level `@snapshots`.

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

Set four values in `/etc/snapper/configs/root`.

```text
ALLOW_GROUPS="wheel"          # snapper list without sudo
TIMELINE_CREATE="no"          # transaction-driven only
NUMBER_LIMIT="20"
NUMBER_LIMIT_IMPORTANT="10"
```

### Services and Boot Entries

Two units carry the section. `snapper-cleanup.timer` prunes snapshots
by the limits above, and `grub-btrfsd` watches `/.snapshots` for
changes.

Snapper snapshots are read-only, and booting one cleanly needs a tmpfs
overlay on top, which the `grub-btrfs-overlayfs` initramfs hook
provides. Append it to the end of the HOOKS line from System
Configuration, then regenerate the initramfs and the GRUB config. A
booted snapshot is an inspection environment, and changes made inside
it evaporate on reboot. The entry pairs the current kernel from
`/boot` with the snapshot's older modules, so inspection is dependable
only while the two match and degrades once a kernel upgrade separates
them. Recovery that must work goes through the LTS entry or the
rollback below.

```bash
sudo systemctl enable --now snapper-cleanup.timer
sudo systemctl enable --now grub-btrfsd

sudo mkinitcpio -P
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

The `grub-mkconfig` run now also prints `Detecting snapshots` and lists
what it found, which is grub-btrfs generating the submenu. The daemon
keeps that submenu current from then on.

### Scrub

Snapshots answer bad changes and scrubbing answers bad disks. A monthly
scrub reads every block and verifies btrfs checksums, surfacing silent
corruption instead of waiting for a read to stumble over it.

```bash
sudo systemctl enable --now btrfs-scrub@-.timer     # "-" escapes the path /
```

### Verification

Install any small package. The transaction announces the machinery with
`Performing snapper pre snapshots` before the install and
`post snapshots` after. `snapper list` then shows the pre and post pair
with cleanup `number` and the pacman command as its description, and
after a reboot the GRUB menu carries an Arch Linux snapshots submenu.

```bash
sudo pacman -S tree
snapper list
```

### Rollbacks

Two tools cover two failure sizes. A bad config change or one broken
package reverts in place with `sudo snapper undochange <pre>..<post>`.
A system that no longer works rolls back whole by swapping `@` out,
either from a booted snapshot or from the live ISO after unlocking and
mounting as in Disk Layout.

```bash
sudo mount -o subvolid=5 /dev/mapper/cryptroot /mnt
sudo mv /mnt/@ /mnt/@.broken
sudo btrfs subvolume snapshot /mnt/@snapshots/<N>/snapshot /mnt/@
sudo umount /mnt
reboot
```

Kernels live outside btrfs, so after a full rollback
`sudo pacman -S linux linux-lts` resyncs `/boot` with the rolled-back
modules. Delete `@.broken` once the rolled-back system is confirmed
working.

## Swap

zram is compressed swap in RAM, with no partition and no swapfile. A
device sized at half of RAM costs nothing at rest and about a sixth of
total memory when completely full, since zstd holds roughly a 3 to 1
ratio on swapped pages, while extending effective memory well past
physical.

```bash
sudo pacman -S zram-generator
```

Write the device definition to `/etc/systemd/zram-generator.conf`.

```text
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
```

zram inverts the usual swap cost model, since swapping to it is nearly
free and readahead is pointless, so the stock VM defaults pull in the
wrong direction. `/etc/sysctl.d/99-vm-zram.conf` carries the corrected
values. A swappiness above 100 prefers moving cold anonymous pages to
zram over dropping file cache, `page-cluster = 0` disables swap
readahead, `watermark_scale_factor = 125` starts background reclaim
earlier, and `watermark_boost_factor = 0` disables a reclaim boost that
only pays off on disk-backed swap.

The kernel also boots with zswap on, a compressed cache that sits in
front of every swap device and intercepts pages before they reach
zram, leaving the device idle and its statistics misleading. Turn it
off now through sysfs and permanently on the kernel command line. The
guarded `sed` changes nothing on a rerun, and the grep must show
`zswap.enabled=0` inside the quoted line.

```bash
echo 0 | sudo tee /sys/module/zswap/parameters/enabled
sudo sed -i '/zswap.enabled/! s|^GRUB_CMDLINE_LINUX="\(.*\)"|GRUB_CMDLINE_LINUX="\1 zswap.enabled=0"|' /etc/default/grub
grep ^GRUB_CMDLINE_LINUX /etc/default/grub
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

```text
vm.swappiness = 180
vm.watermark_boost_factor = 0
vm.watermark_scale_factor = 125
vm.page-cluster = 0
```

The generator creates the device from the config at every boot, so
there is no unit to enable. Start it once by hand and apply the sysctl
values.

```bash
sudo systemctl daemon-reload
sudo systemctl start systemd-zram-setup@zram0.service
sudo sysctl --system
zramctl
swapon --show
```

`zramctl` must show `zram0` with zstd compression, half of RAM in size,
and near-zero use. `swapon --show` must list `/dev/zram0` active at
priority 100, and `cat /sys/module/zswap/parameters/enabled` must
print `N`.

## Workspace

One command deploys the entire workspace.

```bash
curl -fsSL https://raw.githubusercontent.com/nafud/dotfiles/main/bootstrap.sh | bash
```

The bootstrap clones the repository into `~/dotfiles` over HTTPS, so
receiving needs no SSH key, and sets the push URL to SSH for
authenticated pushes later. It then hands off to `setup.sh`, which is
idempotent end to end. One run installs the full package set from the
official repositories, bootstraps paru and installs the AUR set,
installs and enables greetd with tuigreet, enables the maintenance
timers, links `config/` into `~/.config` and `bin/` into
`~/.local/bin`, writes the managed shell block and system defaults,
validates the niri config, and prints a probed component summary.

A reboot lands in tuigreet, where the `niri` session is picked.
Exercise the session once, the bar, notifications, launcher, terminal,
lock, audio, and screenshots, and `bash ~/dotfiles/setup.sh summary`
must report every row green.

## Secure Boot

Secure Boot stays off for the installation because the ISO is
unsigned, and it does not have to stay off. Two measures raise the bar
against boot-chain tampering, in increasing order of effort.

A firmware administrator password is the first and costs nothing to
maintain. It locks firmware setup and the boot menu, so boot order,
the Secure Boot state, and USB booting cannot be changed without it.
The command below reboots directly into firmware setup, where the
password is set. In the same visit, clear the factory Secure Boot
keys, which puts the firmware in Setup Mode and leaves Secure Boot
off, ready for custom keys.

```bash
systemctl reboot --firmware-setup
```

Re-enabling Secure Boot with custom keys is the second and runs
entirely on the installed system. `sbctl status` must report Setup
Mode before anything is enrolled. `create-keys` generates a personal
key set, and `enroll-keys -m` installs it into the firmware with
Microsoft's vendor keys alongside, since firmware capsules and GPU
option ROMs may be signed by them. GRUB itself needs a reinstall with
`--disable-shim-lock` before signing, because its Secure Boot path
otherwise expects the shim verification protocol that only a
distribution's signed bootloader provides, and it refuses to start
kernels without it. Enrollment writes to the firmware's key stores,
the one step whose failure modes are firmware-specific, so read the
sbctl documentation before starting. Sign the reinstalled binary,
then reboot into firmware once more and switch Secure Boot on.

```bash
sudo pacman -S sbctl
sbctl status
sudo sbctl create-keys
sudo sbctl enroll-keys -m
sudo grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --modules=tpm --disable-shim-lock --recheck
sudo sbctl sign -s /boot/efi/EFI/GRUB/grubx64.efi
systemctl reboot --firmware-setup
```

After the reboot, `sbctl status` must report Secure Boot enabled. The
firmware now verifies GRUB's signature before running it, which closes
the swapped-bootloader attack, while everything GRUB loads afterward,
the kernel and initramfs, stays outside the verified chain, the limit
of pairing Secure Boot with this bootloader. `-s` records the binary
in sbctl's database, and a pacman hook re-signs recorded files that an
update changes. A GRUB package update is the one manual case, repeat
the same grub-install run and follow it with `sudo sbctl sign-all`,
since grub-install outside pacman bypasses the hook.
