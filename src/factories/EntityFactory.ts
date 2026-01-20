import { Scene, Vector3, ShadowGenerator } from "@babylonjs/core";
import { AssetManager } from "../managers/AssetManager";
import { DialogueManager } from "../managers/DialogueManager";
import { NPC } from "../entities/NPC";
import { Portal } from "../entities/Portal";
import { ENTITIES, isPortalSpawn } from "../config/entities";
import type { NPCConfig, SpawnConfig, PortalSpawnConfig } from "../config/entities";

export class EntityFactory {
  private assetManager: AssetManager;
  private shadowGenerator: ShadowGenerator;
  private scene: Scene;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator,
    assetManager: AssetManager
  ) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.assetManager = assetManager;
  }

  async spawnNPC(
    entityKey: string,
    position: Vector3,
    scaleOverride?: number
  ): Promise<NPC> {
    const config = ENTITIES[entityKey];
    if (!config || config.type !== "npc") {
      throw new Error(`Unknown NPC entity: ${entityKey}`);
    }

    const npcConfig = config as NPCConfig;
    const data = await this.assetManager.loadMesh(npcConfig.asset, this.scene);

    return new NPC(
      data.meshes,
      data.animationGroups,
      this.shadowGenerator,
      position,
      npcConfig,
      scaleOverride
    );
  }

  spawnPortal(position: Vector3, targetLevel: string): Portal {
    return new Portal(this.scene, position, targetLevel);
  }

  async spawn(
    config: SpawnConfig | PortalSpawnConfig
  ): Promise<NPC | Portal> {
    const position = new Vector3(...config.position);

    if (isPortalSpawn(config)) {
      return this.spawnPortal(position, config.targetLevel);
    }

    const npc = await this.spawnNPC(
      config.entity,
      position,
      config.scale
    );

    if (config.dialogue) {
      DialogueManager.getInstance().register(config.dialogue);
    }

    return npc;
  }
}
