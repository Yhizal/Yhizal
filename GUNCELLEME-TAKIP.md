# Claude Code güncelleme takibi

Modların (ekip, diff-disiplin, kota-cubugu) hangi Claude Code sürümüne kadar gözden geçirildiğinin kaydı.
Haftalık takip bu dosyadaki "son bakılan sürüm"den sonrasını okur.

- **Son bakılan sürüm:** 2.1.330 (20 Kasım 2026)
- **Superpowers:** 7.0.2 (3 Kasım 2026), en güncel
- **Modların alt sınırı:** `engines["claude-code"] >= 2.1.287`

## 2.1.307 – 2.1.330 sonucu (23 Kasım 2026)
- ekip: kota hatasında (2.1.327, `error: "rate_limit"` / 429) danışman Opus'a geçmiyor.
- Üç mod: `engines["claude-code"]` alanı (2.1.323).
- Değişmesi gerekmeyenler: `turn.step` takma ad düzeltmesi (2.1.309), modların `$.tool.call`
  izin istemsiz (2.1.321), `$.session.usage()` artık mod model çağrılarını da sayıyor (2.1.325).
- Belirsiz, izlenecek: Code Mode açıkken diff-disiplin'in Write engeli betik içi yazmaları yakalıyor mu.
