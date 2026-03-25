/**
 * @deprecated This module is superseded by `src/systems/OcclusionSystem.ts`.
 *
 * The original implementation here used an incorrect heuristic:
 *  - It compared (col+row) depth values with a hard-coded range of 3 tiles, which had no
 *    relationship to actual building heights or screen positions.
 *  - It treated tiles "behind" an occluder as occluded when the logic was actually reversed
 *    (larger col+row = closer to camera in standard isometric, NOT farther away).
 *
 * Please import from `../systems/OcclusionSystem` instead:
 *   import { OcclusionSystem } from '../systems/OcclusionSystem';
 *
 * This file is kept only for backward-compatibility and will be removed in a future release.
 */

export { OcclusionSystem } from '../systems/OcclusionSystem';
export type { OcclusionData, OcclusionSystemConfig, OcclusionCallback } from '../systems/OcclusionSystem';
