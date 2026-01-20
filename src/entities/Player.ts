import {
  type AbstractMesh,
  type AnimationGroup,
  type ArcRotateCamera,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  type Scene,
  type ShadowGenerator,
  SpotLight,
  Vector3,
} from "@babylonjs/core";
import { ANIMATIONS } from "../hero_anim";
import { InputManager } from "../managers/InputManager";

export class Player {
  readonly mesh: AbstractMesh;
  readonly capsule: AbstractMesh;
  readonly spotLight: SpotLight;
  readonly physicsAggregate: PhysicsAggregate;

  private readonly anims: Map<string, AnimationGroup>;
  private readonly input: InputManager;
  private readonly camera: ArcRotateCamera;
  private readonly moveSpeed = 5;

  // Reusable vectors to avoid GC
  private readonly moveVec = Vector3.Zero();
  private readonly velocityVec = Vector3.Zero();
  private readonly lookVec = Vector3.Zero();

  // Animation state
  private currentAnim: string | null = null;

  constructor(
    mesh: AbstractMesh,
    animationGroups: AnimationGroup[],
    camera: ArcRotateCamera,
    shadowGenerator: ShadowGenerator,
    scene: Scene
  ) {
    this.mesh = mesh;
    this.camera = camera;
    this.input = InputManager.getInstance();

    // Physics capsule
    this.capsule = MeshBuilder.CreateCapsule("playerCapsule", { height: 2, radius: 0.25 }, scene);
    this.capsule.position.set(0, 1, 0);
    this.capsule.isVisible = false;

    // Parent mesh to capsule
    this.mesh.parent = this.capsule;
    this.mesh.position.y = -1;

    // Physics
    this.physicsAggregate = new PhysicsAggregate(
      this.capsule,
      PhysicsShapeType.CAPSULE,
      { mass: 1, friction: 0.5, restitution: 0 },
      scene
    );
    this.physicsAggregate.body.setMassProperties({ inertia: Vector3.Zero() });

    // Animations
    this.anims = new Map(animationGroups.map((ag) => [ag.name, ag]));
    scene.stopAllAnimations();

    // Shadow
    shadowGenerator.addShadowCaster(mesh);

    // Spotlight
    this.spotLight = new SpotLight(
      "playerLight",
      Vector3.Zero(),
      Vector3.Forward(),
      Math.PI / 2,
      10_000,
      scene
    );
    this.spotLight.position.y = 2;
    this.spotLight.parent = this.mesh;

    // Initial animation
    this.playAnim(ANIMATIONS.Idle_Neutral);
  }

  update(): void {
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    // Reset move vector
    this.moveVec.setAll(0);

    // Input
    const w = this.input.isKeyDown("KeyW");
    const s = this.input.isKeyDown("KeyS");
    const a = this.input.isKeyDown("KeyA");
    const d = this.input.isKeyDown("KeyD");

    if (w) this.moveVec.addInPlace(forward);
    if (s) this.moveVec.subtractInPlace(forward);
    if (a) this.moveVec.subtractInPlace(right);
    if (d) this.moveVec.addInPlace(right);

    const isMoving = w || s || a || d;
    const currentY = this.physicsAggregate.body.getLinearVelocity().y;

    if (isMoving) {
      this.moveVec.normalize();

      // Set velocity (reuse vector)
      this.velocityVec.set(
        this.moveVec.x * this.moveSpeed,
        currentY,
        this.moveVec.z * this.moveSpeed
      );
      this.physicsAggregate.body.setLinearVelocity(this.velocityVec);

      // Animation based on primary direction
      const anim = s
        ? ANIMATIONS.Run_Back
        : a
          ? ANIMATIONS.Run_Left
          : d
            ? ANIMATIONS.Run_Right
            : ANIMATIONS.Run;
      this.playAnim(anim);
    } else {
      // Stop horizontal movement
      this.velocityVec.set(0, currentY, 0);
      this.physicsAggregate.body.setLinearVelocity(this.velocityVec);
      this.playAnim(ANIMATIONS.Idle_Neutral);
    }

    // Look direction
    this.lookVec.copyFrom(forward).scaleInPlace(-2);
    this.lookVec.y = -Math.PI / 3;
    this.mesh.lookAt(this.lookVec);

    // Camera follow
    this.camera.setTarget(this.capsule.position);
  }

  private playAnim(name: string): void {
    if (this.currentAnim === name) return;

    const anim = this.anims.get(name);
    if (!anim) return;

    // Stop current
    if (this.currentAnim) {
      this.anims.get(this.currentAnim)?.stop();
    }

    anim.play(true);
    this.currentAnim = name;
  }

  get position(): Vector3 {
    return this.capsule.position;
  }
}
