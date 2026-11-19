import * as THREE from 'three';

export interface ProceduralTextureSet {
  roadMap: THREE.CanvasTexture;
  hazardMap: THREE.CanvasTexture;
  boostMap: THREE.CanvasTexture;
  shadowMap: THREE.CanvasTexture;
  skyMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Track Asphalt with subtle texture, racing lane dividers, and bright curb stripes
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rctx = roadCanvas.getContext('2d')!;

  rctx.fillStyle = '#2c3645';
  rctx.fillRect(0, 0, 512, 512);

  // Fine asphalt grain
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 36 + Math.floor(Math.random() * 26);
    rctx.fillStyle = `rgb(${v},${v + 6},${v + 16})`;
    rctx.fillRect(x, y, 2, 2);
  }

  // Edge red/white racing curbs
  const stripeH = 64;
  for (let y = 0; y < 512; y += stripeH) {
    const isRed = (y / stripeH) % 2 === 0;
    rctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
    rctx.fillRect(0, y, 26, stripeH);
    rctx.fillRect(512 - 26, y, 26, stripeH);
  }

  // Crisp inner white edge rails
  rctx.fillStyle = '#e2e8f0';
  rctx.fillRect(32, 0, 6, 512);
  rctx.fillRect(512 - 38, 0, 6, 512);

  // Dashed lane separators (3-lane guidance)
  rctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  const laneX1 = 180;
  const laneX2 = 332;
  for (let y = 16; y < 512; y += 64) {
    rctx.fillRect(laneX1 - 3, y, 6, 34);
    rctx.fillRect(laneX2 - 3, y, 6, 34);
  }

  // Subtle metallic expansion joint lines
  rctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  rctx.fillRect(26, 254, 460, 4);

  const roadMap = new THREE.CanvasTexture(roadCanvas);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.repeat.set(1, 2);
  roadMap.anisotropy = maxAnisotropy;

  // 2. Hazard Chevron Texture (amber + charcoal industrial warning stripes)
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 256;
  const hctx = hazCanvas.getContext('2d')!;
  hctx.fillStyle = '#f59e0b';
  hctx.fillRect(0, 0, 256, 256);
  hctx.fillStyle = '#1e293b';
  for (let i = -256; i < 512; i += 48) {
    hctx.beginPath();
    hctx.moveTo(i, 0);
    hctx.lineTo(i + 24, 0);
    hctx.lineTo(i - 104, 256);
    hctx.lineTo(i - 128, 256);
    hctx.closePath();
    hctx.fill();
  }
  const hazardMap = new THREE.CanvasTexture(hazCanvas);
  hazardMap.colorSpace = THREE.SRGBColorSpace;
  hazardMap.wrapS = THREE.RepeatWrapping;
  hazardMap.wrapT = THREE.RepeatWrapping;
  hazardMap.anisotropy = maxAnisotropy;

  // 3. Illuminated Boost Pad Chevron Texture
  const boostCanvas = document.createElement('canvas');
  boostCanvas.width = 256;
  boostCanvas.height = 256;
  const bctx = boostCanvas.getContext('2d')!;
  const bGrad = bctx.createLinearGradient(0, 0, 0, 256);
  bGrad.addColorStop(0, '#0284c7');
  bGrad.addColorStop(0.5, '#0ea5e9');
  bGrad.addColorStop(1, '#0369a1');
  bctx.fillStyle = bGrad;
  bctx.fillRect(0, 0, 256, 256);

  bctx.strokeStyle = '#fef08a';
  bctx.lineWidth = 18;
  bctx.lineCap = 'round';
  bctx.lineJoin = 'round';
  for (let y = 55; y <= 235; y += 64) {
    bctx.beginPath();
    bctx.moveTo(42, y + 32);
    bctx.lineTo(128, y - 16);
    bctx.lineTo(214, y + 32);
    bctx.stroke();
  }
  const boostMap = new THREE.CanvasTexture(boostCanvas);
  boostMap.colorSpace = THREE.SRGBColorSpace;
  boostMap.wrapS = THREE.RepeatWrapping;
  boostMap.wrapT = THREE.RepeatWrapping;
  boostMap.anisotropy = maxAnisotropy;

  // 4. Radial Contact Shadow Disc (for grounding player beneath chassis)
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sctx = shCanvas.getContext('2d')!;
  const sGrad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  sGrad.addColorStop(0, 'rgba(10, 18, 30, 0.72)');
  sGrad.addColorStop(0.6, 'rgba(10, 18, 30, 0.34)');
  sGrad.addColorStop(1, 'rgba(10, 18, 30, 0)');
  sctx.fillStyle = sGrad;
  sctx.fillRect(0, 0, 128, 128);
  const shadowMap = new THREE.CanvasTexture(shCanvas);
  shadowMap.colorSpace = THREE.SRGBColorSpace;

  // 5. Golden-Hour Sky Dome Gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64;
  skyCanvas.height = 512;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0.0, '#1d4ed8');
  skyGrad.addColorStop(0.32, '#38bdf8');
  skyGrad.addColorStop(0.55, '#bae6fd');
  skyGrad.addColorStop(0.72, '#fde68a');
  skyGrad.addColorStop(0.84, '#fdba74');
  skyGrad.addColorStop(1.0, '#f97316');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 64, 512);
  const skyMap = new THREE.CanvasTexture(skyCanvas);
  skyMap.colorSpace = THREE.SRGBColorSpace;

  return {
    roadMap,
    hazardMap,
    boostMap,
    shadowMap,
    skyMap,
    dispose: () => {
      roadMap.dispose();
      hazardMap.dispose();
      boostMap.dispose();
      shadowMap.dispose();
      skyMap.dispose();
    },
  };
}
