/* =====================================================================
   WebFixer — əlavə 10 alət
   Audio konvertor, Şəkil → PDF, CSV ⇄ JSON, Say sistemləri və Roma rəqəmləri,
   Saat qurşağı, Kredit, GPA, Pomodoro, Hash generatoru, Yazı sürəti testi.
   Hamısı brauzerdə işləyir (fayllar serverə göndərilmir).
   common.js ($, $$, toast, copyText, downloadBlob, fmtBytes, pad) və
   tools-extra.js (nf, mf, readNum, bindTabs, statBox) tələb olunur.
   ===================================================================== */

/* ---------- Ümumi köməkçilər ---------- */
function wfmDrop(root, sel, accept, multiple, label, onFiles){
  const d = $(sel, root);
  d.innerHTML = label + '<input type="file" accept="' + accept + '"' + (multiple ? ' multiple' : '') + ' hidden>';
  const inp = $('input', d);
  d.onclick = () => inp.click();
  inp.onchange = () => { if(inp.files.length) onFiles([...inp.files]); inp.value = ''; };
  ['dragover', 'dragenter'].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', ev => { const f = [...ev.dataTransfer.files]; if(f.length) onFiles(multiple ? f : [f[0]]); });
}
const wfmEsc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const wfmSleep = ms => new Promise(r => setTimeout(r, ms));
function wfmBaseName(n){ return n.replace(/\.[^.]+$/, '') || 'fayl'; }

/* =====================================================================
   1. AUDIO KONVERTOR  (MP3 / OGG / WAV)
   ===================================================================== */
function encodeWav(chs, sr){
  const n = chs[0].length, nch = chs.length, bytes = n * nch * 2;
  const buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
  const w = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nch * 2, true); v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for(let i = 0; i < n; i++) for(let c = 0; c < nch; c++){
    const s = Math.max(-1, Math.min(1, chs[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([buf], {type: 'audio/wav'});
}

// Ogg CRC32 (polinom 0x04C11DB7, əks çevrilməyən)
const OGG_CRC = (() => {
  const t = new Uint32Array(256);
  for(let i = 0; i < 256; i++){ let r = i << 24; for(let k = 0; k < 8; k++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04C11DB7) : (r << 1); t[i] = r >>> 0; }
  return t;
})();
function oggCrc(bytes){ let c = 0; for(let i = 0; i < bytes.length; i++) c = ((c << 8) ^ OGG_CRC[((c >>> 24) & 0xff) ^ bytes[i]]) >>> 0; return c >>> 0; }

function oggPage(packets, granule, serial, seq, flags){
  const segs = [];
  packets.forEach(p => { let l = p.length; while(l >= 255){ segs.push(255); l -= 255; } segs.push(l); });
  let dataLen = 0; packets.forEach(p => dataLen += p.length);
  const out = new Uint8Array(27 + segs.length + dataLen), v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, flags], 0);
  v.setUint32(6, granule % 4294967296, true); v.setUint32(10, Math.floor(granule / 4294967296), true);
  v.setUint32(14, serial, true); v.setUint32(18, seq, true); v.setUint32(22, 0, true);
  out[26] = segs.length; out.set(segs, 27);
  let o = 27 + segs.length; packets.forEach(p => { out.set(p, o); o += p.length; });
  v.setUint32(22, oggCrc(out), true);
  return out;
}
// packets: Opus paketləri (Uint8Array[]), samples: hər paketdə 48 kHz nümunə sayı, inputSamples: orijinal uzunluq (48 kHz)
function oggOpusMux(packets, samples, o){
  const ch = o.channels, pre = o.preSkip, inRate = o.inputRate || 48000, serial = o.serial || 0x57464d58;
  const head = new Uint8Array(19), hv = new DataView(head.buffer);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, ch], 0);
  hv.setUint16(10, pre, true); hv.setUint32(12, inRate, true); hv.setInt16(16, 0, true); head[18] = 0;
  const vendor = new TextEncoder().encode('WebFixer'), tags = new Uint8Array(8 + 4 + vendor.length + 4), tv = new DataView(tags.buffer);
  tags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
  const pages = [oggPage([head], 0, serial, 0, 0x02), oggPage([tags], 0, serial, 1, 0)];
  let seq = 2, i = 0, cum = pre;
  const maxEnd = pre + (o.inputSamples != null ? o.inputSamples : Infinity);
  while(i < packets.length){
    const grp = []; let segCount = 0, g = cum;
    while(i < packets.length && grp.length < 50){
      const sc = Math.floor(packets[i].length / 255) + 1;
      if(segCount + sc > 255) break;
      grp.push(packets[i]); segCount += sc; g += samples[i]; i++;
    }
    cum = g;
    const last = i >= packets.length;
    pages.push(oggPage(grp, last ? Math.min(g, maxEnd) : g, serial, seq++, last ? 0x04 : 0));
  }
  let total = 0; pages.forEach(p => total += p.length);
  const all = new Uint8Array(total); let off = 0; pages.forEach(p => { all.set(p, off); off += p.length; });
  return new Blob([all], {type: 'audio/ogg'});
}

async function opusEncode(chs, bitrate){
  const nch = chs.length, total = chs[0].length, packets = [], samples = [];
  let pre = 312, err = null;
  const enc = new AudioEncoder({
    output: (chunk, meta) => {
      const u = new Uint8Array(chunk.byteLength); chunk.copyTo(u); packets.push(u);
      samples.push(Math.round((chunk.duration || 20000) * 48 / 1000));
      const d = meta && meta.decoderConfig && meta.decoderConfig.description;
      if(d && pre === 312){
        try{ const b = d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
          if(b.length >= 12 && b[0] === 0x4f && b[1] === 0x70) pre = b[10] | (b[11] << 8); }catch(e){}
      }
    },
    error: e => { err = e; }
  });
  enc.configure({codec: 'opus', sampleRate: 48000, numberOfChannels: nch, bitrate});
  const BLOCK = 48000;
  for(let off = 0; off < total && !err; off += BLOCK){
    const n = Math.min(BLOCK, total - off), data = new Float32Array(n * nch);
    for(let c = 0; c < nch; c++) data.set(chs[c].subarray(off, off + n), c * n);
    const ad = new AudioData({format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: nch, timestamp: Math.round(off / 48000 * 1e6), data});
    enc.encode(ad); ad.close();
    while(enc.encodeQueueSize > 6 && !err) await wfmSleep(0);
  }
  if(!err) await enc.flush();
  try{ enc.close(); }catch(e){}
  if(err) throw err;
  if(!packets.length) throw new Error('Kodlayıcı boş nəticə qaytardı');
  return oggOpusMux(packets, samples, {channels: nch, preSkip: pre, inputRate: 48000, inputSamples: total});
}

// Köhnə brauzerlər üçün ehtiyat: real vaxtda MediaRecorder ilə (yalnız ogg/opus dəstəkləyən brauzerlər)
function recordRealtime(ab, mime, bitrate){
  return new Promise((resolve, reject) => {
    const Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
    const src = ctx.createBufferSource(); src.buffer = ab;
    const dst = ctx.createMediaStreamDestination(); src.connect(dst);
    const rec = new MediaRecorder(dst.stream, {mimeType: mime, audioBitsPerSecond: bitrate}), parts = [];
    rec.ondataavailable = e => { if(e.data.size) parts.push(e.data); };
    rec.onstop = () => { ctx.close(); resolve(new Blob(parts, {type: 'audio/ogg'})); };
    rec.onerror = e => { ctx.close(); reject(e.error || new Error('Yazılma xətası')); };
    src.onended = () => setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300);
    rec.start(); src.start();
  });
}

let lamePromise = null;
function loadLame(){
  if(window.lamejs) return Promise.resolve();
  if(!lamePromise) lamePromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
    s.onload = () => window.lamejs ? res() : rej(new Error('lamejs')); s.onerror = () => { lamePromise = null; rej(new Error('lamejs')); };
    document.head.appendChild(s);
  });
  return lamePromise;
}
async function mp3Encode(chs, sr, kbps){
  await loadLame();
  const nch = Math.min(2, chs.length), enc = new lamejs.Mp3Encoder(nch, sr, kbps), out = [];
  const toI16 = a => { const o = new Int16Array(a.length); for(let i = 0; i < a.length; i++){ const s = Math.max(-1, Math.min(1, a[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return o; };
  const L = toI16(chs[0]), R = nch === 2 ? toI16(chs[1]) : null, BS = 1152 * 10;
  for(let i = 0; i < L.length; i += BS){
    const b = nch === 2 ? enc.encodeBuffer(L.subarray(i, i + BS), R.subarray(i, i + BS)) : enc.encodeBuffer(L.subarray(i, i + BS));
    if(b.length) out.push(new Uint8Array(b));
    if((i / BS) % 20 === 0) await wfmSleep(0);
  }
  const f = enc.flush(); if(f.length) out.push(new Uint8Array(f));
  return new Blob(out, {type: 'audio/mpeg'});
}

function initAudio(root){
  root.innerHTML = `
    <div class="drop" id="auDrop"></div>
    <div class="status" id="auInfo">Fayl seçilməyib.</div>
    <div class="row">
      <div><label for="auFmt">Çıxış formatı</label><select id="auFmt"><option value="ogg">OGG (Opus)</option><option value="mp3">MP3</option><option value="wav">WAV (sıxılmamış)</option></select></div>
      <div id="auBrWrap"><label for="auBr">Bitrate</label><select id="auBr"><option value="64">64 kbps (kiçik)</option><option value="96">96 kbps</option><option value="128" selected>128 kbps (tövsiyə)</option><option value="192">192 kbps</option><option value="256">256 kbps (yüksək)</option></select></div>
    </div>
    <label class="check"><input type="checkbox" id="auMono"> Mono (fayl ölçüsü təxminən 2 dəfə kiçilir)</label>
    <div class="btns"><button class="btn" id="auGo">⚙️ Çevir</button></div>
    <div class="results" id="auRes"></div>`;
  let files = [], busy = false;
  const fmt = $('#auFmt', root), info = $('#auInfo', root);
  const showBr = () => $('#auBrWrap', root).hidden = fmt.value === 'wav';
  fmt.onchange = showBr; showBr();
  wfmDrop(root, '#auDrop', 'audio/*,.mp3,.ogg,.oga,.opus,.wav,.m4a,.aac,.flac,.weba', true,
    '🎵 Audio faylları bura sürüşdürün və ya klikləyin<br><small>(MP3, OGG, WAV, M4A, FLAC, AAC — bir neçə fayl seçə bilərsiniz)</small>', fl => {
      files = fl; info.textContent = fl.length + ' fayl seçildi: ' + fl.map(f => f.name + ' (' + fmtBytes(f.size) + ')').join(', ');
    });

  async function convert(file, type, kbps, mono){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) throw new Error('Brauzeriniz audio emalını dəstəkləmir');
    const raw = await file.arrayBuffer(), ctx = new Ctx();
    let ab;
    try{ ab = await ctx.decodeAudioData(raw); }
    catch(e){ throw new Error('Bu faylı açmaq mümkün olmadı (format dəstəklənmir və ya fayl zədəlidir)'); }
    finally{ try{ ctx.close(); }catch(e){} }
    const nch = mono ? 1 : Math.min(2, ab.numberOfChannels);
    let targetRate = ab.sampleRate;
    if(type === 'ogg') targetRate = 48000;
    else if(type === 'mp3' && ![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(targetRate)) targetRate = 44100;
    // Yenidən nümunələmə və kanal sayının dəyişməsi (OfflineAudioContext avtomatik qarışdırır)
    const len = Math.max(1, Math.ceil(ab.duration * targetRate));
    const off = new OfflineAudioContext(nch, len, targetRate), src = off.createBufferSource();
    src.buffer = ab; src.connect(off.destination); src.start();
    const rb = await off.startRendering();
    const chs = []; for(let c = 0; c < nch; c++) chs.push(rb.getChannelData(c));
    if(type === 'wav') return encodeWav(chs, targetRate);
    if(type === 'mp3') return mp3Encode(chs, targetRate, kbps);
    if(typeof AudioEncoder !== 'undefined'){
      let ok = false;
      try{ const s = await AudioEncoder.isConfigSupported({codec: 'opus', sampleRate: 48000, numberOfChannels: nch, bitrate: kbps * 1000}); ok = !!(s && s.supported); }catch(e){}
      if(ok) return opusEncode(chs, kbps * 1000);
    }
    if(typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')){
      toast('Bu brauzerdə çevirmə real vaxtda gedir (səs uzunluğu qədər gözləyin)');
      return recordRealtime(rb, 'audio/ogg;codecs=opus', kbps * 1000);
    }
    throw new Error('Bu brauzer OGG kodlaşdırmasını dəstəkləmir. Chrome, Edge və ya Firefox-un yeni versiyasını yoxlayın, yaxud WAV seçin');
  }

  $('#auGo', root).onclick = async () => {
    if(busy) return;
    if(!files.length){ toast('Əvvəlcə audio fayl seçin'); return; }
    busy = true; $('#auGo', root).disabled = true;
    const type = fmt.value, kbps = +$('#auBr', root).value, mono = $('#auMono', root).checked, box = $('#auRes', root);
    box.innerHTML = '';
    for(const [i, f] of files.entries()){
      const row = document.createElement('div'); row.className = 'res au-row';
      row.innerHTML = '<div><b>' + wfmEsc(f.name) + '</b><span class="au-st">⏳ Emal edilir (' + (i + 1) + '/' + files.length + ')…</span></div>';
      box.appendChild(row);
      if(f.size > 80 * 1048576){ $('.au-st', row).textContent = '⚠ Fayl çox böyükdür (80 MB-dan çox).'; continue; }
      try{
        const blob = await convert(f, type, kbps, mono), name = wfmBaseName(f.name) + '.' + type, url = URL.createObjectURL(blob);
        $('.au-st', row).innerHTML = '✓ ' + fmtBytes(f.size) + ' → <b style="display:inline;color:var(--lime)">' + fmtBytes(blob.size) + '</b> · ' + name;
        const aud = document.createElement('audio'); aud.controls = true; aud.src = url; aud.style.cssText = 'width:100%;margin-top:8px';
        $('div', row).appendChild(aud);
        const b = document.createElement('button'); b.className = 'btn sm alt'; b.textContent = '⬇'; b.setAttribute('aria-label', 'Endir');
        b.onclick = () => downloadBlob(blob, name); row.appendChild(b);
      }catch(e){
        const st = $('.au-st', row); st.textContent = '✕ ' + (e && e.message === 'lamejs' ? 'MP3 kodlayıcısı yüklənmədi (internet bağlantısını yoxlayın). OGG və ya WAV seçə bilərsiniz.' : (e && e.message) || 'Xəta baş verdi'); st.style.color = 'var(--danger)';
      }
    }
    busy = false; $('#auGo', root).disabled = false;
  };
}

/* =====================================================================
   2. ŞƏKİL → PDF
   ===================================================================== */
const PDF_SIZES = {a4: [595.28, 841.89], letter: [612, 792]};
function pdfLayout(iw, ih, opt){
  const mm = 72 / 25.4, mg = (opt.margin || 0) * mm;
  let pw, ph;
  if(opt.size === 'fit'){ pw = iw * 0.75 + 2 * mg; ph = ih * 0.75 + 2 * mg; }
  else {
    [pw, ph] = PDF_SIZES[opt.size] || PDF_SIZES.a4;
    if(iw > ih) [pw, ph] = [ph, pw];   // enli şəkil → üfüqi səhifə
  }
  const aw = pw - 2 * mg, ah = ph - 2 * mg, k = Math.min(aw / iw, ah / ih), w = iw * k, h = ih * k;
  return {pageW: pw, pageH: ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h};
}
// pages: [{jpeg: Uint8Array, imgW, imgH, pageW, pageH, x, y, w, h}]
function buildPdf(pages){
  const enc = new TextEncoder(), parts = [], offs = []; let pos = 0;
  const push = b => { parts.push(b); pos += b.length; };
  const str = s => push(enc.encode(s));
  const f2 = n => (Math.round(n * 100) / 100).toString();
  str('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  const n = pages.length, kids = pages.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ');
  const obj = (id, fn) => { offs[id] = pos; str(id + ' 0 obj\n'); fn(); str('endobj\n'); };
  obj(1, () => str('<< /Type /Catalog /Pages 2 0 R >>\n'));
  obj(2, () => str('<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>\n'));
  pages.forEach((p, i) => {
    const pid = 3 + 3 * i, cid = pid + 1, iid = pid + 2;
    const content = 'q ' + f2(p.w) + ' 0 0 ' + f2(p.h) + ' ' + f2(p.x) + ' ' + f2(p.y) + ' cm /Im0 Do Q\n';
    obj(pid, () => str('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(p.pageW) + ' ' + f2(p.pageH) + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>\n'));
    obj(cid, () => { str('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\n'); });
    obj(iid, () => {
      str('<< /Type /XObject /Subtype /Image /Width ' + p.imgW + ' /Height ' + p.imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
      push(p.jpeg); str('\nendstream\n');
    });
  });
  const xref = pos, total = 3 * n + 3;
  str('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for(let id = 1; id < total; id++) str(String(offs[id]).padStart(10, '0') + ' 00000 n \n');
  str('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  let len = 0; parts.forEach(p => len += p.length);
  const out = new Uint8Array(len); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}

function initImg2Pdf(root){
  root.innerHTML = `
    <div class="drop" id="ipDrop"></div>
    <div class="status" id="ipInfo">Şəkil seçilməyib.</div>
    <div id="ipList" class="ip-list"></div>
    <div class="row">
      <div><label for="ipSize">Səhifə ölçüsü</label><select id="ipSize"><option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Şəklin ölçüsü (kənarsız)</option></select></div>
      <div><label for="ipMg">Kənar boşluğu</label><select id="ipMg"><option value="0">Yoxdur</option><option value="10" selected>10 mm</option><option value="20">20 mm</option></select></div>
      <div><label for="ipQ">Keyfiyyət</label><select id="ipQ"><option value="2600">Yüksək (böyük fayl)</option><option value="1800" selected>Orta (tövsiyə)</option><option value="1200">Aşağı (kiçik fayl)</option></select></div>
    </div>
    <div class="btns"><button class="btn" id="ipGo">📄 PDF yarat</button><button class="btn ghost" id="ipClr">Siyahını təmizlə</button></div>
    <div class="results" id="ipRes"></div>`;
  let items = [];
  const list = $('#ipList', root), info = $('#ipInfo', root);
  function draw(){
    info.textContent = items.length ? items.length + ' şəkil seçildi. Sıranı oxlarla dəyişə bilərsiniz.' : 'Şəkil seçilməyib.';
    list.innerHTML = '';
    items.forEach((it, i) => {
      const r = document.createElement('div'); r.className = 'res';
      r.innerHTML = '<img alt="" src="' + it.url + '"><div><b>' + (i + 1) + '. ' + wfmEsc(it.file.name) + '</b>' + fmtBytes(it.file.size) + '</div>' +
        '<button class="btn sm ghost" data-a="up" aria-label="Yuxarı">↑</button><button class="btn sm ghost" data-a="dn" aria-label="Aşağı">↓</button><button class="btn sm ghost" data-a="rm" aria-label="Sil">✕</button>';
      r.onclick = e => {
        const a = e.target.dataset && e.target.dataset.a; if(!a) return;
        if(a === 'rm'){ URL.revokeObjectURL(it.url); items.splice(i, 1); }
        else { const j = a === 'up' ? i - 1 : i + 1; if(j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
        draw();
      };
      list.appendChild(r);
    });
  }
  wfmDrop(root, '#ipDrop', 'image/*', true, '🖼️ Şəkilləri bura sürüşdürün və ya klikləyin<br><small>(JPG, PNG, WEBP — hər şəkil PDF-də ayrı səhifə olacaq)</small>', fl => {
    fl.filter(f => f.type.startsWith('image/')).forEach(f => items.push({file: f, url: URL.createObjectURL(f)}));
    draw();
  });
  $('#ipClr', root).onclick = () => { items.forEach(i => URL.revokeObjectURL(i.url)); items = []; draw(); $('#ipRes', root).innerHTML = ''; };

  async function toJpeg(file, maxEdge){
    let bmp;
    try{ bmp = await createImageBitmap(file); }
    catch(e){
      bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight, k = Math.min(1, maxEdge / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, h);
    if(bmp.close) bmp.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    if(!blob) throw new Error('JPEG yaratmaq mümkün olmadı');
    return {jpeg: new Uint8Array(await blob.arrayBuffer()), imgW: w, imgH: h};
  }
  $('#ipGo', root).onclick = async () => {
    if(!items.length){ toast('Əvvəlcə şəkil seçin'); return; }
    const btn = $('#ipGo', root); btn.disabled = true; btn.textContent = '⏳ Hazırlanır…';
    const opt = {size: $('#ipSize', root).value, margin: +$('#ipMg', root).value}, maxEdge = +$('#ipQ', root).value, pages = [];
    try{
      for(const it of items){
        const j = await toJpeg(it.file, maxEdge);
        pages.push(Object.assign({}, j, pdfLayout(j.imgW, j.imgH, opt)));
      }
      const pdf = buildPdf(pages), blob = new Blob([pdf], {type: 'application/pdf'}), name = 'sekiller.pdf';
      const box = $('#ipRes', root); box.innerHTML = '';
      const r = document.createElement('div'); r.className = 'res';
      r.innerHTML = '<div><b>' + name + '</b>' + pages.length + ' səhifə · ' + fmtBytes(blob.size) + '</div><button class="btn sm alt">⬇ Endir</button>';
      $('button', r).onclick = () => downloadBlob(blob, name); box.appendChild(r);
      downloadBlob(blob, name); toast('✓ PDF hazırdır');
    }catch(e){ toast('Xəta: ' + ((e && e.message) || 'şəkil açıla bilmədi')); }
    btn.disabled = false; btn.textContent = '📄 PDF yarat';
  };
  draw();
}

/* =====================================================================
   3. CSV ⇄ JSON
   ===================================================================== */
function detectDelim(text){
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const cands = [',', ';', '\t', '|'], cnt = {}; cands.forEach(c => cnt[c] = 0);
  let q = false;
  for(const ch of first){ if(ch === '"') q = !q; else if(!q && cnt[ch] !== undefined) cnt[ch]++; }
  let best = ',', m = 0; cands.forEach(c => { if(cnt[c] > m){ m = cnt[c]; best = c; } });
  return best;
}
function parseCsv(text, d){
  const rows = []; let row = [], cell = '', q = false, i = 0;
  text = text.replace(/^﻿/, '');
  while(i < text.length){
    const ch = text[i];
    if(q){
      if(ch === '"'){ if(text[i + 1] === '"'){ cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if(ch === '"'){ q = true; i++; }
    else if(ch === d){ row.push(cell); cell = ''; i++; }
    else if(ch === '\n' || ch === '\r'){ row.push(cell); rows.push(row); row = []; cell = ''; if(ch === '\r' && text[i + 1] === '\n') i++; i++; }
    else { cell += ch; i++; }
  }
  if(cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
function toCsv(rows, d){
  const esc = v => { const s = v == null ? '' : String(v); return (s.includes(d) || /["\r\n]/.test(s) || /^\s|\s$/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map(r => r.map(esc).join(d)).join('\n');
}
function csvToJson(text, d, header, nums){
  const rows = parseCsv(text, d); if(!rows.length) return [];
  const conv = v => (nums && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) ? Number(v) : v;
  if(!header) return rows.map(r => r.map(conv));
  const seen = {}, keys = rows[0].map((h, i) => { let k = h.trim() || 'sütun' + (i + 1); if(seen[k]){ seen[k]++; k += '_' + seen[k]; } else seen[k] = 1; return k; });
  return rows.slice(1).map(r => { const o = {}; keys.forEach((k, i) => o[k] = conv(r[i] !== undefined ? r[i] : '')); return o; });
}
function jsonToRows(data){
  if(!Array.isArray(data)) data = [data];
  if(!data.length) return [];
  const cell = v => v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  if(data.every(r => Array.isArray(r))) return data.map(r => r.map(cell));
  if(data.every(r => r && typeof r === 'object' && !Array.isArray(r))){
    const keys = []; data.forEach(r => Object.keys(r).forEach(k => { if(!keys.includes(k)) keys.push(k); }));
    return [keys].concat(data.map(r => keys.map(k => cell(r[k]))));
  }
  return [['value']].concat(data.map(v => [cell(v)]));
}

function initCsvJson(root){
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="c2j">CSV → JSON</button><button class="tab" data-m="j2c">JSON → CSV</button></div>
    <div data-v="c2j">
      <label for="cjIn">CSV mətni (Excel-dən kopyalaya və ya fayl yükləyə bilərsiniz)</label>
      <textarea id="cjIn" style="min-height:140px" placeholder="ad;yaş;şəhər&#10;Əli;21;Bakı&#10;Leyla;19;Gəncə"></textarea>
      <div class="row">
        <div><label for="cjDel">Ayırıcı</label><select id="cjDel"><option value="auto">Avtomatik</option><option value=",">Vergül ( , )</option><option value=";">Nöqtəli vergül ( ; )</option><option value="&#9;">Tab</option><option value="|">Şaquli xətt ( | )</option></select></div>
        <div><label for="cjFile">və ya fayl</label><input type="file" id="cjFile" accept=".csv,.txt,text/csv,text/plain"></div>
      </div>
      <label class="check"><input type="checkbox" id="cjHead" checked> Birinci sətir sütun adlarıdır</label>
      <label class="check"><input type="checkbox" id="cjNum" checked> Rəqəmləri ədəd kimi tanı</label>
      <label for="cjOut">JSON nəticə</label><div class="out" id="cjOut">—</div>
      <div class="btns"><button class="btn" id="cjCp">📋 Kopyala</button><button class="btn alt" id="cjDl">⬇ .json endir</button><button class="btn ghost" id="cjClr">Təmizlə</button></div>
    </div>
    <div data-v="j2c" hidden>
      <label for="jcIn">JSON mətni (obyektlər massivi və ya massivlər massivi)</label>
      <textarea id="jcIn" style="min-height:140px" placeholder='[{"ad":"Əli","yaş":21},{"ad":"Leyla","yaş":19}]'></textarea>
      <div class="row"><div><label for="jcDel">Ayırıcı</label><select id="jcDel"><option value=";">Nöqtəli vergül ( ; ) — Azərbaycan Excel-i</option><option value=",">Vergül ( , )</option><option value="&#9;">Tab</option></select></div></div>
      <label for="jcOut">CSV nəticə</label><div class="out" id="jcOut">—</div>
      <div class="btns"><button class="btn" id="jcCp">📋 Kopyala</button><button class="btn alt" id="jcDl">⬇ .csv endir</button><button class="btn ghost" id="jcClr">Təmizlə</button></div>
    </div>`;
  bindTabs(root);
  let jsonOut = '', csvOut = '';
  const show = (el, text, err) => { el.textContent = text || '—'; el.style.color = err ? 'var(--danger)' : ''; };
  function c2j(){
    const t = $('#cjIn', root).value; jsonOut = '';
    if(!t.trim()){ show($('#cjOut', root), ''); return; }
    try{
      let d = $('#cjDel', root).value; if(d === 'auto') d = detectDelim(t);
      jsonOut = JSON.stringify(csvToJson(t, d, $('#cjHead', root).checked, $('#cjNum', root).checked), null, 2);
      show($('#cjOut', root), jsonOut);
    }catch(e){ show($('#cjOut', root), 'CSV oxunmadı: ' + e.message, true); }
  }
  function j2c(){
    const t = $('#jcIn', root).value; csvOut = '';
    if(!t.trim()){ show($('#jcOut', root), ''); return; }
    try{
      csvOut = toCsv(jsonToRows(JSON.parse(t)), $('#jcDel', root).value);
      show($('#jcOut', root), csvOut);
    }catch(e){ show($('#jcOut', root), 'JSON səhvi: ' + e.message, true); }
  }
  $$('#cjIn,#cjDel,#cjHead,#cjNum', root).forEach(e => e.addEventListener('input', c2j));
  $$('#jcIn,#jcDel', root).forEach(e => e.addEventListener('input', j2c));
  $('#cjFile', root).onchange = async e => { const f = e.target.files[0]; if(!f) return; if(f.size > 5 * 1048576){ toast('Fayl 5 MB-dan böyükdür'); return; } $('#cjIn', root).value = await f.text(); c2j(); };
  $('#cjCp', root).onclick = () => jsonOut ? copyText(jsonOut) : toast('Kopyalanacaq nəticə yoxdur');
  $('#cjDl', root).onclick = () => jsonOut ? downloadBlob(new Blob([jsonOut], {type: 'application/json'}), 'melumat.json') : toast('Endiriləcək nəticə yoxdur');
  $('#cjClr', root).onclick = () => { $('#cjIn', root).value = ''; c2j(); };
  $('#jcCp', root).onclick = () => csvOut ? copyText(csvOut) : toast('Kopyalanacaq nəticə yoxdur');
  $('#jcDl', root).onclick = () => csvOut ? downloadBlob(new Blob(['﻿' + csvOut], {type: 'text/csv;charset=utf-8'}), 'melumat.csv') : toast('Endiriləcək nəticə yoxdur');
  $('#jcClr', root).onclick = () => { $('#jcIn', root).value = ''; j2c(); };
}

/* =====================================================================
   4. SAY SİSTEMLƏRİ + ROMA RƏQƏMLƏRİ
   ===================================================================== */
function convertBase(str, from, to){
  let s = String(str).trim().toLowerCase().replace(/[\s_]/g, ''), neg = false;
  if(s[0] === '-'){ neg = true; s = s.slice(1); } else if(s[0] === '+') s = s.slice(1);
  if(from === 16) s = s.replace(/^0x/, ''); else if(from === 2) s = s.replace(/^0b/, ''); else if(from === 8) s = s.replace(/^0o/, '');
  if(!s) return {ok: false, error: 'Ədəd yazın'};
  let v = 0n; const B = BigInt(from);
  for(const ch of s){
    const d = parseInt(ch, 36);
    if(isNaN(d) || d >= from) return {ok: false, error: '"' + ch + '" simvolu ' + from + '-lik say sistemində yoxdur'};
    v = v * B + BigInt(d);
  }
  return {ok: true, value: (neg && v !== 0n ? '-' : '') + v.toString(to).toUpperCase(), big: v};
}
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n){ if(!Number.isInteger(n) || n < 1 || n > 3999) return null; let r = ''; for(const [v, s] of ROMAN) while(n >= v){ r += s; n -= v; } return r; }
function fromRoman(s){
  s = String(s).trim().toUpperCase();
  if(!s || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return null;
  const val = {I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000}; let t = 0;
  for(let i = 0; i < s.length; i++){ const a = val[s[i]], b = val[s[i + 1]] || 0; t += a < b ? -a : a; }
  return t;
}

function initBases(root){
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="base">Say sistemləri</button><button class="tab" data-m="rom">Roma rəqəmləri</button></div>
    <div data-v="base">
      <div class="row">
        <div style="flex:2 1 220px"><label for="bsIn">Ədəd</label><input type="text" id="bsIn" value="255" autocomplete="off" spellcheck="false"></div>
        <div><label for="bsFrom">Hansı say sistemindədir?</label><select id="bsFrom"><option value="10">10-lik (onluq)</option><option value="2">2-lik (ikilik)</option><option value="8">8-lik (səkkizlik)</option><option value="16">16-lıq (onaltılıq)</option><option value="36">36-lıq</option></select></div>
      </div>
      <div id="bsOut"></div>
    </div>
    <div data-v="rom" hidden>
      <div class="row">
        <div><label for="rmN">Ədəd (1–3999)</label><input type="text" id="rmN" inputmode="numeric" value="2026" autocomplete="off"></div>
        <div><label for="rmR">Roma rəqəmi</label><input type="text" id="rmR" autocomplete="off" spellcheck="false"></div>
      </div>
      <div id="rmOut"></div>
    </div>`;
  bindTabs(root);
  const bsOut = $('#bsOut', root);
  function base(){
    const from = +$('#bsFrom', root).value, r = convertBase($('#bsIn', root).value, from, 10);
    if(!r.ok){ bsOut.innerHTML = '<p class="r-msg err">' + wfmEsc(r.error) + '</p>'; return; }
    const rows = [[10, 'Onluq (DEC)'], [2, 'İkilik (BIN)'], [8, 'Səkkizlik (OCT)'], [16, 'Onaltılıq (HEX)'], [36, '36-lıq']];
    bsOut.innerHTML = '<div class="stat-grid" style="grid-template-columns:1fr">' + rows.map(([b, name]) => {
      const v = convertBase($('#bsIn', root).value, from, b).value;
      return '<div class="stat" style="text-align:left"><span>' + name + '</span><b style="word-break:break-all;font-family:var(--mono)">' + wfmEsc(v) + '</b><button class="btn sm ghost" data-cp="' + wfmEsc(v) + '" style="margin-top:8px">📋 Kopyala</button></div>';
    }).join('') + '</div>';
    $$('[data-cp]', bsOut).forEach(b => b.onclick = () => copyText(b.dataset.cp));
  }
  $('#bsIn', root).addEventListener('input', base); $('#bsFrom', root).addEventListener('change', base); base();
  const N = $('#rmN', root), R = $('#rmR', root), out = $('#rmOut', root);
  N.addEventListener('input', () => {
    const t = N.value.trim();
    if(!t){ R.value = ''; out.innerHTML = ''; return; }
    const r = /^\d+$/.test(t) ? toRoman(+t) : null;
    R.value = r || ''; out.innerHTML = r ? '<div class="res-big">' + r + '</div>' : '<p class="r-msg err">1 ilə 3999 arasında tam ədəd yazın.</p>';
  });
  R.addEventListener('input', () => {
    const t = R.value.trim();
    if(!t){ N.value = ''; out.innerHTML = ''; return; }
    const n = fromRoman(t);
    N.value = n || ''; out.innerHTML = n ? '<div class="res-big">' + n + '</div>' : '<p class="r-msg err">Düzgün Roma rəqəmi yazın (məs. XIV, MMXXVI).</p>';
  });
  N.dispatchEvent(new Event('input'));
}

/* =====================================================================
   5. SAAT QURŞAĞI KONVERTORU
   ===================================================================== */
const TZ_LIST = [
  ['Asia/Baku', 'Bakı'], ['Europe/Istanbul', 'İstanbul'], ['Europe/Moscow', 'Moskva'], ['Asia/Dubai', 'Dubay'],
  ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'], ['Europe/Rome', 'Roma'], ['Europe/Paris', 'Paris'],
  ['America/New_York', 'Nyu-York'], ['America/Chicago', 'Çikaqo'], ['America/Los_Angeles', 'Los-Anceles'], ['America/Toronto', 'Toronto'],
  ['Asia/Tokyo', 'Tokio'], ['Asia/Shanghai', 'Pekin / Şanxay'], ['Asia/Kolkata', 'Dehli'], ['Australia/Sydney', 'Sidney']
];
function tzOffsetMinutes(tz, ms){
  const f = new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'});
  const p = {}; f.formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}
// Yerli vaxtı (verilən qurşaqda) UTC millisaniyəyə çevirir
function zonedToUtc(y, mo, d, h, mi, tz){
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMinutes(tz, guess) * 60000;
  const off2 = tzOffsetMinutes(tz, utc);
  utc = guess - off2 * 60000;
  return utc;
}
function tzParts(tz, ms){
  const f = new Intl.DateTimeFormat('az', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long'});
  const p = {}; f.formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
  return p;
}
function fmtOffset(m){ const s = m < 0 ? '−' : '+', a = Math.abs(m); return 'UTC' + s + pad(Math.floor(a / 60)) + (a % 60 ? ':' + pad(a % 60) : ':00'); }

function initTimezone(root){
  const opts = TZ_LIST.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('');
  root.innerHTML = `
    <div class="row">
      <div><label for="tzFrom">Hansı şəhərin vaxtıdır?</label><select id="tzFrom">${opts}</select></div>
      <div><label for="tzDt">Tarix və saat</label><input type="datetime-local" id="tzDt"></div>
    </div>
    <div class="btns"><button class="btn sm" id="tzNow">İndi</button></div>
    <div id="tzOut"></div>`;
  const dt = $('#tzDt', root), from = $('#tzFrom', root);
  function setNow(){
    const now = Date.now(), p = tzParts(from.value, now);
    dt.value = p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
    calc();
  }
  function calc(){
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dt.value), out = $('#tzOut', root);
    if(!m){ out.innerHTML = '<p class="status">Tarix və saatı seçin.</p>'; return; }
    const utc = zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], from.value);
    const base = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    out.innerHTML = '<div class="tz-grid">' + TZ_LIST.map(([tz, name]) => {
      const p = tzParts(tz, utc), off = tzOffsetMinutes(tz, utc);
      const diff = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - base) / 864e5);
      const lab = diff === 0 ? 'eyni gün' : diff === 1 ? 'ertəsi gün' : diff === -1 ? 'əvvəlki gün' : (diff > 0 ? '+' : '') + diff + ' gün';
      return '<div class="stat tz-card' + (tz === from.value ? ' me' : '') + '"><span>' + name + ' · ' + fmtOffset(off) + '</span><b>' + p.hour + ':' + p.minute + '</b><span>' + p.day + '.' + p.month + '.' + p.year + ' · ' + lab + '</span></div>';
    }).join('') + '</div><p class="status">Yay və qış vaxtına keçid avtomatik nəzərə alınır. Bakıda yay vaxtı yoxdur (həmişə UTC+4).</p>';
  }
  dt.addEventListener('input', calc); from.addEventListener('change', calc);
  $('#tzNow', root).onclick = setNow;
  from.value = 'Asia/Baku'; setNow();
}

/* =====================================================================
   6. KREDİT HESABLAYICISI
   ===================================================================== */
function loanSchedule(P, annualRate, n, type){
  const r = annualRate / 1200, rows = []; let bal = P;
  const pay = type === 'annuity' ? (r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n) : 0;
  for(let i = 1; i <= n; i++){
    const interest = bal * r;
    let principal = type === 'annuity' ? pay - interest : P / n;
    if(i === n) principal = bal;
    const payment = principal + interest; bal = Math.max(0, bal - principal);
    rows.push({i, payment, principal, interest, balance: i === n ? 0 : bal});
  }
  const total = rows.reduce((s, x) => s + x.payment, 0);
  return {rows, total, interest: total - P};
}

function initLoan(root){
  root.innerHTML = `
    <div class="row">
      <div><label for="lnP">Kredit məbləği (₼)</label><input type="text" id="lnP" inputmode="decimal" value="10000"></div>
      <div><label for="lnR">İllik faiz (%)</label><input type="text" id="lnR" inputmode="decimal" value="12"></div>
      <div><label for="lnT">Müddət</label><input type="number" id="lnT" min="1" max="600" value="24"></div>
      <div><label for="lnU">Vahid</label><select id="lnU"><option value="m">ay</option><option value="y">il</option></select></div>
    </div>
    <label for="lnType">Ödəniş növü</label>
    <select id="lnType"><option value="annuity">Annuitet (hər ay eyni məbləğ)</option><option value="diff">Diferensial (azalan ödəniş)</option></select>
    <div id="lnOut"></div>`;
  let sched = null, showAll = false;
  function calc(){
    const P = readNum($('#lnP', root)), R = readNum($('#lnR', root)), U = $('#lnU', root).value;
    let T = Math.floor(+$('#lnT', root).value); if(U === 'y') T *= 12;
    const out = $('#lnOut', root);
    if(!(P > 0) || isNaN(R) || R < 0 || !(T >= 1) || T > 600){ out.innerHTML = '<p class="status">Məbləği, faizi (0 və ya çox) və müddəti (1–600 ay) düzgün yazın.</p>'; sched = null; return; }
    const type = $('#lnType', root).value; sched = loanSchedule(P, R, T, type);
    const f = sched.rows[0], l = sched.rows[sched.rows.length - 1];
    const big = type === 'annuity' ? mf(f.payment) + ' ₼' : mf(f.payment) + ' ₼ → ' + mf(l.payment) + ' ₼';
    const rows = showAll ? sched.rows : sched.rows.slice(0, 12);
    out.innerHTML = `<div class="res-big">${big}</div><p class="status">${type === 'annuity' ? 'Aylıq ödəniş' : 'Birinci ayın ödənişi → sonuncu ayın ödənişi'}</p>
      <div class="stat-grid">${statBox(mf(sched.total) + ' ₼', 'Cəmi ödəniş')}${statBox(mf(sched.interest) + ' ₼', 'Faiz məbləği')}${statBox(P ? nf(sched.interest / P * 100, 1) + '%' : '—', 'Artıq ödəniş')}${statBox(T, 'Ay')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ay</th><th>Ödəniş</th><th>Əsas borc</th><th>Faiz</th><th>Qalıq</th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.i}</td><td>${mf(x.payment)}</td><td>${mf(x.principal)}</td><td>${mf(x.interest)}</td><td>${mf(x.balance)}</td></tr>`).join('')}</tbody></table></div>
      <div class="btns">${sched.rows.length > 12 ? `<button class="btn sm ghost" id="lnAll">${showAll ? 'Qısalt' : 'Bütün ' + sched.rows.length + ' ayı göstər'}</button>` : ''}<button class="btn sm alt" id="lnCsv">⬇ Cədvəli .csv endir</button></div>
      <p class="status">Nəticə ilkin hesablamadır. Bank komissiya, sığorta və ya effektiv faiz əlavə edə bilər, dəqiq cədvəli bankdan alın.</p>`;
    const a = $('#lnAll', root); if(a) a.onclick = () => { showAll = !showAll; calc(); };
    $('#lnCsv', root).onclick = () => {
      const csv = toCsv([['Ay', 'Ödəniş', 'Əsas borc', 'Faiz', 'Qalıq']].concat(sched.rows.map(x => [x.i, x.payment.toFixed(2), x.principal.toFixed(2), x.interest.toFixed(2), x.balance.toFixed(2)])), ';');
      downloadBlob(new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'}), 'kredit-cedveli.csv');
    };
  }
  $$('input,select', root).forEach(e => e.addEventListener('input', () => { showAll = false; calc(); }));
  calc();
}

/* =====================================================================
   7. GPA HESABLAYICISI
   ===================================================================== */
const GPA_LETTER = [['A', 4], ['A-', 3.7], ['B+', 3.3], ['B', 3], ['B-', 2.7], ['C+', 2.3], ['C', 2], ['C-', 1.7], ['D+', 1.3], ['D', 1], ['F', 0]];
function pctToPoints(p){ return p >= 90 ? 4 : p >= 80 ? 3 : p >= 70 ? 2 : p >= 60 ? 1 : 0; }
function gpaCalc(rows, prevGpa, prevCredits){
  let cr = 0, qp = 0;
  rows.forEach(r => { if(r.credit > 0 && r.points != null && !isNaN(r.points)){ cr += r.credit; qp += r.credit * r.points; } });
  const gpa = cr ? qp / cr : null;
  let cum = null;
  if(prevCredits > 0 && prevGpa >= 0 && cr) cum = (prevGpa * prevCredits + qp) / (prevCredits + cr);
  return {gpa, credits: cr, qp, cum};
}

function initGpa(root){
  root.innerHTML = `
    <label for="gpMode">Qiymət növü</label>
    <select id="gpMode"><option value="letter">Hərf qiymətləri (A, B+, C…) — 4.0 şkalası</option><option value="pct">100 ballıq bal → təxmini 4.0</option></select>
    <div id="gpRows"></div>
    <div class="btns"><button class="btn sm" id="gpAdd">+ Fənn əlavə et</button><button class="btn sm ghost" id="gpClr">Təmizlə</button></div>
    <details class="gp-prev"><summary>Əvvəlki ümumi GPA ilə birləşdir (isteğe bağlı)</summary>
      <div class="row"><div><label for="gpPG">Əvvəlki GPA</label><input type="text" id="gpPG" inputmode="decimal" placeholder="məs. 3.4"></div><div><label for="gpPC">Əvvəlki kredit sayı</label><input type="text" id="gpPC" inputmode="decimal" placeholder="məs. 60"></div></div>
    </details>
    <div id="gpOut"></div>
    <p class="status" id="gpNote"></p>`;
  const rowsBox = $('#gpRows', root), mode = $('#gpMode', root);
  const letterOpts = GPA_LETTER.map(g => '<option value="' + g[1] + '">' + g[0] + ' (' + g[1].toFixed(1) + ')</option>').join('');
  function addRow(name, credit, val){
    const r = document.createElement('div'); r.className = 'row gp-row';
    const isL = mode.value === 'letter';
    r.innerHTML = '<div style="flex:2 1 160px"><label>Fənn</label><input type="text" class="gp-n" placeholder="Fənnin adı" value="' + wfmEsc(name || '') + '"></div>' +
      '<div style="flex:1 1 90px"><label>Kredit</label><input type="text" inputmode="decimal" class="gp-c" value="' + (credit || 3) + '"></div>' +
      '<div style="flex:1 1 130px"><label>' + (isL ? 'Qiymət' : 'Bal (0–100)') + '</label>' + (isL ? '<select class="gp-g">' + letterOpts + '</select>' : '<input type="text" inputmode="decimal" class="gp-g" placeholder="məs. 87">') + '</div>' +
      '<div style="flex:0 0 auto;align-self:flex-end"><button class="btn sm ghost" aria-label="Sil">✕</button></div>';
    if(val != null) $('.gp-g', r).value = val;
    $('button', r).onclick = () => { r.remove(); calc(); };
    $$('input,select', r).forEach(e => e.addEventListener('input', calc));
    rowsBox.appendChild(r);
  }
  function calc(){
    const isL = mode.value === 'letter';
    const rows = $$('.gp-row', rowsBox).map(r => {
      const c = readNum($('.gp-c', r)), g = $('.gp-g', r);
      let pts = null;
      if(isL) pts = +g.value; else { const v = readNum(g); pts = isNaN(v) || v < 0 || v > 100 ? null : pctToPoints(v); }
      return {credit: c, points: pts};
    });
    const pg = readNum($('#gpPG', root)), pc = readNum($('#gpPC', root));
    const r = gpaCalc(rows, pg, pc), out = $('#gpOut', root);
    if(r.gpa == null){ out.innerHTML = '<p class="status">Fənnin kreditini və qiymətini yazın.</p>'; }
    else out.innerHTML = '<div class="stat-grid">' + statBox(nf(r.gpa, 2), 'Bu dövrün GPA-sı') + statBox(nf(r.credits, 1), 'Cəmi kredit') + (r.cum != null ? statBox(nf(r.cum, 2), 'Ümumi GPA') : '') + '</div>';
    $('#gpNote', root).textContent = isL ? 'Hərf qiymətləri ümumi qəbul olunmuş 4.0 şkalası ilə hesablanır (A=4.0, B=3.0 …). Universitetlər fərqli şkala işlədə bilər.'
      : 'Bal → 4.0 çevirməsi təxminidir: 90–100 = 4.0, 80–89 = 3.0, 70–79 = 2.0, 60–69 = 1.0, 60-dan aşağı = 0. Universitetlər və qiymətləndirmə qurumları (məs. WES) fərqli cədvəl işlədir, rəsmi nəticə üçün onlara baxın.';
  }
  mode.addEventListener('change', () => { rowsBox.innerHTML = ''; for(let i = 0; i < 3; i++) addRow('', 3); calc(); });
  $('#gpAdd', root).onclick = () => { addRow('', 3); calc(); };
  $('#gpClr', root).onclick = () => { rowsBox.innerHTML = ''; for(let i = 0; i < 3; i++) addRow('', 3); calc(); };
  $$('#gpPG,#gpPC', root).forEach(e => e.addEventListener('input', calc));
  for(let i = 0; i < 3; i++) addRow('', 3);
  calc();
}

/* =====================================================================
   8. POMODORO
   ===================================================================== */
function initPomodoro(root){
  const KEY = 'wf-pomo';
  let cfg = {f: 25, s: 5, l: 15, auto: false};
  try{ Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); }catch(e){}
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="f">Fokus</button><button class="tab" data-m="s">Qısa fasilə</button><button class="tab" data-m="l">Uzun fasilə</button></div>
    <div class="big-time" id="pmD">25:00</div>
    <p class="status" id="pmSt" style="text-align:center"></p>
    <div class="btns" style="justify-content:center"><button class="btn" id="pmGo">▶ Başla</button><button class="btn alt" id="pmRs">↺ Sıfırla</button><button class="btn ghost" id="pmSk">⏭ Keç</button></div>
    <details class="gp-prev"><summary>Ayarlar</summary>
      <div class="row"><div><label for="pmF">Fokus (dəq)</label><input type="number" id="pmF" min="1" max="120"></div><div><label for="pmS">Qısa fasilə (dəq)</label><input type="number" id="pmS" min="1" max="60"></div><div><label for="pmL">Uzun fasilə (dəq)</label><input type="number" id="pmL" min="1" max="90"></div></div>
      <label class="check"><input type="checkbox" id="pmAuto"> Növbəti mərhələni avtomatik başlat</label>
    </details>`;
  const tabs = $$('[data-m]', root), disp = $('#pmD', root), st = $('#pmSt', root), go = $('#pmGo', root);
  let mode = 'f', left = cfg.f * 60, running = false, endAt = 0, timer = null, done = 0;
  const mins = m => Math.max(1, Math.min(120, +cfg[m] || 25));
  const names = {f: 'Fokus', s: 'Qısa fasilə', l: 'Uzun fasilə'};
  const fmt = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  const baseTitle = document.title;
  function paint(){
    disp.textContent = fmt(left); st.textContent = names[mode] + ' · tamamlanan fokus: ' + done;
    document.title = running ? '(' + fmt(left) + ') ' + names[mode] + ' — WebFixer' : baseTitle;
    tabs.forEach(b => b.classList.toggle('active', b.dataset.m === mode));
  }
  function beep(){
    try{
      const C = window.AudioContext || window.webkitAudioContext, c = new C(), t = c.currentTime;
      [0, .25, .5].forEach(d => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.25, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .2); o.start(t + d); o.stop(t + d + .22); });
      setTimeout(() => c.close(), 1500);
    }catch(e){}
  }
  function stop(){ running = false; clearInterval(timer); go.textContent = '▶ Davam et'; }
  function setMode(m, start){
    mode = m; left = mins(m) * 60; stop(); go.textContent = '▶ Başla'; paint();
    if(start) begin();
  }
  function begin(){ running = true; endAt = Date.now() + left * 1000; go.textContent = '⏸ Fasilə ver'; clearInterval(timer); timer = setInterval(tick, 250); paint(); }
  function next(){
    if(mode === 'f'){ done++; setMode(done % 4 === 0 ? 'l' : 's', cfg.auto); }
    else setMode('f', cfg.auto);
  }
  function tick(){
    left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if(left <= 0){ beep(); toast(mode === 'f' ? '✓ Fokus bitdi, fasilə vaxtıdır' : '✓ Fasilə bitdi, işə qayıdın'); next(); return; }
    paint();
  }
  go.onclick = () => { if(running){ stop(); paint(); } else begin(); };
  $('#pmRs', root).onclick = () => setMode(mode, false);
  $('#pmSk', root).onclick = () => next();
  tabs.forEach(b => b.onclick = () => setMode(b.dataset.m, false));
  const inF = $('#pmF', root), inS = $('#pmS', root), inL = $('#pmL', root), inA = $('#pmAuto', root);
  inF.value = cfg.f; inS.value = cfg.s; inL.value = cfg.l; inA.checked = !!cfg.auto;
  [inF, inS, inL, inA].forEach(e => e.addEventListener('change', () => {
    cfg = {f: +inF.value || 25, s: +inS.value || 5, l: +inL.value || 15, auto: inA.checked};
    try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(err){}
    if(!running) setMode(mode, false);
  }));
  window.addEventListener('beforeunload', () => { document.title = baseTitle; });
  setMode('f', false);
}

/* =====================================================================
   9. HASH GENERATORU
   ===================================================================== */
function md5(bytes){
  const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for(let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const n = bytes.length, padLen = ((n + 8) >> 6 << 6) + 64, buf = new Uint8Array(padLen);
  buf.set(bytes); buf[n] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, (n * 8) >>> 0, true); dv.setUint32(padLen - 4, Math.floor(n / 536870912), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for(let off = 0; off < padLen; off += 64){
    for(let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for(let i = 0; i < 64; i++){
      let F, g;
      if(i < 16){ F = (B & C) | (~B & D); g = i; }
      else if(i < 32){ F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if(i < 48){ F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0; A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i & 3)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16), ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return [...out].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashBytes(algo, bytes){
  if(algo === 'MD5') return md5(bytes);
  const d = await crypto.subtle.digest(algo, bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function initHash(root){
  const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
  root.innerHTML = `
    <div class="tabs"><button class="tab active" data-m="txt">Mətn</button><button class="tab" data-m="file">Fayl</button></div>
    <div data-v="txt"><label for="hsIn">Mətn</label><textarea id="hsIn" style="min-height:110px" placeholder="Hash-ı hesablanacaq mətni yazın…"></textarea></div>
    <div data-v="file" hidden><div class="drop" id="hsDrop"></div><div class="status" id="hsFile">Fayl seçilməyib.</div></div>
    <label class="check"><input type="checkbox" id="hsUp"> BÖYÜK hərflərlə göstər</label>
    <div id="hsOut"></div>
    <label for="hsCmp">Yoxlama: gözlənilən hash-ı yapışdırın</label>
    <input type="text" id="hsCmp" placeholder="Endirdiyiniz faylın rəsmi hash dəyəri" autocomplete="off" spellcheck="false">
    <div id="hsCmpRes"></div>`;
  let mode = 'txt', file = null, results = {}, token = 0;
  bindTabs(root, m => { mode = m; run(); });
  async function run(){
    const my = ++token, out = $('#hsOut', root); results = {};
    let bytes;
    if(mode === 'txt') bytes = new TextEncoder().encode($('#hsIn', root).value);
    else {
      if(!file){ out.innerHTML = ''; cmp(); return; }
      if(file.size > 300 * 1048576){ out.innerHTML = '<p class="r-msg err">Fayl 300 MB-dan böyükdür.</p>'; return; }
      out.innerHTML = '<p class="status">⏳ Hesablanır…</p>';
      bytes = new Uint8Array(await file.arrayBuffer());
    }
    for(const a of ALGOS){ results[a] = await hashBytes(a, bytes); if(my !== token) return; }
    paint(); cmp();
  }
  function paint(){
    const up = $('#hsUp', root).checked;
    $('#hsOut', root).innerHTML = ALGOS.map(a => { const v = up ? results[a].toUpperCase() : results[a];
      return '<div class="stat" style="text-align:left;margin-bottom:10px"><span>' + a + (a === 'MD5' || a === 'SHA-1' ? ' (köhnəlib)' : '') + '</span><b style="word-break:break-all;font-family:var(--mono);font-size:.85rem">' + v + '</b><button class="btn sm ghost" data-cp="' + v + '" style="margin-top:8px">📋 Kopyala</button></div>'; }).join('');
    $$('[data-cp]', root).forEach(b => b.onclick = () => copyText(b.dataset.cp));
  }
  function cmp(){
    const v = $('#hsCmp', root).value.trim().toLowerCase().replace(/\s/g, ''), box = $('#hsCmpRes', root);
    if(!v){ box.innerHTML = ''; return; }
    const hit = ALGOS.find(a => results[a] && results[a] === v);
    box.innerHTML = hit ? '<p class="r-msg" style="color:var(--lime)">✓ Uyğundur (' + hit + '). Fayl və ya mətn dəyişməyib.</p>' : '<p class="r-msg err">✕ Heç bir alqoritmin nəticəsi ilə uyğun gəlmir.</p>';
  }
  $('#hsIn', root).addEventListener('input', run);
  $('#hsUp', root).addEventListener('change', () => { if(Object.keys(results).length) paint(); });
  $('#hsCmp', root).addEventListener('input', cmp);
  wfmDrop(root, '#hsDrop', '*/*', false, '📁 Faylı bura sürüşdürün və ya klikləyin<br><small>(fayl cihazınızdan çıxmır)</small>', fl => { file = fl[0]; $('#hsFile', root).textContent = file.name + ' · ' + fmtBytes(file.size); run(); });
  run();
}

/* =====================================================================
   10. YAZI SÜRƏTİ TESTİ
   ===================================================================== */
const TYPING_TEXTS = {
  az: [
    'Gün ərzində etdiyimiz kiçik işlər zamanla böyük nəticələrə çevrilir. Hər gün azca oxumaq, yazmaq və öyrənmək insanı bir addım irəli aparır.',
    'Xəzər dənizinin sahilində axşam çağı külək yumşaq əsir, dalğalar isə qumun üstünə yavaş-yavaş yatır. Belə anlarda şəhərin səs-küyü uzaqda qalır.',
    'Yaxşı kitab oxucuya yeni dünya açır. Biz səhifələri çevirdikcə başqa insanların fikirlərini anlayır və öz düşüncələrimizi daha aydın ifadə etməyi öyrənirik.',
    'Düzgün planlaşdırma vaxta qənaət etməyin ən sadə yoludur. Əvvəlcə vacib işləri seçin, sonra hər birinə konkret saat ayırın və diqqətinizi yayındıran şeyləri kənara qoyun.',
    'Bakıda payız fəsli çox rəngarəngdir. Bulvarın ağacları sarı və qızılı tonlara bürünür, havanın sərinliyi isə uzun gəzintilər üçün ən uyğun əhval-ruhiyyə yaradır.'
  ],
  en: [
    'Learning a new language takes patience and regular practice. Reading a little every day, listening to real conversations and writing short notes will slowly build confidence.',
    'Good time management is not about doing more things at once. It is about choosing the right tasks, setting clear limits and taking short breaks to keep your mind fresh.',
    'Many students believe that talent alone decides success, but research often shows that steady effort matters more. Small daily habits can lead to remarkable progress over a year.',
    'Technology has changed the way people study and work. Online libraries, video lessons and digital tools give learners access to knowledge that once required travelling far from home.',
    'A strong essay begins with a clear main idea. Each paragraph should support that idea with an example, and the conclusion should remind the reader why the argument matters.'
  ]
};
function typingStats(typed, target, seconds){
  let ok = 0; for(let i = 0; i < typed.length; i++) if(typed[i] === target[i]) ok++;
  const min = Math.max(seconds, 1) / 60;
  return {wpm: Math.round(ok / 5 / min), raw: Math.round(typed.length / 5 / min), acc: typed.length ? Math.round(ok / typed.length * 100) : 100, ok, errors: typed.length - ok};
}

function initTyping(root){
  root.innerHTML = `
    <div class="row">
      <div><label for="tyLang">Dil</label><select id="tyLang"><option value="az">Azərbaycanca</option><option value="en">English</option></select></div>
      <div><label for="tyDur">Müddət</label><select id="tyDur"><option value="30">30 saniyə</option><option value="60" selected>60 saniyə</option><option value="120">2 dəqiqə</option></select></div>
    </div>
    <div class="stat-grid"><div class="stat"><b id="tyTime">60</b><span>Saniyə</span></div><div class="stat"><b id="tyWpm">0</b><span>söz/dəq</span></div><div class="stat"><b id="tyAcc">100%</b><span>Dəqiqlik</span></div><div class="stat"><b id="tyBest">—</b><span>Ən yaxşı</span></div></div>
    <div class="ty-text" id="tyText" aria-label="Yazılacaq mətn"></div>
    <label for="tyIn">Buraya yazın (ilk hərfdən vaxt başlayır)</label>
    <textarea id="tyIn" style="min-height:90px;font-family:var(--sans)" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="btns"><button class="btn" id="tyRs">↺ Yenidən başla</button></div>
    <div id="tyRes"></div>`;
  const lang = $('#tyLang', root), dur = $('#tyDur', root), text = $('#tyText', root), inp = $('#tyIn', root);
  let target = '', started = 0, timer = null, finished = false, bestKey = 'wf-typing-best';
  const best = () => { try{ return +localStorage.getItem(bestKey + '-' + lang.value) || 0; }catch(e){ return 0; } };
  function pick(){
    const arr = TYPING_TEXTS[lang.value]; let t = arr[Math.floor(Math.random() * arr.length)];
    while(t.length < 420) t += ' ' + arr[Math.floor(Math.random() * arr.length)];
    return t;
  }
  function render(typed){
    let h = '';
    for(let i = 0; i < target.length; i++){
      const c = wfmEsc(target[i]);
      if(i < typed.length) h += '<span class="' + (typed[i] === target[i] ? 'ty-ok' : 'ty-bad') + '">' + c + '</span>';
      else if(i === typed.length) h += '<span class="ty-cur">' + c + '</span>';
      else h += c;
    }
    text.innerHTML = h;
    const cur = $('.ty-cur', text); if(cur && cur.offsetTop > text.clientHeight - 50) text.scrollTop = cur.offsetTop - 40;
  }
  function reset(){
    clearInterval(timer); started = 0; finished = false; target = pick();
    inp.value = ''; inp.disabled = false; render(''); $('#tyRes', root).innerHTML = '';
    $('#tyTime', root).textContent = dur.value; $('#tyWpm', root).textContent = '0'; $('#tyAcc', root).textContent = '100%';
    const b = best(); $('#tyBest', root).textContent = b ? b : '—';
  }
  function finish(){
    if(finished) return; finished = true; clearInterval(timer); inp.disabled = true;
    const sec = Math.min(+dur.value, Math.max(1, (Date.now() - started) / 1000)), s = typingStats(inp.value, target, sec);
    $('#tyWpm', root).textContent = s.wpm; $('#tyAcc', root).textContent = s.acc + '%';
    let msg = '';
    if(s.wpm > best()){ try{ localStorage.setItem(bestKey + '-' + lang.value, s.wpm); }catch(e){} $('#tyBest', root).textContent = s.wpm; msg = '<p class="r-msg" style="color:var(--lime)">🏆 Yeni şəxsi rekord!</p>'; }
    $('#tyRes', root).innerHTML = '<div class="res-big">' + s.wpm + ' söz/dəq</div><div class="stat-grid">' + statBox(s.acc + '%', 'Dəqiqlik') + statBox(s.raw, 'Xam sürət') + statBox(s.ok, 'Düzgün simvol') + statBox(s.errors, 'Səhv') + '</div>' + msg +
      '<p class="status">Sürət düzgün yazılan simvolların sayına görə hesablanır (5 simvol = 1 söz).</p>';
  }
  inp.addEventListener('input', () => {
    if(finished) return;
    if(!started){ started = Date.now(); timer = setInterval(() => {
      const el = (Date.now() - started) / 1000, left = Math.max(0, Math.ceil(+dur.value - el));
      $('#tyTime', root).textContent = left;
      const s = typingStats(inp.value, target, Math.max(el, 1)); $('#tyWpm', root).textContent = s.wpm; $('#tyAcc', root).textContent = s.acc + '%';
      if(left <= 0) finish();
    }, 250); }
    if(inp.value.length >= target.length - 1){ target += ' ' + pick(); }
    render(inp.value);
  });
  inp.addEventListener('paste', e => { e.preventDefault(); toast('Yapışdırmaq söndürülüb, özünüz yazın'); });
  $('#tyRs', root).onclick = () => { reset(); inp.focus(); };
  lang.addEventListener('change', reset); dur.addEventListener('change', reset);
  reset();
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {encodeWav, oggCrc, oggOpusMux, pdfLayout, buildPdf, detectDelim, parseCsv, toCsv, csvToJson, jsonToRows, convertBase, toRoman, fromRoman,
    tzOffsetMinutes, zonedToUtc, loanSchedule, gpaCalc, pctToPoints, md5, typingStats};
}
