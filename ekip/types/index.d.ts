export type EkipKosu = {
  id: string; tip: string; aciklama: string; model?: string;
  baslangic: number; bitis?: number;
  durum: "calisiyor" | "bitti" | "hata" | "iptal";
  cikti?: string;
  adim?: number;
  tur?: number;
};
export type EkipDanisman = { soru: string; cevap?: string; durum: "bekliyor" | "bitti" | "hata"; not?: string } | null;
export type EkipTaslak =
  | null
  | { durum: "hazirlaniyor"; hedef: string }
  | { durum: "hata"; hedef: string; hata: string }
  | { durum: "hazir"; hedef: string; ad: string; amac: string; not?: string; uyeler: Array<{ name: string; description: string; prompt: string; tools: string[]; model: string; gorev: string; [k: string]: unknown }> };
export type EkipTur = null | { no: number; durum: "calisiyor" | "degerlendiriliyor" | "bitti" | "durduruldu" };
export type EkipMod =
  | null
  | { tur: "gorev"; uye: string }
  | { tur: "soru" | "ekip" | "yeni" | "uye" | "cikar" | "kur" };

declare module "claude-code" {
  interface PluginState {
    ekip: { kosular: EkipKosu[]; danisman: EkipDanisman; mod: EkipMod; frame: number; aktif: string; surum: number; incelemeId: string | null; taslak: EkipTaslak; tur: EkipTur; adimBellek: Record<string, Array<{ s: number; d: number }>> };
  }
}
