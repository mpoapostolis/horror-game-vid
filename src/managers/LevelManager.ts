import type { BaseLevel } from "../levels/BaseLevel";
import { DialogueManager } from "./DialogueManager";
import { InputManager } from "./InputManager";

export class LevelManager {
  private static instance: LevelManager;

  private currentLevel?: BaseLevel;
  private levels = new Map<string, () => BaseLevel>();

  private constructor() {}

  static getInstance(): LevelManager {
    return (LevelManager.instance ??= new LevelManager());
  }

  register(id: string, factory: () => BaseLevel): void {
    this.levels.set(id, factory);
  }

  async load(id: string): Promise<void> {
    const factory = this.levels.get(id);
    if (!factory) throw new Error(`Level "${id}" not found`);

    // Cleanup
    DialogueManager.getInstance().stop();
    InputManager.getInstance().dispose();

    if (this.currentLevel) {
      this.currentLevel.dispose();
      this.currentLevel = undefined;
    }

    // Create and load
    this.currentLevel = factory();
    await this.currentLevel.load();
    this.currentLevel.start();
  }

  getCurrentLevel(): BaseLevel | undefined {
    return this.currentLevel;
  }

  update(): void {
    this.currentLevel?.update();
  }
}
