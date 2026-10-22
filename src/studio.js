import { PRESETS, profile, dimensions, validateProfile, formatTime, formatBytes } from './studio/profiles.js';
import { ProgramOutput } from './studio/compositor.js';
import { OutputMixer } from './studio/audio.js';
import { RecordingStore } from './studio/storage.js';
import { CaptureSession, recordingMime } from './studio/capture.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = selector => document.querySelector(selector);
const select = (label, key, values, current, locked = false) => `<label>${label}<select data-field="${key}" ${locked ? 'disabled' : ''}>${Object.entries(values).map(([value, text]) => `<option value="${escape(value)}" ${String(current) === value ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
const number = (label, key, value, min, max, step = 1, locked = false) => `<label>${label}<input data-field="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" ${locked ? 'disabled' : ''}></label>`;
const check = (label, key, checked, locked = false) => `<label class="nfx-check"><input type="checkbox" data-field="${key}" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''}>${label}</label>`;
const range = (label, key, value, min = 0, max = 2, step = 0.05) => `<label>${label}<input aria-label="${label}" data-field="${key}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;

class RecordingStudio {
  constructor(rig) {
    this.rig = rig; this.mixer = new OutputMixer(rig); this.store = new RecordingStore();
    this.profiles = [profile('a'), profile('b', 'tiktok')]; this.outputs = this.profiles.map(p => new ProgramOutput(rig, p));
    this.settings = { kind: 'video', countdown: 3, limit: 0, stems: true, mixed: false, dual: false };
    this.current = 0; this.tab = 'record'; this.lastUi = 0; this.opened = false;
    this.assetUrls = []; this.outputTests = new Map(); this.samples = [[], []]; this.frameTimes = [];
    this.restore(); this.mount();
    this.mixer.onInputEnded = () => this.message('Microphone disconnected. Saved audio may contain silence; choose a microphone again.');
    this.rig.audio();
  }
  async init() {
    try { await this.store.open(); this.storageReady = true; await this.updateStorage(); this.message('Ready. Recordings stay on this device.'); }
    catch (error) { this.message(`Device storage is unavailable: ${error.message}. Enable storage for this site to record.`); }
    this.render();
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
        navigator.serviceWorker.addEventListener('message', ({ data }) => {
          if (data?.type === 'OFFLINE_READY') this.message('App and local export tools are available offline. Online AI and first-time model downloads still need internet.');
        });
      }
    } catch { /* Recording still works without offline installation. */ }
  }
  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem('nfx.studio.v1'));
      if (saved?.profiles?.length === 2) this.profiles.forEach((p, i) => {
        Object.assign(p, Object.fromEntries(Object.entries(saved.profiles[i]).filter(([k]) => k in p && k !== 'id')));
        validateProfile(p);
      });
      if (saved?.settings) Object.assign(this.settings, saved.settings);
      if (saved?.audio) {
        for (const key of ['music', 'mic', 'musicMonitor']) if (Number.isFinite(saved.audio[key]))
          this.mixer.settings[key] = Math.max(0, Math.min(key === 'musicMonitor' ? 1 : 2, saved.audio[key]));
        for (const key of ['muted','musicMuted','micMuted']) this.mixer.settings[key] = !!saved.audio[key];
        if (Number.isFinite(saved.audio.offset)) this.mixer.settings.offset = Math.max(-500, Math.min(500, saved.audio.offset));
      }
    } catch { this.profiles.forEach((p, i) => Object.assign(p, profile(i ? 'b' : 'a', i ? 'tiktok' : 'youtube'))); }
  }
  persist() {
    try { localStorage.setItem('nfx.studio.v1', JSON.stringify({ profiles: this.profiles, settings: this.settings, audio: this.mixer.settings })); } catch {}
  }
  mount() {
    document.body.insertAdjacentHTML('beforeend', `<div id="nfxStudioBar" aria-label="Recording controls">
      <button data-action="open" aria-expanded="false" aria-controls="nfxStudioPanel">◉ STUDIO</button>
      <span id="nfxStudioTime" aria-live="off">LOCAL</span><button data-action="pause" hidden aria-label="Pause recording">Ⅱ</button>
      <button data-action="stop" hidden aria-label="Stop and save recording">■ SAVE</button></div>
      <section id="nfxStudioPanel" role="dialog" aria-label="Recording Studio" hidden>
      <header><div><strong>RECORDING STUDIO</strong><span class="nfx-eyebrow">YOUR PICTURE. YOUR TAKE.</span></div>
      <button data-action="close" aria-label="Close Recording Studio">✕</button></header>
      <nav role="tablist" aria-label="Studio sections">${['record','output','audio','library'].map(t => `<button role="tab" id="nfx-tab-${t}" aria-controls="nfxStudioBody" data-tab="${t}">${t.toUpperCase()}</button>`).join('')}</nav>
      <div id="nfxStudioMessage" class="nfx-status" role="status" aria-live="polite">Opening device storage…</div>
      <div id="nfxStudioBody" class="nfx-body" role="tabpanel"></div></section>
      <div id="nfxStudioCountdown" hidden aria-live="assertive"></div>`);
    this.panel = $('#nfxStudioPanel'); this.body = $('#nfxStudioBody');
    for (const el of [this.panel, $('#nfxStudioBar')]) {
      el.addEventListener('click', event => this.handleClick(event).catch(error => this.message(error.message)));
      el.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') { if (this.busy) return; this.open(false); }
      });
      el.addEventListener('pointerdown', event => event.stopPropagation());
      el.addEventListener('pointerup', event => event.stopPropagation());
    }
    this.panel.querySelector('nav').addEventListener('keydown', event => {
      const tabs = ['record','output','audio','library'], current = tabs.indexOf(this.tab);
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      this.tab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (current + (event.key === 'ArrowRight' ? 1 : 3)) % 4];
      this.render(); this.panel.querySelector(`[data-tab=${this.tab}]`).focus();
    });
    this.panel.addEventListener('change', event => this.change(event).catch(error => this.message(error.message)));
    this.panel.addEventListener('input', event => {
      if (event.target.matches('input[type=range],input[type=text],input[type=color]')) this.change(event).catch(error => this.message(error.message));
    });
    addEventListener('beforeunload', event => {
      if (this.active || this.busy) { event.preventDefault(); event.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => {
      if (this.active) {
        if (document.hidden) { this.wasHidden = true; this.message('The app is in the background. Your browser may suspend video or audio. Keep Neuroflux visible while recording.'); }
        else { this.wake(); this.message(this.wasHidden ? 'App resumed. Check this take for a possible background gap.' : 'Recording continues.'); }
      }
    });
    $('#gl').addEventListener('webglcontextlost', () => {
      if (this.session) { this.message('Graphics context lost. Finalizing saved recording data.'); this.stop(); }
    });
  }
  get active() { return !!this.session && ['preparing', 'recording', 'paused', 'saving'].includes(this.session.status); }
  message(text) { $('#nfxStudioMessage').textContent = text; }
  open(value = true) {
    this.opened = value; this.panel.hidden = !value;
    $('#nfxStudioBar [data-action=open]').setAttribute('aria-expanded', value);
    if (value) { this.render(); this.panel.querySelector('[data-action=close]').focus(); }
    else { this.outputs.forEach((o, i) => { if (!this.active || (!this.settings.dual && i === 1)) o.release(); }); $('#nfxStudioBar [data-action=open]').focus(); }
  }
  render() {
    this.clearUrls();
    this.panel.querySelectorAll('[data-tab]').forEach(el => {
      el.setAttribute('aria-selected', el.dataset.tab === this.tab); el.tabIndex = el.dataset.tab === this.tab ? 0 : -1;
    });
    this.body.setAttribute('aria-labelledby', `nfx-tab-${this.tab}`);
    if (this.tab === 'record') this.recordView();
    if (this.tab === 'output') this.outputView();
    if (this.tab === 'audio') this.audioView();
    if (this.tab === 'library') this.libraryView().catch(error => this.message(error.message));
    this.updateButtons();
  }
  previewMarkup() {
    return `<div class="nfx-preview"><canvas id="nfxStudioPreview" aria-label="Exact recording output preview"></canvas><div class="nfx-guide" hidden><span>SAFE AREA · PREVIEW ONLY</span></div></div>
      <p class="nfx-note" id="nfxOutputInfo"></p>`;
  }
  recordView() {
    const s = this.settings, locked = this.active || this.busy || this.exporting;
    this.body.innerHTML = this.previewMarkup() + `<div class="nfx-row"><button data-action="start" class="nfx-primary" ${locked || !this.storageReady ? 'disabled' : ''}>● RECORD</button>
      <button data-action="test" ${locked ? 'disabled' : ''}>TEST OUTPUT</button><button data-action="snapshot">SNAPSHOT</button></div>
      <div class="nfx-row"><button data-action="pause" ${!this.session || !['recording','paused'].includes(this.session.status) ? 'disabled' : ''}>${this.session?.status === 'paused' ? 'RESUME' : 'PAUSE'}</button>
      <button data-action="stop" ${!this.session || this.session.status === 'saving' ? 'disabled' : ''}>STOP & SAVE</button><button data-action="mark" ${!this.session?.started ? 'disabled' : ''}>MARKER</button></div>
      ${select('Capture', 'settings.kind', { video: 'Video recording', audio: 'Audio only · WAV' }, s.kind, locked)}
      <div class="nfx-row">${select('Countdown', 'settings.countdown', { 0: 'None', 3: '3 seconds', 5: '5 seconds', 10: '10 seconds' }, s.countdown, locked)}
      ${number('Stop after seconds · 0 = manual', 'settings.limit', s.limit, 0, 14400, 1, locked)}</div>
      ${check('Record output B at the same time', 'settings.dual', s.dual, locked || s.kind === 'audio')}
      ${check('Save separate music and microphone WAV files', 'settings.stems', s.stems, locked)}
      ${check('Also save the mixed audio as a WAV file', 'settings.mixed', s.mixed, locked || s.kind === 'audio')}
      <p>Companion sources are saved before output gain and mute so you can remix later. A microphone must be enabled in Audio to capture it alongside music.</p>
      <p class="nfx-note" id="nfxStorageInfo">${escape(this.storageText || '')}</p>
      <p>Keep this tab visible and your screen unlocked. Browser storage can be cleared by the device; download important takes. No upload or subscription is required.</p>
      <div class="nfx-row"><button data-action="demo">PLAY DEMO</button><button data-action="persist">PROTECT DEVICE STORAGE</button></div>`;
  }
  outputView() {
    const p = this.profiles[this.current], locked = this.active || this.busy;
    this.body.innerHTML = `<div class="nfx-row"><button data-output="0" class="${!this.current ? 'nfx-selected' : ''}">OUTPUT A</button><button data-output="1" class="${this.current ? 'nfx-selected' : ''}">OUTPUT B</button></div>` + this.previewMarkup() +
      select('Platform preset', 'output.preset', Object.fromEntries(Object.entries(PRESETS).map(([k,v]) => [k,v.name])), p.preset, locked) +
      `<div class="nfx-row">${number('Width', 'output.width', p.width, 128, 3840, 2, locked)}${number('Height', 'output.height', p.height, 128, 3840, 2, locked)}</div>
      <div class="nfx-row">${select('Resolution shortcut', 'output.resolution', { 720: '720p · lighter', 1080: '1080p', 2160: '2160p · desktop' }, Math.min(p.width, p.height), locked)}
      ${select('Frame rate', 'output.fps', { 24: '24 fps', 30: '30 fps', 60: '60 fps · test required' }, p.fps, locked)}</div>
      ${select('Output orientation', 'output.orientation', { landscape: 'Landscape · upright text', portrait: 'Portrait · upright text', square: 'Square' }, p.width === p.height ? 'square' : p.width > p.height ? 'landscape' : 'portrait', locked)}
      ${select('Rotate entire picture', 'output.rotation', { 0: '0° · normal', 90: '90° clockwise', 180: '180°', 270: '270° clockwise' }, p.rotation, locked)}
      ${select('Framing', 'output.fit', { render: 'Render for this shape · no stretching', fit: 'Fit operator aspect · background', crop: 'Fill from operator aspect · crop' }, p.fit, locked)}
      ${range('Zoom', 'output.zoom', p.zoom, 1, 2)}<div class="nfx-row">${range('Frame left / right', 'output.panX', p.panX, -1, 1)}${range('Frame up / down', 'output.panY', p.panY, -1, 1)}</div>
      <label>Fit background<input type="color" data-field="output.background" value="${p.background}"></label>
      <h3>RECORDED INTERFACE</h3>${select('Menu visibility', 'output.mode', { clean: 'Clean · visuals only', minimal: 'Minimal performance HUD', full: 'Full performance menu' }, p.mode)}
      <div class="nfx-row">${check('Scene name', 'output.scene', p.scene)}${check('BPM', 'output.bpm', p.bpm)}</div>
      <div class="nfx-row">${check('Palette', 'output.palette', p.palette)}${check('Audio meter', 'output.meter', p.meter)}</div>
      <div class="nfx-row">${check('Lyrics', 'output.lyrics', p.lyrics)}${check('Hand skeletons', 'output.hands', p.hands)}</div>
      <label>Recorded title<input type="text" maxlength="80" data-field="output.title" value="${escape(p.title)}"></label>
      <label>Your branding · optional<input type="text" maxlength="60" data-field="output.branding" value="${escape(p.branding)}"></label>
      ${select('Audio for this output', 'output.audio', { mix: 'Music + microphone mix', music: 'Music / system only', mic: 'Microphone only', silent: 'Silent video' }, p.audio, locked)}
      ${check('Show safe-area guide in preview only', 'output.guide', p.guide)}
      <p>Presets are editable starting points. Platform limits can change. Safe areas are approximate; verify the upload preview in your chosen app. Settings, credentials, notifications, and permission prompts are never captured.</p>`;
  }
  audioView() {
    const s = this.mixer.settings;
    this.body.innerHTML = `<p>Music and live input still drive the visuals when the recording is muted. Use headphones to prevent microphone feedback.</p>
      <div class="nfx-row"><button data-action="audioInit">ENABLE AUDIO</button><button data-action="demo">PLAY DEMO</button></div>
      <h3>MUSIC / SYSTEM INPUT</h3><div class="nfx-meter" data-meter="music" aria-label="Music peak meter"><i></i></div>
      ${range('Music recording gain', 'audio.music', s.music)}${check('Mute music in outputs', 'audio.musicMuted', s.musicMuted)}
      <h3>MICROPHONE</h3><div class="nfx-meter" data-meter="mic" aria-label="Microphone peak meter"><i></i></div>
      <div class="nfx-row"><button data-action="micOn">ENABLE MICROPHONE</button><button data-action="micOff">RELEASE EXTRA MIC</button></div>
      <label>Microphone device<select id="nfxMicDevice"><option value="">System default</option></select></label>
      ${range('Microphone recording gain', 'audio.mic', s.mic)}${check('Mute microphone in outputs', 'audio.micMuted', s.micMuted)}
      <h3>OUTPUT MIX</h3><div class="nfx-meter" data-meter="mix" aria-label="Mixed output peak meter"><i></i></div>
      ${check('Mute mixed recording audio · visuals keep reacting', 'audio.muted', s.muted)}
      ${number('Audio sync · ms · positive delays music, negative delays mic', 'audio.offset', s.offset, -500, 500, 10)}
      <h3>HEADPHONE MONITORING</h3>${range('Music headphone level', 'audio.musicMonitor', s.musicMonitor, 0, 1)}
      ${range('Microphone headphone level · headphones required', 'audio.micMonitor', s.micMonitor, 0, 1)}
      <p>The main rig selects the music/file/system source. This extra microphone can run alongside it. System and microphone audio already mixed by a device cannot be separated afterward. UI clicks are excluded.</p>`;
    this.devices();
  }
  async devices() {
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices();
      const selector = $('#nfxMicDevice'); if (!selector || !devices) return;
      for (const d of devices.filter(d => d.kind === 'audioinput' && d.deviceId)) {
        const option = document.createElement('option'); option.value = d.deviceId; option.textContent = d.label || 'Microphone'; selector.append(option);
      }
    } catch {}
  }
  async change(event) {
    const input = event.target, key = input.dataset.field;
    if (!key) return;
    let value = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
    const [scope, name] = key.split('.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Enter a valid number.');
    if (scope === 'settings') {
      if (this.active || this.busy) return;
      if (['countdown', 'limit'].includes(name)) value = Number(value);
      if (name === 'limit' && (value < 0 || value > 14400)) throw new Error('Choose a duration from 0 to 14400 seconds.');
      this.settings[name] = value; if (name === 'dual' || name === 'kind') this.render();
    }
    if (scope === 'audio') {
      const limits = { music: [0,2], mic: [0,2], offset: [-500,500], musicMonitor: [0,1], micMonitor: [0,1] };
      if (limits[name] && (value < limits[name][0] || value > limits[name][1])) throw new Error('Audio value is outside its supported range.');
      this.mixer.settings[name] = value; await this.mixer.init(); this.mixer.apply();
    }
    if (scope === 'output') {
      const p = this.profiles[this.current], lockedFields = ['width','height','fps','preset','rotation','orientation','resolution','audio','fit'];
      if ((this.active || this.busy) && lockedFields.includes(name)) return;
      if (name === 'preset') { Object.assign(p, { preset: value, width: PRESETS[value].width, height: PRESETS[value].height }); this.render(); }
      else if (name === 'resolution') {
        const scale = Number(value) / Math.min(p.width, p.height);
        p.width = Math.round(p.width * scale / 2) * 2; p.height = Math.round(p.height * scale / 2) * 2; this.render();
      } else if (name === 'orientation') {
        const small = Math.min(p.width, p.height), large = Math.max(p.width, p.height);
        p.width = value === 'landscape' ? large : small; p.height = value === 'portrait' ? large : small; p.preset = 'custom'; this.render();
      } else {
        if (['fps','rotation'].includes(name)) value = Number(value);
        p[name] = value;
        if (['width','height'].includes(name)) p.preset = 'custom';
      }
      if (lockedFields.includes(name)) this.outputTests.clear();
    }
    this.persist();
  }
  async handleClick(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.tab) { this.tab = button.dataset.tab; this.render(); return; }
    if (button.dataset.output) { this.current = Number(button.dataset.output); this.render(); return; }
    if (button.dataset.asset) return this.showAsset(button.dataset.asset);
    const action = button.dataset.action;
    if (action === 'open') this.open(!this.opened);
    if (action === 'close') this.open(false);
    if (action === 'start') await this.start();
    if (action === 'stop') await this.stop();
    if (action === 'pause') {
      if (this.session?.status === 'paused') this.session.resume(); else this.session?.pause();
      this.message(this.session?.status === 'paused' ? 'Paused. Changes you make now are not part of the take.' : 'Recording resumed.');
      this.render();
    }
    if (action === 'mark' && this.session?.started) { this.session.mark(); this.message(`Marker ${this.session.markers.length} at ${formatTime(this.session.seconds)}.`); }
    if (action === 'snapshot') await this.snapshot();
    if (action === 'test') await this.testOutputs();
    if (action === 'demo') { await this.mixer.init(); this.rig.selectSource('demo'); }
    if (action === 'audioInit') { await this.mixer.init(); this.message('Audio mixer ready. Choose music in the rig or enable a microphone.'); }
    if (action === 'micOn') { await this.mixer.enableMicrophone($('#nfxMicDevice')?.value); this.audioView(); this.message('Microphone enabled. It can now be recorded alongside music.'); }
    if (action === 'micOff') { this.mixer.disableMicrophone(); this.message('Extra microphone released. The main rig microphone, if selected, remains active.'); }
    if (action === 'persist') { const granted = await navigator.storage?.persist?.(); this.message(granted ? 'Persistent storage granted. Still download important recordings.' : 'The browser manages storage automatically. Download important recordings.'); }
    if (action === 'back') { this.selectedAsset = null; this.render(); }
    if (action === 'download') await this.downloadAsset();
    if (action === 'share') await this.shareAsset();
    if (action === 'rename') {
      const asset = await this.store.get(this.selectedAsset); asset.name = $('#nfxAssetName').value.trim().slice(0,120) || asset.name; await this.store.put(asset); this.message('Recording renamed.');
    }
    if (action === 'delete') {
      const asset = await this.store.get(this.selectedAsset);
      if (asset?.status === 'recording') throw new Error('Stop and save this recording before deleting it.');
      if (!confirm('Delete this recording from this device? Download a copy first if you need it.')) return;
      await this.store.remove(this.selectedAsset); this.selectedAsset = null; this.render(); this.message('Recording deleted from this device.');
    }
    if (action === 'thumbnail') await this.thumbnail();
    if (action === 'downloadCover') {
      const asset = await this.store.get(this.selectedAsset);
      if (asset.thumbnail) this.download(asset.thumbnail, `${asset.name}-cover.jpg`);
    }
    if (action === 'export') await this.exportAsset();
    if (action === 'cancelExport') { this.exportWorker?.terminate(); this.exportWorker = null; this.exporting = false; this.message('Export canceled. The original is unchanged.'); if (this.selectedAsset) await this.showAsset(this.selectedAsset); }
    if (button.dataset.seek) { const player = $('#nfxAssetPlayer'); if (player) player.currentTime = Number(button.dataset.seek); }
  }
  selectedOutputs() { return this.settings.dual ? this.outputs : [this.outputs[0]]; }
  testKey(outputs = this.selectedOutputs()) { return JSON.stringify(outputs.map(o => { const p = o.profile; return [p.width,p.height,p.fps,p.fit,p.rotation]; })); }
  async testOutputs() {
    if (this.active || this.busy) return false;
    if (this.exporting) throw new Error('Finish or cancel the export before testing recording quality.');
    const outputs = this.selectedOutputs(); outputs.forEach(o => validateProfile(o.profile));
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || !recordingMime()) throw new Error('Canvas recording is not supported by this browser.');
    if (!this.rig.ready()) throw new Error('The WebGL engine is not ready.');
    this.testing = true; this.busy = true; this.testFrames = outputs.map(() => []); this.updateButtons();
    this.message('Testing the actual visual output for 2 seconds. Keep your current effects and camera settings active.');
    try {
      await sleep(250); this.testStart = performance.now(); await sleep(2000);
      const elapsed = (performance.now() - this.testStart) / 1000;
      const rates = this.testFrames.map(frames => frames.filter(time => time >= this.testStart).length / elapsed);
      const supported = outputs.every((o, i) => rates[i] >= o.profile.fps * 0.8);
      this.outputTests.set(this.testKey(outputs), supported);
      this.message(`${rates.map((rate, i) => `Output ${outputs[i].profile.id.toUpperCase()}: ${rate.toFixed(1)} fps`).join(' · ')}. ${supported ? 'Ready to record at the selected quality.' : 'This configuration is too heavy. Choose 720p, fewer effects, or one output and test again.'}`);
      return supported;
    } finally { this.testing = false; this.busy = false; this.updateButtons(); }
  }
  async start() {
    if (this.active || this.busy || this.starting) return;
    this.starting = true; this.updateButtons();
    try {
      if (navigator.locks) {
        const locked = await new Promise((resolve, reject) => {
          navigator.locks.request('neuroflux-capture', { ifAvailable: true }, lock => {
            if (!lock) { resolve(false); return; }
            return new Promise(release => { this.releaseRecordingLock = release; resolve(true); });
          }).catch(reject);
        });
        if (!locked) throw new Error('Another Neuroflux tab is recording. Stop it before starting another take.');
      }
      await this.beginCapture();
    } finally {
      this.starting = false;
      if (!this.active) { this.releaseRecordingLock?.(); this.releaseRecordingLock = null; }
      this.updateButtons();
    }
  }
  async beginCapture() {
    if (this.active || this.busy) return;
    if (this.exporting) throw new Error('Finish or cancel the export before recording.');
    if (!this.storageReady) throw new Error('Recording storage is not ready.');
    // Resume audio inside this user gesture before countdown or capability awaits.
    await this.mixer.init();
    if (this.settings.kind !== 'audio' && !await this.testOutputs()) return;
    this.busy = true; this.render();
    try {
      this.cancelStart = false;
      for (const output of this.selectedOutputs()) output.profile.sourceAspect = innerWidth / innerHeight;
      const session = new CaptureSession(this.store, this.mixer, error => {
        this.message(`Recording interrupted: ${error.message}. Saving available chunks.`);
        if (session.started) this.stop();
      });
      this.session = session; this.updateButtons();
      await session.prepare(this.settings.kind === 'audio' ? [] : this.selectedOutputs(), { ...this.settings });
      await this.wake();
      const countdown = $('#nfxStudioCountdown');
      for (let i = this.settings.countdown; i > 0; i--) {
        countdown.hidden = false; countdown.textContent = String(i); await sleep(1000);
        if (this.cancelStart) throw new Error('Countdown canceled. No recording was saved.');
      }
      countdown.hidden = true;
      for (const output of this.selectedOutputs()) {
        const blob = await new Promise(resolve => output.canvas.toBlob(resolve, 'image/jpeg', .65));
        const asset = session.recorders.find(r => r.asset.profile?.id === output.profile.id)?.asset;
        if (blob && asset) asset.thumbnail = blob;
      }
      session.start(); this.busy = false; this.wasHidden = false; this.render();
      this.message('Recording on this device. You can close Studio and adjust the rig.');
    } catch (error) {
      $('#nfxStudioCountdown').hidden = true;
      if (this.session?.started) await this.session.stop(); else await this.session?.abort();
      this.session = null; this.busy = false; await this.releaseWake(); this.render(); throw error;
    }
  }
  async stop() {
    const session = this.session;
    if (session?.status === 'preparing') { this.cancelStart = true; this.message('Canceling countdown…'); return; }
    if (!session || this.busy || session.status === 'saving') return;
    this.busy = true; this.updateButtons(); this.message('Saving recording data to this device…');
    try {
      const assets = await session.stop();
      this.message(`${assets.length} file${assets.length === 1 ? '' : 's'} saved.${session.error ? ` Interrupted: ${session.error.message}` : ''} Open Library to play, finish, or share.`);
    } catch (error) { this.message(`Could not finalize every file: ${error.message}. Check Library for saved chunks.`); }
    finally {
      this.session = null; this.busy = false; this.releaseRecordingLock?.(); this.releaseRecordingLock = null;
      await this.releaseWake(); await this.updateStorage(); if (this.opened) this.render(); this.updateButtons();
    }
  }
  async wake() {
    try { if (!this.wakeLock && navigator.wakeLock && !document.hidden) { this.wakeLock = await navigator.wakeLock.request('screen'); this.wakeLock.addEventListener('release', () => this.wakeLock = null); } } catch {}
  }
  async releaseWake() { try { await this.wakeLock?.release(); } catch {} this.wakeLock = null; }
  async updateStorage() {
    const space = await this.store.space();
    this.storageText = space.free === Infinity ? 'Device storage estimate unavailable.' : `${formatBytes(space.free)} available in browser storage. Estimates are approximate.`;
    const info = $('#nfxStorageInfo'); if (info) info.textContent = this.storageText;
    if (this.session && space.free < 32 * 1024 * 1024) {
      this.message('Device storage is nearly full. Finalizing the recording now.'); await this.stop();
    }
    return space;
  }
  updateButtons() {
    const recording = this.session && ['recording','paused'].includes(this.session.status);
    $('#nfxStudioBar [data-action=pause]').hidden = !recording;
    $('#nfxStudioBar [data-action=stop]').hidden = !recording && this.session?.status !== 'preparing';
    $('#nfxStudioBar [data-action=pause]').textContent = this.session?.status === 'paused' ? '▶' : 'Ⅱ';
    $('#nfxStudioBar [data-action=open]').classList.toggle('nfx-recording', !!recording);
    this.body.querySelectorAll('[data-action=start],[data-action=test]').forEach(el => el.disabled = this.active || this.busy || this.starting || this.exporting || !this.storageReady);
  }
  frame(now) {
    this.mixer.sync();
    const recording = this.session && ['recording','paused','preparing'].includes(this.session.status);
    const needed = new Set();
    if (this.testing || (recording && this.settings.kind !== 'audio')) this.selectedOutputs().forEach(o => needed.add(o));
    if (this.opened && ['record','output'].includes(this.tab)) needed.add(this.outputs[this.current]);
    try {
      for (const output of needed) {
        validateProfile(output.profile);
        if (output.render(now)) {
          const index = this.outputs.indexOf(output);
          if (this.testing) this.testFrames[this.selectedOutputs().indexOf(output)]?.push(now);
          this.samples[index].push(now); while (this.samples[index][0] < now - 2000) this.samples[index].shift();
        }
      }
      this.preview();
    } catch (error) {
      this.message(`Output error: ${error.message}`);
      if (recording && this.session?.started) { this.session.error = error; this.stop(); }
    }
    if (now - this.lastUi < 200) return;
    this.lastUi = now;
    const session = this.session;
    const bytes = session?.recorders.reduce((n,r) => n + (r.asset?.bytes || 0), 0) || 0;
    $('#nfxStudioTime').textContent = session?.started ? `${session.status === 'paused' ? 'Ⅱ ' : '● '}${formatTime(session.seconds)} · ${formatBytes(bytes)}` : this.busy ? 'TESTING' : 'LOCAL';
    for (const [name, peak] of Object.entries(this.mixer.levels())) {
      const meter = this.body.querySelector(`[data-meter=${name}]`);
      if (meter) { meter.firstChild.style.width = `${Math.min(100, peak * 100)}%`; meter.classList.toggle('nfx-clip', peak >= .98); }
    }
    if (session?.status === 'recording' && session.settings.limit && session.seconds >= session.settings.limit) this.stop();
    if (now - (this.storageAt || 0) > 5000 && this.storageReady) { this.storageAt = now; this.updateStorage().catch(error => this.message(error.message)); }
    if (session?.status === 'recording' && now - (this.performanceAt || now) > 4000) {
      const slow = this.settings.kind !== 'audio' && this.selectedOutputs().some(o => this.samples[this.outputs.indexOf(o)].length / 2 < o.profile.fps * .65);
      if (slow) this.message('Recording is running below the selected frame rate. Quality has not been changed. Consider stopping and choosing a lighter output.');
      this.performanceAt = now;
    }
    this.performanceAt ||= now;
  }
  preview() {
    const preview = $('#nfxStudioPreview'); if (!preview || !this.opened) return;
    const output = this.outputs[this.current], p = output.profile, size = dimensions(p);
    const scale = Math.min(440 / size.width, 250 / size.height);
    const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
    if (preview.width !== width || preview.height !== height) { preview.width = width; preview.height = height; }
    preview.getContext('2d').drawImage(output.canvas, 0, 0, width, height);
    const guide = this.body.querySelector('.nfx-guide');
    if (guide) {
      guide.hidden = !p.guide;
      const vertical = ['tiktok','reels','shorts'].includes(p.preset);
      const story = p.preset === 'stories';
      guide.style.width = `${width * (vertical ? .72 : .84)}px`;
      guide.style.height = `${height * (vertical ? .64 : story ? .72 : .84)}px`;
      guide.style.transform = vertical ? `translate(${-width * .04}px,${-height * .035}px)` : '';
    }
    const info = $('#nfxOutputInfo');
    if (info) info.textContent = `${size.width} × ${size.height} · ${p.fps} fps · ${p.mode.toUpperCase()} · ${p.audio === 'silent' ? 'SILENT' : p.audio.toUpperCase()}${this.current && !this.settings.dual ? ' · B is preview only until dual recording is enabled' : ''}`;
  }
  async snapshot() {
    const output = this.outputs[this.current]; validateProfile(output.profile);
    const blob = await new Promise(resolve => output.canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Snapshot could not be created.');
    const asset = await this.store.saveBlob(blob, { name: `Neuroflux snapshot ${new Date().toLocaleString()}`, kind: 'image', ...dimensions(output.profile), profile: structuredClone(output.profile) });
    this.download(blob, `${asset.name}.png`); this.message('PNG snapshot saved in Library and downloaded. Safe-area guides are excluded.');
  }
  async libraryView() {
    if (!this.storageReady) { this.body.innerHTML = '<p>Device storage is unavailable.</p>'; return; }
    if (this.selectedAsset) return this.showAsset(this.selectedAsset);
    const assets = await this.store.list();
    if (this.tab !== 'library') return;
    this.body.innerHTML = `<p>Saved on this device only. Download important takes. Deleting one companion does not delete the other files.</p><div class="nfx-assets">${assets.length ? '' : '<p>No recordings yet. Your first take starts in Record.</p>'}${assets.map(asset => {
      let image = ''; if (asset.thumbnail) { const url = URL.createObjectURL(asset.thumbnail); this.assetUrls.push(url); image = `<img src="${url}" alt="">`; }
      return `<button class="nfx-asset" data-asset="${asset.id}" ${asset.status === 'recording' ? 'disabled' : ''}>${image}<span>${escape(asset.name)}<small>${asset.kind.toUpperCase()} · ${formatTime(asset.duration)} · ${formatBytes(asset.bytes)}${asset.width ? ` · ${asset.width}×${asset.height}` : ''}${asset.status !== 'complete' ? ` · ${asset.status.toUpperCase()}` : ''}</small></span></button>`;
    }).join('')}</div>`;
  }
  clearUrls() {
    const player = $('#nfxAssetPlayer'); if (player?.pause) { player.pause(); player.removeAttribute('src'); player.load(); }
    for (const url of this.assetUrls) URL.revokeObjectURL(url); this.assetUrls = [];
  }
  async showAsset(id) {
    const asset = await this.store.get(id); if (!asset) { this.selectedAsset = null; return this.libraryView(); }
    this.selectedAsset = id; this.clearUrls();
    const blob = await this.store.blob(asset); if (this.selectedAsset !== id || this.tab !== 'library') return;
    const url = URL.createObjectURL(blob); this.assetUrls.push(url); this.selectedBlob = blob;
    const groupAssets = asset.group ? (await this.store.list()).filter(a => a.group === asset.group && a.pcm && ['music','mic'].includes(a.source)) : [];
    this.body.innerHTML = `<button data-action="back">← LIBRARY</button>
      ${asset.kind === 'image' ? `<img src="${url}" alt="Saved snapshot" style="width:100%;margin-top:12px">` : `<${asset.kind === 'audio' ? 'audio' : 'video'} id="nfxAssetPlayer" src="${url}" controls playsinline preload="metadata"></${asset.kind === 'audio' ? 'audio' : 'video'}>`}
      <label>Recording name<input type="text" id="nfxAssetName" maxlength="120" value="${escape(asset.name)}"></label>
      <div class="nfx-row"><button data-action="rename">RENAME</button><button data-action="download">DOWNLOAD ORIGINAL</button><button data-action="share">SHARE FILE</button></div>
      <p>${formatTime(asset.duration)} · ${formatBytes(blob.size)} · ${escape(asset.mime)}${asset.width ? ` · ${asset.width}×${asset.height}` : ''}</p>
      ${asset.status !== 'complete' ? `<p class="nfx-alert">${escape(asset.warning || 'Interrupted take. Saved chunks may be incomplete or unplayable. Download the original before trying to finish it.')}</p>` : ''}
      ${asset.markers?.length ? `<div class="nfx-row">${asset.markers.map(marker => `<button data-seek="${marker.time}">${escape(marker.label)} · ${formatTime(marker.time)}</button>`).join('')}</div>` : ''}
      ${asset.kind === 'video' ? '<button data-action="thumbnail">USE CURRENT FRAME AS THUMBNAIL</button>' : ''}
      ${asset.thumbnail ? '<button data-action="downloadCover">DOWNLOAD COVER IMAGE</button>' : ''}
      ${asset.kind !== 'image' ? `<h3>FINISH & EXPORT</h3><p>The original stays unchanged. Trimming and codec conversion run locally. Large jobs may exceed device limits.</p>
      <div class="nfx-row"><label>Start · seconds<input id="nfxTrimStart" type="number" min="0" step="0.1" value="0"></label><label>End · seconds<input id="nfxTrimEnd" type="number" min="0" step="0.1" value="${Math.max(.1,asset.duration || 0).toFixed(1)}"></label></div>
      <label>Export format<select id="nfxExportFormat">${asset.kind === 'video' ? '<option value="mp4">MP4 · H.264 + AAC</option><option value="silent">MP4 · silent video</option>' : ''}<option value="wav">WAV · audio only</option></select></label>
      ${asset.kind === 'video' ? `<label>Export framing<select id="nfxExportPreset"><option value="original">Keep recorded dimensions</option>${Object.entries(PRESETS).filter(([key]) => key !== 'custom').map(([key,p]) => `<option value="${key}">${p.name}</option>`).join('')}</select></label>
      <label>Resize method<select id="nfxExportFit"><option value="fit">Fit · preserve complete picture</option><option value="crop">Fill · crop edges</option></select></label>` : ''}
      <label>Audio level<input id="nfxExportVolume" type="number" min="0" max="2" step="0.1" value="1"></label>
      ${groupAssets.length ? `<label class="nfx-check"><input id="nfxRemix" type="checkbox">Remix available companion sources instead of recorded audio</label>
      <div class="nfx-row"><label>Music level<input id="nfxRemixMusic" type="number" min="0" max="2" step=".1" value="1"></label><label>Microphone level<input id="nfxRemixMic" type="number" min="0" max="2" step=".1" value="1"></label></div>
      <label>Microphone offset · seconds<input id="nfxRemixOffset" type="number" min="-.5" max=".5" step=".01" value="0"></label>` : '<p>No isolated sources are available for remixing this take. Audio levels affect the existing mix.</p>'}
      <button data-action="export" class="nfx-primary" ${this.exporting || this.active ? 'disabled' : ''}>CREATE NEW EXPORT</button>
      <button data-action="cancelExport" ${!this.exporting ? 'hidden' : ''}>CANCEL EXPORT</button><progress id="nfxExportProgress" max="1" value="0" ${!this.exporting ? 'hidden' : ''}></progress>
      <p>Burned-in menus and captions cannot be removed afterward. Alternate framing crops or pads the saved picture.</p>` : ''}
      <h3>SHARE TO AN APP</h3><p>Use Share File to choose Instagram, TikTok, YouTube, or another app offered by your device. Otherwise download and upload manually: Reels/Stories for Instagram, Create/Upload for TikTok, and Create → Upload video for YouTube. Installed apps decide whether they accept the file.</p>
      <button data-action="delete" class="nfx-danger">DELETE FROM THIS DEVICE</button>`;
  }
  extension(asset) { return asset.mime.includes('mp4') ? 'mp4' : asset.mime.includes('wav') ? 'wav' : asset.mime.includes('png') ? 'png' : 'webm'; }
  download(blob, name) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name.replace(/[\\/:*?"<>|]/g, '-'); anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async downloadAsset() {
    const asset = await this.store.get(this.selectedAsset); this.download(this.selectedBlob || await this.store.blob(asset), `${asset.name}.${this.extension(asset)}`);
  }
  async shareAsset() {
    const asset = await this.store.get(this.selectedAsset), blob = this.selectedBlob;
    const file = new File([blob], `${asset.name.replace(/[\\/:*?"<>|]/g, '-')}.${this.extension(asset)}`, { type: asset.mime });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: asset.name }); this.message('File handed to the device share sheet.'); }
      catch (error) { if (error.name !== 'AbortError') throw error; }
    } else { await this.downloadAsset(); this.message('File sharing is unavailable here. The recording was downloaded; upload it through your chosen app.'); }
  }
  async thumbnail() {
    const video = $('#nfxAssetPlayer'); if (!video || video.readyState < 2) throw new Error('Play or seek the video before choosing a thumbnail.');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = Math.round(320 * video.videoHeight / video.videoWidth);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
    const asset = await this.store.get(this.selectedAsset); asset.thumbnail = blob; asset.thumbnailTime = video.currentTime;
    await this.store.put(asset); this.message('Thumbnail saved. It appears in Library; platform uploads may require choosing their own cover.');
  }
  async exportAsset() {
    if (this.exporting || this.active) throw new Error('Finish the current recording or export first.');
    const asset = await this.store.get(this.selectedAsset), blob = this.selectedBlob;
    const value = (id, fallback) => $(id) ? Number($(id).value) : fallback;
    const start = value('#nfxTrimStart', 0), end = value('#nfxTrimEnd', asset.duration), volume = value('#nfxExportVolume', 1);
    if (![start,end,volume].every(Number.isFinite) || start < 0 || end <= start || end > asset.duration + .15 || volume < 0 || volume > 2)
      throw new Error('Choose valid trim times within this take and an audio level from 0 to 2.');
    const preset = PRESETS[$('#nfxExportPreset')?.value], format = $('#nfxExportFormat').value;
    const musicGain = value('#nfxRemixMusic',1), micGain = value('#nfxRemixMic',1), micOffset = value('#nfxRemixOffset',0);
    if (![musicGain,micGain].every(n => Number.isFinite(n) && n >= 0 && n <= 2) || !Number.isFinite(micOffset) || Math.abs(micOffset) > .5)
      throw new Error('Choose source levels from 0 to 2 and an offset between -0.5 and 0.5 seconds.');
    const job = { start, end, duration: asset.duration, volume, format,
      width: preset?.width || asset.width, height: preset?.height || asset.height,
      fit: $('#nfxExportFit')?.value || 'fit', remix: !!$('#nfxRemix')?.checked,
      musicGain, micGain, micOffset, memoryLimit: (matchMedia('(pointer:coarse)').matches ? 64 : 256) * 1024 * 1024 };
    const stems = [];
    if (job.remix) for (const stem of (await this.store.list()).filter(a => a.group === asset.group && a.pcm && ['music','mic'].includes(a.source)))
      stems.push({ source: stem.source, sampleRate: stem.sampleRate, blob: await this.store.blob(stem) });
    if (blob.size + stems.reduce((n,s) => n + s.blob.size, 0) > job.memoryLimit) throw new Error('This export exceeds the device memory safety limit. Keep the original or make a shorter take.');
    const space = await this.store.space(); if (space.free < Math.max(32 * 1024 * 1024, blob.size * 2)) throw new Error('Not enough device storage for another export. Download the original and free space.');
    this.exporting = true; const sourceId = asset.id;
    const worker = this.exportWorker = new Worker('/export.worker.js', { type: 'module' });
    this.body.querySelector('[data-action=export]').disabled = true;
    this.body.querySelector('[data-action=cancelExport]').hidden = false; $('#nfxExportProgress').hidden = false;
    this.message('Creating a new local export. Keep this tab open. The original is unchanged.');
    const finish = () => { worker.terminate(); if (this.exportWorker === worker) this.exportWorker = null; this.exporting = false; };
    worker.onerror = () => { finish(); this.message('The export worker failed. Your original is still saved. Try a shorter take.'); if (this.selectedAsset) this.showAsset(this.selectedAsset); };
    worker.onmessage = async ({ data }) => {
      if (data.type === 'progress') {
        const progress = $('#nfxExportProgress'); if (progress) progress.value = data.progress;
        if (data.message) this.message(data.message);
      }
      if (data.type === 'error') { finish(); this.message(data.message); if (this.selectedAsset) this.showAsset(this.selectedAsset); }
      if (data.type === 'complete') {
        try {
          const derived = await this.store.saveBlob(data.blob, { name: `${asset.name} · export`, kind: format === 'wav' ? 'audio' : 'video',
            derivedFrom: sourceId, duration: end - start, width: format === 'wav' ? undefined : job.width,
            height: format === 'wav' ? undefined : job.height, thumbnail: asset.thumbnail });
          finish(); this.message('New export saved. Download it or share the file.');
          if (this.tab === 'library') await this.showAsset(derived.id);
        } catch (error) { finish(); this.message(`Export finished but could not be saved: ${error.message}. The original is unchanged.`); }
      }
    };
    worker.postMessage({ blob, job, stems });
  }
}

const rig = window.NFXRig;
if (rig) {
  const studio = new RecordingStudio(rig);
  window.NFXStudio = studio;
  studio.init();
}
