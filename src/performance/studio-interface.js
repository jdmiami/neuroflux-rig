const editors = {
  scenes: {title: 'Looks', color: '#f3c68d', controls: ['mode', 'pal']},
  form: {title: 'Shape', color: '#a0e4d1', controls: ['warp', 'scale', 'sym', 'density', 'morph', 'twist', 'cx', 'ring']},
  color: {title: 'Color', color: '#eec1dd', controls: ['hue', 'sat', 'bright', 'contrast', 'pal', 'hueSpd', 'fbHue', 'poster', 'invert']},
  motion: {title: 'Motion', color: '#bcb1f4', controls: ['speed', 'travel', 'rotSpd', 'wobble', 'freeze', 'reverse', 'autopilot', 'autoRate']},
  cam: {title: 'Camera', color: '#9bf0d9', controls: ['cam', 'camMix', 'camFace', 'camBlend', 'camKey', 'camEdge', 'camWarp', 'camMotion', 'camTrails']},
  fx: {title: 'Effects', color: '#f5b0a3', controls: ['bloom', 'fb', 'chroma', 'mirror', 'swirl', 'ripple', 'fish', 'glitch', 'wave', 'pixel', 'grain', 'scan', 'vig', 'fbZoom', 'fbRot', 'fbWarp']},
  react: {title: 'Sound response', color: '#b8d4ff', controls: ['gain', 'rBass', 'rMid', 'rHigh', 'rSpeed', 'beatThr', 'smooth', 'beatKick', 'strobe', 'beatInv', 'beatJump']},
  sense: {title: 'Touch & sensors', color: '#dfcea7', controls: ['touch', 'touchMode', 'touchAmt', 'motion', 'tiltOrigin', 'tiltFlow', 'gyroSpin', 'shake', 'compHue', 'lightGlow']},
  d3: {title: 'Depth & 3D', color: '#b9e3b4', controls: ['depth', 'cloud', 'depthRes', 'cloudRes', 'ptSize', 'explode', 'orbit', 'splatGain', 'splatDensity', 'splatSpin', 'splatFlip']}
};
const sourceNames = {sim: 'Simulation', demo: 'Demo', file: 'Track', mic: 'Microphone', sys: 'System audio'};
const primaryEditors = ['scenes', 'form', 'color', 'motion', 'cam'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function mountStudioInterface(rig, openNative) {
  const shell = document.createElement('section');
  shell.id = 'nfxStudioShell';
  shell.setAttribute('aria-label', 'Neuroflux studio');
  shell.hidden = true;
  shell.innerHTML = `
    <header class="nfx-interface-top">
      <div class="nfx-interface-scene"><span>Neuroflux</span><h1></h1></div>
      <button type="button" data-interface="react" class="nfx-interface-signal" aria-label="Sound response">
        <span class="nfx-interface-bands" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="nfx-interface-source"></span>
        <output class="nfx-interface-tempo"></output>
      </button>
    </header>
    <main class="nfx-interface-workspace">
      <section id="nfxInterfaceEditor" class="nfx-interface-editor" aria-labelledby="nfxInterfaceEditorTitle">
        <header class="nfx-interface-editor-head">
          <h2 id="nfxInterfaceEditorTitle"></h2>
          <button type="button" data-interface-native></button>
          <button type="button" data-interface-close aria-label="Close editor">×</button>
        </header>
        <div class="nfx-interface-fields"></div>
      </section>
      <nav class="nfx-interface-keys" aria-label="Studio editors"></nav>
    </main>`;
  document.getElementById('hud').append(shell);
  const navigation = shell.querySelector('.nfx-interface-keys');
  const editor = shell.querySelector('.nfx-interface-editor');
  const fields = shell.querySelector('.nfx-interface-fields');
  const heading = editor.querySelector('h2');
  const advanced = editor.querySelector('[data-interface-native]');
  const scene = shell.querySelector('h1');
  const signalSource = shell.querySelector('.nfx-interface-source');
  const tempo = shell.querySelector('.nfx-interface-tempo');
  const bands = [...shell.querySelectorAll('.nfx-interface-bands i')];
  const cache = new Map();
  let active = null;
  let timer;
  let animation;

  for (const page of primaryEditors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.interface = page;
    button.textContent = editors[page].title;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', editor.id);
    navigation.append(button);
  }

  function setText(element, value) {
    if (!element.firstChild) element.append(document.createTextNode(value));
    else if (element.firstChild.data !== value) element.firstChild.data = value;
  }

  function update() {
    if (document.hidden) return;
    const {scene: sceneName, source, bpm, bass, mid, high} = rig.interfaceSignal();
    setText(scene, sceneName.toLowerCase());
    setText(signalSource, sourceNames[source] || source);
    setText(tempo, `${Math.round(bpm || 0)} BPM`);
    [bass, mid, high].forEach((value, index) => {
      bands[index].style.setProperty('--signal', String(Math.min(1, Math.max(.14, value))));
    });
    for (const id of editors[active]?.controls || []) cache.get(id)?.refresh();
  }

  function makeField(id) {
    const spec = rig.interfaceControl(id);
    if (!spec) return null;
    const isSwitch = spec.type === 'switch';
    const isChoice = spec.type === 'pads' || spec.type === 'dial';
    const field = document.createElement('label');
    field.className = `nfx-interface-field ${isSwitch ? 'nfx-interface-switch' : isChoice ? 'nfx-interface-select' : 'nfx-interface-range'}`;
    const label = document.createElement('span');
    label.textContent = id === 'mode' ? 'Scene engine' : spec.label.toLowerCase();
    const valueLabel = document.createElement('output');
    valueLabel.hidden = isChoice || isSwitch;
    const input = document.createElement(isChoice ? 'select' : 'input');
    input.dataset.interfaceControl = id;
    field.append(label, valueLabel, input);
    if (isChoice) {
      for (let value = spec.min; value <= spec.max; value += spec.step || 1) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = spec.format(value);
        input.append(option);
      }
    } else if (isSwitch) {
      input.type = 'checkbox';
    } else {
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step || (spec.max - spec.min) / 200);
      input.addEventListener('dblclick', () => {
        rig.interfaceSetParam(id, spec.defaultValue);
        refresh();
      });
    }
    input.addEventListener(isChoice || isSwitch ? 'change' : 'input', () => {
      rig.interfaceSetParam(id, isSwitch ? Number(input.checked) : Number(input.value));
      update();
    });
    function refresh() {
      const value = rig.interfaceValue(id);
      if (isSwitch) input.checked = !!value;
      else if (Number(input.value) !== value) input.value = String(value);
      if (!isSwitch && !isChoice) {
        const text = spec.format(value);
        setText(valueLabel, text);
        if (input.getAttribute('aria-valuetext') !== text) input.setAttribute('aria-valuetext', text);
        input.style.setProperty('--mix', `${100 * (value - spec.min) / (spec.max - spec.min)}%`);
      }
    }
    return {field, refresh};
  }

  function show(page, focus = true) {
    const config = editors[page];
    if (!config || shell.hidden) return false;
    active = page;
    shell.style.setProperty('--instrument-light', config.color);
    editor.hidden = false;
    heading.textContent = config.title;
    advanced.textContent = page === 'cam' ? 'Camera effects' : page === 'scenes' ? 'Presets & saves' : 'More controls';
    for (const button of navigation.children) button.setAttribute('aria-expanded', String(button.dataset.interface === page));
    const controls = config.controls.map(id => {
      if (!cache.has(id)) cache.set(id, makeField(id));
      return cache.get(id)?.field;
    }).filter(Boolean);
    fields.replaceChildren(...controls);
    fields.scrollTop = 0;
    update();
    animation?.cancel();
    if (!reducedMotion.matches) {
      animation = editor.animate([
        {opacity: .25, transform: 'translateY(20px) scale(.985)'},
        {opacity: 1, transform: 'translateY(-2px) scale(1)' , offset: .76},
        {opacity: 1, transform: 'translateY(0) scale(1)'}
      ], {duration: 310, easing: 'cubic-bezier(.22,.82,.24,1)'});
    }
    if (focus) (navigation.querySelector(`[data-interface=${page}]`) || editor.querySelector('[data-interface-close]')).focus({preventScroll: true});
    return true;
  }

  function close() {
    active = null;
    animation?.cancel();
    editor.hidden = true;
    for (const button of navigation.children) button.setAttribute('aria-expanded', 'false');
  }

  function closeAndFocus() {
    const key = navigation.querySelector(`[data-interface=${active}]`);
    close();
    (key || navigation.firstElementChild).focus({preventScroll: true});
  }

  shell.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const page = button.dataset.interface;
    if (page) {
      if (active === page) close();
      else show(page);
    }
    if (button.hasAttribute('data-interface-close')) closeAndFocus();
    if (button === advanced && active) openNative(active, active === 'cam' ? 'effects' : undefined);
  });
  shell.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active && !event.target.matches('select')) {
      event.stopPropagation();
      closeAndFocus();
    }
    if (event.target.matches('input, select')) event.stopPropagation();
  });

  return {
    show,
    enable(value) {
      shell.hidden = !value;
      document.body.classList.toggle('nfx-new-studio', value);
      clearInterval(timer);
      if (value) {
        show('scenes', false);
        timer = setInterval(update, 140);
      } else close();
    }
  };
}
