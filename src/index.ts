async function initGame() {
  const { Engine } = await import("./core/Engine");
  const { LevelManager } = await import("./managers/LevelManager");
  const { Level } = await import("./levels/Level");
  const { LEVELS } = await import("./config/levels");

  const canvas = document.querySelector("canvas") as HTMLCanvasElement;

  const engine = Engine.getInstance(canvas);
  await engine.init();

  const levelManager = LevelManager.getInstance(engine);

  // Register all levels from config
  for (const [id, config] of Object.entries(LEVELS)) {
    levelManager.register(id, () => new Level(config));
  }

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
