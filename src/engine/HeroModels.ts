import * as THREE from 'three';
import { HeroId, TowerInstance } from '../types';

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  weaponPivot: THREE.Group;
  aghsGroup: THREE.Group;
  levelRing: THREE.Mesh;
  buffAura: THREE.Mesh;
  cmAuraRing?: THREE.Mesh;
  floatingOrbs?: THREE.Group;
  baseY: number;
  appliedLevel: number;
}

function mat(
  color: number,
  roughness = 0.55,
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
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function createHeroRig(heroId: HeroId): HeroRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const weaponPivot = new THREE.Group();
  root.add(body);

  // Level upgrade halo ring at hero feet
  const levelRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.06, 10, 32),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.8,
    })
  );
  levelRing.rotation.x = Math.PI / 2;
  levelRing.position.y = 0.06;
  levelRing.visible = false;
  root.add(levelRing);

  // Buff aura (Sven God's Strength / Roshan slow tint)
  const buffAura = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 1.25, 28),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  buffAura.rotation.x = -Math.PI / 2;
  buffAura.position.y = 0.08;
  buffAura.visible = false;
  root.add(buffAura);

  // Aghanim's Scepter Level 4 rotating crystal crown/halo
  const aghsGroup = new THREE.Group();
  const aghsRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.055, 10, 36),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.7,
    })
  );
  aghsRing.rotation.x = Math.PI / 2;
  aghsRing.position.y = 0.16;
  aghsGroup.add(aghsRing);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.8,
        roughness: 0.1,
        metalness: 0.5,
      })
    );
    shard.scale.set(0.7, 1.5, 0.7);
    shard.position.set(Math.cos(angle) * 1.15, 1.25, Math.sin(angle) * 1.15);
    aghsGroup.add(shard);
  }
  aghsGroup.visible = false;
  root.add(aghsGroup);

  let cmAuraRing: THREE.Mesh | undefined;
  let floatingOrbs: THREE.Group | undefined;
  let baseY = 0;

  if (heroId === 'sniper') {
    buildSniper(body, weaponPivot);
  } else if (heroId === 'crystal_maiden') {
    buildCrystalMaiden(body, weaponPivot);
    cmAuraRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.25, 36),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    cmAuraRing.rotation.x = -Math.PI / 2;
    cmAuraRing.position.y = 0.05;
    root.add(cmAuraRing);
  } else if (heroId === 'sven') {
    buildSven(body, weaponPivot);
  } else if (heroId === 'venomancer') {
    buildVenomancer(body, weaponPivot);
  } else if (heroId === 'lina') {
    floatingOrbs = buildLina(body, weaponPivot);
    baseY = 0.25;
  } else if (heroId === 'earthshaker') {
    buildEarthshaker(body, weaponPivot);
  } else if (heroId === 'drow_ranger') {
    buildDrowRanger(body, weaponPivot);
    cmAuraRing = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.2, 36),
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      })
    );
    cmAuraRing.rotation.x = -Math.PI / 2;
    cmAuraRing.position.y = 0.05;
    root.add(cmAuraRing);
  } else if (heroId === 'zeus') {
    buildZeus(body, weaponPivot);
  }

  enableShadows(body);

  return {
    root,
    body,
    weaponPivot,
    aghsGroup,
    levelRing,
    buffAura,
    cmAuraRing,
    floatingOrbs,
    baseY,
    appliedLevel: 1,
  };
}

function buildSniper(body: THREE.Group, weaponPivot: THREE.Group): void {
  // Boots & stocky legs
  const bootMat = mat(0x3b2314, 0.8);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.55, 10), bootMat);
  leftLeg.position.set(-0.22, 0.28, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;
  body.add(leftLeg, rightLeg);

  // Desert trench coat torso
  const coatMat = mat(0x92400e, 0.72, 0.08);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.85, 12), coatMat);
  torso.position.y = 0.92;
  body.add(torso);

  // Brass bandolier / scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 16), mat(0xd97706, 0.5, 0.2));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.32;
  body.add(scarf);

  // Head + white beard
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 14), mat(0xf1c29b, 0.65));
  head.position.y = 1.56;
  body.add(head);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 10), mat(0xe5e7eb, 0.8));
  beard.rotation.x = Math.PI;
  beard.position.set(0, 1.38, 0.16);
  body.add(beard);

  // Glowing sniper goggles
  const goggleFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.14, 0.18),
    mat(0x1e293b, 0.3, 0.8)
  );
  goggleFrame.position.set(0, 1.6, 0.22);
  body.add(goggleFrame);

  const lensL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10),
    mat(0x38bdf8, 0.1, 0.5, 0x38bdf8, 1.4)
  );
  lensL.rotation.x = Math.PI / 2;
  lensL.position.set(-0.1, 1.6, 0.3);
  const lensR = lensL.clone();
  lensR.material = mat(0xfacc15, 0.1, 0.5, 0xfacc15, 1.6);
  lensR.position.x = 0.1;
  body.add(lensL, lensR);

  // Wide-brim dwarven marksman hat
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 0.06, 16), mat(0x451a03, 0.8));
  hatBrim.position.y = 1.77;
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.28, 14), mat(0x713f12, 0.75));
  hatCrown.position.y = 1.92;
  body.add(hatBrim, hatCrown);

  // Long Brass & Steel Sniper Rifle
  weaponPivot.position.set(0.32, 1.12, 0.1);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.7), mat(0x5c2e0e, 0.7));
  stock.position.z = 0.2;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 1.45, 10),
    mat(0x94a3b8, 0.25, 0.85)
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 1.05;
  const scope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.42, 10),
    mat(0xd97706, 0.25, 0.8)
  );
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.13, 0.65);
  weaponPivot.add(stock, barrel, scope);
  body.add(weaponPivot);
}

function buildCrystalMaiden(body: THREE.Group, weaponPivot: THREE.Group): void {
  // Flowing frost robe
  const robe = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 1.45, 14),
    mat(0x0284c7, 0.5, 0.15)
  );
  robe.position.y = 0.74;
  body.add(robe);

  // White fur mantle & golden trim
  const mantle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.52, 0.34, 14),
    mat(0xe0f2fe, 0.75)
  );
  mantle.position.y = 1.32;
  body.add(mantle);

  const goldCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.055, 8, 18),
    mat(0xfbbf24, 0.25, 0.85)
  );
  goldCollar.rotation.x = Math.PI / 2;
  goldCollar.position.y = 1.48;
  body.add(goldCollar);

  // Flowing frost cape
  const cape = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 1.25, 0.1),
    mat(0x0369a1, 0.6, 0.1)
  );
  cape.position.set(0, 0.85, -0.32);
  cape.rotation.x = 0.18;
  body.add(cape);

  // Head & blonde hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 14), mat(0xfde2cf, 0.55));
  head.position.y = 1.72;
  body.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), mat(0xfde047, 0.55));
  hair.position.set(0, 1.78, -0.06);
  body.add(hair);

  // Frost hood arch
  const hood = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.09, 8, 16, Math.PI * 1.2),
    mat(0x38bdf8, 0.4, 0.2)
  );
  hood.position.set(0, 1.74, -0.02);
  hood.rotation.z = -0.3;
  body.add(hood);

  // Tall Crystalline Frost Staff
  weaponPivot.position.set(0.5, 1.05, 0.22);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 2.0, 8),
    mat(0xbae6fd, 0.2, 0.6)
  );
  shaft.position.y = 0.15;
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    mat(0x7dd3fc, 0.1, 0.4, 0x38bdf8, 1.8)
  );
  crystal.scale.set(0.8, 1.35, 0.8);
  crystal.position.y = 1.28;
  weaponPivot.add(shaft, crystal);
  body.add(weaponPivot);
}

function buildSven(body: THREE.Group, weaponPivot: THREE.Group): void {
  const armorMat = mat(0x2563eb, 0.3, 0.78);
  const steelMat = mat(0x94a3b8, 0.25, 0.85);

  // Armored legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.28), armorMat);
  legL.position.set(-0.24, 0.34, 0);
  const legR = legL.clone();
  legR.position.x = 0.24;
  body.add(legL, legR);

  // Broad Rogue Knight chestplate
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.92, 0.56), armorMat);
  chest.position.y = 1.08;
  body.add(chest);

  // Massive shoulder pauldrons
  const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), steelMat);
  pauldronL.position.set(-0.56, 1.38, 0);
  const pauldronR = pauldronL.clone();
  pauldronR.position.x = 0.56;
  body.add(pauldronL, pauldronR);

  // Crimson war cape
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.3, 0.1), mat(0x991b1b, 0.7));
  cape.position.set(0, 0.9, -0.34);
  cape.rotation.x = 0.16;
  body.add(cape);

  // Horned Knight Helmet
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.46, 10), steelMat);
  helm.position.y = 1.76;
  body.add(helm);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.08, 0.28),
    mat(0xef4444, 0.2, 0.5, 0xef4444, 1.8)
  );
  visor.position.set(0, 1.76, 0.18);
  body.add(visor);

  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.46, 8), mat(0xe2e8f0, 0.35, 0.5));
  hornL.position.set(-0.28, 2.02, 0);
  hornL.rotation.z = 0.55;
  const hornR = hornL.clone();
  hornR.position.x = 0.28;
  hornR.rotation.z = -0.55;
  body.add(hornL, hornR);

  // Gigantic Outcast Blade Greatsword
  weaponPivot.position.set(0.56, 1.2, 0.2);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), mat(0x451a03, 0.7));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.14), mat(0xfbbf24, 0.25, 0.85));
  guard.position.y = 0.22;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.75, 0.07),
    mat(0xcbd5e1, 0.2, 0.9, 0x3b82f6, 0.35)
  );
  blade.position.y = 1.12;
  weaponPivot.add(hilt, guard, blade);
  weaponPivot.rotation.x = 0.45;
  body.add(weaponPivot);
}

function buildVenomancer(body: THREE.Group, weaponPivot: THREE.Group): void {
  const skinMat = mat(0x15803d, 0.5, 0.1);
  const toxicMat = mat(0x84cc16, 0.25, 0.2, 0x4ade80, 1.1);

  // Coiled serpentine lower body & tail
  const baseCoil = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.19, 10, 20), skinMat);
  baseCoil.rotation.x = Math.PI / 2;
  baseCoil.position.y = 0.2;
  body.add(baseCoil);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.0, 12), skinMat);
  torso.position.set(0, 0.78, 0.08);
  torso.rotation.x = 0.25;
  body.add(torso);

  // Cobra hood frills
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.36, 0.75, 10), mat(0x166534, 0.55));
  hood.scale.set(1.15, 1, 0.35);
  hood.position.set(0, 1.28, -0.02);
  body.add(hood);

  // Glowing venom sacs on hood
  const sacL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), toxicMat);
  sacL.position.set(-0.46, 1.32, 0.12);
  const sacR = sacL.clone();
  sacR.position.x = 0.46;
  body.add(sacL, sacR);

  // Viper head & glowing yellow eyes
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 10), mat(0x22c55e, 0.45));
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 1.46, 0.3);
  body.add(head);

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    mat(0xfef08a, 0.1, 0.2, 0xfef08a, 1.8)
  );
  eyeL.position.set(-0.12, 1.54, 0.44);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.12;
  body.add(eyeL, eyeR);

  // Venom spit emitter / barbed tentacles
  weaponPivot.position.set(0, 1.36, 0.52);
  const fang = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), toxicMat);
  weaponPivot.add(fang);
  body.add(weaponPivot);
}

function buildLina(body: THREE.Group, weaponPivot: THREE.Group): THREE.Group {
  // Flowing crimson-and-gold levitating dress
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.35, 14), mat(0xb91c1c, 0.45, 0.2));
  skirt.position.y = 0.72;
  body.add(skirt);

  const bodice = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.55, 12),
    mat(0xdc2626, 0.4, 0.3)
  );
  bodice.position.y = 1.3;
  body.add(bodice);

  const goldBelt = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.055, 8, 16),
    mat(0xfbbf24, 0.2, 0.85)
  );
  goldBelt.rotation.x = Math.PI / 2;
  goldBelt.position.y = 1.05;
  body.add(goldBelt);

  // Head + Blazing flame hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), mat(0xfde2cf, 0.5));
  head.position.y = 1.72;
  body.add(head);

  const flameMat = mat(0xf97316, 0.2, 0.1, 0xf97316, 1.6);
  const hairMain = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 10), flameMat);
  hairMain.position.set(0, 2.08, -0.05);
  body.add(hairMain);

  // Floating fire orbs orbiting hands
  const floatingOrbs = new THREE.Group();
  floatingOrbs.position.y = 1.38;
  const orbL = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    mat(0xfef08a, 0.1, 0.1, 0xf97316, 2.2)
  );
  orbL.position.set(-0.62, 0, 0.28);
  const orbR = orbL.clone();
  orbR.position.x = 0.62;
  floatingOrbs.add(orbL, orbR);
  body.add(floatingOrbs);

  weaponPivot.position.set(0, 1.38, 0.45);
  body.add(weaponPivot);

  return floatingOrbs;
}

function buildEarthshaker(body: THREE.Group, weaponPivot: THREE.Group): void {
  const furMat = mat(0x78350f, 0.85, 0.05);
  const bronzeMat = mat(0xd97706, 0.3, 0.75);

  // Heavy stomping legs
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.62, 10), furMat);
  legL.position.set(-0.28, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.28;
  body.add(legL, legR);

  // Hulking bull-tauren torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.66), furMat);
  torso.position.y = 1.06;
  body.add(torso);

  // Bronze pauldrons
  const shL = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), bronzeMat);
  shL.position.set(-0.62, 1.38, 0);
  const shR = shL.clone();
  shR.position.x = 0.62;
  body.add(shL, shR);

  // Bull head & curved horns
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.5), mat(0x92400e, 0.8));
  head.position.set(0, 1.66, 0.18);
  body.add(head);

  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), mat(0xfef3c7, 0.4));
  hornL.position.set(-0.36, 1.82, 0.22);
  hornL.rotation.z = 0.95;
  const hornR = hornL.clone();
  hornR.position.x = 0.36;
  hornR.rotation.z = -0.95;
  body.add(hornL, hornR);

  // Massive Rune-Carved Stone Totem
  weaponPivot.position.set(0.62, 1.15, 0.15);
  const totem = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 2.05, 0.38),
    mat(0x57534e, 0.75, 0.2)
  );
  totem.position.y = 0.55;
  const runeBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.26, 0.42),
    mat(0xf59e0b, 0.2, 0.6, 0xf59e0b, 1.5)
  );
  runeBand.position.y = 1.15;
  const runeBand2 = runeBand.clone();
  runeBand2.position.y = 0.35;
  weaponPivot.add(totem, runeBand, runeBand2);
  weaponPivot.rotation.x = 0.2;
  body.add(weaponPivot);
}

function buildDrowRanger(body: THREE.Group, weaponPivot: THREE.Group): void {
  const cloakMat = mat(0x1e1b4b, 0.6, 0.2);
  const armorMat = mat(0x312e81, 0.4, 0.45);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.65, 10), cloakMat);
  legL.position.set(-0.18, 0.32, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  body.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.85, 12), armorMat);
  torso.position.y = 1.02;
  body.add(torso);

  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.35, 0.1), cloakMat);
  cape.position.set(0, 0.9, -0.3);
  cape.rotation.x = 0.18;
  body.add(cape);

  // Blue-tinted Drow head + dark ranger hood
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), mat(0x93c5fd, 0.5));
  head.position.y = 1.66;
  body.add(head);

  const hood = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 0.62, 12),
    mat(0x1e1b4b, 0.65)
  );
  hood.position.set(0, 1.82, -0.06);
  hood.rotation.x = -0.25;
  body.add(hood);

  // Glowing Frost Bow
  weaponPivot.position.set(0.36, 1.18, 0.26);
  const bowArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 20, Math.PI * 1.15),
    mat(0x38bdf8, 0.2, 0.7, 0x38bdf8, 1.1)
  );
  bowArc.rotation.y = Math.PI / 2;
  bowArc.rotation.z = -Math.PI / 2 - 0.1;
  const arrow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6),
    mat(0xe0f2fe, 0.1, 0.4, 0x38bdf8, 1.5)
  );
  arrow.rotation.x = Math.PI / 2;
  arrow.position.z = 0.35;
  weaponPivot.add(bowArc, arrow);
  body.add(weaponPivot);
}

function buildZeus(body: THREE.Group, weaponPivot: THREE.Group): void {
  const tunicMat = mat(0x1d4ed8, 0.45, 0.35);
  const goldMat = mat(0xfbbf24, 0.2, 0.85);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.62, 10), mat(0x1e3a8a, 0.5));
  legL.position.set(-0.22, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.22;
  body.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.88, 12), tunicMat);
  torso.position.y = 1.02;
  body.add(torso);

  const chestGold = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.52), goldMat);
  chestGold.position.y = 1.18;
  body.add(chestGold);

  // Head + white Olympic beard & spiky crown hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), mat(0xf1c29b, 0.6));
  head.position.y = 1.68;
  body.add(head);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 10), mat(0xf8fafc, 0.7));
  beard.rotation.x = Math.PI;
  beard.position.set(0, 1.46, 0.16);
  body.add(beard);

  const hair = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), mat(0xf8fafc, 0.6));
  hair.position.set(0, 1.88, -0.04);
  body.add(hair);

  // Crackling Thunderbolt held aloft
  weaponPivot.position.set(0.54, 1.32, 0.22);
  const boltMat = mat(0xfef08a, 0.1, 0.2, 0x38bdf8, 2.2);
  const seg1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.72, 6), boltMat);
  seg1.position.y = 0.4;
  seg1.rotation.z = -0.25;
  const seg2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.72, 6), boltMat);
  seg2.position.y = -0.15;
  seg2.rotation.z = Math.PI - 0.25;
  weaponPivot.add(seg1, seg2);
  body.add(weaponPivot);
}

export function updateHeroRig(rig: HeroRig, tower: TowerInstance, time: number): void {
  // Smoothly face target (convert 2D canvas angle to 3D Y-axis yaw)
  // In 2D: 0 = +X, PI/2 = +Y (which is +Z in 3D). Three.js +Z forward => rotation.y = PI/2 - angle
  rig.body.rotation.y = Math.PI / 2 - tower.facingAngle;

  // Idle breathing / levitation
  const breath = Math.sin(time * 3.2 + tower.id) * 0.05;
  rig.body.position.y = rig.baseY + (tower.heroId === 'lina' ? Math.sin(time * 4 + tower.id) * 0.14 : breath);

  // Attack animation
  const anim = Math.max(0, tower.attackAnimTimer / 0.16); // 1 -> 0
  if (tower.heroId === 'sven') {
    rig.weaponPivot.rotation.x = 0.45 + Math.sin(anim * Math.PI) * 1.35;
    rig.weaponPivot.rotation.y = -Math.sin(anim * Math.PI) * 1.1;
  } else if (tower.heroId === 'earthshaker') {
    rig.weaponPivot.rotation.x = 0.2 + Math.sin(anim * Math.PI) * 1.45;
  } else if (tower.heroId === 'sniper') {
    rig.weaponPivot.position.z = 0.1 - anim * 0.22;
  } else {
    rig.weaponPivot.rotation.x = Math.sin(anim * Math.PI) * 0.45;
  }

  // Lina floating fire orbs rotation
  if (rig.floatingOrbs) {
    rig.floatingOrbs.rotation.y = time * 2.5;
  }

  // Level upgrades visual evolution
  if (rig.appliedLevel !== tower.level) {
    rig.appliedLevel = tower.level;
    const scaleBoost = 1 + (tower.level - 1) * 0.08;
    rig.body.scale.setScalar(scaleBoost);
    rig.levelRing.visible = tower.level >= 2;
    const ringMat = rig.levelRing.material as THREE.MeshStandardMaterial;
    if (tower.level === 4) {
      ringMat.color.setHex(0x38bdf8);
      ringMat.emissive.setHex(0x38bdf8);
      rig.aghsGroup.visible = true;
    } else if (tower.level === 3) {
      ringMat.color.setHex(0xf97316);
      ringMat.emissive.setHex(0xf97316);
    } else {
      ringMat.color.setHex(0xfbbf24);
      ringMat.emissive.setHex(0xfbbf24);
    }
  }

  // Rotate Aghanim's crystal halo
  if (rig.aghsGroup.visible) {
    rig.aghsGroup.rotation.y = time * 1.6;
  }

  // Sven God's Strength red fiery growth
  if (tower.buffTimer > 0) {
    rig.buffAura.visible = true;
    (rig.buffAura.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
    const s = 1 + (tower.level - 1) * 0.08 + 0.18;
    rig.body.scale.setScalar(s);
  } else if (tower.slowedByRoshanTimer > 0) {
    rig.buffAura.visible = true;
    (rig.buffAura.material as THREE.MeshBasicMaterial).color.setHex(0xf97316);
  } else {
    rig.buffAura.visible = false;
    const s = 1 + (tower.level - 1) * 0.08;
    rig.body.scale.setScalar(s);
  }

  if (rig.cmAuraRing) {
    rig.cmAuraRing.rotation.z = time * 0.8;
  }

  // Divine Rapier golden aura or Level 3+ talent glow on ground ring
  if (tower.items.includes('divine_rapier')) {
    rig.levelRing.visible = true;
    const rMat = rig.levelRing.material as THREE.MeshStandardMaterial;
    rMat.color.setHex(0xfacc15);
    rMat.emissive.setHex(0xfacc15);
    rMat.emissiveIntensity = 1.6 + Math.sin(time * 6) * 0.4;
  }
}
