/* =====================================================================
   CaspAI — chat səhifəsinin skripti
   Mesajlar yalnız yaddaşda saxlanır (brauzerdə heç nə yazılmır).
   Bütün mətn textContent ilə göstərilir (XSS qorunması).
   ===================================================================== */
function initCaspAI(root) {
  'use strict';
  var cfg = window.CASPAI || {};
  var configured = cfg.enabled && cfg.api && cfg.api.indexOf('SENIN-ADIN') === -1;

  if (!configured) {
    root.innerHTML = '<div class="cai-soon"><div class="cai-soon-ico">🤖</div><h2>CaspAI tezliklə açılır</h2>' +
      '<p>Azərbaycan dilində AI köməkçimiz hazırlanır. Bu arada <a href="/#tools">digər alətlərimizə</a> baxa bilərsiniz.</p></div>';
    return;
  }

  var MAX_CHARS = 500;
  var history = [];           // {role:'user'|'assistant', content}
  var busy = false;
  var statusUrl = cfg.api.replace(/\/chat\/?$/, '/status');

  root.innerHTML =
    '<div class="cai">' +
      '<div class="cai-head"><div><b>🤖 CaspAI</b><span class="cai-badge">Gemini əsasında</span></div>' +
      '<div class="cai-left" id="caiLeft" aria-live="polite"></div></div>' +
      '<div class="cai-log" id="caiLog" role="log" aria-live="polite"></div>' +
      '<div class="cai-sugg" id="caiSugg"></div>' +
      '<form class="cai-form" id="caiForm">' +
        '<textarea id="caiInput" rows="2" maxlength="' + MAX_CHARS + '" placeholder="Sualını yaz… (Enter — göndər, Shift+Enter — yeni sətir)" aria-label="Mesaj"></textarea>' +
        '<button class="btn" id="caiSend" type="submit">Göndər</button>' +
      '</form>' +
      '<p class="cai-note">Cavablar yanlış ola bilər, vacib məsələlərdə yoxlayın. Parol, kart nömrəsi və şəxsi məlumat yazmayın. ' +
      'Mesajlarınız cavab hazırlamaq üçün Google Gemini-yə göndərilir.</p>' +
    '</div>';

  var log = root.querySelector('#caiLog'), input = root.querySelector('#caiInput'),
      send = root.querySelector('#caiSend'), left = root.querySelector('#caiLeft'),
      sugg = root.querySelector('#caiSugg'), form = root.querySelector('#caiForm');

  function setLeft(n) {
    if (typeof n !== 'number') { left.textContent = ''; return; }
    left.textContent = 'Bu gün qalan: ' + n + ' mesaj';
    left.classList.toggle('zero', n <= 0);
  }

  function bubble(role, text, cls) {
    var b = document.createElement('div');
    b.className = 'cai-msg ' + (role === 'user' ? 'me' : 'ai') + (cls ? ' ' + cls : '');
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  bubble('assistant', 'Salam! Mən CaspAI-yəm, WebFixer-in Azərbaycan dilində AI köməkçisi. Nə ilə kömək edə bilərəm?');

  ['Hər gün 10 dəqiqə ingilis dili öyrənmək üçün plan hazırla',
   'İş müsahibəsinə necə hazırlaşım?',
   'Mənə qısa bir motivasiya mətni yaz'].forEach(function (t) {
    var c = document.createElement('button');
    c.type = 'button'; c.className = 'chip'; c.textContent = t;
    c.addEventListener('click', function () { input.value = t; submit(); });
    sugg.appendChild(c);
  });

  // Qalan mesaj sayını yüklə (limit istifadə etmir)
  fetch(statusUrl).then(function (r) { return r.json(); })
    .then(function (d) { setLeft(d.remaining); }).catch(function () {});

  function submit() {
    var text = input.value.trim();
    if (!text || busy) return;
    busy = true; send.disabled = true; input.value = ''; sugg.hidden = true;
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
