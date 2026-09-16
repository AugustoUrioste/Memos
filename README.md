# Memos

Tap a button, talk, and your idea becomes a file in this repo — from a shortcut
on your phone's home screen. No server, no app store: it's a static page that
talks straight to the GitHub API.

- 🎙 Records audio (works everywhere: iOS Safari, Android Chrome, desktop)
- 📝 Also transcribes live speech-to-text where the browser supports it
  (Chrome desktop/Android, Safari to a good extent) — you can edit the text
  before saving
- 📴 Works offline: if you're out of signal, the memo is queued in the browser
  and synced next time you're online
- 📄 Every memo becomes `memos/YYYY/MM/<timestamp>.md`, with the matching
  audio (if recorded) at `audio/YYYY/MM/<timestamp>.<ext>`

## One-time setup

### 1. Turn on GitHub Pages (hosts the app)

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch:
**main**, folder **/(root)** → **Save**.

GitHub will give you a URL like `https://augustourioste.github.io/Memos/`.
It can take a minute or two to go live the first time.

### 2. Create a personal access token

Go to
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
and create a **fine-grained token**:

- Repository access → **Only select repositories** → `Memos`
- Permissions → **Contents: Read and write**
- Set an expiration you're comfortable with (you'll just make a new one and
  re-paste it into Settings when it expires)

Copy the token (starts with `github_pat_...`).

### 3. Open the app and add it to your home screen

Visit your Pages URL on your phone.

- The app will ask for the token the first time — paste it in, along with the
  repo (`AugustoUrioste/Memos`) and branch (`main`). It's saved only in your
  phone's browser storage and is sent directly from your phone to
  `api.github.com` — never through any other server.
- **iOS (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Add to Home screen** / **Install app**.

Now you have a "Memos" icon on your home screen. Tap it, tap the mic, talk,
review the text, and hit **Save to GitHub**.

## How it works

Pure static site (`index.html` / `app.js` / `style.css`), installable as a
PWA via `manifest.webmanifest` + `service-worker.js` (caches the app shell so
it opens instantly and offline; your token and pending memos live in
`localStorage`). Recording uses `MediaRecorder`; transcription uses the
browser's `SpeechRecognition` API when available. Saving calls the GitHub
Contents API (`PUT /repos/:owner/:repo/contents/:path`) directly from the
browser using your personal access token.

## Privacy note

Because Pages requires a public repo on the free plan, memo files
(`memos/**/*.md`, `audio/**`) are technically public on GitHub, even though
the URL isn't shared anywhere. If that's not okay for what you're recording,
switch to a private repo and host the same static files on something like
Vercel or Netlify instead — the app code doesn't need to change, only where
it's hosted.
