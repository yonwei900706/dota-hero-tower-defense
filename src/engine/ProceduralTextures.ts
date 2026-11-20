import * as THREE from 'three';
import { Season } from '../types';

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function createCobblestoneTextures(): PbrTextureSet {
  const size = 512;
  const [albedoC, actx] = makeCanvas(size, size);
  const [bumpC, bctx] = makeCanvas(size, size);

  // Dark mortar base
  actx.fillStyle = '#1c1917';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#141414';
  bctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 8;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let col = -1; col <= cols; col++) {
      const x = col * cellW + offset + 3;
      const y = r * cellH + 3;
      const w = cellW - 6;
      const h = cellH - 6;
      const shade = 52 + Math.floor(Math.random() * 24);
      const warm = Math.floor(Math.random() * 8);

      actx.fillStyle = `rgb(${shade + warm}, ${shade + 2}, ${shade - 4})`;
      actx.beginPath();
      actx.roundRect(x, y, w, h, 8);
      actx.fill();

      // Subtle bevel highlight
      actx.strokeStyle = 'rgba(255,255,255,0.08)';
      actx.lineWidth = 2;
      actx.stroke();

      // Bump height
      const bVal = 175 + Math.floor(Math.random() * 65);
      bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bctx.beginPath();
      bctx.roundRect(x + 1, y + 1, w - 2, h - 2, 8);
      bctx.fill();
    }
  }

  // Fine mineral grain
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    actx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    actx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(albedoC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createStonePedestalTextures(): PbrTextureSet {
  const size = 256;
  const [albedoC, actx] = makeCanvas(size, size);
  const [bumpC, bctx] = makeCanvas(size, size);

  actx.fillStyle = '#334155';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 6;
    actx.fillStyle =
      Math.random() < 0.15
        ? 'rgba(34, 197, 94, 0.12)' // subtle moss tint
        : Math.random() < 0.5
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.14)';
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();

    const bv = Math.random() < 0.5 ? 210 : 90;
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  // Carved stone border lines
  actx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  actx.lineWidth = 4;
  actx.strokeRect(8, 8, size - 16, size - 16);
  bctx.strokeStyle = '#303030';
  bctx.lineWidth = 4;
  bctx.strokeRect(8, 8, size - 16, size - 16);

  const map = new THREE.CanvasTexture(albedoC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createTerrainBumpMap(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 14;
    const shade = 70 + Math.floor(Math.random() * 140);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}

export function createSeasonGroundTexture(season: Season): THREE.CanvasTexture {
  const [texCanvas, ctx] = makeCanvas(1024, 512);

  const grad = ctx.createLinearGradient(0, 0, 1024, 512);
  if (season === 'spring') {
    grad.addColorStop(0, '#1e2c22');
    grad.addColorStop(0.35, '#1d3b27');
    grad.addColorStop(0.75, '#224a30');
    grad.addColorStop(1, '#265c3a');
  } else if (season === 'summer') {
    grad.addColorStop(0, '#2c2519');
    grad.addColorStop(0.4, '#2b3f1f');
    grad.addColorStop(0.78, '#325224');
    grad.addColorStop(1, '#3d5e18');
  } else if (season === 'autumn') {
    grad.addColorStop(0, '#2e1915');
    grad.addColorStop(0.4, '#432418');
    grad.addColorStop(0.75, '#572e17');
    grad.addColorStop(1, '#683919');
  } else {
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.38, '#334155');
    grad.addColorStop(0.75, '#475569');
    grad.addColorStop(1, '#64748b');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle Dire volcanic magma veins on far left
  if (season !== 'winter') {
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sx = Math.random() * 190;
      const sy = Math.random() * 512;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 70, sy + (Math.random() - 0.5) * 70);
      ctx.stroke();
    }
  }

  // Organic seasonal ground speckles & fallen foliage
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = 1.5 + Math.random() * 9;
    if (season === 'spring') {
      ctx.fillStyle =
        Math.random() < 0.24
          ? `rgba(244, 114, 182, ${0.07 + Math.random() * 0.12})`
          : `rgba(74, 222, 128, ${0.03 + Math.random() * 0.07})`;
    } else if (season === 'summer') {
      ctx.fillStyle =
        Math.random() < 0.28
          ? `rgba(250, 204, 21, ${0.03 + Math.random() * 0.06})`
          : `rgba(34, 197, 94, ${0.03 + Math.random() * 0.07})`;
    } else if (season === 'autumn') {
      ctx.fillStyle =
        Math.random() < 0.52
          ? `rgba(249, 115, 22, ${0.07 + Math.random() * 0.12})`
          : `rgba(234, 179, 8, ${0.05 + Math.random() * 0.1})`;
    } else {
      ctx.fillStyle = `rgba(241, 245, 249, ${0.09 + Math.random() * 0.18})`;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(texCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
