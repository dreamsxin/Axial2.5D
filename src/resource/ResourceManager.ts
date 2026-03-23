/**
 * ResourceManager - Loads, caches, and manages game resources
 */

import { AssetConfig, SpriteFrame, LoadedResource } from '../core/types';

export class ResourceManager {
  private images: Map<string, HTMLImageElement | OffscreenCanvas> = new Map();
  private audio: Map<string, HTMLAudioElement> = new Map();
  private configs: Map<string, any> = new Map();
  private spritesheets: Map<string, { image: HTMLImageElement; frames: Map<string, SpriteFrame> }> = new Map();
  
  private loadingQueue: Promise<any>[] = [];
  private loadedCount: number = 0;
  private totalCount: number = 0;

  /**
   * Load an image resource
   */
  public async loadImage(key: string, url: string): Promise<HTMLImageElement> {
    if (this.images.has(key)) {
      return this.images.get(key) as HTMLImageElement;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        this.loadedCount++;
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
      this.loadingQueue.push(new Promise((res, rej) => {
        img.onload = () => { res(img); };
        img.onerror = () => { rej(new Error('Failed to load image')); };
      }));
    });
  }

  /**
   * Get a loaded image by key
   */
  public getImage(key: string): HTMLImageElement | undefined {
    return this.images.get(key) as HTMLImageElement;
  }

  /**
   * Load an audio resource
   */
  public async loadAudio(key: string, url: string): Promise<HTMLAudioElement> {
    if (this.audio.has(key)) {
      return this.audio.get(key)!;
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.oncanplaythrough = () => {
        this.audio.set(key, audio);
        this.loadedCount++;
        resolve(audio);
      };
      audio.onerror = reject;
      audio.load();
    });
  }

  /**
   * Load a JSON config resource
   */
  public async loadConfig(key: string, url: string): Promise<any> {
    if (this.configs.has(key)) {
      return this.configs.get(key)!;
    }

    const response = await fetch(url);
    const config = await response.json();
    this.configs.set(key, config);
    this.loadedCount++;
    return config;
  }

  /**
   * Load a spritesheet with frame definitions
   */
  public async loadSpritesheet(
    key: string,
    imageUrl: string,
    frames: SpriteFrame[]
  ): Promise<void> {
    const img = await this.loadImage(key, imageUrl);
    
    const frameMap = new Map<string, SpriteFrame>();
    for (const frame of frames) {
      frameMap.set(frame.name, frame);
    }
    
    this.spritesheets.set(key, { image: img, frames: frameMap });
  }

  /**
   * Get a sprite frame from a spritesheet
   */
  public getSpriteFrame(sheetKey: string, frameName: string): SpriteFrame | null {
    const sheet = this.spritesheets.get(sheetKey);
    if (!sheet) return null;
    return sheet.frames.get(frameName) || null;
  }

  /**
   * Get spritesheet image
   */
  public getSpritesheet(key: string): HTMLImageElement | null {
    const sheet = this.spritesheets.get(key);
    return sheet ? sheet.image : null;
  }

  /**
   * Preload multiple assets
   */
  public async preload(assetList: AssetConfig[]): Promise<void> {
    this.totalCount = assetList.length;
    this.loadedCount = 0;
    this.loadingQueue = [];

    const promises = assetList.map(asset => {
      switch (asset.type) {
        case 'image':
          return this.loadImage(asset.key, asset.url);
        case 'audio':
          return this.loadAudio(asset.key, asset.url);
        case 'config':
          return this.loadConfig(asset.key, asset.url);
        case 'spritesheet':
          if (asset.frames) {
            return this.loadSpritesheet(asset.key, asset.url, asset.frames);
          }
          return Promise.resolve();
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get loading progress (0-1)
   */
  public getProgress(): number {
    if (this.totalCount === 0) return 1;
    return this.loadedCount / this.totalCount;
  }

  /**
   * Check if all resources are loaded
   */
  public isLoaded(): boolean {
    return this.loadedCount >= this.totalCount;
  }

  /**
   * Release a resource by key
   */
  public release(key: string): void {
    this.images.delete(key);
    this.audio.delete(key);
    this.configs.delete(key);
    this.spritesheets.delete(key);
  }

  /**
   * Release all resources
   */
  public releaseAll(): void {
    this.images.clear();
    this.audio.clear();
    this.configs.clear();
    this.spritesheets.clear();
    this.loadingQueue = [];
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  /**
   * Get a loaded config by key
   */
  public getConfig(key: string): any {
    return this.configs.get(key);
  }

  /**
   * Get loading queue length
   */
  public getLoadingQueueLength(): number {
    return this.loadingQueue.length;
  }
}
