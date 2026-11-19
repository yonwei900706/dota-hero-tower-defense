import { BuildPad, Vec2 } from '../types';

export const CANVAS_WIDTH = 1560;
export const CANVAS_HEIGHT = 860;
export const PATH_WIDTH = 58;
export const PAD_RADIUS = 25;

// Grand 10-waypoint multi-switchback lane across the 4-Season Dota Arena
// Starts at Dire Obsidian Portal (top-left) -> winds across 3 River Crossings -> Radiant Ancient (bottom-right)
export const PATH_WAYPOINTS: Vec2[] = [
  { x: 78, y: 120 },
  { x: 420, y: 120 },
  { x: 420, y: 720 },
  { x: 740, y: 720 },
  { x: 740, y: 160 },
  { x: 1080, y: 160 },
  { x: 1080, y: 690 },
  { x: 1320, y: 690 },
  { x: 1320, y: 420 },
  { x: 1475, y: 420 },
];

// 36 Strategic 3D Stone Build Pedestals hugging every bend, switchback, and river crossing
export const INITIAL_BUILD_PADS: Omit<BuildPad, 'occupiedByTowerId'>[] = [
  // Top-left Dire approach (1–5)
  { id: 1, x: 175, y: 205 },
  { id: 2, x: 265, y: 205 },
  { id: 3, x: 340, y: 205 },
  { id: 4, x: 505, y: 135 },
  { id: 5, x: 340, y: 310 },

  // First long vertical descent (6–11)
  { id: 6, x: 505, y: 245 },
  { id: 7, x: 340, y: 420 },
  { id: 8, x: 505, y: 365 },
  { id: 9, x: 340, y: 530 },
  { id: 10, x: 505, y: 485 },
  { id: 11, x: 340, y: 640 },

  // Lower-left U-turn & River Bridge 1 (12–16)
  { id: 12, x: 420, y: 805 },
  { id: 13, x: 525, y: 635 },
  { id: 14, x: 580, y: 805 },
  { id: 15, x: 655, y: 635 },
  { id: 16, x: 740, y: 805 },

  // Central River Ascent (17–22)
  { id: 17, x: 655, y: 515 },
  { id: 18, x: 825, y: 560 },
  { id: 19, x: 655, y: 390 },
  { id: 20, x: 825, y: 430 },
  { id: 21, x: 655, y: 265 },
  { id: 22, x: 825, y: 300 },

  // Upper-right bend & River Bridge 2 (23–27)
  { id: 23, x: 790, y: 78 },
  { id: 24, x: 925, y: 78 },
  { id: 25, x: 910, y: 245 },
  { id: 26, x: 1000, y: 245 },
  { id: 27, x: 1000, y: 365 },

  // Eastern descent (28–32)
  { id: 28, x: 1165, y: 250 },
  { id: 29, x: 1000, y: 490 },
  { id: 30, x: 1165, y: 380 },
  { id: 31, x: 1000, y: 615 },
  { id: 32, x: 1165, y: 515 },

  // Final Radiant Ancient Chokepoint (33–36)
  { id: 33, x: 1140, y: 775 },
  { id: 34, x: 1235, y: 605 },
  { id: 35, x: 1275, y: 775 },
  { id: 36, x: 1405, y: 515 },
];

// 3 Stone Arch Bridges where the lane crosses the diagonal River
export const RIVER_BRIDGES: Vec2[] = [
  { x: 600, y: 720 },
  { x: 740, y: 420 },
  { x: 875, y: 160 },
];

export interface MapProp {
  x: number;
  y: number;
  kind: 'tree' | 'blossom_tree' | 'dire_spire' | 'rock';
  scale: number;
}

export const MAP_PROPS: MapProp[] = [
  // Western grove & Dire border
  { x: 95, y: 290, kind: 'dire_spire', scale: 1.1 },
  { x: 155, y: 380, kind: 'tree', scale: 1.05 },
  { x: 95, y: 485, kind: 'blossom_tree', scale: 1.15 },
  { x: 195, y: 525, kind: 'tree', scale: 0.95 },
  { x: 120, y: 635, kind: 'dire_spire', scale: 1.0 },
  { x: 215, y: 715, kind: 'blossom_tree', scale: 1.1 },
  { x: 135, y: 775, kind: 'rock', scale: 1.1 },
  { x: 270, y: 790, kind: 'tree', scale: 1.0 },
  { x: 190, y: 48, kind: 'dire_spire', scale: 0.95 },
  { x: 315, y: 48, kind: 'rock', scale: 0.9 },
  { x: 590, y: 65, kind: 'blossom_tree', scale: 1.0 },

  // Central valley groves
  { x: 585, y: 195, kind: 'tree', scale: 0.9 },
  { x: 575, y: 330, kind: 'rock', scale: 0.95 },
  { x: 580, y: 560, kind: 'tree', scale: 0.9 },
  { x: 895, y: 520, kind: 'blossom_tree', scale: 1.05 },
  { x: 910, y: 675, kind: 'tree', scale: 1.0 },
  { x: 880, y: 795, kind: 'rock', scale: 1.05 },
  { x: 985, y: 790, kind: 'blossom_tree', scale: 1.1 },

  // Eastern Radiant Highlands
  { x: 1125, y: 68, kind: 'blossom_tree', scale: 1.1 },
  { x: 1240, y: 95, kind: 'tree', scale: 1.2 },
  { x: 1355, y: 125, kind: 'blossom_tree', scale: 1.15 },
  { x: 1455, y: 175, kind: 'tree', scale: 1.1 },
  { x: 1295, y: 235, kind: 'tree', scale: 1.05 },
  { x: 1435, y: 280, kind: 'blossom_tree', scale: 1.05 },
  { x: 1250, y: 325, kind: 'rock', scale: 0.95 },
  { x: 1465, y: 615, kind: 'tree', scale: 1.15 },
  { x: 1410, y: 725, kind: 'blossom_tree', scale: 1.1 },
  { x: 1495, y: 765, kind: 'tree', scale: 1.0 },
];
