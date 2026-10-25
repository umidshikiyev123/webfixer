# CaspAI — qurulum təlimatı

Bu qovluq CaspAI-nin "beyni"dir: Gemini API açarını gizli saxlayan və limitləri yoxlayan Cloudflare Worker.
Açar heç vaxt saytın kodunda (GitHub-da) olmur.

## 1. Worker-i yerləşdir (bir dəfə)

1. [Cloudflare](https://dash.cloudflare.com) hesabı aç (pulsuz plan kifayətdir).
2. Kompüterdə Node.js qurulu olsun. Bu qovluqda (`worker/`) terminal aç:
   ```
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY     # Google AI Studio-dan aldığın açarı yapışdır
   npx wrangler secret put IP_SALT            # istənilən uzun təsadüfi mətn
   npx wrangler deploy
   ```
3. `deploy` sonunda ünvan çıxacaq: `https://caspai.XXXX.workers.dev`

## 2. Xərc qorumaları (mütləq et)

- `wrangler.toml`-da `DAILY_GLOBAL = "1500"`: bütün sayt üçün günlük mesaj tavanı. Bu dolanda AI "sabah gəl" deyir. Büdcəyə görə dəyiş.
- `DAILY_PER_IP = "5"`: hər istifadəçiyə günlük pulsuz mesaj.
- Google AI Studio / Google Cloud-da büdcə xəbərdarlığı (budget alert) qur.
- Açar sızarsa, AI Studio-da həmin açarı silib yenisini yarat, sonra `wrangler secret put GEMINI_API_KEY` ilə yenilə.

## 3. Saytda AI-ı aç (bir kliklik iş)

`assets/caspai-config.js` faylında iki dəyişiklik:

```js
window.CASPAI = {
  enabled: true,
  api: 'https://caspai.XXXX.workers.dev/chat'
};
```

Commit et. Ana səhifədə CaspAI kartı çıxacaq, `/caspai.html` işləyəcək.

## 4. Açmazdan əvvəl yoxla

- [ ] `caspai.html` üçün `sitemap.xml`-ə sətir əlavə et:
  `<url><loc>https://webfixer.space/caspai.html</loc><lastmod>YYYY-MM-DD</lastmod><priority>0.8</priority></url>`
- [ ] `privacy.html`-ə qısa bölmə əlavə et (nümunə mətn aşağıdadır).
- [ ] Brauzerdə sına: 5 mesaj göndər, 6-cıda limit mesajını gör.
- [ ] Reklamlar üçün: AdSense təsdiqlənəndən sonra `<body class="ads-off">`-dan `ads-off`-u sil (README-dəki əvvəlki qayda).

### Məxfilik siyasəti üçün nümunə mətn

> **CaspAI (AI köməkçi).** CaspAI-yə yazdığınız mesajlar cavab hazırlamaq üçün Google Gemini xidmətinə göndərilir. Söhbət tarixçəsi serverimizdə saxlanmır. Sui-istifadənin qarşısını almaq üçün günlük mesaj limitini saymaq məqsədilə IP ünvanınızın təsadüfi açarla şifrələnmiş (hash) forması bir gün müddətinə istifadə olunur. Zəhmət olmasa parol, kart nömrəsi və digər şəxsi məlumatı yazmayın.

## Test (isteğe bağlı)

```
curl -s https://caspai.XXXX.workers.dev/status -H "Origin: https://webfixer.space"
```

Cavab: `{"remaining":5,"limit":5}`.

## Qeydlər

- Model `wrangler.toml`-da `MODEL` ilə dəyişir. İlkin dəyər `gemini-2.5-flash-lite`-dir (ən ucuz). Daha yeni Flash-Lite istəsən, Google AI Studio-dakı model siyahısından dəqiq adı yoxla.
- Yalnız `webfixer.space` ünvanından gələn brauzer sorğuları qəbul edilir. Yerli test üçün `EXTRA_ORIGIN` sətrini aç, sonra sil.
- Növbəti addım (trafik artarsa): Cloudflare Turnstile (robot yoxlaması) əlavə etmək.
