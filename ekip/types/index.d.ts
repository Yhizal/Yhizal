export type EkipKosu = {
  id: string; tip: string; aciklama: string; model?: string;
  baslangic: number; bitis?: number;
  durum: "calisiyor" | "bitti" | "hata" | "iptal";
  cikti?: string;
};
export type EkipDanisman = { soru: string; cevap?: string; durum: "bekliyor" | "bitti" | "hata"; not?: string } | null;
export type EkipMod =
  | null
  | { tur: "gorev"; uye: string }
  | { tur: "soru" | "ekip" | "yeni" | "uye" | "cikar" };

declare module "claude-code" {
  interface PluginState {
    ekip: { kosular: EkipKosu[]; danisman: EkipDanisman; mod: EkipMod; frame: number; aktif: string; surum: number; incelemeId: string | null };
  }
}
