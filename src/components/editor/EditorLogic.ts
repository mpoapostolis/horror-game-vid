import { Engine } from "../../core/Engine";
import { LevelManager } from "../../managers/LevelManager";
import { Level } from "../../levels/Level";
import { LEVELS, DEFAULT_CONFIG, type LevelConfig, type EntitySpawn } from "../../config/levels";
import { ENTITIES } from "../../config/entities";
import type { Vector3 } from "@babylonjs/core";

// ==================== TYPES ====================

type TransformMode = "position" | "rotation" | "scale";
type AssetField = "entity" | "asset" | "music" | "environment";

interface AssetSelection {
  index: number | null;
  field: AssetField;
}

interface EditorState {
  currentLevelId: string;
  config: LevelConfig;
  selectedEntityIdx: number;
  transformMode: TransformMode;
  currentEntityAnims: string[];
  copyStatus: string;
  showAssetModal: boolean;
  searchQuery: string;
  outlinerSearch: string;
  selectingAssetFor: AssetSelection | null;
  engine: Engine | null;
}

// ==================== CONSTANTS ====================

const AVAILABLE_ASSETS = [
  "/assets/Demon.glb",
  "/assets/home.glb",
  "/assets/man.glb",
  "/assets/room-large.glb",
  "/assets/wife.glb",
] as const;

const AVAILABLE_MUSIC = [
  "level_1",
  "level_2",
  "teleport",
  "demon_voice",
  "typing",
  "/assets/sounds/level_1.mp3",
  "/assets/sounds/level_2.mp3",
  "/assets/sounds/i_see_you_voice.mp3",
  "/assets/sounds/teleport.mp3",
  "/assets/sounds/typing.mp3",
  "/assets/sounds/beep.wav",
] as const;

const PIPELINE_RANGES = {
  grain: { min: 0, max: 50, step: 1 },
  vignette: { min: 0, max: 10, step: 0.1 },
  chromaticAberration: { min: 0, max: 10, step: 0.1 },
  contrast: { min: 0, max: 3, step: 0.1 },
  exposure: { min: 0, max: 5, step: 0.1 },
} as const;

const ENTITY_ICONS = {
  npc: "👤",
  prop: "📦",
  portal: "🚪",
} as const;

// ==================== HELPERS ====================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function extractAssetName(path: string): string {
  if (!path || typeof path !== "string") return "Unknown";
  return path.replace("/assets/", "").replace(".glb", "").replace(".mp3", "");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(color: number[]): string {
  if (!color) return "#000000";
  const [r, g, b] = color.map((c) => Math.round(c * 255).toString(16).padStart(2, "0"));
  return `#${r}${g}${b}`;
}

function camelToTitle(str: string): string {
  return str.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

// ==================== MAIN LOGIC ====================

export function editorLogic() {
  const state: EditorState = {
    currentLevelId: "level1",
    config: deepClone(LEVELS.level1),
    selectedEntityIdx: -1,
    transformMode: "position",
    currentEntityAnims: [],
    copyStatus: "Copy JSON",
    showAssetModal: false,
    searchQuery: "",
    outlinerSearch: "",
    selectingAssetFor: null,
    engine: null,
  };

  let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  return {
    // Expose state
    ...state,
    availableAssets: AVAILABLE_ASSETS,
    availableMusic: AVAILABLE_MUSIC,

    // ==================== COMPUTED ====================

    get filteredAssets() {
      const source = this.selectingAssetFor?.field === "music" ? this.availableMusic : this.availableAssets;
      if (!this.searchQuery) return source;
      const query = this.searchQuery.toLowerCase();
      return source.filter((a: string) => a.toLowerCase().includes(query));
    },

    // ==================== LIFECYCLE ====================

    async init() {
      const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
      if (!canvas) return;

      this.engine = Engine.getInstance(canvas);
      if (!this.engine.engine) {
        await this.engine.init();
      }

      const levelManager = LevelManager.getInstance();
      this.engine.runRenderLoop(() => {
        levelManager.update();
        levelManager.getCurrentLevel()?.render();
      });

      this.loadLevel(this.currentLevelId);
      this.setupKeyboardShortcuts();
    },

    setupKeyboardShortcuts() {
      keyboardHandler = (e: KeyboardEvent) => {
        if (this.isInputFocused(e.target)) return;

        switch (e.key.toLowerCase()) {
          case "g":
            this.setTransformMode("position");
            break;
          case "r":
            this.setTransformMode("rotation");
            break;
          case "s":
            this.setTransformMode("scale");
            break;
          case "delete":
          case "backspace":
            if (this.selectedEntityIdx !== -1) {
              this.removeEntity(this.selectedEntityIdx);
            }
            break;
          case "escape":
            this.deselectEntity();
            break;
          case "d":
            if (e.shiftKey && this.selectedEntityIdx !== -1) {
              this.duplicateEntity(this.selectedEntityIdx);
            }
            break;
        }
      };

      window.addEventListener("keydown", keyboardHandler);
    },

    isInputFocused(target: EventTarget | null): boolean {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      );
    },

    // ==================== LEVEL MANAGEMENT ====================

    loadLevel(id: string) {
      this.currentLevelId = id;
      this.config = LEVELS[id] ? deepClone(LEVELS[id]) : { ...deepClone(DEFAULT_CONFIG), id } as LevelConfig;
      this.selectedEntityIdx = -1;
      this.currentEntityAnims = [];
      this.reloadLevelPromise();
    },

    async reloadLevelPromise() {
      const previousIdx = this.selectedEntityIdx;
      const levelManager = LevelManager.getInstance();

      levelManager.register("editor", () => new Level(this.config));

      try {
        await levelManager.load("editor");
        const lvl = levelManager.getCurrentLevel();

        if (lvl instanceof Level) {
          lvl.enableEditorMode(
            (type, id) => this.onObjectSelected(type, id),
            (id, pos, rot, scale) => this.onTransformChange(id, pos, rot, scale)
          );
          lvl.setGizmoMode(this.transformMode);

          // Restore selection
          if (previousIdx !== -1 && this.config.entities[previousIdx]) {
            setTimeout(() => {
              this.selectedEntityIdx = previousIdx;
              this.loadEntityAnimations(previousIdx);
            }, 100);
          }
        }
      } catch (e) {
        console.error("[Editor] Failed to load level:", e);
      }
    },

    hotUpdate() {
      const lvl = LevelManager.getInstance().getCurrentLevel();
      if (lvl?.hotUpdate) {
        lvl.hotUpdate(this.config);
      }
    },

    // ==================== ENTITY MANAGEMENT ====================

    addEntity(type: "npc" | "portal" | "prop" = "npc") {
      const entity = this.createDefaultEntity(type);
      this.config.entities.push(entity);
      this.reloadLevelPromise();
      this.selectedEntityIdx = this.config.entities.length - 1;
    },

    createDefaultEntity(type: "npc" | "portal" | "prop"): EntitySpawn {
      switch (type) {
        case "npc":
          return {
            type: "npc",
            asset: "/assets/wife.glb",
            name: "New NPC",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            animations: { idle: "", interact: "" },
          };
        case "portal":
          return {
            type: "portal",
            position: [0, 1.5, 0],
            targetLevel: "level1",
          };
        case "prop":
          return {
            type: "prop",
            asset: "/assets/home.glb",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scaling: [1, 1, 1],
            physics: { enabled: false, mass: 0, impostor: "mesh" },
          };
      }
    },

    addProp(assetPath: string) {
      const entity = this.createDefaultEntity("prop");
      (entity as any).asset = assetPath;
      this.config.entities.push(entity);
      this.reloadLevelPromise();
      this.selectedEntityIdx = this.config.entities.length - 1;
      this.showAssetModal = false;
    },

    removeEntity(idx: number) {
      this.config.entities.splice(idx, 1);
      this.selectedEntityIdx = -1;
      this.currentEntityAnims = [];
      this.reloadLevelPromise();
    },

    duplicateEntity(idx: number) {
      const entity = this.config.entities[idx];
      if (!entity) return;

      const copy = deepClone(entity);
      copy.position[0] += 1;
      this.config.entities.push(copy);
      this.reloadLevelPromise();
      this.selectedEntityIdx = this.config.entities.length - 1;
    },

    selectEntity(idx: number) {
      this.selectedEntityIdx = idx;
      setTimeout(() => this.loadEntityAnimations(idx), 100);
    },

    deselectEntity() {
      this.selectedEntityIdx = -1;
      this.currentEntityAnims = [];
      const lvl = LevelManager.getInstance().getCurrentLevel();
      if (lvl instanceof Level) {
        (lvl as any).gizmoManager?.attachToMesh(null);
      }
    },

    // ==================== ASSET BROWSER ====================

    openAssetBrowser(forEntityIdx?: number | null, field?: AssetField) {
      this.selectingAssetFor = field ? { index: forEntityIdx ?? null, field } : null;
      this.showAssetModal = true;
    },

    async onAssetSelected(assetPath: string) {
      if (!this.selectingAssetFor) {
        this.addProp(assetPath);
        return;
      }

      const { index, field } = this.selectingAssetFor;

      switch (field) {
        case "music":
          this.config.music = assetPath;
          this.hotUpdate();
          break;

        case "environment":
          this.config.environment.asset = assetPath;
          this.reloadLevelPromise();
          break;

        case "entity":
          if (index !== null && this.config.entities[index]) {
            await this.swapEntityModel(index, assetPath);
          }
          break;

        case "asset":
          if (index !== null && this.config.entities[index]) {
            this.config.entities[index].asset = assetPath;
            this.reloadLevelPromise();
          }
          break;
      }

      this.selectingAssetFor = null;
      this.showAssetModal = false;
    },

    async swapEntityModel(index: number, assetPath: string) {
      const entity = this.config.entities[index];
      entity.asset = assetPath;
      delete entity.entity;
      entity.animations = { idle: "", interact: "" };

      const lvl = LevelManager.getInstance().getCurrentLevel();
      if (lvl instanceof Level) {
        const anims = await lvl.swapNPCModel(index, assetPath, entity.scale);
        this.currentEntityAnims = anims;
      }
    },

    // ==================== ANIMATIONS ====================

    loadEntityAnimations(idx: number) {
      const lvl = LevelManager.getInstance().getCurrentLevel();

      if (!(lvl instanceof Level)) {
        setTimeout(() => this.loadEntityAnimations(idx), 200);
        return;
      }

      const anims = lvl.getEntityAnimationGroups(idx);
      this.currentEntityAnims = anims;

      const entity = this.config.entities[idx];
      if (entity && !entity.animations) {
        entity.animations = { idle: "", interact: "" };
      }
    },

    previewAnimation(idx: number, animName: string) {
      if (!animName) return;

      const lvl = LevelManager.getInstance().getCurrentLevel();
      if (lvl instanceof Level) {
        lvl.playEntityAnimation(idx, animName);
      }
    },

    // ==================== 3D CALLBACKS ====================

    onObjectSelected(type: string, id: number) {
      if (type === "entity") {
        this.selectedEntityIdx = id;
        setTimeout(() => this.loadEntityAnimations(id), 50);
      } else {
        this.selectedEntityIdx = -1;
        this.currentEntityAnims = [];
      }
    },

    onTransformChange(id: number, pos: Vector3, rot?: Vector3, scale?: Vector3) {
      const entity = this.config.entities[id];
      if (!entity || this.selectedEntityIdx !== id) return;

      entity.position = [
        parseFloat(pos.x.toFixed(2)),
        parseFloat(pos.y.toFixed(2)),
        parseFloat(pos.z.toFixed(2)),
      ];

      if (rot) {
        entity.rotation = [
          parseFloat(rot.x.toFixed(2)),
          parseFloat(rot.y.toFixed(2)),
          parseFloat(rot.z.toFixed(2)),
        ];
      }

      if (scale) {
        if (entity.type === "prop") {
          entity.scaling = [
            parseFloat(scale.x.toFixed(2)),
            parseFloat(scale.y.toFixed(2)),
            parseFloat(scale.z.toFixed(2)),
          ];
        } else {
          entity.scale = parseFloat(scale.x.toFixed(2));
        }
      }
    },

    setTransformMode(mode: TransformMode) {
      this.transformMode = mode;
      const lvl = LevelManager.getInstance().getCurrentLevel();
      if (lvl instanceof Level) {
        lvl.setGizmoMode(mode);
      }
    },

    updateTransformFromUI() {
      if (this.selectedEntityIdx === -1) return;

      const entity = this.config.entities[this.selectedEntityIdx];
      const lvl = LevelManager.getInstance().getCurrentLevel();

      if (!(lvl instanceof Level)) return;

      const scale = this.getEntityScaleArray(entity);
      lvl.updateEntityTransform(
        this.selectedEntityIdx,
        entity.position,
        entity.rotation || [0, 0, 0],
        scale
      );
    },

    forceUpdateEntity(idx: number) {
      this.reloadLevelPromise();
    },

    // ==================== SCALE HELPERS ====================

    getEntityScale(entity: any): number {
      if (entity.type === "prop" && entity.scaling) return entity.scaling[0] || 1;
      if (typeof entity.scale === "number") return entity.scale;
      if (Array.isArray(entity.scale)) return entity.scale[0] || 1;
      return 1;
    },

    getEntityScaleArray(entity: any): number[] {
      if (entity.type === "prop" && entity.scaling) return entity.scaling;
      const s = typeof entity.scale === "number" ? entity.scale : 1;
      return [s, s, s];
    },

    setEntityScale(entity: any, value: number) {
      if (entity.type === "prop") {
        entity.scaling = [value, value, value];
      } else {
        entity.scale = value;
      }
      this.updateTransformFromUI();
    },

    // ==================== NPC FEATURES ====================

    addRequirement(idx: number) {
      const entity = this.config.entities[idx];
      if (!entity.requirements) entity.requirements = [];
      entity.requirements.push({ type: "item", value: 1 });
    },

    removeRequirement(entIdx: number, reqIdx: number) {
      this.config.entities[entIdx].requirements?.splice(reqIdx, 1);
    },

    addReward(idx: number) {
      const entity = this.config.entities[idx];
      if (!entity.rewards) entity.rewards = [];
      entity.rewards.push({ type: "money", value: 100 });
    },

    removeReward(entIdx: number, rewardIdx: number) {
      this.config.entities[entIdx].rewards?.splice(rewardIdx, 1);
    },

    addFailDialogue(idx: number) {
      const entity = this.config.entities[idx];
      if (!entity.failDialogue) entity.failDialogue = [];
      entity.failDialogue.push({
        speaker: "NPC",
        text: "You don't have what I need...",
        duration: 3000,
      });
    },

    removeFailDialogue(entIdx: number, diagIdx: number) {
      this.config.entities[entIdx].failDialogue?.splice(diagIdx, 1);
    },

    addSuccessDialogue(idx: number) {
      const entity = this.config.entities[idx];
      if (!entity.successDialogue) entity.successDialogue = [];
      entity.successDialogue.push({
        speaker: "NPC",
        text: "Thank you! Here's your reward.",
        duration: 3000,
      });
    },

    removeSuccessDialogue(entIdx: number, diagIdx: number) {
      this.config.entities[entIdx].successDialogue?.splice(diagIdx, 1);
    },

    // ==================== UI HELPERS ====================

    getIcon(type: string): string {
      return ENTITY_ICONS[type as keyof typeof ENTITY_ICONS] || "❓";
    },

    getAssetName: extractAssetName,

    getEntityName(entity: any): string {
      if (!entity) return "Unknown";
      if (entity.name) return entity.name;

      switch (entity.type) {
        case "npc":
          return extractAssetName(entity.asset || entity.entity || "Unknown");
        case "prop":
          return `Prop: ${extractAssetName(entity.asset)}`;
        case "portal":
          return `Portal → ${entity.targetLevel}`;
        default:
          return "Unknown";
      }
    },

    getModelDisplayName(entity: any): string {
      return extractAssetName(entity?.asset || entity?.entity || "");
    },

    getAvailableEntities(): string[] {
      return Object.keys(ENTITIES).filter((k) => ENTITIES[k].type === "npc");
    },

    hexToRgb,
    colorToHex: rgbToHex,
    camelToTitle,

    getPipelineRange(setting: string) {
      return PIPELINE_RANGES[setting as keyof typeof PIPELINE_RANGES] || { min: 0, max: 100, step: 1 };
    },

    // ==================== EXPORT ====================

    copyJson() {
      navigator.clipboard.writeText(JSON.stringify(this.config, null, 2));
      this.copyStatus = "Copied!";
      setTimeout(() => (this.copyStatus = "Copy JSON"), 2000);
    },

    downloadJson() {
      const blob = new Blob([JSON.stringify(this.config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `level_${this.config.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    // ==================== CLEANUP ====================

    destroy() {
      if (keyboardHandler) {
        window.removeEventListener("keydown", keyboardHandler);
        keyboardHandler = null;
      }

      this.engine?.dispose();
      this.engine = null;
    },
  };
}
