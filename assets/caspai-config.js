/* =====================================================================
   CaspAI ayarı — AI-ı açmaq üçün yalnız bu faylı dəyiş:
     1) api  → Cloudflare Worker ünvanın (sonu /chat ilə bitir)
     2) enabled → true
   enabled = false olanda ana səhifədə kart görünmür, caspai.html "Tezliklə" göstərir.
   ===================================================================== */
window.CASPAI = {
  enabled: false,
  api: 'https://caspai.SENIN-ADIN.workers.dev/chat'
};

/* Açıqdırsa, ana səhifənin alət siyahısının əvvəlinə CaspAI kartını əlavə et */
(function () {
  if (!window.CASPAI.enabled) return;
  var grid = document.getElementById('grid');
  if (!grid) return;
  var a = document.createElement('a');
  a.className = 'card reveal';
  a.style.setProperty('--d', '0ms');
  a.href = '/caspai.html';
  a.setAttribute('data-cat', 'ai');
  a.setAttribute('data-s', 'caspai azərbaycan dilində ai köməkçi süni intellekt chat sual cavab gemini söhbət');
  a.innerHTML = '<span class="new">YENİ</span><div class="ico">🤖</div><span class="tag">🤖 AI</span>' +
    '<h3>CaspAI</h3><p>Azərbaycan dilində AI köməkçi. Sual ver, dərhal cavab al. Gündə 5 pulsuz mesaj.</p>' +
    '<span class="go">Aç <i>→</i></span>';
  grid.insertBefore(a, grid.firstChild);
})();
