export type DiffDisiplinTurn = { startedAt: number; kat?: string; adim?: number } | null;
export type DiffDisiplinOrnek = { d: number; s: number; z: number };

declare module "claude-code" {
  interface PluginState {
    "diff-disiplin": { enabled: boolean; injected: number; turn: DiffDisiplinTurn; frame: number; blocked: number; edits: number; allowWrite: boolean; bellek: Record<string, DiffDisiplinOrnek[]>; kat: string };
  }
}
