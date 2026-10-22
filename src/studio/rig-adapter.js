// Inserted inside the rig closure by the build. Never exposes keys or AI state.
const studioTargets = new Map();
window.NFXRig = {
  ready: () => T && !!v,
  audio() {
    V();
    return { context: F.ctx, music: F.program, live: F.micGain, kind: G, stream: re.stream };
  },
  state() {
    const sheet = Lt.getBoundingClientRect();
    const visible = Array.from(Dt[Ct]?.querySelectorAll('[data-id]') || []).filter(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > sheet.top && r.top < sheet.bottom;
    }).map(node => node.dataset.id);
    const ids = Array.from(new Set(visible));
    const controls = ids.length && Nt.open ? ids.map(id => Ue[id]).filter(Boolean)
      : Ct === 'quick' ? ze.map(id => Ue[id]).filter(Boolean) : De.filter(p => p.page === Ct);
    return {
      scene: xe[Be.mode][0], palette: Me[Be.pal], bpm: U.bpm,
      bass: U.bass, mid: U.mid, high: U.high, level: U.level,
      source: G, tab: Ct, menuOpen: Nt.open, hands: To.on ? To.hands : [],
      lyrics: document.getElementById('lyr').innerText,
      controls: controls.filter(p => !['xy', 'xy2', 'pads'].includes(p.type))
        .map(p => ({ id: p.id, label: p.label, value: Be[p.id], min: p.min, max: p.max,
          text: p.fmt ? p.fmt(Be[p.id]) : String(Be[p.id]) })),
      tabs: Le.map(p => ({ id: p.id, label: p.n })),
    };
  },
  selectSource: nn,
  setParam: nt,
  monitor(volume) { if (F.master) F.master.gain.setTargetAtTime(volume, F.ctx.currentTime, 0.01); },
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
