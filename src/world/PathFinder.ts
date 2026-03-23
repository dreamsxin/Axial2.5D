/**
 * PathFinder - A* pathfinding algorithm for grid-based movement
 */

import { GridSystem } from './GridSystem';
import { GridCoord } from '../core/types';

interface PathNode {
  col: number;
  row: number;
  g: number;      // Cost from start
  h: number;      // Heuristic to end
  f: number;      // g + h
  parent: PathNode | null;
}

export interface PathConfig {
  allowDiagonal: boolean;
  terrainCost: Map<string, number>;
}

export class PathFinder {
  private defaultConfig: PathConfig = {
    allowDiagonal: false,
    terrainCost: new Map()
  };

  /**
   * Find path from start to end using A* algorithm
   * @param start - Starting grid coordinates
   * @param end - Target grid coordinates
   * @param gridSystem - Grid system for terrain data
   * @param config - Optional pathfinding configuration
   * @returns Array of grid coordinates (excluding start), empty if no path
   */
  public findPath(
    start: GridCoord,
    end: GridCoord,
    gridSystem: GridSystem,
    config?: Partial<PathConfig>
  ): GridCoord[] {
    const finalConfig: PathConfig = { ...this.defaultConfig, ...config };

    // Validate start and end
    if (!gridSystem.isWalkable(start.col, start.row)) {
      return [];
    }
    if (!gridSystem.isWalkable(end.col, end.row)) {
      return [];
    }

    // Priority queue (simple array-based for simplicity)
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    // Create start node
    const startNode: PathNode = {
      col: start.col,
      row: start.row,
      g: 0,
      h: this.heuristic(start, end),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      const currentKey = `${current.col},${current.row}`;

      // Check if we reached the end
      if (current.col === end.col && current.row === end.row) {
        return this.reconstructPath(current);
      }

      closedSet.add(currentKey);

      // Get neighbors
      const neighbors = this.getNeighbors(current, gridSystem, finalConfig.allowDiagonal);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.col},${neighbor.row}`;

        if (closedSet.has(neighborKey)) {
          continue;
        }

        if (!gridSystem.isWalkable(neighbor.col, neighbor.row)) {
          continue;
        }

        // Calculate movement cost
        const moveCost = this.getMovementCost(neighbor, gridSystem, finalConfig);
        const isDiagonal = neighbor.col !== current.col && neighbor.row !== current.row;
        const diagonalCost = isDiagonal ? 1.414 : 1;
        const tentativeG = current.g + moveCost * diagonalCost;

        // Check if neighbor is in open set
        const existingNode = openSet.find(n => n.col === neighbor.col && n.row === neighbor.row);

        if (existingNode) {
          if (tentativeG < existingNode.g) {
            existingNode.g = tentativeG;
            existingNode.f = existingNode.g + existingNode.h;
            existingNode.parent = current;
          }
        } else {
          const newNode: PathNode = {
            col: neighbor.col,
            row: neighbor.row,
            g: tentativeG,
            h: this.heuristic(neighbor, end),
            f: 0,
            parent: current
          };
          newNode.f = newNode.g + newNode.h;
          openSet.push(newNode);
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Heuristic function (Manhattan distance)
   */
  private heuristic(a: GridCoord, b: GridCoord): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  /**
   * Get walkable neighbors of a node
   */
  private getNeighbors(
    node: PathNode,
    gridSystem: GridSystem,
    allowDiagonal: boolean
  ): GridCoord[] {
    const neighbors: GridCoord[] = [];

    // Cardinal directions
    const cardinal = [
      { col: 0, row: -1 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: -1, row: 0 }
    ];

    for (const dir of cardinal) {
      neighbors.push({ col: node.col + dir.col, row: node.row + dir.row });
    }

    // Diagonal directions
    if (allowDiagonal) {
      const diagonal = [
        { col: -1, row: -1 },
        { col: 1, row: -1 },
        { col: 1, row: 1 },
        { col: -1, row: 1 }
      ];

      for (const dir of diagonal) {
        const newCol = node.col + dir.col;
        const newRow = node.row + dir.row;
        
        // Check that we're not cutting corners
        const adj1 = gridSystem.isWalkable(node.col + dir.col, node.row);
        const adj2 = gridSystem.isWalkable(node.col, node.row + dir.row);
        
        if (adj1 && adj2) {
          neighbors.push({ col: newCol, row: newRow });
        }
      }
    }

    return neighbors;
  }

  /**
   * Get movement cost for a tile based on terrain
   */
  private getMovementCost(
    coord: GridCoord,
    gridSystem: GridSystem,
    config: PathConfig
  ): number {
    const tile = gridSystem.getTile(coord.col, coord.row);
    if (!tile) return 1;

    const terrainCost = config.terrainCost.get(tile.type);
    return terrainCost ?? 1;
  }

  /**
   * Reconstruct path from end node to start
   */
  private reconstructPath(endNode: PathNode): GridCoord[] {
    const path: GridCoord[] = [];
    let current: PathNode | null = endNode;

    while (current && current.parent) {
      path.unshift({ col: current.col, row: current.row });
      current = current.parent;
    }

    return path; // Excludes start position
  }

  /**
   * Check if a path exists (without computing the full path)
   */
  public hasPath(
    start: GridCoord,
    end: GridCoord,
    gridSystem: GridSystem
  ): boolean {
    const path = this.findPath(start, end, gridSystem);
    return path.length > 0;
  }
}
