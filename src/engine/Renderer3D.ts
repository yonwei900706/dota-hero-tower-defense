import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HERO_MAP } from '../data/heroes';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  INITIAL_BUILD_PADS,
  MAP_PROPS,
  PAD_RADIUS,
  PATH_WAYPOINTS,
  PATH_WIDTH,
  RIVER_BRIDGES,
} from '../data/map';
import { RUNE_DEFS } from '../data/mechanics';
import { GraphicsQuality, Season, TimeOfDay } from '../types';
import { CreepRig, createCreepRig, updateCreepRig } from './CreepModels';
import { GameEngine } from './GameEngine';
import { HeroRig, createHeroRig, updateHeroRig } from './HeroModels';
import { ParticleSystem3D } from './ParticleSystem3D';
import {
  createCobblestoneTextures,
  createSeasonGroundTexture,
  createStonePedestalTextures,
  createTerrainBumpMap,
} from './ProceduralTextures';

const WORLD_SCALE = 0.05;
const PEDESTAL_HEIGHT = 0.52;

export function toWorldX(x: number): number {
  return (x - CANVAS_WIDTH / 2) * WORLD_SCALE;
}

export function toWorldZ(y: number): number {
  return (y - CANVAS_HEIGHT / 2) * WORLD_SCALE;
}

export function toGameX(wx: number): number {
  return wx / WORLD_SCALE + CANVAS_WIDTH / 2;
}

export function toGameY(wz: number): number {
  return wz / WORLD_SCALE + CANVAS_HEIGHT / 2;
}

interface Effect3DEntry {
  mesh: THREE.Object3D;
  kind: string;
}

interface TorchEntry {
  flame: THREE.Mesh;
  light?: THREE.PointLight;
  basePos: THREE.Vector3;
  phase: number;
}

interface Rune3DEntry {
  group: THREE.Group;
  crystal: THREE.Mesh;
  ring: THREE.Mesh;
}

interface SwayTreeEntry {
  canopy: THREE.Group;
  phase: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export class Renderer3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  public quality: GraphicsQuality;

  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  // Camera rig state (framed for 1560x860 Grand Map)
  private camTarget = new THREE.Vector3(0.4, 0, 0.8);
  private camDistance = 74;
  private camYaw = 0;
  private camPitch = 0.89;
  private shakeIntensity = 0;

  // 4-Season + Day/Night dynamic scene handles
  private currentThemeKey = '';
  private seasonTextures!: Record<Season, THREE.CanvasTexture>;
  private groundMesh!: THREE.Mesh;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private treeCanopyMat!: THREE.MeshStandardMaterial;
  private blossomCanopyMat!: THREE.MeshStandardMaterial;
  private grassTuftMat!: THREE.MeshStandardMaterial;
  private weatherVelocities: Float32Array = new Float32Array(0);

  // GLSL River & Lighting Props
  private riverUniforms!: {
    uTime: { value: number };
    uWaterShallow: { value: THREE.Color };
    uWaterDeep: { value: THREE.Color };
    uSkyColor: { value: THREE.Color };
    uWinterMix: { value: number };
  };
  private torches: TorchEntry[] = [];
  private swayingTrees: SwayTreeEntry[] = [];
  private particles!: ParticleSystem3D;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);

  // Dynamic 3D scene registries
  private padRunes = new Map<number, THREE.Mesh>();
  private heroRigs = new Map<number, HeroRig>();
  private creepRigs = new Map<number, CreepRig>();
  private projectileMeshes = new Map<number, THREE.Object3D>();
  private runeMeshes = new Map<number, Rune3DEntry>();
  private effectMeshes = new Map<number, Effect3DEntry>();
  private seenEffectIds = new Set<number>();

  // Landmarks & animated props
  private ancientCrystal!: THREE.Mesh;
  private ancientRing!: THREE.Mesh;
  private direVortex!: THREE.Mesh;
  private ambientParticles!: THREE.Points;

  // Range preview rings
  private rangeCircle!: THREE.Mesh;
  private rangeBorder!: THREE.Mesh;
  private cmAuraCircle!: THREE.Mesh;

  // Panning & Touch state
  private isPanning = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activeTouches = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  public touchMovedDuringGesture = false;

  constructor(container: HTMLElement, overlayCanvas: HTMLCanvasElement) {
    this.container = container;
    this.overlayCanvas = overlayCanvas;
    const octx = overlayCanvas.getContext('2d');
    if (!octx) throw new Error('Overlay 2D context unavailable');
    this.overlayCtx = octx;

    this.quality = window.innerWidth > 820 ? 'high' : 'medium';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d14);
    this.scene.fog = new THREE.FogExp2(0x0b1019, 0.0068);

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 280);
    this.updateCameraTransform(0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // HDR Image-Based Lighting (IBL) for realistic metallic & crystal reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();

    // Post-Processing Bloom Composer
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.36, 0.38, 0.86);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.renderer.domElement.className = 'webgl-canvas';
    container.insertBefore(this.renderer.domElement, overlayCanvas);

    this.particles = new ParticleSystem3D(this.scene);

    this.resize();
    this.setupLights();
    this.buildEnvironment();
    this.buildRangeOverlays();
    this.bindCameraControls();
  }

  public get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public toggleQuality(): GraphicsQuality {
    this.quality = this.quality === 'high' ? 'medium' : 'high';
    return this.quality;
  }

  public resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.overlayCanvas.width = Math.floor(w * dpr);
    this.overlayCanvas.height = Math.floor(h * dpr);
    this.overlayCanvas.style.width = `${w}px`;
    this.overlayCanvas.style.height = `${h}px`;
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public resetCamera(): void {
    this.camTarget.set(0.4, 0, 0.8);
    this.camDistance = 74;
    this.camYaw = 0;
  }

  public screenToGameCoords(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      return null;
    }
    return {
      x: toGameX(hit.x),
      y: toGameY(hit.z),
    };
  }

  private bindCameraControls(): void {
    const el = this.renderer.domElement;

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.032, 22, 105);
      },
      { passive: false }
    );

    el.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const panSpeed = this.camDistance * 0.0014;
      const cos = Math.cos(this.camYaw);
      const sin = Math.sin(this.camYaw);
      this.camTarget.x -= (dx * cos + dy * sin) * panSpeed;
      this.camTarget.z -= (-dx * sin + dy * cos) * panSpeed;
      this.camTarget.x = THREE.MathUtils.clamp(this.camTarget.x, -26, 26);
      this.camTarget.z = THREE.MathUtils.clamp(this.camTarget.z, -18, 20);
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Touch controls: 1-finger drag to pan, 2-finger pinch to zoom
    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          this.touchMovedDuringGesture = false;
        }
        this.activeTouches.clear();
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
        if (e.touches.length === 2) {
          this.touchMovedDuringGesture = true;
          this.lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      },
      { passive: true }
    );

    el.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const prev = this.activeTouches.get(t.identifier);
          if (prev) {
            const dx = t.clientX - prev.x;
            const dy = t.clientY - prev.y;
            if (Math.hypot(dx, dy) > 4) {
              this.touchMovedDuringGesture = true;
            }
            const panSpeed = this.camDistance * 0.0016;
            const cos = Math.cos(this.camYaw);
            const sin = Math.sin(this.camYaw);
            this.camTarget.x -= (dx * cos + dy * sin) * panSpeed;
            this.camTarget.z -= (-dx * sin + dy * cos) * panSpeed;
            this.camTarget.x = THREE.MathUtils.clamp(this.camTarget.x, -26, 26);
            this.camTarget.z = THREE.MathUtils.clamp(this.camTarget.z, -18, 20);
          }
          this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        } else if (e.touches.length === 2) {
          this.touchMovedDuringGesture = true;
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (this.lastPinchDist > 0) {
            const delta = this.lastPinchDist - dist;
            this.camDistance = THREE.MathUtils.clamp(this.camDistance + delta * 0.12, 22, 105);
          }
          this.lastPinchDist = dist;
        }
      },
      { passive: false }
    );

    el.addEventListener(
      'touchend',
      (e) => {
        if (e.touches.length < 2) {
          this.lastPinchDist = 0;
        }
        this.activeTouches.clear();
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      if (e.key === 'q' || e.key === 'Q') {
        this.camYaw = THREE.MathUtils.clamp(this.camYaw - 0.14, -0.6, 0.6);
      } else if (e.key === 'e' || e.key === 'E') {
        this.camYaw = THREE.MathUtils.clamp(this.camYaw + 0.14, -0.6, 0.6);
      } else if (e.key === 'r' || e.key === 'R') {
        this.resetCamera();
      }
    });
  }

  private getRiverCenterX(wz: number): number {
    return -2.1 - wz * 0.49;
  }

  private getMinPlayableDist(wx: number, wz: number): number {
    let minD = Infinity;
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      const d = distToSegment(wx, wz, toWorldX(a.x), toWorldZ(a.y), toWorldX(b.x), toWorldZ(b.y));
      if (d < minD) minD = d;
    }
    for (const pad of INITIAL_BUILD_PADS) {
      const d = Math.hypot(wx - toWorldX(pad.x), wz - toWorldZ(pad.y));
      if (d < minD) minD = d;
    }
    return minD;
  }

  private getTerrainHeight(wx: number, wz: number): number {
    const riverDist = Math.abs(wx - this.getRiverCenterX(wz));
    const riverDepth = -1.25 * (1 - smoothstep(1.2, 4.3, riverDist));
    if (riverDist < 4.3) {
      return riverDepth;
    }

    const playableDist = this.getMinPlayableDist(wx, wz);
    const flatBlend = smoothstep(3.2, 7.2, playableDist);

    const hills =
      (Math.sin(wx * 0.18) * Math.cos(wz * 0.22) * 0.55 +
        Math.sin(wx * 0.35 + wz * 0.27) * 0.25 +
        0.55) *
      flatBlend;

    // Dramatic outer perimeter cliffs framing the battlefield
    const edgeX = smoothstep(33, 47, Math.abs(wx));
    const edgeZ = smoothstep(19, 29, Math.abs(wz));
    const cliff = Math.max(edgeX, edgeZ) * 3.4 * flatBlend;

    return hills + cliff;
  }

  private setupLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0x9ec5f8, 0x1c1412, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.95);
    this.sunLight.position.set(24, 46, 26);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 140;
    const d = 48;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const direLight = new THREE.PointLight(0xef4444, 32, 44, 1.4);
    direLight.position.set(toWorldX(PATH_WAYPOINTS[0].x), 6, toWorldZ(PATH_WAYPOINTS[0].y));
    this.scene.add(direLight);

    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    const radiantLight = new THREE.PointLight(0x10b981, 36, 46, 1.4);
    radiantLight.position.set(toWorldX(end.x), 6.5, toWorldZ(end.y));
    this.scene.add(radiantLight);

    const riverLight = new THREE.PointLight(0x38bdf8, 14, 40, 1.5);
    riverLight.position.set(-2, 4.5, 0);
    this.scene.add(riverLight);
  }

  private applySeasonAndTimeTheme(season: Season, timeOfDay: TimeOfDay): void {
    const key = `${season}_${timeOfDay}`;
    if (this.currentThemeKey === key) return;
    this.currentThemeKey = key;

    const gMat = this.groundMesh.material as THREE.MeshStandardMaterial;
    gMat.map = this.seasonTextures[season];
    gMat.needsUpdate = true;

    const pMat = this.ambientParticles.material as THREE.PointsMaterial;
    const fog = this.scene.fog as THREE.FogExp2;
    const isNight = timeOfDay === 'night';

    this.scene.environmentIntensity = isNight ? 0.42 : 0.65;
    this.riverUniforms.uWinterMix.value = season === 'winter' ? 1.0 : 0.0;

    if (season === 'spring') {
      this.scene.background = new THREE.Color(isNight ? 0x071018 : 0x0e1d26);
      fog.color.setHex(isNight ? 0x09131c : 0x11242e);
      this.sunLight.color.setHex(isNight ? 0x93c5fd : 0xfff7ed);
      this.sunLight.intensity = isNight ? 1.05 : 1.95;
      this.hemiLight.color.setHex(isNight ? 0x475569 : 0xa5d8ff);
      this.hemiLight.groundColor.setHex(0x1b3324);
      this.treeCanopyMat.color.setHex(0x22c55e);
      this.blossomCanopyMat.color.setHex(0xf472b6);
      this.grassTuftMat.color.setHex(0x16a34a);
      this.riverUniforms.uWaterShallow.value.setHex(0x06b6d4);
      this.riverUniforms.uWaterDeep.value.setHex(0x0c4a6e);
      this.riverUniforms.uSkyColor.value.setHex(isNight ? 0x1e3a5f : 0x7dd3fc);
      pMat.color.setHex(0xf9a8d4);
      pMat.size = 0.34;
    } else if (season === 'summer') {
      this.scene.background = new THREE.Color(isNight ? 0x09100c : 0x121b15);
      fog.color.setHex(isNight ? 0x0c1610 : 0x162219);
      this.sunLight.color.setHex(isNight ? 0x93c5fd : 0xfef08a);
      this.sunLight.intensity = isNight ? 1.05 : 2.15;
      this.hemiLight.color.setHex(isNight ? 0x64748b : 0xfde68a);
      this.hemiLight.groundColor.setHex(0x293218);
      this.treeCanopyMat.color.setHex(0x15803d);
      this.blossomCanopyMat.color.setHex(0x65a30d);
      this.grassTuftMat.color.setHex(0x4d7c0f);
      this.riverUniforms.uWaterShallow.value.setHex(0x0284c7);
      this.riverUniforms.uWaterDeep.value.setHex(0x082f49);
      this.riverUniforms.uSkyColor.value.setHex(isNight ? 0x1e3a5f : 0xfde68a);
      pMat.color.setHex(0xfde047);
      pMat.size = 0.28;
    } else if (season === 'autumn') {
      this.scene.background = new THREE.Color(isNight ? 0x110a0a : 0x1c110e);
      fog.color.setHex(isNight ? 0x170d0c : 0x261511);
      this.sunLight.color.setHex(isNight ? 0xa5b4fc : 0xfdba74);
      this.sunLight.intensity = isNight ? 1.0 : 1.85;
      this.hemiLight.color.setHex(isNight ? 0x64748b : 0xfb923c);
      this.hemiLight.groundColor.setHex(0x2e1710);
      this.treeCanopyMat.color.setHex(0xd97706);
      this.blossomCanopyMat.color.setHex(0xdc2626);
      this.grassTuftMat.color.setHex(0xb45309);
      this.riverUniforms.uWaterShallow.value.setHex(0x0e7490);
      this.riverUniforms.uWaterDeep.value.setHex(0x164e63);
      this.riverUniforms.uSkyColor.value.setHex(isNight ? 0x312e81 : 0xfdba74);
      pMat.color.setHex(0xf97316);
      pMat.size = 0.36;
    } else {
      // winter
      this.scene.background = new THREE.Color(isNight ? 0x060d18 : 0x0e1929);
      fog.color.setHex(isNight ? 0x0a1424 : 0x152538);
      this.sunLight.color.setHex(isNight ? 0x93c5fd : 0xe0f2fe);
      this.sunLight.intensity = isNight ? 1.15 : 2.05;
      this.hemiLight.color.setHex(isNight ? 0x475569 : 0xbae6fd);
      this.hemiLight.groundColor.setHex(0x334155);
      this.treeCanopyMat.color.setHex(0xcbd5e1);
      this.blossomCanopyMat.color.setHex(0xe0f2fe);
      this.grassTuftMat.color.setHex(0x94a3b8);
      this.riverUniforms.uWaterShallow.value.setHex(0x7dd3fc);
      this.riverUniforms.uWaterDeep.value.setHex(0x0284c7);
      this.riverUniforms.uSkyColor.value.setHex(0xe0f2fe);
      pMat.color.setHex(0xffffff);
      pMat.size = 0.36;
    }
  }

  private buildEnvironment(): void {
    this.seasonTextures = {
      spring: createSeasonGroundTexture('spring'),
      summer: createSeasonGroundTexture('summer'),
      autumn: createSeasonGroundTexture('autumn'),
      winter: createSeasonGroundTexture('winter'),
    };
    this.treeCanopyMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.78 });
    this.blossomCanopyMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.72 });
    this.grassTuftMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 });

    // 1. Sculpted 3D Heightmap Terrain with Carved Riverbed & Perimeter Cliffs
    const groundGeo = new THREE.PlaneGeometry(124, 80, 96, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      pos.setY(i, this.getTerrainHeight(wx, wz));
    }
    pos.needsUpdate = true;
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.seasonTextures.spring,
      bumpMap: createTerrainBumpMap(),
      bumpScale: 0.16,
      roughness: 0.88,
      metalness: 0.04,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 2. Custom GLSL Animated River Shader inside the Carved Trench
    this.riverUniforms = {
      uTime: { value: 0 },
      uWaterShallow: { value: new THREE.Color(0x06b6d4) },
      uWaterDeep: { value: new THREE.Color(0x0c4a6e) },
      uSkyColor: { value: new THREE.Color(0x7dd3fc) },
      uWinterMix: { value: 0 },
    };

    const riverGeo = new THREE.PlaneGeometry(6.8, 76, 12, 36);
    riverGeo.rotateX(-Math.PI / 2);
    const riverMat = new THREE.ShaderMaterial({
      uniforms: this.riverUniforms,
      transparent: true,
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uWinterMix;
        void main() {
          vUv = uv;
          vec3 p = position;
          float wave = sin(p.z * 0.65 + uTime * 2.2) * cos(p.x * 1.4 - uTime * 1.3) * 0.04;
          p.y += wave * (1.0 - uWinterMix * 0.85);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uWaterShallow;
        uniform vec3 uWaterDeep;
        uniform vec3 uSkyColor;
        uniform float uWinterMix;
        void main() {
          float flow = vUv.y * 16.0 - uTime * (0.85 - uWinterMix * 0.7);
          float r1 = sin(vUv.x * 18.0 + flow) * cos(vUv.x * 9.0 - flow * 0.6);
          float r2 = sin(vUv.x * 28.0 - flow * 1.2 + sin(flow * 0.5));
          float ripple = (r1 + r2) * 0.5;
          float edge = abs(vUv.x - 0.5) * 2.0;
          vec3 baseCol = mix(uWaterDeep, uWaterShallow, clamp(0.45 + ripple * 0.25 + edge * 0.35, 0.0, 1.0));
          float glint = pow(max(0.0, ripple), 5.0) * 0.55;
          float foam = smoothstep(0.76, 0.96, edge + ripple * 0.08);
          float icePattern = smoothstep(0.35, 0.78, sin(vUv.x * 22.0 + vUv.y * 44.0) * 0.5 + 0.5) * uWinterMix;
          vec3 col = mix(baseCol + uSkyColor * glint, vec3(0.86, 0.95, 1.0), foam * 0.45 + icePattern * 0.42);
          gl_FragColor = vec4(col, mix(0.84, 0.94, uWinterMix));
        }
      `,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.rotation.y = Math.atan(-0.49);
    riverMesh.position.set(-2.1, -0.34, 0);
    this.scene.add(riverMesh);

    // 3. PBR Cobblestone Lane & Stone Curbs
    const cobble = createCobblestoneTextures();
    const stoneTex = createStonePedestalTextures();
    const roadW = PATH_WIDTH * WORLD_SCALE;

    const curbMat = new THREE.MeshStandardMaterial({
      map: stoneTex.map,
      bumpMap: stoneTex.bumpMap,
      bumpScale: 0.08,
      color: 0x78716c,
      roughness: 0.75,
      metalness: 0.15,
    });

    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      const ax = toWorldX(a.x);
      const az = toWorldZ(a.y);
      const bx = toWorldX(b.x);
      const bz = toWorldZ(b.y);
      const len = Math.hypot(bx - ax, bz - az);
      const angle = Math.atan2(bz - az, bx - ax);

      const segMap = cobble.map.clone();
      segMap.needsUpdate = true;
      segMap.repeat.set(Math.max(1, Math.round((len + roadW) / 3.2)), 1);
      const segBump = cobble.bumpMap.clone();
      segBump.needsUpdate = true;
      segBump.repeat.copy(segMap.repeat);

      const roadMat = new THREE.MeshStandardMaterial({
        map: segMap,
        bumpMap: segBump,
        bumpScale: 0.12,
        roughness: 0.82,
        metalness: 0.08,
      });

      const curb = new THREE.Mesh(new THREE.BoxGeometry(len + roadW, 0.18, roadW + 0.38), curbMat);
      curb.position.set((ax + bx) / 2, 0.08, (az + bz) / 2);
      curb.rotation.y = -angle;
      curb.receiveShadow = true;
      curb.castShadow = true;
      this.scene.add(curb);

      const road = new THREE.Mesh(new THREE.BoxGeometry(len + roadW - 0.18, 0.22, roadW), roadMat);
      road.position.set((ax + bx) / 2, 0.09, (az + bz) / 2);
      road.rotation.y = -angle;
      road.receiveShadow = true;
      this.scene.add(road);
    }

    // 3b. 3D Stone Bridges with Railings & Flickering Torch Braziers
    const bridgeRailMat = new THREE.MeshStandardMaterial({
      map: stoneTex.map,
      bumpMap: stoneTex.bumpMap,
      bumpScale: 0.08,
      color: 0x94a3b8,
      roughness: 0.62,
      metalness: 0.25,
    });
    const bridgeGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.85,
    });

    for (let bi = 0; bi < RIVER_BRIDGES.length; bi++) {
      const bs = RIVER_BRIDGES[bi];
      const bx = toWorldX(bs.x);
      const bz = toWorldZ(bs.y);
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(bx, 0, bz);
      if (bi === 1) {
        bridgeGroup.rotation.y = Math.PI / 2;
      }

      const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, roadW + 0.65), bridgeRailMat);
      deck.position.y = 0.16;
      deck.receiveShadow = true;
      deck.castShadow = true;
      bridgeGroup.add(deck);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.48, 0.28), bridgeRailMat);
        rail.position.set(0, 0.48, side * (roadW / 2 + 0.24));
        rail.castShadow = true;
        bridgeGroup.add(rail);

        for (const px of [-2.85, 0, 2.85]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.78, 0.4), bridgeGoldMat);
          post.position.set(px, 0.58, side * (roadW / 2 + 0.24));
          post.castShadow = true;
          bridgeGroup.add(post);
        }
      }
      this.scene.add(bridgeGroup);

      // Torch brazier on every bridge
      this.createTorchBrazier(bx + (bi === 1 ? 1.8 : 0), 0.72, bz + (bi === 1 ? 0 : -1.8), bi < 2);
    }

    // 4. 3D Carved Mossy Stone Build Pedestals
    const pedGeo = new THREE.CylinderGeometry(
      PAD_RADIUS * WORLD_SCALE * 0.92,
      PAD_RADIUS * WORLD_SCALE * 1.08,
      PEDESTAL_HEIGHT,
      8
    );
    const pedMat = new THREE.MeshStandardMaterial({
      map: stoneTex.map,
      bumpMap: stoneTex.bumpMap,
      bumpScale: 0.1,
      color: 0x64748b,
      roughness: 0.6,
      metalness: 0.28,
    });

    for (const pad of INITIAL_BUILD_PADS) {
      const wx = toWorldX(pad.x);
      const wz = toWorldZ(pad.y);

      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.set(wx, PEDESTAL_HEIGHT / 2, wz);
      ped.castShadow = true;
      ped.receiveShadow = true;
      this.scene.add(ped);

      const rune = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.95, 8),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
        })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(wx, PEDESTAL_HEIGHT + 0.02, wz);
      this.scene.add(rune);
      this.padRunes.set(pad.id, rune);
    }

    // 5. Upgraded Multi-Cluster Organic Trees, Rocks & Dire Spires
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.9 });
    for (const prop of MAP_PROPS) {
      const wx = toWorldX(prop.x);
      const wz = toWorldZ(prop.y);
      const groundY = Math.max(0, this.getTerrainHeight(wx, wz) - 0.12);
      const g = new THREE.Group();
      g.position.set(wx, groundY, wz);
      g.scale.setScalar(prop.scale);

      if (prop.kind === 'rock') {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.95, 1),
          new THREE.MeshStandardMaterial({
            map: stoneTex.map,
            bumpMap: stoneTex.bumpMap,
            bumpScale: 0.1,
            color: 0x64748b,
            roughness: 0.88,
          })
        );
        rock.scale.set(1.25, 0.72, 1.0);
        rock.position.y = 0.42;
        rock.castShadow = true;
        rock.receiveShadow = true;
        g.add(rock);
      } else if (prop.kind === 'tree' || prop.kind === 'blossom_tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 1.5, 8), trunkMat);
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        g.add(trunk);

        const canopyGroup = new THREE.Group();
        canopyGroup.position.y = 1.5;
        const foliageMat = prop.kind === 'blossom_tree' ? this.blossomCanopyMat : this.treeCanopyMat;
        const clusters: [number, number, number, number][] = [
          [0, 0.75, 0, 1.05],
          [-0.6, 0.35, 0.45, 0.75],
          [0.58, 0.4, -0.4, 0.78],
          [0.1, 1.35, 0.1, 0.7],
        ];
        for (const [cx, cy, cz, cr] of clusters) {
          const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(cr, 1), foliageMat);
          leaf.position.set(cx, cy, cz);
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          canopyGroup.add(leaf);
        }
        g.add(canopyGroup);
        this.swayingTrees.push({ canopy: canopyGroup, phase: wx + wz });
      } else {
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(0.68, 3.0, 6),
          new THREE.MeshStandardMaterial({ color: 0x2c1b22, roughness: 0.65, metalness: 0.3 })
        );
        spire.position.y = 1.5;
        spire.rotation.z = 0.12;
        spire.castShadow = true;
        const glow = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.3, 0),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xdc2626,
            emissiveIntensity: 2.2,
          })
        );
        glow.position.set(0.15, 2.8, 0);
        g.add(spire, glow);
      }
      this.scene.add(g);
    }

    // 5b. Instanced 3D Grass Tufts across non-road terrain
    const tuftGeo = new THREE.ConeGeometry(0.16, 0.55, 5);
    tuftGeo.translate(0, 0.27, 0);
    const tuftCount = 240;
    const tuftMesh = new THREE.InstancedMesh(tuftGeo, this.grassTuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    while (placed < tuftCount && attempts < 2000) {
      attempts++;
      const wx = (Math.random() - 0.5) * 76;
      const wz = (Math.random() - 0.5) * 42;
      if (Math.abs(wx - this.getRiverCenterX(wz)) < 4.5) continue;
      if (this.getMinPlayableDist(wx, wz) < 3.4) continue;
      const wy = this.getTerrainHeight(wx, wz);
      dummy.position.set(wx, wy, wz);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.setScalar(0.75 + Math.random() * 0.8);
      dummy.updateMatrix();
      tuftMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    tuftMesh.count = placed;
    tuftMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(tuftMesh);

    // 6. Towering 3D DIRE PORTAL GATE (Spawn) + Torch
    const start = PATH_WAYPOINTS[0];
    const portalGroup = new THREE.Group();
    portalGroup.position.set(toWorldX(start.x), 0, toWorldZ(start.y));
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x1c1417, roughness: 0.55, metalness: 0.45 });
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 4.2, 0.75), obsMat);
    pillarL.position.set(0, 2.1, -1.6);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.z = 1.6;
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 4.2), obsMat);
    arch.position.set(0, 4.2, 0);
    arch.castShadow = true;

    this.direVortex = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.22, 12, 28),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 2.6,
      })
    );
    this.direVortex.rotation.y = Math.PI / 2;
    this.direVortex.position.set(0, 2.2, 0);
    portalGroup.add(pillarL, pillarR, arch, this.direVortex);
    this.scene.add(portalGroup);
    this.createTorchBrazier(toWorldX(start.x) + 1.8, 0.3, toWorldZ(start.y) - 2.3, true);

    // 7. Majestic 3D RADIANT ANCIENT (Base) + Torch
    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    const ancGroup = new THREE.Group();
    ancGroup.position.set(toWorldX(end.x) + 0.8, 0, toWorldZ(end.y));

    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.6, 0.7, 8),
      new THREE.MeshStandardMaterial({
        map: stoneTex.map,
        color: 0xcbd5e1,
        roughness: 0.45,
        metalness: 0.35,
      })
    );
    dais.position.y = 0.35;
    dais.castShadow = true;
    dais.receiveShadow = true;
    ancGroup.add(dais);

    this.ancientCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.35, 0),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 2.1,
        roughness: 0.1,
        metalness: 0.55,
      })
    );
    this.ancientCrystal.scale.set(0.85, 1.75, 0.85);
    this.ancientCrystal.position.y = 2.8;
    this.ancientCrystal.castShadow = true;
    ancGroup.add(this.ancientCrystal);

    this.ancientRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.1, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.5,
        metalness: 0.9,
        roughness: 0.18,
      })
    );
    this.ancientRing.position.y = 2.8;
    ancGroup.add(this.ancientRing);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.2, 12, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      })
    );
    beam.position.y = 6.5;
    ancGroup.add(beam);
    this.scene.add(ancGroup);
    this.createTorchBrazier(toWorldX(end.x) - 1.5, 0.3, toWorldZ(end.y) + 2.4, true);

    // 8. 4-Season 3D Weather Particles
    const count = 280;
    const positions = new Float32Array(count * 3);
    this.weatherVelocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = 0.8 + Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 52;
      this.weatherVelocities[i] = 1.1 + Math.random() * 1.4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ambientParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        size: 0.34,
        color: 0xf9a8d4,
        transparent: true,
        opacity: 0.82,
      })
    );
    this.scene.add(this.ambientParticles);
    this.applySeasonAndTimeTheme('spring', 'day');
  }

  private createTorchBrazier(wx: number, wy: number, wz: number, withLight: boolean): void {
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 })
    );
    stand.position.set(wx, wy + 0.35, wz);
    stand.castShadow = true;
    this.scene.add(stand);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.62, 6),
      new THREE.MeshBasicMaterial({ color: 0xfb923c })
    );
    flame.position.set(wx, wy + 0.88, wz);
    this.scene.add(flame);

    let light: THREE.PointLight | undefined;
    if (withLight) {
      light = new THREE.PointLight(0xf97316, 10, 14, 1.6);
      light.position.set(wx, wy + 1.25, wz);
      this.scene.add(light);
    }

    this.torches.push({
      flame,
      light,
      basePos: new THREE.Vector3(wx, wy + 0.88, wz),
      phase: wx * 1.3 + wz * 0.7,
    });
  }

  private buildRangeOverlays(): void {
    this.rangeCircle = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
    );
    this.rangeCircle.rotation.x = -Math.PI / 2;
    this.rangeCircle.position.y = 0.26;
    this.rangeCircle.visible = false;
    this.scene.add(this.rangeCircle);

    this.rangeBorder = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })
    );
    this.rangeBorder.rotation.x = -Math.PI / 2;
    this.rangeBorder.position.y = 0.28;
    this.rangeBorder.visible = false;
    this.scene.add(this.rangeBorder);

    this.cmAuraCircle = new THREE.Mesh(
      new THREE.RingGeometry(195 * WORLD_SCALE - 0.15, 195 * WORLD_SCALE, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    this.cmAuraCircle.rotation.x = -Math.PI / 2;
    this.cmAuraCircle.position.y = 0.29;
    this.cmAuraCircle.visible = false;
    this.scene.add(this.cmAuraCircle);
  }

  private updateCameraTransform(dt: number): void {
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.4);
    }
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    const horiz = Math.cos(this.camPitch) * this.camDistance;
    const vert = Math.sin(this.camPitch) * this.camDistance;

    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camYaw) * horiz + shakeX,
      vert + shakeY,
      this.camTarget.z + Math.cos(this.camYaw) * horiz
    );
    this.camera.lookAt(this.camTarget);
  }

  public render(engine: GameEngine, dt: number): void {
    const time = engine.elapsedTime;
    const season = engine.getActiveSeason();
    const timeOfDay = engine.getActiveTimeOfDay();
    this.applySeasonAndTimeTheme(season, timeOfDay);

    // GLSL River time uniform
    this.riverUniforms.uTime.value = time;

    // Animate landmarks
    this.ancientCrystal.rotation.y = time * 0.9;
    this.ancientCrystal.position.y = 2.8 + Math.sin(time * 2.2) * 0.25;
    this.ancientRing.rotation.x = time * 0.7;
    this.ancientRing.rotation.y = time * 1.1;
    this.direVortex.rotation.z = -time * 2.2;

    // Gentle tree wind sway
    for (const st of this.swayingTrees) {
      st.canopy.rotation.z = Math.sin(time * 1.4 + st.phase) * 0.04;
      st.canopy.rotation.x = Math.cos(time * 1.1 + st.phase) * 0.03;
    }

    // Flickering 3D Torches (brighter at Night)
    const torchMult = timeOfDay === 'night' ? 1.85 : 0.85;
    for (const t of this.torches) {
      const flick = 0.88 + Math.sin(time * 15 + t.phase) * 0.14 + Math.cos(time * 23 + t.phase) * 0.08;
      t.flame.scale.set(1, flick, 1);
      if (t.light) {
        t.light.intensity = 10 * torchMult * flick;
      }
    }

    // Falling 4-Season weather particles
    const posAttr = this.ambientParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const fallMult = season === 'summer' ? 0.25 : season === 'winter' ? 1.45 : 0.95;
    const driftX = season === 'autumn' ? 2.2 : season === 'spring' ? 1.1 : 0.5;
    for (let i = 0; i < this.weatherVelocities.length; i++) {
      const idx = i * 3;
      const v = this.weatherVelocities[i];
      arr[idx + 1] -= v * fallMult * dt;
      arr[idx] += Math.sin(time + i) * 0.4 * dt + driftX * dt;
      if (arr[idx + 1] < 0.4) {
        arr[idx + 1] = 14.5;
        arr[idx] = (Math.random() - 0.5) * 90;
      }
      if (arr[idx] > 46) arr[idx] = -46;
    }
    posAttr.needsUpdate = true;

    // Drain & spawn 3D burst particles (gold coins, spell shards, rock debris)
    for (const evt of engine.drainBurstEvents()) {
      this.particles.spawnBurst(evt, toWorldX(evt.x), toWorldZ(evt.y));
    }
    this.particles.update(dt);

    this.syncPads(engine, time);
    this.syncRangeOverlays(engine);
    this.syncTowers(engine, time);
    this.syncCreeps(engine, time);
    this.syncProjectiles(engine);
    this.syncRunes(engine, time);
    this.syncEffects(engine);

    this.updateCameraTransform(dt);
    if (this.quality === 'high') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.renderProjectedHUD(engine);
  }

  private syncPads(engine: GameEngine, time: number): void {
    const placing = engine.selectedHeroToBuy !== null;
    const pulse = 0.55 + Math.sin(time * 5.5) * 0.45;

    for (const pad of engine.pads) {
      const rune = this.padRunes.get(pad.id);
      if (!rune) continue;
      if (pad.occupiedByTowerId !== null) {
        rune.visible = false;
        continue;
      }
      rune.visible = true;
      const mat = rune.material as THREE.MeshBasicMaterial;
      const isHovered = engine.hoveredPadId === pad.id;
      if (placing) {
        mat.color.setHex(isHovered ? 0xfacc15 : 0x38bdf8);
        mat.opacity = isHovered ? 0.95 : 0.35 + pulse * 0.45;
      } else {
        mat.color.setHex(0x94a3b8);
        mat.opacity = isHovered ? 0.45 : 0.16;
      }
    }
  }

  private syncRangeOverlays(engine: GameEngine): void {
    let show = false;
    let wx = 0;
    let wz = 0;
    let radius = 1;
    let colorHex = 0xfacc15;
    let showCmAura = false;

    if (engine.selectedHeroToBuy && engine.hoveredPadId !== null) {
      const pad = engine.pads.find(
        (p) => p.id === engine.hoveredPadId && p.occupiedByTowerId === null
      );
      if (pad) {
        const def = HERO_MAP[engine.selectedHeroToBuy];
        show = true;
        wx = toWorldX(pad.x);
        wz = toWorldZ(pad.y);
        radius = def.levels[0].range * WORLD_SCALE;
        colorHex = new THREE.Color(def.primaryColor).getHex();
      }
    } else if (engine.selectedTowerId !== null) {
      const tower = engine.towers.find((t) => t.id === engine.selectedTowerId);
      if (tower) {
        const def = HERO_MAP[tower.heroId];
        show = true;
        wx = toWorldX(tower.x);
        wz = toWorldZ(tower.y);
        let rng = def.levels[tower.level - 1].range;
        if (tower.heroId === 'sniper' && tower.talent === 'left') rng += 90;
        if (
          engine.getActiveSynergies().includes('marksman') &&
          (tower.heroId === 'sniper' || tower.heroId === 'drow_ranger')
        ) {
          rng *= 1.2;
        }
        radius = rng * WORLD_SCALE;
        colorHex = new THREE.Color(def.primaryColor).getHex();
        showCmAura = tower.heroId === 'crystal_maiden' || tower.heroId === 'drow_ranger';
      }
    }

    this.rangeCircle.visible = show;
    this.rangeBorder.visible = show;
    if (show) {
      this.rangeCircle.position.set(wx, 0.26, wz);
      this.rangeCircle.scale.set(radius, radius, 1);
      (this.rangeCircle.material as THREE.MeshBasicMaterial).color.setHex(colorHex);

      this.rangeBorder.position.set(wx, 0.28, wz);
      this.rangeBorder.scale.set(radius, radius, 1);
      (this.rangeBorder.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    }

    this.cmAuraCircle.visible = showCmAura;
    if (showCmAura) {
      this.cmAuraCircle.position.set(wx, 0.29, wz);
      (this.cmAuraCircle.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    }
  }

  private syncTowers(engine: GameEngine, time: number): void {
    const activeIds = new Set<number>();

    for (const tower of engine.towers) {
      activeIds.add(tower.id);
      let rig = this.heroRigs.get(tower.id);
      if (!rig) {
        rig = createHeroRig(tower.heroId);
        rig.root.position.set(toWorldX(tower.x), PEDESTAL_HEIGHT, toWorldZ(tower.y));
        this.scene.add(rig.root);
        this.heroRigs.set(tower.id, rig);
      }
      updateHeroRig(rig, tower, time);
    }

    for (const [id, rig] of this.heroRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(rig.root);
        this.heroRigs.delete(id);
      }
    }
  }

  private syncCreeps(engine: GameEngine, time: number): void {
    const activeIds = new Set<number>();

    for (const creep of engine.creeps) {
      activeIds.add(creep.id);
      const wx = toWorldX(creep.x);
      const wz = toWorldZ(creep.y);

      let rig = this.creepRigs.get(creep.id);
      if (!rig) {
        rig = createCreepRig(creep);
        rig.lastX = wx;
        rig.lastZ = wz;
        rig.root.position.set(wx, 0, wz);
        this.scene.add(rig.root);
        this.creepRigs.set(creep.id, rig);
      }
      updateCreepRig(rig, creep, wx, wz, time);
    }

    for (const [id, rig] of this.creepRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(rig.root);
        this.creepRigs.delete(id);
      }
    }
  }

  private createProjectileMesh(heroId: string, colorHex: number, radius: number, isUlt: boolean): THREE.Object3D {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    if (heroId === 'sniper' || heroId === 'drow_ranger') {
      // Sculpted aerodynamic tracer / Frost Arrow oriented along +Z
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, isUlt ? 1.45 : 0.95, 6),
        mat
      );
      shaft.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 6), mat);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = isUlt ? 0.72 : 0.48;
      g.add(shaft, tip);
      return g;
    }
    if (heroId === 'crystal_maiden') {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mat);
      shard.scale.set(0.8, 0.8, 1.6);
      return shard;
    }
    const r = Math.max(0.16, radius * 0.045);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
  }

  private syncProjectiles(engine: GameEngine): void {
    const activeIds = new Set<number>();

    for (const p of engine.projectiles) {
      activeIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        mesh = this.createProjectileMesh(
          p.heroId,
          new THREE.Color(p.color).getHex(),
          p.radius,
          Boolean(p.isUltimate)
        );
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }
      const wx = toWorldX(p.x);
      const wz = toWorldZ(p.y);
      mesh.position.set(wx, 1.45, wz);
      mesh.lookAt(toWorldX(p.targetX), 1.45, toWorldZ(p.targetY));
    }

    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }
  }

  private syncRunes(engine: GameEngine, time: number): void {
    const activeIds = new Set<number>();

    for (const rune of engine.activeRunes) {
      activeIds.add(rune.id);
      let entry = this.runeMeshes.get(rune.id);
      if (!entry) {
        const def = RUNE_DEFS[rune.kind];
        const group = new THREE.Group();
        group.position.set(toWorldX(rune.x), 0.1, toWorldZ(rune.y));

        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.58, 0),
          new THREE.MeshStandardMaterial({
            color: def.hex,
            emissive: def.hex,
            emissiveIntensity: 2.2,
            roughness: 0.1,
            metalness: 0.4,
          })
        );
        crystal.scale.set(0.85, 1.45, 0.85);
        crystal.position.y = 1.25;

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.85, 1.15, 24),
          new THREE.MeshBasicMaterial({
            color: def.hex,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.65, 9, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: def.hex,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
          })
        );
        pillar.position.y = 4.6;

        group.add(crystal, ring, pillar);
        this.scene.add(group);
        entry = { group, crystal, ring };
        this.runeMeshes.set(rune.id, entry);
      }

      entry.crystal.rotation.y = time * 2.4;
      entry.crystal.position.y = 1.25 + Math.sin(time * 4) * 0.25;
      const pulse = 0.95 + Math.sin(time * 6) * 0.18;
      entry.ring.scale.set(pulse, pulse, 1);
    }

    for (const [id, entry] of this.runeMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        this.runeMeshes.delete(id);
      }
    }
  }

  private syncEffects(engine: GameEngine): void {
    const activeIds = new Set<number>();

    for (const fx of engine.effects) {
      activeIds.add(fx.id);

      if (!this.seenEffectIds.has(fx.id)) {
        this.seenEffectIds.add(fx.id);
        if (fx.kind === 'aegis_roar' || fx.kind === 'sunstrike_pillar') {
          this.shakeIntensity = 0.85;
        } else if (fx.kind === 'beam' || fx.kind === 'sky_bolt' || fx.maxRadius >= 110) {
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.42);
        }
      }

      const t = Math.min(1, fx.age / fx.duration);
      const alpha = Math.max(0, 1 - t);
      let entry = this.effectMeshes.get(fx.id);

      if (!entry) {
        const col = new THREE.Color(fx.color);
        if (fx.kind === 'sky_bolt') {
          const tx = toWorldX(fx.x);
          const tz = toWorldZ(fx.y);
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 7; i++) {
            const frac = i / 7;
            const jitter = i === 0 || i === 7 ? 0 : 0.45;
            pts.push(
              new THREE.Vector3(
                tx + (Math.random() - 0.5) * jitter,
                16 * (1 - frac) + 0.3,
                tz + (Math.random() - 0.5) * jitter
              )
            );
          }
          const curve = new THREE.CatmullRomCurve3(pts);
          const mesh = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 12, 0.16, 6, false),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 })
          );
          this.scene.add(mesh);
          entry = { mesh, kind: fx.kind };
        } else if (fx.kind === 'sunstrike_pillar') {
          const tx = toWorldX(fx.x);
          const tz = toWorldZ(fx.y);
          const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 2.2, 22, 18, 1, true),
            new THREE.MeshBasicMaterial({
              color: col,
              transparent: true,
              opacity: 0.9,
              side: THREE.DoubleSide,
            })
          );
          mesh.position.set(tx, 11, tz);
          this.scene.add(mesh);
          entry = { mesh, kind: fx.kind };
        } else if (fx.kind === 'beam' && fx.targetX !== undefined && fx.targetY !== undefined) {
          const pts: THREE.Vector3[] = [];
          const sx = toWorldX(fx.x);
          const sz = toWorldZ(fx.y);
          const ex = toWorldX(fx.targetX);
          const ez = toWorldZ(fx.targetY);
          const segs = 7;
          for (let i = 0; i <= segs; i++) {
            const frac = i / segs;
            const jitter = i === 0 || i === segs ? 0 : 0.45;
            pts.push(
              new THREE.Vector3(
                sx + (ex - sx) * frac + (Math.random() - 0.5) * jitter,
                1.65 + (Math.random() - 0.5) * jitter,
                sz + (ez - sz) * frac + (Math.random() - 0.5) * jitter
              )
            );
          }
          const curve = new THREE.CatmullRomCurve3(pts);
          const tubeGeo = new THREE.TubeGeometry(curve, 14, 0.14, 6, false);
          const mesh = new THREE.Mesh(
            tubeGeo,
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 })
          );
          this.scene.add(mesh);
          entry = { mesh, kind: fx.kind };
        } else {
          const arcLen = fx.kind === 'cleave' ? Math.PI * 0.75 : Math.PI * 2;
          const ringGeo = new THREE.RingGeometry(0.75, 1.0, 32, 1, 0, arcLen);
          const mesh = new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({
              color: col,
              transparent: true,
              opacity: 0.85,
              side: THREE.DoubleSide,
            })
          );
          mesh.rotation.x = -Math.PI / 2;
          if (fx.kind === 'cleave' && fx.angle !== undefined) {
            mesh.rotation.z = -fx.angle + arcLen / 2;
          }
          mesh.position.set(toWorldX(fx.x), 0.35, toWorldZ(fx.y));
          this.scene.add(mesh);
          entry = { mesh, kind: fx.kind };
        }
        this.effectMeshes.set(fx.id, entry);
      }

      const m = entry.mesh as THREE.Mesh;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = alpha * 0.9;
      if (fx.kind !== 'beam' && fx.kind !== 'sky_bolt' && fx.kind !== 'sunstrike_pillar') {
        const curR = (fx.radius + (fx.maxRadius - fx.radius) * t) * WORLD_SCALE;
        m.scale.set(Math.max(0.1, curR), Math.max(0.1, curR), 1);
      } else if (fx.kind === 'sunstrike_pillar') {
        const s = 1 + t * 0.6;
        m.scale.set(s, 1, s);
      }
    }

    for (const [id, entry] of this.effectMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.effectMeshes.delete(id);
      }
    }
  }

  private projectToScreen(wx: number, wy: number, wz: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(this.camera);
    if (v.z > 1) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
    };
  }

  private renderProjectedHUD(engine: GameEngine): void {
    const ctx = this.overlayCtx;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // 1. Tower Level Stars & Mana Bars
    for (const tower of engine.towers) {
      const def = HERO_MAP[tower.heroId];
      const topPos = this.projectToScreen(toWorldX(tower.x), PEDESTAL_HEIGHT + 2.65, toWorldZ(tower.y));
      const botPos = this.projectToScreen(toWorldX(tower.x), PEDESTAL_HEIGHT + 0.1, toWorldZ(tower.y));

      if (topPos) {
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.lineWidth = 3;
        const label = tower.level === 4 ? '★ AGHS ★' : '★'.repeat(tower.level);
        ctx.strokeText(label, topPos.x, topPos.y);
        ctx.fillStyle = tower.level === 4 ? '#38bdf8' : '#fbbf24';
        ctx.fillText(label, topPos.x, topPos.y);
      }

      if (botPos) {
        const barW = 36;
        const barH = 4;
        const manaPct = Math.min(1, tower.mana / def.maxMana);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(botPos.x - barW / 2, botPos.y + 8, barW, barH);
        ctx.fillStyle = tower.auraBoosted ? '#7dd3fc' : '#3b82f6';
        ctx.fillRect(botPos.x - barW / 2, botPos.y + 8, barW * manaPct, barH);
      }
    }

    // 2. Active River Rune Prompts
    for (const rune of engine.activeRunes) {
      const pos = this.projectToScreen(toWorldX(rune.x), 2.5, toWorldZ(rune.y));
      if (!pos) continue;
      const def = RUNE_DEFS[rune.kind];
      ctx.font = '800 11px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
      ctx.lineWidth = 3.5;
      const txt = `${def.icon} TAP RUNE (${Math.ceil(rune.ttl)}s)`;
      ctx.strokeText(txt, pos.x, pos.y);
      ctx.fillStyle = def.color;
      ctx.fillText(txt, pos.x, pos.y);
    }

    // 3. Creep & Roshan HP Bars
    for (const c of engine.creeps) {
      const yOffset = c.isBoss ? 3.85 : c.def.type.includes('dragon') ? 2.1 : 1.75;
      const pos = this.projectToScreen(toWorldX(c.x), yOffset, toWorldZ(c.y));
      if (!pos) continue;

      const barW = c.isBoss ? 72 : Math.max(28, c.def.radius * 2.1);
      const barH = c.isBoss ? 7 : 5;
      const hpPct = Math.max(0, c.hp / c.maxHp);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(pos.x - barW / 2 - 1, pos.y - 1, barW + 2, barH + 2);
      ctx.fillStyle = c.isBoss
        ? '#f97316'
        : hpPct > 0.5
        ? '#22c55e'
        : hpPct > 0.25
        ? '#eab308'
        : '#ef4444';
      ctx.fillRect(pos.x - barW / 2, pos.y, barW * hpPct, barH);

      if (c.stunTimer > 0) {
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#facc15';
        ctx.fillText('STUNNED', pos.x, pos.y - 5);
      }
    }

    // 4. Floating Gold & Ability Callouts
    for (const ft of engine.floatingTexts) {
      const alpha = Math.max(0, 1 - ft.age / ft.duration);
      const rise = ft.age * 2.2;
      const pos = this.projectToScreen(toWorldX(ft.x), 2.1 + rise, toWorldZ(ft.y));
      if (!pos) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = ft.large ? '900 15px Cinzel, serif' : '700 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, pos.x, pos.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, pos.x, pos.y);
      ctx.restore();
    }
  }
}
