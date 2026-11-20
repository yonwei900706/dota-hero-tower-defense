import * as THREE from 'three';
import { BurstEvent } from '../types';

interface LiveParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
  age: number;
  duration: number;
  gravity: number;
  isCoin: boolean;
}

const MAX_PARTICLES = 320;

export class ParticleSystem3D {
  private group = new THREE.Group();
  private particles: LiveParticle[] = [];
  private shardGeo = new THREE.OctahedronGeometry(0.16, 0);
  private coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.045, 10);

  constructor(scene: THREE.Scene) {
    this.coinGeo.rotateX(Math.PI / 2);
    scene.add(this.group);
  }

  public spawnBurst(evt: BurstEvent, wx: number, wz: number): void {
    const isCoins = evt.kind === 'gold_coins';
    const isRock = evt.kind === 'rock';
    const count = Math.min(evt.count, 24);
    const col = new THREE.Color(evt.color);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        const oldest = this.particles.shift();
        if (oldest) {
          this.group.remove(oldest.mesh);
          (oldest.mesh.material as THREE.Material).dispose();
        }
      }

      const mat = isCoins
        ? new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xd97706,
            emissiveIntensity: 0.7,
            metalness: 0.9,
            roughness: 0.2,
          })
        : new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.95,
          });

      const mesh = new THREE.Mesh(isCoins ? this.coinGeo : this.shardGeo, mat);
      const startY = isCoins ? 1.1 : isRock ? 0.35 : 1.25;
      mesh.position.set(
        wx + (Math.random() - 0.5) * 0.5,
        startY,
        wz + (Math.random() - 0.5) * 0.5
      );
      if (isRock) mesh.scale.setScalar(1.35);

      const angle = Math.random() * Math.PI * 2;
      const horizSpeed = isCoins ? 1.6 + Math.random() * 2.2 : 2.2 + Math.random() * 4.5;
      const vertSpeed = isCoins
        ? 4.6 + Math.random() * 3.0
        : isRock
        ? 3.8 + Math.random() * 3.5
        : 1.5 + Math.random() * 3.6;

      this.group.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * horizSpeed,
        vy: vertSpeed,
        vz: Math.sin(angle) * horizSpeed,
        rotSpeed: (Math.random() - 0.5) * 14,
        age: 0,
        duration: isCoins ? 0.85 : 0.45 + Math.random() * 0.25,
        gravity: isCoins ? 13 : isRock ? 14 : 7,
        isCoin: isCoins,
      });
    }
  }

  public update(dt: number): void {
    const alive: LiveParticle[] = [];

    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.duration) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        continue;
      }

      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Ground bounce for coins and rock debris
      if (p.mesh.position.y < 0.18) {
        p.mesh.position.y = 0.18;
        p.vy = Math.abs(p.vy) * 0.45;
        p.vx *= 0.72;
        p.vz *= 0.72;
      }

      p.mesh.rotation.y += p.rotSpeed * dt;
      p.mesh.rotation.x += p.rotSpeed * 0.5 * dt;

      const t = p.age / p.duration;
      const scale = p.isCoin ? 1 - t * 0.45 : Math.max(0.05, 1 - t);
      p.mesh.scale.setScalar(scale);

      const mat = p.mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = Math.max(0, 1 - t);
      }

      alive.push(p);
    }

    this.particles = alive;
  }
}
