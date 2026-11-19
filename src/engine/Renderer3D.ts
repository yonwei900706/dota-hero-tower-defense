import * as THREE from 'three';
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
import { Season } from '../types';
import { GameEngine } from './GameEngine';
import { CreepRig, createCreepRig, updateCreepRig } from './CreepModels';
import { HeroRig, createHeroRig, updateHeroRig } from './HeroModels';

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

export class Renderer3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  // Camera rig state (framed for 1560x860 Grand Map)
  private camTarget = new THREE.Vector3(0.4, 0, 0.8);
  private camDistance = 74;
  private camYaw = 0; // radians
  private camPitch = 0.89; // radians from horizontal
  private shakeIntensity = 0;

  // 4-Season dynamic scene handles
  private currentSeason: Season | null = null;
  private seasonTextures!: Record<Season, THREE.CanvasTexture>;
  private groundMesh!: THREE.Mesh;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private treeCanopyMat!: THREE.MeshStandardMaterial;
  private blossomCanopyMat!: THREE.MeshStandardMaterial;
  private weatherVelocities: Float32Array = new Float32Array(0);

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);

  // Dynamic 3D scene registries
  private padRunes = new Map<number, THREE.Mesh>();
  private heroRigs = new Map<number, HeroRig>();
  private creepRigs = new Map<number, CreepRig>();
  private projectileMeshes = new Map<number, THREE.Mesh>();
  private effectMeshes = new Map<number, Effect3DEntry>();
  private seenEffectIds = new Set<number>();

  // Landmarks & animated props
  private ancientCrystal!: THREE.Mesh;
  private ancientRing!: THREE.Mesh;
  private direVortex!: THREE.Mesh;
  private riverMesh!: THREE.Mesh;
  private ambientParticles!: THREE.Points;

  // Range preview rings
  private rangeCircle!: THREE.Mesh;
  private rangeBorder!: THREE.Mesh;
  private cmAuraCircle!: THREE.Mesh;

  // Panning state
  private isPanning = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(container: HTMLElement, overlayCanvas: HTMLCanvasElement) {
    this.container = container;
    this.overlayCanvas = overlayCanvas;
    const octx = overlayCanvas.getContext('2d');
    if (!octx) throw new Error('Overlay 2D context unavailable');
    this.overlayCtx = octx;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d14);
    this.scene.fog = new THREE.FogExp2(0x0b1019, 0.0085);

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
    this.renderer.toneMappingExposure = 1.18;

    this.renderer.domElement.className = 'webgl-canvas';
    container.insertBefore(this.renderer.domElement, overlayCanvas);

    this.resize();
    this.setupLights();
    this.buildEnvironment();
    this.buildRangeOverlays();
    this.bindCameraControls();
  }

  public get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

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

  private setupLights(): void {
    // Soft sky-ground hemisphere fill
    this.hemiLight = new THREE.HemisphereLight(0x9ec5f8, 0x1c1412, 0.85);
    this.scene.add(this.hemiLight);

    // Main directional key light casting crisp real-time shadows across the grand arena
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

    // Dire volcanic rim light (top-left)
    const direLight = new THREE.PointLight(0xef4444, 28, 42, 1.5);
    direLight.position.set(toWorldX(PATH_WAYPOINTS[0].x), 6, toWorldZ(PATH_WAYPOINTS[0].y));
    this.scene.add(direLight);

    // Radiant Ancient emerald glow light (bottom-right)
    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    const radiantLight = new THREE.PointLight(0x10b981, 32, 44, 1.5);
    radiantLight.position.set(toWorldX(end.x), 6.5, toWorldZ(end.y));
    this.scene.add(radiantLight);

    // Subtle river cyan bounce light
    const riverLight = new THREE.PointLight(0x38bdf8, 14, 38, 1.6);
    riverLight.position.set(0, 4.5, 0);
    this.scene.add(riverLight);
  }

  private createSeasonTerrainTexture(season: Season): THREE.CanvasTexture {
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const ctx = texCanvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    if (season === 'spring') {
      grad.addColorStop(0, '#1f2b22');
      grad.addColorStop(0.4, '#1b3826');
      grad.addColorStop(0.75, '#1f452c');
      grad.addColorStop(1, '#225435');
    } else if (season === 'summer') {
      grad.addColorStop(0, '#2a2419');
      grad.addColorStop(0.45, '#273a1e');
      grad.addColorStop(0.8, '#2d4b22');
      grad.addColorStop(1, '#365314');
    } else if (season === 'autumn') {
      grad.addColorStop(0, '#2c1816');
      grad.addColorStop(0.4, '#3d2217');
      grad.addColorStop(0.75, '#4c2916');
      grad.addColorStop(1, '#5c3317');
    } else {
      // winter
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.4, '#334155');
      grad.addColorStop(0.75, '#475569');
      grad.addColorStop(1, '#64748b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Organic seasonal ground speckles (petals, grass, autumn leaves, snowdrifts)
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 10;
      if (season === 'spring') {
        ctx.fillStyle =
          Math.random() < 0.25
            ? `rgba(244, 114, 182, ${0.06 + Math.random() * 0.1})`
            : `rgba(74, 222, 128, ${0.03 + Math.random() * 0.06})`;
      } else if (season === 'summer') {
        ctx.fillStyle =
          Math.random() < 0.3
            ? `rgba(250, 204, 21, ${0.03 + Math.random() * 0.06})`
            : `rgba(34, 197, 94, ${0.03 + Math.random() * 0.06})`;
      } else if (season === 'autumn') {
        ctx.fillStyle =
          Math.random() < 0.5
            ? `rgba(249, 115, 22, ${0.06 + Math.random() * 0.1})`
            : `rgba(234, 179, 8, ${0.05 + Math.random() * 0.09})`;
      } else {
        ctx.fillStyle = `rgba(241, 245, 249, ${0.08 + Math.random() * 0.16})`;
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(texCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private applySeasonTheme(season: Season): void {
    if (this.currentSeason === season) return;
    this.currentSeason = season;

    const gMat = this.groundMesh.material as THREE.MeshStandardMaterial;
    gMat.map = this.seasonTextures[season];
    gMat.needsUpdate = true;

    const riverMat = this.riverMesh.material as THREE.MeshStandardMaterial;
    const pMat = this.ambientParticles.material as THREE.PointsMaterial;
    const fog = this.scene.fog as THREE.FogExp2;

    if (season === 'spring') {
      this.scene.background = new THREE.Color(0x0d1b24);
      fog.color.setHex(0x10222c);
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 1.95;
      this.hemiLight.color.setHex(0xa5d8ff);
      this.hemiLight.groundColor.setHex(0x1b3324);
      this.treeCanopyMat.color.setHex(0x22c55e);
      this.blossomCanopyMat.color.setHex(0xf472b6);
      riverMat.color.setHex(0x06b6d4);
      riverMat.emissive.setHex(0x0891b2);
      riverMat.roughness = 0.14;
      pMat.color.setHex(0xf9a8d4);
      pMat.size = 0.34;
    } else if (season === 'summer') {
      this.scene.background = new THREE.Color(0x111914);
      fog.color.setHex(0x162119);
      this.sunLight.color.setHex(0xfef08a);
      this.sunLight.intensity = 2.15;
      this.hemiLight.color.setHex(0xfde68a);
      this.hemiLight.groundColor.setHex(0x293218);
      this.treeCanopyMat.color.setHex(0x15803d);
      this.blossomCanopyMat.color.setHex(0x65a30d);
      riverMat.color.setHex(0x0284c7);
      riverMat.emissive.setHex(0x0369a1);
      riverMat.roughness = 0.12;
      pMat.color.setHex(0xfde047);
      pMat.size = 0.28;
    } else if (season === 'autumn') {
      this.scene.background = new THREE.Color(0x1a100e);
      fog.color.setHex(0x241411);
      this.sunLight.color.setHex(0xfdba74);
      this.sunLight.intensity = 1.85;
      this.hemiLight.color.setHex(0xfb923c);
      this.hemiLight.groundColor.setHex(0x2e1710);
      this.treeCanopyMat.color.setHex(0xd97706);
      this.blossomCanopyMat.color.setHex(0xdc2626);
      riverMat.color.setHex(0x0e7490);
      riverMat.emissive.setHex(0x155e75);
      riverMat.roughness = 0.18;
      pMat.color.setHex(0xf97316);
      pMat.size = 0.36;
    } else {
      // winter
      this.scene.background = new THREE.Color(0x0c1624);
      fog.color.setHex(0x142438);
      this.sunLight.color.setHex(0xe0f2fe);
      this.sunLight.intensity = 2.05;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x334155);
      this.treeCanopyMat.color.setHex(0xcbd5e1);
      this.blossomCanopyMat.color.setHex(0xe0f2fe);
      riverMat.color.setHex(0x7dd3fc);
      riverMat.emissive.setHex(0x38bdf8);
      riverMat.roughness = 0.08;
      pMat.color.setHex(0xffffff);
      pMat.size = 0.36;
    }
  }

  private buildEnvironment(): void {
    // Pre-generate 4-Season procedural terrain textures
    this.seasonTextures = {
      spring: this.createSeasonTerrainTexture('spring'),
      summer: this.createSeasonTerrainTexture('summer'),
      autumn: this.createSeasonTerrainTexture('autumn'),
      winter: this.createSeasonTerrainTexture('winter'),
    };
    this.treeCanopyMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.78 });
    this.blossomCanopyMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.72 });

    // 1. Sculpted Grand Ground Plane
    const groundGeo = new THREE.PlaneGeometry(122, 78);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.seasonTextures.spring,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 2. Shimmering 3D River cutting diagonally through the Grand Map
    const riverGeo = new THREE.PlaneGeometry(5.2, 72, 8, 28);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.42,
      roughness: 0.14,
      metalness: 0.65,
      transparent: true,
      opacity: 0.84,
    });
    this.riverMesh = new THREE.Mesh(riverGeo, riverMat);
    this.riverMesh.rotation.x = -Math.PI / 2;
    this.riverMesh.rotation.z = -0.45;
    this.riverMesh.position.set(-1.5, 0.03, 0);
    this.riverMesh.receiveShadow = true;
    this.scene.add(this.riverMesh);

    // 3. Elevated Cobblestone Lane & Stone Curbs
    const roadW = PATH_WIDTH * WORLD_SCALE;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x38332e,
      roughness: 0.85,
      metalness: 0.1,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.78,
      metalness: 0.18,
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

      // Curb base
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(len + roadW, 0.18, roadW + 0.36),
        curbMat
      );
      curb.position.set((ax + bx) / 2, 0.08, (az + bz) / 2);
      curb.rotation.y = -angle;
      curb.receiveShadow = true;
      curb.castShadow = true;
      this.scene.add(curb);

      // Road cobblestone surface
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(len + roadW - 0.2, 0.22, roadW),
        roadMat
      );
      road.position.set((ax + bx) / 2, 0.09, (az + bz) / 2);
      road.rotation.y = -angle;
      road.receiveShadow = true;
      this.scene.add(road);
    }

    // 3b. 3D Stone Bridges with Railings where the lane crosses the River
    const bridgeRailMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.65,
      metalness: 0.25,
    });
    const bridgeGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.35,
      metalness: 0.75,
    });
    for (let bi = 0; bi < RIVER_BRIDGES.length; bi++) {
      const bs = RIVER_BRIDGES[bi];
      const bx = toWorldX(bs.x);
      const bz = toWorldZ(bs.y);
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(bx, 0, bz);
      if (bi === 1) {
        // Middle river crossing is vertical lane segment
        bridgeGroup.rotation.y = Math.PI / 2;
      }

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(6.0, 0.28, roadW + 0.6),
        bridgeRailMat
      );
      deck.position.y = 0.16;
      deck.receiveShadow = true;
      deck.castShadow = true;
      bridgeGroup.add(deck);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(6.0, 0.45, 0.26),
          bridgeRailMat
        );
        rail.position.set(0, 0.48, side * (roadW / 2 + 0.22));
        rail.castShadow = true;
        bridgeGroup.add(rail);

        for (const px of [-2.8, 0, 2.8]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.72, 0.38),
            bridgeGoldMat
          );
          post.position.set(px, 0.56, side * (roadW / 2 + 0.22));
          post.castShadow = true;
          bridgeGroup.add(post);
        }
      }
      this.scene.add(bridgeGroup);
    }

    // 4. 3D Carved Stone Build Pedestals
    const pedGeo = new THREE.CylinderGeometry(
      PAD_RADIUS * WORLD_SCALE * 0.92,
      PAD_RADIUS * WORLD_SCALE * 1.06,
      PEDESTAL_HEIGHT,
      8
    );
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x2a3444,
      roughness: 0.65,
      metalness: 0.3,
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

    // 5. 3D Trees & Dire Obsidian Spires
    for (const prop of MAP_PROPS) {
      const wx = toWorldX(prop.x);
      const wz = toWorldZ(prop.y);
      const g = new THREE.Group();
      g.position.set(wx, 0, wz);
      g.scale.setScalar(prop.scale);

      if (prop.kind === 'rock') {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.95, 0),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
        );
        rock.scale.set(1.2, 0.75, 1);
        rock.position.y = 0.45;
        rock.castShadow = true;
        rock.receiveShadow = true;
        g.add(rock);
      } else if (prop.kind === 'tree' || prop.kind === 'blossom_tree') {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.3, 1.45, 7),
          new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.9 })
        );
        trunk.position.y = 0.72;
        trunk.castShadow = true;
        g.add(trunk);

        const foliageMat = prop.kind === 'blossom_tree' ? this.blossomCanopyMat : this.treeCanopyMat;
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.0, 7), foliageMat);
        c1.position.y = 1.95;
        c1.castShadow = true;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.65, 7), foliageMat);
        c2.position.y = 2.95;
        c2.castShadow = true;
        g.add(c1, c2);
      } else {
        // Dire twisted obsidian spire & glowing ember rock
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, 2.9, 6),
          new THREE.MeshStandardMaterial({ color: 0x2c1b22, roughness: 0.75, metalness: 0.2 })
        );
        spire.position.y = 1.45;
        spire.rotation.z = 0.12;
        spire.castShadow = true;
        const glow = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xdc2626,
            emissiveIntensity: 1.5,
          })
        );
        glow.position.set(0.15, 2.7, 0);
        g.add(spire, glow);
      }
      this.scene.add(g);
    }

    // 6. Towering 3D DIRE PORTAL GATE (Spawn)
    const start = PATH_WAYPOINTS[0];
    const portalGroup = new THREE.Group();
    portalGroup.position.set(toWorldX(start.x), 0, toWorldZ(start.y));
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x1c1417, roughness: 0.6, metalness: 0.35 });
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
        emissiveIntensity: 2.2,
      })
    );
    this.direVortex.rotation.y = Math.PI / 2;
    this.direVortex.position.set(0, 2.2, 0);
    portalGroup.add(pillarL, pillarR, arch, this.direVortex);
    this.scene.add(portalGroup);

    // 7. Majestic 3D RADIANT ANCIENT (Base)
    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    const ancGroup = new THREE.Group();
    ancGroup.position.set(toWorldX(end.x) + 0.8, 0, toWorldZ(end.y));

    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.6, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.3 })
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
        emissiveIntensity: 1.4,
        roughness: 0.12,
        metalness: 0.5,
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
        emissiveIntensity: 0.9,
        metalness: 0.85,
        roughness: 0.2,
      })
    );
    this.ancientRing.position.y = 2.8;
    ancGroup.add(this.ancientRing);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.2, 12, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      })
    );
    beam.position.y = 6.5;
    ancGroup.add(beam);
    this.scene.add(ancGroup);

    // 8. 4-Season 3D Weather Particles (Petals / Sun-Motes / Autumn Leaves / Snowflakes)
    const count = 260;
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
    this.applySeasonTheme('spring');
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
      new THREE.RingGeometry(175 * WORLD_SCALE - 0.15, 175 * WORLD_SCALE, 48),
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
    this.applySeasonTheme(season);

    // Animate landmarks & 4-Season weather particles
    this.ancientCrystal.rotation.y = time * 0.9;
    this.ancientCrystal.position.y = 2.8 + Math.sin(time * 2.2) * 0.25;
    this.ancientRing.rotation.x = time * 0.7;
    this.ancientRing.rotation.y = time * 1.1;
    this.direVortex.rotation.z = -time * 2.2;
    (this.riverMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.38 + Math.sin(time * 2.5) * 0.12;

    // Update falling weather particles
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

    this.syncPads(engine, time);
    this.syncRangeOverlays(engine);
    this.syncTowers(engine, time);
    this.syncCreeps(engine, time);
    this.syncProjectiles(engine);
    this.syncEffects(engine);

    this.updateCameraTransform(dt);
    this.renderer.render(this.scene, this.camera);
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
        radius = def.levels[tower.level - 1].range * WORLD_SCALE;
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

  private syncProjectiles(engine: GameEngine): void {
    const activeIds = new Set<number>();

    for (const p of engine.projectiles) {
      activeIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        const r = Math.max(0.14, p.radius * 0.042);
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 10),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color) })
        );
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }
      mesh.position.set(toWorldX(p.x), 1.45, toWorldZ(p.y));
    }

    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }
  }

  private syncEffects(engine: GameEngine): void {
    const activeIds = new Set<number>();

    for (const fx of engine.effects) {
      activeIds.add(fx.id);

      // Trigger screen shake on dramatic spells
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
          // Vertical sky-to-ground lightning bolt (Zeus Thundergod's Wrath!)
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
          // Towering orbital fiery beam (Sunstrike!)
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
          // 3D jagged lightning bolt (Laguna Blade!)
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
          // Expanding 3D shockwave ring / cleave arc
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

    // 2. Creep & Roshan HP Bars
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

    // 3. Floating Gold & Ability Callouts
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
