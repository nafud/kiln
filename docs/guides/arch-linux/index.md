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
| Kernels | `linux`, `linux-lts` | The LTS kernel serves as recovery for a broken mainline kernel, and GRUB boots the mainline by default. Snapshots do not cover `/boot`, and the workspace closes that gap with pacman hooks that keep the outgoing kernel beside the current one |
| Swap | zram | Compressed swap in RAM, with no partition and no hibernation. The workspace adds systemd-oomd, which stops a runaway process before the session stalls |
| Secure Boot | Off for the install | The ISO is unsigned, and re-enabling with custom keys is a post-install option |

## ISO and USB

Download the ISO with its detached signature and verify authenticity,
not integrity alone. A checksum from the same mirror as the ISO proves
only that the download is intact, since a compromised mirror serves
matching sums. The signature check instead retrieves the release
signing key over WKD from the archlinux.org domain, which no mirror can
substitute, and the verify must report a good signature from
`pierre@archlinux.org`. Two warnings accompany a good signature, the
key shows as `[unknown]` and not certified, which is expected since
WKD established the trust rather than a local signature. The key's
fingerprint can be cross-checked against the one printed on the
archlinux.org download page.

```bash
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso
curl -LO https://geo.mirror.pkgbuild.com/iso/latest/archlinux-x86_64.iso.sig
gpg --auto-key-locate clear,wkd --locate-external-key pierre@archlinux.org
gpg --verify archlinux-x86_64.iso.sig
```

```bash
lsblk
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
iwctl prints the actual name. `get-networks` lists the SSIDs in range,
and `connect` tab-completes them.

```console
# iwctl
[iwd]# station wlan0 scan
[iwd]# station wlan0 get-networks
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
lsblk
```

UEFI boots from GPT disks, and the firmware locates the EFI system
partition by its partition type rather than by name or position.
`fdisk /dev/nvme0n1` builds the table from four commands.

| Command | Effect |
| --- | --- |
| `g` | New GPT disklabel |
| `n` | New partition. The number and first-sector prompts take their defaults, and the last-sector prompt takes the size, `+1G` for the first two partitions and the default for the third |
| `t` | Partition type. Partition `1` becomes type `1`, EFI System |
| `p` | Print the pending table, a free check before committing |
| `w` | Write the table and exit |

On a disk that held a previous system, the `n` prompts end by offering
to remove an old filesystem signature. Answering `Y` clears metadata
the formats below would overwrite anyway.

| Partition | Size | Type | Purpose |
| --- | --- | --- | --- |
| `nvme0n1p1` | 1G | EFI System | ESP, mounted at `/boot/efi`, read by the firmware |
| `nvme0n1p2` | 1G | Linux filesystem | `/boot`, ext4, read by GRUB |
| `nvme0n1p3` | rest of the disk | Linux filesystem | LUKS2 container |

One gigabyte on `/boot` is generous for two kernels. Current
mkinitcpio builds a single initramfs image per kernel, its fallback
preset shipped commented out, so the space also covers enabling that
preset later.

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
`reflector` only prints its ranking and writes nothing. `timedatectl`
joins the pre-flight because a clock that reports unsynchronized on an
NTP-blocking network predicts the keyring failure the note below walks
through. One call covers the kernel, firmware, filesystem tools,
bootloader, and the utilities the first boot depends on. Type it as
one continuous line.

```bash
head /etc/pacman.d/mirrorlist
timedatectl

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
| `base-devel git` | `git` clones the workspace repository, `base-devel` builds paru, the AUR helper the workspace bootstraps |
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
on runs inside it. The prompt marks the boundary, `root@archiso ~ #`
on the live ISO gives way to `[root@archiso /]#` inside the chroot,
and identity work done on the wrong side of it evaporates at reboot.
The first block sets time, locale, identity, and accounts. The
timezone placeholder is an IANA `Region/City` name as listed under
`/usr/share/zoneinfo`, not a country name, and `ln -sf` succeeds even
against a target that does not exist, so the `ls` check must resolve
to a real file. The `filesystem` package already ships the `localhost`
entries in `/etc/hosts`, so the machine's own line is the only
addition.

```bash
ln -sf /usr/share/zoneinfo/<Region/City> /etc/localtime
ls -l /etc/localtime
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

echo '%wheel ALL=(ALL:ALL) ALL' > /etc/sudoers.d/wheel
chmod 440 /etc/sudoers.d/wheel
visudo -c
```

The sudo grant is a drop-in under `/etc/sudoers.d`, which sudo reads
alongside the stock file, so the stock file stays pristine and no
editor session is needed. `visudo -c` parses both files and must
report each OK, and `groups <user>` must list `wheel`.

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
native-resolution console. An anchored `sed` replaces the whole
existing `HOOKS=` line, the same pattern the GRUB section uses, the
grep must print the new list, and `mkinitcpio -P` regenerates the
image for both kernels.

```bash
sed -i 's/^HOOKS=.*/HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block encrypt filesystems fsck)/' /etc/mkinitcpio.conf
grep ^HOOKS /etc/mkinitcpio.conf
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
kernels, so the LTS fallback entry appears without further work, but
its version sort can list the LTS kernel first, which would silently
make the fallback the default boot. `GRUB_TOP_LEVEL` pins the mainline
image to the top entry and keeps the roles from the Objectives table.

```bash
echo 'GRUB_TOP_LEVEL="/boot/vmlinuz-linux"' >> /etc/default/grub

grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB --recheck
grub-mkconfig -o /boot/grub/grub.cfg
```

`grub-install` must end with `Installation finished. No error
reported`. In the `grub-mkconfig` output, the first `Found linux
image` line must name `vmlinuz-linux`, proof the pin took. The run
prints a Found line for each kernel and
lists `intel-ucode.img` beside each initramfs. That entry duplicates
the microcode the `microcode` hook already embedded and loads it
harmlessly twice. The run also warns that os-prober will not run, which
is correct on a single-OS disk, and ends with `done`.

### Services

Enable the units the first boot relies on. NetworkManager
brings the network up, `fstrim.timer` runs a weekly TRIM pass over the
SSD, `systemd-timesyncd` keeps the clock synchronized, and `sshd` is
optional for working over SSH after the reboot. The unit serves the
installation and nothing after it, and the first step of System
Hardening turns it off.

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
passphrase, and a console login follows. Wait for the passphrase
prompt before typing. Keystrokes ahead of it are echoed to the console
and lost from the passphrase, which then fails exactly like a wrong
password, and the pause of several seconds after Enter is argon2id at
work, not a hang. A passphrase that was set over SSH obeyed that
keyboard's layout, so symbol characters can land differently on the
console's `us` keymap.

Log in as the user and join the network with `nmtui`. Any SSH session
from the optional section ended with the reboot. The installed system
presents a new host key behind the same address, so the reconnect
fails with `REMOTE HOST IDENTIFICATION HAS CHANGED` until
`ssh-keygen -R <ip>` clears the live ISO's entry, and it must be made
as the user, since the installed sshd refuses password logins for
root.

Five checks confirm the installed system.

```bash
ping -c3 archlinux.org
uname -r
timedatectl
free -h
findmnt /
```

`ping` proves the network. `uname -r` must report the mainline kernel
version, proof the GRUB default held across the reboot. `timedatectl`
must show the chosen timezone and NTP synchronized, though a network
that blocks NTP leaves the flag at no through no fault of the install,
with the clock still correct from the hardware clock. `free -h` must
show the full RAM, and swap stays
at zero until the Swap section. `findmnt /` must show root mounted from
`/dev/mapper/cryptroot` with `subvol=/@` and `compress=zstd`, and its
`discard=async` option is `allow-discards` from the kernel command line
arriving at the filesystem.

### Header Backup (Optional)

The LUKS header at the start of the partition holds the key material
that turns the passphrase into the disk. If it is damaged, the data is
unrecoverable with or without the passphrase, and no snapshot can help,
since snapshots live inside the container. When everything on the disk
can be rebuilt from this guide and the dotfiles, a lost header costs a
reinstall and the step can be skipped. Anything irreplaceable makes it
thirty seconds of insurance. Back the header up once, move the file
off this disk, and delete the local copy, since a backup stored on the
disk it describes protects nothing.

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

Four values complete the config. `ALLOW_GROUPS` lets wheel members run
snapper without sudo, `TIMELINE_CREATE` keeps the policy
transaction-driven only, and the two limits bound how many snapshot
pairs the cleanup timer keeps. Ten pairs reach back through a week or
two of ordinary upgrades, and a rollback rarely wants an older state
than that. The config itself is readable by root
alone, so the verifying grep carries sudo.

```bash
sudo sed -i 's/^ALLOW_GROUPS=.*/ALLOW_GROUPS="wheel"/; s/^TIMELINE_CREATE=.*/TIMELINE_CREATE="no"/; s/^NUMBER_LIMIT=.*/NUMBER_LIMIT="10"/; s/^NUMBER_LIMIT_IMPORTANT=.*/NUMBER_LIMIT_IMPORTANT="10"/' /etc/snapper/configs/root
sudo grep -E '^(ALLOW_GROUPS|TIMELINE_CREATE|NUMBER_LIMIT|NUMBER_LIMIT_IMPORTANT)=' /etc/snapper/configs/root
```

### Services and Boot Entries

Two units carry the section. `snapper-cleanup.timer` prunes snapshots
by the limits above, and `grub-btrfsd` watches `/.snapshots` for
changes.

Snapper snapshots are read-only, and booting one cleanly needs a tmpfs
overlay on top, which the `grub-btrfs-overlayfs` initramfs hook
provides. The guarded `sed` appends it to the HOOKS line from System
Configuration once, the grep must print the list with
`grub-btrfs-overlayfs` last, and the initramfs and GRUB config are
regenerated with the hook in place. A
booted snapshot is an inspection environment, and changes made inside
it evaporate on reboot. The kernels live on `/boot`, outside the
snapshot, so each entry pairs a snapshot's modules with a kernel from
the live `/boot`. Once a kernel upgrade has replaced that kernel, a
snapshot from before the upgrade holds modules for a kernel `/boot`
no longer carries, and its entry fails to boot. The workspace closes
this gap with pacman hooks that keep the outgoing kernel and its
initramfs on `/boot` under version-suffixed names, which GRUB and
grub-btrfs both pair without configuration, and every snapshot's
submenu then lists the kernel its modules belong to beside the current
ones. The same hooks mirror `/boot` into `/.bootbackup` on `@` ahead of
every snapshot, which the rollback below uses. Until the workspace is
deployed, a booted snapshot is dependable only while kernel and
modules match, and recovery that must work goes through the LTS entry
or the rollback.

```bash
sudo systemctl enable --now snapper-cleanup.timer
sudo systemctl enable --now grub-btrfsd

sudo sed -i '/grub-btrfs-overlayfs/! s/^HOOKS=(\(.*\))/HOOKS=(\1 grub-btrfs-overlayfs)/' /etc/mkinitcpio.conf
grep ^HOOKS /etc/mkinitcpio.conf
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

Kernels live outside btrfs, so `/boot` still holds the images of the
system that was replaced, and the rolled-back `@` carries modules for
older ones. The first boot after the swap picks the entry whose kernel
version matches, one of the kept pairs the workspace hooks left on
`/boot`, or the LTS entry when that kernel was not part of the upgrade.
From there, two routes bring `/boot` back in step. The snapshot carries
`/.bootbackup`, the mirror of `/boot` taken before its transaction, so
for a pre snapshot copying it back restores the matching kernels
together with the GRUB configuration.

```bash
sudo cp -a /.bootbackup/. /boot/
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

The mirror predates the transaction, so a post snapshot pairs with it
no better than with the live `/boot`, and there the second route
applies. `sudo pacman -S linux linux-lts` reinstalls both kernels from
the rolled-back package database, which writes images matching the
modules and regenerates the menu through the usual hooks. The route
also serves a system without the workspace. Delete `@.broken` once the
rolled-back system is confirmed working.

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

```bash
printf '[zram0]\nzram-size = ram / 2\ncompression-algorithm = zstd\n' | sudo tee /etc/systemd/zram-generator.conf
```

zram inverts the usual swap cost model, since swapping to it is nearly
free and readahead is pointless, so the stock VM defaults pull in the
wrong direction. `/etc/sysctl.d/99-vm-zram.conf` carries the corrected
values. A swappiness above 100 prefers moving cold anonymous pages to
zram over dropping file cache, `page-cluster = 0` disables swap
readahead, `watermark_scale_factor = 125` starts background reclaim
earlier, and `watermark_boost_factor = 0` disables a reclaim boost that
only pays off on disk-backed swap.

```bash
printf 'vm.swappiness = 180\nvm.watermark_boost_factor = 0\nvm.watermark_scale_factor = 125\nvm.page-cluster = 0\n' | sudo tee /etc/sysctl.d/99-vm-zram.conf
```

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

zram also changes how running out of memory feels. Because the swap
device is memory itself, a process that keeps growing rarely reaches
the kernel's out-of-memory killer, and the system stalls instead, every
page fault turning into a decompression while the desktop stays frozen
for minutes. The workspace answers this with systemd-oomd on
`user.slice`, which watches memory pressure rather than free memory.
Once the session's processes have spent more than half of a
twenty-second window stalled on memory, it kills the descendant control
group with the most reclaim activity, which under niri is one
application in its own scope, and the compositor, bar, and audio
server under `system.slice` are never candidates. The drop-ins arrive
with the Workspace section, and nothing here needs configuring.

## Workspace

One command deploys the entire workspace.

```bash
curl -fsSL https://raw.githubusercontent.com/nafud/dotfiles/main/bootstrap.sh | bash
```

The bootstrap refuses to run as root, clones the repository into
`~/dotfiles` over HTTPS, so receiving needs no SSH key, sets the push
URL to SSH for authenticated pushes later, and hands off to `setup.sh`.
The script is idempotent end to end, and a rerun changes only what
drifted. It runs in two halves. The system half needs sudo and installs
the full package set from the official repositories in one pacman
transaction, bootstraps paru for AUR work later without installing
anything from the AUR itself, and copies the repository's `system/`
tree onto `/`, file by file, root-owned. That tree carries what the
desktop needs below the user and nothing else. Plymouth with its mono
theme draws the passphrase prompt through a mkinitcpio drop-in that
places the `plymouth` hook, a GRUB drop-in hides the menu behind a
two-second window that Esc or Shift opens and adds `splash` to the
kernel line, greetd runs monogreet, the login page, inside a greeter
niri, the pacman hooks from Snapshots keep the outgoing kernel and
mirror `/boot`, systemd-oomd guards `user.slice` as described under
Swap, and bluez leaves the adapter off until asked. The half then
enables the units those files feed, primes the kernel hooks so the
current kernels are already kept, and restarts exactly the services
whose files changed. The user half seeds the default wallpaper into
`~/Pictures/wallpaper.jpg` when none is recorded there (the login
page's background is rendered from the same file, and `wallset`
replaces it), links `config/` into `~/.config` and `bin/` into
`~/.local/bin`, enables the session units, hooks the repository's
shell files into `~/.bashrc`, sets the MIME defaults and desktop
preferences, validates the niri config, and prints a probed component
summary.

The split between this guide and the repository is deliberate, and it
runs through four homes. The repository owns the workspace, which is
everything in the session and the pieces of `system/` named above,
machine-neutral and installable on any fresh Arch. This guide owns the
base system, which is partitioning, encryption, snapper and zram from
the chapters above, and the machine's policy, which is every step of
System Hardening below. The policy is applied by hand on the machine
and recorded there by etckeeper, described at the end of that chapter,
so the steps above precede the bootstrap and are never repeated by it,
and the steps below follow it and never enter the repository.
`bash setup.sh system` reruns the system half alone, `bash setup.sh
link` the user half, and `bash setup.sh summary` prints the component
table.

A reboot now shows the Plymouth prompt for the passphrase and lands in
monogreet, where the password logs into the `niri` session. Exercise
the session once, the bar, notifications, launcher, terminal, lock,
audio, and screenshots, and `bash ~/dotfiles/setup.sh summary` must
report every row green.

## System Hardening

Arch ships every service as its upstream wrote it and adds no access
control layer, so what the installed system exposes is what its
packages expose. The steps below narrow that, from the network inward.
Every file lands under `/etc` by hand, each with its reason here, and
the last section records them, so a change made months later still
has a date and a message. Nothing in this chapter enters the workspace
repository, and the order matters only where a step says so.

### Remote Access

The installation's `sshd` has done its work, and no service on this
machine is reached from the network. Turn it off, then list what
still listens. Nothing on a non-loopback address should remain, apart
from libvirt's dnsmasq on its virtual bridge once libvirt is
installed; the stub resolver that Network Privacy below enables
answers on loopback alone. Anything else is a service to account for.

```bash
sudo systemctl disable --now sshd
ss -lpntu
```

### Firewall

The stock kernel has nftables and the `nftables` package ships a
ruleset that admits ssh from anywhere. This one replaces it. The input
chain drops everything the machine did not ask for and accepts only
what a client needs, established connections, loopback, ICMP of both
families, and DHCPv6 replies, which arrive unicast from the router's
link-local address and are not always tracked as related. The two
`virbr0` rules serve a libvirt default network, whose dnsmasq on the
bridge hands the virtual machines their addresses and names and whose
traffic is forwarded to the world by NAT. They match nothing on a
machine without that bridge and cost nothing there. The file rebuilds
its own table alone rather than flushing the ruleset, because a VPN
daemon such as Mullvad's keeps a table of its own for the tunnel's leak
protection and libvirt keeps one for its NAT, and a flush would take
both down under the running daemons. A packet must be accepted by
every table's chain on a hook, which is why the bridge rules stand
here as well as in libvirt's table.

```bash
sudo pacman -S nftables
sudo tee /etc/nftables.conf > /dev/null <<'EOF'
#!/usr/bin/nft -f
# The host firewall: nothing comes in that this machine did not ask
# for. Only this table is rebuilt on a reload; a VPN daemon's and
# libvirt's tables survive it. A packet must pass every table on a
# hook, so the libvirt bridge is admitted here as well.
destroy table inet filter
table inet filter {
  chain input {
    type filter hook input priority filter; policy drop;

    ct state invalid drop
    ct state { established, related } accept
    iif lo accept
    meta l4proto icmp accept
    meta l4proto ipv6-icmp accept
    ip6 saddr fe80::/10 udp dport 546 accept
    iifname "virbr0" meta l4proto { tcp, udp } th dport { 53, 67 } accept
    pkttype host limit rate 5/second counter reject with icmpx type admin-prohibited
    counter
  }
  chain forward {
    type filter hook forward priority filter; policy drop;

    ct state { established, related } accept
    iifname "virbr0" accept
    oifname "virbr0" accept
  }
}
EOF
sudo nft -c -f /etc/nftables.conf
sudo systemctl enable --now nftables
sudo nft list ruleset
```

`nft -c` parses the file without loading it, so a typo fails there and
not at the next boot. The ruleset listing must show the `inet filter`
table with both chains at `policy drop`, and with a VPN daemon running,
its own table beside it, untouched.

### Kernel Parameters

The sysctls below are the ones the Arch Wiki's Security and Sysctl
pages recommend and the shipped defaults leave open on this kernel,
plus three the kernel's own sysctl documentation describes and the
wiki does not list, the TTY line discipline switch and the two
protected file keys.
`kptr_restrict` hides kernel pointers from unprivileged readers of
`/proc`, `kexec_load_disabled` refuses a replacement kernel until the
next boot and is the one switch here that cannot be undone at runtime,
`ldisc_autoload` stops an unprivileged process from loading a TTY line
discipline module, the two `protected` keys refuse FIFOs and regular
files in world-writable sticky directories unless the owner matches,
`bpf_jit_harden` blinds constants in JIT-compiled filters loaded
without `CAP_BPF`, `mmap_rnd_bits` at 32 is the most address space
randomisation x86-64 offers, and `tcp_rfc1337` protects sockets in
TIME-WAIT from a premature close. ICMP redirects are neither accepted
nor sent. For IPv4 the kernel accepts a redirect when either `all` or
the interface allows it, so `all`, `default` and every interface are
set, and the `default` keys cover interfaces that appear later. For
IPv6 the kernel reads the interface value alone, so `all` is excluded
with the leading dash, the notation the wiki's Sysctl page and
systemd's own defaults use to keep a key out of a glob's reach.

What stays out has a reason each. `kernel.unprivileged_userns_clone`
stays at 1 because Firefox, Chromium, flatpak and bubblewrap build
their sandboxes from user namespaces. `kernel.yama.ptrace_scope` stays
at 1 because 2 would put sudo in front of every debugger attach.
`kernel.sysrq` stays at systemd's 16, sync only. `tcp_timestamps` stays
on, as the wiki advises, `log_martians` is a testing aid, and strict
reverse path filtering waits for a live test with the VPN and a
virtual machine up. `mmap_rnd_bits` at 32 is the one value with a
known cost, since sanitizer builds and Go's race detector map fixed
shadow regions and want 28.

```bash
sudo tee /etc/sysctl.d/50-hardening.conf > /dev/null <<'EOF'
kernel.kptr_restrict = 1
kernel.kexec_load_disabled = 1
dev.tty.ldisc_autoload = 0
fs.protected_fifos = 2
fs.protected_regular = 2
net.core.bpf_jit_harden = 1
vm.mmap_rnd_bits = 32
vm.mmap_rnd_compat_bits = 16
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.*.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.*.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.*.send_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv6.conf.*.accept_redirects = 0
-net.ipv6.conf.all.accept_redirects
EOF
sudo sysctl --system
sysctl kernel.kptr_restrict fs.protected_regular net.ipv4.conf.all.accept_redirects
```

`sysctl --system` applies every file under `sysctl.d` and reports each
key it sets, with no error line among them, and the three values must
read 1, 2 and 0.

### Kernel Modules

Two strengths keep a module from loading, as the wiki's Kernel module
page distinguishes them. `install <name> /bin/false` refuses the module
by any means, also as a dependency, and `blacklist <name>` only stops
automatic loading, so an explicit `modprobe` by root still works. The
first is for protocols and drivers with no use on a laptop, the SCTP,
RDS and TIPC transports, the ATM and CAN stacks, FireWire, the floppy
driver, the vivid test camera and the GFS2, cramfs, JFFS2 and HFS
filesystems. The second is for filesystems a desktop may one day need
for a disc or a share. Not listed, on purpose, are thunderbolt, whose
ports are real and DMA-protected by the IOMMU, bluetooth and its USB
driver, and USB storage. Not listed either is `ksmbd`, the in-kernel
SMB server, because it declares soft dependencies of its own and
`modprobe.d(5)` gives a softdep precedence over an install command for
the same module, so the rule would be ignored; the kernel's
`module_blacklist=` parameter is the refusal that works for it. The
`modconf` initramfs hook packs the directory into both images, so the
rules hold there as well, which is what the rebuild is for.

```bash
sudo tee /etc/modprobe.d/hardening.conf > /dev/null <<'EOF'
install sctp /bin/false
install rds /bin/false
install tipc /bin/false
install n-hdlc /bin/false
install atm /bin/false
install can /bin/false
install firewire-core /bin/false
install floppy /bin/false
install vivid /bin/false
install gfs2 /bin/false
install cramfs /bin/false
install jffs2 /bin/false
install hfs /bin/false
install hfsplus /bin/false
blacklist squashfs
blacklist udf
blacklist cifs
blacklist nfs
blacklist nfsv3
blacklist nfsv4
EOF
sudo mkinitcpio -P
modprobe -n -v sctp
modprobe -n -v udf
```

The dry runs show the two strengths. `sctp` ends in
`install /bin/false`, and `udf` in the `insmod` of the module itself,
since a blacklist leaves an explicit load alone.

### Core Dumps, the Journal and the Boot Files

A core dump is a process's memory, secrets included, written to disk.
With `Storage=none` systemd-coredump still receives the core, extracts
the backtrace into the journal, and keeps nothing; `ProcessSizeMax=0`
would skip the core and the backtrace with it. The journal is capped
at one gigabyte, since without a cap it grows to a tenth of the
filesystem and this root is snapshotted, so old logs would live on in
every snapshot. `/boot` holds the kernel, the initramfs and a GRUB
configuration that names the LUKS devices, on an unencrypted
partition; the filesystem package creates it world-readable, and the
tmpfiles `z` line makes it root-only without creating anything, which
pacman only warns about on a filesystem package upgrade. Everything
that reads `/boot` runs as root.

```bash
printf '[Coredump]\nStorage=none\n' | sudo tee /etc/systemd/coredump.conf.d/10-storage.conf
printf '[Journal]\nSystemMaxUse=1G\n' | sudo tee /etc/systemd/journald.conf.d/10-size.conf
printf 'z /boot 0700 root root -\n' | sudo tee /etc/tmpfiles.d/boot.conf
sudo systemctl restart systemd-journald
sudo systemd-tmpfiles --create /etc/tmpfiles.d/boot.conf
stat -c %a /boot
```

The mode must read `700`. `ls /boot` as the user is refused from now
on, which is the intended effect, and the coredump drop-in needs no
restart, since systemd-coredump reads it at each crash. The wiki's
Core dump page pairs `Storage=none` with `ProcessSizeMax=0`; the
second is left out here on purpose, for the backtrace.

### sudo and Failed Logins

Arch builds sudo with `env_editor`, so `visudo` and `sudoedit` run
whatever `$EDITOR` names, chosen by the unprivileged caller.
`!env_editor` pins them to a fixed list. A sudoers file that does not
parse locks sudo out, and one with the wrong mode is refused, so the
file is checked by `visudo -c` before it lands and installed at 0440.

```bash
printf 'Defaults !env_editor\nDefaults editor=/usr/bin/micro:/usr/bin/vim\n' > /tmp/10-hardening
visudo -cf /tmp/10-hardening
sudo install -m 440 /tmp/10-hardening /etc/sudoers.d/10-hardening
sudo visudo -c
```

Every PAM prompt on the machine, the login page, the lock screen, sudo,
shares one `pam_faillock` counter. The stock three failures in ten
minutes lock the account on a mistyped passphrase and one retry; five
within fifteen minutes and two minutes out still stops a brute force,
with no service reachable from the network anyway, without punishing a
fumble at the lock screen.

```bash
printf 'deny = 5\nfail_interval = 900\nunlock_time = 120\n' | sudo tee /etc/security/faillock.conf
```

### Network Privacy

NetworkManager's defaults for new connection profiles give each
network a stable random MAC address, the same one each time on that
network and a different one elsewhere, prefer IPv6 privacy addresses,
turn LLMNR and multicast DNS off per connection, send no hostname in
DHCP requests, and derive the DHCPv6 identifier from the profile
instead of the link-layer address, so no two networks see the same
identity. Scanning uses a random address too. The hostname and DUID
settings and the address randomisation are sections of the wiki's
NetworkManager page, the IPv6 privacy and the LLMNR and multicast DNS
switches are `nm-settings(5)` options, and the internal DHCP client in
use honours all of them. Profiles that already exist keep their own
values where they set one, so the loop brings the existing ones in
line once.

Name resolution goes through systemd-resolved, which NetworkManager
uses on its own once `/etc/resolv.conf` is the stub symlink, the
wiki's documented way to hand it the file; the explicit `dns=` line
says the same in the configuration. Two things
are set on top of it. The compiled-in fallback resolvers are emptied,
so a link that brings no DNS fails visibly instead of drifting to a
public resolver, and LLMNR and multicast DNS are off globally. A
global DNS over TLS resolver is not pinned here on purpose. It would
encrypt queries with the VPN off, but an ISP that blackholes port 853
turns that into no name resolution at all, with nothing left to fall
back to. The VPN's own resolver takes every query while the tunnel is
up, and its firewall refuses DNS to any other destination; without the
tunnel, the network's resolver answers, which is what a VPN that is
off means.

```bash
sudo tee /etc/NetworkManager/conf.d/10-privacy.conf > /dev/null <<'EOF'
[main]
dns=systemd-resolved

[connection]
wifi.cloned-mac-address=stable
ethernet.cloned-mac-address=stable
ipv6.ip6-privacy=2
connection.llmnr=0
connection.mdns=0
ipv4.dhcp-send-hostname=0
ipv6.dhcp-send-hostname=0
ipv6.dhcp-duid=stable-uuid

[device]
wifi.scan-rand-mac-address=yes
EOF
sudo tee /etc/systemd/resolved.conf.d/10-dns.conf > /dev/null <<'EOF'
[Resolve]
FallbackDNS=
MulticastDNS=no
LLMNR=no
EOF
sudo systemctl enable --now systemd-resolved
sudo ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
sudo systemctl reload NetworkManager
sudo systemctl restart systemd-resolved
nmcli -g UUID,TYPE connection show | while IFS=: read -r uuid type; do
    case "$type" in
        802-11-wireless) sudo nmcli connection modify "$uuid" 802-11-wireless.cloned-mac-address stable ipv6.ip6-privacy 2 connection.llmnr 0 connection.mdns 0 ;;
        802-3-ethernet)  sudo nmcli connection modify "$uuid" 802-3-ethernet.cloned-mac-address stable ipv6.ip6-privacy 2 connection.llmnr 0 connection.mdns 0 ;;
    esac
done
resolvectl status
```

The status must show `-LLMNR -mDNS` on the global line and no fallback
servers, and the connected link's DHCP resolver as the current server
while no tunnel is up.

### Service Boundaries

Every daemon so far runs with the full rights of the user it starts
as. For the root daemons that is everything, every capability, the
whole filesystem, every device and system call. Ordinary permissions
cannot narrow that, since the owner of a process is root either way.
What narrows it is the scope systemd can declare per unit, enforced by
the kernel through capability bounding sets, mount namespaces, device
control groups and seccomp filters, the same primitives a mandatory
access control system would use, without profiles to install or a
policy engine to maintain. The exposure report lists what each unit
declares and what it leaves open.

```bash
systemd-analyze security
systemd-analyze security wpa_supplicant.service
```

The score counts unset directives and measures reach, not
vulnerability. A high number means a bug in that daemon buys an
attacker root, a low one means it buys what the daemon itself could
do. Read the list by what runs and what it faces. On this installation
the units that arrive unconfined and matter are `wpa_supplicant`,
which parses frames from the air as root, `udisks2`, which mounts
whatever filesystem a plugged device carries, `grub-btrfsd`, which
regenerates the boot menu on every snapshot, and a VPN daemon such as
Mullvad's once one is
installed, which configures routes, nftables and DNS. NetworkManager
and bluez already carry the capability set and filesystem controls
upstream can afford, and the remaining points on their reports are
documented needs, modules, sysctls, resolv.conf, certificates in home
directories. Some units cannot be confined at all. greetd, getty and
the rescue targets spawn sessions, and every restriction on them is
inherited by the session they start, `NoNewPrivileges` alone would
break sudo for every user. udevd, the bus and the user manager are the
machinery the rest runs on.

A boundary is written as an allow list of what the daemon does, never
as a deny list of what sounds dangerous. Read the unit's binary,
configuration, logs and source for the capabilities it exercises, the
paths it writes, the devices it opens, the socket families it creates
and the programs it executes, then declare exactly those in a drop-in
under `/etc/systemd/system/<unit>.service.d/`, leaving the package's
own unit file untouched so an update can neither undo the boundary nor
be undone by it. Two properties of systemd decide what a boundary may
contain. Any directive that touches the filesystem view, `ProtectSystem`,
`ProtectHome`, `PrivateTmp`, `ReadWritePaths`, the `Protect*` family
and `PrivateNetwork`, places the unit in a private mount namespace
whose mounts never propagate to the host, so a daemon that mounts for
the system, `udisks2` here, gets no filesystem directive at all, and a
helper that must mount something on the host must run outside any
such namespace. And a `DeviceAllow` line, including the one
`ProtectClock` implies, turns the device policy into an allow list, so
a daemon that reaches block devices must name them or lose them.

The boundaries for the units named above are this guide's, one file
per unit with its reasoning in the header, and `mullvad-net-cls.service`
beside them, a oneshot that mounts the cgroup hierarchy Mullvad's
split tunnelling needs so the daemon itself needs neither
`CAP_SYS_ADMIN` nor `mount(2)`. A drop-in for a unit that is not
installed is harmless, so all six land at once. Deployment order
matters for the Mullvad pair. The package's post-install script enables
and starts the daemon, so the drop-ins must be on disk before the
package is installed or upgraded, or the daemon starts once against
stale boundaries and its early boot blocker, which installs a blocking
firewall policy, holds the machine off the network until the drop-ins
land.

```bash
cd "$(mktemp -d)"
for u in wpa_supplicant mullvad-daemon mullvad-early-boot-blocking grub-btrfsd udisks2; do
    curl -fsSL -o "$u.conf" "https://nafud.github.io/kiln/assets/hardening/systemd/system/$u.service.d/hardening.conf"
    sudo install -D -m 644 "$u.conf" "/etc/systemd/system/$u.service.d/hardening.conf"
done
curl -fsSL -o mullvad-net-cls.service https://nafud.github.io/kiln/assets/hardening/systemd/system/mullvad-net-cls.service
sudo install -m 644 mullvad-net-cls.service /etc/systemd/system/mullvad-net-cls.service
sudo curl -fsSL -o /usr/local/sbin/sandbox-check https://nafud.github.io/kiln/assets/sandbox-check
sudo chmod 755 /usr/local/sbin/sandbox-check
sudo systemctl daemon-reload
```

Roll a boundary out in two steps and measure each, with
`sandbox-check`, this guide's tool, driving both. `learn` swaps the
unit's `SystemCallFilter=` for a `SystemCallLog=` of the same set,
which makes the kernel log every system call outside the intended set
instead of blocking it, while every other directive is already
enforced and its failures show in the unit's journal; the kernel
writes those records to its log even with auditd off. `report` reads
the exposure score, the process's bounding set from `/proc`, the
journal since the unit started, and the decoded log records for the
whole boot, grouped by program, so a learning run reads as a list of
what to allow. `enforce` puts the filter back. A unit of type oneshot
is reloaded, never restarted, since a boot-time blocker or a mount
would repeat its work in the middle of a session; those two show on
a real boot, which must follow before the next unit is judged.
Rollback is the removal of the drop-in directory, a `daemon-reload`
and a restart.

```bash
sudo sandbox-check learn wpa_supplicant
sandbox-check report wpa_supplicant
sudo sandbox-check enforce wpa_supplicant
sandbox-check report
```

Use the machine for a day between `learn` and `enforce`, with the
things that daemon does, a network change, a plugged disk, a snapshot,
a suspend. A clean report is strong evidence, not proof, because the
kernel rate-limits the records like any log line; the enforce step and
a report after a reboot are the proof. Two limits stay. The score is
not a security rating, a root daemon with access to the system bus can
still ask the service manager for things its own unit forbids, so a
boundary contains accidents and cuts off whole classes of exploit
rather than confining a compromised root process outright, and the
boundaries hold only for the daemons they name, so a new service
arriving on the machine arrives unconfined until it gets one.

### The Record

Everything above is a file under `/etc`, written by hand, and the
question a year from now is what changed, when, and why. The wiki's
answer is etckeeper, a git repository inside `/etc` that a pacman hook
commits to before and after every transaction, and that tracks file
ownership and modes, which git alone does not and which matters for
files like `/etc/shadow` and the sudoers file above. The repository
stays on the encrypted root and inside every snapshot, and is never
pushed anywhere, since it holds password hashes and keys.

git needs a committer name and email and refuses the commit without
them. The name it takes from root's entry in `/etc/passwd`, whose
comment field Arch leaves empty, which the wiki's note fills; the
email it would guess from the hostname. The repository's own config
sets both, so neither guess is needed.

```bash
sudo pacman -S etckeeper
sudo usermod -c root root
sudo etckeeper init
sudo git -C /etc config user.name root
sudo git -C /etc config user.email root@localhost
sudo etckeeper commit "the installed system, hardened"
sudo systemctl enable --now etckeeper.timer
```

From here a change is an edit, a check, and a commit with a message,
`sudo etckeeper commit "what and why"`. The timer commits whatever was
forgotten once a day under a generic message, a safety net that keeps
the history complete, not a replacement for the message. Two wiki
warnings apply. A `git checkout` inside `/etc` can leave permissions
broken, so the repository is read with `sudo etckeeper vcs log` and
`sudo etckeeper vcs diff`, and a rollback goes through snapper, never
through git. And the list of explicitly installed packages belongs in
the same history, which the wiki's pacman hook provides, so a fresh
machine gets the set back with `pacman -S --needed - < /etc/pkglist.txt`.

```bash
sudo tee /etc/pacman.d/hooks/pkglist.hook > /dev/null <<'EOF'
[Trigger]
Operation = Install
Operation = Remove
Type = Package
Target = *

[Action]
When = PostTransaction
Exec = /bin/sh -c '/usr/bin/pacman -Qqe > /etc/pkglist.txt'
EOF
pacman -Qqe | sudo tee /etc/pkglist.txt > /dev/null
sudo etckeeper commit "package list hook"
sudo etckeeper vcs log --oneline
```

The log shows the three commits, and the next pacman transaction adds
its pair on its own.

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
