/* =====================================================================
   CaspAI — Cloudflare Worker (Gemini proxy)
   - Gemini API açarı yalnız burada (secret) saxlanır, brauzerə çıxmır
   - Gündə IP başına limit + bütün sayt üçün günlük ümumi limit (büdcə qoruması)
   - Limitlər Durable Object-də atomik sayılır (pulsuz planda işləyir)
   - CaspAI səmimi ümumi köməkçidir (dərs, idman/məşq, gündəlik suallar, söhbət) — fakt-yoxlama/axtarış yoxdur
   ===================================================================== */

const ALLOWED_ORIGINS = ['https://webfixer.space', 'https://www.webfixer.space'];

const SYSTEM_PROMPT = `Sən CaspAI-san — WebFixer (webfixer.space) saytının səmimi Azərbaycan dilli süni intellekt dostusan. İnsanlara idman/məşq proqramlarında, dərs və mövzu izahında, gündəlik sadə suallarda (qida tərkibi, vahid çevirmə, praktik hesab və s.) kömək edirsən, sadəcə söhbət etmək istəyənlərlə də səmimi danışırsan.
Özünü həmişə "CaspAI" adı ilə təqdim et. Hansı model, şirkət və ya texnologiya əsasında işlədiyin soruşulsa, bu texniki təfərrüatları paylaşmadığını nəzakətlə de və kömək etməyə davam et. Heç vaxt yalan danışma: başqa şirkət və ya model adı uydurma, "sıfırdan öyrədilmişəm" demə, insan olduğunu iddia etmə. İstifadəçi ciddi şəkildə insan, yoxsa AI olduğunu soruşsa, AI olduğunu de.
Qaydalar:
- Əsasən Azərbaycan dilində, isti və səmimi (dost kimi, amma hörmətli) tonda yaz. İstifadəçi başqa dildə yazsa, həmin dildə cavab ver.
- Söhbətin tarixçəsinə (yuxarıdakı əvvəlki mesajlara) həmişə bax və onu yadında saxla: istifadəçinin adını, dediyi detalları, əvvəl soruşduğu şeyləri unutma, lazım gələndə onlara istinad et.
- Salamlaşma və özünü təqdim etməni YALNIZ söhbətin həqiqətən İLK mesajında, istifadəçi salam yazandasa et — bir dəfə, qısa. Əgər aşağıda artıq əvvəlki mesajlar (sənin öz cavabların da daxil) varsa, bu söhbət artıq davam edir deməkdir: BİR DAHA ƏSLA salamlaşma, özünü təqdim etmə, "Mən CaspAI-yam" kimi cümlə qurma — hər dəfə birbaşa sualın cavabına keç, elə bil tanış biriylə davam edən söhbətdəsən.
- Sualın növünə uyğunlaş: idman/məşq sualına real və səviyyəyə uyğun proqram (gün-gün, set/təkrar) ver; dərs/mövzu sualını sadə dildə, nümunə ilə izah et; gündəlik sadə fakt sualına (qida tərkibi, vahid çevirmə və s.) birbaşa, dəqiq cavab ver; sadəcə söhbətə təbii və maraqla cavab ver.
- Son günlərin/ayların hadisələrini (məs. güncəl idman nəticələri, xəbərlər) dəqiq bilməyə bilərsən — belə olanda bunu açıq de, uydurma cavab vermə.
- Qısa-orta uzunluqda yaz (adətən 1-4 abzas); məşq proqramı kimi strukturlu cavablarda siyahı/nömrələmə işlət.
- Format: LaTeX və $...$ işlətmə, başlıq (#) və cədvəl işlətmə. Düsturları adi mətnlə yaz, məsələn: v = v₀ + a·t, s = v₀·t + a·t²/2, v² − v₀² = 2·a·s. Qalın üçün yalnız **...**, siyahı üçün "- " və ya "1." işlət.
- Bilmədiyin şeyi bilmədiyini de, fakt və mənbə uydurma.
- Parol, kart nömrəsi, ünvan, şəxsi sənəd məlumatı istəmə. İstifadəçi belə məlumat yazsa, bunu etməməyi nəzakətlə xatırlat.
- Tibbi (o cümlədən məşq/qida), hüquqi və maliyyə mövzularında ehtiyatlı ol, ümumi məlumat ver və ciddi hallarda mütəxəssisə müraciəti tövsiyə et.
- Zərərli, qeyri-qanuni, 18+ və ya nifrət məzmunlu istəklərdən nəzakətlə imtina et.
- Uyğun olanda WebFixer alətlərini (BMI hesablayıcı, pomodoro taymer, GPA hesablayıcı, yaş hesablayıcı, mətn alətləri və s.) tövsiyə et.`;

const MAX_MESSAGES = 6;      // modelə göndərilən son mesaj sayı (xərcə qənaət)
const MAX_USER_CHARS = 500;  // bir mesajın maksimum uzunluğu
const MAX_MODEL_CHARS = 1500; // tarixçədəki köhnə cavablar bu qədər kəsilir

function num(v, d) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; }

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(origin ? corsHeaders(origin) : {}) },
  });
}

// Google Gemini gündəlik kvotanı Pasifik vaxtı ilə gecə yarısı sıfırlayır.
// Bizim sayğac da eyni pəncərəyə uyğun olsun deyə gün açarı Pasifik vaxtı ilə hesablanır
// (yoxsa Bakı gecə yarısı sıfırlanan sayğac Google-un 500/gün tavanını aşa bilər).
const GOOGLE_TZ = 'America/Los_Angeles';

function laDay(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GOOGLE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function dayKey() {
  return laDay(Date.now());
}

// Kvotanın yenilənmə saatı, Bakı vaxtı ilə (məs. "11:00"; yay vaxtı bitəndən sonra "12:00")
function resetTimeBaku() {
  const now = Date.now();
  const d0 = laDay(now);
  let t = now;
  for (let i = 0; i < 100 && laDay(t) === d0; i++) t += 15 * 60 * 1000;
  t = Math.floor(t / 3600000) * 3600000; // Pasifik ofsetləri tam saatdır
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t));
}

async function hashIp(ip, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function limiter(env, body) {
  const stub = env.LIMITER.get(env.LIMITER.idFromName('main'));
  const r = await stub.fetch('https://limiter/', { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m.content !== 'string') return null;
    const role = m.role === 'user' ? 'user' : m.role === 'assistant' || m.role === 'model' ? 'model' : null;
    if (!role) return null;
    const limit = role === 'user' ? MAX_USER_CHARS : MAX_MODEL_CHARS;
    const text = m.content.trim().slice(0, limit);
    if (!text) return null;
    out.push({ role, parts: [{ text }] });
  }
  // Gemini söhbəti "user" ilə başlamalı və "user" ilə bitməlidir
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const extra = env.EXTRA_ORIGIN ? [env.EXTRA_ORIGIN] : [];
    const allowed = ALLOWED_ORIGINS.concat(extra).includes(origin);

    if (req.method === 'OPTIONS') {
      return allowed ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (!allowed) return json({ error: 'İcazə yoxdur.' }, 403);

    const perIp = num(env.DAILY_PER_IP, 5);
    // Google pulsuz səviyyə (Gemini 3.1 Flash Lite): 500 sorğu/gün, 15 sorğu/dəq. Ehtiyat saxlayırıq.
    const globalMax = num(env.DAILY_GLOBAL, 450);
    const rpmMax = num(env.RPM_MAX, 12);
    const enabled = String(env.AI_ENABLED == null ? 'true' : env.AI_ENABLED).toLowerCase() !== 'false';
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hashIp(ip, env.IP_SALT || 'caspai');
    const day = dayKey();
    const resetAt = resetTimeBaku();

    // Qalan mesaj sayını göstərmək üçün (limit istifadə etmir)
    if (url.pathname === '/status' && req.method === 'GET') {
      if (!enabled) return json({ enabled: false, remaining: 0, limit: perIp }, 200, origin);
      const s = await limiter(env, { action: 'status', ipHash, day, perIp, globalMax, rpmMax });
      return json({ enabled: true, remaining: s.remaining, limit: perIp, resetAt }, 200, origin);
    }

    if (url.pathname !== '/chat' || req.method !== 'POST') return json({ error: 'Tapılmadı.' }, 404, origin);
    // Kill switch: wrangler.toml-da AI_ENABLED = "false" yazıb deploy etsən, AI dərhal söndürülür
    if (!enabled) return json({ error: 'CaspAI hazırda təkmilləşdirilir. Tezliklə yenidən aktiv olacaq.', reason: 'disabled', remaining: 0 }, 503, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'Xidmət hələ qurulmayıb.' }, 500, origin);

    let payload;
    try { payload = await req.json(); } catch { return json({ error: 'Yanlış sorğu.' }, 400, origin); }
    const contents = cleanMessages(payload && payload.messages);
    if (!contents) return json({ error: 'Mesaj boşdur və ya yanlışdır.' }, 400, origin);

    // Limiti Gemini-yə getməzdən ƏVVƏL sayırıq ki, sorğu spamı pul xərcləməsin
    const gate = await limiter(env, { action: 'take', ipHash, day, perIp, globalMax, rpmMax });
    if (!gate.ok) {
      const msgs = {
        global: `Bu günlük pulsuz AI kvotası başa çatdı. Kvota Bakı vaxtı ilə saat ${resetAt}-da yenilənir. Bu vaxt WebFixer-in digər alətlərindən istifadə edə bilərsiniz.`,
        ip: `Bu gün üçün ${perIp} pulsuz mesajınızı istifadə etmisiniz. CaspAI ilkin mərhələdə hər istifadəçiyə gündə ${perIp} mesaj təklif edir ki, xidmət hamı üçün sabit qalsın. Limit Bakı vaxtı ilə saat ${resetAt}-da yenilənir.`,
        rpm: 'Hazırda sorğuların sayı çoxdur. Zəhmət olmasa 1 dəqiqə sonra yenidən cəhd edin.',
      };
      const status = 429;
      const res = json({ error: msgs[gate.reason] || msgs.ip, remaining: gate.remaining || 0, reason: gate.reason, resetAt }, status, origin);
      if (gate.reason === 'rpm') res.headers.set('Retry-After', '30');
      return res;
    }

    // Tarixçədə artıq öz cavabımız (model rolu) varsa, bu ilk mesaj DEYİL —
    // modelə bunu açıq-aydın deyirik ki, təlimata deyil, faktiki vəziyyətə güvənsin
    // (kiçik modellər təkcə təlimatdan "bu davam edən söhbətdir" nəticəsini hər vaxt çıxara bilmir)
    const isFirstTurn = !contents.some((c) => c.role === 'model');
    const turnNote = isFirstTurn
      ? 'VƏZİYYƏT: Bu, söhbətin İLK mesajıdır.'
      : 'VƏZİYYƏT: Bu, söhbətin İLK mesajı DEYİL — yuxarıda artıq əvvəlki mesajlar var. Əsla yenidən salamlaşma və ya özünü təqdim etmə, birbaşa cavaba keç.';
    const systemText = SYSTEM_PROMPT + '\n\n' + turnNote;

    const model = env.MODEL || 'gemini-3.1-flash-lite';
    // Bu timer yalnız Gemini-ə QOŞULMA mərhələsini (ilk başlıqlar gələnə qədər) məhdudlaşdırır.
    // Axın (stream) başlayandan sonra təmizlənir ki, uzun cavablar yarımçıq kəsilməsin.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    let connected = false;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { maxOutputTokens: num(env.MAX_OUTPUT, 1536), temperature: 0.7 },
        }),
        signal: ctl.signal,
      });
      if (r.status === 429) {
        // Google limiti dolub: istifadəçinin hüququnu geri qaytar, səliqəli mesaj göstər
        await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax, rpmMax });
        console.error('gemini 429 (Google kvotası)');
        const res = json({ error: 'Hazırda sorğuların sayı çoxdur. Zəhmət olmasa 1 dəqiqə sonra yenidən cəhd edin.', reason: 'rpm', remaining: gate.remaining + 1, resetAt }, 429, origin);
        res.headers.set('Retry-After', '30');
        return res;
      }
      if (r.status === 503) {
        // Gemini hazırda yüklənib (503): istifadəçinin hüququnu geri qaytar və 1 dəqiqə sonra yoxlamağı söylə
        await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax, rpmMax });
        console.error('gemini 503 (model yüklənib)');
        const res = json({ error: 'Süni intellekt xidməti hazırda yüklənib. Zəhmət olmasa 1 dəqiqə sonra yenidən yoxlayın.', reason: 'overloaded', remaining: gate.remaining + 1, resetAt }, 503, origin);
        res.headers.set('Retry-After', '60');
        return res;
      }
      if (!r.ok || !r.body) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 300));

      // Başlıqlar gəldi, bağlantı quruldu — artıq qoşulma timerini saxlamağa ehtiyac yoxdur
      connected = true;
      clearTimeout(timer);

      // Gemini-nin SSE axınını özümüzün sadə {delta}/{error}/{done} formatına çeviririk
      const upstream = r.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';
      let fullText = '';
      let upstreamErr = null;
      let sawAnyEvent = false;

      const stream = new ReadableStream({
        async pull(controller) {
          while (true) {
            const { done, value } = await upstream.read();
            if (done) {
              // Oxunub bitməyən qalıq var — son hadisə bufferdə qalmış ola bilər (ayırıcı gəlməyib deyə)
              if (buffer.trim()) {
                const line = buffer.split('\n').find((l) => l.startsWith('data:'));
                if (line) {
                  try {
                    const obj = JSON.parse(line.slice(5).trim());
                    const cparts = (obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts) || [];
                    const text = cparts.map((p) => p.text || '').join('');
                    if (text) { fullText += text; controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: text }) + '\n\n')); }
                    if (obj.error) upstreamErr = obj.error.message || JSON.stringify(obj.error);
                  } catch { /* yarımçıq JSON, keç */ }
                }
              }
              if (!fullText.trim()) {
                await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax, rpmMax });
                console.error('caspai: boş cavab. sawAnyEvent=' + sawAnyEvent + ' upstreamErr=' + upstreamErr);
                const msg = upstreamErr
                  ? 'Süni intellekt xidmətindən xəta gəldi: ' + upstreamErr
                  : 'Bu sual üçün cavab verə bilmədim. Başqa cür yazmağı yoxla.';
                controller.enqueue(encoder.encode('data: ' + JSON.stringify({ error: msg }) + '\n\n'));
              }
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ done: true, remaining: gate.remaining }) + '\n\n'));
              controller.close();
              return;
            }
            // Google-un SSE ayırıcısı bəzən CRLF (\r\n\r\n) ola bilir — LF-ə normallaşdırırıq ki, "\n\n" axtarışı həmişə tutsun
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            let idx;
            let emitted = false;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              const line = rawEvent.split('\n').find((l) => l.startsWith('data:'));
              if (!line) continue;
              const jsonStr = line.slice(5).trim();
              if (!jsonStr) continue;
              sawAnyEvent = true;
              let obj;
              try { obj = JSON.parse(jsonStr); } catch { continue; }
              if (obj.error) { upstreamErr = obj.error.message || JSON.stringify(obj.error); continue; }
              const cparts = (obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts) || [];
              const text = cparts.map((p) => p.text || '').join('');
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: text }) + '\n\n'));
                emitted = true;
              }
            }
            if (emitted) return; // bir pull-da bir qədər mətn göndərib brauzerə nəfəs ver
          }
        },
        async cancel() { try { await upstream.cancel(); } catch {} },
      });

      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', ...corsHeaders(origin) },
      });
    } catch (e) {
      if (!connected) await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax, rpmMax });
      console.error(String(e));
      return json({ error: 'CaspAI indi cavab verə bilmir. Bir az sonra yenidən yoxla.', remaining: gate.remaining + 1 }, 502, origin);
    } finally {
      clearTimeout(timer);
    }
  },
};

/* ---------- Durable Object: atomik günlük sayğaclar ---------- */
export class Limiter {
  constructor(state) { this.state = state; }

  async fetch(req) {
    const { action, ipHash, day, perIp, globalMax, rpmMax } = await req.json();
    const st = this.state.storage;

    // Yeni gün başlayıbsa köhnə sayğacları sil (yaddaş böyüməsin)
    if ((await st.get('day')) !== day) { await st.deleteAll(); await st.put('day', day); }

    const ipKey = 'ip:' + ipHash;
    const ipN = (await st.get(ipKey)) || 0;
    const gN = (await st.get('g')) || 0;
    const reply = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

    // Dəqiqəlik pəncərə (Google: 15 sorğu/dəq; biz 12-də dayanırıq)
    const minute = Math.floor(Date.now() / 60000);
    const mKey = (await st.get('m')) === minute ? 'mn' : null;
    const mN = mKey ? (await st.get('mn')) || 0 : 0;

    if (action === 'status') return reply({ remaining: gN >= globalMax ? 0 : Math.max(0, perIp - ipN) });
    if (action === 'refund') {
      const o = { [ipKey]: Math.max(0, ipN - 1), g: Math.max(0, gN - 1) };
      if (mKey) o.mn = Math.max(0, mN - 1);
      await st.put(o);
      return reply({ ok: true });
    }
    // take
    if (gN >= globalMax) return reply({ ok: false, reason: 'global', remaining: 0 });
    if (ipN >= perIp) return reply({ ok: false, reason: 'ip', remaining: 0 });
    if (mN >= (rpmMax || 12)) return reply({ ok: false, reason: 'rpm', remaining: Math.max(0, perIp - ipN) });
    await st.put({ [ipKey]: ipN + 1, g: gN + 1, m: minute, mn: mN + 1 });
    return reply({ ok: true, remaining: perIp - ipN - 1 });
  }
}
