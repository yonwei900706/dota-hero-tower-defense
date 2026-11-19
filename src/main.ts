import './styles.css';
import { GameEngine } from './engine/GameEngine';
import { Renderer3D } from './engine/Renderer3D';
import { HUDController } from './ui/HUD';

const wrapper = document.getElementById('canvas-wrapper') as HTMLElement;
const overlayCanvas = document.getElementById('hud-overlay-canvas') as HTMLCanvasElement;

let hud: HUDController | null = null;
const engine = new GameEngine(() => {
  hud?.sync();
});
const renderer = new Renderer3D(wrapper, overlayCanvas);
hud = new HUDController(engine);

const glCanvas = renderer.domElement;

glCanvas.addEventListener('mousemove', (e) => {
  const pt = renderer.screenToGameCoords(e.clientX, e.clientY);
  if (pt) {
    engine.handleCanvasHover(pt.x, pt.y);
  }
});

glCanvas.addEventListener('mouseleave', () => {
  engine.hoveredPadId = null;
});

glCanvas.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  const pt = renderer.screenToGameCoords(e.clientX, e.clientY);
  if (pt) {
    engine.handleCanvasClick(pt.x, pt.y);
  }
});

let rightDownPos: { x: number; y: number } | null = null;
glCanvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    rightDownPos = { x: e.clientX, y: e.clientY };
  }
});

glCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // Only cancel placement/selection if it was a click (not a camera pan drag)
  if (
    rightDownPos &&
    Math.hypot(e.clientX - rightDownPos.x, e.clientY - rightDownPos.y) < 6
  ) {
    engine.selectHeroToBuy(null);
    engine.selectTower(null);
  }
  rightDownPos = null;
});

window.addEventListener('resize', () => {
  renderer.resize();
});

let lastTime = performance.now();
function loop(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  engine.update(dt);
  renderer.render(engine, dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
