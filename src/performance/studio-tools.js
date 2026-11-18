import {mountToolAperture} from './tool-aperture.js';
import {mountStudioInterface} from './studio-interface.js';

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
      <div class="nfx-aperture-input" aria-hidden="true"><output aria-hidden="true"></output></div>
      <div class="nfx-aperture-groups"></div>
      <p class="nfx-aperture-hint" aria-hidden="true">Turn or tap</p>
    </div>
    <section class="nfx-tools-tray" aria-labelledby="nfxToolsGroup">
      <header class="nfx-tools-tray-header">
        <h3 id="nfxToolsGroup" aria-live="polite"></h3>
        <button type="button" data-tools-detail hidden>Detailed controls</button>
        <button type="button" data-tools-all>All tools</button>
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
  const detail = panel.querySelector('[data-tools-detail]');
  const back = panel.querySelector('[data-tools-all]');
  const hud = document.getElementById('hud');
  const label = document.createElement('span');
  label.className = 'nfx-tools-dock-label';
  label.textContent = 'Tools';
  label.hidden = true;
  trigger.append(label);
  let activeGroup = 0;
  let groupMotion;
  let closing = false;
  let enabled = false;
  let restoreHudInert = false;
  let undock;
  let selectedRoute = null;
  let adjusting = false;
  let allTools = false;
  const studio = mountStudioInterface(workspace.rig, (page, section) => openEditor(page, section, true));

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
    const options = searching || allTools ? groups.flatMap(group => group.tools) : group.tools;
    const matches = options.filter(tool => terms.every(term => tool.join(' ').toLowerCase().includes(term)));
    panel.style.setProperty('--tool-light', group.color);
    title.textContent = searching ? 'Find a tool' : allTools ? 'All tools' : group.name;
    back.textContent = allTools ? 'Groups' : 'All tools';
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
    allTools = false;
    clearEditor();
    render(true);
  });

  function setSearch(active, focus = true) {
    clearEditor();
    allTools = false;
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
    workspace.rig.closeMenu();
    setSearch(false, false);
    restoreHudInert = hud.inert;
    hud.inert = true;
    panel.show();
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus({preventScroll: true});
    aperture.open(trigger.getBoundingClientRect(), activeGroup);
  }

  async function dismiss(withMotion = true) {
    if (closing || !panel.open) return;
    closing = true;
    clearEditor();
    if (withMotion && !stage.inert) await aperture.close();
    else aperture.stop();
    panel.close();
    hud.inert = restoreHudInert;
    closing = false;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({preventScroll: true});
  }

  function openRoute(route) {
    const [page, section] = route.split(':');
    if (page === 'layers') {
      dismiss(false);
      workspace.layers.open();
      return;
    }
    openEditor(page, section);
  }

  function clearEditor() {
    if (!selectedRoute) return;
    if (adjusting) finishDial(false);
    undock?.();
    undock = null;
    selectedRoute = null;
    detail.hidden = true;
    panel.classList.remove('nfx-tools-editing');
    body.replaceChildren();
  }

  function turnControl(id, control) {
    const {label, min, max, step, format} = control.spec;
    adjusting = true;
    detail.hidden = true;
    title.textContent = label.toLowerCase();
    back.textContent = 'Done';
    aperture.dial({
      label, min, max, step: step || (max - min) / 200, format,
      read: () => workspace.rig.interfaceValue(id),
      write(value) {
        workspace.rig.interfaceSetParam(id, value);
        control.refresh();
      }
    });
  }

  function finishDial(focus = true) {
    adjusting = false;
    aperture.dial();
    if (selectedRoute) {
      title.textContent = selectedRoute.title;
      detail.hidden = !selectedRoute.compact;
    }
    back.textContent = 'Groups';
    if (focus) back.focus({preventScroll: true});
  }

  function openEditor(page, section, detailed = false) {
    if (closing) return false;
    open();
    setSearch(false, false);
    const route = section ? page + ':' + section : page;
    const groupIndex = groups.findIndex(group => group.tools.some(tool => tool[1] === route || tool[1] === page));
    if (groupIndex >= 0) aperture.select(groupIndex);
    const tool = groups.flatMap(group => group.tools).find(tool => tool[1] === route || tool[1] === page);
    const canUseCompact = !detailed && (!section || page === 'cam' && section === 'source') && page !== 'recording';
    const name = tool?.[0] || (page === 'recording' ? 'Recording controls' : 'Controls');
    selectedRoute = {page, section, title: name, compact: false};
    panel.classList.add('nfx-tools-editing');
    groupMotion?.cancel();
    body.replaceChildren();
    undock = canUseCompact ? studio.circleEditor(page, body, turnControl) : null;
    selectedRoute.compact = !!undock;
    if (!undock) undock = workspace.rig.dockInterfacePage(page, body);
    if (page === 'cam' && !selectedRoute.compact) workspace.selectTab(section || 'source');
    if (page === 'recording' && section) document.getElementById('nfx-tab-' + section)?.click();
    title.textContent = name;
    back.textContent = 'Groups';
    detail.hidden = !selectedRoute.compact;
    body.parentElement.scrollTop = 0;
    back.focus({preventScroll: true});
    if (!reducedMotion.matches) {
      groupMotion = body.animate([{opacity: .24, transform: 'translateY(12px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)'});
    }
    return true;
  }

  function usesNativeMenu() {
    return workspace.byos.enabled || workspace.take.enabled ||
      document.body.classList.contains('clean') || document.body.classList.contains('nfx-simple-record');
  }

  function setEnabled(value) {
    enabled = value;
    studio.enable(value);
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

  workspace.rig.openInterfacePage = (page, section) => {
    if (!enabled || usesNativeMenu()) return false;
    return openEditor(page, section);
  };
  workspace.rig.closeInterfacePage = () => dismiss(false);
  new MutationObserver(() => {
    if (panel.open && usesNativeMenu() && !closing) dismiss(false);
  }).observe(document.body, {attributes: true, attributeFilter: ['class']});

  function launchFromStock() {
    workspace.rig.closeMenu();
    setEnabled(true);
    document.querySelector('#nfxStudioShell [data-interface=scenes]')?.focus({preventScroll: true});
  }

  const stockChoice = document.createElement('button');
  stockChoice.id = 'nfxMenuNewUI';
  stockChoice.type = 'button';
  stockChoice.className = 'act nfx-new-ui-entry';
  stockChoice.textContent = 'New UI';
  stockChoice.addEventListener('click', launchFromStock);
  workspace.rig.mountInterfaceChoice(stockChoice);

  function openRequestedInterface() {
    if (document.body.dataset.nfxStartNewUi !== 'pending') return;
    delete document.body.dataset.nfxStartNewUi;
    launchFromStock();
  }

  document.addEventListener('nfx-start-new-ui', openRequestedInterface, {once: true});
  openRequestedInterface();

  trigger.addEventListener('click', event => {
    if (!enabled || usesNativeMenu()) return;
    event.stopImmediatePropagation();
    open();
  }, true);

  search.addEventListener('input', () => render());
  find.addEventListener('click', () => { if (!closing) setSearch(search.hidden); });
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (adjusting) finishDial();
    else if (!search.hidden) setSearch(false);
    else if (selectedRoute) { clearEditor(); render(); }
    else dismiss();
  });
  panel.addEventListener('click', async event => {
    if (closing) return;
    const button = event.target.closest('button');
    if (button === closeButton) dismiss();
    if (button?.dataset.studioGroup !== undefined) {
      allTools = false;
      const group = Number(button.dataset.studioGroup);
      clearEditor();
      if (group === activeGroup) render();
      else aperture.select(group);
    }
    if (button?.dataset.studioRoute) openRoute(button.dataset.studioRoute);
    if (button === detail && selectedRoute) openEditor(selectedRoute.page, selectedRoute.section, true);
    if (button?.hasAttribute('data-tools-all')) {
      if (adjusting) finishDial();
      else {
        allTools = !selectedRoute && !allTools;
        clearEditor();
        render();
      }
    }
    if (button?.hasAttribute('data-tools-stock')) {
      await dismiss();
      setEnabled(false);
      workspace.rig.guideOpen('quick');
      stockChoice.focus({preventScroll: true});
    }
  });
}
