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
export type { LayerConfig as LayerConfig2 } from './core/Layer';
export { LayerManager } from './core/LayerManager';
export type { LayerManagerConfig, LayerInfo, LayerStats } from './core/LayerManager';
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
export type { InputManagerConfig, MouseState } from './input/InputManager';

// Effects
export { EffectSystem } from './effects/EffectSystem';
export type { EffectConfig, Effect } from './effects/EffectSystem';

// UI
export { UIManager } from './ui/UIManager';

// Debug
export { DebugSystem } from './debug/DebugSystem';
// DebugRenderer exported in Debug (Phase 3) section below

// Scene
export { SceneManager } from './scene/SceneManager';

// Resource
export { ResourceManager } from './resource/ResourceManager';

// Utils
export { EventBus } from './utils/EventBus';
export * from './utils/IsoUtils';
// Logger moved to ui/Logger (Phase 5)

// Controllers
export { PlayerController } from './controllers/PlayerController';
export type { PlayerControllerConfig } from './controllers/PlayerController';
export { CameraController } from './controllers/CameraController';
export type { CameraFollowConfig, CameraControllerConfig } from './controllers/CameraController';

// Systems (Phase 2)
export { OcclusionSystem } from './systems/OcclusionSystem';
export type { OcclusionData, OcclusionCallback, OcclusionSystemConfig } from './systems/OcclusionSystem';
export { EffectSystemWrapper } from './systems/EffectSystemWrapper';
export type { EffectSystemWrapperConfig } from './systems/EffectSystemWrapper';

// UI (Phase 3)
export { UIDataBinder } from './ui/UIDataBinder';
export type { BindingConfig, BindingUpdater, ValueProvider, ValueFormatter } from './ui/UIDataBinder';
export { Logger } from './ui/Logger';
export type { LogLevel, LoggerConfig } from './ui/Logger';
export { LayerList } from './ui/LayerList';
export type { LayerListConfig } from './ui/LayerList';

// Debug (Phase 3)
export { DebugRenderer } from './debug/DebugRenderer';
export type { DebugTextConfig, DebugTileHighlightConfig, DebugLineConfig, DebugShapeConfig, DebugEntityBoundsConfig } from './debug/DebugRenderer';
export { DebugPanel } from './debug/DebugPanel';
export type { DebugPanelConfig } from './debug/DebugPanel';

// Module System (Phase 5)
export { ModuleManager } from './core/ModuleManager';
export type { ModuleConfig, GameModules } from './core/ModuleManager';
export { ConfigManager } from './core/ConfigManager';
export type { ConfigManagerConfig, ConfigValue, ConfigChangeListener } from './core/ConfigManager';

// Camera types
export type { ScreenPoint3D, WorldPoint3D } from './core/IsoCamera';
