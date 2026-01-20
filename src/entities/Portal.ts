import {
  ActionManager,
  Color3,
  ExecuteCodeAction,
  MeshBuilder,
  PointLight,
  type Scene,
  StandardMaterial,
  type TransformNode,
  Vector3,
} from "@babylonjs/core";
import { AudioManager } from "../managers/AudioManager";
import { LevelManager } from "../managers/LevelManager";

const PORTAL_CONFIG = {
  diameter: 1.5,
  color: new Color3(0, 0.8, 1),
  lightIntensity: 5,
  lightRange: 10,
  rotationSpeed: 0.02,
  floatSpeed: 0.003,
  floatAmplitude: 0.3,
} as const;

export class Portal {
  readonly mesh: TransformNode;

  constructor(scene: Scene, position: Vector3, targetLevelId: string) {
    const {
      diameter,
      color,
      lightIntensity,
      lightRange,
      rotationSpeed,
      floatSpeed,
      floatAmplitude,
    } = PORTAL_CONFIG;

    // Orb mesh
    const orb = MeshBuilder.CreateSphere("portal", { diameter }, scene);
    orb.position.copyFrom(position);
    this.mesh = orb;

    // Material
    const mat = new StandardMaterial("portalMat", scene);
    mat.emissiveColor = color;
    mat.alpha = 0.8;
    orb.material = mat;

    // Light
    const light = new PointLight("portalLight", Vector3.Zero(), scene);
    light.parent = orb;
    light.diffuse = color;
    light.intensity = lightIntensity;
    light.range = lightRange;

    // Click interaction
    orb.actionManager = new ActionManager(scene);
    orb.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        LevelManager.getInstance().load(targetLevelId);
        AudioManager.getInstance().play("teleport");
      })
    );

    // Animation using accumulated time (not Date.now() every frame)
    const startY = position.y;
    let time = 0;

    const observer = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() * 0.001;
      time += dt;

      orb.rotation.y += rotationSpeed;
      orb.position.y = startY + Math.sin(time * floatSpeed * 1000) * floatAmplitude;
    });

    // Cleanup on dispose
    orb.onDisposeObservable.addOnce(() => {
      scene.onBeforeRenderObservable.remove(observer);
    });
  }
}
