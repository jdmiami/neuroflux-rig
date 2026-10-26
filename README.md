# Neuroflux Visual Rig

Audio-reactive visual synthesizer with nine WebGL shader cores, live audio inputs, camera effects, hand tracking, depth clouds, 3D scan imports, and Gemini scene controls, director, and lyrics.

Production: https://neuroflux-rig.vercel.app/

Repository: https://github.com/jdmiami/neuroflux-rig

If a device keeps showing an older version after refreshing, open https://neuroflux-rig.vercel.app/update.html and choose **UPDATE AND OPEN NEUROFLUX**. This removes only Neuroflux's offline app cache and service worker; saved recordings (IndexedDB/OPFS) and settings (localStorage) remain. The same link is available under **Menu → SYSTEM → APP UPDATES**. Finish recordings and exports first.

## Development

- Edit `src/app.html` for the browser application (HTML, CSS, shaders, and JavaScript).
- Edit `src/studio.js` and `src/studio/` for the local Recording Studio, renderer adapter, compositor, mixer, persistence, and export workers.
- Edit `api/ai.js` for the Vercel Node.js Gemini gateway.
- Run `npm ci` and `npm run build` to rebuild the five browser payload chunks in `public/`.
- `public/index.html` loads and decompresses those chunks. The build injects the renderer adapter, bundles Studio/export JavaScript, copies the local single-thread FFmpeg core and license notices, and generates a versioned offline service worker.
- For a static preview, run `python -m http.server 8000 --directory public`. AI endpoints require Vercel's function runtime; use `npx vercel dev` for the full local app.

## Independent camera and visual effects

**CAMERA → CAMERA FX** offers 129 camera-only modes in an eight-slot stack: 1–16 kaleidoscope divisions, mirrors, lenses/warps, clones, tunnels, square puzzles, golden-ratio layouts, time/feedback, grading/textures and local person/face/body/depth effects. The visual rack uses picture tiles, family selectors, three native rotary knobs per effect, mode-audition arrows, an XY center pad and a compact Tweak drawer. Knob edits update live and save one undo action per drag. Cards support per-effect bypass, wet/dry, reordering, undo/redo, optional autoplay and beat response. **VIS FX** treats the synthesizer independently.

CAM MIX is **0% visual synthesizer**, **50% selected blend**, **100% camera with Camera FX**. Master Camera FX bypass gives the untreated feed. Live and recorded outputs A/B share camera processing and phase, with independent framing. Camera trails have their own history. Legacy CAM WARP and CAM TRAILS are shortcuts to camera stack nodes.

Segmentation, face and pose analysis run in a local classic worker using MediaPipe 0.10.32; depth reuses the existing depth service. Models download on use and cache separately. Depth needs explicit activation from the effect card; background pictures require a local file. Camera frames never go to Gemini. Adaptive internal detail/model cadence never changes recording dimensions/FPS or silently removes a selected effect. Physical-device speed and tracking depend on hardware and scene.

## Silence Stop

**REACT → SILENCE & MOTION** starts with Silence Stop ON and silent simulation paused. Quiet/paused input no longer falls back to a simulated beat. It holds procedural clocks, animation and feedback while the camera/tracking stay live. Defaults: −48 dBFS threshold, 6 dB hysteresis, 300 ms hold. Playback pause and music headphone level zero stop motion promptly; recording-only output gains/mutes remain independent. SIM Play/Pause is explicit. Capture timers/audio/UI continue while motion is held.

## Portable whole-app setups

**SAVE** beside REC creates a separate timestamped setup in one tap, including during recording. The button remains available beside Reveal in clean mode; Ctrl/Cmd+S works from every panel. Durable storage errors show Retry rather than a false success. **SCENES → WHOLE-APP SETUPS** saves controls, Camera FX, motion preferences, scene slots/pins, audio and both output layouts in named IndexedDB setups. Download/import uses validated version-1 `.neuroflux.json` files (maximum 1 MiB), with preview and explicit application. Source media must be reselected. Imports do not start capture, activate hardware, make AI requests or enable the walkthrough. Microphone monitoring requires explicit activation. Loading is blocked during capture/export; a failed apply rolls settings back. Existing recordings and scene slots are preserved.

## Guided walkthroughs

Walkthrough mode is **OFF by default**. Open **Menu → AI → GUIDED WALKTHROUGH**, explicitly enable its switch, describe a goal, review the generated plan, then tap **BEGIN WALKTHROUGH**. The guide opens the appropriate native page and highlights the real control. Apply a suggested setting or adjust it yourself; Next unlocks when the app verifies the setting. Listening and visual-review steps require your own confirmation. Reversible settings offer Undo. Skip, minimize, resume and rebuild remaining steps are available. The × button turns the mode off, as does the AI panel switch: both dismiss overlays, cancel pending guide requests and clear the resumable plan. The switch remembers your choice, and no session starts a walkthrough automatically. Recording always requires an explicit start tap and the existing countdown.

The guide retrieves passages from the full [user manual](https://neuroflux-rig.vercel.app/manual.html), generated from `docs/Neuroflux-User-Guide.md`, alongside a catalog extracted from the real app controls. It sends your goal, bounded numeric/settings state and device capability flags to the existing server-side Gemini gateway. It does not send camera frames, microphone recordings, source files, filenames, titles, branding text or API keys. Each step cites manual sources. Tools are validated on server and client; they cannot execute arbitrary code, delete recordings, upload media or publish externally.

Each new request tries **Gemini 3.8 Flash first**, then the configured Flash fallbacks. The plan displays the model that actually answered and explicitly labels a fallback. Set `GEMINI_GUIDE_MODEL` to override that ordered list. AI generation needs internet; existing controls and downloaded/cached manual remain available without it. Server checks reject a mismatched app/manual catalog version and direct the user to the update page.

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
python -u tests/browser_guide.py
python -u tests/browser_fx.py
python -u tests/browser_camera_mix.py
python -u tests/browser_camera_fx.py
python -u tests/browser_camera_controls.py
python -u tests/browser_quick_save.py
```

Browser tests require Python Playwright, Chromium at `/usr/bin/chromium`, and `ffprobe`. The capture test uses deterministic synthetic visual/audio inputs with real MediaRecorder, AudioWorklet, OPFS, worker conversion, and offline caching; encoded files are inspected with ffprobe. It covers dual shapes, pause/resume, companion WAVs, synchronization, trimming/remixing, and actual FFmpeg fallback. A separate software-WebGL smoke test exercises all nine existing shader modes, the Studio, picture rotation, and a mobile viewport. Physical Android/iPhone thermal behavior, hardware microphones/cameras, installed share-sheet destinations, 4K/60 fps, and sustained 30-minute synchronization require device testing before claiming device certification.

Media dependency licenses and source locations are documented in `src/studio/THIRD-PARTY-NOTICES.txt` and distributed in `public/` by the build.

## Deployment

Connected target: existing `neuroflux-rig` project in Vercel team `jdmiamis-projects`. Pushes to `main` deploy production; other branches receive preview deployments through Vercel's Git integration.

Vercel runs `npm run build`, serves `public/`, and deploys `api/ai.js` as `/api/ai`.

Set `GEMINI_API_KEY` in Vercel environment settings. Optional overrides: `GEMINI_BASE`, `GEMINI_MODEL`, `GEMINI_FAST_MODEL`, and `GEMINI_LIVE_MODEL`, and `GEMINI_GUIDE_MODEL`. Existing Vercel environment variables stay with the project. No credentials belong in Git.

## Recovery provenance

Initial source recovered from Vercel deployment `dpl_DJsYwxL2McS7WVMAtYZ3D1AtY7JE` on 2026-10-22. All seven original deployment source files matched their Vercel SHA-1 identifiers. This starts a new Git history; previous development history was not available.
