/* =====================================================================
   CaspAI ayarı — AI-ı açmaq üçün yalnız bu faylı dəyiş:
     enabled → true   (api ünvanı artıq yazılıb)
   enabled = false olanda ana səhifədə heç nə görünmür, caspai.html "Tezliklə" göstərir.
   enabled = true olanda ana səhifədə üç şey çıxır:
     1) "Sayt haqqında" bölməsinin ortasında parlayan "CaspAI ilə söhbət et" düyməsi
     2) sağ üstdə qısa CaspAI yazısı
     3) alətlər siyahısının əvvəlində CaspAI kartı
   ===================================================================== */
window.CASPAI = {
  enabled: false,
  api: 'https://caspai.wf-caspai.workers.dev/chat',
  // Sağ üstdəki qısa təsvir. Yoxlana bilməyən iddialar (məs. "ilk", "ən yaxşı") yazma.
  tagline: 'Azərbaycan dilində AI köməkçi'
};

(function () {
  var c = window.CASPAI;
  if (!c.enabled) return;
  var d = document;

  // Stil faylı (yalnız açıq olanda yüklənir)
  var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/caspai.css'; d.head.appendChild(l);

  // 1) "Sayt haqqında" bölməsinin ortasında düymə
  var about = d.querySelector('#about .wrap');
  if (about) {
    var w = d.createElement('div'); w.className = 'cai-cta-wrap';
    w.innerHTML = '<a class="cai-cta" href="/caspai.html"><span class="cai-dots"><i></i><i></i><i></i><i></i></span>' +
      '<span>CaspAI ilə söhbət et</span><span class="cai-arr">→</span></a>';
    about.appendChild(w);
  }

  // 2) Sağ üstdə yazı (üst zolaqda, tema düyməsinin yanında)
  var top = d.querySelector('.topbar .wrap');
  if (top) {
    var a = d.createElement('a'); a.className = 'cai-top'; a.href = '/caspai.html';
    var b = d.createElement('b'); b.textContent = '🤖 CaspAI';
    var s = d.createElement('span'); s.className = 'cai-top-sub'; s.textContent = ' · ' + c.tagline;
    a.appendChild(b); a.appendChild(s);
    top.insertBefore(a, d.getElementById('themeBtn') || null);
  }

  // 3) Alətlər siyahısında kart
  var grid = d.getElementById('grid');
  if (grid) {
    var k = d.createElement('a');
    k.className = 'card reveal'; k.style.setProperty('--d', '0ms'); k.href = '/caspai.html';
    k.setAttribute('data-cat', 'ai');
    k.setAttribute('data-s', 'caspai azərbaycan dilində ai köməkçi süni intellekt chat sual cavab söhbət');
    k.innerHTML = '<span class="new">YENİ</span><div class="ico">🤖</div><span class="tag">🤖 AI</span>' +
      '<h3>CaspAI</h3><p>Azərbaycan dilində AI köməkçi. Sual ver, dərhal cavab al. Gündə 5 pulsuz mesaj.</p>' +
      '<span class="go">Aç <i>→</i></span>';
    grid.insertBefore(k, grid.firstChild);
  }
})();
