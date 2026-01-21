import {
  type AbstractMesh,
  type AnimationGroup,
  ImportMeshAsync,
  type Scene,
} from "@babylonjs/core";

export interface LoadedMesh {
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
  root: AbstractMesh | undefined;
}

export class AssetManager {
  private static instance: AssetManager;

  private constructor() {}

  static getInstance(): AssetManager {
    return (AssetManager.instance ??= new AssetManager());
  }

  async loadMesh(path: string, scene: Scene): Promise<LoadedMesh> {
    if (!path) {
      throw new Error("Asset path is required");
    }

    try {
      const result = await ImportMeshAsync(path, scene);

      if (!result.meshes.length) {
        console.warn(`[AssetManager] No meshes found in asset: ${path}`);
      }

      return {
        meshes: result.meshes,
        animationGroups: result.animationGroups,
        root: result.meshes[0],
      };
    } catch (error) {
      console.error(`[AssetManager] Failed to load: ${path}`, error);
      throw new Error(`Asset load failed: ${path}`);
    }
  }
}
