import * as THREE from 'three';
import { CreepInstance } from '../types';

export interface CreepRig {
  root: THREE.Group;
  body: THREE.Group;
  wingL?: THREE.Mesh;
  wingR?: THREE.Mesh;
  spellBlockDome?: THREE.Mesh;
  enrageAura?: THREE.Mesh;
  slowRing: THREE.Mesh;
  poisonOrb: THREE.Mesh;
  baseY: number;
  lastX: number;
  lastZ: number;
}

function mat(
  color: number,
  roughness = 0.6,
  metalness = 0.15,
  emissive = 0x000000,
  emissiveIntensity = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
}

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

export function createCreepRig(creep: CreepInstance): CreepRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const type = creep.def.type;
  let wingL: THREE.Mesh | undefined;
  let wingR: THREE.Mesh | undefined;
  let spellBlockDome: THREE.Mesh | undefined;
  let enrageAura: THREE.Mesh | undefined;
  let baseY = 0;

  if (type === 'roshan') {
    const res = buildRoshan(body);
    spellBlockDome = res.spellBlockDome;
    enrageAura = res.enrageAura;
  } else if (type === 'catapult') {
    buildCatapult(body);
  } else if (
    type === 'black_dragon' ||
    type === 'black_drake' ||
    type === 'dragon_boss' ||
    type === 'frost_wyrm_boss'
  ) {
    const isBossDragon = type === 'dragon_boss' || type === 'frost_wyrm_boss';
    const scale = isBossDragon ? 1.95 : type === 'black_dragon' ? 1.25 : 0.85;
    const primary =
      type === 'frost_wyrm_boss'
        ? 0x0284c7
        : type === 'dragon_boss'
        ? 0x0f172a
        : type === 'black_dragon'
        ? 0x1e293b
        : 0x334155;
    const accent =
      type === 'frost_wyrm_boss'
        ? 0xbae6fd
        : type === 'dragon_boss'
        ? 0xfacc15
        : type === 'black_dragon'
        ? 0xf59e0b
        : 0x38bdf8;
    const wings = buildDragon(body, primary, accent);
    wingL = wings.wingL;
    wingR = wings.wingR;
    body.scale.setScalar(scale);
    baseY = isBossDragon ? 1.25 : 0.85;
  } else if (type === 'mud_golem' || type === 'golem_boss' || type === 'obsidian_boss') {
    buildGolem(body);
    if (type === 'golem_boss') {
      body.scale.setScalar(1.75);
    } else if (type === 'obsidian_boss') {
      body.scale.setScalar(1.95);
    }
  } else if (type === 'centaur' || type === 'centaur_boss') {
    buildCentaur(body);
    if (type === 'centaur_boss') {
      body.scale.setScalar(1.55);
    }
  } else if (type === 'shadow_fiend_boss' || type === 'doom_boss') {
    const res = buildRoshan(body);
    enrageAura = res.enrageAura;
    if (res.spellBlockDome) res.spellBlockDome.visible = false;
    body.scale.setScalar(type === 'doom_boss' ? 0.92 : 0.82);
  } else {
    buildHumanoidCreep(body, creep);
  }

  enableShadows(body);

  // Frost slow indicator ring
  const ringR = creep.isBoss ? 1.55 : 0.68;
  const slowRing = new THREE.Mesh(
    new THREE.RingGeometry(ringR * 0.85, ringR, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    })
  );
  slowRing.rotation.x = -Math.PI / 2;
  slowRing.position.y = 0.08;
  slowRing.visible = false;
  root.add(slowRing);

  // Poison indicator orb
  const poisonOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x4ade80 })
  );
  poisonOrb.position.set(0.45, creep.isBoss ? 2.4 : 1.2, 0);
  poisonOrb.visible = false;
  root.add(poisonOrb);

  return {
    root,
    body,
    wingL,
    wingR,
    spellBlockDome,
    enrageAura,
    slowRing,
    poisonOrb,
    baseY,
    lastX: 0,
    lastZ: 0,
  };
}

function buildHumanoidCreep(body: THREE.Group, creep: CreepInstance): void {
  const cMain = new THREE.Color(creep.def.color).getHex();
  const cAcc = new THREE.Color(creep.def.accentColor).getHex();
  const scale = Math.max(0.75, creep.def.radius / 14);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.36, 0.72, 10),
    mat(cMain, 0.6, 0.25)
  );
  torso.position.y = 0.56;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(cAcc, 0.5));
  head.position.y = 1.08;
  body.add(head);

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 6),
    mat(0xfef08a, 0.2, 0.2, 0xfef08a, 1.5)
  );
  eyeL.position.set(-0.08, 1.12, 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  body.add(eyeL, eyeR);

  // Weapon / shield silhouette
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.85, 0.14),
    mat(0x94a3b8, 0.3, 0.8)
  );
  weapon.position.set(0.36, 0.78, 0.18);
  weapon.rotation.x = 0.45;
  body.add(weapon);

  body.scale.setScalar(scale);
}

function buildCatapult(body: THREE.Group): void {
  const wood = mat(0x573b26, 0.85, 0.05);
  const iron = mat(0x475569, 0.35, 0.8);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 1.25), wood);
  chassis.position.y = 0.38;
  body.add(chassis);

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const positions: [number, number][] = [
    [-0.52, -0.4],
    [0.52, -0.4],
    [-0.52, 0.4],
    [0.52, 0.4],
  ];
  for (const [wx, wz] of positions) {
    const w = new THREE.Mesh(wheelGeo, iron);
    w.position.set(wx, 0.26, wz);
    body.add(w);
  }

  // Throwing arm & glowing fire boulder
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), wood);
  arm.position.set(0, 0.82, -0.15);
  arm.rotation.x = -0.45;
  body.add(arm);

  const firePot = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    mat(0xf97316, 0.2, 0.1, 0xf97316, 2.0)
  );
  firePot.position.set(0, 1.18, -0.35);
  body.add(firePot);
}

function buildCentaur(body: THREE.Group): void {
  const hide = mat(0x991b1b, 0.7, 0.1);
  const gold = mat(0xfbbf24, 0.25, 0.8);

  // Horse body
  const horseBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.25), hide);
  horseBody.position.y = 0.72;
  body.add(horseBody);

  // Upper warrior torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.45), mat(0xb91c1c, 0.55));
  torso.position.set(0, 1.26, 0.35);
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), gold);
  head.position.set(0, 1.78, 0.38);
  body.add(head);

  // Giant war axe
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), mat(0x451a03));
  axeHandle.position.set(0.48, 1.35, 0.52);
  axeHandle.rotation.x = 0.35;
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.38), mat(0xcbd5e1, 0.2, 0.9));
  axeHead.position.set(0.48, 1.9, 0.72);
  body.add(axeHandle, axeHead);
}

function buildGolem(body: THREE.Group): void {
  const rock = mat(0x78350f, 0.92, 0.05);
  const core = mat(0xd97706, 0.4, 0.2, 0xd97706, 0.7);

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), rock);
  torso.position.y = 0.78;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), core);
  head.position.set(0, 1.38, 0.12);
  body.add(head);

  const armL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), rock);
  armL.position.set(-0.62, 0.72, 0.15);
  const armR = armL.clone();
  armR.position.x = 0.62;
  body.add(armL, armR);
}

function buildDragon(
  body: THREE.Group,
  color: number,
  accent: number
): { wingL: THREE.Mesh; wingR: THREE.Mesh } {
  const scaleMat = mat(color, 0.4, 0.35);
  const glowMat = mat(accent, 0.2, 0.3, accent, 1.4);

  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.35, 10), scaleMat);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.48), scaleMat);
  head.position.set(0, 0.12, 0.75);
  body.add(head);

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 6), glowMat);
  crest.position.set(0, 0.32, 0.72);
  body.add(crest);

  const wingGeo = new THREE.BoxGeometry(1.15, 0.06, 0.65);
  wingGeo.translate(0.58, 0, 0);
  const wingR = new THREE.Mesh(wingGeo, scaleMat);
  wingR.position.set(0.2, 0.1, 0.05);

  const wingGeoL = new THREE.BoxGeometry(1.15, 0.06, 0.65);
  wingGeoL.translate(-0.58, 0, 0);
  const wingL = new THREE.Mesh(wingGeoL, scaleMat);
  wingL.position.set(-0.2, 0.1, 0.05);

  body.add(wingL, wingR);
  return { wingL, wingR };
}

function buildRoshan(body: THREE.Group): {
  spellBlockDome: THREE.Mesh;
  enrageAura: THREE.Mesh;
} {
  const obsidian = mat(0x2d0a0a, 0.55, 0.3);
  const magma = mat(0xf97316, 0.2, 0.2, 0xf97316, 2.2);
  const hornMat = mat(0x1c1917, 0.35, 0.5);

  // Massive stomping legs
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.95, 10), obsidian);
  legL.position.set(-0.52, 0.48, 0);
  const legR = legL.clone();
  legR.position.x = 0.52;
  body.add(legL, legR);

  // Towering hulking torso
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), obsidian);
  torso.scale.set(1.15, 1.15, 0.85);
  torso.position.y = 1.65;
  body.add(torso);

  // Glowing magma core on chest
  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), magma);
  chestCore.position.set(0, 1.72, 0.78);
  body.add(chestCore);

  // Giant clawed fists
  const armL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), obsidian);
  armL.position.set(-1.32, 1.35, 0.35);
  const armR = armL.clone();
  armR.position.x = 1.32;
  body.add(armL, armR);

  // Horned Demon Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.72), obsidian);
  head.position.set(0, 2.68, 0.28);
  body.add(head);

  // Burning eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), magma);
  eyeL.position.set(-0.2, 2.75, 0.64);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  body.add(eyeL, eyeR);

  // Sweeping obsidian horns
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 8), hornMat);
  hornL.position.set(-0.65, 3.2, 0.15);
  hornL.rotation.z = 0.62;
  const hornR = hornL.clone();
  hornR.position.x = 0.65;
  hornR.rotation.z = -0.62;
  body.add(hornL, hornR);

  // Linken's Sphere Spell Block energy dome
  const spellBlockDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.85, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      wireframe: false,
    })
  );
  spellBlockDome.position.y = 1.6;
  body.add(spellBlockDome);

  // Molten Aegis Enrage ground aura
  const enrageAura = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 2.25, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    })
  );
  enrageAura.rotation.x = -Math.PI / 2;
  enrageAura.position.y = 0.12;
  enrageAura.visible = false;
  body.add(enrageAura);

  return { spellBlockDome, enrageAura };
}

export function updateCreepRig(
  rig: CreepRig,
  creep: CreepInstance,
  wx: number,
  wz: number,
  time: number
): void {
  const dx = wx - rig.lastX;
  const dz = wz - rig.lastZ;
  if (Math.hypot(dx, dz) > 0.002) {
    rig.body.rotation.y = Math.atan2(dx, dz);
  }
  rig.lastX = wx;
  rig.lastZ = wz;

  rig.root.position.set(wx, 0, wz);

  // Walk bob / stomp / wing flap animation
  if (creep.stunTimer <= 0) {
    const speedFreq = creep.isBoss ? 5.5 : 10;
    const amp = creep.isBoss ? 0.12 : 0.07;
    rig.body.position.y = rig.baseY + Math.abs(Math.sin(time * speedFreq + creep.id)) * amp;
  }

  if (rig.wingL && rig.wingR) {
    const flap = Math.sin(time * 12 + creep.id) * 0.55;
    rig.wingL.rotation.z = -flap;
    rig.wingR.rotation.z = flap;
  }

  rig.slowRing.visible = creep.slowTimer > 0;
  rig.poisonOrb.visible = creep.poisonTimer > 0;
  if (rig.poisonOrb.visible) {
    rig.poisonOrb.position.x = Math.cos(time * 5 + creep.id) * 0.55;
    rig.poisonOrb.position.z = Math.sin(time * 5 + creep.id) * 0.55;
  }

  if (rig.spellBlockDome) {
    rig.spellBlockDome.visible = creep.spellBlockCooldown <= 0;
    rig.spellBlockDome.rotation.y = time * 0.8;
  }
  if (rig.enrageAura) {
    rig.enrageAura.visible = creep.enraged;
    if (creep.enraged) {
      const s = 1 + Math.sin(time * 8) * 0.1;
      rig.enrageAura.scale.set(s, s, 1);
    }
  }
}
