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
        '<div class="cai-logo">Casp<b>AI</b></div>' +
        '<div class="cai-left" id="caiLeft" aria-live="polite"></div>' +
      '</div></div>' +
      '<div class="cai-log" id="caiLog" role="log" aria-live="polite"><div class="cai-log-in" id="caiLogIn"></div></div>' +
      '<div class="cai-foot"><div class="cai-foot-in">' +
        '<form class="cai-form" id="caiForm">' +
          '<textarea id="caiInput" rows="1" maxlength="' + MAX_CHARS + '" placeholder="Mesaj yaz…" aria-label="Mesaj"></textarea>' +
          '<button class="cai-send" id="caiSend" type="submit" aria-label="Göndər"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
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

  /* Modelin buraxdığı LaTeX-i oxunaqlı Unicode-a çevirir (məs. $s = v_0t + \frac{at^2}{2}$ → s = v₀t + (at²)/(2)) */
  var SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻','+':'⁺','n':'ⁿ' };
  var SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
  function mapAll(s, map) { var o = ''; for (var i = 0; i < s.length; i++) { if (!map[s[i]]) return null; o += map[s[i]]; } return o; }
  function texify(t) {
    var prev;
    do { prev = t; t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)'); } while (t !== prev);
    t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\approx/g, '≈').replace(/\\pm/g, '±')
      .replace(/\\leq?(?![a-z])/g, '≤').replace(/\\geq?(?![a-z])/g, '≥').replace(/\\neq/g, '≠').replace(/\\infty/g, '∞')
      .replace(/\\Delta/g, 'Δ').replace(/\\delta/g, 'δ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β')
      .replace(/\\omega/g, 'ω').replace(/\\theta/g, 'θ').replace(/\\pi(?![a-z])/g, 'π').replace(/\\mu/g, 'μ')
      .replace(/\\rho/g, 'ρ').replace(/\\sigma/g, 'σ').replace(/\\lambda/g, 'λ')
      .replace(/\\(?:left|right|,|;|!|quad)\s?/g, '').replace(/\\([%&_#])/g, '$1');
    t = t.replace(/\^\{([^{}]*)\}/g, function (m, a) { var s = mapAll(a, SUP); return s || '^(' + a + ')'; })
      .replace(/\^([0-9n])/g, function (m, a) { return SUP[a]; })
      .replace(/_\{([^{}]*)\}/g, function (m, a) { var s = mapAll(a, SUB); return s || '_' + a; })
      .replace(/_([0-9])/g, function (m, a) { return SUB[a]; });
    return t.replace(/\\\(|\\\)|\\\[|\\\]/g, '').replace(/\$/g, '');
  }

  /* Cavabı təhlükəsiz göstərir: yalnız **qalın** və siyahı işarələri çevrilir, HTML heç vaxt işlənmir (XSS yoxdur) */
  function renderAI(el, text) {
    el.textContent = '';
    texify(text).split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createTextNode('\n'));
      line = line.replace(/^\s*#{1,6}\s+/, '').replace(/^(\s*)[*-]\s+/, '$1• ');
      line.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          var s = document.createElement('strong'); s.textContent = part.slice(2, -2); el.appendChild(s);
        } else if (part) {
          el.appendChild(document.createTextNode(part.replace(/`/g, '')));
        }
      });
    });
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
    .then(function (d) {
      setLeft(d.remaining);
      if (d.enabled === false) {
        bubble('assistant', 'CaspAI hazırda təkmilləşdirilir. Tezliklə yenidən aktiv olacaq. Bu vaxt WebFixer-in digər alətlərindən istifadə edə bilərsiniz.');
        send.disabled = true; input.disabled = true; sugg.hidden = true;
      }
    }).catch(function () {});

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
        renderAI(wait, d.reply); wait.classList.remove('wait');
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
