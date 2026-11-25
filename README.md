<div align="center">

<img src="https://raw.githubusercontent.com/HaseebAther/ripe/main/.github/icon.svg" width="96" alt="Ripe Pomodoro Timer for Linux">

# Ripe — Pomodoro Timer for Linux

**A focus timer app for Linux where the tomato actually ripens.**  
The dial rotates. The tomato turns red. When the session ends, it's fully ripe.

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![GTK3](https://img.shields.io/badge/GTK-3.0-orange.svg)](https://www.gtk.org/)
[![WebKit2GTK](https://img.shields.io/badge/WebKit2GTK-4.1-lightblue.svg)](https://webkitgtk.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux-lightgrey.svg)]()

[**Install**](#installation) · [**Features**](#features) · [**Widget Mode**](#mini-widget-mode) · [**Contributing**](#contributing)

</div>

---

Ripe is an open-source **pomodoro timer for Linux** built with Python and GTK3. It uses the [Pomodoro Technique](https://en.wikipedia.org/wiki/Pomodoro_Technique) — 25-minute focus sessions separated by short breaks — to help you work without burning out. What makes it different from every other focus timer on Linux: a **3D tomato that visually ripens** as your session runs, with a rotating kitchen-timer dial that counts down in real time. It stays out of your way while you work, and snaps into a **tiny floating widget** you can park anywhere on screen.

---

## Why Ripe

Most Linux pomodoro apps are timer utilities that happen to show a tomato icon. Ripe makes the tomato itself the timer — a 3D render where the colour and dial position reflect exactly how much time is left. Green at the start. Red when done. The dial rotates exactly like a mechanical kitchen timer. At a glance, from across the room, you can read how deep into a session you are.

| | Ripe | FocusTimer (gnome-pomodoro) | Other apps |
|---|---|---|---|
| Rotating 3D timer dial | ✅ real-time | ❌ | ❌ |
| Transparent floating widget | ✅ | ❌ | ❌ |
| Any Linux distro (not GNOME-only) | ✅ | ❌ GNOME only | varies |
| Pure Python — hackable in minutes | ✅ | ❌ Vala | varies |
| Built-in Tasks + Stats screens | ✅ | partial | partial |
| Always-on-top mini mode | ✅ | ❌ | ❌ |

---

## Features

### Timer
- **25 / 5 / 15 minute modes** — Focus, Short Break, Long Break. Drag the dial or scroll to set any custom duration from 1–60 minutes.
- **Rotating kitchen-timer dial** — the dial position and tomato colour update every second in real time, driven by a Three.js WebGL renderer.
- **Tomato ripeness** — starts green (unripe), turns red as the session runs. Break sessions turn the tomato green again.
- **Keyboard shortcuts** — `Space` to start/pause, `R` to reset, `1/2/3` to switch modes. Full list below.
- **Audio ticks and bell** — optional sound feedback on each minute tick and at session end.

### Mini Widget Mode
- **Transparent floating widget** — click the 📌 pin button to shrink the app into a small transparent overlay showing only the tomato and time. No background, no chrome.
- **Always on top** — the widget stays above every other window so you can track your session while working in any app.
- **Drag anywhere** — click and drag the tomato to park it wherever it's least in the way.
- **Hover controls** — hover over the widget to reveal Pause, Expand, and Close buttons. Double-click the tomato to return to the full app.
- **Last-minute pulse** — the tomato gently pulses in the final 60 seconds so you know to start wrapping up.

### Tasks
- Attach a task list to each focus session.
- Check tasks off as you complete them. Completed tasks persist across sessions.

### Stats
- Session history with daily, weekly, and monthly views.
- Focus time logged automatically at the end of each completed session.

### Settings
- Customise focus duration, short break, and long break lengths with live steppers.
- Toggle sound on/off. Settings are saved across launches.

---

## Installation

### Requirements

| Package | Purpose |
|---|---|
| `python3` (3.8+) | runtime |
| `python3-gi` | GTK3 Python bindings |
| `gir1.2-gtk-3.0` | GTK3 |
| `gir1.2-webkit2-4.1` | WebKit2GTK — renders the UI |
| `python3-cairo` | transparent widget support |

### Quick install (Debian / Ubuntu)

```bash
# 1. Install dependencies
sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.1 python3-cairo

# 2. Clone the repo
git clone https://github.com/HaseebAther/ripe.git
cd ripe

# 3. Run
python3 app.py
```

### Quick install (Fedora)

```bash
sudo dnf install python3-gobject gtk3 webkit2gtk4.1 python3-cairo
git clone https://github.com/HaseebAther/ripe.git && cd ripe && python3 app.py
```

### Quick install (Arch / Manjaro)

```bash
sudo pacman -S python-gobject gtk3 webkit2gtk python-cairo
git clone https://github.com/HaseebAther/ripe.git && cd ripe && python3 app.py
```

### Install to your system (adds to Activities / app launcher)

```bash
git clone https://github.com/HaseebAther/ripe.git
cd ripe
bash install.sh
```

The installer copies files to `~/.local/share/ripe/`, registers a `.desktop` entry, and installs the icon. After running it, search **Ripe** in GNOME Activities or your app launcher.

---

## Mini Widget Mode

The widget is the feature that separates Ripe from every other **focus timer app for Linux**. Click the 📌 pin in the top-right corner of the main window and the app shrinks to a small transparent overlay — just the tomato and the time, floating above all your other windows.

**What it looks like:**
- A 3D tomato (no background — fully transparent window).
- Bold time remaining below.
- Hover to reveal a dark pill with Pause ‖, Expand ↗, and Close ✕.
- Drag it anywhere on screen by clicking the tomato body.

**To return to the full app:** double-click the tomato, or hover and click ↗.

The timer state transfers correctly in both directions — going into widget mode and coming back preserves your remaining time and running state.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Start / Pause |
| `R` | Reset current session |
| `1` | Switch to Focus mode (25 min) |
| `2` | Switch to Short Break (5 min) |
| `3` | Switch to Long Break (15 min) |
| `M` | Toggle sound |
| `←` / `→` | Adjust timer by 1 minute |

---

## Project Structure

```
ripe/
├── app.py           # GTK3 window, IPC bridge, widget window manager
├── index.html       # Main app UI — 5 screens, timer logic, tasks, stats, settings
├── mini.html        # Mini widget — transparent floating tomato
├── ripe-tomato.js   # Three.js 3D tomato renderer (ES module)
├── install.sh       # One-command installer for all major distros
└── LICENSE
```

**How it works:** `app.py` opens a frameless GTK3 window containing a WebKit2GTK WebView that loads `index.html`. JavaScript in the page communicates with Python via `window.webkit.messageHandlers` — a standard WebKit IPC bridge. The widget mode opens a *separate* GTK3 window (170×215px, RGBA transparent) loading `mini.html`, so it never has to resize the main window.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Window / OS integration | [GTK3](https://www.gtk.org/) via [PyGObject](https://pygobject.gnome.org/) |
| UI renderer | [WebKit2GTK 4.1](https://webkitgtk.org/) |
| 3D tomato | [Three.js r170](https://threejs.org/) (ES module, CDN) |
| IPC | WebKit `script-message-received` / `window.webkit.messageHandlers` |
| Transparency | RGBA GDK visual + Cairo draw signal |
| Persistence | `localStorage` via WebKit |

---

## Wayland support

Ripe sets `GDK_BACKEND=x11` on startup to run through XWayland. This gives full support for `window.move()` (widget positioning) and `begin_move_drag()` (window dragging). Pure Wayland mode is on the roadmap.

---

## Contributing

Pull requests are welcome. The codebase is intentionally small:

- **Python changes** → `app.py` (~175 lines). GTK window management, IPC routing.
- **UI changes** → `index.html`. Self-contained: HTML + CSS + JS in one file.
- **Widget changes** → `mini.html`. Same structure.
- **3D tomato** → `ripe-tomato.js`. Three.js ES module. The public API is `createTomato(container, opts)` → `{setMinutes, setRipeness, bump, jump, dispose}`.

```bash
# Run from source (no install needed)
python3 app.py
```

Please open an issue before starting large changes.

---

## Roadmap

- [ ] Flatpak / Flathub packaging
- [ ] Wayland native mode (without XWayland)
- [ ] Notification on session end
- [ ] Custom session sequences
- [ ] Dark/light theme toggle in Settings
- [ ] Export stats to CSV

---

## Related

The [Pomodoro Technique](https://francescocirillo.com/pages/pomodoro-technique) was developed by Francesco Cirillo. Research on structured work-break intervals and their effect on focus can be found in studies published by the [American Psychological Association](https://www.apa.org/topics/cognitive-dissonance) and [attention management literature](https://pubmed.ncbi.nlm.nih.gov/?term=pomodoro+technique+productivity).

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<div align="center">
<sub>Built for Linux. The tomato ripens. Time well spent.</sub>
</div>
