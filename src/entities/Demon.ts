import {
  AbstractMesh,
  AnimationGroup,
  Vector3,
  ShadowGenerator,
} from "@babylonjs/core";

export class Demon {
  public mesh: AbstractMesh;
  public anims: AnimationGroup[];

  constructor(
    meshes: AbstractMesh[],
    animationGroups: AnimationGroup[],
    shadowGenerator: ShadowGenerator,
    position: Vector3,
    scale: number = 2
  ) {
    this.mesh = meshes[0]!;
    this.anims = animationGroups;

    // Position and scale - exactly as original
    this.mesh.position = position;
    this.mesh.scaling = new Vector3(scale, scale, scale);

    // Add shadow casters
    meshes.forEach((m) => shadowGenerator.addShadowCaster(m));

    // Stop all anims and play idle
    animationGroups.forEach((a) => a.stop());
    const idle = animationGroups.find(
      (a) => a.name === "CharacterArmature|Idle"
    );
    if (idle) idle.play(true);
  }

  public get position(): Vector3 {
    return this.mesh.position;
  }
}
