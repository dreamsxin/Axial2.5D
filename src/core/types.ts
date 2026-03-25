/**
 * Axial2.5D - Core Type Definitions
 */

// ============================================================================
// Projection Types
// ============================================================================

export type ProjectionType = 'isometric' | 'dimetric';

export interface ProjectionConfig {
  type: ProjectionType;
  viewAngle: number;      // Horizontal rotation angle in degrees (use 30 for true isometric, 45 for dimetric)
  tiltAngle?: number;     // Pitch angle in degrees (dimetric only, default 30)
  tileScale?: number;     // Scale factor (default 1)
}

export interface ScreenCoord {
  sx: number;
  sy: number;
}

export interface WorldCoord {
  x: number;
  z: number;
}

export interface WorldCoord3D extends WorldCoord {
  y: number;
}

// ============================================================================
// Render Types
// ============================================================================

export interface RenderItem {
  depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
  update?(delta: number): void;
}

export interface RenderItemWithBounds extends RenderItem {
  getBounds(): { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Grid/Map Types
// ============================================================================

export interface TileData {
  type: string;
  height: number;
  walkable: boolean;
  entity: Entity | null;
  [key: string]: any;
}

export interface MapConfig {
  width: number;
  height: number;
  tileW: number;
  tileH: number;
}

export interface GridCoord {
  col: number;
  row: number;
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Semantic entity category.
 *
 * Use this instead of comparing `entity.height >= 50` to distinguish
 * buildings from characters.  The threshold-based check breaks the moment
 * someone creates a tall character or a short building; an explicit type
 * field is unambiguous.
 *
 * - 'character' – player, NPCs, enemies; can move; does NOT cast occlusion shadow
 * - 'building'  – static structures; casts occlusion shadow on tiles to the northwest
 * - 'item'      – collectibles, decorations; no occlusion, no movement
 */
export type EntityType = 'character' | 'building' | 'item';

export abstract class Entity implements RenderItem {
  public id: string;
  public col: number;
  public row: number;
  public height: number;
  public spriteKey: string;
  public frame: number = 0;
  public depth: number = 0;
  public visible: boolean = true;

  /**
   * Semantic type of this entity.  Defaults to 'character' for backwards
   * compatibility with existing code that never set an explicit type.
   * Set to 'building' for static structures to enable occlusion shadow casting.
   */
  public entityType: EntityType = 'character';

  constructor(id: string, col: number, row: number, height: number = 0, spriteKey: string = '') {
    this.id = id;
    this.col = col;
    this.row = row;
    this.height = height;
    this.spriteKey = spriteKey;
  }

  /**
   * Returns true if this entity is a building (casts occlusion shadows).
   * Prefer this over `entity.height >= 50` checks throughout the codebase.
   */
  public isBuilding(): boolean {
    return this.entityType === 'building';
  }

  /**
   * Returns true if this entity is a character (player / NPC / enemy).
   */
  public isCharacter(): boolean {
    return this.entityType === 'character';
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;
  update?(delta: number): void;
}

// ============================================================================
// Camera Types
// ============================================================================

export interface CameraConfig {
  offsetX: number;
  offsetY: number;
  scale: number;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface AssetConfig {
  key: string;
  url: string;
  type: 'image' | 'audio' | 'config' | 'spritesheet';
  frames?: SpriteFrame[];
}

export interface SpriteFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LoadedResource {
  key: string;
  data: any;
}

// ============================================================================
// Input Types
// ============================================================================

export type InputEventType = 
  | 'click' 
  | 'mousemove' 
  | 'mousedown' 
  | 'mouseup' 
  | 'keydown' 
  | 'keyup' 
  | 'wheel'
  | 'touchstart' 
  | 'touchmove' 
  | 'touchend';

export interface InputEvent {
  type: InputEventType;
  screenX: number;
  screenY: number;
  worldX?: number;
  worldZ?: number;
  key?: string;
  code?: string;
  deltaX?: number;
  deltaY?: number;
  button?: number;
}

// ============================================================================
// Event Bus Types
// ============================================================================

export type EventCallback = (data?: any) => void;

export interface EventListener {
  event: string;
  callback: EventCallback;
  once: boolean;
}

// ============================================================================
// Scene Types
// ============================================================================

export interface SceneConfig {
  name: string;
  projection: ProjectionConfig;
  mapData: MapData;
  entities?: EntityConfig[];
}

export interface MapData {
  width: number;
  height: number;
  tileW: number;
  tileH: number;
  tiles: TileData[][];
}

export interface EntityConfig {
  id: string;
  type: string;
  col: number;
  row: number;
  height?: number;
  spriteKey?: string;
  [key: string]: any;
}

// ============================================================================
// Debug Types
// ============================================================================

export interface DebugConfig {
  showGrid: boolean;
  showCoordinates: boolean;
  showBoundingBoxes: boolean;
  showFPS: boolean;
  showMouseInfo: boolean;
  showPath: boolean;
  showStats: boolean;
}
