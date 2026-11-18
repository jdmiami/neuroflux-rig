import {mountToolAperture} from './tool-aperture.js';

const groups = [
  {name: 'Create', color: '#f6c68a', tools: [
    ['Quick controls', 'quick', 'pins favorites randomize'],
    ['Scenes & looks', 'scenes', 'engines presets memory banks'],
    ['Form', 'form', 'shape geometry symmetry'],
    ['Color', 'color', 'palette brightness contrast saturation'],
    ['Motion', 'motion', 'pace spin drift silence stop'],
    ['Visual effects', 'fx', 'feedback trails glow lens']
  ]},
  {name: 'Camera & 3D', color: '#8defd6', tools: [
    ['Camera source & mix', 'cam:source', 'selfie front rear blend camera mix'],
    ['Camera effects', 'cam:effects', 'camera fx mirror kaleidoscope fisheye swirl tunnel puzzle filters'],
    ['Camera looks', 'cam:looks', 'camera presets'],
    ['3D & depth', 'd3', 'point cloud splat import scan']
  ]},
  {name: 'Perform', color: '#aed1ff', tools: [
    ['Sound input', 'input', 'audio mic device music'],
    ['Sound response', 'react', 'beat bass bpm level'],
    ['Touch & sensors', 'sense', 'tilt gyro gestures shake'],
    ['Live layers', 'layers', '3d stack blend opacity reorder']
  ]},
  {name: 'Record', color: '#ff9c96', tools: [
    ['Recording controls', 'recording:record', 'video countdown start stop'],
    ['Output framing', 'recording:output', 'portrait landscape fps resolution titles'],
    ['Recording audio', 'recording:audio', 'microphone music mix stems'],
    ['Library', 'recording:library', 'saved takes export trim remux mp4 share']
  ]},
  {name: 'Assist', color: '#d6b6ff', tools: [
    ['AI tools', 'ai', 'prompt director hands lyrics walkthrough guide']
  ]},
  {name: 'Studio', color: '#dcdfbd', tools: [
    ['Setups & custom studio', 'quick', 'save load import download byos build your own studio'],
    ['System', 'sys', 'performance resolution offline updates settings']
  ]}
];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function mountStudioTools(workspace) {
  const trigger = document.getElementById('btnMenu');
  const dock = document.getElementById('dock');
  const panel = document.createElement('dialog');
  panel.id = 'nfxStudioTools';
  panel.setAttribute('aria-labelledby', 'nfxToolsTitle');
  panel.innerHTML = `
    <header class="nfx-tools-header">
      <h2 id="nfxToolsTitle">Tools</h2>
      <button type="button" data-tools-find aria-expanded="false" aria-controls="nfxToolsSearch">Find a tool</button>
      <button type="button" data-tools-stock>Stock UI</button>
      <button type="button" data-tools-close aria-label="Close tools">×</button>
    </header>
    <div class="nfx-aperture" role="group" aria-label="Tool groups">
      <canvas aria-hidden="true"></canvas>
      <div class="nfx-aperture-input" aria-hidden="true"></div>
      <div class="nfx-aperture-groups"></div>
      <p class="nfx-aperture-hint" aria-hidden="true">Turn or tap</p>
    </div>
    <section class="nfx-tools-tray" aria-labelledby="nfxToolsGroup">
      <header class="nfx-tools-tray-header">
        <h3 id="nfxToolsGroup" aria-live="polite"></h3>
        <button type="button" data-tools-all>All controls</button>
      </header>
      <input id="nfxToolsSearch" type="search" aria-label="Search tools" placeholder="Try camera mix or export" autocomplete="off" spellcheck="false" hidden>
      <div class="nfx-tools-body" aria-label="Tools in this group"></div>
    </section>`;
  document.body.append(panel);

  const body = panel.querySelector('.nfx-tools-body');
  const search = panel.querySelector('input');
  const title = panel.querySelector('h3');
  const stage = panel.querySelector('.nfx-aperture');
  const find = panel.querySelector('[data-tools-find]');
  const closeButton = panel.querySelector('[data-tools-close]');
  const label = document.createElement('span');
  label.className = 'nfx-tools-dock-label';
  label.textContent = 'Tools';
  label.hidden = true;
  trigger.append(label);
  let activeGroup = 0;
  let groupMotion;
  let closing = false;
  let useNativeMenu = false;
  let enabled = false;

  const groupButtons = groups.map((group, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.studioGroup = String(index);
    button.textContent = group.name;
    stage.querySelector('.nfx-aperture-groups').append(button);
    return button;
  });

  function render(transition = false) {
    const group = groups[activeGroup];
    const searching = !search.hidden;
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const options = searching ? groups.flatMap(group => group.tools) : group.tools;
    const matches = options.filter(tool => terms.every(term => tool.join(' ').toLowerCase().includes(term)));
    panel.style.setProperty('--tool-light', group.color);
    title.textContent = searching ? 'Find a tool' : group.name;
    for (const [index, button] of groupButtons.entries()) {
      button.setAttribute('aria-pressed', String(index === activeGroup));
    }
    groupMotion?.cancel();
    body.replaceChildren();
    for (const [name, route] of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.studioRoute = route;
      button.textContent = name;
      body.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No matching tools.';
      body.append(empty);
    }
    body.parentElement.scrollTop = 0;
    if (transition && !reducedMotion.matches) {
      groupMotion = body.animate([
        {opacity: .22, transform: 'translateY(9px) scale(.984)'},
        {opacity: 1, transform: 'translateY(0) scale(1)'}
      ], {duration: 215, easing: 'cubic-bezier(.16,1,.3,1)'});
    }
  }

  const aperture = mountToolAperture(stage, groupButtons, groups.map(group => group.color), reducedMotion, index => {
    activeGroup = index;
    stage.classList.add('nfx-aperture-used');
    workspace.rig.feedback?.('tick');
    render(true);
  });

  function setSearch(active, focus = true) {
    search.hidden = !active;
    search.value = '';
    find.setAttribute('aria-expanded', String(active));
    find.textContent = active ? 'Back to groups' : 'Find a tool';
    panel.classList.toggle('nfx-tools-searching', active);
    stage.inert = active;
    render();
    if (focus) (active ? search : find).focus({preventScroll: true});
  }

  function open() {
    if (panel.open) return;
    setSearch(false, false);
    panel.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus({preventScroll: true});
    aperture.open(trigger.getBoundingClientRect(), activeGroup);
  }

  async function dismiss(withMotion = true, handoff = false) {
    if (closing || !panel.open) return;
    closing = true;
    if (withMotion && !stage.inert) await aperture.close(handoff);
    else aperture.stop();
    panel.close();
    closing = false;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({preventScroll: true});
  }

  function openRoute(route) {
    const [page, section] = route.split(':');
    if (page === 'layers') {
      workspace.layers.open();
      return;
    }
    workspace.rig.guideOpen(page);
    if (page === 'cam') workspace.selectTab(section);
    if (page === 'recording') document.getElementById(`nfx-tab-${section}`)?.click();
    document.getElementById('shClose')?.focus({preventScroll: true});
  }

  function usesNativeMenu() {
    return workspace.byos.enabled || workspace.take.enabled || workspace.rig.guideState().ui.menuOpen ||
      document.body.classList.contains('clean') || document.body.classList.contains('nfx-simple-record');
  }

  function setEnabled(value) {
    enabled = value;
    dock.classList.toggle('nfx-studio-dock', value);
    label.hidden = !value;
    if (value) {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', panel.id);
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      for (const attribute of ['aria-haspopup', 'aria-controls', 'aria-expanded']) {
        trigger.removeAttribute(attribute);
      }
    }
  }

  function launchFromStock() {
    workspace.rig.closeMenu();
    setEnabled(true);
    open();
  }

  const stockChoice = document.createElement('button');
  stockChoice.id = 'nfxMenuNewUI';
  stockChoice.type = 'button';
  stockChoice.className = 'act nfx-new-ui-entry';
  stockChoice.textContent = 'New UI';
  stockChoice.addEventListener('click', launchFromStock);
  workspace.rig.mountInterfaceChoice(stockChoice);

  const start = document.getElementById('start');
  const startMenu = document.getElementById('stMenu');
  const silentEntry = startMenu?.querySelector('[data-go=sim]');
  if (start && silentEntry) {
    const startChoice = document.createElement('button');
    startChoice.id = 'nfxStartNewUI';
    startChoice.type = 'button';
    startChoice.className = 'st-b';
    startChoice.innerHTML = '<i aria-hidden="true">◎</i><span>New UI<small>Animated studio</small></span>';
    startMenu.append(startChoice);
    startChoice.addEventListener('click', () => {
      startChoice.disabled = true;
      const observer = new MutationObserver(() => {
        if (start.isConnected) return;
        observer.disconnect();
        launchFromStock();
      });
      observer.observe(start.parentNode, {childList: true});
      silentEntry.click();
    });
  }

  trigger.addEventListener('click', event => {
    if (!enabled || useNativeMenu || usesNativeMenu()) return;
    event.stopImmediatePropagation();
    open();
  }, true);

  search.addEventListener('input', () => render());
  find.addEventListener('click', () => { if (!closing) setSearch(search.hidden); });
  panel.addEventListener('cancel', event => {
    event.preventDefault();
    if (!search.hidden) setSearch(false);
    else dismiss();
  });
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('click', async event => {
    if (closing) return;
    const button = event.target.closest('button');
    if (button === closeButton) dismiss();
    if (button?.dataset.studioGroup !== undefined) aperture.select(Number(button.dataset.studioGroup));
    if (button?.dataset.studioRoute) {
      const route = button.dataset.studioRoute;
      await dismiss(true, true);
      openRoute(route);
    }
    if (button?.hasAttribute('data-tools-all')) {
      dismiss(false);
      useNativeMenu = true;
      try { trigger.click(); } finally { useNativeMenu = false; }
    }
    if (button?.hasAttribute('data-tools-stock')) {
      await dismiss();
      setEnabled(false);
      workspace.rig.guideOpen('quick');
      stockChoice.focus({preventScroll: true});
    }
  });
}
