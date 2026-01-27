/**
 * AudioManager - Singleton for managing game audio
 * Handles sound effects and music with proper resource cleanup
 */

interface AudioEntry {
  element: HTMLAudioElement;
  isLooping: boolean;
}

const DEFAULT_REGISTRY = new Map<string, string>([
  ["teleport", "/assets/sounds/teleport.mp3"],
  ["demon_voice", "/assets/sounds/i_see_you_voice.mp3"],
  ["level_1", "/assets/sounds/level_1.mp3"],
  ["level_2", "/assets/sounds/level_2.mp3"],
  ["typing", "/assets/sounds/beep.wav"],
]);

export class AudioManager {
  private static instance: AudioManager;

  private readonly registry = new Map<string, string>(DEFAULT_REGISTRY);
  private readonly active = new Map<string, AudioEntry>();

  private constructor() {}

  static getInstance(): AudioManager {
    return (AudioManager.instance ??= new AudioManager());
  }

  play(name: string, loop = false, volume = 1.0): void {
    const path = this.registry.get(name);
    if (!path) {
      console.warn(`[AudioManager] Sound "${name}" not registered`);
      return;
    }

    // Stop existing instance of same sound
    this.stop(name);

    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = Math.max(0, Math.min(1, volume));

    audio.play().catch((e) => {
      console.error(`[AudioManager] Play failed for "${name}":`, e);
      this.cleanup(name);
    });

    this.active.set(name, { element: audio, isLooping: loop });

    // Auto-cleanup for non-looping sounds
    if (!loop) {
      audio.addEventListener("ended", () => this.cleanup(name), { once: true });
      audio.addEventListener("error", () => this.cleanup(name), { once: true });
    }
  }

  stop(name: string): void {
    const entry = this.active.get(name);
    if (entry) {
      this.disposeAudio(entry.element);
      this.active.delete(name);
    }
  }

  stopAll(): void {
    for (const entry of this.active.values()) {
      this.disposeAudio(entry.element);
    }
    this.active.clear();
  }

  register(name: string, path: string): void {
    this.registry.set(name, path);
  }

  isPlaying(name: string): boolean {
    const entry = this.active.get(name);
    return entry ? !entry.element.paused : false;
  }

  private cleanup(name: string): void {
    const entry = this.active.get(name);
    if (entry) {
      this.disposeAudio(entry.element);
      this.active.delete(name);
    }
  }

  private disposeAudio(audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
    audio.src = "";
    audio.load(); // Release resources
  }
}
