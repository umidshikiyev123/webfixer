/* =====================================================================
   CaspAI ayarı — AI-ı açmaq üçün yalnız bu faylı dəyiş:
     enabled → true   (api ünvanı artıq yazılıb)
   enabled = false olanda ana səhifədə heç nə görünmür, caspai.html "Tezliklə" göstərir.
   enabled = true olanda ana səhifədə iki şey çıxır:
     1) yuxarıda "Alətlərə bax" və "Sayt haqqında" arasında loqolu CaspAI düyməsi
     2) alətlər siyahısının əvvəlində CaspAI kartı
   ===================================================================== */
window.CASPAI = {
  // AdSense baxışı bitənə qədər false. Təsdiqdən sonra true et və commit et.
  enabled: false,
  api: 'https://caspai.wf-caspai.workers.dev/chat',
  // Düymənin altındakı qısa təsvir. Yoxlana bilməyən iddialar (məs. "ilk", "ən yaxşı") yazma.
  tagline: 'Azərbaycan dilində AI köməkçi · gündə 5 pulsuz mesaj'
};

(function () {
  var c = window.CASPAI;
  if (!c.enabled) return;
  var d = document;

  // Stil faylı (yalnız açıq olanda yüklənir)
  var l = d.createElement('link'); l.rel = 'stylesheet'; l.href = '/assets/caspai.css'; d.head.appendChild(l);

  // 1) Ana səhifənin yuxarısında "Alətlərə bax" və "Sayt haqqında" düymələrinin arasında CaspAI düyməsi
  var btns = d.querySelector('.hero .btns');
  if (btns) {
    var a = d.createElement('a'); a.className = 'cai-hero'; a.href = '/caspai.html';
    a.setAttribute('aria-label', 'CaspAI ilə söhbət et');
    a.innerHTML = '<img src="/assets/caspai-logo.png" alt="CaspAI" width="640" height="203"><span class="cai-hero-t">ilə söhbət et <i>→</i></span>';
    btns.insertBefore(a, btns.children[1] || null);
    var cap = d.createElement('p'); cap.className = 'cai-hero-cap'; cap.textContent = c.tagline;
    btns.parentNode.insertBefore(cap, btns.nextSibling);
  }

  // 2) Alətlər siyahısında kart
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
