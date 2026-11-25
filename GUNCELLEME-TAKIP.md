# Claude Code güncelleme takibi

Modların (ekip, diff-disiplin, kota-cubugu) hangi Claude Code sürümüne kadar gözden geçirildiğinin kaydı.
Haftalık takip bu dosyadaki "son bakılan sürüm"den sonrasını okur.

- **Son bakılan sürüm:** 2.1.332 (25 Kasım 2026)
- **Superpowers:** 7.0.2 (3 Kasım 2026), en güncel
- **Diğer eklentiler:** design 1.2.0, cowork-plugin-management 0.2.2 (claude.ai'den eşitleniyor, kendiliğinden güncellenir); next-steps@claude-community 1.0.0
- **Modların alt sınırı:** `engines["claude-code"] >= 2.1.287`

## Kaynaklar (haftalık takip bunları okur)
- Sürüm notları: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` (tarihli hâli: `https://code.claude.com/docs/en/changelog.md`)
- Mod API'si: her modun `.claude-plugin/types/claude-code/index.d.ts` dosyası (Claude Code her güncellemede yeniden yazar; ilk satır sürümü söyler)
- Mod API belgesi: `https://code.claude.com/docs/en/plugins/mods/reference.md`
- Eklenti pazar yerleri: `claude plugin marketplace update` sonra `claude plugin list`

## Bekleyen fırsatlar (henüz uygulanmadı)
- `$.agent.limits()` ile eşzamanlı ajan sayısını plana yansıtmak (2.1.321–331)
- `$.agent.list()` `idle`/`waiting` durumlarıyla takılı ajan tespiti (2.1.289); şimdiki 8 dk sessizlik tahmini yerine
- `$.ui.notify` ile iş bitince masaüstü bildirimi (2.1.295)
- Agent aracında `effort` parametresi: işçilere kademeye göre efor (2.1.292)
- Doğrulama uyarısı: `agent.offer`, `agent.spawn`, `tool.call` kancalarında `.catch` yok
- Bağlayıcı: Microsoft 365 (SharePoint) bağlı değil; AR-GE Portal SharePoint köprüsü işleri için aday

## 2.1.331 – 2.1.332 sonucu (25 Kasım 2026)
- ekip 0.36.0: tasarım üyelerine oturuma bağlı Figma okuma/aktarma araçları ve Claude Design (DesignSync) veriliyor (`tasarimAraclari`, `$.tool.list()`).
- İzin denetimi ("no verdict") sorunu: 9–25 Kasım kayıtlarında eklentinin doğrudan başlattığı 36 ekip ajanı var, ana modele devir 0.
  2.1.321 sonrası görülmedi; `tool.judge` kancası EKLENMEDİ, devir mekanizması yedek olarak duruyor.
- Resmi "önerilen efor" yok; Fable 5.2 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5 varsayılanı `medium` (model-config belgesi). Danışman medium'da.

## 2.1.307 – 2.1.330 sonucu (23 Kasım 2026)
- ekip: kota hatasında (2.1.327, `error: "rate_limit"` / 429) danışman Opus'a geçmiyor.
- Üç mod: `engines["claude-code"]` alanı (2.1.323).
- Değişmesi gerekmeyenler: `turn.step` takma ad düzeltmesi (2.1.309), modların `$.tool.call`
  izin istemsiz (2.1.321), `$.session.usage()` artık mod model çağrılarını da sayıyor (2.1.325).
- Belirsiz, izlenecek: Code Mode açıkken diff-disiplin'in Write engeli betik içi yazmaları yakalıyor mu.
