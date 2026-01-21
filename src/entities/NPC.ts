import {
  type AbstractMesh,
  type AnimationGroup,
  type ShadowGenerator,
  Vector3,
} from "@babylonjs/core";

export interface NPCAnimations {
  idle?: string;
  interact?: string;
}

export interface NPCOptions {
  scale?: number;
  castShadow?: boolean;
  idleAnimation?: string | string[];
  animations?: NPCAnimations;
}

const DEFAULT_IDLE_PATTERNS = ["idle", "Idle", "CharacterArmature|Idle"];

export class NPC {
  public readonly mesh: AbstractMesh;
  public readonly anims: AnimationGroup[];
  private disposed = false;

  constructor(
    meshes: AbstractMesh[],
    animationGroups: AnimationGroup[],
    shadowGenerator: ShadowGenerator,
    position: Vector3,
    options: NPCOptions = {},
  ) {
    const root = meshes[0];
    if (!root) {
      throw new Error("NPC requires at least one mesh");
    }

    this.mesh = root;
    this.anims = animationGroups;

    // Apply transform
    const scale = options.scale ?? 1;
    this.mesh.position = position;
    this.mesh.scaling.setAll(scale);

    // Setup shadows
    if (options.castShadow !== false) {
      for (const mesh of meshes) {
        shadowGenerator.addShadowCaster(mesh);
      }
    }

    // Stop all animations first
    this.stopAllAnimations();

    // Play idle animation
    const idleAnim = this.findAnimation(
      options.animations?.idle || options.idleAnimation
    );
    idleAnim?.play(true);
  }

  private findAnimation(
    animationName?: string | string[]
  ): AnimationGroup | undefined {
    if (!animationName) {
      return this.findIdleByPattern();
    }

    const names = Array.isArray(animationName) ? animationName : [animationName];

    // Exact match first
    for (const name of names) {
      const exact = this.anims.find((a) => a.name === name);
      if (exact) return exact;
    }

    // Partial match
    for (const name of names) {
      const partial = this.anims.find((a) =>
        a.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partial) return partial;
    }

    return this.findIdleByPattern();
  }

  private findIdleByPattern(): AnimationGroup | undefined {
    for (const pattern of DEFAULT_IDLE_PATTERNS) {
      const anim = this.anims.find((a) =>
        a.name.toLowerCase().includes(pattern.toLowerCase())
      );
      if (anim) return anim;
    }
    return this.anims[0];
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }

  public set position(value: Vector3) {
    this.mesh.position = value;
  }

  public getAnimationNames(): string[] {
    return this.anims.map((a) => a.name);
  }

  public playAnimation(name: string, loop = true): boolean {
    if (this.disposed) return false;

    const anim = this.anims.find(
      (a) => a.name === name || a.name.includes(name)
    );

    if (!anim) return false;

    this.stopAllAnimations();
    anim.start(true, 1.0, anim.from, anim.to, loop);
    return true;
  }

  public stopAllAnimations(): void {
    for (const anim of this.anims) {
      anim.stop();
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopAllAnimations();

    for (const anim of this.anims) {
      anim.dispose();
    }

    this.mesh.dispose(false, true);
  }
}
