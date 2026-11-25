(() => {
  'use strict';

  const KEY_SIZE = 'cvatPointBoost';
  const KEY_BRIGHT = 'cvatPointBright';
  const KEY_POS = 'cvatPointBoostPos';
  const KEY_MIN = 'cvatPointBoostMin';
  let mul = parseFloat(localStorage.getItem(KEY_SIZE)) || 3;
  let bright = parseFloat(localStorage.getItem(KEY_BRIGHT)) || 2;
  let panelMade = false;

  const CSS = `
    :host { all: initial; }
    .box {
      box-sizing: border-box;
      width: min(260px, calc(100vw - 16px));
      background: rgba(30,30,30,.88);
      color: #fff;
      font: 12px/1.4 system-ui, sans-serif;
      padding: 8px 10px;
      border-radius: 8px;
      display: grid;
      grid-template-columns: auto minmax(60px, 1fr) auto;
      gap: 6px 8px;
      align-items: center;
    }
    .head {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: move;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      font-weight: 600;
    }
    .head span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button {
      all: unset;
      cursor: pointer;
      width: 22px; height: 22px;
      text-align: center;
      line-height: 22px;
      border-radius: 4px;
      background: rgba(255,255,255,.15);
      flex: none;
    }
    input[type=range] { width: 100%; min-width: 0; margin: 0; }
    .val { min-width: 34px; text-align: right; }
    .box.min .row { display: none; }
  `;

  function makePanel() {
    if (panelMade) return;
    panelMade = true;

    const host = document.createElement('div');
    host.id = 'cvat-point-boost-host';
    host.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:2147483647;display:block;margin:0;padding:0;border:0;';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    const box = document.createElement('div');
    box.className = 'box';
    root.appendChild(box);

    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('span');
    title.textContent = 'Point boost (drag to move)';
    const toggle = document.createElement('button');
    head.append(title, toggle);
    box.appendChild(head);

    const addRow = (name, min, max, step, val, onChange) => {
      const label = document.createElement('span');
      label.className = 'row';
      label.textContent = name;
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'row';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = val;
      const output = document.createElement('span');
      output.className = 'row val';
      output.textContent = 'x' + val;
      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        output.textContent = 'x' + value;
        onChange(value);
      });
      box.append(label, input, output);
    };

    addRow('Size', 1, 10, 0.5, mul, (value) => {
      mul = value;
      localStorage.setItem(KEY_SIZE, String(value));
    });
    addRow('Bright', 1, 6, 0.25, bright, (value) => {
      bright = value;
      localStorage.setItem(KEY_BRIGHT, String(value));
    });

    const place = (x, y) => {
      const width = host.offsetWidth;
      const height = host.offsetHeight;
      x = Math.max(0, Math.min(window.innerWidth - width, x));
      y = Math.max(0, Math.min(window.innerHeight - height, y));
      host.style.left = x + 'px';
      host.style.top = y + 'px';
    };
    const clampNow = () => {
      if (host.style.display === 'none') return;
      const rect = host.getBoundingClientRect();
      place(rect.left, rect.top);
    };

    const setMin = (minimized) => {
      box.classList.toggle('min', minimized);
      toggle.textContent = minimized ? '+' : '-';
      toggle.title = minimized ? 'Expand' : 'Collapse';
      localStorage.setItem(KEY_MIN, minimized ? '1' : '0');
      requestAnimationFrame(clampNow);
    };
    toggle.addEventListener('click', () => setMin(!box.classList.contains('min')));
    toggle.addEventListener('pointerdown', (event) => event.stopPropagation());

    (document.documentElement || document.body).appendChild(host);

    const savedMin = localStorage.getItem(KEY_MIN);
    setMin(savedMin === null ? window.innerWidth < 520 : savedMin === '1');

    let savedPosition = null;
    try {
      savedPosition = JSON.parse(localStorage.getItem(KEY_POS));
    } catch (_) {
      // Ignore invalid saved position data.
    }
    if (savedPosition && typeof savedPosition.x === 'number') {
      place(savedPosition.x, savedPosition.y);
    } else {
      place(8, window.innerHeight - host.offsetHeight - 8);
    }

    head.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      head.setPointerCapture(event.pointerId);
      const rect = host.getBoundingClientRect();
      const dx = event.clientX - rect.left;
      const dy = event.clientY - rect.top;
      const move = (pointerEvent) => place(pointerEvent.clientX - dx, pointerEvent.clientY - dy);
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        const finalRect = host.getBoundingClientRect();
        localStorage.setItem(KEY_POS, JSON.stringify({ x: finalRect.left, y: finalRect.top }));
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    });

    window.addEventListener('resize', clampNow);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', clampNow);
    if (window.ResizeObserver) new ResizeObserver(clampNow).observe(box);

    window.addEventListener('keydown', (event) => {
      if (event.altKey && event.key.toLowerCase() === 'p') {
        host.style.display = host.style.display === 'none' ? 'block' : 'none';
        clampNow();
      }
    });
  }

  function patch(proto) {
    if (!proto || proto.__cvatPointBoostPatched) return;
    const originalShaderSource = proto.shaderSource;
    const originalDrawArrays = proto.drawArrays;
    if (!originalShaderSource || !originalDrawArrays) return;
    Object.defineProperty(proto, '__cvatPointBoostPatched', { value: true });

    proto.shaderSource = function (shader, source) {
      if (/gl_PointSize\s*=\s*size\s*;/.test(source)) {
        source = source
          .replace(/void\s+main\s*\(/, 'uniform float uMul;\nvoid main(')
          .replace(/gl_PointSize\s*=\s*size\s*;/, 'gl_PointSize = size * uMul;');
        console.log('[cvat-point-boost] point vertex shader patched');
        makePanel();
      }
      const fragmentOutput = /gl_FragColor\s*=\s*vec4\(\s*outgoingLight\s*,\s*diffuseColor\.a\s*\)\s*;/;
      if (source.indexOf('gl_PointCoord') !== -1 && fragmentOutput.test(source)) {
        source = source
          .replace(/void\s+main\s*\(/, 'uniform float uBright;\nvoid main(')
          .replace(fragmentOutput, 'gl_FragColor = vec4( outgoingLight * uBright, diffuseColor.a );');
        console.log('[cvat-point-boost] point fragment shader patched');
        makePanel();
      }
      return originalShaderSource.call(this, shader, source);
    };

    const locations = new WeakMap();
    proto.drawArrays = function (mode, first, count) {
      if (mode === this.POINTS) {
        const program = this.getParameter(this.CURRENT_PROGRAM);
        if (program) {
          let uniforms = locations.get(program);
          if (uniforms === undefined) {
            uniforms = {
              size: this.getUniformLocation(program, 'uMul'),
              bright: this.getUniformLocation(program, 'uBright'),
            };
            locations.set(program, uniforms);
          }
          if (uniforms.size) this.uniform1f(uniforms.size, mul);
          if (uniforms.bright) this.uniform1f(uniforms.bright, bright);
        }
      }
      return originalDrawArrays.call(this, mode, first, count);
    };
  }

  if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
  if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
})();
