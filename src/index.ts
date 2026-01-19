async function initGame() {
  const { Engine } = await import("./core/Engine");
  const { LevelManager } = await import("./managers/LevelManager");
  const { Level_1 } = await import("./levels/Level_1");
  const { Level_2 } = await import("./levels/Level_2");

  const canvas = document.querySelector("canvas") as HTMLCanvasElement;

  const engine = Engine.getInstance(canvas);
  await engine.init();

  const levelManager = LevelManager.getInstance(engine);

  levelManager.register("level1", () => new Level_1());
  levelManager.register("level2", () => new Level_2());

  await levelManager.load("level1");

  engine.runRenderLoop(() => {
    levelManager.update();
    levelManager.getCurrentLevel()?.render();
  });
}

if (document.readyState === "loading") {
  window.addEventListener("load", initGame);
} else {
  initGame();
}
