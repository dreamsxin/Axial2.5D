/**
 * Axial2.5D - Main Export File
 * 
 * A native Canvas 2D API isometric/dimetric game framework
 */

// Core
export { Projection } from './core/Projection';
export { IsoCamera } from './core/IsoCamera';
export { CanvasRenderer } from './core/CanvasRenderer';
export { Game } from './core/Game';
export { Layer } from './core/Layer';
export type { LayerConfig } from './core/Layer';
export { LayerManager } from './core/LayerManager';
export type { LayerManagerConfig, LayerInfo } from './core/LayerManager';
export * from './core/types';

// World
export { GridSystem, TileRenderItem } from './world/GridSystem';
export { EntityManager, BasicEntity } from './world/EntityManager';
export { PathFinder } from './world/PathFinder';
export { IsoPrimitive } from './world/IsoPrimitive';
export { IsoBox } from './world/IsoBox';
export { IsoSprite, IsoCharacter } from './world/IsoSprite';
export type { SpriteConfig } from './world/IsoSprite';
export { GridLines } from './world/GridLines';
export type { GridLinesConfig } from './world/GridLines';

// Input
export { InputManager } from './input/InputManager';

// UI
export { UIManager } from './ui/UIManager';

// Debug
export { DebugSystem } from './debug/DebugSystem';

// Scene
export { SceneManager } from './scene/SceneManager';

// Resource
export { ResourceManager } from './resource/ResourceManager';

// Utils
export { EventBus } from './utils/EventBus';
export * from './utils/IsoUtils';

// Camera types
export type { ScreenPoint3D, WorldPoint3D } from './core/IsoCamera';
