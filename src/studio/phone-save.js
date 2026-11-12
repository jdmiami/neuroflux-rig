// Keep file preparation outside the tap handler: mobile sharing needs a fresh
// user gesture, which can be lost if we read IndexedDB before navigator.share.
export function recordingFile(asset, blob) {
  const mime = asset.mime || blob.type;
  const extension = mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : mime.includes('png') ? 'png' : 'webm';
  return new File([blob], `${asset.name.replace(/[\\/:*?"<>|]/g, '-')}.${extension}`, { type: mime });
}

export class PhoneSave {
  constructor(studio) {
    this.studio = studio; this.generation = 0; this.entries = [];
    this.card = document.createElement('section');
    this.card.id = 'nfxPhoneSave'; this.card.hidden = true;
    this.card.setAttribute('aria-label', 'Save your take');
    this.card.innerHTML = `<button class="nfx-phone-dismiss" aria-label="Dismiss save card">×</button>
      <strong>Take ready</strong><p class="nfx-phone-status" role="status" aria-live="polite"></p>
      <label hidden>File<select aria-label="Recording to save"></select></label>
      <div class="nfx-phone-actions"><button data-phone-save>Save to phone</button><button data-phone-download>Download</button></div>
      <small>Backup kept in Recording → Library.</small>`;
    document.body.append(this.card);
    this.status = this.card.querySelector('p'); this.select = this.card.querySelector('select');
    this.saveButton = this.card.querySelector('[data-phone-save]');
    this.card.querySelector('.nfx-phone-dismiss').onclick = () => this.suspend();
    this.saveButton.onclick = () => { void this.share(); };
    this.card.querySelector('[data-phone-download]').onclick = () => {
      const entry = this.selected(); if (!entry) return;
      this.studio.download(entry.file, entry.file.name);
      this.status.textContent = 'Download requested. Check Files or Downloads; this does not automatically add it to Photos.';
    };
    this.select.onchange = () => this.paint();
  }
  suspend() {
    this.generation++; this.entries = []; this.card.hidden = true;
    this.select.replaceChildren();
  }
  selected() { return this.entries[Number(this.select.value) || 0]; }
  canShare(file) {
    try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }); }
    catch { return false; }
  }
  hint(file) {
    if (!this.canShare(file)) return 'File sharing is unavailable for this recording here. Download it instead, or try a compatible MP4 export from Library.';
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const action = file.type.startsWith('image/') ? 'Save Image' : file.type.startsWith('audio/') ? 'Save to Files' : 'Save Video';
    return ios ? `Choose ${action} in the phone’s share sheet. If missing, use Save to Files${file.type.startsWith('video/') ? ' or export a compatible MP4 in Library' : ''}.`
      : 'Choose Photos or Gallery if offered in the phone’s share sheet. Available destinations depend on your phone and installed apps.';
  }
  paint() {
    const entry = this.selected(); if (!entry) return;
    this.card.querySelector('label').hidden = this.entries.length < 2;
    this.saveButton.hidden = !this.canShare(entry.file);
    this.saveButton.disabled = false;
    this.status.textContent = this.hint(entry.file);
    this.card.hidden = false;
  }
  async offer(assets, { automatic = true } = {}) {
    this.suspend(); const generation = this.generation;
    // Video takes offer their outputs; companion stems remain in Library.
    const videos = assets.filter(asset => asset.kind === 'video');
    const targets = videos.length ? videos : assets;
    const results = await Promise.allSettled(targets.map(async asset => ({ asset, file: recordingFile(asset, await this.studio.store.blob(asset)) })));
    if (generation !== this.generation || this.studio.active || this.studio.starting) return;
    this.entries = results.filter(result => result.status === 'fulfilled' && result.value.file.size).map(result => result.value);
    if (!this.entries.length) {
      if (targets.length) this.studio.message('Take kept in Recording → Library. Open it there to save or share.');
      return;
    }
    this.select.replaceChildren(...this.entries.map((entry, index) => new Option(entry.asset.name, String(index))));
    this.paint();
    // Async recorder finalization usually consumes the activation. Never loop
    // or auto-retry on return from an OS sheet; the visible button is the retry.
    if (automatic && !document.hidden && navigator.userActivation?.isActive && this.canShare(this.selected().file)) void this.share();
  }
  async share() {
    const entry = this.selected();
    if (!entry || this.saveButton.disabled || !this.canShare(entry.file)) return;
    const generation = this.generation; this.saveButton.disabled = true;
    try {
      await navigator.share({ files: [entry.file], title: entry.asset.name });
      if (generation === this.generation) this.status.textContent = 'Share sheet completed. Check the destination you chose; your Library backup is still here.';
    } catch (error) {
      if (generation === this.generation) this.status.textContent = error.name === 'AbortError'
        ? 'Share sheet closed. Your take is safe in Library. Tap Save to phone to try again.'
        : 'The phone could not open this file’s share sheet. Tap Save to phone again, or Download. For format issues, export MP4 in Library.';
    } finally { if (generation === this.generation) this.saveButton.disabled = false; }
  }
}
