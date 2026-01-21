/**
 * Portal - Interactive teleport orb with animations
 * Features: rotation, floating animation, proper observer cleanup
 */

import {
  ActionManager,
  Color3,
  ExecuteCodeAction,
  MeshBuilder,
  type Mesh,
  type Observer,
  PointLight,
  type Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { AudioManager } from "../managers/AudioManager";
import { LevelManager } from "../managers/LevelManager";

interface PortalConfig {
  diameter: number;
  color: Color3;
  lightIntensity: number;
  lightRange: number;
  rotationSpeed: number;
  floatSpeed: number;
  floatAmplitude: number;
}

const DEFAULT_CONFIG: PortalConfig = {
  diameter: 1.5,
  color: new Color3(0, 0.8, 1),
  lightIntensity: 5,
  lightRange: 10,
  rotationSpeed: 0.02,
  floatSpeed: 3,
  floatAmplitude: 0.3,
};

export class Portal {
  readonly mesh: Mesh;

  private readonly scene: Scene;
  private readonly light: PointLight;
  private readonly material: StandardMaterial;
  private readonly startY: number;
  private readonly config: PortalConfig;

  private renderObserver: Observer<Scene> | null = null;
  private time = 0;
  private disposed = false;

  constructor(
    scene: Scene,
    position: Vector3,
    targetLevelId: string,
    config: Partial<PortalConfig> = {}
  ) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startY = position.y;

    // Create mesh
    this.mesh = MeshBuilder.CreateSphere("portal", { diameter: this.config.diameter }, scene);
    this.mesh.position.copyFrom(position);

    // Material
    this.material = new StandardMaterial("portalMat", scene);
    this.material.emissiveColor = this.config.color;
    this.material.alpha = 0.8;
    this.mesh.material = this.material;

    // Light
    this.light = new PointLight("portalLight", Vector3.Zero(), scene);
    this.light.parent = this.mesh;
    this.light.diffuse = this.config.color;
    this.light.intensity = this.config.lightIntensity;
    this.light.range = this.config.lightRange;

    // Interaction
    this.setupInteraction(targetLevelId);

    // Animation
    this.setupAnimation();

    // Cleanup hook
    this.mesh.onDisposeObservable.addOnce(() => this.dispose());
  }

  private setupInteraction(targetLevelId: string): void {
    this.mesh.actionManager = new ActionManager(this.scene);
    this.mesh.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if (this.disposed) return;
        LevelManager.getInstance().load(targetLevelId);
        AudioManager.getInstance().play("teleport");
      })
    );
  }

  private setupAnimation(): void {
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.disposed) return;

      const dt = this.scene.getEngine().getDeltaTime() * 0.001;
      this.time += dt;

      this.mesh.rotation.y += this.config.rotationSpeed;
      this.mesh.position.y = this.startY + Math.sin(this.time * this.config.floatSpeed) * this.config.floatAmplitude;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove observer
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }

    // Dispose resources
    this.light.dispose();
    this.material.dispose();
    this.mesh.actionManager?.dispose();
    this.mesh.dispose();
  }
}
