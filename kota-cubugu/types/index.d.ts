export type KotaCache = { son: number; ttlMs: number; ctx: number; model?: string; okunan: number; toplam: number; iska: number; neden?: string } | null;
export type KotaPencere = { kind: string; percentUsed: number; resetsAt?: string };

declare module "claude-code" {
  interface PluginState {
    "kota-cubugu": { visible: boolean; limits: KotaPencere[]; frame: number; warned: Record<string, number>; cache: KotaCache };
  }
}
