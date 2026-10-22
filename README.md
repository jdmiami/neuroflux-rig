# Neuroflux Visual Rig

Audio-reactive visual synthesizer with nine WebGL shader cores, live audio inputs, camera effects, hand tracking, depth clouds, 3D scan imports, and Gemini scene controls, director, and lyrics.

Production: https://neuroflux-rig.vercel.app/

Repository: https://github.com/jdmiami/neuroflux-rig

## Development

- Edit `src/app.html` for the browser application (HTML, CSS, shaders, and JavaScript).
- Edit `src/studio.js` and `src/studio/` for the local Recording Studio, renderer adapter, compositor, mixer, persistence, and export workers.
- Edit `api/ai.js` for the Vercel Node.js Gemini gateway.
- Run `npm ci` and `npm run build` to rebuild the five browser payload chunks in `public/`.
- `public/index.html` loads and decompresses those chunks. The build injects the renderer adapter, bundles Studio/export JavaScript, copies the local single-thread FFmpeg core and license notices, and generates a versioned offline service worker.
- For a static preview, run `python -m http.server 8000 --directory public`. AI endpoints require Vercel's function runtime; use `npx vercel dev` for the full local app.

## Recording Studio

Tap **REC** in the existing bottom dock to record with your last settings. Open the app menu and choose **RECORD** for recording settings, framing, audio, and saved takes. The recording tools use the app's native menu sheet; there is no floating Studio toolbar. Everything is local: no streaming, cloud media storage, account connections, or direct publishing.

- **Record:** every new take shows a cancelable **3–2–1** after preparation and before capture. Legacy saved “None” preferences cannot disable it. The countdown and recorder settings never appear in the saved picture. While recording, the dock shows a red stop icon and elapsed time, plus Pause/Resume. Tap the red stop control to save. Also supports a duration limit, markers, PNG snapshots, optional second output, and separate music/microphone/mixed WAV files.
- **Output:** independent A/B compositions; clean, minimal HUD, or full performance control overlay; platform presets for YouTube, TikTok, Reels, Stories, Shorts, square and portrait feed; custom even dimensions; preview-only safe guides; fit/crop/framing; explicit picture rotation; optional lyrics, hand skeletons, title, and branding.
- **Audio:** recording gains and mutes are independent of visual reactivity. Enable an extra microphone to record voice alongside music. Speaker monitoring for that microphone defaults off; use headphones. Isolated WAV files are captured before output gain/mute, so they remain usable for remixing.
- **Library:** recordings stay in this browser/device, using OPFS chunks with an IndexedDB fallback. Play, rename, choose a library thumbnail, download, delete, trim, remix available companion sources, and export new files without overwriting originals. Device file sharing falls back to download/manual upload.

The full-menu output is a canvas-rendered performance overlay driven by the active panel's shared control state, not a browser/tab screenshot. It intentionally excludes Studio, account/AI dialogs, notifications, and secrets. Clean output also removes the operator renderer's menu-avoidance shift. Each output has independent geometry and feedback history.

### Limits and capability checks

Default output is clean 1080p30 with a mixed audio track. Before recording, a two-second test renders the selected output configuration and requires at least 80% of the requested frame rate. A failed check asks you to lower quality, reduce effects, or select one output; it never silently changes resolution. Passing this short check does not guarantee long-session thermal performance. An ongoing frame-rate warning does not change recording settings.

Two output compositions can be recorded together, with 24/30 fps and capability-tested 60 fps. Up to 3840×2160 pixels are permitted on desktop; 4K is blocked on touch-oriented/mobile devices. Orientation and dimensions are fixed during a take; live creative controls and mixer changes still work. Platform presets are editable framing defaults, not an assurance that a platform will accept a particular duration or file size.

Native MediaRecorder codecs are negotiated: MP4 when available, otherwise accurately named WebM. MP4/H.264/AAC export uses WebCodecs through Mediabunny, then a bundled single-thread FFmpeg fallback when required. WAV audio capture uses AudioWorklet and PCM16 stereo. Finishing runs in a worker; there is no paid conversion service or media upload. Source-file memory limits are 64 MB on touch/mobile devices and 256 MB on desktop; software fallback is limited to 64 MB and five minutes. Originals remain downloadable when conversion is unsupported or too large. A finished video's burned-in menus cannot be removed, and reframing cannot recreate content outside the original picture.

App/capture/export assets (including about 31 MB of local FFmpeg WASM) are cached by a service worker after the first successful online installation. Offline readiness is announced only after caching completes. Online AI and first-use external hand/depth model downloads retain their existing internet requirements. HTTPS or localhost is required for workers, microphone access, and persistent storage features. Cache updates activate between sessions rather than force-reloading an active take.

Keep Neuroflux visible and the screen unlocked. Wake lock is requested where available, but mobile browsers can suspend video/audio in the background. Saved chunks from interrupted sessions are marked accordingly and may not form a playable container. Browser storage can be evicted or cleared: download important takes. WAV files stop before their 4 GB format limit, and capture is finalized when device space is nearly exhausted. There are no cloud backups.

### Validation

```sh
npm test
npm run build
python -u tests/browser_studio.py
python -u tests/browser_rig_smoke.py
```

Browser tests require Python Playwright, Chromium at `/usr/bin/chromium`, and `ffprobe`. The capture test uses deterministic synthetic visual/audio inputs with real MediaRecorder, AudioWorklet, OPFS, worker conversion, and offline caching; encoded files are inspected with ffprobe. It covers dual shapes, pause/resume, companion WAVs, synchronization, trimming/remixing, and actual FFmpeg fallback. A separate software-WebGL smoke test exercises all nine existing shader modes, the Studio, picture rotation, and a mobile viewport. Physical Android/iPhone thermal behavior, hardware microphones/cameras, installed share-sheet destinations, 4K/60 fps, and sustained 30-minute synchronization require device testing before claiming device certification.

Media dependency licenses and source locations are documented in `src/studio/THIRD-PARTY-NOTICES.txt` and distributed in `public/` by the build.

## Deployment

Connected target: existing `neuroflux-rig` project in Vercel team `jdmiamis-projects`. Pushes to `main` deploy production; other branches receive preview deployments through Vercel's Git integration.

Vercel runs `npm run build`, serves `public/`, and deploys `api/ai.js` as `/api/ai`.

Set `GEMINI_API_KEY` in Vercel environment settings. Optional overrides: `GEMINI_BASE`, `GEMINI_MODEL`, `GEMINI_FAST_MODEL`, and `GEMINI_LIVE_MODEL`. Existing Vercel environment variables stay with the project. No credentials belong in Git.

## Recovery provenance

Initial source recovered from Vercel deployment `dpl_DJsYwxL2McS7WVMAtYZ3D1AtY7JE` on 2026-10-22. All seven original deployment source files matched their Vercel SHA-1 identifiers. This starts a new Git history; previous development history was not available.
