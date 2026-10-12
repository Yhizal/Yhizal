# yusuf-mods: kurulum

Üç Claude Code modu: **ekip** (ajan ekibi paneli), **diff-disiplin** (yalnız diff + iş tahmini), **kota-cubugu** (kota ve önbellek çubuğu).

## Başka bir bilgisayar (Windows / macOS / Linux)

```bash
claude plugin marketplace add Yhizal/Yhizal
claude plugin install ekip@yusuf-mods
claude plugin install diff-disiplin@yusuf-mods
claude plugin install kota-cubugu@yusuf-mods
```

Kurulumdan sonra Claude Code'u (ya da Desktop'u) yeniden başlat. Güncellemek için:

```bash
claude plugin marketplace update yusuf-mods
claude plugin update ekip@yusuf-mods
```

Depo herkese açık olduğu için giriş yapmak gerekmez. Eklentiler kullanıcı hesabına ait ayarlara kurulur; her bilgisayarda bir kez yapılır.

## Claude web (claude.ai/code, bulut oturumları)

Bulut oturumları kendi ortamında çalışır; senin yerel ayarlarını görmez. Eklentiyi bir projede kullanmak için o projenin deposuna `.claude/settings.json` ekle:

```json
{
  "extraKnownMarketplaces": {
    "yusuf-mods": { "source": { "source": "github", "repo": "Yhizal/Yhizal" } }
  },
  "enabledPlugins": {
    "ekip@yusuf-mods": true,
    "diff-disiplin@yusuf-mods": true,
    "kota-cubugu@yusuf-mods": true
  }
}
```

Not: paneller ve çubuklar uygulama arayüzü hook'ları kullanır. Web oturumunda hangilerinin çizildiği oraya göre değişir; `ekip` kararları ve `diff-disiplin` kuralı arayüzden bağımsız çalışır.

## Canlı geliştirme (yalnız geliştirme bilgisayarı)

Depoyu klonla ve klasörleri izle; dosya değişince mod yeniden yüklenir, yeniden başlatma gerekmez:

```bash
git clone https://github.com/Yhizal/Yhizal.git yusuf-mods
```

`~/.claude/settings.json` içinde:

```json
{ "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/yol/yusuf-mods/ekip;/yol/yusuf-mods/diff-disiplin;/yol/yusuf-mods/kota-cubugu",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
```

Aynı eklentiyi hem pazar yerinden hem klasörden yükleme: pazar yeri kopyasını `enabledPlugins` içinde `false` yap.
