# Workspace Setup

Deploying the niri workspace from
[dotfiles](https://github.com/nafud/dotfiles){ .external-link } onto a
freshly installed Arch Linux system. The repository is the single source
of truth for every config on the machine, and one idempotent script turns
a console login into the full desktop. This guide walks through what that
script actually does, then ends at the one command that runs it. It
continues where [Arch Linux](../arch-linux/index.md) leaves off.

## Prerequisites

A base Arch install per the [Arch Linux](../arch-linux/index.md) guide, a
user in `wheel` with sudo, and a network connection. Nothing else. That
install already ships `git`, and the bootstrap installs it when absent.
The SSH key restored from the old machine's backup is needed only for
pushing changes back to the repository; receiving works without it.

## The Repository

| Path | Purpose |
| --- | --- |
| `config/` | Mirrors `~/.config`, symlinked into place entry by entry |
| `bin/` | Mirrors `~/.local/bin`, symlinked the same way |
| `setup.sh` | Packages, system glue, the linking itself, validation, the component summary |
| `bootstrap.sh` | The one-command entry point |
| `docs/` | The install manual this workspace sits on |

The load-bearing decision is symlinks. `~/.config/niri` is a link into the
repository, so an edit there applies on save (niri reloads its config
live, starship re-reads per prompt) and `git status` always shows the
whole machine's drift. A real file or directory found where a link belongs
is moved aside once as `<name>.pre-dotfiles`, never deleted, and a link
whose repository entry has disappeared is pruned on the next run.

Two programs are deliberately not whole-directory links. btop rewrites its
config file on every clean exit, which through a link would put runtime
state under git, so only its read-only `themes/` directory links and the
three intended settings are enforced in place. micro keeps live state
(`buffers/`) beside its configuration, so only `settings.json` and
`colorschemes/` link; micro rewrites `settings.json` through the link in a
stable normal form, which keeps the repository clean while an interactive
`set` still lands as a visible diff.

## What a Run Installs

Packages come first, as one `pacman -Syu --needed` transaction on top of a
full system upgrade, since partial upgrades are unsupported on Arch and
`--needed` makes reruns free.

| Group | Packages |
| --- | --- |
| Compositor stack | `niri` `xwayland-satellite` `waybar` `mako` `swaybg` `swayidle` `swaylock` `hyprlock` `rofi` |
| Terminal stack | `alacritty` `zellij` `yazi` `starship` `btop` `micro` `chafa` `cliphist` |
| CLI tools | `fzf` `zoxide` `fd` `ripgrep` `eza` `bat` `git-delta` `jq` `wl-clipboard` `p7zip` `unzip` |
| Media and viewers | `zathura` `zathura-pdf-poppler` `imv` `mpv` `grim` `slurp` `ksnip` `imagemagick` |
| Apps | `firefox` `obsidian` `keepassxc` `telegram-desktop` |
| Audio | `pipewire` `pipewire-pulse` `pipewire-alsa` `wireplumber` |
| Session | `greetd` `greetd-tuigreet` `xdg-desktop-portal` `-gtk` `-gnome` `gnome-keyring` |
| Power | `tlp` `thermald` |
| Plumbing | `qt5-wayland` `gsettings-desktop-schemas` `adwaita-icon-theme` `libnotify` `xdg-user-dirs` `brightnessctl` `pulsemixer` `ttf-jetbrains-mono-nerd` `pacman-contrib` |

The plumbing group is where fresh-install surprises hide. `qt5-wayland`
lets ksnip run as a native Wayland client instead of falling back to the
X11 bridge; without `gsettings-desktop-schemas` the dark-theme and font
settings silently do nothing; `adwaita-icon-theme` is what makes the
Adwaita cursor named in the niri config actually resolve; `pacman-contrib`
provides `checkupdates`, which feeds the bar's updates badge.

Five packages live outside the official repositories and install through
paru, which the script bootstraps from `paru-bin` (prebuilt, no Rust
compile) when absent. Mullvad VPN, Chrome, and Mullvad Browser are
AUR-only; Spotify likewise; Stremio rides along because paru resolves
official repositories first and falls back to the AUR, so it installs
correctly from wherever it lives. The Mullvad Browser package tracks the
stable channel, and the alpha channel remains Mullvad's own self-updating
tarball. From then on one `paru -Syu` upgrades both worlds, and the bar's
badge counts both.

Beyond packages, a run enables the system units (`mullvad-daemon`, which
the bar's vpn module talks to; `paccache.timer`, bounding the pacman
cache; `thermald` and `tlp` for thermals and battery), writes
`/etc/greetd/config.toml`, and enables greetd. Enabling only writes
symlinks; greetd takes over the VT at the next boot, never mid-session.

```text
[terminal]
vt = 1

[default_session]
command = "tuigreet --time --remember --remember-session --sessions /usr/share/wayland-sessions"
user = "greeter"
```

System defaults round it out. Firefox becomes the default browser, zathura
takes PDFs, imv takes images, and gsettings carries the dark preference,
the JetBrains Mono interface fonts, and the Adwaita cursor to GTK apps.

## What a Run Configures

After installing, the script links the tree (`config/` into `~/.config`,
`bin/` into `~/.local/bin`, with the move-aside and pruning semantics
above), enables the repository's user units (`waybar-updates.path`, which
pokes the bar's badge the moment the pacman database changes), and writes
a managed block into `~/.bashrc`. The block is replaced in place on every
run and never touches the rest of the file. It carries the `y` wrapper
(the shell follows yazi's last directory on quit), the eza and bat
aliases, `EDITOR=micro`, a bat-backed man pager, the gnome-keyring SSH
agent socket (skipped when an agent is already set, so a forwarded agent
over SSH survives), and the fzf, zoxide, and starship hooks.

The run ends behind a validation gate. `niri validate` must pass or the
script dies before touching a live session; with a session up, waybar is
respawned through niri's own IPC socket (which works from an SSH shell,
where the session environment is otherwise absent) and mako reloads. The
final output is a probed component summary, one row per component,
green or red by what is actually on disk rather than by what the script
believes it did.

## Daily Use

Edits happen in the repository and apply on save; recording them is a
normal git flow.

```bash
git -C ~/dotfiles add -A
git -C ~/dotfiles commit -m "describe the change"
git -C ~/dotfiles push

bash ~/dotfiles/setup.sh link      # after a pull that brings new files
bash ~/dotfiles/setup.sh summary   # re-probe the component table anytime
```

Updates flow through the bar. The badge counts pending pacman and AUR
packages, a click runs the upgrade in a terminal, and snap-pac brackets
the transaction with snapshots (see the
[Arch Linux](../arch-linux/index.md) guide's Snapshots section).

## One Command

Everything above is one line on a fresh system.

```bash
curl -fsSL https://raw.githubusercontent.com/nafud/dotfiles/main/bootstrap.sh | bash
```

The bootstrap clones the repository over HTTPS into `~/dotfiles` (or
fast-forwards an existing clone), sets the push URL to SSH for when the
backed-up key returns, and hands off to `setup.sh`. sudo prompts on the
terminal as usual, since sudo reads `/dev/tty` and the pipe does not get
in its way. The whole procedure is idempotent, so re-running it at any
time is safe and cheap. A reboot lands in tuigreet; pick the `niri`
session, and the workspace is up.
