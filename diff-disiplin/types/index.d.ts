export type DiffDisiplinTurn = { startedAt: number } | null;

declare module "claude-code" {
  interface PluginState {
    "diff-disiplin": { enabled: boolean; injected: number; turn: DiffDisiplinTurn; durations: number[]; frame: number; blocked: number; edits: number; allowWrite: boolean };
  }
}
