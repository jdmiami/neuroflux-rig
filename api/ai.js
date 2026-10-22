// NeuroFlux AI gateway: the only place the Gemini key lives.
// Set GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.
// Optional overrides: GEMINI_MODEL, GEMINI_FAST_MODEL, GEMINI_LIVE_MODEL (comma-separated fallbacks).
'use strict';

const BASE = (process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const list = (v, d) => (v || d).split(',').map(s => s.trim()).filter(Boolean);
const SCENE_MODELS = list(process.env.GEMINI_MODEL, 'gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-flash-lite');
const FAST_MODELS = list(process.env.GEMINI_FAST_MODEL, 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash');
const LIVE_MODEL = (process.env.GEMINI_LIVE_MODEL || 'gemini-3.5-transcribe-live').trim();

const key = () => (process.env.GEMINI_API_KEY || '').trim();
const keyOK = () => { const k = key(); return k.length > 20 && !/PASTE|YOUR_|REPLACE/i.test(k); };

/* ---------- guard rails: origin, size, rate ---------- */
const HITS = new Map();
function limited(ip, bucket, max) {
  const now = Date.now(), k = ip + '|' + bucket;
  let h = HITS.get(k);
  if (!h || now - h.t > 60000) { h = { t: now, n: 0 }; HITS.set(k, h); }
  h.n++;
  if (HITS.size > 5000) for (const [kk, vv] of HITS) if (now - vv.t > 60000) HITS.delete(kk);
  return h.n > max;
}
function originOK(req) {
  const o = req.headers.origin || req.headers.referer || '';
  if (!o) return true;
  let host = '';
  try { host = new URL(o).host; } catch (e) { return false; }
  const self = req.headers['x-forwarded-host'] || req.headers.host || '';
  return host === self || /^localhost(:\d+)?$/.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host) || /(^|\.)neuroflux[\w-]*\.vercel\.app$/.test(host);
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

/* ---------- Gemini call with model fallback ---------- */
const WORKS = {};
function parseJSON(t) {
  if (!t) return null;
  t = String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
async function post(url, body, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 25000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key() }, body: JSON.stringify(body), signal: ac.signal });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    return { status: r.status, j, txt };
  } finally { clearTimeout(tm); }
}
async function gemini(pool, name, system, parts, opt) {
  opt = opt || {};
  const order = WORKS[name] ? [WORKS[name], ...pool.filter(m => m !== WORKS[name])] : pool;
  let last = null;
  for (const model of order) {
    let think = opt.think || 'low';
    for (let attempt = 0; attempt < 2; attempt++) {
      const gc = { responseMimeType: 'application/json' };
      if (think) gc.thinkingConfig = { thinkingLevel: think };
      const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], generationConfig: gc };
      let r;
      try { r = await post(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, body, opt.timeout); }
      catch (e) { last = { status: 504, message: e.name === 'AbortError' ? 'Gemini timed out' : String(e.message || e) }; break; }
      if (r.status === 200) {
        const c = r.j && r.j.candidates && r.j.candidates[0];
        const text = c && c.content && (c.content.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('');
        const out = parseJSON(text);
        if (out) { WORKS[name] = model; return { out, model }; }
        last = { status: 502, message: 'Gemini returned no usable JSON' + (c && c.finishReason ? ' (' + c.finishReason + ')' : '') };
        break;
      }
      const msg = (r.j && r.j.error && r.j.error.message) || r.txt.slice(0, 300);
      last = { status: r.status, message: msg };
      if (r.status === 400 && think && /thinking/i.test(msg)) { think = null; continue; } // model has no thinking levels
      if (r.status === 400 && /api key|API_KEY/i.test(msg)) return { error: { status: 401, message: 'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel.' } };
      if (r.status === 403) return { error: { status: 403, message: 'Gemini refused the request (key restrictions or API not enabled): ' + msg } };
      break; // 404 / 429 / 5xx / other 400 → try next model
    }
  }
  return { error: last || { status: 502, message: 'No Gemini model answered' } };
}

/* ---------- prompts ---------- */
const RIG = `You are the creative brain inside NEUROFLUX, a real-time audio-reactive visual synthesizer (GPU shaders, feedback trails, bloom, glitch, camera blending).
The visuals already react to the music on their own; you choose the LOOK by setting parameters.
SCENE ENGINES (param "mode"): 0 HYPERTUNNEL polar wormhole tunnel · 1 KALI VORTEX folding fractal · 2 GYROID CATHEDRAL raymarched lattice architecture · 3 LIQUID PLASMA flowing domain-warped fluid · 4 JULIA BLOOM escape-time fractal flower · 5 CELL DIVISION voronoi organic cells · 6 HYPERSPACE star-streak warp · 7 SONIC MANDALA spectral rings · 8 NEON HORIZON outrun synthwave grid.
PALETTES (param "pal"): 0 SPECTRA full rainbow · 1 ACID green/yellow toxic · 2 SOLAR orange/gold/red · 3 GLACIER icy blue/cyan/white · 4 CANDY pink/violet/pastel · 5 TOXIN dark purple/green.
Design rules: commit to a strong, coherent aesthetic. Use "hue" (0-1 rotation) to fine-tune colour inside a palette. High "fb" (0.85-0.97) = long dreamy trails; low = crisp. "bloom" = glow. "glitch", "chroma", "scan", "grain", "pixel" = digital grit. "speed" = tempo of motion. "sym" = kaleidoscope folds (1 = off). Keep "bright" 0.8-1.4 so nothing goes black or blown out.
Only use parameter ids from the CATALOG, and keep every value inside its range. Dials/switches take integers.`;

const SCENE_SYS = RIG + `
TASK: turn the user's request (typed, or spoken in the attached audio) into a look and/or rig commands.
- Descriptive requests ("neon jellyfish in a thunderstorm") → design a full look: set mode, pal, hue and 8-20 other params.
- Relative tweaks ("more bloom", "slower", "darker", "less chaos") → change only the relevant params, relative to CURRENT STATE.
- Rig commands go in "commands" (only these strings): play, pause, next_scene, prev_scene, randomize, freeze, unfreeze, hide_ui, show_ui, director_on, director_off, lyrics_on, lyrics_off, hands_on, hands_off, camera_on, camera_off, mic, demo, like, skip.
- If the audio has no clear request, return empty params and say you didn't catch it.
Return ONLY JSON: {"heard": "transcript of spoken request, or empty", "title": "1-3 word UPPERCASE name for the look (empty if no new look)", "say": "one short, punchy reply, max 12 words", "params": {"id": number}, "transition": seconds 0.2-4 (short for tweaks, longer for big changes), "commands": []}`;

const PLAN_SYS = RIG + `
TASK: you are the VJ director for the track described in MUSIC. Design four looks the performer's engine will switch between as the song's sections change:
- "groove": the main steady look, matches the track's mood.
- "build": tension rising (more speed, chroma, glitch, zoom, brighter); should feel like it's about to explode.
- "drop": the payoff; the boldest, most energetic look, usually a different "mode" and "pal" from groove.
- "break": calm, spacious, dreamy (slower, long trails, softer).
Respect TASTE: lean toward liked looks, avoid disliked scene/palette combos. Avoid repeating RECENT looks.
Each look sets mode, pal, hue plus 6-14 other params from the CATALOG.
Return ONLY JSON: {"mood": "2-5 word read of the music", "looks": {"groove": {"name": "UPPERCASE NAME", "params": {}}, "build": {...}, "drop": {...}, "break": {...}}}`;

const LYR_SYS = `You transcribe song vocals for live on-screen lyrics. Listen to the audio clip (music may be loud) and write ONLY the words that are sung, rapped or spoken, in the language they are sung in.
Ignore instruments. Do not guess or invent lyrics you cannot hear; do not add punctuation beyond apostrophes. If there are no clear vocals return an empty string.
PREVIOUS LINE is context only; do not repeat it.
Return ONLY JSON: {"text": "the words", "vocals": true|false}`;

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const b64ok = s => typeof s === 'string' && s.length > 100 && s.length < 2000000 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 200));

/* ---------- handler ---------- */
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && originOK(req)) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'origin'); }
  if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-methods', 'GET,POST'); res.setHeader('access-control-allow-headers', 'content-type'); res.statusCode = 204; return res.end(); }
  if (!originOK(req)) return send(res, 403, { ok: false, error: 'origin' });

  const url = new URL(req.url, 'http://x');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const action = url.searchParams.get('action') || body.action || 'status';
  const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '?').split(',')[0].trim();

  if (action === 'status') {
    return send(res, 200, { ok: true, key: keyOK(), models: { scene: WORKS.scene || SCENE_MODELS[0], fast: WORKS.lyrics || FAST_MODELS[0], live: LIVE_MODEL } });
  }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
  if (!keyOK()) return send(res, 503, { ok: false, error: 'no_key', message: 'Add your Gemini key as GEMINI_API_KEY in Vercel, then redeploy.' });
  if (limited(ip, action === 'token' ? 'tok' : 'gen', action === 'token' ? 8 : action === 'lyrics' ? 40 : 30)) return send(res, 429, { ok: false, error: 'rate', message: 'Slow down: too many AI requests this minute.' });

  const catalog = clip(body.catalog, 9000);
  const state = clip(JSON.stringify(body.state || {}), 4000);
  const ctx = clip(JSON.stringify(body.ctx || {}), 1500);

  try {
    if (action === 'scene') {
      const prompt = clip(body.prompt, 500).trim();
      const audio = body.audio;
      if (!prompt && !b64ok(audio)) return send(res, 400, { ok: false, error: 'bad_request', message: 'Send a prompt or audio.' });
      const parts = [{ text: `CATALOG (id | label | range | default | notes):\n${catalog}\n\nCURRENT STATE: ${state}\nMUSIC NOW: ${ctx}\nRECENT REQUESTS: ${clip(JSON.stringify(body.history || []), 600)}\n\n` +
        (prompt ? `REQUEST: ${prompt}` : 'REQUEST: spoken, in the attached audio. Transcribe it into "heard" and act on it.') }];
      if (!prompt) parts.push({ inlineData: { mimeType: body.mime || 'audio/wav', data: audio } });
      const r = await gemini(SCENE_MODELS, 'scene', SCENE_SYS, parts, { think: 'low', timeout: 28000 });
      if (r.error) return send(res, r.error.status >= 400 && r.error.status < 600 ? r.error.status : 502, { ok: false, error: 'upstream', message: r.error.message });
      return send(res, 200, { ok: true, model: r.model, ...r.out });
    }
    if (action === 'plan') {
      const parts = [{ text: `CATALOG (id | label | range | default | notes):\n${catalog}\n\nCURRENT STATE: ${state}\nMUSIC: ${ctx}\nTASTE: ${clip(JSON.stringify(body.taste || {}), 2500)}\nRECENT LOOKS: ${clip(JSON.stringify(body.recent || []), 800)}` }];
      const r = await gemini(SCENE_MODELS, 'plan', PLAN_SYS, parts, { think: 'low', timeout: 35000 });
      if (r.error) return send(res, r.error.status >= 400 && r.error.status < 600 ? r.error.status : 502, { ok: false, error: 'upstream', message: r.error.message });
      return send(res, 200, { ok: true, model: r.model, ...r.out });
    }
    if (action === 'lyrics') {
      if (!b64ok(body.audio)) return send(res, 400, { ok: false, error: 'bad_request', message: 'Missing audio.' });
      const lang = clip(body.lang, 12);
      const parts = [{ text: `LANGUAGE: ${lang && lang !== 'auto' ? lang : 'detect automatically'}\nPREVIOUS LINE: ${clip(body.prev, 200)}` }, { inlineData: { mimeType: 'audio/wav', data: body.audio } }];
      const r = await gemini(FAST_MODELS, 'lyrics', LYR_SYS, parts, { think: 'low', timeout: 15000 });
      if (r.error) return send(res, r.error.status >= 400 && r.error.status < 600 ? r.error.status : 502, { ok: false, error: 'upstream', message: r.error.message });
      return send(res, 200, { ok: true, model: r.model, text: clip(r.out.text, 400), vocals: !!r.out.vocals });
    }
    if (action === 'token') {
      const now = Date.now();
      const tb = { uses: 1, expireTime: new Date(now + 30 * 60000).toISOString(), newSessionExpireTime: new Date(now + 2 * 60000).toISOString() };
      let last = null;
      for (const ver of ['v1beta', 'v1alpha']) {
        let r;
        try { r = await post(`${BASE}/${ver}/auth_tokens`, tb, 12000); } catch (e) { last = { status: 504, message: String(e.message || e) }; continue; }
        if (r.status === 200 && r.j && r.j.name) return send(res, 200, { ok: true, token: r.j.name, model: LIVE_MODEL, api: ver, expires: tb.expireTime });
        last = { status: r.status, message: (r.j && r.j.error && r.j.error.message) || r.txt.slice(0, 200) };
        if (r.status !== 404) break;
      }
      return send(res, last && last.status >= 400 && last.status < 600 ? last.status : 502, { ok: false, error: 'upstream', message: 'Live token failed: ' + (last && last.message) });
    }
    return send(res, 400, { ok: false, error: 'bad_action' });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'server', message: String(e && e.message || e).slice(0, 200) });
  }
};
