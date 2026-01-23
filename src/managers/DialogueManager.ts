/**
 * DialogueManager - Singleton for managing in-game dialogue
 * Optimized: rAF-based typewriter, efficient DOM updates, proper cleanup
 */

import { AudioManager } from "./AudioManager";

export interface DialogueChoice {
  text: string;
  value: any;
}

export interface DialogueLine {
  speaker?: string;
  text: string;
  choices?: DialogueChoice[];
  // duration is deprecated/ignored for text lines, but kept for compatibility
  duration?: number;
}

export interface Dialogue {
  id: string;
  lines: DialogueLine[];
  onChoice?: (value: any) => void;
  onComplete?: () => void;
}

type Theme = "default" | "demon" | "wife";

const CHARS_PER_SECOND = 20;
const DEFAULT_LINE_DURATION_MS = 3000;
const TYPING_SOUND_INTERVAL = 3;

const THEME_CLASSES: Record<Theme, string> = {
  default: "",
  demon: "theme-demon",
  wife: "theme-wife",
};

export class DialogueManager {
  private static instance: DialogueManager;

  private readonly dialogues = new Map<string, Dialogue>();
  private readonly audio = AudioManager.getInstance();

  private overlay: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private speakerEl: HTMLElement | null = null;

  private current?: Dialogue;
  private lineIndex = 0;
  private active = false;
  private isTyping = false;
  private waitingForInput = false;

  private rafId: number | null = null;
  private inputListener: ((e: KeyboardEvent | MouseEvent) => void) | null =
    null;

  private constructor() {
    this.createUI();
  }

  static getInstance(): DialogueManager {
    return (DialogueManager.instance ??= new DialogueManager());
  }

  register(dialogue: Dialogue): void {
    this.dialogues.set(dialogue.id, dialogue);
  }

  play(id: string): void {
    const dialogue = this.dialogues.get(id);
    if (!dialogue) return;

    this.clearTimers();
    this.current = dialogue;
    this.lineIndex = 0;
    this.active = true;

    const speaker = dialogue.lines[0]?.speaker ?? "Unknown";
    this.setSpeaker(speaker);
    this.applyTheme(speaker);
    this.show();
    this.nextLine();
  }

  stop(): void {
    this.end();
  }

  isActive(): boolean {
    return this.active;
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

    this.typeText(line);
  }

  private handleInput(e: KeyboardEvent | MouseEvent): void {
    if (!this.active) return;

    // Ignore clicks on choices (handled by buttons)
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;

    if (e instanceof KeyboardEvent && e.code !== "Space" && e.code !== "Enter")
      return;

    if (this.isTyping) {
      // Instant finish typing
      this.finishTyping();
    } else if (this.waitingForInput) {
      // Advance to next line
      this.lineIndex++;
      this.nextLine();
    }
  }

  private setupInputListener(): void {
    if (this.inputListener) return;
    this.inputListener = (e) => this.handleInput(e);
    window.addEventListener("keydown", this.inputListener);
    window.addEventListener("click", this.inputListener);
  }

  private cleanup(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.inputListener) {
      window.removeEventListener("keydown", this.inputListener);
      window.removeEventListener("click", this.inputListener);
      this.inputListener = null;
    }
    // Remove choices if any
    const choicesEl = this.overlay?.querySelector("#dialogue-choices");
    if (choicesEl) choicesEl.remove();
  }

  private typeText(line: DialogueLine): void {
    if (!this.textEl) return;

    this.textEl.textContent = "";
    this.isTyping = true;
    this.waitingForInput = false;
    this.updateHint(false); // Hide hint while typing

    // Clear previous choices
    const oldChoices = this.overlay?.querySelector("#dialogue-choices");
    if (oldChoices) oldChoices.remove();

    const text = line.text;
    let charIndex = 0;
    let lastTime = performance.now();
    let soundCounter = 0;

    const animate = (now: number) => {
      const delta = now - lastTime;
      const charsToAdd = Math.floor((delta / 1000) * CHARS_PER_SECOND);

      if (charsToAdd > 0) {
        lastTime = now;
        charIndex = Math.min(charIndex + charsToAdd, text.length);
        this.textEl!.textContent = text.slice(0, charIndex);

        soundCounter += charsToAdd;
        if (soundCounter >= TYPING_SOUND_INTERVAL) {
          this.audio.play("typing", false, 0.4);
          soundCounter = 0;
        }
      }

      if (charIndex < text.length) {
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.finishTyping();
      }
    };

    this.setupInputListener();
    this.rafId = requestAnimationFrame(animate);
  }

  private finishTyping(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (!this.current) return;
    const line = this.current.lines[this.lineIndex];

    if (this.textEl) this.textEl.textContent = line.text;
    this.isTyping = false;

    // Check for choices
    if (line.choices && line.choices.length > 0) {
      this.showChoices(line.choices);
      this.waitingForInput = false; // Input logic moves to choices
      this.updateHint(false);
    } else {
      this.waitingForInput = true;
      this.updateHint(true);
    }
  }

  private showChoices(choices: DialogueChoice[]): void {
    if (!this.overlay) return;

    const choicesContainer = document.createElement("div");
    choicesContainer.id = "dialogue-choices";
    choicesContainer.className =
      "flex flex-wrap justify-center gap-3 mt-4 w-full animate-fade-in";

    choices.forEach((choice, idx) => {
      const btn = document.createElement("button");
      btn.textContent = choice.text;
      btn.className = `
        px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/50
        rounded text-sm font-bold uppercase tracking-wide transition-all
        hover:scale-105 active:scale-95 backdrop-blur-md shadow-lg
      `.trim();

      btn.onclick = (e) => {
        e.stopPropagation();
        this.handleChoice(choice.value);
      };

      choicesContainer.appendChild(btn);
    });

    this.overlay.appendChild(choicesContainer);
  }

  private handleChoice(value: any): void {
    if (this.current?.onChoice) {
      this.current.onChoice(value);
    }
    // After choice, we usually advance or close.
    // For now, let's assume we advance to next line or close if done.
    this.lineIndex++;
    this.nextLine();
  }

  private updateHint(show: boolean): void {
    const hint = this.overlay?.querySelector("#dialogue-hint");
    if (hint) {
      if (show) hint.classList.remove("opacity-0");
      else hint.classList.add("opacity-0");
    }
  }

  private clearTimers(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private end(): void {
    if (this.current?.onComplete) {
      this.current.onComplete();
    }
    this.cleanup();
    this.active = false;
    this.current = undefined;
    this.lineIndex = 0;
    this.hide();
  }

  private setSpeaker(name: string): void {
    if (this.speakerEl) this.speakerEl.textContent = name;
  }

  private applyTheme(speaker: string): void {
    if (!this.overlay) return;

    // Remove all themes
    for (const cls of Object.values(THEME_CLASSES)) {
      if (cls) this.overlay.classList.remove(cls);
    }

    // Apply speaker-specific theme
    const theme: Theme =
      speaker === "Demon" ? "demon" : speaker === "Wife" ? "wife" : "default";
    const themeClass = THEME_CLASSES[theme];
    if (themeClass) this.overlay.classList.add(themeClass);
  }

  private show(): void {
    this.overlay?.classList.remove("opacity-0", "translate-y-8", "scale-95");
    this.overlay?.classList.add("opacity-100", "translate-y-0", "scale-100");
  }

  private hide(): void {
    this.overlay?.classList.remove("opacity-100", "translate-y-0", "scale-100");
    this.overlay?.classList.add("opacity-0", "translate-y-8", "scale-95");
  }

  private createUI(): void {
    if (typeof document === "undefined") return;

    this.overlay = document.createElement("div");
    this.overlay.id = "dialogue-overlay";
    this.overlay.className = `
      fixed bottom-12 left-1/2 transform -translate-x-1/2 w-[90%] max-w-2xl
      bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl
      p-6 flex flex-col gap-4 text-white opacity-0 translate-y-8 scale-95
      transition-all duration-500 ease-out z-50
    `.trim();

    // Header with Speaker Badge
    const header = document.createElement("div");
    header.className = "flex items-center gap-3";
    this.overlay.appendChild(header);

    // Speaker Icon/Badge placeholder (optional, can be expanded)
    const speakerBadge = document.createElement("div");
    speakerBadge.className =
      "w-2 h-8 rounded-full bg-gradient-to-b from-[var(--accent-primary)] to-[var(--accent-secondary)]";
    // We can color this dynamically based on speaker if needed, for now it's a generic accent
    speakerBadge.id = "speaker-accent";
    header.appendChild(speakerBadge);

    this.speakerEl = document.createElement("span");
    this.speakerEl.id = "speaker-label";
    this.speakerEl.className =
      "text-xs font-bold uppercase tracking-widest text-white/50 font-sans";
    this.speakerEl.textContent = "UNKNOWN";
    header.appendChild(this.speakerEl);

    // Dialogue Text
    this.textEl = document.createElement("p");
    this.textEl.className =
      "text-lg md:text-xl font-sans font-medium leading-relaxed text-white/90 drop-shadow-sm min-h-[3rem]";
    this.overlay.appendChild(this.textEl);

    // Hint / Continue indicator
    const hint = document.createElement("div");
    hint.id = "dialogue-hint";
    hint.className =
      "absolute bottom-4 right-6 text-[10px] text-white/30 font-sans uppercase tracking-widest animate-pulse transition-opacity duration-300 opacity-0";
    hint.textContent = "Press Space ▶";
    this.overlay.appendChild(hint);

    this.injectStyles();
    document.body.appendChild(this.overlay);
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      
      .cursor::after {
        content: '';
        display: inline-block;
        width: 2px;
        height: 1.2em;
        background: currentColor;
        margin-left: 2px;
        vertical-align: middle;
        animation: blink 1s step-end infinite;
      }

      /* Demon Theme */
      .theme-demon {
        background-color: rgba(20, 0, 0, 0.85) !important;
        border-color: rgba(239, 68, 68, 0.3) !important;
        box-shadow: 0 0 50px rgba(220, 38, 38, 0.15) !important;
      }
      .theme-demon #speaker-accent {
        background: linear-gradient(to bottom, #ef4444, #7f1d1d) !important;
      }
      .theme-demon #speaker-label {
        color: #fca5a5 !important;
        text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
      }
      .theme-demon p {
        color: #fecaca !important;
      }

      /* Wife Theme */
      .theme-wife {
        background-color: rgba(0, 20, 30, 0.85) !important;
        border-color: rgba(34, 211, 238, 0.3) !important;
        box-shadow: 0 0 50px rgba(6, 182, 212, 0.15) !important;
      }
      .theme-wife #speaker-accent {
        background: linear-gradient(to bottom, #22d3ee, #0e7490) !important;
      }
      .theme-wife #speaker-label {
        color: #67e8f9 !important;
        text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
      }
      .theme-wife p {
        color: #ecfeff !important;
      }
    `;
    document.head.appendChild(style);
  }
}
