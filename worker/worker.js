/* =====================================================================
   CaspAI — Cloudflare Worker (Gemini proxy)
   - Gemini API açarı yalnız burada (secret) saxlanır, brauzerə çıxmır
   - Gündə IP başına limit + bütün sayt üçün günlük ümumi limit (büdcə qoruması)
   - Limitlər Durable Object-də atomik sayılır (pulsuz planda işləyir)
   ===================================================================== */

const ALLOWED_ORIGINS = ['https://webfixer.space', 'https://www.webfixer.space'];

const SYSTEM_PROMPT = `Sən CaspAI-san — WebFixer (webfixer.space) saytının Azərbaycan dilində AI köməkçisisən.
Texnoloji olaraq Google Gemini modeli əsasında işləyirsən. Kim olduğun və ya hansı modeldə işlədiyin soruşulsa, bunu dürüst de: "Mən WebFixer-in CaspAI köməkçisiyəm, Google Gemini əsasında işləyirəm." Başqa şirkət və ya model adı uydurma, "sıfırdan öyrədilmişəm" demə.
Qaydalar:
- Əsasən Azərbaycan dilində cavab ver. İstifadəçi başqa dildə yazsa, həmin dildə cavab ver.
- Qısa, aydın və nəzakətli ol (adətən 1-3 qısa abzas). Lazım olanda qısa siyahı işlət.
- Bilmədiyin şeyi bilmədiyini de, fakt və mənbə uydurma.
- Parol, kart nömrəsi, ünvan, şəxsi sənəd məlumatı istəmə. İstifadəçi belə məlumat yazsa, bunu etməməyi nəzakətlə xatırlat.
- Tibbi, hüquqi və maliyyə mövzularında ehtiyatlı ol, ümumi məlumat ver və mütəxəssisə müraciəti tövsiyə et.
- Zərərli, qeyri-qanuni, 18+ və ya nifrət məzmunlu istəklərdən nəzakətlə imtina et.
- Uyğun olanda WebFixer alətlərini (QR kod, parol generatoru, şəkil ölçüsü, faiz hesablayıcı, yaş hesablayıcı, mətn alətləri və s.) tövsiyə et.`;

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

// Bakı vaxtı ilə günün açarı (YYYY-MM-DD) — limit hər gecə yarısı sıfırlanır
function dayKey() {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
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
    const globalMax = num(env.DAILY_GLOBAL, 1500);
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hashIp(ip, env.IP_SALT || 'caspai');
    const day = dayKey();

    // Qalan mesaj sayını göstərmək üçün (limit istifadə etmir)
    if (url.pathname === '/status' && req.method === 'GET') {
      const s = await limiter(env, { action: 'status', ipHash, day, perIp, globalMax });
      return json({ remaining: s.remaining, limit: perIp }, 200, origin);
    }

    if (url.pathname !== '/chat' || req.method !== 'POST') return json({ error: 'Tapılmadı.' }, 404, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'Server hələ qurulmayıb.' }, 500, origin);

    let payload;
    try { payload = await req.json(); } catch { return json({ error: 'Yanlış sorğu.' }, 400, origin); }
    const contents = cleanMessages(payload && payload.messages);
    if (!contents) return json({ error: 'Mesaj boşdur və ya yanlışdır.' }, 400, origin);

    // Limiti Gemini-yə getməzdən ƏVVƏL sayırıq ki, sorğu spamı pul xərcləməsin
    const gate = await limiter(env, { action: 'take', ipHash, day, perIp, globalMax });
    if (!gate.ok) {
      const msg = gate.reason === 'global'
        ? 'Bu gün CaspAI-nin ümumi limiti doldu. Sabah yenidən gəl!'
        : `Bu gün üçün ${perIp} pulsuz mesajın bitdi. Sabah yenidən gəl!`;
      return json({ error: msg, remaining: 0, reason: gate.reason }, 429, origin);
    }

    const model = env.MODEL || 'gemini-2.5-flash-lite';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: num(env.MAX_OUTPUT, 600), temperature: 0.7 },
        }),
        signal: ctl.signal,
      });
      if (!r.ok) throw new Error('gemini ' + r.status);
      const data = await r.json();
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const reply = parts.map((p) => p.text || '').join('').trim();
      if (!reply) {
        await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax });
        return json({ error: 'Bu sual üçün cavab verə bilmədim. Başqa cür yazmağı yoxla.', remaining: gate.remaining + 1 }, 200, origin);
      }
      return json({ reply, remaining: gate.remaining }, 200, origin);
    } catch (e) {
      await limiter(env, { action: 'refund', ipHash, day, perIp, globalMax });
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
    const { action, ipHash, day, perIp, globalMax } = await req.json();
    const st = this.state.storage;

    // Yeni gün başlayıbsa köhnə sayğacları sil (yaddaş böyüməsin)
    if ((await st.get('day')) !== day) { await st.deleteAll(); await st.put('day', day); }

    const ipKey = 'ip:' + ipHash;
    const ipN = (await st.get(ipKey)) || 0;
    const gN = (await st.get('g')) || 0;
    const reply = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

    if (action === 'status') return reply({ remaining: gN >= globalMax ? 0 : Math.max(0, perIp - ipN) });
    if (action === 'refund') {
      await st.put({ [ipKey]: Math.max(0, ipN - 1), g: Math.max(0, gN - 1) });
      return reply({ ok: true });
    }
    // take
    if (gN >= globalMax) return reply({ ok: false, reason: 'global', remaining: 0 });
    if (ipN >= perIp) return reply({ ok: false, reason: 'ip', remaining: 0 });
    await st.put({ [ipKey]: ipN + 1, g: gN + 1 });
    return reply({ ok: true, remaining: perIp - ipN - 1 });
  }
}
