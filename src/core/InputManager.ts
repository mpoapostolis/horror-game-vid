import type { KeyboardInfo } from "@babylonjs/core";
import { KeyboardEventTypes, type Observer, type Scene } from "@babylonjs/core";

export class InputManager {
  private static instance: InputManager;

  private keys = new Set<string>();
  private observer: Observer<KeyboardInfo> | null = null;
  private scene: Scene | null = null;

  private constructor() {}

  static getInstance(): InputManager {
    return (InputManager.instance ??= new InputManager());
  }

  init(scene: Scene): void {
    this.dispose();
    this.scene = scene;

    this.observer = scene.onKeyboardObservable.add((info) => {
      const code = info.event.code;
      if (info.type === KeyboardEventTypes.KEYDOWN) {
        this.keys.add(code);
      } else if (info.type === KeyboardEventTypes.KEYUP) {
        this.keys.delete(code);
      }
    });
  }

  dispose(): void {
    if (this.observer && this.scene) {
      this.scene.onKeyboardObservable.remove(this.observer);
    }
    this.observer = null;
    this.scene = null;
    this.keys.clear();
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }
}
