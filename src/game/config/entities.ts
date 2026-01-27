export type EntityType = "npc" | "portal";

export interface NPCConfig {
  type: "npc";
  asset: string;
  scale: number;
  idleAnimation: string | string[];
  castShadow: boolean;
}

export interface PortalConfig {
  type: "portal";
  diameter: number;
  color: [number, number, number];
  lightIntensity: number;
  lightRange: number;
}

export type EntityConfig = NPCConfig | PortalConfig;

// Mutable container for entities to support dynamic loading
export const ENTITIES: Record<string, EntityConfig> = {
  wife: {
    type: "npc",
    asset: "/assets/wife.glb",
    scale: 0.95,
    idleAnimation: ["Idle", "idle"],
    castShadow: true,
  },
  demon: {
    type: "npc",
    asset: "/assets/Demon.glb",
    scale: 2,
    idleAnimation: "CharacterArmature|Idle",
    castShadow: true,
  },
  portal: {
    type: "portal",
    diameter: 1.5,
    color: [0, 0.8, 1],
    lightIntensity: 5,
    lightRange: 10,
  },
};

export async function loadEntitiesConfig(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();

    // Merge dynamic config into existing ENTITIES
    // This allows maintaining defaults if the remote config is partial,
    // or overriding them if keys match.
    Object.assign(ENTITIES, data);
    console.log("Dynamic entity configuration loaded:", data);
  } catch (error) {
    console.error("Failed to load dynamic entity config:", error);
    // Silent fail to keep defaults
  }
}

export interface DialogueLine {
  speaker: string;
  text: string;
  duration: number;
}

export interface DialogueConfig {
  id: string;
  lines: DialogueLine[];
}

export interface SpawnConfig {
  entity: string; // Relaxed from keyof typeof ENTITIES to support dynamic keys
  position: [number, number, number];
  scale?: number;
  dialogue?: DialogueConfig;
  interactionRadius?: number;
  onInteract?: {
    playSound?: string;
    playDialogue?: string;
  };
}

export interface PortalSpawnConfig {
  entity: "portal";
  position: [number, number, number];
  targetLevel: string;
}

export function isPortalSpawn(
  config: SpawnConfig | PortalSpawnConfig,
): config is PortalSpawnConfig {
  return config.entity === "portal";
}
