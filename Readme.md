# 🔥 VOLTRA MD 🔥

WhatsApp bot by **Voltra** — Developer: **Calyx Drey**.

Self-hosted pairing UI, channel auto-follow, Render-ready, no panels, no external session injection.

## Features
- 🌐 Built-in Express **frontend** (open the site, click *Connect Bot*, get a pairing code)
- 📱 Pairing code + QR fallback (Baileys multi-file auth)
- 📡 Auto-follow Voltra Tech newsletter channels
- 🔥 Optional auto-react to channel posts (🔥 ❤️ 🚀)
- 🤖 Full original command system preserved
- 🖼 `bot.png` branding used in `.menu` and `.alive`
- 🔁 Auto reconnect, session persisted in `./session/`
- 🚀 Render-ready (`render.yaml` + `Procfile`)

## Local
```bash
npm install
npm start
# open http://localhost:3000
```

## Render
1. Push this repo to GitHub.
2. Create a **Web Service** from the repo on [Render](https://render.com).
3. Render will pick up `render.yaml`. Build = `npm install --omit=dev`, Start = `node index.js`.
4. Open the deployed URL → click **Connect Bot** → enter your number → enter the pairing code in WhatsApp → Linked Devices.

## Config
Edit `config.js`:
- `ownerNumber` — your number(s), digits only
- `autoFollowChannels` — newsletter JIDs (defaults to Voltra Tech)
- `prefix`, `timezone`, etc.

## Brand
```
╔════════◇◆◇═══════╗
├▢❤️‍🔥 VOLTRA MD ❤️‍🔥
├▢👑 Developer: Calyx Drey
├▢🚀 Brand: VOLTRA
├▢📡 Channel: Voltra Tech
╚════════◇◆◇═══════╝
```
