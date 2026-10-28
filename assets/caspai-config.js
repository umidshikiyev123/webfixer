/* =====================================================================
   CaspAI ayarı — ana səhifədə CaspAI düyməsini açıb-bağlamaq üçün yalnız bu faylı dəyiş:
     enabled: true   → düymə və kart görünür
     enabled: false  → ana səhifədə CaspAI heç yerdə görünmür
   enabled = true olanda ana səhifədə iki şey çıxır:
     1) yuxarıda "Alətlərə bax" və "Sayt haqqında" arasında loqolu "CaspAI-ı sına" düyməsi
     2) alətlər siyahısının əvvəlində CaspAI kartı
   İkisi də /caspai/ (süni intellekt köməkçisi) səhifəsinə aparır.
   ===================================================================== */
window.CASPAI = {
  // AdSense baxışı bitənə qədər false. Təsdiqdən sonra true et və commit et.
  enabled: true,
  // Düymənin altındakı qısa təsvir.
  tagline: 'Dərsdə, məşqdə, gündəlik sualda — CaspAI ilə danış'
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
    var a = d.createElement('a'); a.className = 'cai-hero'; a.href = '/caspai/';
    a.setAttribute('aria-label', 'CaspAI-ı sına');
    a.innerHTML = '<img src="/assets/caspai-logo.png" alt="CaspAI" width="640" height="203"><span class="cai-hero-t">-ı sına <i>→</i></span>';
    btns.insertBefore(a, btns.children[1] || null);
    var cap = d.createElement('p'); cap.className = 'cai-hero-cap'; cap.textContent = c.tagline;
    btns.parentNode.insertBefore(cap, btns.nextSibling);
  }

  // 2) Alətlər siyahısında kart
  var grid = d.getElementById('grid');
  if (grid) {
    var k = d.createElement('a');
    k.className = 'card reveal'; k.style.setProperty('--d', '0ms'); k.href = '/caspai/';
    k.setAttribute('data-cat', 'ai');
    k.setAttribute('data-s', 'caspai süni intellekt köməkçi chat söhbət dərs idman məşq proqramı sual cavab ai');
    k.innerHTML = '<div class="ico">🤖</div><span class="tag">🤖 AI</span>' +
      '<h3>CaspAI</h3><p>Dərs izahından idman proqramına, gündəlik suallara — CaspAI ilə səmimi söhbət et.</p>' +
      '<span class="go">Danış <i>→</i></span>';
    grid.insertBefore(k, grid.firstChild);
  }
})();
