import { dimensions } from './profiles.js';

export class ProgramOutput {
  constructor(rig, settings) {
    this.rig = rig; this.profile = settings; this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false }); this.last = -Infinity;
  }
  render(now, { force = false } = {}) {
    const p = this.profile;
    if (!force && now - this.last < 1000 / p.fps - 1) return false;
    this.last = now;
    const size = dimensions(p);
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) {
      this.canvas.width = size.width; this.canvas.height = size.height;
    }
    const ctx = this.ctx, width = p.width, height = p.height;
    let sourceWidth = width, sourceHeight = height;
    if (p.fit !== 'render') {
      const aspect = p.sourceAspect || innerWidth / innerHeight;
      sourceWidth = Math.max(2, 2 * Math.round(Math.sqrt(width * height * aspect) / 2));
      sourceHeight = Math.max(2, 2 * Math.round(sourceWidth / aspect / 2));
    }
    const source = this.rig.render(`studio-${p.id}`, sourceWidth, sourceHeight);
    const state = this.rig.state();
    ctx.save(); ctx.fillStyle = p.background; ctx.fillRect(0, 0, size.width, size.height);
    ctx.translate(size.width / 2, size.height / 2); ctx.rotate(p.rotation * Math.PI / 180);
    ctx.translate(-width / 2, -height / 2);
    const scale = (p.fit === 'fit' ? Math.min(width / sourceWidth, height / sourceHeight)
      : Math.max(width / sourceWidth, height / sourceHeight)) * p.zoom;
    const dw = sourceWidth * scale, dh = sourceHeight * scale;
    ctx.drawImage(source, (width - dw) / 2 + p.panX * Math.abs(width - dw) / 2,
      (height - dh) / 2 + p.panY * Math.abs(height - dh) / 2, dw, dh);
    const unit = Math.min(width, height) / 720;
    ctx.font = `600 ${22 * unit}px monospace`; ctx.textBaseline = 'top';
    if (p.mode !== 'clean') this.hud(ctx, state, width, height, unit, p);
    if (p.hands) this.hands(ctx, state, width, height, unit);
    if (p.lyrics && state.lyrics.trim()) this.text(ctx, state.lyrics.trim().slice(-180), width / 2, height * 0.73, width * 0.8, 30 * unit, true);
    if (p.title) this.text(ctx, p.title, width / 2, height * 0.13, width * 0.8, 32 * unit, true);
    if (p.branding) this.text(ctx, p.branding, width * 0.08, height * 0.9, width * 0.75, 16 * unit);
    ctx.restore(); return true;
  }
  text(ctx, text, x, y, maxWidth, fontSize, centered = false) {
    ctx.save(); ctx.font = `600 ${fontSize}px monospace`; ctx.textAlign = centered ? 'center' : 'left';
    ctx.fillStyle = '#edf8ff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    const words = text.split(/\s+/); let line = '', row = 0;
    for (const word of words) {
      if (ctx.measureText(line + word).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y + row++ * fontSize * 1.35, maxWidth); line = '';
      }
      line += word + ' ';
      if (row === 4) break;
    }
    ctx.fillText(line.trim(), x, y + row * fontSize * 1.35, maxWidth); ctx.restore();
  }
  hud(ctx, s, w, h, u, p) {
    const x = 26 * u, y = 26 * u;
    ctx.fillStyle = 'rgba(4,6,16,.78)'; ctx.fillRect(x - 12 * u, y - 12 * u, w - 28 * u, 88 * u);
    ctx.fillStyle = '#45f0ff';
    if (p.scene) ctx.fillText(s.scene, x, y, w - 200 * u);
    ctx.font = `${14 * u}px monospace`; ctx.fillStyle = '#c2d4e9';
    if (p.palette) ctx.fillText(s.palette, x, y + 34 * u);
    if (p.bpm) ctx.fillText(`${Math.round(s.bpm)} BPM`, w - 160 * u, y);
    if (p.meter) [s.bass, s.mid, s.high].forEach((v, i) => {
      ctx.fillStyle = ['#45f0ff', '#ff3dd8', '#ffb547'][i];
      ctx.fillRect(w - 160 * u + i * 42 * u, y + 58 * u - v * 32 * u, 26 * u, Math.max(2, v * 32) * u);
    });
    if (p.mode !== 'full') return;
    // The entire performance navigation stays visible; only the active panel is expanded.
    const panelW = Math.min(w * 0.55, 390 * u), panelH = Math.min(h * 0.62, 680 * u);
    const px = w - panelW - 18 * u, py = h - panelH - 72 * u;
    ctx.fillStyle = 'rgba(5,9,22,.9)'; ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#24465f'; ctx.strokeRect(px, py, panelW, panelH);
    ctx.font = `600 ${18 * u}px monospace`; ctx.fillStyle = '#45f0ff';
    ctx.fillText(`${s.tabs.find(t => t.id === s.tab)?.label || 'QUICK'} / CONTROLS`, px + 14 * u, py + 16 * u, panelW - 28 * u);
    const columns = panelW > 340 * u ? 2 : 1;
    const rows = Math.min(Math.ceil(s.controls.length / columns), Math.floor((panelH - 64 * u) / (43 * u)));
    const cellWidth = panelW / columns;
    for (let i = 0; i < Math.min(s.controls.length, rows * columns); i++) {
      const control = s.controls[i], ry = py + (55 + 43 * Math.floor(i / columns)) * u;
      const left = px + (i % columns) * cellWidth;
      ctx.font = `${12 * u}px monospace`; ctx.fillStyle = '#b7c9df';
      ctx.fillText(control.label, left + 12 * u, ry, cellWidth * 0.62);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(control.text, left + cellWidth - 12 * u, ry, cellWidth * 0.25); ctx.textAlign = 'left';
      ctx.fillStyle = '#1d2d40'; ctx.fillRect(left + 12 * u, ry + 23 * u, cellWidth - 24 * u, 4 * u);
      ctx.fillStyle = '#45f0ff'; ctx.fillRect(left + 12 * u, ry + 23 * u,
        (cellWidth - 24 * u) * Math.max(0, Math.min(1, (control.value - control.min) / (control.max - control.min || 1))), 4 * u);
    }
    const labels = s.tabs.map(t => t.label), col = Math.ceil(labels.length / 2), cell = w / col;
    ctx.fillStyle = 'rgba(4,6,16,.92)'; ctx.fillRect(0, h - 62 * u, w, 62 * u);
    labels.forEach((label, i) => {
      ctx.font = `${11 * u}px monospace`; ctx.fillStyle = s.tabs[i].id === s.tab ? '#45f0ff' : '#839ab6';
      ctx.fillText(label, (i % col) * cell + 8 * u, h - 52 * u + Math.floor(i / col) * 26 * u, cell - 12 * u);
    });
  }
  hands(ctx, s, w, h, u) {
    const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    ctx.strokeStyle = '#5dffc4'; ctx.lineWidth = 2 * u;
    for (const hand of s.hands) {
      const points = hand.pts || [];
      ctx.beginPath(); for (const [a,b] of edges) if (points[a] && points[b]) {
        ctx.moveTo(points[a].x * w, points[a].y * h); ctx.lineTo(points[b].x * w, points[b].y * h);
      } ctx.stroke();
    }
  }
  release() { this.rig.release(`studio-${this.profile.id}`); }
}
