/* =====================================================================
   CaspAI — sadə chat səhifəsi
   Mesajlar yalnız yaddaşda saxlanır (brauzerdə heç nə yazılmır).
   Bütün mətn textContent ilə göstərilir (XSS qorunması).
   ===================================================================== */
function initCaspAI(root) {
  'use strict';
  var cfg = window.CASPAI || {};
  var configured = cfg.enabled && cfg.api && cfg.api.indexOf('SENIN-ADIN') === -1;

  if (!configured) {
    root.innerHTML = '<div class="cai-soon"><div class="cai-soon-ico">🤖</div><h2>CaspAI tezliklə açılır</h2>' +
      '<p>Azərbaycan dilində AI köməkçimiz hazırlanır. Bu arada <a href="/">digər alətlərimizə</a> baxa bilərsiniz.</p></div>';
    return;
  }

  var MAX_CHARS = 500;
  var history = [];   // {role:'user'|'assistant', content}
  var busy = false;
  var statusUrl = cfg.api.replace(/\/chat\/?$/, '/status');

  root.innerHTML =
    '<div class="cai-app">' +
      '<div class="cai-bar"><div class="cai-bar-in">' +
        '<a class="cai-back" href="/" aria-label="Ana səhifəyə qayıt">← Ana səhifə</a>' +
        '<div class="cai-logo"><svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#0b2a5b"/><path d="M22 7 12 22h7l-2 11 11-16h-7z" fill="#fff"/></svg><span>Casp<b>AI</b></span></div>' +
        '<div class="cai-left" id="caiLeft" aria-live="polite"></div>' +
      '</div></div>' +
      '<div class="cai-log" id="caiLog" role="log" aria-live="polite"><div class="cai-log-in" id="caiLogIn"></div></div>' +
      '<div class="cai-foot"><div class="cai-foot-in">' +
        '<form class="cai-form" id="caiForm">' +
          '<textarea id="caiInput" rows="1" maxlength="' + MAX_CHARS + '" placeholder="Mesaj yaz…" aria-label="Mesaj"></textarea>' +
          '<button class="cai-send" id="caiSend" type="submit" aria-label="Göndər">→</button>' +
        '</form>' +
        '<p class="cai-note">Cavablar yanlış ola bilər. Parol, kart nömrəsi və şəxsi məlumat yazmayın. ' +
        'Mesajlar cavab üçün Google-un AI xidmətinə göndərilir. <a href="/privacy.html">Məxfilik</a></p>' +
      '</div></div>' +
    '</div>';

  var log = root.querySelector('#caiLog'), logIn = root.querySelector('#caiLogIn'),
      input = root.querySelector('#caiInput'), send = root.querySelector('#caiSend'),
      left = root.querySelector('#caiLeft'), form = root.querySelector('#caiForm');

  function setLeft(n) {
    if (typeof n !== 'number') { left.textContent = ''; return; }
    left.textContent = 'Qalan: ' + n;
    left.classList.toggle('zero', n <= 0);
  }

  function bubble(role, text, cls) {
    var b = document.createElement('div');
    b.className = 'cai-msg ' + (role === 'user' ? 'me' : 'ai') + (cls ? ' ' + cls : '');
    b.textContent = text;
    logIn.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  bubble('assistant', 'Salam! Mən CaspAI-yəm. Nə ilə kömək edə bilərəm?');

  var sugg = document.createElement('div');
  sugg.className = 'cai-sugg';
  ['İngilis dili öyrənmək üçün plan hazırla', 'İş müsahibəsinə necə hazırlaşım?', 'Qısa motivasiya mətni yaz'].forEach(function (t) {
    var c = document.createElement('button');
    c.type = 'button'; c.textContent = t;
    c.addEventListener('click', function () { input.value = t; submit(); });
    sugg.appendChild(c);
  });
  logIn.appendChild(sugg);

  // Qalan mesaj sayı (limit istifadə etmir)
  fetch(statusUrl).then(function (r) { return r.json(); })
    .then(function (d) { setLeft(d.remaining); }).catch(function () {});

  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }
  input.addEventListener('input', grow);

  function submit() {
    var text = input.value.trim();
    if (!text || busy) return;
    busy = true; send.disabled = true; input.value = ''; grow(); sugg.hidden = true;
    bubble('user', text);
    history.push({ role: 'user', content: text });
    var wait = bubble('assistant', 'CaspAI yazır…', 'wait');

    fetch(cfg.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-6) })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      var d = res.d || {};
      if (typeof d.remaining === 'number') setLeft(d.remaining);
      if (res.ok && d.reply) {
        wait.textContent = d.reply; wait.classList.remove('wait');
        history.push({ role: 'assistant', content: d.reply });
      } else {
        wait.textContent = d.error || 'Xəta baş verdi. Bir az sonra yenidən yoxla.';
        wait.classList.remove('wait'); wait.classList.add('err');
        history.pop(); // uğursuz sualı tarixçədən çıxar
      }
    }).catch(function () {
      wait.textContent = 'Bağlantı xətası. İnternetini yoxlayıb yenidən cəhd et.';
      wait.classList.remove('wait'); wait.classList.add('err');
      history.pop();
    }).then(function () {
      busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; input.focus();
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
}
