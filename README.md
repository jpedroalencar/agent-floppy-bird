# 🕊 Floppy Bird

A complete, polished **Flappy Bird** clone built with **Phaser 3** — all graphics and audio are programmatically generated, zero external assets.

## 🎮 Play

👉 **[https://jpedroalencar.github.io/agent-floppy-bird/](https://jpedroalencar.github.io/agent-floppy-bird/)**

Press **SPACE**, **click**, or **tap** to flap. Navigate through the pipes, track your score, and earn medals.

## ✨ Features

- **Menu screen** with animated bird and instructions
- **Full gameplay** — gravity, pipe spawning, collision, scoring
- **Score & high score** persisted in localStorage
- **Medal ranking** — Bronze (5+), Silver (15+), Gold (30+), Platinum (50+)
- **Game over screen** with animated score counter and medal display
- **Visual effects** — parallax clouds, rolling hills, ground scroll, score pops, screen flash, camera fades
- **Sound effects** — flap, score chime, hit, swoosh, medal jingle (Web Audio API)
- **Responsive** — fits any screen, works on desktop and mobile (tap)
- **Zero dependencies** — single HTML + JS, loads Phaser from CDN, no build step

## 🎯 Controls

| Input | Action |
|-------|--------|
| `SPACE` | Flap / Start / Restart |
| Click | Flap / Start / Restart |
| Tap (mobile) | Flap / Start / Restart |

## 🏆 Medals

| Score | Medal |
|-------|-------|
| 5+ | 🥉 Bronze |
| 15+ | 🥈 Silver |
| 30+ | 🥇 Gold |
| 50+ | 💎 Platinum |

## 🚀 Local Development

```bash
# Clone the repo
git clone https://github.com/jpedroalencar/agent-floppy-bird.git
cd agent-floppy-bird

# Serve with any static file server
python3 -m http.server 8080
# Or: npx serve .
# Then open http://localhost:8080
```

## 📄 License

MIT — see [LICENSE](LICENSE)
