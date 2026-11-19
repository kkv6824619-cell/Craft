/**
 * Generates a self-contained single-file HTML version of Turbo Tumble 3D
 * with official YouTube Playables SDK v1 hooks + Left/Right touch steering
 * (suitable for single-HTML hosts like Komma as well as YouTube Playables testing).
 */
export function buildStandaloneHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <script src="https://www.youtube.com/game_api/v1"></script>
  <title>Turbo Tumble 3D</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #132238; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #f8fafc; touch-action: none; }
    #canvas-host { position: fixed; inset: 0; z-index: 0; }
    #ui { position: fixed; inset: 0; z-index: 10; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: max(14px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
    .hud-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .panel { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 12px; padding: 8px 14px; }
    .stat-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .stat-val { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; color: #ffffff; }
    .hud-group { display: flex; gap: 10px; align-items: center; }
    .hearts { display: flex; gap: 6px; margin-top: 4px; }
    .heart { width: 15px; height: 15px; border-radius: 4px; background: #ef4444; transform: rotate(45deg); transition: opacity 0.15s; }
    .heart.empty { background: #334155; opacity: 0.45; }
    .dash-wrap { width: 116px; height: 8px; background: rgba(255,255,255,0.14); border-radius: 99px; overflow: hidden; margin-top: 6px; }
    .dash-fill { height: 100%; width: 100%; background: #38bdf8; transition: width 0.06s linear; }
    .icon-btn { pointer-events: auto; cursor: pointer; background: rgba(15, 23, 42, 0.84); border: 1px solid rgba(255,255,255,0.18); color: #f8fafc; border-radius: 10px; padding: 8px 12px; font-size: 13px; font-weight: 700; }
    .icon-btn:hover { background: rgba(30, 41, 59, 0.96); }
    #banner { align-self: center; font-weight: 800; font-size: 16px; letter-spacing: 0.04em; padding: 8px 16px; border-radius: 10px; background: rgba(15, 23, 42, 0.9); border: 2px solid #f59e0b; opacity: 0; transform: translateY(-6px); transition: opacity 0.18s, transform 0.18s; text-align: center; }
    #banner.show { opacity: 1; transform: translateY(0); }
    #chaos-bar { align-self: center; display: none; flex-direction: column; align-items: center; gap: 5px; background: rgba(15, 23, 42, 0.86); border: 1px solid rgba(255,255,255,0.16); padding: 8px 16px; border-radius: 10px; }
    #chaos-bar.show { display: flex; }
    #chaos-track { width: 180px; height: 6px; border-radius: 99px; background: rgba(255,255,255,0.18); overflow: hidden; }
    #chaos-fill { height: 100%; width: 100%; background: #f97316; }
    .overlay { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; pointer-events: auto; }
    .overlay.hidden { display: none; }
    .title-screen { justify-content: space-between; padding: 42px 24px 36px; background: linear-gradient(180deg, rgba(15,23,42,0.52) 0%, rgba(15,23,42,0.08) 45%, rgba(15,23,42,0.72) 100%); }
    .cta-btn { cursor: pointer; border: none; border-radius: 12px; padding: 14px 34px; font-size: 17px; font-weight: 800; letter-spacing: 0.03em; background: #f97316; color: #ffffff; box-shadow: 0 10px 26px rgba(249, 115, 22, 0.35); transition: transform 0.14s ease, background 0.14s ease; }
    .cta-btn:hover { background: #ea580c; transform: translateY(-1px); }
    .cta-btn:active { transform: translateY(1px); }
    .sec-btn { cursor: pointer; border: 1px solid rgba(255,255,255,0.22); border-radius: 12px; padding: 12px 22px; font-size: 14px; font-weight: 700; background: rgba(15, 23, 42, 0.86); color: #f8fafc; }
    .sec-btn:hover { background: rgba(30, 41, 59, 0.96); }
    .controls-hint { margin-top: 14px; font-size: 13px; color: #e2e8f0; letter-spacing: 0.02em; text-align: center; }
    .modal-card { width: min(420px, 92vw); background: rgba(15, 23, 42, 0.94); border: 1px solid rgba(255,255,255,0.16); border-radius: 16px; padding: 26px; text-align: center; }
    .modal-card h2 { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
    .modal-card p { color: #cbd5e1; font-size: 14px; margin-bottom: 18px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 22px; }
    .stat-box { background: rgba(30, 41, 59, 0.85); border-radius: 10px; padding: 10px 8px; }
    .stat-box .v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .stat-box .l { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .touch-controls { display: flex; pointer-events: none; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .touch-cluster { display: flex; gap: 10px; pointer-events: auto; }
    .touch-btn { min-width: 64px; height: 56px; padding: 0 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.22); background: rgba(15,23,42,0.8); color: #fff; font-weight: 800; font-size: 18px; cursor: pointer; }
    .touch-btn.active { background: #f97316; border-color: #fde68a; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.172.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.172.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="canvas-host"></div>

  <div id="ui" style="display:none">
    <div class="hud-top">
      <div class="hud-group">
        <div class="panel">
          <div class="stat-label">Score</div>
          <div class="stat-val" id="hud-score">0</div>
        </div>
        <div class="panel">
          <div class="stat-label">Dist</div>
          <div class="stat-val" id="hud-dist">0m</div>
        </div>
        <div class="panel" id="hud-combo-box" style="display:none">
          <div class="stat-label">Combo</div>
          <div class="stat-val" id="hud-combo" style="color:#facc15">x1</div>
        </div>
      </div>

      <div class="hud-group">
        <div class="panel">
          <div class="stat-label">Shields</div>
          <div class="hearts" id="hud-hearts">
            <div class="heart"></div><div class="heart"></div><div class="heart"></div>
          </div>
          <div class="dash-wrap"><div class="dash-fill" id="hud-dash"></div></div>
        </div>
        <button class="icon-btn" id="btn-mute" type="button">Sound</button>
        <button class="icon-btn" id="btn-pause" type="button">Pause</button>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
      <div id="banner">GO!</div>
      <div id="chaos-bar">
        <span id="chaos-label" style="font-size:12px;font-weight:800;letter-spacing:0.06em;">CHAOS</span>
        <div id="chaos-track"><div id="chaos-fill"></div></div>
      </div>
    </div>

    <div class="touch-controls">
      <div class="touch-cluster">
        <button class="touch-btn" id="t-left" type="button" aria-label="Move car left">&#9664;</button>
        <button class="touch-btn" id="t-right" type="button" aria-label="Move car right">&#9654;</button>
      </div>
      <div class="touch-cluster">
        <button class="touch-btn" id="t-dash" type="button" style="background:rgba(14,165,233,0.9);color:#0f172a;font-size:14px;">DASH</button>
        <button class="touch-btn" id="t-jump" type="button" style="background:rgba(249,115,22,0.95);font-size:14px;">JUMP</button>
      </div>
    </div>
  </div>

  <!-- Title Screen -->
  <div id="screen-title" class="overlay title-screen">
    <div style="text-align:center;">
      <svg width="420" height="110" viewBox="0 0 420 110" style="max-width:90vw;height:auto;" aria-label="Turbo Tumble 3D">
        <defs>
          <linearGradient id="ttGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fde047" />
            <stop offset="52%" stop-color="#f97316" />
            <stop offset="100%" stop-color="#ef4444" />
          </linearGradient>
        </defs>
        <polygon points="34,14 402,14 386,94 18,94" fill="#0f172a" fill-opacity="0.88" stroke="#f97316" stroke-width="3" />
        <text x="210" y="54" text-anchor="middle" fill="url(#ttGrad)" font-size="38" font-weight="900" font-style="italic" letter-spacing="2">TURBO TUMBLE</text>
        <text x="210" y="80" text-anchor="middle" fill="#e2e8f0" font-size="14" font-weight="700" letter-spacing="6">SKYWAY CHAOS 3D</text>
      </svg>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;">
      <button id="btn-start" class="cta-btn" type="button">Play Now</button>
      <div class="controls-hint">Touch Left/Right or A/D Steer &middot; Space / Swipe Up Jump &middot; Shift Dash-Smash &middot; Esc Pause</div>
    </div>
  </div>

  <!-- Pause Modal -->
  <div id="screen-pause" class="overlay hidden" style="background:rgba(15,23,42,0.68);">
    <div class="modal-card">
      <h2>Paused</h2>
      <p>Catch your breath before the next hammer swings.</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="btn-resume" class="cta-btn" type="button">Resume</button>
        <button id="btn-restart-pause" class="sec-btn" type="button">Restart</button>
      </div>
    </div>
  </div>

  <!-- Game Over Modal -->
  <div id="screen-over" class="overlay hidden" style="background:rgba(15,23,42,0.72);">
    <div class="modal-card">
      <h2>Run Complete</h2>
      <p id="over-reason">Wrecked by Skyway Hazard!</p>
      <div class="stats-grid">
        <div class="stat-box"><div class="v" id="over-score">0</div><div class="l">Score</div></div>
        <div class="stat-box"><div class="v" id="over-best" style="color:#facc15">0</div><div class="l">Best</div></div>
        <div class="stat-box"><div class="v" id="over-dist">0m</div><div class="l">Distance</div></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="btn-retry" class="cta-btn" type="button">Play Again</button>
        <button id="btn-title" class="sec-btn" type="button">Title</button>
      </div>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

    const YT = window.ytgame;

    // --- Procedural Web Audio ---
    const Sound = (() => {
      let ctx = null, muted = YT?.system?.isAudioEnabled ? !YT.system.isAudioEnabled() : false;
      function unlock() {
        if (muted) return;
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      }
      function setMuted(m) {
        muted = m;
        if (ctx) { if (m && ctx.state === 'running') ctx.suspend().catch(()=>{}); else if (!m && ctx.state === 'suspended') ctx.resume().catch(()=>{}); }
      }
      function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(()=>{}); }
      function resume() { if (!muted && ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); }
      function ready() { if (muted) return null; if (!ctx) unlock(); return ctx && ctx.state === 'running' ? ctx : null; }
      function tone(type, f1, f2, dur, vol = 0.14) {
        const c = ready(); if (!c) return;
        const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
      }
      return {
        unlock, setMuted, suspend, resume, isMuted: () => muted,
        toggle() { setMuted(!muted); return muted; },
        jump(dbl) { tone(dbl ? 'triangle' : 'sine', dbl ? 340 : 210, dbl ? 740 : 500, 0.16, 0.15); },
        land() { tone('sine', 120, 48, 0.09, 0.1); },
        dash() { tone('sawtooth', 190, 560, 0.2, 0.14); },
        core(combo) { const s = [523,587,659,784,880,1046,1174]; const f = s[Math.min(combo, s.length - 1)]; tone('triangle', f, f * 1.25, 0.17, 0.14); },
        boost() { tone('triangle', 330, 880, 0.22, 0.15); },
        chaos() { [261, 330, 392, 523].forEach((f, i) => setTimeout(() => tone('sawtooth', f, f * 1.05, 0.22, 0.09), i * 45)); },
        smash() { tone('square', 220, 55, 0.18, 0.18); },
        hit() { tone('sawtooth', 160, 42, 0.26, 0.2); },
        over() { [392, 349, 293, 220].forEach((f, i) => setTimeout(() => tone('triangle', f, f * 0.96, 0.24, 0.13), i * 110)); }
      };
    })();

    // --- Procedural Textures ---
    function makeTextures(maxAniso) {
      const roadC = document.createElement('canvas'); roadC.width = 512; roadC.height = 512;
      const r = roadC.getContext('2d');
      r.fillStyle = '#2c3645'; r.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 3200; i++) { const v = 36 + (Math.random() * 24 | 0); r.fillStyle = \`rgb(\${v},\${v+6},\${v+16})\`; r.fillRect(Math.random()*512, Math.random()*512, 2, 2); }
      for (let y = 0; y < 512; y += 64) { r.fillStyle = ((y/64)%2===0) ? '#ef4444' : '#f8fafc'; r.fillRect(0, y, 26, 64); r.fillRect(486, y, 26, 64); }
      r.fillStyle = '#e2e8f0'; r.fillRect(32, 0, 6, 512); r.fillRect(474, 0, 6, 512);
      r.fillStyle = 'rgba(248,250,252,0.55)'; for (let y = 16; y < 512; y += 64) { r.fillRect(177, y, 6, 34); r.fillRect(329, y, 6, 34); }
      const roadMap = new THREE.CanvasTexture(roadC); roadMap.colorSpace = THREE.SRGBColorSpace; roadMap.wrapS = roadMap.wrapT = THREE.RepeatWrapping; roadMap.repeat.set(1,2); roadMap.anisotropy = maxAniso;

      const hazC = document.createElement('canvas'); hazC.width = 256; hazC.height = 256;
      const h = hazC.getContext('2d'); h.fillStyle = '#f59e0b'; h.fillRect(0,0,256,256); h.fillStyle = '#1e293b';
      for (let i = -256; i < 512; i += 48) { h.beginPath(); h.moveTo(i,0); h.lineTo(i+24,0); h.lineTo(i-104,256); h.lineTo(i-128,256); h.closePath(); h.fill(); }
      const hazardMap = new THREE.CanvasTexture(hazC); hazardMap.colorSpace = THREE.SRGBColorSpace; hazardMap.anisotropy = maxAniso;

      const booC = document.createElement('canvas'); booC.width = 256; booC.height = 256;
      const b = booC.getContext('2d'); b.fillStyle = '#0ea5e9'; b.fillRect(0,0,256,256); b.strokeStyle = '#fef08a'; b.lineWidth = 18; b.lineCap = 'round';
      for (let y = 55; y <= 235; y += 64) { b.beginPath(); b.moveTo(42, y+32); b.lineTo(128, y-16); b.lineTo(214, y+32); b.stroke(); }
      const boostMap = new THREE.CanvasTexture(booC); boostMap.colorSpace = THREE.SRGBColorSpace; boostMap.anisotropy = maxAniso;

      const skyC = document.createElement('canvas'); skyC.width = 64; skyC.height = 512;
      const sk = skyC.getContext('2d'); const g = sk.createLinearGradient(0,0,0,512);
      g.addColorStop(0,'#1d4ed8'); g.addColorStop(0.34,'#38bdf8'); g.addColorStop(0.56,'#bae6fd'); g.addColorStop(0.75,'#fde68a'); g.addColorStop(1,'#f97316');
      sk.fillStyle = g; sk.fillRect(0,0,64,512);
      const skyMap = new THREE.CanvasTexture(skyC); skyMap.colorSpace = THREE.SRGBColorSpace;

      return { roadMap, hazardMap, boostMap, skyMap };
    }

    // --- Renderer & Scene Setup ---
    const host = document.getElementById('canvas-host');
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bd7f5);
    scene.fog = new THREE.FogExp2(0xdceefb, 0.0052);
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 420);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const tex = makeTextures(renderer.capabilities.getMaxAnisotropy());
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.MeshBasicMaterial({ map: tex.skyMap, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(skyDome);

    scene.add(new THREE.HemisphereLight(0xbbe7ff, 0x9c6b49, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
    sun.position.set(22, 36, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -32; sun.shadow.camera.right = 32; sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
    scene.add(sun); scene.add(sun.target);

    // --- Composite Player Racer ---
    function buildPlayer() {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      const hullMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.28, metalness: 0.35 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.15 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.92 });
      const visorMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.85 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.08 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });

      const s = new THREE.Shape(); s.moveTo(-0.72,-1.1); s.lineTo(0.72,-1.1); s.lineTo(0.58,0.85); s.lineTo(0.32,1.25); s.lineTo(-0.32,1.25); s.lineTo(-0.58,0.85); s.closePath();
      const hg = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 2 });
      hg.rotateX(Math.PI/2); hg.translate(0, 0.78, 0);
      const hm = new THREE.Mesh(hg, hullMat); hm.castShadow = true; body.add(hm);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 2.05), trimMat); stripe.position.set(0, 0.88, -0.05); body.add(stripe);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI*2, 0, Math.PI*0.55), visorMat); canopy.scale.set(0.95, 0.85, 1.35); canopy.position.set(0, 0.85, -0.02); body.add(canopy);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 18, Math.PI), chromeMat); cage.position.set(0, 0.86, 0.18); body.add(cage);
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.09, 0.36), trimMat); spoiler.position.set(0, 1.3, 0.88); body.add(spoiler);

      const fg = new THREE.ConeGeometry(0.19, 0.9, 10); fg.rotateX(Math.PI/2); fg.translate(0, 0, 0.45);
      const fL = new THREE.Mesh(fg, flameMat); fL.position.set(-0.36, 0.66, 1.36); body.add(fL);
      const fR = new THREE.Mesh(fg, flameMat); fR.position.set(0.36, 0.66, 1.36); body.add(fR);

      const wheels = [];
      [[-0.84,0.36,-0.74],[0.84,0.36,-0.74],[-0.9,0.4,0.68],[0.9,0.4,0.68]].forEach(([x,y,z], i) => {
        const r = i >= 2 ? 0.4 : 0.36;
        const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 16), tireMat); w.rotation.z = Math.PI/2; w.position.set(x,y,z); w.castShadow = true;
        w.add(new THREE.Mesh(new THREE.CylinderGeometry(r*0.55, r*0.55, 0.33, 10), chromeMat));
        body.add(w); wheels.push(w);
      });

      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.9, transparent: true, opacity: 0, depthWrite: false });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.55, 18, 12), shieldMat); aura.scale.set(1, 0.72, 1.28); aura.position.y = 0.78; body.add(aura);
      return { root, body, wheels, fL, fR, hullMat, shieldMat };
    }

    const player = buildPlayer();
    scene.add(player.root);

    // --- Pooled Particles ---
    const PCOUNT = 140;
    const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28,0.28,0.28), new THREE.MeshStandardMaterial({ color: 0xffffff }), PCOUNT);
    pMesh.frustumCulled = false; scene.add(pMesh);
    const parts = Array.from({ length: PCOUNT }, () => ({ active: false, x:0,y:-999,z:0, vx:0,vy:0,vz:0, life:0, max:1, size:1, col:0xffffff }));
    let pCur = 0; const dummy = new THREE.Object3D(), tmpCol = new THREE.Color();
    function burst(x, y, z, n, col, spd = 10) {
      for (let i = 0; i < n; i++) {
        const p = parts[pCur]; pCur = (pCur + 1) % PCOUNT;
        const a = Math.random() * Math.PI * 2;
        p.active = true; p.x = x; p.y = y; p.z = z;
        p.vx = Math.cos(a) * spd * (0.4 + Math.random()*0.7); p.vy = 3 + Math.random() * spd * 0.6; p.vz = Math.sin(a) * spd * (0.4 + Math.random()*0.7);
        p.max = 0.35 + Math.random() * 0.35; p.life = p.max; p.size = 0.8 + Math.random() * 0.6; p.col = col;
      }
    }

    // --- World State ---
    const SEG_LEN = 26, HALF_W = 6.4;
    const roadMat = new THREE.MeshStandardMaterial({ map: tex.roadMap, roughness: 0.72, metalness: 0.12 });
    const hazMat = new THREE.MeshStandardMaterial({ map: tex.hazardMap, roughness: 0.45, metalness: 0.22 });
    const booMat = new THREE.MeshStandardMaterial({ map: tex.boostMap, emissive: 0x0ea5e9, emissiveIntensity: 0.45 });
    const CHAOS = {
      lowg: { label: 'LOW-G MOON JUMP', accent: '#38bdf8', hex: 0x38bdf8, dur: 9 },
      overdrive: { label: 'MEGA OVERDRIVE SMASH', accent: '#f97316', hex: 0xf97316, dur: 8 },
      magnet: { label: 'HYPER CORE MAGNET', accent: '#facc15', hex: 0xfacc15, dur: 10 },
      bouncy: { label: 'TURBO BOUNCE 2X', accent: '#10b981', hex: 0x10b981, dur: 9 }
    };

    let segments = [], obstacles = [], cores = [], nextSegZ = 18, segIdx = 0;
    let phase = 'title', score = 0, best = +(localStorage.getItem('tt3d_best') || 0), dist = 0, combo = 0, comboT = 0, hearts = 3;
    let px = 0, py = 0, pz = 0, vx = 0, vy = 0, fSpeed = 30, grounded = true, coyote = 0, jumpBuf = 0, jumps = 0;
    let dashT = 0, dashCharge = 1, invuln = 0, chaosId = 'none', chaosT = 0, chaosDur = 1, shake = 0, hitstop = 0, elapsed = 0;
    const held = { l: false, r: false, u: false, d: false };
    const touchPointers = new Map();

    // Load YouTube Playables cloud best score if available
    YT?.game?.loadData?.().then(s => { try { const d = JSON.parse(s); if (d?.bestScore > best) best = d.bestScore; } catch {} }).catch(()=>{});

    // Scenic floating islands
    const islands = [];
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const rad = 6 + (i % 4) * 2.4;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(rad, rad * 1.4, 7), new THREE.MeshStandardMaterial({ color: 0xd97757, flatShading: true, roughness: 0.88 }));
      rock.rotation.x = Math.PI; rock.position.y = -rad * 0.7; g.add(rock);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.94, 1.3, 7), new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.75 }));
      top.position.y = 0.6; g.add(top);
      g.position.set((i % 2 === 0 ? -1 : 1) * (24 + (i % 4) * 10), -8 + (i % 4) * 4, 20 - i * 36);
      scene.add(g); islands.push(g);
    }

    function clearTrack() {
      segments.forEach(s => scene.remove(s.g)); segments = [];
      obstacles.forEach(o => scene.remove(o.g)); obstacles = [];
      cores.forEach(c => scene.remove(c.g)); cores = [];
    }

    function spawnSeg() {
      const zStart = nextSegZ, zEnd = zStart - SEG_LEN; nextSegZ = zEnd;
      const idx = segIdx++, diff = Math.min(1, idx / 34);
      const g = new THREE.Group();
      const hasGap = idx >= 4 && idx % 5 === 0;
      let gapS = 0, gapE = 0;
      if (hasGap) {
        const gapLen = 8.5 + diff * 3.2, p1 = (SEG_LEN - gapLen) * 0.52, p2 = SEG_LEN - gapLen - p1;
        gapS = zStart - p1; gapE = gapS - gapLen;
        const m1 = new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2, 1.2, p1), roadMat); m1.position.set(0, -0.6, zStart - p1/2); m1.receiveShadow = true; g.add(m1);
        const m2 = new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2, 1.2, p2), roadMat); m2.position.set(0, -0.6, gapE - p2/2); m2.receiveShadow = true; g.add(m2);
        const rx = ((Math.random()*3|0)-1) * 3.0;
        const rg = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.4, 5.4), booMat); rg.rotation.x = 0.24; rg.position.set(rx, 0.55, gapS + 2.8); scene.add(rg);
        obstacles.push({ kind: 'ramp', g: rg, x: rx, y: 0, z: gapS + 2.8, trig: false });
      } else {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2, 1.2, SEG_LEN), roadMat); deck.position.set(0, -0.6, zStart - SEG_LEN/2); deck.receiveShadow = true; g.add(deck);
      }
      scene.add(g); segments.push({ g, zStart, zEnd, hasGap, gapS, gapE });

      if (idx >= 2 && !hasGap) {
        const midZ = zStart - SEG_LEN * 0.5;
        if (idx % 4 === 0) {
          const keys = Object.keys(CHAOS), cid = keys[(Math.random()*keys.length)|0], meta = CHAOS[cid];
          const rx = ((Math.random()*3|0)-1) * 2.8;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.25, 10, 26), new THREE.MeshStandardMaterial({ color: meta.hex, emissive: meta.hex, emissiveIntensity: 0.65 }));
          ring.position.set(rx, 2.9, midZ); scene.add(ring);
          obstacles.push({ kind: 'chaos', g: ring, x: rx, y: 0, z: midZ, cid, trig: false });
        } else {
          const r = Math.random();
          if (r < 0.35) {
            const hg = new THREE.Group(); hg.position.set(0, 0, midZ);
            const beam = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.75, 0.85), hazMat); beam.position.y = 7.4; hg.add(beam);
            const piv = new THREE.Group(); piv.position.y = 7.2; hg.add(piv);
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,5.8,10), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })); shaft.position.y = -2.9; piv.add(shaft);
            const head = new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,2.7,14), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })); head.rotation.z = Math.PI/2; head.position.y = -5.85; head.castShadow = true; piv.add(head);
            scene.add(hg); obstacles.push({ kind: 'hammer', g: hg, piv, x: 0, y: 1.35, z: midZ, ph: Math.random()*6, spd: 1.85 + diff * 1.1 });
          } else if (r < 0.68) {
            const cg = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 1.35), hazMat); cg.position.set(0, 1.15, midZ); cg.castShadow = true; scene.add(cg);
            obstacles.push({ kind: 'crusher', g: cg, x: 0, y: 1.15, z: midZ, ph: Math.random()*6, spd: 1.7 + diff * 1.2 });
          } else {
            const bx = ((Math.random()*3|0)-1) * 3.6;
            const bg = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: 0x475569, emissive: 0xea580c, emissiveIntensity: 0.35, flatShading: true }));
            bg.position.set(bx, 1.32, midZ); bg.castShadow = true; scene.add(bg);
            obstacles.push({ kind: 'boulder', g: bg, x: bx, y: 1.32, z: midZ, vz: 11 + diff * 8 });
          }
        }
        const cl = ((Math.random()*3|0)-1) * 3.1;
        for (let c = 0; c < 3; c++) {
          const cz = zStart - 5 - c * 6.5;
          const cg = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.45, metalness: 0.85, roughness: 0.18 }));
          cg.position.set(cl, 1.25, cz); scene.add(cg); cores.push({ g: cg, x: cl, y: 1.25, z: cz, ph: c, got: false });
        }
      }
    }

    // --- UI References ---
    const elUi = document.getElementById('ui'), elTitle = document.getElementById('screen-title'), elPause = document.getElementById('screen-pause'), elOver = document.getElementById('screen-over');
    const elScore = document.getElementById('hud-score'), elDist = document.getElementById('hud-dist'), elComboBox = document.getElementById('hud-combo-box'), elCombo = document.getElementById('hud-combo');
    const elHearts = document.getElementById('hud-hearts').children, elDash = document.getElementById('hud-dash');
    const elBanner = document.getElementById('banner'), elChaosBar = document.getElementById('chaos-bar'), elChaosLbl = document.getElementById('chaos-label'), elChaosFill = document.getElementById('chaos-fill');
    const btnLeft = document.getElementById('t-left'), btnRight = document.getElementById('t-right'), btnMute = document.getElementById('btn-mute');
    btnMute.textContent = Sound.isMuted() ? 'Muted' : 'Sound';

    let bannerT = 0;
    function showBanner(msg, col = '#f59e0b', dur = 1.8) { elBanner.textContent = msg; elBanner.style.borderColor = col; elBanner.classList.add('show'); bannerT = dur; }

    function resetWorld() {
      clearTrack(); nextSegZ = 18; segIdx = 0; for (let i = 0; i < 14; i++) spawnSeg();
      px = py = pz = vx = vy = score = dist = combo = comboT = dashT = invuln = chaosT = shake = hitstop = 0;
      fSpeed = 30; grounded = true; hearts = 3; dashCharge = 1; chaosId = 'none';
      touchPointers.clear(); held.l = held.r = held.u = held.d = false;
      player.root.position.set(0,0,0); player.shieldMat.opacity = 0;
    }

    function setPhase(p) {
      phase = p;
      elTitle.classList.toggle('hidden', p !== 'title');
      elPause.classList.toggle('hidden', p !== 'paused');
      elOver.classList.toggle('hidden', p !== 'gameover');
      elUi.style.display = p === 'playing' || p === 'paused' ? 'flex' : 'none';
    }

    function startGame() { Sound.unlock(); resetWorld(); setPhase('playing'); showBanner('GO! TOUCH LEFT/RIGHT TO STEER!', '#f59e0b', 1.8); Sound.boost(); }
    function endGame(reason) {
      setPhase('gameover'); Sound.over();
      const fs = Math.floor(score);
      if (fs > best) {
        best = fs;
        try { localStorage.setItem('tt3d_best', best); } catch {}
        YT?.game?.saveData?.(JSON.stringify({ bestScore: best })).catch(()=>{});
      }
      YT?.engagement?.sendScore?.({ value: fs }).catch(()=>{});
      document.getElementById('over-reason').textContent = reason;
      document.getElementById('over-score').textContent = fs.toLocaleString();
      document.getElementById('over-best').textContent = best.toLocaleString();
      document.getElementById('over-dist').textContent = Math.floor(dist) + 'm';
    }

    function doDash() {
      if (phase !== 'playing' || dashCharge < 1 || dashT > 0) return;
      Sound.unlock(); dashCharge = 0; dashT = 0.42; shake = Math.min(1, shake + 0.35);
      Sound.dash(); burst(px, py + 0.7, pz + 1.2, 20, 0x38bdf8, 12);
    }

    // YouTube Playables Lifecycle Hooks
    YT?.system?.onPause?.(() => { Sound.suspend(); if (phase === 'playing') setPhase('paused'); });
    YT?.system?.onResume?.(() => { Sound.resume(); last = performance.now(); });
    YT?.system?.onAudioEnabledChange?.((enabled) => { Sound.setMuted(!enabled); btnMute.textContent = enabled ? 'Sound' : 'Muted'; });

    document.getElementById('btn-start').onclick = startGame;
    document.getElementById('btn-retry').onclick = startGame;
    document.getElementById('btn-restart-pause').onclick = startGame;
    document.getElementById('btn-resume').onclick = () => setPhase('playing');
    document.getElementById('btn-title').onclick = () => { resetWorld(); setPhase('title'); };
    document.getElementById('btn-pause').onclick = () => setPhase(phase === 'playing' ? 'paused' : 'playing');
    btnMute.onclick = () => { const m = Sound.toggle(); btnMute.textContent = m ? 'Muted' : 'Sound'; };

    // Left / Right Touch Buttons with instant impulse
    const bindSteerBtn = (el, side) => {
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); Sound.unlock();
        if (side === 'l') { held.l = true; vx = Math.min(vx, -13.5); }
        else { held.r = true; vx = Math.max(vx, 13.5); }
      });
      const release = () => { if (side === 'l') held.l = false; else held.r = false; };
      el.addEventListener('pointerup', release); el.addEventListener('pointerleave', release); el.addEventListener('pointercancel', release);
    };
    bindSteerBtn(btnLeft, 'l');
    bindSteerBtn(btnRight, 'r');
    document.getElementById('t-jump').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (phase === 'playing') jumpBuf = 0.14; });
    document.getElementById('t-dash').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doDash(); });

    // Direct Left / Right half-screen touch steering + swipe up/down on canvas
    renderer.domElement.addEventListener('pointerdown', e => {
      if (phase !== 'playing') return;
      e.preventDefault(); Sound.unlock();
      const side = e.clientX < window.innerWidth * 0.5 ? 'l' : 'r';
      touchPointers.set(e.pointerId, { side, startY: e.clientY, swiped: false });
      vx = (side === 'r' ? 1 : -1) * Math.max(Math.abs(vx), 13.5);
    });
    window.addEventListener('pointermove', e => {
      const p = touchPointers.get(e.pointerId); if (!p || phase !== 'playing') return;
      const dy = e.clientY - p.startY;
      if (!p.swiped && dy < -48) { p.swiped = true; jumpBuf = 0.14; }
      else if (!p.swiped && dy > 56) { p.swiped = true; doDash(); }
      p.side = e.clientX < window.innerWidth * 0.5 ? 'l' : 'r';
    });
    const endPtr = e => touchPointers.delete(e.pointerId);
    window.addEventListener('pointerup', endPtr);
    window.addEventListener('pointercancel', endPtr);

    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (phase === 'playing' || phase === 'paused') setPhase(phase === 'playing' ? 'paused' : 'playing'); return; }
      if ((phase === 'title' || phase === 'gameover') && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startGame(); return; }
      if (phase !== 'playing') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') held.l = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') held.r = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') held.u = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') held.d = true;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); jumpBuf = 0.14; }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); doDash(); }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') held.l = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') held.r = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') held.u = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') held.d = false;
    });
    window.addEventListener('blur', () => { held.l = held.r = held.u = held.d = false; touchPointers.clear(); });
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

    function groundSolid(x, z) {
      for (const s of segments) {
        if (z <= s.zStart + 0.5 && z >= s.zEnd - 0.5) {
          if (Math.abs(x) > HALF_W + 0.55) return false;
          if (s.hasGap && z < s.gapS - 0.35 && z > s.gapE + 0.35) return false;
          return true;
        }
      }
      return true;
    }

    function hitObs(o, ix) {
      if (dashT > 0 || chaosId === 'overdrive') {
        o.dead = true; scene.remove(o.g); score += 250; hitstop = 0.05; shake = 0.55; Sound.smash(); burst(o.x, o.y + 1, o.z, 28, 0xf97316, 15); showBanner('SMASHED! +250', '#f97316', 1.2); return;
      }
      if (invuln > 0) return;
      hearts--; combo = 0; invuln = 1.4; hitstop = 0.06; shake = 0.9; Sound.hit();
      vx = (px >= ix ? 1 : -1) * 13; vy = Math.max(vy, 9.5); grounded = false; burst(px, py + 0.8, pz, 24, 0xef4444, 13);
      if (hearts <= 0) endGame('Wrecked by Skyway Hazard!');
    }

    resetWorld(); setPhase('title');
    let last = performance.now(), firstFrameSent = false;
    YT?.game?.gameReady?.();

    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now(), dt = Math.min((now - last)/1000, 0.05); last = now;
      if (hitstop > 0) { hitstop -= dt; renderer.render(scene, camera); return; }
      elapsed += dt;
      skyDome.position.set(px, 0, pz);
      islands.forEach(is => { if (is.position.z > pz + 55) is.position.z -= 360; });

      const portrait = Math.max(0, Math.min(1, (1.15 - camera.aspect) / 0.65));

      if (phase === 'title') {
        const a = Math.sin(elapsed * 0.35) * 0.55;
        camera.position.set(Math.sin(a) * (9.5 - portrait * 2.5) + 2, 4.4 + portrait * 1.4, 8.8 + portrait * 3.8);
        camera.lookAt(0, 1.4, -7.5);
        camera.fov = 58 + portrait * 14; camera.updateProjectionMatrix();
        obstacles.forEach(o => { if (o.kind === 'hammer') o.piv.rotation.z = Math.sin(elapsed * o.spd + o.ph) * 0.92; });
        renderer.render(scene, camera);
        if (!firstFrameSent) { firstFrameSent = true; YT?.game?.firstFrameReady?.(); }
        return;
      }

      if (phase === 'playing') {
        if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) elBanner.classList.remove('show'); }
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
        if (invuln > 0) invuln -= dt;
        if (dashT > 0) dashT -= dt;
        dashCharge = Math.min(1, dashCharge + dt * 0.28);
        if (chaosId !== 'none') {
          chaosT -= dt;
          if (chaosT <= 0) { chaosId = 'none'; player.shieldMat.opacity = 0; }
          else player.shieldMat.opacity = 0.24 + Math.sin(elapsed * 12) * 0.07;
        }

        let touchL = false, touchR = false;
        touchPointers.forEach(p => { if (p.side === 'l') touchL = true; else touchR = true; });
        const steerL = held.l || touchL, steerR = held.r || touchR;
        btnLeft.classList.toggle('active', steerL && !steerR);
        btnRight.classList.toggle('active', steerR && !steerL);

        let tSpd = 30 + Math.min(1, dist / 1600) * 22 + (held.u ? 8 : 0) - (held.d ? 9 : 0) + (chaosId === 'overdrive' ? 14 : 0) + (dashT > 0 ? 25 : 0);
        fSpeed += (tSpd - fSpeed) * Math.min(1, dt * 6);
        const steer = (steerR ? 1 : 0) - (steerL ? 1 : 0);
        vx += (steer * 18 - vx) * Math.min(1, dt * 14);
        px += vx * dt; pz -= fSpeed * dt; dist += fSpeed * dt;
        score += fSpeed * dt * 1.2 * (1 + Math.min(4, combo >> 2)) * (chaosId === 'bouncy' ? 2 : 1);

        if (grounded) { coyote = 0.12; jumps = 0; } else coyote -= dt;
        if (jumpBuf > 0) {
          jumpBuf -= dt;
          const jp = chaosId === 'lowg' ? 18.8 : 15.8;
          if (coyote > 0) { vy = jp; grounded = false; coyote = 0; jumpBuf = 0; jumps = 1; Sound.jump(false); }
          else if (jumps < 2) { vy = jp * 0.92; jumpBuf = 0; jumps = 2; Sound.jump(true); burst(px, py + 0.3, pz, 12, 0x38bdf8, 8); }
        }
        vy += (chaosId === 'lowg' ? -24 : -42) * dt;
        const prevY = py; py += vy * dt;
        const solid = groundSolid(px, pz);
        if (solid && prevY >= -0.35 && py <= 0 && vy <= 0) {
          if (!grounded && vy < -5) Sound.land();
          py = 0;
          if (chaosId === 'bouncy' && Math.abs(vy) > 9) { vy = 13.5; grounded = false; Sound.jump(false); }
          else { vy = 0; grounded = true; }
        } else if (!solid && py <= 0) grounded = false;

        if (py < -13) { endGame('Fell off the Skyway!'); return; }

        while (nextSegZ > pz - 14 * SEG_LEN) spawnSeg();
        while (segments.length && segments[0].zEnd > pz + 30) scene.remove(segments.shift().g);

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          if (o.dead || o.z > pz + 28) { if (!o.dead) scene.remove(o.g); obstacles.splice(i, 1); continue; }
          if (o.kind === 'hammer') {
            const a = Math.sin(elapsed * o.spd + o.ph) * 0.96; o.piv.rotation.z = a;
            const hx = Math.sin(a) * 5.85, hy = 7.2 - Math.cos(a) * 5.85; o.x = hx; o.y = hy;
            if (Math.abs(pz - o.z) < 1.55 && Math.abs(px - hx) < 1.85 && Math.abs(py + 0.75 - hy) < 1.35) hitObs(o, hx);
          } else if (o.kind === 'crusher') {
            o.x = Math.sin(elapsed * o.spd + o.ph) * 4.0; o.g.position.x = o.x;
            if (Math.abs(pz - o.z) < 1.55 && Math.abs(px - o.x) < 2.55 && py < 2.25) hitObs(o, o.x);
          } else if (o.kind === 'boulder') {
            o.z += o.vz * dt; o.g.position.z = o.z; o.g.rotation.x += o.vz * dt * 0.8;
            if ((px-o.x)**2 + (py+0.7-o.y)**2 + (pz-o.z)**2 < 4.1) hitObs(o, o.x);
          } else if (o.kind === 'ramp' && !o.trig && Math.abs(pz - o.z) < 2.4 && Math.abs(px - o.x) < 2.0 && py < 2) {
            o.trig = true; vy = 20.5; grounded = false; jumps = 1; fSpeed += 12; score += 120; Sound.boost(); showBanner('MEGA SKY LAUNCH! +120', '#0ea5e9', 1.3);
          } else if (o.kind === 'chaos') {
            o.g.rotation.z += dt * 1.8;
            if (!o.trig && Math.abs(pz - o.z) < 1.8 && Math.abs(px - o.x) < 2.8 && py < 5.2) {
              o.trig = true; const m = CHAOS[o.cid]; chaosId = o.cid; chaosDur = chaosT = m.dur; score += 150;
              player.shieldMat.color.setHex(m.hex); player.shieldMat.emissive.setHex(m.hex);
              Sound.chaos(); burst(px, py + 1.3, pz, 28, m.hex, 12); showBanner('CHAOS RING: ' + m.label, m.accent, 2.2);
            }
          }
        }

        for (let i = cores.length - 1; i >= 0; i--) {
          const c = cores[i];
          if (c.got || c.z > pz + 24) { if (!c.got) scene.remove(c.g); cores.splice(i, 1); continue; }
          c.g.rotation.y += dt * 3; c.g.position.y = c.y + Math.sin(elapsed * 4 + c.ph) * 0.24;
          if (chaosId === 'magnet') {
            const dx = px - c.x, dy = py + 0.8 - c.y, dz = pz - c.z;
            if (dx*dx + dy*dy + dz*dz < 225) { c.x += dx*dt*10; c.y += dy*dt*10; c.z += dz*dt*10; c.g.position.set(c.x, c.y, c.z); }
          }
          if ((px-c.x)**2 + (py+0.75-c.g.position.y)**2 + (pz-c.z)**2 < 3.1) {
            c.got = true; scene.remove(c.g); combo++; comboT = 3.2; score += 50 + combo * 10; dashCharge = Math.min(1, dashCharge + 0.16);
            Sound.core(combo); burst(c.x, c.g.position.y, c.z, 10, 0xfacc15, 7);
          }
        }

        player.root.position.set(px, py, pz);
        player.body.rotation.set(grounded ? 0 : Math.max(-0.35, Math.min(0.4, vy*0.024)), -vx*0.015, Math.max(-0.35, Math.min(0.35, -vx*0.022)));
        player.root.visible = invuln <= 0 || ((elapsed * 22 | 0) % 2 === 0);
        player.wheels.forEach(w => w.rotation.x -= fSpeed * dt * 2);
        const fl = dashT > 0 ? 1.9 : 0.9 + Math.sin(elapsed * 30) * 0.15;
        player.fL.scale.set(1, 1, fl); player.fR.scale.set(1, 1, fl);

        sun.position.set(px + 22, 36, pz + 18); sun.target.position.set(px, 0, pz - 12); sun.target.updateMatrixWorld();
        shake = Math.max(0, shake - dt * 1.9);
        const sh = shake * shake;
        camera.position.lerp(new THREE.Vector3(px * 0.72 + (Math.random()-0.5)*sh, Math.max(4.6, py*0.55+4.9+portrait*1.6) + (Math.random()-0.5)*sh, pz + 10.6 + portrait * 4.2), Math.min(1, dt * 9));
        camera.lookAt(px * 0.45, Math.max(0.8, py * 0.45 + 1.4), pz - 14);
        const tfov = 62 + portrait * 14 + Math.min(1, (fSpeed - 28)/40) * 18 + (dashT > 0 ? 7 : 0);
        camera.fov += (tfov - camera.fov) * Math.min(1, dt * 7); camera.updateProjectionMatrix();

        // Update HUD
        elScore.textContent = Math.floor(score).toLocaleString();
        elDist.textContent = Math.floor(dist) + 'm';
        elComboBox.style.display = combo > 1 ? 'block' : 'none';
        elCombo.textContent = 'x' + combo;
        for (let h = 0; h < 3; h++) elHearts[h].className = h < hearts ? 'heart' : 'heart empty';
        elDash.style.width = Math.round(dashCharge * 100) + '%';
        if (chaosId !== 'none') {
          const m = CHAOS[chaosId];
          elChaosBar.classList.add('show'); elChaosLbl.textContent = m.label; elChaosLbl.style.color = m.accent;
          elChaosFill.style.background = m.accent; elChaosFill.style.width = Math.max(0, (chaosT / chaosDur) * 100) + '%';
        } else elChaosBar.classList.remove('show');
      }

      // Particles
      let dirty = false;
      for (let i = 0; i < PCOUNT; i++) {
        const p = parts[i]; if (!p.active) continue; dirty = true;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; dummy.position.set(0,-999,0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); pMesh.setMatrixAt(i, dummy.matrix); continue; }
        p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(p.size * (p.life / p.max)); dummy.updateMatrix();
        pMesh.setMatrixAt(i, dummy.matrix); pMesh.setColorAt(i, tmpCol.setHex(p.col));
      }
      if (dirty) { pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true; }

      renderer.render(scene, camera);
      if (!firstFrameSent) { firstFrameSent = true; YT?.game?.firstFrameReady?.(); }
    }
    tick();
  </script>
</body>
</html>`;
}

export function downloadStandaloneHtml(filename = 'turbo-tumble-3d-playables.html'): number {
  const html = buildStandaloneHtml();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}
