export interface DialogueLine {
  speaker?: string;
  text: string;
  duration?: number;
  sound?: string;
}

export interface Dialogue {
  id: string;
  lines: DialogueLine[];
}

export class DialogueManager {
  private static instance: DialogueManager;
  private dialogues: Map<string, Dialogue> = new Map();
  private currentDialogue?: Dialogue;
  private currentLineIndex: number = 0;
  private isPlaying: boolean = false;
  private timeoutId?: number;

  public onLineStart?: (line: DialogueLine) => void;
  public onLineEnd?: () => void;
  public onDialogueEnd?: () => void;

  private constructor() {}

  public static getInstance(): DialogueManager {
    if (!DialogueManager.instance) {
      DialogueManager.instance = new DialogueManager();
    }
    return DialogueManager.instance;
  }

  public register(dialogue: Dialogue): void {
    this.dialogues.set(dialogue.id, dialogue);
  }

  public play(id: string): void {
    const dialogue = this.dialogues.get(id);
    if (!dialogue) return;

    this.currentDialogue = dialogue;
    this.currentLineIndex = 0;
    this.isPlaying = true;
    this.showNextLine();
  }

  private showNextLine(): void {
    if (
      !this.currentDialogue ||
      this.currentLineIndex >= this.currentDialogue.lines.length
    ) {
      this.end();
      return;
    }

    const line = this.currentDialogue.lines[this.currentLineIndex];
    if (!line) {
      this.end();
      return;
    }

    this.onLineStart?.(line);

    const duration = line.duration ?? 3000;
    this.timeoutId = setTimeout(() => {
      this.onLineEnd?.();
      this.currentLineIndex++;
      this.showNextLine();
    }, duration) as unknown as number;
  }

  private end(): void {
    this.isPlaying = false;
    this.onDialogueEnd?.();
    this.currentDialogue = undefined;
  }

  public skip(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.onLineEnd?.();
    this.currentLineIndex++;
    this.showNextLine();
  }

  public isActive(): boolean {
    return this.isPlaying;
  }
}
