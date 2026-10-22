// Inserted inside the rig closure by the build. Never exposes keys or AI state.
const studioTargets = new Map();
let studioPerformanceTab = 'quick';
// Keep recovery in the native system menu, accessible without a floating toolbar.
const appUpdateCard = Ut(Dt.sys, '<span>APP UPDATES</span>',
  '<p class="mstat">Get the latest Neuroflux while keeping saved recordings and settings.</p><button class="sbtn act" id="btnAppUpdate">LOAD LATEST VERSION</button>');
appUpdateCard.querySelector('button').addEventListener('click', () => {
  const studio = window.NFXStudio;
  if (studio && (studio.active || studio.starting || studio.exporting || studio.busy)) {
    st('APP UPDATE', 'FINISH CURRENT TASK'); return;
  }
  location.assign('/update.html');
});
window.NFXRig = {
  ready: () => T && !!v,
  audio() {
    V();
    return { context: F.ctx, music: F.program, live: F.micGain, kind: G, stream: re.stream };
  },
  state() {
    if (Ct !== 'recording') studioPerformanceTab = Ct;
    const tab = Ct === 'recording' ? studioPerformanceTab : Ct;
    const sheet = Lt.getBoundingClientRect();
    const visible = Array.from(Dt[tab]?.querySelectorAll('[data-id]') || []).filter(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > sheet.top && r.top < sheet.bottom;
    }).map(node => node.dataset.id);
    const ids = Array.from(new Set(visible));
    const controls = ids.length && Nt.open ? ids.map(id => Ue[id]).filter(Boolean)
      : tab === 'quick' ? ze.map(id => Ue[id]).filter(Boolean) : De.filter(p => p.page === tab);
    return {
      scene: xe[Be.mode][0], palette: Me[Be.pal], bpm: U.bpm,
      bass: U.bass, mid: U.mid, high: U.high, level: U.level,
      source: G, tab, menuOpen: Nt.open, hands: To.on ? To.hands : [],
      lyrics: document.getElementById('lyr').innerText,
      controls: controls.filter(p => !['xy', 'xy2', 'pads'].includes(p.type))
        .map(p => ({ id: p.id, label: p.label, value: Be[p.id], min: p.min, max: p.max,
          text: p.fmt ? p.fmt(Be[p.id]) : String(Be[p.id]) })),
      tabs: Le.filter(p => p.id !== 'recording').map(p => ({ id: p.id, label: p.n })),
    };
  },
  selectSource: nn,
  setParam: nt,
  monitor(volume) { if (F.master) F.master.gain.setTargetAtTime(volume, F.ctx.currentTime, 0.01); },
  mountRecording(panel, onVisibility) {
    const entry = { id: 'recording', n: 'RECORD', c: '#45f0ff', d: 'Recording · framing · audio · saved takes' };
    Le.splice(1, 0, entry);
    const button = document.createElement('button');
    button.className = 'rt'; button.dataset.p = 'recording';
    button.style.setProperty('--tc', entry.c); button.setAttribute('aria-label', 'Recording menu');
    button.innerHTML = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg><span>RECORD</span>';
    button.addEventListener('click', () => jt('recording'));
    At.insertBefore(button, At.querySelectorAll('.rt')[1] || null);
    panel.classList.add('page'); panel.hidden = false;
    panel.style.setProperty('--acc', entry.c); Dt.recording = panel;
    It.appendChild(panel);
    const sync = () => onVisibility(Nt.open && Ct === 'recording');
    const observer = new MutationObserver(sync);
    observer.observe(Lt, { attributes: true, attributeFilter: ['aria-hidden', 'class'] });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    sync();
  },
  openRecording() { if (document.body.classList.contains('clean')) $n(); jt('recording'); },
  closeRecording() { if (Ct === 'recording') Kt(); },
  render(id, width, height) {
    if (!T || !M || !v) throw new Error('WebGL visual engine is unavailable.');
    let target = studioTargets.get(id);
    if (!target || target.width !== width || target.height !== height) {
      this.release(id);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      target = { width, height, scene: D(width, height, false),
        trails: [D(width, height, true), D(width, height, true)], index: 0,
        canvas, context: canvas.getContext('2d', { alpha: false }) };
      if (!target.scene.ok || target.trails.some(t => !t.ok)) {
        P(target.scene); target.trails.forEach(P);
        throw new Error('Not enough GPU memory for this output size. Choose a smaller preset.');
      }
      studioTargets.set(id, target);
    }
    const saved = { M, w, S, L, A };
    const scene = { ...Hn.scene }, post = { ...Hn.post }, aspect = width / height;
    // Menu avoidance is for the operator screen only; output stays centered.
    scene.uCenter = [Be.ox + Xn.tilt[0] * Be.tiltOrigin * 1.4,
      Be.oy - Xn.tilt[1] * Be.tiltOrigin * 1.4];
    const cameraAspect = (Qn.vw || 4) / (Qn.vh || 3);
    scene.uCamScale = post.uCamScale = aspect > cameraAspect
      ? [1, cameraAspect / aspect] : [aspect / cameraAspect, 1];
    let pts = Hn.pts;
    if (pts) {
      pts = { ...pts, common: { ...pts.common, uNdcS: [2 / aspect, 2] } };
      for (const key of ['cloud', 'splat']) if (pts[key]) {
        const mvp = Array.from(pts[key].uMVP);
        for (const n of [0, 4, 8, 12]) mvp[n] *= (saved.L / saved.A) / aspect;
        // Remove the operator menu-avoidance translation from the projection.
        const translation = [qn.x / (saved.L / saved.A), qn.y];
        for (let c = 0; c < 4; c++) {
          mvp[c * 4] -= translation[0] * mvp[c * 4 + 3] * (saved.L / saved.A) / aspect;
          mvp[c * 4 + 1] -= translation[1] * mvp[c * 4 + 3];
        }
        pts[key] = { ...pts[key], uMVP: mvp };
        if (key === 'cloud') {
          pts[key].uAspect = aspect; pts[key].uCamScale = scene.uCamScale;
          pts[key].uPx *= height / saved.A;
        } else pts[key].uPxS *= height / saved.A;
      }
    }
    try {
      M = target.scene; w = target.trails; S = target.index; L = width; A = height;
      // Grow the shared drawing buffer once, not twice per output per frame.
      // Each target renders into its own viewport; the operator pass fills the buffer.
      const bufferWidth = Math.max(f.width, saved.L, width), bufferHeight = Math.max(f.height, saved.A, height);
      if (f.width !== bufferWidth || f.height !== bufferHeight) { f.width = bufferWidth; f.height = bufferHeight; }
      renderRig({ scene, post, fb: Hn.fb, pts, studio: true, camFrame: Hn.camFrame, depthFrame: Hn.depthFrame });
      target.index = S;
      target.context.drawImage(f, 0, f.height - height, width, height, 0, 0, width, height);
      return target.canvas;
    } finally {
      M = saved.M; w = saved.w; S = saved.S; L = saved.L; A = saved.A;
    }
  },
  release(id) {
    const target = studioTargets.get(id);
    if (target) {
      P(target.scene); target.trails.forEach(P); studioTargets.delete(id);
      if (!studioTargets.size && (f.width !== L || f.height !== A)) { f.width = L; f.height = A; }
    }
  },
};
