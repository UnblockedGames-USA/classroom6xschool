(function () {
  'use strict';
  var root = document.body.dataset.root || './';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* theme */
  var themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('c6x-theme', t); } catch (e) {}
  });

  /* sidebar drawer */
  var side = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menuBtn');
  function setMenu(open) {
    if (!side) return;
    side.classList.toggle('open', open);
    if (scrim) scrim.hidden = !open;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(!side.classList.contains('open')); });
  if (scrim) scrim.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* game index (lazy) */
  var dataP = null;
  function loadData() {
    if (!dataP) dataP = fetch(root + 'assets/games.json').then(function (r) { return r.json(); });
    return dataP;
  }
  function norm(s) { return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function search(data, q) {
    q = norm(q); if (!q) return [];
    var words = q.split(' ');
    var out = [];
    for (var i = 0; i < data.length; i++) {
      var t = data[i]._n || (data[i]._n = norm(data[i].t));
      var ok = true;
      for (var w = 0; w < words.length; w++) if (t.indexOf(words[w]) === -1) { ok = false; break; }
      if (!ok) continue;
      var score = t === q ? 0 : t.indexOf(q) === 0 ? 1 : (' ' + t).indexOf(' ' + q) > -1 ? 2 : 3;
      out.push([score, t.length, data[i]]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return out.map(function (x) { return x[2]; });
  }
  function tileHTML(g) {
    return '<a class="tile" href="' + root + 'game/' + g.s + '/" title="' + esc(g.t) + '"><span class="tile-img"><img src="' + esc(g.i) +
      '" alt="' + esc(g.t) + '" width="300" height="300" loading="lazy" decoding="async"></span><span class="tile-name">' + esc(g.t) + '</span></a>';
  }

  /* header search */
  var q = $('#q'), pop = $('#searchPop'), sel = -1;
  if (q && pop) {
    q.addEventListener('focus', loadData, { once: true });
    var render = function () {
      var v = q.value.trim();
      if (!v) { pop.hidden = true; return; }
      loadData().then(function (data) {
        var res = search(data, v), top = res.slice(0, 8);
        sel = -1;
        pop.innerHTML = top.length
          ? top.map(function (g) { return '<a role="option" href="' + root + 'game/' + g.s + '/"><img src="' + esc(g.i) + '" alt="" loading="lazy">' + esc(g.t) + '</a>'; }).join('') +
            (res.length > 8 ? '<a class="all" href="' + root + 'search/?q=' + encodeURIComponent(v) + '">See all ' + res.length + ' results</a>' : '')
          : '<div class="none">No games found for “' + esc(v) + '”</div>';
        pop.hidden = false;
      });
    };
    q.addEventListener('input', render);
    q.addEventListener('keydown', function (e) {
      var items = pop.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
      } else if (e.key === 'Enter' && sel > -1 && items[sel]) {
        e.preventDefault(); location.href = items[sel].href;
      } else if (e.key === 'Escape') { pop.hidden = true; q.blur(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search')) pop.hidden = true; });
  }

  /* search page */
  var sg = $('#searchGrid');
  if (sg) {
    var term = new URLSearchParams(location.search).get('q') || '';
    if (q) q.value = term;
    if (term) loadData().then(function (data) {
      var res = search(data, term);
      $('#searchTitle').textContent = 'Results for “' + term + '”';
      $('#searchInfo').textContent = res.length + (res.length === 1 ? ' game' : ' games') + ' found';
      sg.innerHTML = res.slice(0, 240).map(tileHTML).join('');
      $('#searchEmpty').hidden = res.length > 0;
    });
  }

  /* random: pick client-side to avoid an extra page hop */
  var rb = $('#randomBtn');
  if (rb) rb.addEventListener('click', function (e) {
    e.preventDefault();
    loadData().then(function (d) { location.href = root + 'game/' + d[Math.floor(Math.random() * d.length)].s + '/'; })
      .catch(function () { location.href = rb.href; });
  });

  /* favorites + recent */
  var favs = store.get('c6x-favs', []);
  var recent = store.get('c6x-recent', []);

  var fg = $('#favGrid');
  if (fg) {
    fg.innerHTML = favs.map(tileHTML).join('');
    $('#favEmpty').hidden = favs.length > 0;
  }
  var rr = $('#recentRow');
  if (rr && recent.length) {
    rr.innerHTML = '<section class="row" aria-labelledby="h-recent"><div class="row-head"><h2 id="h-recent"><svg class="ic row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Continue playing</h2>' +
      (favs.length ? '<a class="row-more" href="' + root + 'favorites/">My favorites</a>' : '') + '</div><div class="rail">' + recent.map(tileHTML).join('') + '</div></section>';
  }

  /* game player */
  var player = $('#player');
  if (player) {
    var g = { s: player.dataset.slug, t: player.dataset.title, i: player.dataset.thumb };
    var favBtn = $('#favBtn'), fsBtn = $('#fsBtn'), shareBtn = $('#shareBtn');
    var isFav = function () { return favs.some(function (x) { return x.s === g.s; }); };
    var paintFav = function () {
      var on = isFav();
      favBtn.setAttribute('aria-pressed', String(on));
      favBtn.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
      var sp = favBtn.querySelector('span'); if (sp) sp.textContent = on ? 'Saved' : 'Favorite';
    };
    paintFav();
    favBtn.addEventListener('click', function () {
      if (isFav()) favs = favs.filter(function (x) { return x.s !== g.s; });
      else favs.unshift(g);
      store.set('c6x-favs', favs.slice(0, 200)); paintFav();
      toast(isFav() ? 'Added to favorites' : 'Removed from favorites');
    });
    shareBtn.addEventListener('click', function () {
      var url = location.href;
      if (navigator.share) { navigator.share({ title: g.t + ' on Classroom 6X', url: url }).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Link copied'); }, function () { toast(url); });
    });

    var started = false;
    function start() {
      if (started) return; started = true;
      var poster = $('#poster');
      var load = document.createElement('div');
      load.className = 'loading'; load.innerHTML = '<div><div class="spinner"></div>Loading ' + esc(g.t) + '…</div>';
      var f = document.createElement('iframe');
      f.src = player.dataset.src;
      f.title = g.t;
      f.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.addEventListener('load', function () { load.style.opacity = '0'; setTimeout(function () { load.remove(); }, 400); });
      player.appendChild(f); player.appendChild(load);
      if (poster) poster.remove();
      f.focus();
      recent = [g].concat(recent.filter(function (x) { return x.s !== g.s; })).slice(0, 18);
      store.set('c6x-recent', recent);
    }
    $('#playBtn').addEventListener('click', start);
    fsBtn.addEventListener('click', function () {
      start();
      var el = player;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    });
  }
})();
