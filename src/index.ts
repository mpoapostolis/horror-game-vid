async function initGame(): Promise<void> {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  try {
    const { Engine } = await import("./core/Engine");
    const { LevelManager } = await import("./managers/LevelManager");
    const { Level } = await import("./levels/Level");
    const { LEVELS } = await import("./config/levels");

    const engine = Engine.getInstance(canvas as HTMLCanvasElement);
    await engine.init();

    const levelManager = LevelManager.getInstance();

    // Register levels from config
    for (const [id, config] of Object.entries(LEVELS)) {
      levelManager.register(id, () => new Level(config));
    }

    await levelManager.load("level1");

    engine.runRenderLoop(() => {
      levelManager.update();
      levelManager.getCurrentLevel()?.render();
    });
  } catch (error) {
    console.error("Game initialization failed:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
