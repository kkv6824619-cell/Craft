import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface PlayerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Mesh[];
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  turboFan: THREE.Group;
  auraMesh: THREE.Mesh;
  shieldMaterial: THREE.MeshStandardMaterial;
  hullMaterial: THREE.MeshStandardMaterial;
}

/**
 * Builds a composite 10-part Rocket Gyro-Racer anchored at bottom-center (y = 0 at tire contact).
 */
export function createPlayerRacer(): PlayerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    roughness: 0.28,
    metalness: 0.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.32,
    metalness: 0.15,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.52,
    metalness: 0.78,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.92,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.88,
    metalness: 0.08,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });

  // 1. Primary sculpted chassis hull (extruded aerodynamic wedge profile)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.72, -1.1);
  hullShape.lineTo(0.72, -1.1);
  hullShape.lineTo(0.58, 0.85);
  hullShape.lineTo(0.32, 1.25);
  hullShape.lineTo(-0.32, 1.25);
  hullShape.lineTo(-0.58, 0.85);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.78, 0);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // 2. White racing nose cowl stripe
  const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 2.05), trimMat);
  stripeMesh.position.set(0, 0.88, -0.05);
  stripeMesh.castShadow = true;
  bodyGroup.add(stripeMesh);

  // 3. Cockpit canopy visor
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), visorMat);
  canopy.scale.set(0.95, 0.85, 1.35);
  canopy.position.set(0, 0.85, -0.02);
  canopy.castShadow = true;
  bodyGroup.add(canopy);

  // 4. Tubular roll cage arch
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 10, 22, Math.PI), chromeMat);
  cage.position.set(0, 0.86, 0.18);
  cage.castShadow = true;
  bodyGroup.add(cage);

  // 5. Front chrome shock bumper
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.24, 12), chromeMat);
  bumper.rotation.z = Math.PI / 2;
  bumper.position.set(0, 0.46, -1.25);
  bumper.castShadow = true;
  bodyGroup.add(bumper);

  // 6. Twin stabilizer rear wing fins + crossbar
  const finGeo = new THREE.BoxGeometry(0.08, 0.56, 0.65);
  const leftFin = new THREE.Mesh(finGeo, hullMat);
  leftFin.position.set(-0.68, 1.05, 0.82);
  leftFin.rotation.z = 0.18;
  leftFin.castShadow = true;
  bodyGroup.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo, hullMat);
  rightFin.position.set(0.68, 1.05, 0.82);
  rightFin.rotation.z = -0.18;
  rightFin.castShadow = true;
  bodyGroup.add(rightFin);

  const spoilerBar = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.09, 0.36), trimMat);
  spoilerBar.position.set(0, 1.3, 0.88);
  spoilerBar.rotation.x = 0.14;
  spoilerBar.castShadow = true;
  bodyGroup.add(spoilerBar);

  // 7. Twin rear rocket thruster nozzles + dynamic exhaust flame cones
  const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.46, 14);
  nozzleGeo.rotateX(Math.PI / 2);
  const leftNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
  leftNozzle.position.set(-0.36, 0.66, 1.18);
  leftNozzle.castShadow = true;
  bodyGroup.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
  rightNozzle.position.set(0.36, 0.66, 1.18);
  rightNozzle.castShadow = true;
  bodyGroup.add(rightNozzle);

  const flameGeo = new THREE.ConeGeometry(0.19, 0.9, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.45);
  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.36, 0.66, 1.36);
  bodyGroup.add(flameLeft);

  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.position.set(0.36, 0.66, 1.36);
  bodyGroup.add(flameRight);

  // 8. Spinning top turbo intake fan
  const turboFan = new THREE.Group();
  turboFan.position.set(0, 1.02, 0.62);
  const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14), darkMetalMat);
  fanHousing.rotation.x = Math.PI / 2;
  turboFan.add(fanHousing);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.04), chromeMat);
    blade.rotation.z = (i * Math.PI) / 4;
    turboFan.add(blade);
  }
  bodyGroup.add(turboFan);

  // 9. Four oversized spring wheels with metallic hubs (bottom-center touches y = 0)
  const wheels: THREE.Mesh[] = [];
  const wheelCoords: [number, number, number][] = [
    [-0.84, 0.36, -0.74],
    [0.84, 0.36, -0.74],
    [-0.9, 0.4, 0.68],
    [0.9, 0.4, 0.68],
  ];
  wheelCoords.forEach(([wx, wy, wz], i) => {
    const r = i >= 2 ? 0.4 : 0.36;
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 18), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, 0.33, 12), chromeMat);
    tire.add(hub);
    const lug = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, 0.35, 0.08), hullMat);
    tire.add(lug);
    bodyGroup.add(tire);
    wheels.push(tire);
  });

  // 10. Chaos / Overdrive energy aura shell (toggled during active chaos modes)
  const shieldMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.0,
    roughness: 0.2,
    metalness: 0.1,
    depthWrite: false,
  });
  const auraMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 14), shieldMaterial);
  auraMesh.scale.set(1, 0.72, 1.28);
  auraMesh.position.set(0, 0.78, 0);
  bodyGroup.add(auraMesh);

  return {
    root,
    bodyGroup,
    wheels,
    flameLeft,
    flameRight,
    turboFan,
    auraMesh,
    shieldMaterial,
    hullMaterial: hullMat,
  };
}

/**
 * Composite 6-part sweeping pendulum bumper hammer hazard.
 */
export function createSweepingHammer(textures: ProceduralTextureSet): {
  group: THREE.Group;
  armPivot: THREE.Group;
} {
  const group = new THREE.Group();

  const hazardMat = new THREE.MeshStandardMaterial({
    map: textures.hazardMap,
    roughness: 0.45,
    metalness: 0.2,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.82,
  });
  const redHeadMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.28,
    metalness: 0.3,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    metalness: 0.4,
  });

  // Overhead gantry frame spanning track width
  const pillarGeo = new THREE.BoxGeometry(0.75, 7.6, 0.75);
  const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
  leftPillar.position.set(-7.2, 3.8, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
  rightPillar.position.set(7.2, 3.8, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.85, 0.9), hazardMat);
  topBeam.position.set(0, 7.6, 0);
  topBeam.castShadow = true;
  group.add(topBeam);

  // Pivoting hammer arm suspended from top beam
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 7.2, 0);
  group.add(armPivot);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 16), capMat);
  hub.rotation.x = Math.PI / 2;
  armPivot.add(hub);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.7, 12), steelMat);
  shaft.position.set(0, -2.85, 0);
  shaft.castShadow = true;
  armPivot.add(shaft);

  const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.7, 18), redHeadMat);
  mallet.rotation.z = Math.PI / 2;
  mallet.position.set(0, -5.85, 0);
  mallet.castShadow = true;
  armPivot.add(mallet);

  const endCapL = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, 0.32, 18), capMat);
  endCapL.rotation.z = Math.PI / 2;
  endCapL.position.set(-1.35, -5.85, 0);
  armPivot.add(endCapL);

  const endCapR = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, 0.32, 18), capMat);
  endCapR.rotation.z = Math.PI / 2;
  endCapR.position.set(1.35, -5.85, 0);
  armPivot.add(endCapR);

  return { group, armPivot };
}

/**
 * Composite rolling magma-stone boulder hazard.
 */
export function createBoulder(): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
    metalness: 0.14,
    flatShading: true,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.2,
  });

  const outer = new THREE.Mesh(new THREE.DodecahedronGeometry(1.32, 0), stoneMat);
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);

  const glowCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 0), coreMat);
  glowCore.rotation.set(0.4, 0.7, 0.2);
  group.add(glowCore);

  // Embedded crystalline ridges
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), coreMat);
    const angle = (i / 4) * Math.PI * 2;
    spike.position.set(Math.cos(angle) * 1.05, Math.sin(angle) * 0.4, Math.sin(angle) * 1.05);
    group.add(spike);
  }

  return group;
}

/**
 * Composite 5-part glowing boost ramp.
 */
export function createBoostRamp(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();

  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(0, 0);
  wedgeShape.lineTo(5.6, 0);
  wedgeShape.lineTo(5.6, 1.55);
  wedgeShape.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: 3.4,
    bevelEnabled: false,
  });
  wedgeGeo.rotateY(Math.PI / 2);
  wedgeGeo.translate(-1.7, 0, 2.8);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.7,
  });
  const body = new THREE.Mesh(wedgeGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.boostMap,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.25,
  });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.82), deckMat);
  deck.rotation.x = -Math.PI / 2 + Math.atan2(1.55, 5.6);
  deck.position.set(0, 0.82, 0.0);
  group.add(deck);

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.5,
  });
  const railGeo = new THREE.BoxGeometry(0.16, 0.22, 5.75);
  const leftRail = new THREE.Mesh(railGeo, railMat);
  leftRail.position.set(-1.66, 0.88, 0);
  leftRail.rotation.x = Math.atan2(1.55, 5.6);
  group.add(leftRail);

  const rightRail = new THREE.Mesh(railGeo, railMat);
  rightRail.position.set(1.66, 0.88, 0);
  rightRail.rotation.x = Math.atan2(1.55, 5.6);
  group.add(rightRail);

  return group;
}

/**
 * Composite sliding hydraulic crusher barrier.
 */
export function createCrusherBarrier(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();

  const hazardMat = new THREE.MeshStandardMaterial({
    map: textures.hazardMap,
    roughness: 0.45,
    metalness: 0.22,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.78,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.2,
  });

  const block = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 1.35), hazardMat);
  block.position.y = 1.15;
  block.castShadow = true;
  block.receiveShadow = true;
  group.add(block);

  const capTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 1.5), metalMat);
  capTop.position.y = 2.34;
  capTop.castShadow = true;
  group.add(capTop);

  const capBot = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 1.5), metalMat);
  capBot.position.y = 0.11;
  group.add(capBot);

  const beaconL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 12), beaconMat);
  beaconL.position.set(-1.6, 2.62, 0);
  group.add(beaconL);

  const beaconR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 12), beaconMat);
  beaconR.position.set(1.6, 2.62, 0);
  group.add(beaconR);

  return group;
}

/**
 * Composite 4-part collectible Golden Sky-Core.
 */
export function createSkyCore(): THREE.Group {
  const group = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.16,
    metalness: 0.88,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 0.5,
    roughness: 0.22,
    metalness: 0.6,
  });

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), goldMat);
  crystal.castShadow = true;
  group.add(crystal);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.075, 8, 20), ringMat);
  ring.rotation.x = Math.PI / 3;
  group.add(ring);

  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 6), ringMat);
  capTop.position.y = 0.72;
  group.add(capTop);

  const capBot = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 6), ringMat);
  capBot.rotation.x = Math.PI;
  capBot.position.y = -0.72;
  group.add(capBot);

  return group;
}

/**
 * Composite 5-part Giant Chaos Ring portal.
 */
export function createChaosRing(colorHex: number): {
  group: THREE.Group;
  ringMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.55,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.32,
    metalness: 0.4,
  });

  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.26, 12, 32), ringMat);
  ringMesh.position.y = 3.0;
  group.add(ringMesh);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.08, 8, 28), baseMat);
  innerRing.position.y = 3.0;
  group.add(innerRing);

  const pylonGeo = new THREE.BoxGeometry(0.45, 2.2, 0.65);
  const leftPylon = new THREE.Mesh(pylonGeo, baseMat);
  leftPylon.position.set(-2.7, 1.1, 0);
  leftPylon.castShadow = true;
  group.add(leftPylon);

  const rightPylon = new THREE.Mesh(pylonGeo, baseMat);
  rightPylon.position.set(2.7, 1.1, 0);
  rightPylon.castShadow = true;
  group.add(rightPylon);

  const archGlow = new THREE.Mesh(
    new THREE.RingGeometry(1.9, 2.55, 24),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  archGlow.position.y = 3.0;
  group.add(archGlow);

  return { group, ringMesh };
}

/**
 * Composite floating scenic canyon island with stylized foliage and spinning wind-turbine
 * placed outside the track to give expansive sunlit sky-world depth.
 */
export function createSceneryIsland(seed: number): {
  group: THREE.Group;
  turbineBlades: THREE.Group | null;
} {
  const group = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    color: seed % 2 === 0 ? 0xd97757 : 0xc26d4f,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    roughness: 0.72,
    metalness: 0.04,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.2,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.78,
    metalness: 0.04,
    flatShading: true,
  });

  const radius = 6 + (seed % 5) * 2.2;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 1.45, 7), rockMat);
  rock.rotation.x = Math.PI;
  rock.position.y = -radius * 0.72;
  group.add(rock);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.03, radius * 0.96, 1.4, 7), grassMat);
  cap.position.y = 0.65;
  group.add(cap);

  // Stylized clustered pines
  for (let i = 0; i < 3; i++) {
    const angle = seed + i * 2.1;
    const dist = radius * 0.42;
    const tx = Math.cos(angle) * dist;
    const tz = Math.sin(angle) * dist;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.6, 6), pineMat);
    tree.position.set(tx, 3.4, tz);
    group.add(tree);
  }

  let turbineBlades: THREE.Group | null = null;
  if (seed % 2 === 0) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 11, 8), whiteMat);
    mast.position.set(0, 6.5, 0);
    group.add(mast);

    turbineBlades = new THREE.Group();
    turbineBlades.position.set(0, 11.8, 0.45);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.2, 0.1), whiteMat);
      blade.position.y = 2.1;
      const pivot = new THREE.Group();
      pivot.rotation.z = (b * Math.PI * 2) / 3;
      pivot.add(blade);
      turbineBlades.add(pivot);
    }
    group.add(turbineBlades);
  }

  return { group, turbineBlades };
}
