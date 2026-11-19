import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import {
  createBoostRamp,
  createBoulder,
  createChaosRing,
  createCrusherBarrier,
  createPlayerRacer,
  createSceneryIsland,
  createSkyCore,
  createSweepingHammer,
  PlayerRig,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { ChaosModeId, GameCallbacks, GamePhase, HudSnapshot } from './types';
import {
  getInitialAudioEnabled,
  loadPlayablesBestScore,
  reportPlayablesScore,
  savePlayablesBestScore,
  signalFirstFrameReady,
  signalGameReady,
  subscribePlayablesLifecycle,
} from './youtubePlayables';

// Pre-allocated math helpers outside the render loop (zero GC per frame)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

const TRACK_HALF_WIDTH = 6.4;
const SEG_LEN = 26;
const VISIBLE_SEGMENTS = 14;
const PARTICLE_COUNT = 180;

interface TrackSegment {
  group: THREE.Group;
  zStart: number; // near edge (larger Z, since player moves toward -Z)
  zEnd: number;   // far edge (zStart - SEG_LEN)
  hasGap: boolean;
  gapZStart: number;
  gapZEnd: number;
  halfWidth: number;
}

interface Obstacle {
  kind: 'hammer' | 'boulder' | 'crusher' | 'ramp' | 'chaos';
  group: THREE.Group;
  armPivot?: THREE.Group;
  ringMesh?: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  baseX: number;
  vx: number;
  vz: number;
  phase: number;
  speed: number;
  radius: number;
  chaosType?: ChaosModeId;
  triggered: boolean;
  smashed: boolean;
}

interface Collectible {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  phase: number;
  collected: boolean;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface SceneryProp {
  group: THREE.Group;
  turbine: THREE.Group | null;
  side: number;
  offsetY: number;
}

const CHAOS_META: Record<
  Exclude<ChaosModeId, 'none'>,
  { label: string; accent: string; hex: number; duration: number }
> = {
  lowg: { label: 'LOW-G MOON JUMP', accent: '#38bdf8', hex: 0x38bdf8, duration: 9 },
  overdrive: { label: 'MEGA OVERDRIVE SMASH', accent: '#f97316', hex: 0xf97316, duration: 8 },
  magnet: { label: 'HYPER CORE MAGNET', accent: '#facc15', hex: 0xfacc15, duration: 10 },
  bouncy: { label: 'TURBO BOUNCE 2X', accent: '#10b981', hex: 0x10b981, duration: 9 },
};

export class TurboTumbleEngine {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  private sound = new SoundEngine();

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private sunLight!: THREE.DirectionalLight;

  private player!: PlayerRig;
  private contactShadow!: THREE.Mesh;
  private particleMesh!: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private particleCursor = 0;

  private segments: TrackSegment[] = [];
  private obstacles: Obstacle[] = [];
  private collectibles: Collectible[] = [];
  private scenery: SceneryProp[] = [];
  private clouds: THREE.Group[] = [];

  private sharedRoadGeo!: THREE.BoxGeometry;
  private sharedRoadMat!: THREE.MeshStandardMaterial;
  private sharedBridgeMat!: THREE.MeshStandardMaterial;
  private sharedRailMat!: THREE.MeshStandardMaterial;

  // Game state
  private phase: GamePhase = 'title';
  private score = 0;
  private bestScore = 0;
  private distance = 0;
  private combo = 0;
  private comboTimer = 0;
  private hearts = 3;
  private readonly maxHearts = 3;
  private smashedCount = 0;
  private coresCollected = 0;
  private gameOverReason = '';

  // Player kinematics
  private px = 0;
  private py = 0;
  private pz = 0;
  private vx = 0;
  private vy = 0;
  private forwardSpeed = 28;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpsUsed = 0;
  private dashTimer = 0;
  private dashCharge = 1;
  private invulnTimer = 0;
  private hitFlashTimer = 0;

  // Squash & stretch springs
  private scaleX = 1;
  private scaleY = 1;
  private scaleZ = 1;
  private bankAngle = 0;
  private pitchAngle = 0;

  // Chaos & feedback
  private chaosMode: ChaosModeId = 'none';
  private chaosTimer = 0;
  private chaosDuration = 1;
  private bannerText = '';
  private bannerAccent = '#f59e0b';
  private bannerTimer = 0;
  private shakeTrauma = 0;
  private hitstopTimer = 0;

  // Track spawning cursor (player moves toward -Z)
  private nextSegZ = 16;
  private segIndex = 0;

  // Input state (continuous held vs edge-triggered + multi-touch left/right screen zones)
  private held = { left: false, right: false, up: false, down: false };
  private virtualHeld = { left: false, right: false };
  private canvasTouchHeld = { left: false, right: false };
  private activePointers = new Map<
    number,
    { side: 'left' | 'right'; startX: number; startY: number; swiped: boolean }
  >();

  // Loop & lifecycle
  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private elapsed = 0;
  private hudEmitAccum = 0;
  private contextLost = false;
  private modalOpen = false;
  private firstFrameRendered = false;
  private unsubPlayables: (() => void) | null = null;

  public setModalOpen(open: boolean): void {
    this.modalOpen = open;
    if (open) this.clearHeldKeys();
  }

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Respect YouTube Playables system audio setting on boot
    if (!getInitialAudioEnabled()) {
      this.sound.setMuted(true);
    }

    this.initRendererAndScene();
    this.initParticles();
    this.initPlayer();
    this.initScenery();
    this.resetWorldForTitle();
    this.bindEvents();

    // Load saved best score asynchronously from YouTube Playables cloud storage or localStorage
    loadPlayablesBestScore().then((loaded) => {
      if (this.disposed) return;
      if (loaded > this.bestScore) {
        this.bestScore = loaded;
        this.emitHud(true);
      }
    });

    // Subscribe to YouTube Playables pause, resume, and audio-toggle system events
    this.unsubPlayables = subscribePlayablesLifecycle({
      onPause: () => {
        this.sound.suspend();
        if (this.phase === 'playing') {
          this.phase = 'paused';
          this.clearHeldKeys();
          this.emitHud(true);
        }
      },
      onResume: () => {
        this.sound.resume();
        this.lastTime = performance.now();
      },
      onAudioChange: (enabled: boolean) => {
        this.sound.setMuted(!enabled);
        this.emitHud(true);
      },
    });

    this.emitHud(true);
    this.lastTime = performance.now();
    this.startLoop();
    signalGameReady();
  }

  private detectSoftwareWebGL(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();

    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9bd7f5);
    this.scene.fog = new THREE.FogExp2(0xdceefb, 0.0052);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 420);
    this.camera.position.set(8, 5.5, 11);

    // Procedural RoomEnvironment for crisp metallic/visor PBR reflections on all devices
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    // Procedural Sky Dome (sunlit golden-hour sky)
    const skyGeo = new THREE.SphereGeometry(320, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.textures.skyMap,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.name = 'skyDome';
    this.scene.add(skyDome);

    // Warm/cool 3-point outdoor lighting rig
    const hemi = new THREE.HemisphereLight(0xbbe7ff, 0x9c6b49, 0.85);
    hemi.position.set(0, 60, 0);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.0);
    this.sunLight.position.set(22, 36, 18);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    const d = 34;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.65);
    rimLight.position.set(-20, 14, -24);
    this.scene.add(rimLight);

    // Shared track geometries & materials
    this.sharedRoadGeo = new THREE.BoxGeometry(TRACK_HALF_WIDTH * 2, 1.2, SEG_LEN);
    this.sharedRoadMat = new THREE.MeshStandardMaterial({
      map: this.textures.roadMap,
      roughness: 0.72,
      metalness: 0.12,
    });
    this.sharedBridgeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.55,
      metalness: 0.52,
    });
    this.sharedRailMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.3,
    });
  }

  private initParticles(): void {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.2,
    });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, PARTICLE_COUNT);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: 0xffffff,
      });
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 9,
    upBias = 4,
    size = 1,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_COUNT;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.7;
      p.y = y + (Math.random() - 0.5) * 0.5;
      p.z = z + (Math.random() - 0.5) * 0.7;
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      p.vx = Math.cos(a) * spd;
      p.vy = upBias + Math.random() * speed * 0.65;
      p.vz = Math.sin(a) * spd;
      p.maxLife = 0.32 + Math.random() * 0.42;
      p.life = p.maxLife;
      p.size = size * (0.65 + Math.random() * 0.7);
      p.color = colorHex;
    }
  }

  private initPlayer(): void {
    this.player = createPlayerRacer();
    this.scene.add(this.player.root);

    // Grounded contact shadow disc beneath player
    const shadowGeo = new THREE.PlaneGeometry(3.0, 3.6);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.set(0, 0.03, 0);
    this.scene.add(this.contactShadow);
  }

  private initScenery(): void {
    // Distant floating sky islands along both sides of the track
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const built = createSceneryIsland(i + 1);
      const offsetX = side * (22 + (i % 4) * 11);
      const offsetY = -10 + ((i * 7) % 14);
      const zPos = 20 - i * 32;
      built.group.position.set(offsetX, offsetY, zPos);
      this.scene.add(built.group);
      this.scenery.push({
        group: built.group,
        turbine: built.turbineBlades,
        side,
        offsetY,
      });
    }

    // Stylized sculpted puffy cloud clusters
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const r = 2.6 + (p === 1 ? 1.4 : 0);
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), cloudMat);
        puff.position.set((p - 1) * 2.5, p === 1 ? 0.7 : 0, (p % 2) * 0.8);
        puff.scale.set(1.2, 0.65, 0.9);
        cloud.add(puff);
      }
      const side = i % 2 === 0 ? -1 : 1;
      cloud.position.set(side * (24 + (i % 5) * 14), 14 + (i % 4) * 6, 30 - i * 28);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private clearTrackEntities(): void {
    for (const seg of this.segments) this.scene.remove(seg.group);
    this.segments = [];
    for (const obs of this.obstacles) this.scene.remove(obs.group);
    this.obstacles = [];
    for (const col of this.collectibles) this.scene.remove(col.group);
    this.collectibles = [];
  }

  private spawnNextSegment(): void {
    const zStart = this.nextSegZ;
    const zEnd = zStart - SEG_LEN;
    this.nextSegZ = zEnd;
    const idx = this.segIndex++;

    const group = new THREE.Group();
    const difficulty = Math.min(1, idx / 35);

    // First 3 segments are safe straight runway
    const allowGap = idx >= 4 && idx % 5 === 0;
    const isNarrow = !allowGap && idx >= 7 && idx % 6 === 3;
    const halfWidth = isNarrow ? 4.3 : TRACK_HALF_WIDTH;

    let hasGap = false;
    let gapZStart = 0;
    let gapZEnd = 0;

    if (allowGap) {
      hasGap = true;
      const gapLen = 8.5 + difficulty * 3.5;
      const firstPartLen = (SEG_LEN - gapLen) * 0.52;
      const secondPartLen = SEG_LEN - gapLen - firstPartLen;

      gapZStart = zStart - firstPartLen;
      gapZEnd = gapZStart - gapLen;

      // Near deck before gap
      const nearDeck = new THREE.Mesh(
        new THREE.BoxGeometry(halfWidth * 2, 1.2, firstPartLen),
        this.sharedRoadMat,
      );
      nearDeck.position.set(0, -0.6, zStart - firstPartLen / 2);
      nearDeck.receiveShadow = true;
      group.add(nearDeck);

      // Far deck after gap
      const farDeck = new THREE.Mesh(
        new THREE.BoxGeometry(halfWidth * 2, 1.2, secondPartLen),
        this.sharedRoadMat,
      );
      farDeck.position.set(0, -0.6, gapZEnd - secondPartLen / 2);
      farDeck.receiveShadow = true;
      group.add(farDeck);

      // Guaranteed Boost Ramp just before the sky gap!
      const rampX = (Math.floor(Math.random() * 3) - 1) * 3.1;
      const rampGroup = createBoostRamp(this.textures);
      const rampZ = gapZStart + 2.8;
      rampGroup.position.set(rampX, 0, rampZ);
      this.scene.add(rampGroup);
      this.obstacles.push({
        kind: 'ramp',
        group: rampGroup,
        x: rampX,
        y: 0,
        z: rampZ,
        baseX: rampX,
        vx: 0,
        vz: 0,
        phase: 0,
        speed: 0,
        radius: 1.9,
        triggered: false,
        smashed: false,
      });

      // Golden Sky-Core arc soaring across the gap
      for (let c = 0; c < 4; c++) {
        const t = (c + 0.5) / 4;
        const cz = gapZStart - t * gapLen;
        const cy = 1.6 + Math.sin(t * Math.PI) * 3.2;
        const core = createSkyCore();
        core.position.set(rampX, cy, cz);
        this.scene.add(core);
        this.collectibles.push({
          group: core,
          x: rampX,
          y: cy,
          z: cz,
          phase: c * 0.7,
          collected: false,
        });
      }
    } else {
      const deckGeo = isNarrow
        ? new THREE.BoxGeometry(halfWidth * 2, 1.2, SEG_LEN)
        : this.sharedRoadGeo;
      const deck = new THREE.Mesh(deckGeo, this.sharedRoadMat);
      deck.position.set(0, -0.6, zStart - SEG_LEN / 2);
      deck.receiveShadow = true;
      group.add(deck);

      // Underside structural truss beam
      const truss = new THREE.Mesh(
        new THREE.BoxGeometry(halfWidth * 1.45, 0.9, SEG_LEN - 0.5),
        this.sharedBridgeMat,
      );
      truss.position.set(0, -1.65, zStart - SEG_LEN / 2);
      group.add(truss);

      // Side guide bollards on normal segments
      if (!isNarrow) {
        const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.75, 8);
        for (let k = 0; k < 2; k++) {
          const pz = zStart - 6 - k * 13;
          const postL = new THREE.Mesh(postGeo, this.sharedRailMat);
          postL.position.set(-halfWidth - 0.25, 0.35, pz);
          group.add(postL);
          const postR = new THREE.Mesh(postGeo, this.sharedRailMat);
          postR.position.set(halfWidth + 0.25, 0.35, pz);
          group.add(postR);
        }
      }
    }

    this.scene.add(group);
    this.segments.push({
      group,
      zStart,
      zEnd,
      hasGap,
      gapZStart,
      gapZEnd,
      halfWidth,
    });

    // Populate hazards, Chaos Rings, and Sky-Cores on non-gap segments after warm-up
    if (idx >= 2 && !hasGap) {
      const midZ = zStart - SEG_LEN * 0.5;

      // Every 4th segment spawns a giant Chaos Ring!
      if (idx % 4 === 0) {
        const types: Exclude<ChaosModeId, 'none'>[] = ['lowg', 'overdrive', 'magnet', 'bouncy'];
        const chosen = types[(idx / 4 + Math.floor(Math.random() * types.length)) % types.length | 0];
        const meta = CHAOS_META[chosen];
        const ringX = (Math.floor(Math.random() * 3) - 1) * 2.8;
        const built = createChaosRing(meta.hex);
        built.group.position.set(ringX, 0, midZ);
        this.scene.add(built.group);
        this.obstacles.push({
          kind: 'chaos',
          group: built.group,
          ringMesh: built.ringMesh,
          x: ringX,
          y: 0,
          z: midZ,
          baseX: ringX,
          vx: 0,
          vz: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 2.0,
          radius: 2.4,
          chaosType: chosen,
          triggered: false,
          smashed: false,
        });
      } else {
        // Choose crazy obstacle pattern
        const roll = Math.random();
        if (roll < 0.34) {
          // Sweeping Pendulum Bumper Hammer
          const built = createSweepingHammer(this.textures);
          built.group.position.set(0, 0, midZ);
          this.scene.add(built.group);
          this.obstacles.push({
            kind: 'hammer',
            group: built.group,
            armPivot: built.armPivot,
            x: 0,
            y: 1.35,
            z: midZ,
            baseX: 0,
            vx: 0,
            vz: 0,
            phase: Math.random() * Math.PI * 2,
            speed: 1.85 + difficulty * 1.15,
            radius: 1.5,
            triggered: false,
            smashed: false,
          });
        } else if (roll < 0.67) {
          // Sliding Hydraulic Crusher Barrier
          const crusher = createCrusherBarrier(this.textures);
          const startX = (Math.random() - 0.5) * 4;
          crusher.position.set(startX, 0, midZ);
          this.scene.add(crusher);
          this.obstacles.push({
            kind: 'crusher',
            group: crusher,
            x: startX,
            y: 1.1,
            z: midZ,
            baseX: 0,
            vx: 0,
            vz: 0,
            phase: Math.random() * Math.PI * 2,
            speed: 1.65 + difficulty * 1.25,
            radius: 2.1,
            triggered: false,
            smashed: false,
          });
        } else {
          // Rolling Magma Boulders (1 or 2 lanes)
          const count = difficulty > 0.35 ? 2 : 1;
          const lanes = [-3.8, 0, 3.8].sort(() => Math.random() - 0.5);
          for (let b = 0; b < count; b++) {
            const bx = lanes[b];
            const bz = midZ - b * 5.5;
            const boulder = createBoulder();
            boulder.position.set(bx, 1.32, bz);
            this.scene.add(boulder);
            this.obstacles.push({
              kind: 'boulder',
              group: boulder,
              x: bx,
              y: 1.32,
              z: bz,
              baseX: bx,
              vx: 0,
              vz: 11 + difficulty * 9,
              phase: Math.random() * Math.PI * 2,
              speed: 4.5,
              radius: 1.35,
              triggered: false,
              smashed: false,
            });
          }
        }
      }

      // Line of 3 Golden Sky-Cores weaving along the segment
      const coreLane = (Math.floor(Math.random() * 3) - 1) * Math.min(3.2, halfWidth - 1.5);
      for (let c = 0; c < 3; c++) {
        const cz = zStart - 5 - c * 6.5;
        const core = createSkyCore();
        core.position.set(coreLane, 1.25, cz);
        this.scene.add(core);
        this.collectibles.push({
          group: core,
          x: coreLane,
          y: 1.25,
          z: cz,
          phase: c * 0.8 + idx,
          collected: false,
        });
      }
    }
  }

  private resetWorldForTitle(): void {
    this.clearTrackEntities();
    this.nextSegZ = 18;
    this.segIndex = 0;
    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
      this.spawnNextSegment();
    }

    this.px = 0;
    this.py = 0;
    this.pz = 0;
    this.vx = 0;
    this.vy = 0;
    this.forwardSpeed = 30;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpsUsed = 0;
    this.dashTimer = 0;
    this.dashCharge = 1;
    this.invulnTimer = 0;
    this.hitFlashTimer = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.scaleZ = 1;
    this.bankAngle = 0;
    this.pitchAngle = 0;

    this.score = 0;
    this.distance = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.hearts = this.maxHearts;
    this.smashedCount = 0;
    this.coresCollected = 0;
    this.gameOverReason = '';
    this.chaosMode = 'none';
    this.chaosTimer = 0;
    this.chaosDuration = 1;
    this.bannerText = '';
    this.bannerTimer = 0;
    this.shakeTrauma = 0;
    this.hitstopTimer = 0;

    this.player.root.position.set(0, 0, 0);
    this.player.root.rotation.set(0, 0, 0);
    this.player.bodyGroup.scale.set(1, 1, 1);
    this.player.shieldMaterial.opacity = 0;
    this.contactShadow.position.set(0, 0.03, 0);
    this.contactShadow.visible = true;
  }

  public startGame(): void {
    this.sound.unlock();
    this.resetWorldForTitle();
    this.phase = 'playing';
    this.showBanner('GO! DODGE, JUMP & SMASH!', '#f59e0b', 2.0);
    this.sound.playBoostPad();
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.clearHeldKeys();
      this.emitHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTime = performance.now();
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.clearHeldKeys();
    this.resetWorldForTitle();
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const muted = this.sound.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public triggerJump(): void {
    if (this.phase !== 'playing') return;
    this.sound.unlock();
    this.jumpBufferTimer = 0.14;
  }

  public triggerDash(): void {
    if (this.phase !== 'playing') return;
    this.sound.unlock();
    if (this.dashCharge >= 1 && this.dashTimer <= 0) {
      this.dashCharge = 0;
      this.dashTimer = 0.42;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
      this.scaleX = 0.82;
      this.scaleY = 0.86;
      this.scaleZ = 1.38;
      this.sound.playDash();
      this.spawnParticles(this.px, this.py + 0.7, this.pz + 1.2, 22, 0x38bdf8, 12, 3, 1.15);
    }
  }

  public setVirtualSteer(dir: 'left' | 'right', active: boolean): void {
    const wasActive = this.virtualHeld[dir];
    this.virtualHeld[dir] = active;
    if (active && !wasActive && this.phase === 'playing') {
      this.sound.unlock();
      // Snappy lateral impulse so quick left/right taps immediately change car position
      const sign = dir === 'right' ? 1 : -1;
      this.vx = sign * Math.max(Math.abs(this.vx), 13.5);
    }
  }

  private syncCanvasTouchSteer(): void {
    let left = false;
    let right = false;
    this.activePointers.forEach((entry) => {
      if (entry.side === 'left') left = true;
      else right = true;
    });
    this.canvasTouchHeld.left = left;
    this.canvasTouchHeld.right = right;
  }

  private clearHeldKeys(): void {
    this.held.left = false;
    this.held.right = false;
    this.held.up = false;
    this.held.down = false;
    this.virtualHeld.left = false;
    this.virtualHeld.right = false;
    this.canvasTouchHeld.left = false;
    this.canvasTouchHeld.right = false;
    this.activePointers.clear();
  }

  private showBanner(text: string, accent: string, duration = 2.1): void {
    this.bannerText = text;
    this.bannerAccent = accent;
    this.bannerTimer = duration;
  }

  private activateChaos(type: Exclude<ChaosModeId, 'none'>): void {
    const meta = CHAOS_META[type];
    this.chaosMode = type;
    this.chaosDuration = meta.duration;
    this.chaosTimer = meta.duration;
    this.score += 150;
    this.showBanner(`CHAOS RING: ${meta.label}`, meta.accent, 2.5);
    this.sound.playChaosTrigger();
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.4);
    this.spawnParticles(this.px, this.py + 1.4, this.pz, 30, meta.hex, 13, 6, 1.25);

    this.player.shieldMaterial.color.setHex(meta.hex);
    this.player.shieldMaterial.emissive.setHex(meta.hex);
  }

  private getGroundSupportAt(x: number, z: number): { solid: boolean; halfWidth: number } {
    for (const seg of this.segments) {
      if (z <= seg.zStart + 0.5 && z >= seg.zEnd - 0.5) {
        if (Math.abs(x) > seg.halfWidth + 0.55) {
          return { solid: false, halfWidth: seg.halfWidth };
        }
        if (seg.hasGap && z < seg.gapZStart - 0.35 && z > seg.gapZEnd + 0.35) {
          return { solid: false, halfWidth: seg.halfWidth };
        }
        return { solid: true, halfWidth: seg.halfWidth };
      }
    }
    return { solid: true, halfWidth: TRACK_HALF_WIDTH };
  }

  private handleObstacleHit(obs: Obstacle, impactX: number): void {
    const isSmashable = this.dashTimer > 0 || this.chaosMode === 'overdrive';
    if (isSmashable) {
      obs.smashed = true;
      this.scene.remove(obs.group);
      this.smashedCount += 1;
      const pts = 250 * (this.chaosMode === 'bouncy' ? 2 : 1);
      this.score += pts;
      this.hitstopTimer = 0.048;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.55);
      this.sound.playSmash();
      this.spawnParticles(obs.x, obs.y + 1.2, obs.z, 34, 0xf97316, 16, 8, 1.35);
      this.showBanner(`SMASHED! +${pts}`, '#f97316', 1.3);
      return;
    }

    if (this.invulnTimer > 0) return;

    this.hearts -= 1;
    this.combo = 0;
    this.invulnTimer = 1.45;
    this.hitFlashTimer = 0.25;
    this.hitstopTimer = 0.065;
    this.shakeTrauma = 0.95;
    this.sound.playHit();

    // Dramatic knockback bounce
    const pushDir = this.px >= impactX ? 1 : -1;
    this.vx = pushDir * (this.chaosMode === 'bouncy' ? 19 : 13);
    this.vy = Math.max(this.vy, this.chaosMode === 'bouncy' ? 15 : 9.5);
    this.grounded = false;
    this.scaleX = 1.35;
    this.scaleY = 0.68;
    this.scaleZ = 0.85;
    this.spawnParticles(this.px, this.py + 0.9, this.pz, 28, 0xef4444, 14, 7, 1.15);

    if (this.hearts <= 0) {
      this.triggerGameOver('Wrecked by Skyway Hazard!');
    } else {
      this.showBanner('WATCH OUT! SHIELD DAMAGED', '#ef4444', 1.4);
    }
  }

  private triggerGameOver(reason: string): void {
    this.phase = 'gameover';
    this.gameOverReason = reason;
    this.clearHeldKeys();
    const finalScore = Math.floor(this.score);
    if (finalScore > this.bestScore) {
      this.bestScore = finalScore;
      savePlayablesBestScore(this.bestScore).catch(() => {});
    }
    reportPlayablesScore(finalScore).catch(() => {});
    this.sound.playGameOver();
    this.emitHud(true);
  }

  private updateSimulation(dt: number): void {
    // Hitstop freeze frame for juicy heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.4);
      this.updateCamera(dt);
      return;
    }

    this.elapsed += dt;

    // Spin distant wind turbines & drift clouds in all phases
    for (const s of this.scenery) {
      if (s.turbine) s.turbine.rotation.z += dt * 1.35;
      // Recycle scenery islands ahead of player
      if (s.group.position.z > this.pz + 55) {
        s.group.position.z -= 384;
      }
    }
    for (const c of this.clouds) {
      if (c.position.z > this.pz + 60) {
        c.position.z -= 390;
      }
    }

    // Keep sky dome centered on player so horizon never clips
    const sky = this.scene.getObjectByName('skyDome');
    if (sky) sky.position.set(this.px, 0, this.pz);

    if (this.phase === 'title') {
      // Atmospheric live-world title pan & idling engine pulse
      this.player.turboFan.rotation.z += dt * 10;
      const idleBob = Math.sin(this.elapsed * 3.2) * 0.05;
      this.player.bodyGroup.position.y = idleBob;
      const flamePulse = 0.75 + Math.sin(this.elapsed * 24) * 0.2;
      this.player.flameLeft.scale.set(0.85, 0.85, flamePulse);
      this.player.flameRight.scale.set(0.85, 0.85, flamePulse);
      for (const obs of this.obstacles) {
        if (obs.kind === 'hammer' && obs.armPivot) {
          obs.armPivot.rotation.z = Math.sin(this.elapsed * obs.speed + obs.phase) * 0.92;
        }
      }
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.phase !== 'playing') {
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    // Timers
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) this.bannerText = '';
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.combo = 0;
    }
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.dashTimer > 0) this.dashTimer = Math.max(0, this.dashTimer - dt);
    if (this.dashCharge < 1) {
      this.dashCharge = Math.min(1, this.dashCharge + dt * 0.28);
    }
    if (this.chaosMode !== 'none') {
      this.chaosTimer -= dt;
      if (this.chaosTimer <= 0) {
        this.chaosMode = 'none';
        this.chaosTimer = 0;
        this.player.shieldMaterial.opacity = 0;
      } else {
        this.player.shieldMaterial.opacity = 0.22 + Math.sin(this.elapsed * 12) * 0.08;
      }
    }

    // Smooth difficulty ramp with distance
    const distLevel = Math.min(1, this.distance / 1600);
    let targetSpeed = 30 + distLevel * 22;
    if (this.held.up) targetSpeed += 8.5;
    if (this.held.down) targetSpeed -= 9.0;
    if (this.chaosMode === 'overdrive') targetSpeed += 14;
    if (this.dashTimer > 0) targetSpeed += 26;

    this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, targetSpeed, 5.5, dt);

    // Lateral steering with snappy arcade weight (keyboard + touch buttons + left/right screen touch)
    const steerRight = this.held.right || this.virtualHeld.right || this.canvasTouchHeld.right;
    const steerLeft = this.held.left || this.virtualHeld.left || this.canvasTouchHeld.left;
    const steerInput = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
    const maxLatSpeed = this.chaosMode === 'overdrive' ? 21 : 18.0;
    const latAccel = this.grounded ? 15 : 10.5;
    this.vx = THREE.MathUtils.damp(this.vx, steerInput * maxLatSpeed, latAccel, dt);

    this.px += this.vx * dt;
    this.pz -= this.forwardSpeed * dt;
    this.distance += this.forwardSpeed * dt;
    const mult = (1 + Math.min(4, Math.floor(this.combo / 4))) * (this.chaosMode === 'bouncy' ? 2 : 1);
    this.score += this.forwardSpeed * dt * 1.15 * mult;

    // Coyote time & jump buffering
    if (this.grounded) {
      this.coyoteTimer = 0.12;
      this.jumpsUsed = 0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      const jumpPower = this.chaosMode === 'lowg' ? 18.8 : 15.8;
      if (this.coyoteTimer > 0) {
        this.vy = jumpPower;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpsUsed = 1;
        this.scaleX = 0.82;
        this.scaleY = 1.28;
        this.scaleZ = 0.92;
        this.sound.playJump(false);
        this.spawnParticles(this.px, this.py + 0.2, this.pz, 10, 0xf8fafc, 6, 2, 0.8);
      } else if (this.jumpsUsed < 2) {
        this.vy = jumpPower * 0.94;
        this.jumpBufferTimer = 0;
        this.jumpsUsed = 2;
        this.scaleX = 0.8;
        this.scaleY = 1.32;
        this.scaleZ = 0.88;
        this.sound.playJump(true);
        this.spawnParticles(this.px, this.py + 0.3, this.pz + 0.5, 16, 0x38bdf8, 9, 1.5, 0.95);
      }
    }

    // Vertical gravity & ground landing
    const gravity = this.chaosMode === 'lowg' ? -24 : -42;
    this.vy += gravity * dt;
    const prevY = this.py;
    this.py += this.vy * dt;

    const support = this.getGroundSupportAt(this.px, this.pz);
    if (support.solid && prevY >= -0.35 && this.py <= 0 && this.vy <= 0) {
      if (!this.grounded && this.vy < -5) {
        const impactStrength = Math.min(1.6, Math.abs(this.vy) / 14);
        this.sound.playLand(impactStrength);
        this.scaleX = 1.24;
        this.scaleY = 0.74;
        this.scaleZ = 1.15;
        this.spawnParticles(this.px, 0.15, this.pz, 9, 0xe2e8f0, 5.5, 2.2, 0.7);
      }
      this.py = 0;
      if (this.chaosMode === 'bouncy' && Math.abs(this.vy) > 9) {
        this.vy = 13.5;
        this.grounded = false;
        this.sound.playJump(false);
      } else {
        this.vy = 0;
        this.grounded = true;
      }
    } else if (!support.solid && this.py <= 0) {
      this.grounded = false;
    }

    // Fall into sky abyss check
    if (this.py < -13) {
      this.triggerGameOver('Fell off the Skyway!');
      return;
    }

    // Stream new track segments ahead and clean up old ones behind
    while (this.nextSegZ > this.pz - VISIBLE_SEGMENTS * SEG_LEN) {
      this.spawnNextSegment();
    }
    while (this.segments.length > 0 && this.segments[0].zEnd > this.pz + 32) {
      const old = this.segments.shift()!;
      this.scene.remove(old.group);
    }

    // Update obstacles & collisions
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.smashed || obs.z > this.pz + 28) {
        if (!obs.smashed) this.scene.remove(obs.group);
        this.obstacles.splice(i, 1);
        continue;
      }

      if (obs.kind === 'hammer' && obs.armPivot) {
        const angle = Math.sin(this.elapsed * obs.speed + obs.phase) * 0.96;
        obs.armPivot.rotation.z = angle;
        // Mallet head world position relative to pivot at y=7.2, arm length=5.85
        const headX = Math.sin(angle) * 5.85;
        const headY = 7.2 - Math.cos(angle) * 5.85;
        obs.x = headX;
        obs.y = headY;
        const dz = Math.abs(this.pz - obs.z);
        const dx = Math.abs(this.px - headX);
        const dy = Math.abs(this.py + 0.75 - headY);
        if (dz < 1.55 && dx < 1.85 && dy < 1.35) {
          this.handleObstacleHit(obs, headX);
        }
      } else if (obs.kind === 'crusher') {
        const slideX = Math.sin(this.elapsed * obs.speed + obs.phase) * 4.0;
        obs.x = slideX;
        obs.group.position.x = slideX;
        const dz = Math.abs(this.pz - obs.z);
        const dx = Math.abs(this.px - slideX);
        if (dz < 1.55 && dx < 2.55 && this.py < 2.25) {
          this.handleObstacleHit(obs, slideX);
        }
      } else if (obs.kind === 'boulder') {
        obs.z += obs.vz * dt;
        obs.group.position.z = obs.z;
        obs.group.rotation.x += obs.vz * dt * 0.78;
        const dx = this.px - obs.x;
        const dy = this.py + 0.7 - obs.y;
        const dz = this.pz - obs.z;
        if (dx * dx + dy * dy + dz * dz < 2.05 * 2.05) {
          this.handleObstacleHit(obs, obs.x);
        }
      } else if (obs.kind === 'ramp') {
        const dz = Math.abs(this.pz - obs.z);
        const dx = Math.abs(this.px - obs.x);
        if (!obs.triggered && dz < 2.4 && dx < 2.0 && this.py < 2.0) {
          obs.triggered = true;
          this.vy = this.chaosMode === 'lowg' ? 23.5 : 20.5;
          this.grounded = false;
          this.jumpsUsed = 1;
          this.forwardSpeed += 12;
          this.score += 120;
          this.scaleX = 0.8;
          this.scaleY = 1.35;
          this.scaleZ = 0.9;
          this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.3);
          this.sound.playBoostPad();
          this.spawnParticles(this.px, this.py + 0.4, this.pz, 22, 0xfacc15, 11, 6, 1.1);
          this.showBanner('MEGA SKY LAUNCH! +120', '#0ea5e9', 1.4);
        }
      } else if (obs.kind === 'chaos') {
        if (obs.ringMesh) obs.ringMesh.rotation.z += dt * 1.8;
        const dz = Math.abs(this.pz - obs.z);
        const dx = Math.abs(this.px - obs.x);
        if (!obs.triggered && dz < 1.8 && dx < 2.85 && this.py < 5.4 && obs.chaosType && obs.chaosType !== 'none') {
          obs.triggered = true;
          this.activateChaos(obs.chaosType);
        }
      }
    }

    // Update collectibles (Sky-Cores)
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      if (col.collected || col.z > this.pz + 24) {
        if (!col.collected) this.scene.remove(col.group);
        this.collectibles.splice(i, 1);
        continue;
      }

      col.group.rotation.y += dt * 3.1;
      col.group.position.y = col.y + Math.sin(this.elapsed * 4 + col.phase) * 0.24;

      // Magnet Chaos pulls nearby Sky-Cores right into your chassis
      if (this.chaosMode === 'magnet') {
        const dx = this.px - col.x;
        const dy = this.py + 0.8 - col.y;
        const dz = this.pz - col.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 15 * 15) {
          const pull = Math.min(1, dt * 11);
          col.x += dx * pull;
          col.y += dy * pull;
          col.z += dz * pull;
          col.group.position.set(col.x, col.y, col.z);
        }
      }

      const dx = this.px - col.x;
      const dy = this.py + 0.75 - col.group.position.y;
      const dz = this.pz - col.z;
      if (dx * dx + dy * dy + dz * dz < 1.75 * 1.75) {
        col.collected = true;
        this.scene.remove(col.group);
        this.coresCollected += 1;
        this.combo += 1;
        this.comboTimer = 3.2;
        const pts = (50 + this.combo * 10) * (this.chaosMode === 'bouncy' ? 2 : 1);
        this.score += pts;
        this.dashCharge = Math.min(1, this.dashCharge + 0.16);
        this.sound.playCorePickup(this.combo);
        this.spawnParticles(col.x, col.group.position.y, col.z, 12, 0xfacc15, 8, 4, 0.85);
      }
    }

    // Animate Player Rig (squash/stretch spring recovery, bank, pitch, wheel spin, thruster flames)
    this.scaleX = THREE.MathUtils.damp(this.scaleX, 1, 12, dt);
    this.scaleY = THREE.MathUtils.damp(this.scaleY, 1, 12, dt);
    this.scaleZ = THREE.MathUtils.damp(this.scaleZ, 1, 12, dt);

    const targetBank = THREE.MathUtils.clamp(-this.vx * 0.024, -0.36, 0.36);
    const targetPitch = this.grounded ? 0 : THREE.MathUtils.clamp(this.vy * 0.025, -0.35, 0.42);
    this.bankAngle = THREE.MathUtils.damp(this.bankAngle, targetBank, 10, dt);
    this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, targetPitch, 9, dt);

    this.player.root.position.set(this.px, this.py, this.pz);
    this.player.bodyGroup.position.y = 0;
    this.player.bodyGroup.rotation.set(this.pitchAngle, -this.vx * 0.015, this.bankAngle);
    this.player.bodyGroup.scale.set(this.scaleX, this.scaleY, this.scaleZ);

    // Hit flash & invulnerability blink
    if (this.hitFlashTimer > 0) {
      this.player.hullMaterial.emissive.setHex(0xffffff);
      this.player.hullMaterial.emissiveIntensity = 0.85;
    } else if (this.chaosMode === 'overdrive') {
      this.player.hullMaterial.emissive.setHex(0xf97316);
      this.player.hullMaterial.emissiveIntensity = 0.45;
    } else {
      this.player.hullMaterial.emissive.setHex(0x000000);
      this.player.hullMaterial.emissiveIntensity = 0;
    }
    this.player.root.visible =
      this.invulnTimer <= 0 || Math.floor(this.elapsed * 22) % 2 === 0;

    // Spin wheels & turbo fan
    const wheelSpin = this.forwardSpeed * dt * 2.1;
    for (const w of this.player.wheels) w.rotation.x -= wheelSpin;
    this.player.turboFan.rotation.z += dt * (14 + this.forwardSpeed * 0.45);

    const boostFlame =
      this.dashTimer > 0 || this.chaosMode === 'overdrive'
        ? 1.9 + Math.sin(this.elapsed * 40) * 0.45
        : 0.8 + (this.forwardSpeed / 60) * 0.7 + Math.sin(this.elapsed * 30) * 0.16;
    this.player.flameLeft.scale.set(1, 1, boostFlame);
    this.player.flameRight.scale.set(1, 1, boostFlame);

    // Exhaust trail sparks during dash or overdrive
    if ((this.dashTimer > 0 || this.chaosMode === 'overdrive') && Math.random() < 0.7) {
      this.spawnParticles(this.px, this.py + 0.55, this.pz + 1.4, 2, 0x38bdf8, 4, 1.5, 0.75);
    }

    // Contact shadow tracks beneath player when over solid road
    this.contactShadow.visible = support.solid && this.py > -0.2;
    if (this.contactShadow.visible) {
      const hRatio = THREE.MathUtils.clamp(1 - this.py / 11, 0.25, 1);
      this.contactShadow.position.set(this.px, 0.03, this.pz);
      this.contactShadow.scale.setScalar(hRatio);
      (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.56 * hRatio;
    }

    // Follow directional sun shadow frustum with player
    this.sunLight.position.set(this.px + 22, 36, this.pz + 18);
    this.sunLight.target.position.set(this.px, 0, this.pz - 12);
    this.sunLight.target.updateMatrixWorld();

    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
    this.updateParticles(dt);
    this.updateCamera(dt);
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 22 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const frac = p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, p.life * 5);
      _dummy.scale.setScalar(p.size * frac);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(p.color));
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    // Adaptive portrait framing for mobile YouTube Playables (9:16) vs desktop landscape (16:9)
    const portraitFactor = THREE.MathUtils.clamp((1.15 - this.camera.aspect) / 0.65, 0, 1);

    if (this.phase === 'title') {
      // Sweeping scenic orbit showcasing the Rocket Gyro-Racer & sunlit skyway ahead
      const angle = Math.sin(this.elapsed * 0.34) * 0.55;
      _camTargetPos.set(
        Math.sin(angle) * (9.5 - portraitFactor * 2.5) + 2.0,
        4.4 + portraitFactor * 1.4 + Math.sin(this.elapsed * 0.6) * 0.35,
        8.8 + portraitFactor * 3.8,
      );
      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-3.5 * dt));
      _camLookAt.set(0, 1.4, -7.5);
      this.camera.lookAt(_camLookAt);
      const targetFov = 58 + portraitFactor * 14;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // Dynamic chase camera with speed FOV surge, subtle lateral follow, and trauma shake
    const shake = this.shakeTrauma * this.shakeTrauma;
    const sx = (Math.random() - 0.5) * shake * 1.15;
    const sy = (Math.random() - 0.5) * shake * 0.9;

    _camTargetPos.set(
      this.px * 0.72 + sx,
      Math.max(4.6, this.py * 0.55 + 4.9 + portraitFactor * 1.6) + sy,
      this.pz + 10.6 + portraitFactor * 4.2,
    );
    const camSmooth = 1 - Math.exp(-9.5 * dt);
    this.camera.position.lerp(_camTargetPos, camSmooth);

    _camLookAt.set(this.px * 0.45, Math.max(0.8, this.py * 0.45 + 1.4), this.pz - 14);
    this.camera.lookAt(_camLookAt);
    this.camera.rotation.z += -this.bankAngle * 0.14;

    const speedRatio = THREE.MathUtils.clamp((this.forwardSpeed - 28) / 40, 0, 1);
    const targetFov = 62 + portraitFactor * 14 + speedRatio * 18 + (this.dashTimer > 0 ? 7 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.08) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(force = false): void {
    const chaosMeta =
      this.chaosMode !== 'none' ? CHAOS_META[this.chaosMode] : null;
    const steerRight = this.held.right || this.virtualHeld.right || this.canvasTouchHeld.right;
    const steerLeft = this.held.left || this.virtualHeld.left || this.canvasTouchHeld.left;
    const activeSteerDir: 'left' | 'right' | 'none' =
      steerLeft && !steerRight ? 'left' : steerRight && !steerLeft ? 'right' : 'none';

    const snapshot: HudSnapshot = {
      phase: this.phase,
      score: Math.floor(this.score),
      bestScore: Math.max(this.bestScore, Math.floor(this.score)),
      distance: Math.floor(this.distance),
      speedKmh: Math.round(this.forwardSpeed * 3.4),
      combo: this.combo,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      dashCharge: this.dashCharge,
      chaos: {
        id: this.chaosMode,
        label: chaosMeta ? chaosMeta.label : '',
        accent: chaosMeta ? chaosMeta.accent : '#f59e0b',
        remaining: Math.max(0, this.chaosTimer),
        duration: this.chaosDuration,
      },
      bannerText: this.bannerText,
      bannerAccent: this.bannerAccent,
      smashedCount: this.smashedCount,
      coresCollected: this.coresCollected,
      gameOverReason: this.gameOverReason,
      muted: this.sound.isMuted(),
      activeSteerDir,
    };
    if (force || !this.disposed) {
      this.callbacks.onHudUpdate(snapshot);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (!this.contextLost) {
        this.updateSimulation(dt);
        this.renderer.render(this.scene, this.camera);
        if (!this.firstFrameRendered) {
          this.firstFrameRendered = true;
          signalFirstFrameReady();
        }
      }

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.065) {
        this.hudEmitAccum = 0;
        this.emitHud();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = window.requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = window.requestAnimationFrame(tick);
    }
  }

  // Event listeners
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.modalOpen) return;
    if (e.repeat && (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE')) {
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        e.preventDefault();
        this.togglePause();
      }
      return;
    }

    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.phase === 'title' || this.phase === 'gameover') {
      if (e.code === 'Enter' || e.code === 'Space') {
        // Ignore if user focused a modal button
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'button') return;
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.held.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.held.right = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.held.up = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.held.down = true;
        break;
      case 'Space':
        e.preventDefault();
        this.triggerJump();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyE':
        e.preventDefault();
        this.triggerDash();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.held.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.held.right = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.held.up = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.held.down = false;
        break;
    }
  };

  private onWindowBlur = (): void => {
    this.clearHeldKeys();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
  };

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing' || this.modalOpen) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.sound.unlock();
    const rect = this.renderer.domElement.getBoundingClientRect();
    const midX = rect.left + rect.width * 0.5;
    const side: 'left' | 'right' = e.clientX < midX ? 'left' : 'right';
    this.activePointers.set(e.pointerId, {
      side,
      startX: e.clientX,
      startY: e.clientY,
      swiped: false,
    });
    this.syncCanvasTouchSteer();

    // Immediate crisp lateral impulse when tapping left or right half of screen
    const sign = side === 'right' ? 1 : -1;
    this.vx = sign * Math.max(Math.abs(this.vx), 13.5);
    this.emitHud();
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    const entry = this.activePointers.get(e.pointerId);
    if (!entry || this.phase !== 'playing') return;

    const dy = e.clientY - entry.startY;
    if (!entry.swiped && dy < -48) {
      entry.swiped = true;
      this.triggerJump();
    } else if (!entry.swiped && dy > 56) {
      entry.swiped = true;
      this.triggerDash();
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const midX = rect.left + rect.width * 0.5;
    const newSide: 'left' | 'right' = e.clientX < midX ? 'left' : 'right';
    if (newSide !== entry.side) {
      entry.side = newSide;
      this.syncCanvasTouchSteer();
      this.emitHud();
    }
  };

  private onCanvasPointerUp = (e: PointerEvent): void => {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.delete(e.pointerId);
    this.syncCanvasTouchSteer();
    this.emitHud();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    window.addEventListener('pointermove', this.onCanvasPointerMove);
    window.addEventListener('pointerup', this.onCanvasPointerUp);
    window.addEventListener('pointercancel', this.onCanvasPointerUp);
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    if (this.unsubPlayables) {
      this.unsubPlayables();
      this.unsubPlayables = null;
    }

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    window.removeEventListener('pointermove', this.onCanvasPointerMove);
    window.removeEventListener('pointerup', this.onCanvasPointerUp);
    window.removeEventListener('pointercancel', this.onCanvasPointerUp);

    this.textures.dispose();
    this.sharedRoadGeo.dispose();
    this.sharedRoadMat.dispose();
    this.sharedBridgeMat.dispose();
    this.sharedRailMat.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
