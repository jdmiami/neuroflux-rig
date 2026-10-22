# Neuroflux Visual Rig

Audio-reactive visual synthesizer with nine WebGL shader cores, live audio inputs, camera effects, hand tracking, depth clouds, 3D scan imports, and Gemini scene controls, director, and lyrics.

Production: https://neuroflux-rig.vercel.app/

## Development

- Edit `src/app.html` for the browser application (HTML, CSS, shaders, and JavaScript).
- Edit `api/ai.js` for the Vercel Node.js Gemini gateway.
- Run `npm ci` and `npm run build` to rebuild the five browser payload chunks in `public/`.
- `public/index.html` loads and decompresses those chunks. The build preserves the recovered payload exactly until the source changes.
- For a static preview, run `python -m http.server 8000 --directory public`. AI endpoints require Vercel's function runtime; use `npx vercel dev` for the full local app.

## Deployment

Connected target: existing `neuroflux-rig` project in Vercel team `jdmiamis-projects`. Pushes to `main` deploy production; other branches receive preview deployments through Vercel's Git integration.

Vercel runs `npm run build`, serves `public/`, and deploys `api/ai.js` as `/api/ai`.

Set `GEMINI_API_KEY` in Vercel environment settings. Optional overrides: `GEMINI_BASE`, `GEMINI_MODEL`, `GEMINI_FAST_MODEL`, and `GEMINI_LIVE_MODEL`. Existing Vercel environment variables stay with the project. No credentials belong in Git.

## Recovery provenance

Initial source recovered from Vercel deployment `dpl_DJsYwxL2McS7WVMAtYZ3D1AtY7JE` on 2026-10-22. All seven original deployment source files matched their Vercel SHA-1 identifiers. This starts a new Git history; previous development history was not available.
