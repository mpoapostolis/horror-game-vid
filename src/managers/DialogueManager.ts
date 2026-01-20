import { AudioManager } from "./AudioManager";

export interface DialogueLine {
  speaker?: string;
  text: string;
  duration?: number;
}

export interface Dialogue {
  id: string;
  lines: DialogueLine[];
}

export class DialogueManager {
  private static instance: DialogueManager;

  private dialogues = new Map<string, Dialogue>();
  private current?: Dialogue;
  private lineIndex = 0;
  private active = false;

  private overlay: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private speakerEl: HTMLElement | null = null;

  private typeTimer?: number;
  private lineTimer?: number;

  // Cached audio manager
  private audio = AudioManager.getInstance();

  private constructor() {
    this.createUI();
  }

  static getInstance(): DialogueManager {
    return (DialogueManager.instance ??= new DialogueManager());
  }

  private createUI(): void {
    if (typeof document === "undefined") return;

    // Styles
    const style = document.createElement("style");
    style.textContent = `
      .dialogue-overlay {
        position: fixed;
        bottom: 48px;
        left: 50%;
        transform: translateX(-50%) translateY(16px);
        width: 90%;
        max-width: 720px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.95), rgba(20,20,30,0.95));
        border-top: 4px solid currentColor;
        border-bottom: 4px solid currentColor;
        color: white;
        padding: 32px;
        border-radius: 2px;
        z-index: 50;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.4s, transform 0.4s, visibility 0.4s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        backdrop-filter: blur(12px);
      }
      .dialogue-overlay.visible {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(0);
      }
      .dialogue-speaker {
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        font-size: 14px;
        opacity: 0.9;
      }
      .dialogue-text {
        font-family: monospace;
        font-size: 20px;
        text-align: center;
        min-height: 1.5em;
        line-height: 1.6;
      }
      .dialogue-text.typing::after {
        content: '';
        display: inline-block;
        width: 0.6em;
        height: 1.2em;
        background: currentColor;
        margin-left: 4px;
        vertical-align: middle;
        animation: blink 1s step-end infinite;
      }
      @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }

      /* Themes */
      .dialogue-overlay.theme-demon {
        border-color: #dc2626;
        animation: pulse-red 3s infinite;
      }
      .theme-demon .dialogue-speaker { color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,0.8); }
      .theme-demon .dialogue-text { color: #fecaca; }

      .dialogue-overlay.theme-wife {
        border-color: #06b6d4;
        animation: pulse-cyan 4s infinite;
      }
      .theme-wife .dialogue-speaker { color: #67e8f9; text-shadow: 0 0 10px rgba(103,232,249,0.8); }
      .theme-wife .dialogue-text { color: #ecfeff; }

      @keyframes pulse-red {
        0%,100% { border-color: rgba(127,29,29,0.6); box-shadow: 0 0 15px rgba(127,29,29,0.1); }
        50% { border-color: #dc2626; box-shadow: 0 0 30px rgba(220,38,38,0.4); }
      }
      @keyframes pulse-cyan {
        0%,100% { border-color: rgba(6,182,212,0.6); box-shadow: 0 0 15px rgba(6,182,212,0.1); }
        50% { border-color: #22d3ee; box-shadow: 0 0 30px rgba(34,211,238,0.4); }
      }
    `;
    document.head.appendChild(style);

    // Elements
    this.overlay = document.createElement("div");
    this.overlay.className = "dialogue-overlay";

    this.speakerEl = document.createElement("div");
    this.speakerEl.className = "dialogue-speaker";

    this.textEl = document.createElement("p");
    this.textEl.className = "dialogue-text";

    this.overlay.appendChild(this.speakerEl);
    this.overlay.appendChild(this.textEl);
    document.body.appendChild(this.overlay);
  }

  register(dialogue: Dialogue): void {
    this.dialogues.set(dialogue.id, dialogue);
  }

  play(id: string): void {
    const dialogue = this.dialogues.get(id);
    if (!dialogue) {
      console.warn(`Dialogue "${id}" not found`);
      return;
    }

    this.current = dialogue;
    this.lineIndex = 0;
    this.active = true;

    // Theme
    const speaker = dialogue.lines[0]?.speaker ?? "Unknown";
    this.setTheme(speaker);

    this.show();
    this.nextLine();
  }

  private setTheme(speaker: string): void {
    if (!this.overlay) return;
    this.overlay.classList.remove("theme-demon", "theme-wife");

    if (speaker === "Demon") {
      this.overlay.classList.add("theme-demon");
    } else if (speaker === "Wife") {
      this.overlay.classList.add("theme-wife");
    }
  }

  private show(): void {
    this.overlay?.classList.add("visible");
  }

  private hide(): void {
    this.overlay?.classList.remove("visible");
  }

  private nextLine(): void {
    if (!this.current || this.lineIndex >= this.current.lines.length) {
      this.end();
      return;
    }

    const line = this.current.lines[this.lineIndex];
    if (!line) {
      this.end();
      return;
    }

    // Update speaker
    if (this.speakerEl) {
      this.speakerEl.textContent = line.speaker ?? "";
    }

    // Typewriter - O(n) using substring
    if (this.textEl) {
      const text = line.text;
      let i = 0;

      this.textEl.textContent = "";
      this.textEl.classList.add("typing");

      this.clearTimers();

      this.typeTimer = window.setInterval(() => {
        if (i < text.length) {
          // O(n) total, not O(n²)
          this.textEl!.textContent = text.substring(0, ++i);
          this.audio.play("typing", false, 0.4);
        } else {
          window.clearInterval(this.typeTimer);
          this.textEl?.classList.remove("typing");
        }
      }, 50);
    }

    // Next line timer
    this.lineTimer = window.setTimeout(() => {
      this.lineIndex++;
      this.nextLine();
    }, line.duration ?? 3000);
  }

  private clearTimers(): void {
    if (this.typeTimer) window.clearInterval(this.typeTimer);
    if (this.lineTimer) window.clearTimeout(this.lineTimer);
    this.typeTimer = undefined;
    this.lineTimer = undefined;
  }

  private end(): void {
    this.clearTimers();
    this.active = false;
    this.current = undefined;
    this.hide();
  }

  stop(): void {
    this.end();
  }

  isActive(): boolean {
    return this.active;
  }
}
