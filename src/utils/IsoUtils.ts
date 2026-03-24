/**
 * IsoUtils - Isometric utility functions
 */

/**
 * Blend two colors together
 * @param c1 - First color (hex format: #RRGGBB)
 * @param c2 - Second color (hex format: #RRGGBB)
 * @param factor - Blend factor (0-1), 0 = c1, 1 = c2
 * @returns Blended color in hex format
 */
export function blendColors(c1: string, c2: string, factor: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert grid coordinates to world coordinates
 * @param col - Grid column
 * @param row - Grid row
 * @param cellSize - Size of each cell in pixels
 * @returns World coordinates {x, y}
 */
export function gridToWorld(col: number, row: number, cellSize: number): { x: number; y: number } {
  return { x: col * cellSize, y: row * cellSize };
}

/**
 * Convert world coordinates to grid coordinates
 * @param worldX - World X coordinate
 * @param worldY - World Y coordinate
 * @param cellSize - Size of each cell in pixels
 * @returns Grid coordinates {col, row}
 */
export function worldToGrid(worldX: number, worldY: number, cellSize: number): { col: number; row: number } {
  return { 
    col: Math.round(worldX / cellSize), 
    row: Math.round(worldY / cellSize) 
  };
}

/**
 * Get layer index for a given depth value
 * @param depth - Depth value
 * @param maxDepth - Maximum depth value
 * @param layerCount - Total number of layers
 * @returns Layer index (0 to layerCount-1)
 */
export function getLayerForDepth(depth: number, maxDepth: number, layerCount: number): number {
  const layerIndex = Math.floor((depth / maxDepth) * layerCount);
  return Math.max(0, Math.min(layerCount - 1, layerIndex));
}

/**
 * Screen point interface
 */
export interface ScreenPoint {
  sx: number;
  sy: number;
}

/**
 * World point interface
 */
export interface WorldPoint {
  x: number;
  y: number;
  z?: number;
}

/**
 * Grid point interface
 */
export interface GridPoint {
  col: number;
  row: number;
}
