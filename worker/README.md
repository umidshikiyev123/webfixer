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

## 2. Limitlər və Google kvotası (mütləq et)

Google AI Studio pulsuz səviyyəsində `gemini-3.1-flash-lite` üçün tavan: **15 sorğu/dəq, 250K token/dəq, 500 sorğu/gün**. Bu limit bütün istifadəçilərə birlikdə çatır.

| Dəyişən (`wrangler.toml`) | Dəyər | Məqsəd |
|---|---|---|
| `DAILY_GLOBAL` | 450 | Bütün sayt üçün günlük tavan (500-ə 50 ehtiyat) |
| `RPM_MAX` | 12 | Dəqiqəlik tavan (15-ə 3 ehtiyat) |
| `DAILY_PER_IP` | 5 | Hər istifadəçiyə günlük pulsuz mesaj |
| `AI_ENABLED` | "true" | Kill switch. "false" + `npx wrangler deploy` = AI dərhal söndürülür |

- Gün sərhədi Pasifik vaxtı ilə hesablanır, çünki Google kvotanı oradan sıfırlayır (Bakı vaxtı ilə 11:00, yay vaxtı bitəndən sonra 12:00). Mesajlarda saat avtomatik göstərilir.
- Google 429 qaytarsa, istifadəçinin mesaj hüququ geri qaytarılır və səliqəli mesaj göstərilir.
- Google AI Studio / Google Cloud-da büdcə xəbərdarlığı (budget alert) qur.
- Açar sızarsa, AI Studio-da həmin açarı silib yenisini yarat, sonra `wrangler secret put GEMINI_API_KEY` ilə yenilə.
- Pulsuz səviyyədə sorğular Google tərəfindən məhsulu yaxşılaşdırmaq üçün istifadə oluna bilər. Daha çox trafik gələrsə, AI Studio-da billing aç (limitlər xeyli artır).

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

- Model `wrangler.toml`-da `MODEL` ilə dəyişir. İlkin dəyər `gemini-3.1-flash-lite`-dir. Google köhnə modelləri (məsələn 2.5) yeni hesablar üçün bağlayır, ona görə xəta çıxsa model adını AI Studio-dakı siyahıdan yoxla.
- Yalnız `webfixer.space` ünvanından gələn brauzer sorğuları qəbul edilir. Yerli test üçün `EXTRA_ORIGIN` sətrini aç, sonra sil.
- Növbəti addım (trafik artarsa): Cloudflare Turnstile (robot yoxlaması) əlavə etmək.
