const TAU = Math.PI * 2;
const STEP = TAU / 6;
const wrap = (value, length) => (value % length + length) % length;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function paintOptics(ctx, radius, turn, velocity, light, color, active) {
  const rim = radius * .94;
  // A translucent annulus leaves the actual WebGL composition visible down the center.
  const material = ctx.createRadialGradient(0, 0, radius * .68, 0, 0, radius * 1.13);
  material.addColorStop(0, 'rgba(6,9,12,0)');
  material.addColorStop(.28, 'rgba(3,6,9,.92)');
  material.addColorStop(.54, 'rgba(18,24,29,.89)');
  material.addColorStop(.71, 'rgba(105,114,113,.37)');
  material.addColorStop(.84, 'rgba(12,17,23,.86)');
  material.addColorStop(1, 'rgba(6,9,12,0)');
  ctx.fillStyle = material;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.13, 0, TAU);
  ctx.fill();

  for (const [ratio, alpha] of [[.746, .29], [.793, .48], [.86, .21], [.985, .33], [1.014, .16], [1.057, .12]]) {
    ctx.strokeStyle = `rgba(219,234,230,${alpha})`;
    ctx.lineWidth = .75;
    ctx.beginPath();
    ctx.arc(0, 0, radius * ratio, 0, TAU);
    ctx.stroke();
  }
  const lightAngle = Math.atan2(light.y, light.x);
  const specular = ctx.createConicGradient?.(lightAngle, 0, 0);
  for (const [stop, alpha] of [[0, .76], [.1, .12], [.35, .02], [.51, .29], [.65, .04], [.88, .06], [1, .76]]) {
    specular?.addColorStop(stop, `rgba(227,246,240,${alpha})`);
  }
  ctx.strokeStyle = specular || 'rgba(227,246,240,.3)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, rim, 0, TAU);
  ctx.stroke();

  // Brushed reflections sit between the two glass edges. The narrow bands
  // separate as the disc turns, where a flat outline would look stamped on.
  for (let band = 0; band < 9; band++) {
    const reflection = lightAngle + Math.sin(turn + band * .36) * .17;
    ctx.strokeStyle = `rgba(226,231,220,${.085 + (band % 3) * .045})`;
    ctx.lineWidth = band % 3 === 0 ? 1.1 : .55;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (.868 + band * .010), reflection - .66, reflection + .29);
    ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, rim * .84, 0, TAU);
  ctx.stroke();

  // Engraved marks rotate with the hand. The index remains fixed to the enclosure.
  for (let index = 0; index < 72; index++) {
    const angle = index * TAU / 72 - turn * STEP - Math.PI / 2;
    const major = index % 12 === 0;
    const inner = rim - (major ? 11 : index % 3 === 0 ? 7 : 4);
    const shimmer = Math.max(0, Math.cos(angle - lightAngle)) ** 8;
    ctx.strokeStyle = `rgba(219,238,231,${(major ? .38 : .13) + shimmer * .31})`;
    ctx.lineWidth = major ? 1.35 : .7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * (rim - 1), Math.sin(angle) * (rim - 1));
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.beginPath();
  const arc = .045 + Math.min(Math.abs(velocity) * .035, .36) + (active ? .07 : 0);
  ctx.arc(0, 0, rim + 4, -Math.PI / 2 - arc, -Math.PI / 2 + arc);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -rim + 4, 1.7, 0, TAU);
  ctx.fill();
}

export function mountToolAperture(stage, buttons, colors, reducedMotion, onSelect) {
  const canvas = stage.querySelector('canvas');
  const panel = stage.closest('dialog');
  const ctx = canvas.getContext('2d');
  const input = stage.querySelector('.nfx-aperture-input');
  let bounds, enclosure, width, height, radius, dpr, offsetX, offsetY, lastExposure;
  let animation = 0, lastTime = 0, open = false, closing = null, drag = null, suppressClick = false;
  let selected = 0, turn = 0, target = 0, velocity = 0, exposure = 0, exposureSpeed = 0, anchor;
  const light = {x: -.6, y: -.8};

  function resize() {
    if (!open) return;
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;
    bounds = stageRect;
    enclosure = panel.getBoundingClientRect();
    offsetX = bounds.left - enclosure.left;
    offsetY = bounds.top - enclosure.top;
    width = bounds.width;
    height = bounds.height;
    radius = Math.max(22, Math.min(width * .31, height * .39, 178));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.inset = `${-offsetY}px auto auto ${-offsetX}px`;
    canvas.style.width = `${enclosure.width}px`;
    canvas.style.height = `${enclosure.height}px`;
    canvas.width = Math.max(1, Math.round(enclosure.width * dpr));
    canvas.height = Math.max(1, Math.round(enclosure.height * dpr));
    lastExposure = undefined;
    input.style.width = `${radius * 2.16}px`;
    input.style.height = `${radius * 2.16}px`;
    wake();
  }

  function draw() {
    const expanded = clamp(exposure, 0, 1);
    const handoff = closing?.handoff ? clamp((exposure - 1) / .58, 0, 1) : 0;
    const opacity = expanded * (1 - handoff);
    const originX = width / 2;
    const originY = height / 2;
    const fromX = anchor.x - bounds.left;
    const fromY = anchor.y - bounds.top;
    const travel = 1 - (1 - expanded) ** 2;
    const x = fromX + (originX - fromX) * travel;
    const y = fromY + (originY - fromY) * travel;
    const scale = .10 + exposure * .90;
    if (lastExposure !== exposure) {
      panel.style.setProperty('--lens-x', `${x + offsetX}px`);
      panel.style.setProperty('--lens-y', `${y + offsetY}px`);
      panel.style.setProperty('--lens-r', `${radius * scale}px`);
      panel.style.setProperty('--lens-exposure', opacity.toFixed(3));
      panel.style.setProperty('--lens-shade', (1 - handoff).toFixed(3));
      lastExposure = exposure;
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx?.clearRect(0, 0, enclosure.width, enclosure.height);
    if (ctx) {
      ctx.save();
      ctx.translate(x + offsetX, y + offsetY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, expanded * 1.8) * (1 - handoff);
      paintOptics(ctx, radius, turn, velocity, light, colors[selected], !!drag?.moved);
      ctx.restore();
    }
    const orbit = (radius + 12) * scale;
    buttons.forEach((button, index) => {
      const angle = (index - turn) * STEP - Math.PI / 2;
      button.style.translate = `${x + Math.cos(angle) * orbit}px ${y + Math.sin(angle) * orbit}px`;
      button.style.opacity = opacity.toFixed(2);
    });
  }

  function wake() {
    if (!animation && open) {
      lastTime = 0;
      animation = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    animation = 0;
    if (!open) return;
    const dt = lastTime ? clamp((now - lastTime) / 1000, .001, .033) : 1 / 60;
    lastTime = now;
    const goal = closing?.handoff ? 1.58 : closing ? 0 : 1;
    if (reducedMotion.matches) {
      exposure = goal;
      if (!drag?.moved) turn = target;
      velocity = exposureSpeed = 0;
    } else {
      exposureSpeed += ((goal - exposure) * 155 - exposureSpeed * 22) * dt;
      exposure += exposureSpeed * dt;
      if (!drag?.moved) {
        velocity += ((target - turn) * 170 - velocity * 21) * dt;
        turn += velocity * dt;
      }
    }
    const settle = Math.abs(exposure - goal) < .003 && Math.abs(exposureSpeed) < .018;
    const detent = Math.abs(turn - target) < .003 && Math.abs(velocity) < .018;
    if (settle) exposure = goal;
    if (detent && !drag?.moved) turn = target;
    draw();
    if (settle && closing) {
      const {resolve} = closing;
      halt();
      resolve();
    } else if (!settle || (!detent && !drag?.moved)) {
      animation = requestAnimationFrame(frame);
    }
  }

  function select(index, snap = true) {
    const next = wrap(index, buttons.length);
    if (snap) target = turn + wrap(index - turn + buttons.length / 2, buttons.length) - buttons.length / 2;
    if (next !== selected) {
      selected = next;
      onSelect(next);
    }
    wake();
  }

  function halt() {
    open = false;
    drag = null;
    cancelAnimationFrame(animation);
    animation = 0;
    closing = null;
  }

  function point(event) {
    return {x: event.clientX - bounds.left - width / 2, y: event.clientY - bounds.top - height / 2};
  }

  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag || closing || !bounds) return;
    const {x, y} = point(event);
    if (Math.hypot(x, y) < radius * .34) return;
    suppressClick = false;
    drag = {id: event.pointerId, x, y, angle: Math.atan2(y, x), time: event.timeStamp, moved: false};
  });
  stage.addEventListener('pointermove', event => {
    if (!bounds || closing) return;
    const {x, y} = point(event);
    const distance = Math.max(1, Math.hypot(x, y));
    light.x = x / distance;
    light.y = y / distance;
    wake();
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 7) return;
    if (!drag.moved) stage.setPointerCapture(event.pointerId);
    drag.moved = true;
    const angle = Math.atan2(y, x);
    const delta = wrap(angle - drag.angle + Math.PI, TAU) - Math.PI;
    const seconds = Math.max(.012, (event.timeStamp - drag.time) / 1000);
    turn -= delta / STEP;
    velocity = velocity * .35 + clamp(-delta / STEP / seconds, -10, 10) * .65;
    drag.angle = angle;
    drag.time = event.timeStamp;
    select(Math.round(turn), false);
  });
  function release(event, cancelled = false) {
    if (event.pointerId !== drag?.id) return;
    const ended = drag;
    drag = null;
    if (!ended.moved) return;
    suppressClick = true;
    const momentum = cancelled || event.timeStamp - ended.time > 100 ? 0 : clamp(velocity * .095, -.7, .7);
    select(Math.round(turn + momentum));
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', event => release(event, true));
  stage.addEventListener('lostpointercapture', event => {
    // Touch starts with implicit capture on the hit target. The handoff of
    // capture from a child to the stage is part of starting the drag.
    if (event.target === stage) release(event, true);
  });
  stage.addEventListener('click', event => {
    if (suppressClick && event.detail > 0) {
      event.stopImmediatePropagation();
      suppressClick = false;
    }
  }, true);
  stage.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    select(selected + direction);
    buttons[selected].focus({preventScroll: true});
  });
  new ResizeObserver(resize).observe(stage);

  return {
    open(rect, index) {
      halt();
      anchor = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
      selected = index;
      target = turn = index;
      velocity = exposureSpeed = 0;
      exposure = reducedMotion.matches ? 1 : 0;
      suppressClick = false;
      open = true;
      resize();
      draw();
    },
    select,
    stop: halt,
    close(handoff = false) {
      if (!open || reducedMotion.matches) {
        halt();
        return Promise.resolve();
      }
      return new Promise(resolve => {
        drag = null;
        closing = {resolve, handoff};
        wake();
      });
    }
  };
}
