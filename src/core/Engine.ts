import { WebGPUEngine } from "@babylonjs/core";
import "@babylonjs/loaders";

export class Engine {
  private static instance: Engine;
  public engine!: WebGPUEngine;
  public canvas: HTMLCanvasElement;

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public static getInstance(canvas?: HTMLCanvasElement): Engine {
    if (!Engine.instance) {
      if (!canvas) throw new Error("Canvas required for first initialization");
      Engine.instance = new Engine(canvas);
    }
    return Engine.instance;
  }

  public async init(): Promise<void> {
    this.engine = new WebGPUEngine(this.canvas, {
      audioEngine: true,
    });
    await this.engine.initAsync();
  }

  public runRenderLoop(callback: () => void): void {
    this.engine.runRenderLoop(callback);
  }

  public stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }
}
