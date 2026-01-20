export class AudioManager {
  private static instance: AudioManager;

  private registry = new Map<string, string>([
    ["teleport", "/assets/sounds/teleport.mp3"],
    ["demon_voice", "/assets/sounds/i_see_you_voice.mp3"],
    ["level_1", "/assets/sounds/level_1.mp3"],
    ["level_2", "/assets/sounds/level_2.mp3"],
    ["typing", "/assets/sounds/beep.wav"],
  ]);

  private active = new Map<string, HTMLAudioElement>();

  private constructor() {}

  static getInstance(): AudioManager {
    return (AudioManager.instance ??= new AudioManager());
  }

  play(name: string, loop = false, volume = 1.0): void {
    const path = this.registry.get(name);
    if (!path) {
      console.warn(`Sound "${name}" not registered`);
      return;
    }

    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = volume;
    audio.play().catch((e) => console.error("Audio play failed:", e));

    this.active.set(name, audio);

    if (!loop) {
      audio.onended = () => this.active.delete(name);
    }
  }

  stop(name: string): void {
    const audio = this.active.get(name);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.active.delete(name);
    }
  }

  stopAll(): void {
    for (const audio of this.active.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.active.clear();
  }

  register(name: string, path: string): void {
    this.registry.set(name, path);
  }
}
