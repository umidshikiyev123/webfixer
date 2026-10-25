/* WebFixer — 8 alətin kodu. Hər alət səhifəsi öz init funksiyasını çağırır. */
/* ---------- 1. ŞƏKİL RESIZER / KONVERTOR ---------- */
function initImage(root){
  root.innerHTML = `
    <div class="drop" id="imgDrop">📁 Şəkilləri bura sürüşdürün və ya klikləyin<br><small>(JPG, PNG, WEBP, GIF — bir neçə şəkil seçə bilərsiniz)</small>
      <input type="file" accept="image/*" multiple hidden></div>
    <div class="status" id="imgInfo">Şəkil seçilməyib.</div>
    <div class="row">
      <div><label>Eni (px)</label><input type="number" id="imgW" min="1" placeholder="auto"></div>
      <div><label>Hündürlüyü (px)</label><input type="number" id="imgH" min="1" placeholder="auto"></div>
      <div><label>Format</label><select id="imgFmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WEBP</option></select></div>
    </div>
    <label class="check"><input type="checkbox" id="imgLock" checked> Nisbəti qoru (hündürlük avtomatik)</label>
    <label>Keyfiyyət: <span id="imgQv">85</span>% (JPG/WEBP üçün)</label><input type="range" id="imgQ" min="10" max="100" value="85">
    <div class="btns"><button class="btn" id="imgGo">⚙️ Emal et</button><button class="btn alt" id="imgZip" hidden>📦 Hamısını ZIP endir</button></div>
    <div class="results" id="imgRes"></div>`;
  const drop = $('#imgDrop', root), input = $('input[type=file]', root);
  const W = $('#imgW', root), H = $('#imgH', root), lock = $('#imgLock', root), fmt = $('#imgFmt', root), Q = $('#imgQ', root);
  let files = [], base = {w:0,h:0}, outputs = [];

  const loadImg = f => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
  async function setFiles(list){
    files = [...list].filter(f => f.type.startsWith('image/'));
    if(!files.length){ toast('Şəkil faylı seçin'); return; }
    const img = await loadImg(files[0]); base = {w:img.naturalWidth, h:img.naturalHeight};
    W.value = base.w; H.value = base.h;
    $('#imgInfo', root).textContent = `${files.length} şəkil seçildi · İlk şəkil: ${base.w}×${base.h}px (${fmtBytes(files[0].size)})`;
  }
  drop.onclick = () => input.click();
  input.onchange = () => setFiles(input.files);
  ['dragover','dragenter'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => setFiles(ev.dataTransfer.files));
  W.oninput = () => { if(lock.checked && base.w && W.value) H.value = Math.round(W.value * base.h / base.w); };
  H.oninput = () => { if(lock.checked && base.h && H.value) W.value = Math.round(H.value * base.w / base.h); };
  Q.oninput = () => $('#imgQv', root).textContent = Q.value;

  $('#imgGo', root).onclick = async () => {
    if(!files.length){ toast('Əvvəlcə şəkil seçin'); return; }
    const type = fmt.value, ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
    outputs = []; const box = $('#imgRes', root); box.innerHTML = '';
    for(const [idx, f] of files.entries()){
      try{
        const img = await loadImg(f);
        let w = +W.value || img.naturalWidth, h;
        if(lock.checked) h = Math.round(w * img.naturalHeight / img.naturalWidth); else h = +H.value || img.naturalHeight;
        const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
        if(type === 'image/jpeg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h); }   // JPG şəffaflığı dəstəkləmir
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise(r => c.toBlob(r, type, +Q.value/100));
        if(!blob){ toast('Bu format brauzerinizdə dəstəklənmir'); continue; }
        const name = f.name.replace(/\.[^.]+$/, '') + `-${w}x${h}.${ext}`;
        outputs.push({name, blob});
        const url = URL.createObjectURL(blob);
        const el = document.createElement('div'); el.className = 'res';
        el.innerHTML = `<img src="${url}" alt=""><div><b>${name}</b>${w}×${h} · ${fmtBytes(f.size)} → <b style="display:inline;color:var(--lime)">${fmtBytes(blob.size)}</b></div><button class="btn sm alt">⬇</button>`;
        $('button', el).onclick = () => downloadBlob(blob, name);
        box.appendChild(el);
      }catch(e){ toast('Xəta: ' + f.name + ' açıla bilmədi'); }
    }
    $('#imgZip', root).hidden = outputs.length < 2;
    if(outputs.length) toast('✓ Hazırdır!');
  };
  $('#imgZip', root).onclick = async () => {
    if(typeof JSZip === 'undefined'){ toast('JSZip yüklənmədi (internet?)'); return; }
    const zip = new JSZip(); outputs.forEach((o,i) => zip.file(`${i+1}-${o.name}`, o.blob));
    downloadBlob(await zip.generateAsync({type:'blob'}), 'sekiller.zip');
  };
}

/* ---------- 2. MƏTN ALƏTLƏRİ ---------- */
function initText(root){
  root.innerHTML = `
    <textarea id="txt" placeholder="Mətninizi bura yazın və ya yapışdırın..."></textarea>
    <div class="stat-grid" id="txtStats"></div>
    <div class="btns">
      <button class="btn sm" data-a="upper">BÖYÜK</button><button class="btn sm" data-a="lower">kiçik</button>
      <button class="btn sm" data-a="title">Başlıq Üslubu</button><button class="btn sm" data-a="sentence">Cümlə üslubu</button>
      <button class="btn sm alt" data-a="clean">🧹 Təmizlə (boşluqlar)</button><button class="btn sm alt" data-a="oneline">Sətirləri birləşdir</button>
      <button class="btn sm ghost" data-a="reverse">Tərsinə</button><button class="btn sm ghost" data-a="sort">Sətirləri sırala</button><button class="btn sm ghost" data-a="dedupe">Təkrar sətirləri sil</button>
    </div>
    <div class="btns"><button class="btn" id="txtCopy">📋 Kopyala</button><button class="btn alt" id="txtDl">⬇ .txt endir</button><button class="btn ghost" id="txtClr">Sil</button></div>`;
  const ta = $('#txt', root);
  const stats = () => {
    const t = ta.value, words = (t.trim().match(/\S+/g) || []).length;
    const data = [[t.length,'Hərf'],[t.replace(/\s/g,'').length,'Boşluqsuz'],[words,'Söz'],[(t.match(/[.!?]+(\s|$)/g)||[]).length,'Cümlə'],[t.trim()?t.split(/\n\s*\n/).filter(x=>x.trim()).length:0,'Paraqraf'],[Math.max(words?1:0,Math.ceil(words/200))+' dəq','Oxuma']];
    $('#txtStats', root).innerHTML = data.map(d => `<div class="stat"><b>${d[0]}</b><span>${d[1]}</span></div>`).join('');
  };
  const acts = {
    upper: t => t.toLocaleUpperCase('az'), lower: t => t.toLocaleLowerCase('az'),
    title: t => t.toLocaleLowerCase('az').replace(/(^|\s|[-(])(\S)/g, (m,a,b) => a + b.toLocaleUpperCase('az')),
    sentence: t => t.toLocaleLowerCase('az').replace(/(^\s*|[.!?]\s+)(\S)/g, (m,a,b) => a + b.toLocaleUpperCase('az')),
    clean: t => t.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim(),
    oneline: t => t.replace(/\s*\n\s*/g,' ').replace(/\s{2,}/g,' ').trim(),
    reverse: t => [...t].reverse().join(''),
    sort: t => t.split('\n').sort((a,b) => a.localeCompare(b,'az')).join('\n'),
    dedupe: t => [...new Set(t.split('\n'))].join('\n')
  };
  $$('[data-a]', root).forEach(b => b.onclick = () => { ta.value = acts[b.dataset.a](ta.value); stats(); });
  ta.oninput = stats; stats();
  $('#txtCopy', root).onclick = () => copyText(ta.value);
  $('#txtDl', root).onclick = () => downloadText(ta.value, 'metn.txt');
  $('#txtClr', root).onclick = () => { ta.value = ''; stats(); };
}

/* ---------- 3. PAROL / AÇAR GENERATORU ---------- */
function initPass(root){
  root.innerHTML = `
    <label>Növ</label><select id="pType"><option value="pw">Parol</option><option value="hex">Hex açar (təhlükəsizlik açarı)</option><option value="b64">API token (Base64URL)</option></select>
    <label>Uzunluq: <span id="pLv">20</span></label><input type="range" id="pLen" min="4" max="64" value="20">
    <div id="pOpts">
      <label class="check"><input type="checkbox" id="pUp" checked> Böyük hərflər (A-Z)</label>
      <label class="check"><input type="checkbox" id="pLo" checked> Kiçik hərflər (a-z)</label>
      <label class="check"><input type="checkbox" id="pNu" checked> Rəqəmlər (0-9)</label>
      <label class="check"><input type="checkbox" id="pSy" checked> Simvollar (!@#$…)</label>
      <label class="check"><input type="checkbox" id="pAm"> Oxşar simvolları çıxar (O,0,l,1,I)</label>
    </div>
    <div class="out" id="pOut"></div>
    <div class="meter"><i id="pMeter"></i></div><div class="status" id="pInfo"></div>
    <div class="btns"><button class="btn" id="pGen">🔄 Yeni yarat</button><button class="btn alt" id="pCopy">📋 Kopyala</button><button class="btn ghost" id="pDl">⬇ 5 ədəd .txt</button></div>`;
  const rnd = n => { const a = new Uint32Array(1); const lim = Math.floor(4294967296 / n) * n; let x; do{ crypto.getRandomValues(a); x = a[0]; } while(x >= lim); return x % n; };
  const len = $('#pLen', root), type = $('#pType', root);
  function make(){
    const L = +len.value; let s = '', pool = '';
    if(type.value === 'pw'){
      const sets = {pUp:'ABCDEFGHIJKLMNOPQRSTUVWXYZ', pLo:'abcdefghijklmnopqrstuvwxyz', pNu:'0123456789', pSy:'!@#$%^&*()-_=+[]{};:,.<>?/'};
      const chosen = Object.keys(sets).filter(k => $('#'+k, root).checked).map(k => sets[k]);
      if(!chosen.length){ return {s:'Ən azı bir seçim edin', bits:0}; }
      const amb = /[O0lI1]/g;
      const clean = x => $('#pAm', root).checked ? x.replace(amb,'') : x;
      const groups = chosen.map(clean); pool = groups.join('');
      const arr = groups.map(g => g[rnd(g.length)]);             // hər seçilmiş qrupdan ən azı 1 simvol
      while(arr.length < L) arr.push(pool[rnd(pool.length)]);
      for(let i = arr.length-1; i > 0; i--){ const j = rnd(i+1); [arr[i],arr[j]] = [arr[j],arr[i]]; }   // qarışdır
      s = arr.slice(0, L).join('');
      return {s, bits: Math.log2(pool.length) * L};
    }
    if(type.value === 'hex'){ pool = '0123456789abcdef'; for(let i=0;i<L;i++) s += pool[rnd(16)]; return {s, bits: 4*L}; }
    pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; for(let i=0;i<L;i++) s += pool[rnd(64)]; return {s, bits: 6*L};
  }
  function gen(){
    $('#pLv', root).textContent = len.value; $('#pOpts', root).style.display = type.value === 'pw' ? '' : 'none';
    const r = make(); $('#pOut', root).textContent = r.s;
    const b = r.bits, lvl = b < 40 ? ['Zəif','var(--danger)',20] : b < 64 ? ['Orta','#fbbf24',50] : b < 100 ? ['Güclü','var(--cyan)',78] : ['Çox güclü','var(--lime)',100];
    const m = $('#pMeter', root); m.style.width = lvl[2] + '%'; m.style.background = lvl[1];
    $('#pInfo', root).textContent = `Güc: ${lvl[0]} · ~${Math.round(b)} bit entropiya`;
  }
  $$('input,select', root).forEach(e => e.addEventListener('input', gen));
  $('#pGen', root).onclick = gen;
  $('#pCopy', root).onclick = () => copyText($('#pOut', root).textContent);
  $('#pDl', root).onclick = () => { let o = []; for(let i=0;i<5;i++) o.push(make().s); downloadText(o.join('\n'), 'parollar.txt'); };
  gen();
}

/* ---------- 4. QR KOD GENERATORU ---------- */
function initQR(root){
  root.innerHTML = `
    <label>Link və ya mətn</label><textarea id="qText" style="min-height:90px" placeholder="https://saytiniz.com"></textarea>
    <div class="row">
      <div><label>Ölçü: <span id="qSv">256</span>px</label><input type="range" id="qSize" min="128" max="512" step="16" value="256"></div>
      <div><label>Düzəliş səviyyəsi</label><select id="qLvl"><option value="L">L (aşağı)</option><option value="M">M</option><option value="Q">Q</option><option value="H" selected>H (yüksək)</option></select></div>
    </div>
    <div class="row">
      <div><label>QR rəngi</label><input type="color" id="qFg" value="#000000"></div>
      <div><label>Fon rəngi</label><input type="color" id="qBg" value="#ffffff"></div>
    </div>
    <div class="btns"><button class="btn" id="qGo">⚡ Yarat</button><button class="btn alt" id="qDl">⬇ PNG endir</button><button class="btn ghost" id="qCp">📋 Mətni kopyala</button></div>
    <div class="qr-box" id="qBox"><span class="status">QR kod burada görünəcək</span></div>`;
  const T = $('#qText', root), box = $('#qBox', root);
  function make(){
    if(typeof QRCode === 'undefined'){ toast('QR kitabxanası yüklənmədi (internet?)'); return; }
    const v = T.value.trim(); box.innerHTML = '';
    if(!v){ box.innerHTML = '<span class="status">QR kod burada görünəcək</span>'; return; }
    const s = +$('#qSize', root).value;
    new QRCode(box, {text:v, width:s, height:s, colorDark:$('#qFg', root).value, colorLight:$('#qBg', root).value, correctLevel:QRCode.CorrectLevel[$('#qLvl', root).value]});
  }
  let t; T.oninput = () => { clearTimeout(t); t = setTimeout(make, 250); };   // yazdıqca anında yaranır
  $$('input[type=range],input[type=color],select', root).forEach(e => e.addEventListener('input', () => { $('#qSv', root).textContent = $('#qSize', root).value; make(); }));
  $('#qGo', root).onclick = make;
  $('#qDl', root).onclick = () => {
    const c = $('canvas', box), i = $('img', box); const src = c ? c.toDataURL('image/png') : (i && i.src);
    if(!src){ toast('Əvvəlcə QR kod yaradın'); return; } downloadURL(src, 'qr-kod.png');
  };
  $('#qCp', root).onclick = () => copyText(T.value);
}

/* ---------- 5. RƏNG PALİTRASI ---------- */
function initColor(root){
  root.innerHTML = `
    <div class="row"><div><label>Sxem</label><select id="cScheme">
      <option value="random">Təsadüfi gözəl</option><option value="analogous">Analoq</option><option value="complementary">Komplementar</option><option value="triad">Triada</option><option value="mono">Monoxrom</option></select></div></div>
    <div class="btns"><button class="btn" id="cGen">🎲 Yarat (Space)</button><button class="btn alt" id="cAll">📋 Hamısını kopyala</button><button class="btn ghost" id="cCss">⬇ CSS endir</button></div>
    <div class="swatches" id="cSw"></div><div class="status">Rəngə klikləyin → HEX kopyalanır. 🔒 ilə rəngi kilidləyin.</div>`;
  let cols = Array.from({length:5}, () => ({hex:'#000000', locked:false}));
  const h2x = (h,s,l) => { s/=100; l/=100; const k = n => (n + h/30) % 12, a = s*Math.min(l,1-l), f = n => l - a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return '#' + [f(0),f(8),f(4)].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join(''); };
  const ink = hex => { const n = parseInt(hex.slice(1),16), r = n>>16, g = n>>8&255, b = n&255; return (r*.299+g*.587+b*.114) > 150 ? '#111' : '#fff'; };
  const R = (a,b) => Math.floor(a + Math.random()*(b-a+1));
  function palette(){
    const sch = $('#cScheme', root).value, h = R(0,359), out = [];
    for(let i=0;i<5;i++){
      let hh, s = R(55,90), l = R(38,68);
      if(sch==='random'){ hh = (h + i*R(35,80)) % 360; }
      else if(sch==='analogous'){ hh = (h + i*28) % 360; }
      else if(sch==='complementary'){ hh = (i%2 ? h+180 : h) % 360; l = 30 + i*10; }
      else if(sch==='triad'){ hh = (h + [0,120,240,0,120][i]) % 360; l = i>2 ? l+14 : l; }
      else { hh = h; s = R(45,75); l = 18 + i*16; }
      out.push(h2x(hh,s,Math.min(l,92)));
    }
    cols.forEach((c,i) => { if(!c.locked) c.hex = out[i]; }); draw();
  }
  function draw(){
    $('#cSw', root).innerHTML = cols.map((c,i) => `<div class="sw" data-i="${i}" style="background:${c.hex};color:${ink(c.hex)}">
      <button data-lock="${i}" title="Kilidlə">${c.locked?'🔒':'🔓'}</button><span>${c.hex.toUpperCase()}</span></div>`).join('');
    $$('.sw', root).forEach(el => el.onclick = e => { if(e.target.dataset.lock !== undefined) return; copyText(cols[el.dataset.i].hex.toUpperCase()); });
    $$('[data-lock]', root).forEach(b => b.onclick = e => { e.stopPropagation(); const c = cols[b.dataset.lock]; c.locked = !c.locked; draw(); });
  }
  $('#cGen', root).onclick = palette;
  $('#cScheme', root).onchange = palette;
  $('#cAll', root).onclick = () => copyText(cols.map(c => c.hex.toUpperCase()).join(', '));
  $('#cCss', root).onclick = () => downloadText(':root{\n' + cols.map((c,i) => `  --color-${i+1}: ${c.hex.toUpperCase()};`).join('\n') + '\n}\n', 'palitra.css');
  document.addEventListener('keydown', e => {   // Space ilə yeni palitra (yalnız bu alət açıqdırsa)
    if(e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)){ e.preventDefault(); palette(); }
  });
  palette();
}

/* ---------- 6. AI PROMPT TƏKMİLLƏŞDİRİCİ ---------- */
function initPrompt(root){
  root.innerHTML = `
    <label>Əsas ideyanız (qısa)</label><textarea id="prIdea" style="min-height:90px" placeholder="məs: instagram üçün kofe şopu reklamı yaz"></textarea>
    <div class="row">
      <div><label>AI-nin rolu</label><input type="text" id="prRole" placeholder="məs: təcrübəli marketoloq"></div>
      <div><label>Hədəf auditoriya</label><input type="text" id="prAud" placeholder="məs: 18-30 yaşlı gənclər"></div>
    </div>
    <div class="row">
      <div><label>Ton</label><select id="prTone"><option value="peşəkar">Peşəkar</option><option value="dostcasına">Dostcasına</option><option value="rəsmi">Rəsmi</option><option value="yaradıcı">Yaradıcı</option><option value="qısa və konkret">Qısa və konkret</option></select></div>
      <div><label>Çıxış formatı</label><select id="prFmt"><option value="mətn">Mətn</option><option value="maddələr (bullet list)">Maddələr</option><option value="cədvəl">Cədvəl</option><option value="addım-addım plan">Addım-addım plan</option><option value="kod bloku">Kod</option></select></div>
      <div><label>Cavab dili</label><select id="prLang"><option value="Azərbaycan dilində">Azərbaycan</option><option value="English">English</option><option value="Türkçe">Türkçe</option><option value="на русском языке">Русский</option></select></div>
    </div>
    <label>Məhdudiyyətlər (istəyə bağlı)</label><input type="text" id="prCon" placeholder="məs: max 100 söz, emoji istifadə etmə">
    <div class="btns"><button class="btn" id="prGo">✨ Təkmilləşdir</button><button class="btn alt" id="prCp">📋 Kopyala</button><button class="btn ghost" id="prDl">⬇ .txt</button></div>
    <div class="out" id="prOut">Nəticə burada görünəcək...</div>`;
  const v = id => $('#'+id, root).value.trim();
  $('#prGo', root).onclick = () => {
    if(!v('prIdea')){ toast('İdeyanı yazın'); return; }
    const L = [];
    L.push(`# Rol\nSən ${v('prRole') || 'sahəsində təcrübəli mütəxəssis'} kimi çıxış edirsən.`);
    L.push(`# Tapşırıq\n${v('prIdea')}`);
    L.push(`# Kontekst\n${v('prAud') ? '- Hədəf auditoriya: ' + v('prAud') + '\n' : ''}- Ton: ${v('prTone')}\n- Cavabı ${v('prLang')} yaz.`);
    L.push(`# Çıxış formatı\n${v('prFmt')} şəklində təqdim et.`);
    L.push(`# Qaydalar\n- Dəqiq, konkret və praktik ol; lazımsız girişdən qaç.\n- Məlumat çatışmırsa, əvvəlcə 2–3 aydınlaşdırıcı sual ver.\n- Mümkün olduqda nümunə əlavə et.${v('prCon') ? '\n- ' + v('prCon') : ''}`);
    L.push(`# Yoxlama\nCavab verməzdən əvvəl yuxarıdakı bütün tələblərin yerinə yetirildiyini yoxla.`);
    $('#prOut', root).textContent = L.join('\n\n');
  };
  $('#prCp', root).onclick = () => { const t = $('#prOut', root).textContent; copyText(t.startsWith('Nəticə') ? '' : t); };
  $('#prDl', root).onclick = () => { const t = $('#prOut', root).textContent; downloadText(t.startsWith('Nəticə') ? '' : t, 'prompt.txt'); };
}

/* ---------- 7. VAHİD & VALYUTA KONVERTORU ---------- */
function initConv(root){
  const UNITS = {
    length:{name:'Uzunluq', u:{mm:.001,cm:.01,m:1,km:1000,inç:.0254,fut:.3048,yard:.9144,mil:1609.344}},
    weight:{name:'Çəki', u:{mg:1e-6,q:.001,kq:1,ton:1000,unsiya:.028349523,funt:.45359237}},
    temp:{name:'Temperatur', u:{'°C':1,'°F':1,'K':1}},
    currency:{name:'Valyuta', u:{}}
  };
  // Oflayn ehtiyat məzənnələri (1 USD = ?). Canlı məzənnə yüklənərsə, avtomatik yenilənir.
  let rates = {USD:1, EUR:.92, AZN:1.70, TRY:41, RUB:95, GBP:.78, GEL:2.7, JPY:150, CNY:7.2, AED:3.67};
  UNITS.currency.u = Object.fromEntries(Object.keys(rates).map(k => [k,1]));
  root.innerHTML = `
    <label>Kateqoriya</label><select id="cvCat">${Object.entries(UNITS).map(([k,v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
    <div class="row" style="align-items:end">
      <div><label>Dəyər</label><input type="number" id="cvVal" value="1" step="any"></div>
      <div><label>Hardan</label><select id="cvFrom"></select></div>
      <div><label>Hara</label><select id="cvTo"></select></div>
    </div>
    <div class="btns"><button class="btn ghost" id="cvSwap">⇄ Yerlərini dəyiş</button><button class="btn alt" id="cvCp">📋 Nəticəni kopyala</button></div>
    <div class="out" id="cvOut" style="font-size:1.4rem"></div><div class="status" id="cvSt"></div>`;
  const cat = $('#cvCat', root), val = $('#cvVal', root), from = $('#cvFrom', root), to = $('#cvTo', root);
  function fill(){
    const keys = Object.keys(UNITS[cat.value].u), opt = keys.map(k => `<option>${k}</option>`).join('');
    from.innerHTML = opt; to.innerHTML = opt; to.selectedIndex = Math.min(1, keys.length-1);
    if(cat.value === 'currency'){ from.value = 'USD'; to.value = 'AZN'; }
    calc();
  }
  function calc(){
    const c = cat.value, x = parseFloat(val.value), a = from.value, b = to.value; let r;
    if(isNaN(x)){ $('#cvOut', root).textContent = '—'; return; }
    if(c === 'temp'){
      let C = a==='°C' ? x : a==='°F' ? (x-32)*5/9 : x-273.15;
      r = b==='°C' ? C : b==='°F' ? C*9/5+32 : C+273.15;
    } else if(c === 'currency'){ r = x / rates[a] * rates[b]; }
    else { r = x * UNITS[c].u[a] / UNITS[c].u[b]; }
    $('#cvOut', root).textContent = `${x} ${a} = ${+r.toPrecision(10)} ${b}`;
    $('#cvSt', root).textContent = c === 'currency' ? rateStatus : '';
  }
  let rateStatus = 'Valyuta: oflayn təxmini məzənnələr (canlı məzənnə yüklənir...)';
  fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(d => {
    if(d && d.rates){ Object.keys(rates).forEach(k => { if(d.rates[k]) rates[k] = d.rates[k]; }); rateStatus = '✓ Canlı məzənnə yeniləndi: ' + (d.time_last_update_utc || '').slice(0,16); calc(); }
  }).catch(() => { rateStatus = 'Valyuta: oflayn təxmini məzənnələr (canlı məzənnə əlçatan deyil)'; calc(); });
  cat.onchange = fill; [val, from, to].forEach(e => e.addEventListener('input', calc));
  $('#cvSwap', root).onclick = () => { const t = from.value; from.value = to.value; to.value = t; calc(); };
  $('#cvCp', root).onclick = () => copyText($('#cvOut', root).textContent);
  fill();
}

/* ---------- 8. SANİYƏÖLÇƏN / TAYMER / SAYĞAC ---------- */
function initTimer(root){
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="sw">Saniyəölçən</button><button class="tab" data-m="tm">Taymer</button><button class="tab" data-m="ct">Sayğac</button></div>

    <div data-v="sw">
      <div class="big-time" id="swD">00:00:00.00</div>
      <div class="btns" style="justify-content:center"><button class="btn" id="swS">▶ Başla</button><button class="btn alt" id="swL">⚑ Dövrə</button><button class="btn ghost" id="swR">↺ Sıfırla</button></div>
      <div class="laps" id="swLaps"></div>
      <div class="btns"><button class="btn sm ghost" id="swCp">📋 Dövrələri kopyala</button><button class="btn sm ghost" id="swDl">⬇ .txt</button></div>
    </div>

    <div data-v="tm" hidden>
      <div class="big-time" id="tmD">00:05:00</div>
      <div class="row"><div><label>Saat</label><input type="number" id="tmH" min="0" value="0"></div><div><label>Dəqiqə</label><input type="number" id="tmM" min="0" value="5"></div><div><label>Saniyə</label><input type="number" id="tmSe" min="0" value="0"></div></div>
      <div class="btns" style="justify-content:center"><button class="btn" id="tmS">▶ Başla</button><button class="btn ghost" id="tmR">↺ Sıfırla</button>
        <button class="btn sm ghost" data-q="60">1 dəq</button><button class="btn sm ghost" data-q="300">5 dəq</button><button class="btn sm ghost" data-q="1500">25 dəq</button></div>
    </div>

    <div data-v="ct" hidden>
      <div class="big-time" id="ctD">0</div>
      <div class="row"><div><label>Addım</label><input type="number" id="ctStep" value="1" min="1"></div></div>
      <div class="btns" style="justify-content:center"><button class="btn" id="ctM">− Azalt</button><button class="btn alt" id="ctP">+ Artır</button><button class="btn ghost" id="ctR">↺ Sıfırla</button></div>
    </div>`;
  // Alt-tab keçidi
  $$('[data-m]', root).forEach(b => b.onclick = () => {
    $$('[data-m]', root).forEach(x => x.classList.toggle('active', x === b));
    $$('[data-v]', root).forEach(v => v.hidden = v.dataset.v !== b.dataset.m);
  });

  /* --- Saniyəölçən --- */
  let swT = 0, swRun = false, swStart = 0, swRaf = 0, laps = [];
  const fmtSW = ms => `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)}.${pad(Math.floor(ms/10)%100)}`;
  const tickSW = () => { $('#swD', root).textContent = fmtSW(swT + performance.now() - swStart); swRaf = requestAnimationFrame(tickSW); };
  $('#swS', root).onclick = () => {
    if(!swRun){ swRun = true; swStart = performance.now(); tickSW(); $('#swS', root).textContent = '⏸ Dayandır'; }
    else { swRun = false; cancelAnimationFrame(swRaf); swT += performance.now() - swStart; $('#swS', root).textContent = '▶ Davam et'; }
  };
  $('#swL', root).onclick = () => {
    if(!swRun && !swT) return; const cur = swT + (swRun ? performance.now() - swStart : 0);
    laps.unshift({n: laps.length+1, t: cur}); $('#swLaps', root).innerHTML = laps.map(l => `<div><span>#${l.n}</span><span>${fmtSW(l.t)}</span></div>`).join('');
  };
  $('#swR', root).onclick = () => { swRun = false; cancelAnimationFrame(swRaf); swT = 0; laps = []; $('#swD', root).textContent = '00:00:00.00'; $('#swLaps', root).innerHTML = ''; $('#swS', root).textContent = '▶ Başla'; };
  const lapTxt = () => laps.slice().reverse().map(l => `#${l.n} ${fmtSW(l.t)}`).join('\n');
  $('#swCp', root).onclick = () => copyText(lapTxt());
  $('#swDl', root).onclick = () => downloadText(lapTxt(), 'dovreler.txt');

  /* --- Taymer --- */
  let tmLeft = 300, tmRun = false, tmEnd = 0, tmInt = 0;
  const fmtTM = s => `${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`;
  const setFromInputs = () => { tmLeft = (+$('#tmH', root).value||0)*3600 + (+$('#tmM', root).value||0)*60 + (+$('#tmSe', root).value||0); $('#tmD', root).textContent = fmtTM(tmLeft); };
  function beep(){
    try{ const ac = new (window.AudioContext || window.webkitAudioContext)(); [0,.35,.7].forEach(d => { const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(.2, ac.currentTime+d); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime+d+.3); o.start(ac.currentTime+d); o.stop(ac.currentTime+d+.3); }); }catch(e){}
  }
  $$('#tmH,#tmM,#tmSe', root).forEach(i => i.oninput = () => { if(!tmRun) setFromInputs(); });
  $$('[data-q]', root).forEach(b => b.onclick = () => { if(tmRun) return; const s = +b.dataset.q; $('#tmH', root).value = 0; $('#tmM', root).value = Math.floor(s/60); $('#tmSe', root).value = s%60; setFromInputs(); });
  $('#tmS', root).onclick = () => {
    if(!tmRun){
      if(tmLeft <= 0){ setFromInputs(); if(tmLeft <= 0) return; }
      tmRun = true; tmEnd = Date.now() + tmLeft*1000; $('#tmS', root).textContent = '⏸ Dayandır';
      tmInt = setInterval(() => {
        tmLeft = Math.max(0, Math.round((tmEnd - Date.now())/1000)); $('#tmD', root).textContent = fmtTM(tmLeft);
        if(tmLeft <= 0){ clearInterval(tmInt); tmRun = false; $('#tmS', root).textContent = '▶ Başla'; beep(); toast('⏰ Vaxt bitdi!'); }
      }, 250);
    } else { clearInterval(tmInt); tmRun = false; $('#tmS', root).textContent = '▶ Davam et'; }
  };
  $('#tmR', root).onclick = () => { clearInterval(tmInt); tmRun = false; $('#tmS', root).textContent = '▶ Başla'; setFromInputs(); };
  setFromInputs();

  /* --- Sayğac --- */
  let ct = 0; const ctShow = () => $('#ctD', root).textContent = ct;
  $('#ctP', root).onclick = () => { ct += +$('#ctStep', root).value || 1; ctShow(); };
  $('#ctM', root).onclick = () => { ct -= +$('#ctStep', root).value || 1; ctShow(); };
  $('#ctR', root).onclick = () => { ct = 0; ctShow(); };
}


/* ---------- 9. ARAŞDIRMA KÖMƏKÇİSİ (Wikipedia + Crossref) ---------- */
function initResearch(root){
  const MAIL = 'info@webfixer.space';               // Crossref "polite pool" üçün əlaqə e-poçtu
  const LANGS = {az:'Azərbaycan dili', en:'English', tr:'Türkçe', ru:'Русский'};
  const HIST_KEY = 'mt_research_hist';

  root.innerHTML = `
    <label for="rQ">Mövzu və ya sual</label>
    <input type="text" id="rQ" placeholder="məs: iqlim dəyişikliyi və kənd təsərrüfatı" autocomplete="off" maxlength="200">
    <div class="row">
      <div><label for="rLang">Wikipedia dili</label>
        <select id="rLang">${Object.entries(LANGS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label for="rSort">Məqalələrin sıralanması</label>
        <select id="rSort"><option value="rel">Uyğunluğa görə</option><option value="cited">Ən çox istinad edilən</option><option value="new">Ən yeni</option></select></div>
      <div><label for="rYear">İldən etibarən</label>
        <input type="number" id="rYear" min="1900" max="2100" placeholder="məs: 2015"></div>
    </div>
    <label class="check"><input type="checkbox" id="rJournal" checked> Yalnız jurnal məqalələri</label>
    <div class="btns"><button class="btn" id="rGo">🔬 Axtar</button><button class="btn ghost" id="rClr">Təmizlə</button></div>
    <div class="r-hist" id="rHist"></div>
    <div id="rOut" aria-live="polite"></div>`;

  const qEl = $('#rQ', root), langEl = $('#rLang', root), sortEl = $('#rSort', root), yearEl = $('#rYear', root);
  const jEl = $('#rJournal', root), goBtn = $('#rGo', root), out = $('#rOut', root), histEl = $('#rHist', root);
  let reqId = 0, papersNow = [];

  /* --- kiçik DOM köməkçisi: mətn həmişə textContent kimi yazılır (XSS-dən qorunur) --- */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs)){
      if(k === 'class') el.className = v; else if(k === 'text') el.textContent = v; else el.setAttribute(k, v);
    }
    kids.flat().forEach(c => { if(c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  };
  const plain = s => new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.trim(); // <i>, &amp; kimi şeyləri təmizləyir

  async function getJSON(url){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try{
      const r = await fetch(url, {signal: ctl.signal});
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /* --- Wikipedia: ilk 3 nəticənin giriş mətni --- */
  async function wiki(query, lang){
    if(!LANGS[lang]) lang = 'en';
    const p = new URLSearchParams({action:'query', generator:'search', gsrsearch:query, gsrlimit:'3', prop:'extracts|info',
      exintro:'1', explaintext:'1', exsentences:'4', exlimit:'3', inprop:'url', format:'json', formatversion:'2', origin:'*'});
    const d = await getJSON(`https://${lang}.wikipedia.org/w/api.php?` + p);
    const pages = (d.query && d.query.pages) || [];
    return pages.slice().sort((a, b) => (a.index || 0) - (b.index || 0))
      .filter(x => x.extract && /^https:\/\/[a-z-]+\.wikipedia\.org\//.test(x.fullurl || ''))
      .map(x => ({title: x.title, extract: x.extract.trim(), url: x.fullurl}));
  }

  /* --- Crossref: elmi məqalələr --- */
  async function crossref(query, sort, year, journalOnly){
    const p = new URLSearchParams({query, rows:'10', mailto:MAIL,
      select:'DOI,title,author,issued,container-title,is-referenced-by-count,type'});
    if(sort === 'cited'){ p.set('sort', 'is-referenced-by-count'); p.set('order', 'desc'); }
    if(sort === 'new'){ p.set('sort', 'published'); p.set('order', 'desc'); }
    const f = [];
    if(journalOnly) f.push('type:journal-article');
    if(year) f.push('from-pub-date:' + year);
    if(f.length) p.set('filter', f.join(','));
    const d = await getJSON('https://api.crossref.org/works?' + p);
    const items = (d.message && d.message.items) || [];
    return items.map(it => {
      const title = plain(it.title && it.title[0]);
      if(!title || !it.DOI) return null;
      const dp = it.issued && it.issued['date-parts'] && it.issued['date-parts'][0];
      return {title, doi: String(it.DOI), year: dp && dp[0] ? dp[0] : null,
        venue: plain(it['container-title'] && it['container-title'][0]),
        cites: it['is-referenced-by-count'] || 0,
        authors: (it.author || []).map(a => ({family: plain(a.family), given: plain(a.given), name: plain(a.name)}))};
    }).filter(Boolean);
  }

  /* --- sitat (APA-ə yaxın) --- */
  const initials = g => (g || '').split(/[\s.-]+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ');
  function fmtAuthors(a){
    const names = a.map(x => x.family ? x.family + (x.given ? ', ' + initials(x.given) : '') : x.name).filter(Boolean);
    if(!names.length) return '';
    if(names.length > 6) return names.slice(0, 6).join(', ') + ', et al.';
    if(names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  }
  function cite(p){
    const au = fmtAuthors(p.authors);
    return [(au ? au + ' ' : '') + '(' + (p.year || 't.y.') + ').', p.title.replace(/[.?!]+$/, '') + '.',
      p.venue ? p.venue + '.' : '', 'https://doi.org/' + p.doi].filter(Boolean).join(' ');
  }

  /* --- son axtarışlar (yalnız bu brauzerdə) --- */
  function loadHist(){ try{ return JSON.parse(localStorage.getItem(HIST_KEY)) || []; }catch(e){ return []; } }
  function saveHist(v){
    try{ const a = [v, ...loadHist().filter(x => x !== v)].slice(0, 6); localStorage.setItem(HIST_KEY, JSON.stringify(a)); }catch(e){}
    drawHist();
  }
  function drawHist(){
    const a = loadHist(); histEl.replaceChildren();
    if(!a.length) return;
    histEl.append(h('span', {class:'status', text:'Son axtarışlar:'}));
    a.forEach(v => histEl.append(h('button', {class:'chip', type:'button', text:v})));
    $$('.chip', histEl).forEach(b => b.onclick = () => { qEl.value = b.textContent; run(); });
  }

  /* --- nəticələrin çəkilməsi --- */
  const msg = (cls, text) => h('p', {class:'r-msg ' + cls, text});
  function section(title, ...kids){ return h('section', {class:'r-sec'}, h('h3', {text:title}), ...kids); }

  function render(query, w, c){
    out.replaceChildren();
    out.append(h('p', {class:'status'}, 'Mənbələr: ', h('a', {href:'https://www.wikipedia.org', target:'_blank', rel:'noopener noreferrer', text:'Wikipedia'}),
      ' (CC BY-SA 4.0) və ', h('a', {href:'https://www.crossref.org', target:'_blank', rel:'noopener noreferrer', text:'Crossref'}),
      '. Məlumatı mənbədə yoxlayın.'));

    // 1) Wikipedia
    const wk = [];
    if(w.status === 'rejected') wk.push(msg('err', 'Wikipedia-ya qoşulmaq alınmadı. İnternetinizi yoxlayıb bir azdan yenidən cəhd edin.'));
    else if(!w.value.length) wk.push(msg('', 'Wikipedia-da bu dildə uyğun məqalə tapılmadı. Başqa dil və ya fərqli açar sözlər yoxlayın.'));
    else w.value.forEach(x => wk.push(h('article', {class:'r-card'}, h('h4', {text:x.title}),
      h('p', {text:x.extract}), h('a', {href:x.url, target:'_blank', rel:'noopener noreferrer', text:'Wikipedia-da oxu →'}))));
    out.append(section('📖 Wikipedia', ...wk));

    // 2) Elmi məqalələr
    const ck = [];
    papersNow = [];
    if(c.status === 'rejected') ck.push(msg('err', 'Crossref-ə qoşulmaq alınmadı. Bir azdan yenidən cəhd edin.'));
    else if(!c.value.length) ck.push(msg('', 'Elmi məqalə tapılmadı. Açar sözləri ingilis dilində yazın, ili və ya "Yalnız jurnal məqalələri" seçimini dəyişin.'));
    else {
      papersNow = c.value;
      ck.push(h('div', {class:'btns r-tools'},
        h('button', {class:'btn sm', type:'button', id:'rCopyAll', text:'📋 Hamısını sitat kimi kopyala'}),
        h('button', {class:'btn sm alt', type:'button', id:'rDl', text:'⬇ .txt endir'})));
      c.value.forEach((p, i) => {
        const au = p.authors.map(a => a.family ? (a.given ? a.given + ' ' : '') + a.family : a.name).filter(Boolean);
        const authors = au.length > 3 ? au.slice(0, 3).join(', ') + ' və b.' : au.join(', ');
        ck.push(h('article', {class:'r-card paper'},
          h('h4', {}, h('a', {href:'https://doi.org/' + encodeURI(p.doi), target:'_blank', rel:'noopener noreferrer', text:p.title})),
          h('p', {class:'r-meta', text:[authors, p.year, p.venue].filter(Boolean).join(' · ')}),
          h('div', {class:'r-row'},
            h('span', {class:'r-badge', text:p.cites + ' istinad'}),
            h('button', {class:'btn sm ghost', type:'button', 'data-cite':i, text:'Sitat'}),
            h('button', {class:'btn sm ghost', type:'button', 'data-doi':i, text:'DOI'}))));
      });
    }
    out.append(section('📚 Elmi məqalələr', ...ck));

    // 3) Başqa bazalar
    const e = encodeURIComponent(query), ext = (href, text) => h('a', {class:'btn sm ghost', href, target:'_blank', rel:'noopener noreferrer', text});
    out.append(section('🔗 Başqa mənbələrdə axtar', h('div', {class:'btns'},
      ext('https://scholar.google.com/scholar?q=' + e, 'Google Scholar'),
      ext('https://www.semanticscholar.org/search?q=' + e, 'Semantic Scholar'),
      ext('https://core.ac.uk/search?q=' + e, 'CORE (açıq mətnlər)'))));

    $$('[data-cite]', out).forEach(b => b.onclick = () => copyText(cite(papersNow[+b.dataset.cite])));
    $$('[data-doi]', out).forEach(b => b.onclick = () => copyText('https://doi.org/' + papersNow[+b.dataset.doi].doi));
    const all = () => papersNow.map((p, i) => (i + 1) + '. ' + cite(p)).join('\n\n');
    const ca = $('#rCopyAll', out), dl = $('#rDl', out);
    if(ca) ca.onclick = () => copyText(all());
    if(dl) dl.onclick = () => downloadText(all(), 'menbeler.txt');
  }

  async function run(){
    const query = qEl.value.trim();
    if(query.length < 2){ toast('Axtarış sözü yazın'); qEl.focus(); return; }
    const y = parseInt(yearEl.value, 10), year = y >= 1900 && y <= 2100 ? y : '';
    const id = ++reqId;
    saveHist(query);
    goBtn.disabled = true; goBtn.textContent = '⏳ Axtarılır…';
    out.replaceChildren(h('p', {class:'status', text:'🔎 Mənbələr yoxlanılır…'}));
    const [w, c] = await Promise.allSettled([wiki(query, langEl.value), crossref(query, sortEl.value, year, jEl.checked)]);
    if(id !== reqId) return;                       // köhnə sorğunun cavabı ignor edilir
    goBtn.disabled = false; goBtn.textContent = '🔬 Axtar';
    render(query, w, c);
  }

  goBtn.onclick = run;
  qEl.addEventListener('keydown', e => { if(e.key === 'Enter') run(); });
  $('#rClr', root).onclick = () => { reqId++; qEl.value = ''; yearEl.value = ''; out.replaceChildren(); papersNow = []; goBtn.disabled = false; goBtn.textContent = '🔬 Axtar'; qEl.focus(); };
  drawHist();
}
