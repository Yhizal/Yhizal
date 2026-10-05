export type KotaPencere = { kind: string; percentUsed: number; resetsAt?: string };

declare module "claude-code" {
  interface PluginState {
    "kota-cubugu": { visible: boolean; limits: KotaPencere[]; frame: number; warned: Record<string, number> };
  }
}
