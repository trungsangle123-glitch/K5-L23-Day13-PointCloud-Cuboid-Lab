(() => {
  'use strict';

  const KEY_SIZE = 'cvatPointBoost';
  const KEY_BRIGHT = 'cvatPointBright';
  const KEY_POS = 'cvatPointBoostPos';
  const KEY_MIN = 'cvatPointBoostMin';
  const KEY_CALIB = 'cvatPointBoostCalib';
  const KEY_PROJ = 'cvatPointBoostProjection';
  let mul = parseFloat(localStorage.getItem(KEY_SIZE)) || 3;
  let bright = parseFloat(localStorage.getItem(KEY_BRIGHT)) || 2;
  let projectionOn = localStorage.getItem(KEY_PROJ) !== '0';
  let calibration = {};
  let panelMade = false;
  let projectionButton = null;
  let statusElement = null;
  try {
    calibration = JSON.parse(localStorage.getItem(KEY_CALIB)) || {};
  } catch (_) {
    // Ignore invalid saved calibration data.
  }

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
    .tools { grid-column: 1 / -1; display: flex; gap: 6px; }
    .tools button { width: auto; height: 18px; padding: 0 5px; font-size: 11px; line-height: 18px; }
    .status { grid-column: 1 / -1; font-size: 11px; opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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

    const tools = document.createElement('div');
    tools.className = 'tools row';
    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load calib';
    loadButton.title = 'Load calib.json for the current sequence';
    projectionButton = document.createElement('button');
    projectionButton.textContent = 'Project: ' + (projectionOn ? 'on' : 'off');
    projectionButton.title = 'Toggle cuboid projection (Alt+O). When off, click a cuboid to show only it.';
    projectionButton.addEventListener('click', () => setProjection(!projectionOn));
    tools.append(loadButton, projectionButton);
    box.appendChild(tools);

    statusElement = document.createElement('div');
    statusElement.className = 'status row';
    box.appendChild(statusElement);
    refreshStatus();

    const loadCalibFiles = async (files) => {
      for (const file of Array.from(files || [])) {
        if (!/calib\.json$/i.test(file.name)) continue;
        try {
          const raw = JSON.parse(await file.text());
          const path = file.webkitRelativePath || file.name;
          const match = path.match(/sequence[_-]?(\d+)/i) || readFrameName().match(/s(\d+)f/i);
          const seq = match ? match[1].padStart(2, '0') : '01';
          calibration[seq] = normalizeCalibration(raw);
        } catch (error) {
          console.warn('[cvat-point-boost] invalid calib.json', file.name, error);
        }
      }
      localStorage.setItem(KEY_CALIB, JSON.stringify(calibration));
      calibrationVersion += 1;
      refreshStatus();
    };

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    loadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      await loadCalibFiles(fileInput.files);
      fileInput.value = '';
    });

    const folderButton = document.createElement('button');
    folderButton.textContent = 'Folder';
    folderButton.title = 'Select the data-VF folder to load all calib.json files';
    const folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.webkitdirectory = true;
    folderInput.multiple = true;
    folderInput.style.display = 'none';
    folderButton.addEventListener('click', () => folderInput.click());
    folderInput.addEventListener('change', async () => {
      await loadCalibFiles(folderInput.files);
      folderInput.value = '';
    });
    tools.appendChild(folderButton);
    root.append(fileInput, folderInput);

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
      const key = event.key.toLowerCase();
      if (event.altKey && key === 'o') {
        setProjection(!projectionOn);
        return;
      }
      if (event.altKey && key === 'p') {
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

  // ------------------------------------------------- cuboid → image projection

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BOX_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const EDGE_STEPS = 12;
  const MIN_DEPTH = 0.3;
  const PALETTE = [
    '#ffd54f', '#4fc3f7', '#ef5350', '#81c784',
    '#ba68c8', '#ffb74d', '#4dd0e1', '#f06292',
  ];
  const overlays = [];
  const canvasIds = new WeakMap();
  let nextCanvasId = 1;
  let calibrationVersion = 0;
  let lastOverlaySignature = '';
  let annotationCache = [];
  let lastFetchAt = 0;
  let fetching = false;
  let lastFrameFetched = -1;
  let lastSequence = null;
  let selectedClientID = null;
  let selectionCanvas = null;
  let storeHookDone = false;

  function setProjection(on) {
    projectionOn = !!on;
    localStorage.setItem(KEY_PROJ, projectionOn ? '1' : '0');
    if (projectionButton) {
      projectionButton.textContent = 'Project: ' + (projectionOn ? 'on' : 'off');
    }
  }

  function readFrameName() {
    const element = document.querySelector('.cvat-player-filename-wrapper');
    return element ? (element.textContent || '').trim() : '';
  }

  function currentSequence() {
    const match = readFrameName().match(/s(\d+)f/i);
    return match ? match[1].padStart(2, '0') : '';
  }

  function readFrame() {
    const input = document.querySelector('.cvat-player-frame-selector input');
    if (input && input.value !== '') return Number(input.value);
    const match = window.location.search.match(/[?&]frame=(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function getJobId() {
    const match = window.location.pathname.match(/\/jobs\/(\d+)/);
    return match ? match[1] : null;
  }

  function installStoreHook() {
    if (storeHookDone || !window.cvatUI || typeof window.cvatUI.registerComponent !== 'function') return;
    storeHookDone = true;
    try {
      window.cvatUI.registerComponent(({ store }) => {
        const readSelection = () => {
          const state = store.getState();
          const annotations = state && state.annotation && state.annotation.annotations;
          const id = annotations ? annotations.activatedStateID : null;
          if (id !== selectedClientID) {
            selectedClientID = id;
            lastOverlaySignature = '';
          }
        };
        readSelection();
        return {
          name: 'pointBoostSelectionHook',
          destructor: () => {},
          globalStateDidUpdate: readSelection,
        };
      });
    } catch (_) {
      // CVAT may change its plugin API; the canvas event listener still works.
    }
  }

  function installSelectionListener() {
    const canvas = document.querySelector('.cvat-canvas3d-perspective canvas');
    if (!canvas || selectionCanvas === canvas) return;
    selectionCanvas = canvas;
    canvas.addEventListener('canvas.selected', (event) => {
      selectedClientID = event.detail ? event.detail.clientID : null;
      lastOverlaySignature = '';
    });
  }

  function liveCuboids(frame) {
    const canvas = document.querySelector('.cvat-canvas3d-perspective canvas');
    if (!canvas || typeof canvas.getDrawnObjects !== 'function') return null;
    const objects = canvas.getDrawnObjects();
    if (!Array.isArray(objects)) return null;
    const result = objects.map((object) => {
      const data = object.data || {};
      const mesh = object.cuboid && object.cuboid.perspective;
      const state = object.state;
      if (!mesh || !mesh.visible || data.hidden ||
          (state && typeof state.frame === 'number' && state.frame !== frame)) return null;
      const position = mesh.position, rotation = mesh.rotation, scale = mesh.scale;
      return {
        id: data.clientID,
        label_id: data.labelID,
        color: data.color,
        points: [
          position.x, position.y, position.z,
          rotation.x, rotation.y, rotation.z,
          scale.x, scale.y, scale.z,
        ],
      };
    });
    const cubes = result.filter(Boolean);
    const group = canvas.scene && canvas.scene.children && canvas.scene.children[0];
    const template = group && group.children.find((child) => child.name === 'drawTemplate');
    if (template && template.visible) {
      cubes.push({
        id: 'drawTemplate',
        label_id: 0,
        color: '#ffffff',
        points: [
          template.position.x, template.position.y, template.position.z,
          template.rotation.x, template.rotation.y, template.rotation.z,
          template.scale.x, template.scale.y, template.scale.z,
        ],
      });
    }
    return cubes;
  }

  function refreshStatus() {
    if (!statusElement) return;
    const loaded = Object.keys(calibration).sort();
    const seq = currentSequence();
    statusElement.textContent = loaded.length
      ? `Calib ${loaded.join(',')} | frame ${seq || '?'} | Alt+O`
      : 'Load calib.json | Alt+P hide';
  }

  function invertRigid(t) {
    const r = [
      [t[0][0], t[1][0], t[2][0]],
      [t[0][1], t[1][1], t[2][1]],
      [t[0][2], t[1][2], t[2][2]],
    ];
    const p = r.map((row, i) => -(
      row[0] * (t[0][3] || 0) + row[1] * (t[1][3] || 0) + row[2] * (t[2][3] || 0)
    ));
    return [
      r[0].concat(p[0]), r[1].concat(p[1]), r[2].concat(p[2]), [0, 0, 0, 1],
    ];
  }

  function maxRadius2(dist) {
    const k1 = dist[0], k2 = dist[1], k3 = dist[4] || 0;
    const slope = (r2) => 1 + 3 * k1 * r2 + 5 * k2 * r2 * r2 + 7 * k3 * r2 * r2 * r2;
    const qa = 21 * k3, qb = 10 * k2, qc = 3 * k1;
    let critical = [];
    if (qa) {
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        critical = [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)];
      }
    } else if (qb) {
      critical = [-qc / qb];
    }
    const searchTo = 1e4;
    const ends = Array.from(new Set(
      critical.filter((c) => c > 0 && c < searchTo).concat(searchTo),
    )).sort((a, b) => a - b);
    let lo = 0;
    for (const hi of ends) {
      if (slope(hi) <= 1e-12) {
        let left = lo, right = hi;
        for (let i = 0; i < 100; i += 1) {
          const mid = (left + right) / 2;
          if (slope(mid) > 1e-12) left = mid; else right = mid;
        }
        return left;
      }
      lo = hi;
    }
    return Infinity;
  }

  function normalizeCalibration(raw) {
    const size = (raw.meta_info && raw.meta_info.image_size) || [1920, 1020];
    const cams = {};
    Object.entries(raw.calib || {}).forEach(([name, cam]) => {
      const dist = (cam.distortion || [0, 0, 0, 0, 0])
        .concat([0, 0, 0, 0, 0]).slice(0, 5).map(Number);
      cams[name] = {
        T: invertRigid(cam.cam_to_velo),
        K: cam.cam_intrinsic,
        D: dist,
        size,
        r2max: maxRadius2(dist),
      };
    });
    return cams;
  }

  function projectPoint(point, cam) {
    const t = cam.T;
    const xc = t[0][0] * point[0] + t[0][1] * point[1] + t[0][2] * point[2] + t[0][3];
    const yc = t[1][0] * point[0] + t[1][1] * point[1] + t[1][2] * point[2] + t[1][3];
    const zc = t[2][0] * point[0] + t[2][1] * point[1] + t[2][2] * point[2] + t[2][3];
    if (zc < MIN_DEPTH) return null;
    const a = xc / zc, b = yc / zc;
    const r2 = a * a + b * b;
    if (r2 > cam.r2max) return null;
    const k1 = cam.D[0], k2 = cam.D[1], p1 = cam.D[2], p2 = cam.D[3], k3 = cam.D[4];
    const radial = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2;
    const ad = a * radial + 2 * p1 * a * b + p2 * (r2 + 2 * a * a);
    const bd = b * radial + p1 * (r2 + 2 * b * b) + 2 * p2 * a * b;
    const k = cam.K;
    return [k[0][0] * ad + k[0][1] * bd + k[0][2], k[1][1] * bd + k[1][2]];
  }

  function boxCorners(points) {
    const x = Number(points[0]), y = Number(points[1]), z = Number(points[2]);
    const yaw = Number(points[5]);
    const length = Math.abs(Number(points[6]));
    const width = Math.abs(Number(points[7]));
    const height = Math.abs(Number(points[8]));
    const bottom = z - height / 2, top = z + height / 2;
    const hl = length / 2, hw = width / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const local = [[hl, -hw], [hl, hw], [-hl, hw], [-hl, -hw]];
    const ring = local.map(([px, py]) => [x + c * px - s * py, y + s * px + c * py]);
    return ring.map(([px, py]) => [px, py, bottom])
      .concat(ring.map(([px, py]) => [px, py, top]));
  }

  function projectBox(points, cam) {
    const width = cam.size[0], height = cam.size[1];
    const corners = boxCorners(points);
    const pieces = [];
    BOX_EDGES.forEach(([i, j]) => {
      const a = corners[i], b = corners[j];
      let line = [];
      for (let step = 0; step <= EDGE_STEPS; step += 1) {
        const f = step / EDGE_STEPS;
        const point = [
          a[0] + f * (b[0] - a[0]),
          a[1] + f * (b[1] - a[1]),
          a[2] + f * (b[2] - a[2]),
        ];
        const uv = projectPoint(point, cam);
        if (!uv) {
          if (line.length > 1) pieces.push(line);
          line = [];
        } else {
          line.push(uv);
        }
      }
      if (line.length > 1) pieces.push(line);
    });
    const margin = 0.5;
    const seen = pieces.some((piece) => piece.some(([u, v]) => (
      -margin * width <= u && u <= (1 + margin) * width &&
      -margin * height <= v && v <= (1 + margin) * height
    )));
    const inside = pieces.some((piece) => piece.some(([u, v]) => (
      u >= 0 && u < width && v >= 0 && v < height
    )));
    return seen && inside ? pieces : [];
  }

  async function fetchAnnotations(frame, now, force) {
    const jobId = getJobId();
    if (!jobId || fetching) return;
    if (!force && now - lastFetchAt < 700) return;
    fetching = true;
    lastFetchAt = now;
    try {
      const response = await fetch(`/api/jobs/${jobId}/annotations`, { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        const shapes = [];
        (data.shapes || []).forEach((shape) => {
          if (shape.type === 'cuboid' && shape.frame === frame) shapes.push(shape);
        });
        (data.tracks || []).forEach((track) => {
          let best = null;
          (track.shapes || []).forEach((shape) => {
            if (shape.type === 'cuboid' && shape.frame <= frame && (!best || shape.frame > best.frame)) {
              best = shape;
            }
          });
          if (best && frame - best.frame <= 5) {
            shapes.push(Object.assign({}, best, { label_id: track.label_id, id: track.id }));
          }
        });
        annotationCache = shapes;
      }
    } catch (_) {
      // Keep the last successful annotations on transient API errors.
    } finally {
      fetching = false;
    }
  }

  function canvasId(canvas) {
    if (!canvasIds.has(canvas)) canvasIds.set(canvas, nextCanvasId++);
    return canvasIds.get(canvas);
  }

  function cameraNameFor(canvas) {
    const wrapper = canvas.closest('.cvat-context-image-wrapper');
    const title = wrapper && wrapper.querySelector('.cvat-context-image-title');
    return title ? (title.textContent || '').trim().replace(/\.[^.]+$/, '') : '';
  }

  function overlayFor(canvas) {
    let entry = overlays.find((item) => item.canvas === canvas);
    if (!entry) {
      const wrapper = canvas.closest('.cvat-context-image-wrapper') || canvas.parentElement;
      if (wrapper && window.getComputedStyle(wrapper).position === 'static') {
        wrapper.style.position = 'relative';
      }
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('data-cvat-boost-overlay', '1');
      svg.style.cssText = 'position:absolute;pointer-events:none;z-index:2;overflow:visible;display:none;';
      (wrapper || document.body).appendChild(svg);
      entry = { canvas, svg, wrapper };
      overlays.push(entry);
    }
    return entry;
  }

  function isCanvasOnTop(canvas, rect) {
    if (rect.width < 2 || rect.height < 2) return false;
    const samples = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]];
    let hits = 0;
    samples.forEach(([fx, fy]) => {
      const x = rect.left + rect.width * fx;
      const y = rect.top + rect.height * fy;
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return;
      const top = document.elementFromPoint(x, y);
      if (top && (top === canvas || canvas.contains(top) ||
          (!!canvas.parentElement && canvas.parentElement.contains(top)))) hits += 1;
    });
    return hits >= 2;
  }

  function updateOverlays() {
    const canvases = Array.from(document.querySelectorAll('.cvat-context-image-wrapper canvas'));
    const alive = new Set(canvases);
    for (let i = overlays.length - 1; i >= 0; i -= 1) {
      if (!alive.has(overlays[i].canvas)) {
        overlays[i].svg.remove();
        overlays.splice(i, 1);
      }
    }
    const cams = calibration[currentSequence()];
    const signature = [
      projectionOn ? '1' : '0', selectedClientID === null ? '-' : selectedClientID,
      calibrationVersion, currentSequence(), lastFrameFetched,
      annotationCache.map((shape) => `${shape.id}:${shape.label_id}:${shape.color || ''}:${(shape.points || []).join(',')}`).join('|'),
      canvases.map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const wrapper = canvas.closest('.cvat-context-image-wrapper') || canvas.parentElement;
        const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };
        return `${canvasId(canvas)}:${canvas.width}x${canvas.height}:` +
          `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}:` +
          `${Math.round(wrapperRect.left)},${Math.round(wrapperRect.top)}:` +
          `${isCanvasOnTop(canvas, rect) ? '1' : '0'}:` +
          cameraNameFor(canvas);
      }).join(';'),
    ].join('#');
    if (signature === lastOverlaySignature) return;
    lastOverlaySignature = signature;
    canvases.forEach((canvas) => {
      const entry = overlayFor(canvas);
      const svg = entry.svg;
      const rect = canvas.getBoundingClientRect();
      const wrapperRect = entry.wrapper ? entry.wrapper.getBoundingClientRect() : { left: 0, top: 0 };
      const iw = canvas.width || 1920;
      const ih = canvas.height || 1020;
      const scale = rect.width && rect.height ? Math.min(rect.width / iw, rect.height / ih) : 0;
      const width = iw * scale, height = ih * scale;
      const shapes = projectionOn ? annotationCache : annotationCache.filter((shape) => (
        selectedClientID !== null && selectedClientID !== undefined &&
        String(shape.id) === String(selectedClientID)
      ));
      const visible = !!cams && !!scale && shapes.length > 0 && isCanvasOnTop(canvas, rect);
      svg.style.display = visible ? 'block' : 'none';
      svg.style.left = rect.left - wrapperRect.left + (rect.width - width) / 2 + 'px';
      svg.style.top = rect.top - wrapperRect.top + (rect.height - height) / 2 + 'px';
      svg.style.width = width + 'px';
      svg.style.height = height + 'px';
      svg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (!visible) return;
      const name = cameraNameFor(canvas);
      const cam = cams[name] || cams[Object.keys(cams).find((key) => key.toLowerCase() === name.toLowerCase())];
      if (!cam) return;
      shapes.forEach((shape) => {
        const color = shape.color || PALETTE[(Math.max(1, Number(shape.label_id) || 1) - 1) % PALETTE.length];
        projectBox(shape.points, cam).forEach((piece) => {
          const line = document.createElementNS(SVG_NS, 'polyline');
          line.setAttribute('points', piece.map(([u, v]) => `${u.toFixed(1)},${v.toFixed(1)}`).join(' '));
          line.setAttribute('fill', 'none');
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', String(Math.max(2, Math.round(iw / 600))));
          line.setAttribute('stroke-linejoin', 'round');
          line.setAttribute('stroke-linecap', 'round');
          svg.appendChild(line);
        });
      });
    });
  }

  function startProjectionLoop() {
    const tick = (now) => {
      const frame = readFrame();
      if (getJobId()) {
        makePanel();
        installSelectionListener();
        installStoreHook();
        const live = liveCuboids(frame);
        if (live !== null) {
          annotationCache = live;
        } else {
          const force = frame !== lastFrameFetched;
          if (force) lastFrameFetched = frame;
          fetchAnnotations(frame, now, force);
        }
      }
      const seq = currentSequence();
      if (seq !== lastSequence) {
        lastSequence = seq;
        refreshStatus();
      }
      updateOverlays();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  startProjectionLoop();

  if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
  if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
})();
