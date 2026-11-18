const groups = [
  {name: 'Create', icon: '✧', tools: [
    ['Quick controls', 'quick', 'pins favorites randomize'],
    ['Scenes & looks', 'scenes', 'engines presets memory banks'],
    ['Form', 'form', 'shape geometry symmetry'],
    ['Color', 'color', 'palette brightness contrast saturation'],
    ['Motion', 'motion', 'pace spin drift silence stop'],
    ['Visual effects', 'fx', 'feedback trails glow lens']
  ]},
  {name: 'Camera & 3D', icon: '◎', tools: [
    ['Camera source & mix', 'cam:source', 'selfie front rear blend camera mix'],
    ['Camera effects', 'cam:effects', 'camera fx mirror kaleidoscope fisheye swirl tunnel puzzle filters'],
    ['Camera looks', 'cam:looks', 'camera presets'],
    ['3D & depth', 'd3', 'point cloud splat import scan']
  ]},
  {name: 'Perform', icon: '≋', tools: [
    ['Sound input', 'input', 'audio mic device music'],
    ['Sound response', 'react', 'beat bass bpm level'],
    ['Touch & sensors', 'sense', 'tilt gyro gestures shake'],
    ['Live layers', 'layers', '3d stack blend opacity reorder']
  ]},
  {name: 'Record', icon: '◉', tools: [
    ['Recording controls', 'recording:record', 'video countdown start stop'],
    ['Output framing', 'recording:output', 'portrait landscape fps resolution titles'],
    ['Recording audio', 'recording:audio', 'microphone music mix stems'],
    ['Library', 'recording:library', 'saved takes export trim remux mp4 share']
  ]},
  {name: 'Assist', icon: '✦', tools: [
    ['AI tools', 'ai', 'prompt director hands lyrics walkthrough guide']
  ]},
  {name: 'Studio', icon: '◫', tools: [
    ['Setups & custom studio', 'quick', 'save load import download byos build your own studio'],
    ['System', 'sys', 'performance resolution offline updates settings']
  ]}
];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ease = 'cubic-bezier(.19,.8,.24,1)';

export function mountStudioTools(workspace) {
  const trigger = document.getElementById('btnMenu');
  const dock = document.getElementById('dock');
  const panel = document.createElement('dialog');
  panel.id = 'nfxStudioTools';
  panel.setAttribute('aria-labelledby', 'nfxToolsTitle');
  panel.innerHTML = `
    <header class="nfx-tools-header">
      <button type="button" data-tools-back hidden aria-label="Back to tool groups">←</button>
      <h2 id="nfxToolsTitle">Tools</h2>
      <button type="button" data-tools-close aria-label="Close tools">×</button>
    </header>
    <input type="search" placeholder="Find a tool" aria-label="Find a tool" autocomplete="off" spellcheck="false">
    <div class="nfx-tools-body" aria-live="polite"></div>
    <footer><button type="button" data-tools-all>All controls</button></footer>`;
  document.body.append(panel);

  const body = panel.querySelector('.nfx-tools-body');
  const search = panel.querySelector('input');
  const title = panel.querySelector('h2');
  const back = panel.querySelector('[data-tools-back]');
  const closeButton = panel.querySelector('[data-tools-close]');
  const label = document.createElement('span');
  label.className = 'nfx-tools-dock-label';
  label.textContent = 'Tools';
  trigger.append(label);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', panel.id);
  let activeGroup = null;
  let motion;
  let groupMotion;
  let closing = false;
  let useNativeMenu = false;

  function animate(element, frames, options) {
    if (reducedMotion.matches || typeof element.animate !== 'function') return null;
    return element.animate(frames, options);
  }

  function render(direction = 0) {
    const query = search.value.toLowerCase().trim();
    const group = groups[activeGroup];
    title.textContent = group?.name || 'Tools';
    back.hidden = !group;
    groupMotion?.cancel();
    body.replaceChildren();
    if (query || group) {
      const terms = query.split(/\s+/).filter(Boolean);
      const options = query ? groups.flatMap(group => group.tools) : group.tools;
      const matches = options.filter(tool => terms.every(term => tool.join(' ').toLowerCase().includes(term)));
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
    } else {
      for (const [index, item] of groups.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.studioGroup = String(index);
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.icon;
        button.append(icon, document.createTextNode(item.name));
        body.append(button);
      }
    }
    body.classList.toggle('nfx-tools-groups', !query && !group);
    if (direction) {
      groupMotion = animate(body, [
        {opacity: 0, transform: `perspective(800px) translate3d(${direction * 16}px, 0, -36px) rotateY(${direction * 3}deg)`},
        {opacity: 1, transform: 'perspective(800px) translate3d(0, 0, 0) rotateY(0deg)'}
      ], {duration: 240, easing: ease});
    }
  }

  function open() {
    if (panel.open) return;
    activeGroup = null;
    search.value = '';
    render();
    panel.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus({preventScroll: true});
    const panelRect = panel.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const originX = Math.max(12, Math.min(panelRect.width - 12, anchor.left + anchor.width / 2 - panelRect.left));
    panel.style.transformOrigin = `${originX}px bottom`;
    motion = animate(panel, [
      {opacity: 0, transform: 'perspective(900px) translateY(24px) rotateX(8deg) scale(.86,.72)'},
      {opacity: 1, transform: 'perspective(900px) translateY(0) rotateX(0) scale(1)'}
    ], {duration: 310, easing: ease});
    for (const [index, child] of [...body.children].entries()) {
      animate(child, [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 230, delay: 42 + index * 22, easing: ease, fill: 'backwards'});
    }
  }

  async function dismiss(withMotion = true) {
    if (closing || !panel.open) return;
    closing = true;
    const style = withMotion ? getComputedStyle(panel) : null;
    const transform = style?.transform;
    const opacity = style?.opacity;
    motion?.cancel();
    motion = withMotion ? animate(panel, [
      {opacity, transform},
      {opacity: 0, transform: 'perspective(900px) translateY(18px) rotateX(6deg) scale(.9,.8)'}
    ], {duration: 180, easing: 'cubic-bezier(.45,0,.75,.24)', fill: 'forwards'}) : null;
    if (motion) await motion.finished.catch(() => {});
    panel.close();
    motion?.cancel();
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
  }

  function usesNativeMenu() {
    return workspace.byos.enabled || workspace.take.enabled || workspace.rig.guideState().ui.menuOpen ||
      document.body.classList.contains('clean') || document.body.classList.contains('nfx-simple-record');
  }

  dock.classList.add('nfx-studio-dock');
  trigger.addEventListener('click', event => {
    if (useNativeMenu || usesNativeMenu()) return;
    event.stopImmediatePropagation();
    open();
  }, true);

  search.addEventListener('input', () => render());
  panel.addEventListener('cancel', event => {
    event.preventDefault();
    dismiss();
  });
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('click', event => {
    if (closing) return;
    const button = event.target.closest('button');
    if (event.target === panel) {
      const {left, right, top, bottom} = panel.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dismiss();
    }
    if (!button) return;
    if (button === closeButton) dismiss();
    if (button === back) {
      activeGroup = null;
      search.value = '';
      render(-1);
      body.firstElementChild?.focus();
    }
    if (button.dataset.studioGroup !== undefined) {
      activeGroup = Number(button.dataset.studioGroup);
      render(1);
      body.firstElementChild?.focus();
    }
    if (button.dataset.studioRoute) {
      dismiss(false);
      openRoute(button.dataset.studioRoute);
    }
    if (button.hasAttribute('data-tools-all')) {
      dismiss(false);
      useNativeMenu = true;
      try { trigger.click(); } finally { useNativeMenu = false; }
    }
  });
}
