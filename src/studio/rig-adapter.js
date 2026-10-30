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
  takeLayout() {qn.tx=qn.ty=qn.x=qn.y=0;O(mn[Be.res]);},
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
    const cameraControls=tab==='cam'&&window.NFXCameraFX?.tab==='effects'?window.NFXCameraFX.describeControls():null;
    return {
      scene: xe[Be.mode][0], palette: Me[Be.pal], bpm: U.bpm,
      bass: U.bass, mid: U.mid, high: U.high, level: U.level,
      source: G, tab, menuOpen: Nt.open, hands: To.on ? To.hands : [],
      lyrics: document.getElementById('lyr').innerText,
      controls: cameraControls||controls.filter(p => !['xy', 'xy2', 'pads'].includes(p.type))
        .map(p => ({ id: p.id, label: p.label, value: Be[p.id], min: p.min, max: p.max,
          text: p.fmt ? p.fmt(Be[p.id]) : String(Be[p.id]) })),
      tabs: Le.filter(p => p.id !== 'recording').map(p => ({ id: p.id, label: p.n })),
    };
  },
  createBYOSControl(id) {return Ue[id]?wt(Ue[id],'quick'):null;},
  mountBYOS(panel) {Dt.quick.insertBefore(panel,Dt.quick.firstChild);},
  mountPerformance(camera,motion,setups) {
    Dt.cam.insertBefore(camera,Dt.cam.firstChild);Dt.react.insertBefore(motion,Dt.react.firstChild);Dt.scenes.insertBefore(setups,Dt.scenes.firstChild);
  },
  cameraTab(tab) {for(const child of Dt.cam.children)if(child.id!=='nfxCameraWorkspace')child.hidden=tab!=='source';},
  compositionGuide(enabled) {let guide=document.getElementById('nfxGoldenGuide');if(!guide){guide=document.createElement('div');guide.id='nfxGoldenGuide';guide.setAttribute('aria-hidden','true');document.body.appendChild(guide);}guide.hidden=!enabled;},
  feedback: kind => Ke(kind),
  refreshTransport: yn,
  notify: (title,detail) => st(title,detail),
  cameraSource() {return {video:Qn.on&&Be.cam?Qn.video:null,bpm:U.bpm,level:U.level,depthKey:Be.camBlend===5,depth:oa.on?{data:oa.data,w:oa.w,h:oa.h}:null};},
  controlCatalog() {return De.map(p=>({id:p.id,min:p.type==='switch'?0:p.min,max:p.type==='switch'?1:p.max,step:p.step||(p.type==='switch'?1:0)}));},
  setupState() {return {rig:{...Be},source:G,pins:[...ze],slots:Ve.map((slot,i)=>slot?{n:'ABCD'[i],v:{...slot}}:null)};},
  applySetup(setup) {
    const blocked=new Set(['cam','motion','depth','hands','lyrics','aiDir']);
    for(const [key,value]of Object.entries(setup.rig))if(Ue[key]&&!blocked.has(key))nt(key,value,'silent');
    Ve=setup.slots.map(slot=>slot?{...slot.v}:null);ze=[...setup.pins];He.set('nfx.slots.v1',Ve);He.set('nfx.pins.v1',ze);$t();Gt();qe();
  },
  selectSource: nn,
  setParam: nt,
  guideOpen(page) {
    if (!Le.some(p => p.id === page)) throw new Error('That app page is unavailable.');
    if (document.body.classList.contains('clean')) $n();
    // A half-height phone sheet cannot fit both coaching and the real control.
    if (!qt()) Nt.snap = 'full';
    Oa(); jt(page);
  },
  mountGuide(panel) { Dt.ai.insertBefore(panel, Dt.ai.firstChild); },
  placeGuideBanner(banner) {
    const parent = Nt.open ? Lt : document.body;
    if (banner.parentElement !== parent) {
      if (Nt.open) parent.insertBefore(banner, It); else parent.appendChild(banner);
    }
    banner.classList.toggle('nfx-guide-floating', !Nt.open);
  },
  guideState() {
    const studio = window.NFXStudio;
    return {
      controls: Object.fromEntries(De.map(p => [p.id, Be[p.id]])),
      cameraFx:window.NFXCameraFX?.state, motionSettings:window.NFXMotion?.settings,
      source: G, outputs: studio?.profiles || [], recording: studio?.settings || {}, audio: studio?.mixer.settings || {},
      capture: studio?.exporting ? 'exporting' : studio?.session?.status || 'idle',
      ui: { page: Ct, menuOpen: Nt.open },
      capabilities: { camera: !!navigator.mediaDevices?.getUserMedia, microphone: !!navigator.mediaDevices?.getUserMedia,
        systemAudio: !Ae && !!navigator.mediaDevices?.getDisplayMedia, recorder: !!window.MediaRecorder && !!HTMLCanvasElement.prototype.captureStream,
        secure: isSecureContext, mobile: Ae, webgl: T, audioWorklet: !!F.ctx?.audioWorklet, storage: !!studio?.storageReady },
      services: { camera: !!(Qn.on && Qn.video?.readyState >= 2), hands: !!To.on, depth: !!oa.on, motion: !!Xn.on, lyrics: !!Ro.on,
        extraMic: !!studio?.mixer.ownedMic || (G === 'mic' && !!re.stream),
        outputTestPassed: !!studio?.outputTests.get(studio.testKey()) },
    };
  },
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
      releaseRigVisual(target.scene); P(target.scene); target.trails.forEach(P); studioTargets.delete(id);
      if (!studioTargets.size && (f.width !== L || f.height !== A)) { f.width = L; f.height = A; }
    }
  },
};
