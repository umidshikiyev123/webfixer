/* =====================================================================
   WebFixer — ümumi sayt skripti
   Header kölgəsi, oxuma xətti, aşağı sürüşdürdükcə yüklənmə animasiyası,
   rəqəm sayğacı, mobil menyu, "yuxarı" düyməsi, ana səhifə filtri.
   ===================================================================== */
(function(){
  'use strict';
  var d = document, w = window;
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Köhnə #/qr tipli linkləri yeni səhifələrə yönləndir */
  var legacy = {image:'sekil-olcusu', text:'metn-aletleri', pass:'parol-generatoru', qr:'qr-kod',
                color:'reng-palitrasi', prompt:'ai-prompt', conv:'konvertor', timer:'taymer'};
  var m = /^#\/(\w+)/.exec(location.hash);
  if(m && legacy[m[1]]){ location.replace('/' + legacy[m[1]] + '.html'); return; }

  /* İl */
  var y = d.getElementById('year'); if(y) y.textContent = new Date().getFullYear();

  /* Header kölgəsi + oxuma xətti + yuxarı düyməsi */
  var header = d.querySelector('.site-header'), bar = d.querySelector('.progress'), top = d.querySelector('.to-top');
  var ticking = false;
  function onScroll(){
    var st = w.pageYOffset || d.documentElement.scrollTop;
    var h = d.documentElement.scrollHeight - w.innerHeight;
    if(header) header.classList.toggle('scrolled', st > 12);
    if(bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, st / h) : 0) + ')';
    if(top) top.classList.toggle('show', st > 600);
    ticking = false;
  }
  w.addEventListener('scroll', function(){ if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive:true});
  onScroll();
  if(top) top.addEventListener('click', function(){ w.scrollTo({top:0, behavior: reduce ? 'auto' : 'smooth'}); });

  /* Mobil menyu */
  var tg = d.querySelector('.nav-toggle'), nav = d.querySelector('.nav');
  if(tg && nav){
    tg.addEventListener('click', function(){
      var open = nav.classList.toggle('open'); tg.setAttribute('aria-expanded', open);
    });
    nav.addEventListener('click', function(e){ if(e.target.tagName === 'A') nav.classList.remove('open'); });
  }

  /* Aşağı sürüşdürdükcə yumşaq yüklənmə */
  var items = [].slice.call(d.querySelectorAll('.reveal'));
  if(!('IntersectionObserver' in w) || reduce){ items.forEach(function(el){ el.classList.add('in'); }); }
  else {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -6% 0px'});
    items.forEach(function(el){ io.observe(el); });
  }

  /* Rəqəm sayğacı (hero statistikası) */
  [].slice.call(d.querySelectorAll('[data-count]')).forEach(function(el){
    var to = +el.getAttribute('data-count'), suf = el.getAttribute('data-suf') || '';
    if(reduce){ el.textContent = to + suf; return; }
    var t0 = null, dur = 1400;
    function step(t){
      if(t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e) + suf;
      if(p < 1) requestAnimationFrame(step);
    }
    setTimeout(function(){ requestAnimationFrame(step); }, 500);
  });

  /* Ana səhifə: axtarış və kateqoriya filtri */
  var grid = d.getElementById('grid');
  if(grid){
    var cards = [].slice.call(grid.querySelectorAll('.card')), cat = 'all', q = '';
    var empty = d.getElementById('empty'), search = d.getElementById('search');
    var chips = [].slice.call(d.querySelectorAll('#cats .chip'));
    function apply(){
      var n = 0;
      cards.forEach(function(c){
        var ok = (cat === 'all' || c.dataset.cat === cat) && (!q || c.dataset.s.indexOf(q) > -1);
        c.hidden = !ok; if(ok) n++;
      });
      if(empty) empty.hidden = n > 0;
    }
    chips.forEach(function(ch){
      ch.addEventListener('click', function(){
        cat = ch.dataset.c; chips.forEach(function(x){ x.classList.toggle('active', x === ch); }); apply();
      });
    });
    if(search) search.addEventListener('input', function(){ q = search.value.trim().toLowerCase(); apply(); });
  }
})();
