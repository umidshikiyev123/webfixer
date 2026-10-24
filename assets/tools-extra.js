/* =====================================================================
   MikroTools — əlavə 11 sadə alət
   Faiz, Yaş, Tarix, BMI, ƏDV/Endirim, Təsadüfi seçim, Base64/URL,
   JSON, URL slug, Rəng konvertoru, Ədədi sözlə yaz.
   Hamısı brauzerdə işləyir. common.js tələb olunur ($, $$, toast, copyText...).
   ===================================================================== */

/* ---------- Ümumi köməkçilər ---------- */
// Ədədi oxunaqlı formata salır: 1 234,5  (boşluq = minlik ayırıcı, vergül = onluq)
function nf(n, d = 6){
  if(!isFinite(n)) return '—';
  let r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d); if(r === 0) r = 0;
  const s = Math.abs(r) < 1e21 ? r.toFixed(d).replace(/\.?0+$/, '') : String(r);
  let [i, f] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return f ? i + ',' + f : i;
}
// Pul formatı: həmişə 2 onluq rəqəm
function mf(n){
  if(!isFinite(n)) return '—';
  const [i, f] = (Math.round(n * 100) / 100).toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + f;
}
// Mətn sahəsindən ədəd oxu (vergül və nöqtə qəbul olunur)
function readNum(el){
  const v = el.value.trim().replace(/\s/g, '').replace(',', '.');
  return v === '' || v === '-' ? NaN : Number(v);
}
// Alt-tab keçidi (timer alətindəki kimi)
function bindTabs(root, onChange){
  $$('[data-m]', root).forEach(b => b.onclick = () => {
    $$('[data-m]', root).forEach(x => x.classList.toggle('active', x === b));
    $$('[data-v]', root).forEach(v => v.hidden = v.dataset.v !== b.dataset.m);
    if(onChange) onChange(b.dataset.m);
  });
}
// Tarix köməkçiləri (UTC ilə: yay/qış vaxtı problem yaratmasın)
const AZ_DAYS = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
function parseDate(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if(!m) return null;
  const d = utc(+m[1], +m[2] - 1, +m[3]);
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}
const todayUTC = () => { const n = new Date(); return utc(n.getFullYear(), n.getMonth(), n.getDate()); };
const isoDate = d => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const fmtDate = d => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
function ymd(a, b){   // a <= b: il / ay / gün fərqi
  let y = b.getUTCFullYear() - a.getUTCFullYear(), m = b.getUTCMonth() - a.getUTCMonth(), d = b.getUTCDate() - a.getUTCDate();
  if(d < 0){
    m--; let pm = b.getUTCMonth() - 1, py = b.getUTCFullYear();
    if(pm < 0){ pm = 11; py--; }
    d += dim(py, pm);
  }
  if(m < 0){ y--; m += 12; }
  return {y, m, d};
}
const statBox = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;

/* ---------- 1. FAİZ HESABLAYICI ---------- */
function initPercent(root){
  const blocks = [
    {t:'1. A ədədinin B faizi neçədir?', f:[['Faiz (%)', 'b', '15'], ['Ədəd', 'a', '200']],
      fn: (a, b) => nf(a * b / 100)},
    {t:'2. A ədədi B ədədinin neçə faizidir?', f:[['A ədədi', 'a', '50'], ['B ədədi', 'b', '200']],
      fn: (a, b) => b === 0 ? '—' : nf(a / b * 100) + ' %'},
    {t:'3. A-dan B-yə dəyişiklik neçə faizdir?', f:[['Əvvəlki dəyər (A)', 'a', '80'], ['Yeni dəyər (B)', 'b', '100']],
      fn: (a, b) => { if(a === 0) return '—'; const p = (b - a) / Math.abs(a) * 100; return (p >= 0 ? '+' : '−') + nf(Math.abs(p)) + ' % ' + (p >= 0 ? 'artım' : 'azalma') + ' (fərq: ' + nf(b - a) + ')'; }},
    {t:'4. A ədədinə B% əlavə et və ya çıx', f:[['Ədəd (A)', 'a', '200'], ['Faiz (B %)', 'b', '10']],
      fn: (a, b) => '+B%: ' + nf(a * (1 + b / 100)) + '   |   −B%: ' + nf(a * (1 - b / 100))},
    {t:'5. B% = A isə, bütöv nə qədərdir?', f:[['Faiz (B %)', 'b', '15'], ['Onun qiyməti (A)', 'a', '30']],
      fn: (a, b) => b === 0 ? '—' : nf(a * 100 / b)}
  ];
  root.innerHTML = blocks.map((bl, i) => `<div class="mini"><h3>${bl.t}</h3><div class="row">${
    bl.f.map(([lab, k, ph]) => `<div><label>${lab}</label><input type="text" inputmode="decimal" data-k="${k}" placeholder="${ph}"></div>`).join('')
  }</div><div class="res-big" data-out="${i}">—</div></div>`).join('') +
  `<div class="btns"><button class="btn ghost" id="pcClr">Təmizlə</button></div>`;
  $$('.mini', root).forEach((m, i) => {
    const calc = () => {
      const v = {}; $$('input', m).forEach(x => v[x.dataset.k] = readNum(x));
      $('.res-big', m).textContent = isNaN(v.a) || isNaN(v.b) ? '—' : blocks[i].fn(v.a, v.b);
    };
    $$('input', m).forEach(x => x.addEventListener('input', calc));
    $('.res-big', m).onclick = () => { const t = $('.res-big', m).textContent; if(t !== '—') copyText(t); };
  });
  $('#pcClr', root).onclick = () => { $$('input', root).forEach(x => x.value = ''); $$('.res-big', root).forEach(x => x.textContent = '—'); };
}

/* ---------- 2. YAŞ HESABLAYICI ---------- */
function initAge(root){
  root.innerHTML = `
    <div class="row">
      <div><label for="agB">Doğum tarixi</label><input type="date" id="agB" min="1900-01-01"></div>
      <div><label for="agT">Hesablama tarixi</label><input type="date" id="agT"></div>
    </div>
    <div class="btns"><button class="btn" id="agGo">🎂 Hesabla</button><button class="btn ghost" id="agToday">Bu gün</button></div>
    <div id="agOut"></div>`;
  const B = $('#agB', root), T = $('#agT', root), out = $('#agOut', root);
  T.value = isoDate(todayUTC());
  function calc(){
    const b = parseDate(B.value), t = parseDate(T.value);
    if(!b || !t){ out.innerHTML = '<p class="status">Doğum tarixini seçin.</p>'; return; }
    if(b > t){ out.innerHTML = '<p class="r-msg err">Doğum tarixi hesablama tarixindən sonra ola bilməz.</p>'; return; }
    const r = ymd(b, t), days = daysBetween(b, t);
    // növbəti ad günü (29 fevral olanlarda adi ildə 1 mart)
    const mk = yy => (b.getUTCMonth() === 1 && b.getUTCDate() === 29 && dim(yy, 1) === 28) ? utc(yy, 2, 1) : utc(yy, b.getUTCMonth(), b.getUTCDate());
    let nb = mk(t.getUTCFullYear()); if(nb < t) nb = mk(t.getUTCFullYear() + 1);
    const left = daysBetween(t, nb), turning = nb.getUTCFullYear() - b.getUTCFullYear();
    out.innerHTML = `
      <div class="stat-grid">${statBox(r.y, 'İl')}${statBox(r.m, 'Ay')}${statBox(r.d, 'Gün')}</div>
      <div class="stat-grid">${statBox(nf(days), 'Cəmi gün')}${statBox(nf(Math.floor(days / 7)), 'Cəmi həftə')}${statBox(nf(r.y * 12 + r.m), 'Cəmi ay')}${statBox(nf(days * 24), 'Cəmi saat')}</div>
      <div class="mini"><p><b>Doğulduğunuz gün:</b> ${AZ_DAYS[b.getUTCDay()]}</p>
      <p><b>Növbəti ad günü:</b> ${left === 0 ? 'Bu gün! 🎉 (' + turning + ' yaş)' : fmtDate(nb) + ' (' + AZ_DAYS[nb.getUTCDay()] + '), ' + nf(left) + ' gün sonra, ' + turning + ' yaşınız olacaq'}</p></div>`;
  }
  $('#agGo', root).onclick = calc;
  [B, T].forEach(e => e.addEventListener('input', calc));
  $('#agToday', root).onclick = () => { T.value = isoDate(todayUTC()); calc(); };
  calc();
}

/* ---------- 3. TARİX HESABLAYICI ---------- */
function initDates(root){
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="diff">İki tarix arası fərq</button><button class="tab" data-m="add">Tarixə əlavə et / çıx</button></div>
    <div data-v="diff">
      <div class="row"><div><label for="dfA">Başlanğıc tarix</label><input type="date" id="dfA"></div>
      <div><label for="dfB">Son tarix</label><input type="date" id="dfB"></div></div>
      <div id="dfOut"></div>
    </div>
    <div data-v="add" hidden>
      <div class="row"><div><label for="adD">Başlanğıc tarix</label><input type="date" id="adD"></div>
      <div><label for="adN">Miqdar</label><input type="number" id="adN" value="30" min="0" max="100000"></div>
      <div><label for="adU">Vahid</label><select id="adU"><option value="gun">Gün</option><option value="hefte">Həftə</option><option value="ay">Ay</option><option value="il">İl</option></select></div>
      <div><label for="adS">Əməliyyat</label><select id="adS"><option value="1">Əlavə et (+)</option><option value="-1">Çıx (−)</option></select></div></div>
      <div id="adOut"></div>
    </div>`;
  bindTabs(root);
  const A = $('#dfA', root), B = $('#dfB', root), D = $('#adD', root);
  A.value = isoDate(todayUTC()); B.value = isoDate(utc(todayUTC().getUTCFullYear(), 11, 31)); D.value = isoDate(todayUTC());
  function diff(){
    const a = parseDate(A.value), b = parseDate(B.value), o = $('#dfOut', root);
    if(!a || !b){ o.innerHTML = '<p class="status">Hər iki tarixi seçin.</p>'; return; }
    const neg = a > b, s = neg ? b : a, e = neg ? a : b, days = daysBetween(s, e), r = ymd(s, e);
    let biz = 0; if(days <= 200000){ for(let t = +s; t < +e; t += 864e5){ const w = new Date(t).getUTCDay(); if(w !== 0 && w !== 6) biz++; } }
    o.innerHTML = (neg ? '<p class="status">Başlanğıc tarix sondan sonradır, fərq mütləq qiymətlə göstərilir.</p>' : '') +
      `<div class="stat-grid">${statBox(r.y, 'İl')}${statBox(r.m, 'Ay')}${statBox(r.d, 'Gün')}</div>
       <div class="stat-grid">${statBox(nf(days), 'Cəmi gün')}${statBox(nf(Math.floor(days / 7)) + ' h ' + (days % 7) + ' g', 'Həftə və gün')}${statBox(days <= 200000 ? nf(biz) : '—', 'İş günü')}</div>
       <p class="status">İş günü: bazar ertəsi–cümə, başlanğıc gün daxil, son gün xaric. Bayram günləri nəzərə alınmır.</p>`;
  }
  function add(){
    const d = parseDate(D.value), n = Math.floor(+$('#adN', root).value), o = $('#adOut', root);
    if(!d || isNaN(n) || n < 0){ o.innerHTML = '<p class="status">Tarixi və müsbət miqdarı yazın.</p>'; return; }
    const u = $('#adU', root).value, sg = +$('#adS', root).value, k = n * sg;
    let r;
    if(u === 'gun') r = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + k);
    else if(u === 'hefte') r = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7 * k);
    else {
      const tot = d.getUTCMonth() + (u === 'il' ? 12 * k : k), ny = d.getUTCFullYear() + Math.floor(tot / 12), nm = ((tot % 12) + 12) % 12;
      r = utc(ny, nm, Math.min(d.getUTCDate(), dim(ny, nm)));
    }
    if(isNaN(r) || r.getUTCFullYear() < 1000 || r.getUTCFullYear() > 9999){ o.innerHTML = '<p class="r-msg err">Nəticə çox böyük və ya kiçikdir.</p>'; return; }
    o.innerHTML = `<div class="res-big">${fmtDate(r)}</div><p class="status">${AZ_DAYS[r.getUTCDay()]} · ${isoDate(r)}</p>`;
  }
  [A, B].forEach(e => e.addEventListener('input', diff));
  [D, $('#adN', root), $('#adU', root), $('#adS', root)].forEach(e => e.addEventListener('input', add));
  diff(); add();
}

/* ---------- 4. BMI ---------- */
function initBMI(root){
  root.innerHTML = `
    <div class="row">
      <div><label for="bmW">Çəki (kq)</label><input type="text" inputmode="decimal" id="bmW" placeholder="70"></div>
      <div><label for="bmH">Boy (sm)</label><input type="text" inputmode="decimal" id="bmH" placeholder="175"></div>
    </div>
    <div id="bmOut"></div>
    <p class="status">Bu hesablama yalnız məlumat xarakterlidir və 18 yaşdan yuxarı yetkinlər üçündür. Uşaqlar, hamilələr və yüksək əzələ kütləsi olan idmançılar üçün uyğun olmaya bilər. Sağlamlıq qərarları üçün həkimə müraciət edin.</p>`;
  const W = $('#bmW', root), H = $('#bmH', root), o = $('#bmOut', root);
  function calc(){
    const w = readNum(W), h = readNum(H) / 100;
    if(isNaN(w) || isNaN(h)){ o.innerHTML = ''; return; }
    if(w < 20 || w > 400 || h < 1 || h > 2.6){ o.innerHTML = '<p class="r-msg err">Dəyərlər real aralıqda olmalıdır (çəki 20–400 kq, boy 100–260 sm).</p>'; return; }
    const bmi = w / (h * h);
    const cat = bmi < 18.5 ? ['Aşağı çəki', '#d97706'] : bmi < 25 ? ['Normal çəki', 'var(--lime)'] : bmi < 30 ? ['Artıq çəki', '#d97706'] : ['Piylənmə', 'var(--danger)'];
    const pos = Math.max(0, Math.min(100, (bmi - 15) / 25 * 100));
    const ex = Math.round((w - Math.min(Math.max(w, 18.5 * h * h), 24.9 * h * h)) * 10) / 10;   // normal aralıqdan kənarlaşma (kq)
    o.innerHTML = `<div class="res-big" style="color:${cat[1]}">${nf(bmi, 1)} — ${cat[0]}</div>
      <div class="meter" style="height:14px"><i style="width:${pos}%;background:${cat[1]}"></i></div>
      <div class="stat-grid">${statBox(nf(18.5 * h * h, 1) + ' – ' + nf(24.9 * h * h, 1) + ' kq', 'Normal çəki aralığı')}${statBox(ex === 0 ? 'Normal aralıqdasınız' : (ex > 0 ? nf(ex, 1) + ' kq artıq' : nf(-ex, 1) + ' kq az'), 'Normal aralığa görə')}</div>
      <p class="status">Təsnifat (ÜST): &lt;18,5 aşağı · 18,5–24,9 normal · 25–29,9 artıq çəki · ≥30 piylənmə.</p>`;
  }
  [W, H].forEach(e => e.addEventListener('input', calc));
}

/* ---------- 5. ƏDV VƏ ENDİRİM ---------- */
function initVat(root){
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="add">ƏDV əlavə et</button><button class="tab" data-m="ext">ƏDV-ni ayır</button><button class="tab" data-m="dis">Endirim</button></div>
    <div class="row">
      <div><label id="vaL" for="vaA">Məbləğ (ƏDV-siz)</label><input type="text" inputmode="decimal" id="vaA" placeholder="100"></div>
      <div><label id="vrL" for="vaR">ƏDV dərəcəsi (%)</label><input type="text" inputmode="decimal" id="vaR" value="18"></div>
    </div>
    <div id="vaOut"></div>
    <p class="status" id="vaNote">Azərbaycanda standart ƏDV dərəcəsi 18%-dir. Dərəcə dəyişə bilər, rəsmi mənbədən yoxlayın. Dərəcəni özünüz də dəyişə bilərsiniz.</p>`;
  let mode = 'add';
  const A = $('#vaA', root), R = $('#vaR', root), o = $('#vaOut', root);
  const T = {add:['Məbləğ (ƏDV-siz)', 'ƏDV dərəcəsi (%)'], ext:['Məbləğ (ƏDV daxil)', 'ƏDV dərəcəsi (%)'], dis:['Qiymət', 'Endirim (%)']};
  function calc(){
    const a = readNum(A), r = readNum(R);
    if(isNaN(a) || isNaN(r)){ o.innerHTML = ''; return; }
    if(a < 0 || r < 0 || (mode === 'dis' && r > 100)){ o.innerHTML = '<p class="r-msg err">Dəyərlər mənfi ola bilməz, endirim 100%-dən çox ola bilməz.</p>'; return; }
    if(mode === 'add'){ const v = a * r / 100; o.innerHTML = `<div class="stat-grid">${statBox(mf(a), 'ƏDV-siz məbləğ')}${statBox(mf(v), 'ƏDV')}${statBox(mf(a + v), 'Yekun (ƏDV daxil)')}</div>`; }
    else if(mode === 'ext'){ const net = a / (1 + r / 100); o.innerHTML = `<div class="stat-grid">${statBox(mf(net), 'ƏDV-siz məbləğ')}${statBox(mf(a - net), 'ƏDV')}${statBox(mf(a), 'Yekun (ƏDV daxil)')}</div>`; }
    else { const d = a * r / 100; o.innerHTML = `<div class="stat-grid">${statBox(mf(a), 'Əvvəlki qiymət')}${statBox(mf(d), 'Qənaət')}${statBox(mf(a - d), 'Yeni qiymət')}</div>`; }
  }
  bindTabs(root, m => {
    mode = m; $('#vaL', root).textContent = T[m][0]; $('#vrL', root).textContent = T[m][1];
    R.value = m === 'dis' ? '10' : '18'; $('#vaNote', root).hidden = m === 'dis'; calc();
  });
  // tab düymələri üçün [data-v] bölmələri yoxdur — yalnız etiketlər dəyişir
  [A, R].forEach(e => e.addEventListener('input', calc));
}

/* ---------- 6. TƏSADÜFİ SEÇİM ---------- */
function initRandom(root){
  const rnd = n => { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let x; do{ crypto.getRandomValues(a); x = a[0]; } while(x >= lim); return x % n; };
  const shuffle = arr => { const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="num">Ədəd</button><button class="tab" data-m="coin">Sikkə</button><button class="tab" data-m="dice">Zər</button><button class="tab" data-m="list">Siyahıdan seç</button></div>
    <div data-v="num">
      <div class="row"><div><label for="rnMin">Ən kiçik</label><input type="number" id="rnMin" value="1"></div>
      <div><label for="rnMax">Ən böyük</label><input type="number" id="rnMax" value="100"></div>
      <div><label for="rnCnt">Neçə ədəd</label><input type="number" id="rnCnt" value="1" min="1" max="100"></div></div>
      <label class="check"><input type="checkbox" id="rnUq"> Təkrarsız olsun</label>
      <div class="btns"><button class="btn" id="rnGo">🎲 Yarat</button><button class="btn alt" id="rnCp">📋 Kopyala</button></div>
      <div class="res-big" id="rnOut">—</div>
    </div>
    <div data-v="coin" hidden>
      <div class="big-time" id="cnOut">🪙</div>
      <div class="btns" style="justify-content:center"><button class="btn" id="cnGo">Sikkə at</button><button class="btn ghost" id="cnRst">Sıfırla</button></div>
      <p class="status" style="text-align:center" id="cnTally">Üz: 0 · Arxa: 0</p>
    </div>
    <div data-v="dice" hidden>
      <div class="row"><div><label for="dcCnt">Zər sayı</label><select id="dcCnt">${[1,2,3,4,5,6].map(n => `<option>${n}</option>`).join('')}</select></div></div>
      <div class="big-time" id="dcOut" style="letter-spacing:.1em">⚀</div>
      <div class="btns" style="justify-content:center"><button class="btn" id="dcGo">Zər at</button></div>
      <p class="status" style="text-align:center" id="dcSum"></p>
    </div>
    <div data-v="list" hidden>
      <label for="lsIn">Siyahı (hər sətirdə bir ad)</label><textarea id="lsIn" placeholder="Əli&#10;Leyla&#10;Murad&#10;Aysel"></textarea>
      <div class="row"><div><label for="lsN">Neçə nəfər seçilsin</label><input type="number" id="lsN" value="1" min="1"></div></div>
      <div class="btns"><button class="btn" id="lsGo">🏆 Seç</button><button class="btn alt" id="lsSh">🔀 Qarışdır</button><button class="btn ghost" id="lsCp">📋 Kopyala</button></div>
      <div class="out" id="lsOut">—</div>
    </div>`;
  bindTabs(root);
  // Ədəd
  $('#rnGo', root).onclick = () => {
    const mn = Math.floor(+$('#rnMin', root).value), mx = Math.floor(+$('#rnMax', root).value), c = Math.floor(+$('#rnCnt', root).value), uq = $('#rnUq', root).checked;
    if([mn, mx, c].some(isNaN) || mn > mx){ toast('Aralığı düzgün yazın'); return; }
    if(mx - mn > 1e9 || c < 1 || c > 100){ toast('Aralıq çox böyükdür və ya say 1–100 olmalıdır'); return; }
    const range = mx - mn + 1;
    if(uq && c > range){ toast('Təkrarsız ədədlər üçün aralıq kifayət deyil'); return; }
    const res = [], seen = new Set();
    while(res.length < c){ const v = mn + rnd(range); if(uq && seen.has(v)) continue; seen.add(v); res.push(v); }
    $('#rnOut', root).textContent = res.join(', ');
  };
  $('#rnCp', root).onclick = () => { const t = $('#rnOut', root).textContent; if(t !== '—') copyText(t); };
  // Sikkə
  let tally = [0, 0];
  $('#cnGo', root).onclick = () => { const r = rnd(2); tally[r]++; $('#cnOut', root).textContent = r ? 'Arxa' : 'Üz'; $('#cnTally', root).textContent = `Üz: ${tally[0]} · Arxa: ${tally[1]}`; };
  $('#cnRst', root).onclick = () => { tally = [0, 0]; $('#cnOut', root).textContent = '🪙'; $('#cnTally', root).textContent = 'Üz: 0 · Arxa: 0'; };
  // Zər
  $('#dcGo', root).onclick = () => {
    const n = +$('#dcCnt', root).value, v = Array.from({length: n}, () => rnd(6) + 1);
    $('#dcOut', root).textContent = v.map(x => FACE[x - 1]).join(' ');
    $('#dcSum', root).textContent = n > 1 ? 'Nəticə: ' + v.join(' + ') + ' = ' + v.reduce((a, b) => a + b, 0) : 'Nəticə: ' + v[0];
  };
  // Siyahı
  const items = () => $('#lsIn', root).value.split('\n').map(s => s.trim()).filter(Boolean);
  $('#lsGo', root).onclick = () => {
    const a = items(), n = Math.floor(+$('#lsN', root).value);
    if(!a.length){ toast('Siyahı boşdur'); return; }
    if(isNaN(n) || n < 1){ toast('Seçiləcək sayı yazın'); return; }
    $('#lsOut', root).textContent = shuffle(a).slice(0, Math.min(n, a.length)).map((x, i) => (i + 1) + '. ' + x).join('\n');
  };
  $('#lsSh', root).onclick = () => { const a = items(); if(!a.length){ toast('Siyahı boşdur'); return; } $('#lsOut', root).textContent = shuffle(a).map((x, i) => (i + 1) + '. ' + x).join('\n'); };
  $('#lsCp', root).onclick = () => { const t = $('#lsOut', root).textContent; if(t !== '—') copyText(t); };
}

/* ---------- 7. BASE64 / URL KODLAYICI ---------- */
function initB64(root){
  root.innerHTML = `
    <label for="bIn">Giriş mətni</label><textarea id="bIn" placeholder="Mətni bura yazın və ya yapışdırın..."></textarea>
    <label class="check"><input type="checkbox" id="bUrl"> Base64URL (+ / əvəzinə - _ və sonda = olmadan)</label>
    <div class="btns">
      <button class="btn sm" data-a="be">Base64 kodla</button><button class="btn sm" data-a="bd">Base64 aç</button>
      <button class="btn sm alt" data-a="ue">URL kodla</button><button class="btn sm alt" data-a="ud">URL aç</button>
    </div>
    <label for="bOut">Nəticə</label><textarea id="bOut" readonly></textarea>
    <div class="btns"><button class="btn" id="bCp">📋 Kopyala</button><button class="btn ghost" id="bSw">⇅ Nəticəni girişə köçür</button><button class="btn ghost" id="bClr">Təmizlə</button></div>`;
  const I = $('#bIn', root), O = $('#bOut', root);
  const enc = (s, url) => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); let r = btoa(bin); if(url) r = r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return r; };
  const dec = s => { let t = s.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'); while(t.length % 4) t += '='; const bin = atob(t); return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };
  const acts = {
    be: s => enc(s, $('#bUrl', root).checked), bd: dec,
    ue: s => encodeURIComponent(s), ud: s => decodeURIComponent(s.replace(/\+/g, ' '))
  };
  $$('[data-a]', root).forEach(b => b.onclick = () => {
    if(!I.value){ toast('Əvvəlcə mətn yazın'); return; }
    try{ O.value = acts[b.dataset.a](I.value); }
    catch(e){ O.value = ''; toast(b.dataset.a === 'bd' ? 'Yanlış Base64 mətni' : 'Yanlış kodlanmış mətn'); }
  });
  $('#bCp', root).onclick = () => copyText(O.value);
  $('#bSw', root).onclick = () => { if(O.value){ I.value = O.value; O.value = ''; } };
  $('#bClr', root).onclick = () => { I.value = ''; O.value = ''; };
}

/* ---------- 8. JSON FORMATLAYICI ---------- */
function initJSON(root){
  root.innerHTML = `
    <label for="jIn">JSON</label><textarea id="jIn" style="min-height:240px" spellcheck="false" placeholder='{"ad":"Əli","yaş":25}'></textarea>
    <div class="row">
      <div><label for="jInd">Girinti</label><select id="jInd"><option value="2">2 boşluq</option><option value="4">4 boşluq</option><option value="t">Tab</option></select></div>
    </div>
    <label class="check"><input type="checkbox" id="jSort"> Açarları əlifba sırası ilə düz</label>
    <div class="btns"><button class="btn" id="jFmt">✨ Formatla</button><button class="btn alt" id="jMin">Sıxışdır</button><button class="btn ghost" id="jChk">Yoxla</button>
      <button class="btn ghost" id="jCp">📋 Kopyala</button><button class="btn ghost" id="jDl">⬇ .json</button><button class="btn ghost" id="jClr">Təmizlə</button></div>
    <div class="status" id="jSt"></div>`;
  const I = $('#jIn', root), st = $('#jSt', root);
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortKeys(v[k]), o), {}) : v);
  function parse(){
    try{ const v = JSON.parse(I.value); return {ok: true, v: $('#jSort', root).checked ? sortKeys(v) : v}; }
    catch(e){
      const m = /position (\d+)/.exec(e.message); let where = '';
      if(m){ const pos = +m[1], pre = I.value.slice(0, pos); where = ` (sətir ${pre.split('\n').length}, sütun ${pos - pre.lastIndexOf('\n')})`; }
      return {ok: false, err: 'Yanlış JSON' + where + ': ' + e.message};
    }
  }
  function status(r){ st.className = 'status ' + (r.ok ? 'ok' : 'bad'); st.textContent = r.ok ? '✓ Düzgün JSON · ' + fmtBytes(new Blob([I.value]).size) : '✗ ' + r.err; }
  function run(kind){
    if(!I.value.trim()){ toast('JSON yazın'); return; }
    const r = parse(); status(r); if(!r.ok) return;
    if(kind === 'min') I.value = JSON.stringify(r.v);
    else if(kind === 'fmt'){ const ind = $('#jInd', root).value; I.value = JSON.stringify(r.v, null, ind === 't' ? '\t' : +ind); }
    status({ok: true});
  }
  $('#jFmt', root).onclick = () => run('fmt'); $('#jMin', root).onclick = () => run('min'); $('#jChk', root).onclick = () => run('chk');
  $('#jCp', root).onclick = () => copyText(I.value);
  $('#jDl', root).onclick = () => { if(!I.value){ toast('Endiriləcək məzmun yoxdur'); return; } downloadBlob(new Blob([I.value], {type: 'application/json;charset=utf-8'}), 'data.json'); };
  $('#jClr', root).onclick = () => { I.value = ''; st.textContent = ''; };
  let t; I.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if(I.value.trim()) status(parse()); else st.textContent = ''; }, 350); });
}

/* ---------- 9. URL SLUG GENERATORU ---------- */
function initSlug(root){
  const TR = {'ə':'e','Ə':'e','ı':'i','İ':'i','ö':'o','Ö':'o','ü':'u','Ü':'u','ç':'c','Ç':'c','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ß':'ss','æ':'ae','œ':'oe','ø':'o','đ':'d','ł':'l'};
  const RU = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya'};
  root.innerHTML = `
    <label for="slIn">Başlıq və ya mətn (hər sətir ayrı slug olur)</label>
    <textarea id="slIn" style="min-height:110px" placeholder="Azərbaycan dilində şəkil və çay haqqında"></textarea>
    <div class="row">
      <div><label for="slSep">Ayırıcı</label><select id="slSep"><option value="-">Tire ( - )</option><option value="_">Alt xətt ( _ )</option></select></div>
      <div><label for="slMax">Maksimum uzunluq</label><input type="number" id="slMax" min="0" max="200" value="0" placeholder="0 = məhdudiyyətsiz"></div>
    </div>
    <label class="check"><input type="checkbox" id="slLow" checked> Kiçik hərflərlə yaz</label>
    <label for="slOut">Nəticə</label><div class="out" id="slOut">—</div>
    <div class="btns"><button class="btn" id="slCp">📋 Kopyala</button><button class="btn ghost" id="slClr">Təmizlə</button></div>`;
  function slugify(s, sep, max, low){
    let o = '';
    for(const ch of s){ o += TR[ch] !== undefined ? TR[ch] : (RU[ch.toLowerCase()] !== undefined ? RU[ch.toLowerCase()] : ch); }
    o = o.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if(low) o = o.toLowerCase();
    o = o.split(/[^A-Za-z0-9]+/).filter(Boolean).join(sep);
    if(max > 0 && o.length > max){ const nx = o.charAt(max); o = o.slice(0, max); if(nx && nx !== sep){ const i = o.lastIndexOf(sep); if(i > max * .6) o = o.slice(0, i); } o = o.replace(new RegExp('\\' + sep + '+$'), ''); }
    return o;
  }
  const calc = () => {
    const lines = $('#slIn', root).value.split('\n').filter(l => l.trim());
    const max = Math.max(0, Math.floor(+$('#slMax', root).value) || 0);
    $('#slOut', root).textContent = lines.length ? lines.map(l => slugify(l, $('#slSep', root).value, max, $('#slLow', root).checked)).join('\n') : '—';
  };
  $$('textarea,input,select', root).forEach(e => e.addEventListener('input', calc));
  $('#slCp', root).onclick = () => { const t = $('#slOut', root).textContent; if(t !== '—') copyText(t); };
  $('#slClr', root).onclick = () => { $('#slIn', root).value = ''; calc(); };
}

/* ---------- 10. RƏNG KONVERTORU ---------- */
function initColorConv(root){
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const rgb2hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
    if(d){ s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    return {h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100)};
  };
  const hsl2rgb = (h, s, l) => {
    s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return {r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255)};
  };
  function parseColor(str){
    const s = str.trim().toLowerCase(); let m;
    if((m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s))){
      let h = m[1]; if(h.length === 3) h = h.split('').map(c => c + c).join('');
      return {r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16)};
    }
    if((m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(s))){
      const r = +m[1], g = +m[2], b = +m[3]; return r > 255 || g > 255 || b > 255 ? null : {r, g, b};
    }
    if((m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(s))){
      return hsl2rgb(((+m[1] % 360) + 360) % 360, clamp(+m[2], 0, 100), clamp(+m[3], 0, 100));
    }
    return null;
  }
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  root.innerHTML = `
    <div class="row" style="align-items:end">
      <div style="flex:3"><label for="ccIn">Rəng (HEX, rgb() və ya hsl())</label><input type="text" id="ccIn" value="#0B2A5B" autocomplete="off" spellcheck="false"></div>
      <div style="flex:0 0 70px;min-width:70px"><label for="ccPick">Seç</label><input type="color" id="ccPick" value="#0b2a5b"></div>
    </div>
    <div class="status bad" id="ccErr" hidden>Rəng tanınmadı. Nümunə: #0b2a5b · rgb(11, 42, 91) · hsl(217, 78%, 20%)</div>
    <div id="ccOut"></div>`;
  const In = $('#ccIn', root), Pick = $('#ccPick', root), out = $('#ccOut', root), err = $('#ccErr', root);
  function draw(c){
    const hsl = rgb2hsl(c.r, c.g, c.b), W = {r: 255, g: 255, b: 255}, K = {r: 0, g: 0, b: 0}, rw = ratio(c, W), rk = ratio(c, K);
    const flag = r => r >= 7 ? 'AAA ✓' : r >= 4.5 ? 'AA ✓' : r >= 3 ? 'yalnız iri mətn' : 'uyğun deyil';
    const rows = [['HEX', hex(c)], ['RGB', `rgb(${c.r}, ${c.g}, ${c.b})`], ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`]];
    out.innerHTML = `<div class="cc-prev" style="background:${hex(c)}"></div>
      <div class="cc-rows">${rows.map(([k, v]) => `<div class="cc-row"><span>${k}</span><code>${v}</code><button class="btn sm ghost" type="button" data-c="${v}">Kopyala</button></div>`).join('')}</div>
      <h3 style="margin:18px 0 8px;font-size:1.05rem">Kontrast (WCAG)</h3>
      <div class="row">
        <div class="cc-con" style="background:${hex(c)};color:#fff"><b>Ağ mətn</b><span>${nf(rw, 2)} : 1 · ${flag(rw)}</span></div>
        <div class="cc-con" style="background:${hex(c)};color:#000"><b>Qara mətn</b><span>${nf(rk, 2)} : 1 · ${flag(rk)}</span></div>
      </div>`;
    $$('[data-c]', out).forEach(b => b.onclick = () => copyText(b.dataset.c));
  }
  function fromText(){
    const c = parseColor(In.value);
    err.hidden = !!c || !In.value.trim();
    if(!c){ if(!In.value.trim()) out.innerHTML = ''; return; }
    Pick.value = hex(c).toLowerCase(); draw(c);
  }
  In.addEventListener('input', fromText);
  Pick.addEventListener('input', () => { In.value = Pick.value.toUpperCase(); fromText(); });
  fromText();
}

/* ---------- 11. ƏDƏDİ SÖZLƏ YAZ ---------- */
function initNum2Words(root){
  const ONES = ['', 'bir', 'iki', 'üç', 'dörd', 'beş', 'altı', 'yeddi', 'səkkiz', 'doqquz'];
  const TENS = ['', 'on', 'iyirmi', 'otuz', 'qırx', 'əlli', 'altmış', 'yetmiş', 'səksən', 'doxsan'];
  const SCALES = ['', 'min', 'milyon', 'milyard', 'trilyon', 'katrilyon', 'kvintilyon'];
  const g3 = n => {
    const h = Math.floor(n / 100), t = Math.floor(n % 100 / 10), o = n % 10, p = [];
    if(h) p.push((h > 1 ? ONES[h] + ' ' : '') + 'yüz');
    if(t) p.push(TENS[t]);
    if(o) p.push(ONES[o]);
    return p.join(' ');
  };
  function words(digits){            // digits: yalnız rəqəmlərdən ibarət sətir
    digits = digits.replace(/^0+(?=\d)/, '');
    if(digits === '0') return 'sıfır';
    const groups = [];
    for(let i = digits.length; i > 0; i -= 3) groups.unshift(+digits.slice(Math.max(0, i - 3), i));
    if(groups.length > SCALES.length) return null;
    const out = [];
    groups.forEach((g, idx) => {
      if(!g) return;
      const sc = groups.length - 1 - idx;
      const w = (sc === 1 && g === 1) ? '' : g3(g);          // 1000 = "min" (bir min deyilmir)
      out.push([w, SCALES[sc]].filter(Boolean).join(' '));
    });
    return out.join(' ');
  }
  root.innerHTML = `
    <div class="row">
      <div><label for="nwMode">Rejim</label><select id="nwMode"><option value="n">Ədəd</option><option value="m">Məbləğ (manat və qəpik)</option></select></div>
      <div style="flex:2"><label for="nwIn">Ədəd / məbləğ</label><input type="text" inputmode="decimal" id="nwIn" placeholder="məs: 12345" autocomplete="off"></div>
    </div>
    <label class="check"><input type="checkbox" id="nwCap" checked> Birinci hərf böyük olsun</label>
    <div class="out" id="nwOut" style="font-family:var(--sans);font-size:1.15rem">—</div>
    <div class="btns"><button class="btn" id="nwCp">📋 Kopyala</button><button class="btn ghost" id="nwClr">Təmizlə</button></div>
    <p class="status" id="nwMsg"></p>`;
  const In = $('#nwIn', root), Mode = $('#nwMode', root), Out = $('#nwOut', root), Msg = $('#nwMsg', root);
  function calc(){
    Msg.textContent = '';
    const raw = In.value.trim().replace(/[\s_]/g, '');
    if(!raw){ Out.textContent = '—'; return; }
    let s = '';
    if(Mode.value === 'n'){
      const m = /^(-?)(\d+)$/.exec(raw);
      if(!m){ Out.textContent = '—'; Msg.textContent = 'Bu rejimdə yalnız tam ədəd yazın (məsələn: 12345). Onluq hissəli məbləğ üçün "Məbləğ" rejimini seçin.'; return; }
      const w = words(m[2]);
      if(w === null){ Out.textContent = '—'; Msg.textContent = 'Ədəd çox böyükdür (maksimum 21 rəqəm).'; return; }
      s = (m[1] && m[2] !== '0' ? 'mənfi ' : '') + w;
    } else {
      const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
      if(!m){ Out.textContent = '—'; Msg.textContent = 'Məbləği düzgün yazın (məsələn: 125,30). Qəpik üçün ən çox 2 rəqəm.'; return; }
      const man = words(m[1]), q = m[2] ? +(m[2].length === 1 ? m[2] + '0' : m[2]) : 0;
      if(man === null){ Out.textContent = '—'; Msg.textContent = 'Məbləğ çox böyükdür (maksimum 21 rəqəm).'; return; }
      s = man + ' manat' + (q > 0 ? ' ' + words(String(q)) + ' qəpik' : '');
    }
    if($('#nwCap', root).checked) s = s.charAt(0).toLocaleUpperCase('az') + s.slice(1);
    Out.textContent = s;
  }
  [In, Mode, $('#nwCap', root)].forEach(e => e.addEventListener('input', calc));
  $('#nwCp', root).onclick = () => { if(Out.textContent !== '—') copyText(Out.textContent); };
  $('#nwClr', root).onclick = () => { In.value = ''; calc(); };
}
