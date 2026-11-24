/* Bottleneck site script. Each page sets PAGE, ROOT and ARG before this file loads. */
(function(){
  "use strict";
  var PAGE = window.PAGE || "home", ROOT = window.ROOT || "", ARG = window.ARG || "";
  var CAT = {stock:"Stock", markets:"Markets", research:"Research", portfolio:"Portfolio"};
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var MINUS = "−";
  var BUY = {Bought:1, Added:1};
  var state = {cat:"all", q:"", ticker:null, sort:"w"};

  /* ---------- helpers ---------- */
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function parts(iso){ var p = iso.slice(0, 10).split("-"); return {y:+p[0], m:+p[1]-1, d:+p[2]}; }
  function toT(iso){ var p = parts(iso); return Date.UTC(p.y, p.m, p.d); }
  function fmtLong(iso){ var p = parts(iso); return MONTHS[p.m] + " " + p.d + ", " + p.y; }
  function fmtShort(iso){ var p = parts(iso); return MON[p.m] + " " + (p.d < 10 ? "0" : "") + p.d; }
  function fmtMid(iso){ var p = parts(iso); return MON[p.m] + " " + p.d + ", " + p.y; }
  function fmtDay(iso){ var p = parts(iso); return MON[p.m] + " " + p.d; }
  function signed(v, d){ var n = Math.abs(v).toFixed(d == null ? 1 : d), z = +n === 0; return (v > 0 && !z ? "+" : (v < 0 && !z ? MINUS : "")) + n + "%"; }
  function cls(v){ return v > 0 ? "up" : (v < 0 ? "down" : ""); }
  function cls0(v){ return cls(Math.round(v)); }

  var POSTS = (window.POSTS || []).slice().sort(function(a,b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  var BY_ID = {};
  POSTS.forEach(function(p, i){
    BY_ID[p.id] = p; p.idx = i;
    var tk = (p.tickers || []).slice();
    (p.spec || []).forEach(function(s){ if(tk.indexOf(s) === -1) tk.unshift(s); });
    p.allTickers = tk;
    p.hay = (p.title + " " + p.dek + " " + tk.join(" ") + " " + ((window.POST_TEXT || {})[p.id] || "")).toLowerCase();
  });
  function postUrl(p){ return ROOT + "posts/" + p.slug + ".html"; }
  function postUrlById(id){ var p = BY_ID[id]; return p ? postUrl(p) : ROOT + "index.html"; }
  function thesisUrl(t){ return ROOT + "thesis/" + t + ".html"; }
  function tickerHref(t){ return (window.THESES && THESES[t]) ? thesisUrl(t) : ROOT + "index.html#t-" + t; }
  function chipLink(t){ return '<a class="chip" href="' + tickerHref(t) + '">' + esc(t) + '</a>'; }

  var TS = window.SERIES ? SERIES.dates.map(toT) : [];
  function idxOn(iso){
    var lo = 0, hi = SERIES.dates.length - 1, ans = 0;
    while(lo <= hi){ var mid = (lo + hi) >> 1; if(SERIES.dates[mid] <= iso){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  function acctOn(iso){ return SERIES.acct[idxOn(iso)]; }
  function priceOn(t, iso){ var a = PRICES[t]; if(!a) return null; var v = a[idxOn(iso)]; return v == null ? null : v; }
  function lastPrice(t){ var a = PRICES[t]; if(!a) return null; for(var i = a.length - 1; i >= 0; i--) if(a[i] != null) return a[i]; return null; }
  function sinceChange(t, iso){ var p0 = priceOn(t, iso), p1 = lastPrice(t); return (p0 == null || p1 == null) ? null : (p1 / p0 - 1) * 100; }
  var HOLD = {}; (window.HOLDINGS || []).forEach(function(h){ HOLD[h.t] = h; });

  /* Trades attach to the first post on or after their date; earlier trades predate the journal. */
  var ASC = POSTS.slice().reverse(), TRADES_BY_POST = {}, PRE_JOURNAL = [];
  (window.TRADES || []).forEach(function(tr){
    if(ASC.length && tr.d < ASC[0].date){ PRE_JOURNAL.push(tr); return; }
    for(var i = 0; i < ASC.length; i++){
      if(ASC[i].date >= tr.d){ (TRADES_BY_POST[ASC[i].id] = TRADES_BY_POST[ASC[i].id] || []).push(tr); return; }
    }
  });
  function tradeBadge(tr){ return '<span class="trade ' + (BUY[tr.a] ? "buy" : "sell") + '">' + tr.a + " " + esc(tr.t) + '</span>'; }

  /* ---------- events & countdowns ---------- */
  function eventT(e){ return Date.parse(e.when.length === 10 ? e.when + "T00:00:00-05:00" : e.when); }
  function eventTime(e){
    if(e.timeLabel) return e.timeLabel;
    if(e.when.length === 10) return e.tentative ? "Date not confirmed" : "All day";
    var h = +e.when.slice(11, 13), m = e.when.slice(14, 16);
    return ((h % 12) || 12) + ":" + m + " " + (h < 12 ? "AM" : "PM") + " ET";
  }
  function eventDow(e){ var p = parts(e.when); return DOW[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()]; }
  function countdown(e, now){
    var ms = eventT(e) - now;
    if(e.when.length === 10){
      var days = Math.ceil(ms / 86400000);
      if(ms <= -86400000) return {txt:"Done", past:true};
      if(days <= 0) return {txt:"Today", soon:true};
      return {txt:days === 1 ? "Tomorrow" : "In " + days + " days", soon:days <= 1};
    }
    if(ms <= 0) return {txt:"Done", past:true};
    var mins = Math.floor(ms / 60000), hrs = Math.floor(mins / 60), days2 = Math.floor(hrs / 24);
    if(hrs < 24) return {txt:"In " + hrs + " h " + (mins % 60) + " min", soon:true, live:true};
    if(days2 < 2) return {txt:"In 1 day, " + (hrs - 24) + " h", soon:true};
    return {txt:"In " + days2 + " days"};
  }
  function upcoming(now){ return (EVENTS.upcoming || []).filter(function(e){ return !countdown(e, now).past; }).sort(function(a,b){ return eventT(a) - eventT(b); }); }

  /* ---------- home ---------- */
  function renderLatest(){
    var p = POSTS[0];
    $("latest").innerHTML =
      '<p class="meta"><span class="cat new">Latest</span><span class="sep" aria-hidden="true"></span><span class="cat">' + CAT[p.cat] + '</span><span class="sep" aria-hidden="true"></span><time datetime="' + p.date + '">' + fmtMid(p.date) + '</time></p>' +
      '<h1 class="latest-title"><a href="' + postUrl(p) + '">' + esc(p.title) + '</a></h1>' +
      '<p class="dek">' + esc(p.dek) + '</p>' +
      '<div class="row">' + (p.allTickers.length ? '<div class="chips">' + p.allTickers.map(chipLink).join("") + '</div>' : '') + '<a class="more" href="' + postUrl(p) + '">Read the post <span aria-hidden="true">&rarr;</span></a></div>';
  }
  function sparkPath(vals, w, h){
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), pad = 3, n = vals.length - 1;
    var pts = vals.map(function(v, i){ return [(i / n) * w, pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2)]; });
    var line = pts.map(function(p, i){ return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
    return {line:line, area:line + "L" + w + " " + h + "L0 " + h + "Z"};
  }
  function renderSnapshot(){
    var vals = SERIES.acct.filter(function(v, i){ return i % 3 === 0 || i === SERIES.acct.length - 1; });
    var sp = sparkPath(vals, 200, 36);
    $("snapshot").innerHTML =
      '<p class="label"><span>Account</span><span>' + fmtDay(ASOF) + ' close</span></p>' +
      '<dl class="kpis">' +
        '<div class="kpi"><dt>Since start</dt><dd class="v ' + cls(SUMMARY.sinceStart) + '">' + signed(SUMMARY.sinceStart) + '</dd><dd class="cap">Account value vs. money put in</dd></div>' +
        '<div class="kpi"><dt>2026 so far</dt><dd class="v ' + cls(SUMMARY.ytd) + '">' + signed(SUMMARY.ytd) + '</dd><dd class="cap">Time-weighted &middot; S&amp;P 500 ' + signed(SUMMARY.spxYtd) + '</dd>' +
          '<dd class="spark" aria-hidden="true"><svg viewBox="0 0 200 36" preserveAspectRatio="none" width="100%" height="36"><path d="' + sp.area + '" fill="var(--accent)" fill-opacity=".1"/><path d="' + sp.line + '" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></dd></div>' +
        '<div class="kpi"><dt>Cash</dt><dd class="v">' + SUMMARY.cash.toFixed(1) + '%</dd><dd class="cap">' + SUMMARY.positions + ' positions</dd></div>' +
      '</dl>' +
      '<a class="more" href="' + ROOT + 'portfolio.html">Full portfolio <span aria-hidden="true">&rarr;</span></a>';
  }
  function renderStart(){
    $("startGrid").innerHTML = START_HERE.map(function(id){
      var p = BY_ID[id]; if(!p) return "";
      return '<a class="start-card" href="' + postUrl(p) + '"><span class="label">Research &middot; ' + fmtDay(p.date) + '</span><span class="ttl">' + esc(p.title) + '</span><span class="dk">' + esc(p.dek) + '</span></a>';
    }).join("");
  }
  function renderNext(){
    var box = $("nextGrid"); if(!box) return;
    var list = upcoming(Date.now()).slice(0, 3);
    box.innerHTML = list.map(function(e){
      var c = countdown(e, Date.now());
      return '<a class="ev-card" href="' + ROOT + 'calendar.html#' + e.id + '"><span class="ev-when"><span class="label">' + eventDow(e) + ' ' + fmtDay(e.when) + '</span><span class="cd' + (c.soon ? " soon" : "") + '" data-ev="' + e.id + '">' + c.txt + '</span></span><span class="ttl">' + esc(e.title) + '</span><span class="dk">' + esc(e.why) + '</span></a>';
    }).join("") || '<p class="empty">No upcoming events listed.</p>';
  }

  function matches(p){
    if(state.cat !== "all" && p.cat !== state.cat) return false;
    if(state.ticker && p.allTickers.indexOf(state.ticker) === -1) return false;
    if(state.q){ var terms = state.q.split(/\s+/); for(var i = 0; i < terms.length; i++){ if(terms[i] && p.hay.indexOf(terms[i]) === -1) return false; } }
    return true;
  }
  var shown = [];
  function renderTimeline(){
    shown = POSTS.filter(matches);
    var filtered = state.cat !== "all" || state.q || state.ticker;
    var html = '<svg class="tl-svg" aria-hidden="true"></svg>' +
      '<div class="tl-row"><div class="tl-now"><p><span class="label">Now</span> &nbsp;' + fmtMid(ASOF) + ' close &middot; 2026 so far <strong class="' + cls(SUMMARY.ytd) + '">' + signed(SUMMARY.ytd) + '</strong></p></div></div>';
    var cur = "";
    shown.forEach(function(p, k){
      var d = parts(p.date), key = d.y + "-" + d.m;
      if(key !== cur){ html += '<div class="tl-row"><h3 class="month-h tl-mh">' + MONTHS[d.m] + " " + d.y + '</h3></div>'; cur = key; }
      var trades = (TRADES_BY_POST[p.id] || []).map(tradeBadge).join(""), since = "";
      (p.spec || []).forEach(function(t){ var c = sinceChange(t, p.date); if(c != null) since += '<span class="since ' + cls0(c) + '">' + esc(t) + " " + signed(c, 0) + ' since</span>'; });
      var tks = p.allTickers.slice(0, 4).map(function(t){ return '<span class="chip">' + esc(t) + '</span>'; }).join("");
      if(p.allTickers.length > 4) tks += '<span class="chip">+' + (p.allTickers.length - 4) + '</span>';
      html += '<div class="tl-row"><a class="tl-card" href="' + postUrl(p) + '" data-k="' + k + '">' +
        '<div class="tl-meta"><time class="d" datetime="' + p.date + '">' + fmtShort(p.date) + '</time><span class="label">' + CAT[p.cat] + '</span>' + (trades ? '<span class="trades">' + trades + '</span>' : '') + '</div>' +
        '<h4 class="ttl">' + esc(p.title) + '</h4><p class="dk">' + esc(p.dek) + '</p>' +
        ((tks || since) ? '<div class="tl-foot">' + tks + since + '</div>' : '') + '</a></div>';
    });
    html += '<div class="tl-row"><div class="tl-start"><p><span class="label">Start</span> &nbsp;January 1, 2026 &middot; the year begins at 0%</p>' +
      (!filtered && PRE_JOURNAL.length ? '<div class="trades" aria-label="Trades before the journal began">' + PRE_JOURNAL.map(tradeBadge).join("") + '</div>' : '') + '</div></div>';
    $("tl").innerHTML = html;
    $("empty").hidden = shown.length > 0;
    var af = $("activeFilter");
    if(state.ticker){
      af.hidden = false;
      af.innerHTML = '<span>Posts about</span><button type="button" class="clear" id="clearTicker" aria-label="Clear ticker filter ' + esc(state.ticker) + '">' + esc(state.ticker) + ' <span aria-hidden="true">&times;</span></button>' +
        (THESES[state.ticker] ? '<a class="more" href="' + thesisUrl(state.ticker) + '">Thesis page <span aria-hidden="true">&rarr;</span></a>' : '');
      $("clearTicker").addEventListener("click", function(){ history.replaceState(null, "", location.pathname); state.ticker = null; renderTimeline(); });
    } else { af.hidden = true; af.innerHTML = ""; }
    document.querySelectorAll("#seg button").forEach(function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-cat") === state.cat)); });
    requestAnimationFrame(drawSpine);
  }
  function drawSpine(){
    var tl = $("tl"); if(!tl) return;
    var svg = tl.querySelector(".tl-svg"); if(!svg) return;
    var W = parseFloat(getComputedStyle(tl).getPropertyValue("--spine")) || 220;
    var top = tl.getBoundingClientRect().top, H = tl.offsetHeight;
    function midY(el){ var r = el.getBoundingClientRect(); return r.top - top + r.height / 2; }
    var anchors = [{date:ASOF, y:midY(tl.querySelector(".tl-now p")), kind:"now"}];
    tl.querySelectorAll(".tl-card").forEach(function(c){
      var p = shown[+c.getAttribute("data-k")];
      anchors.push({date:p.date, y:midY(c.querySelector(".tl-meta .d")), k:+c.getAttribute("data-k"), trade:!!(TRADES_BY_POST[p.id] || []).length});
    });
    anchors.push({date:SERIES.dates[0], y:midY(tl.querySelector(".tl-start p")), kind:"start"});
    var lo = Math.min(0, Math.min.apply(null, SERIES.acct)), hi = Math.max.apply(null, SERIES.acct), pad = W < 120 ? 6 : 14;
    function X(v){ return pad + (v - lo) / (hi - lo) * (W - pad * 2); }
    var pts = [];
    for(var i = 0; i < anchors.length; i++){
      var A = anchors[i]; pts.push([X(acctOn(A.date)), A.y]);
      var B = anchors[i + 1]; if(!B) break;
      var tA = toT(A.date), tB = toT(B.date); if(tA <= tB) continue;
      for(var j = idxOn(A.date); j >= 0 && TS[j] > tB; j--){ if(TS[j] >= tA) continue; pts.push([X(SERIES.acct[j]), A.y + (tA - TS[j]) / (tA - tB) * (B.y - A.y)]); }
    }
    var line = pts.map(function(p, i){ return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
    var x0 = X(0), s = "";
    [0, 50, 100].forEach(function(v){
      if(v < lo || v > hi) return;
      var x = X(v).toFixed(1);
      s += '<line x1="' + x + '" x2="' + x + '" y1="' + (anchors[0].y + 14) + '" y2="' + H + '" stroke="' + (v === 0 ? "var(--rule-2)" : "var(--grid)") + '" stroke-width="1"/>';
      if(W >= 120) s += '<text x="' + x + '" y="' + (anchors[0].y - 10) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + (v === 0 ? "0%" : "+" + v + "%") + '</text>';
    });
    s += '<path d="' + line + "L" + x0.toFixed(1) + " " + pts[pts.length - 1][1].toFixed(1) + "L" + x0.toFixed(1) + " " + pts[0][1].toFixed(1) + 'Z" fill="var(--accent)" fill-opacity=".07"/>';
    s += '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    anchors.forEach(function(A){
      var x = X(acctOn(A.date)), y = A.y, xs = x.toFixed(1), ys = y.toFixed(1);
      if(A.kind === "now"){ s += '<circle cx="' + xs + '" cy="' + ys + '" r="6" fill="var(--accent)" stroke="var(--bg)" stroke-width="3"/><line x1="' + (x + 8).toFixed(1) + '" x2="' + (W + 12) + '" y1="' + ys + '" y2="' + ys + '" stroke="var(--accent)" stroke-width="1"/>'; return; }
      if(A.kind === "start"){ s += '<circle cx="' + xs + '" cy="' + ys + '" r="4" fill="var(--bg)" stroke="var(--rule-2)" stroke-width="2"/><line x1="' + (x + 6).toFixed(1) + '" x2="' + (W + 12) + '" y1="' + ys + '" y2="' + ys + '" stroke="var(--rule-2)" stroke-width="1"/>'; return; }
      s += '<line x1="' + (x + 6).toFixed(1) + '" x2="' + (W + 12) + '" y1="' + ys + '" y2="' + ys + '" stroke="var(--rule-2)" stroke-width="1"/>';
      s += A.trade ? '<circle class="tl-dot" data-k="' + A.k + '" cx="' + xs + '" cy="' + ys + '" r="5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/>'
                   : '<circle class="tl-dot" data-k="' + A.k + '" cx="' + xs + '" cy="' + ys + '" r="4" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>';
    });
    svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = s;
  }
  function initHome(){
    var h = (location.hash || "").replace(/^#/, "");
    /* Old single-page links keep working. */
    if(h.indexOf("p-") === 0 && BY_ID[h]){ location.replace(postUrl(BY_ID[h])); return; }
    if(h === "map" || h === "theses" || h === "portfolio" || h === "calendar"){ location.replace(ROOT + h + ".html"); return; }
    if(h.indexOf("th-") === 0 && THESES[h.slice(3).toUpperCase()]){ location.replace(thesisUrl(h.slice(3).toUpperCase())); return; }
    renderLatest(); renderSnapshot(); renderNext(); renderStart();
    function applyHash(){
      var hh = (location.hash || "").replace(/^#/, "");
      state.ticker = hh.indexOf("t-") === 0 ? hh.slice(2).toUpperCase() : null;
      renderTimeline();
      if(state.ticker){ var a = $("timeline"); if(a) window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 70); }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    $("tl").addEventListener("mouseover", function(e){
      var c = e.target.closest ? e.target.closest(".tl-card") : null;
      var on = document.querySelector(".tl-dot.on"); if(on) on.classList.remove("on");
      if(c){ var d = document.querySelector('.tl-dot[data-k="' + c.getAttribute("data-k") + '"]'); if(d) d.classList.add("on"); }
    });
    $("tl").addEventListener("mouseleave", function(){ var on = document.querySelector(".tl-dot.on"); if(on) on.classList.remove("on"); });
    document.querySelectorAll("#seg button").forEach(function(b){ b.addEventListener("click", function(){ state.cat = b.getAttribute("data-cat"); renderTimeline(); }); });
    $("q").addEventListener("input", function(e){ state.q = e.target.value.trim().toLowerCase(); renderTimeline(); });
    $("clearAll").addEventListener("click", function(){ state.cat = "all"; state.q = ""; $("q").value = ""; state.ticker = null; history.replaceState(null, "", location.pathname); renderTimeline(); });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(drawSpine);
    setInterval(renderNext, 30000);
  }

  /* ---------- post: reading progress ---------- */
  var progTick = false;
  function drawProgress(){
    progTick = false;
    var bar = $("progress"), art = $("article"); if(!bar || !art) return;
    var W = bar.clientWidth, start = art.getBoundingClientRect().top + window.scrollY - 80;
    var end = start + art.offsetHeight - window.innerHeight + 80;
    var p = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start)));
    var hx = p * W, tail = Math.min(44, hx), s = "";
    if(hx > 2){
      [[1, "var(--ink-2)", .45], [3.5, "var(--accent)", 1], [6, "var(--ink-2)", .45]].forEach(function(l){
        s += '<path d="M0 ' + l[0] + 'H' + (hx - tail).toFixed(1) + 'C' + (hx - tail / 2).toFixed(1) + ' ' + l[0] + ' ' + (hx - tail / 2).toFixed(1) + ' 3.5 ' + hx.toFixed(1) + ' 3.5" fill="none" stroke="' + l[1] + '" stroke-opacity="' + l[2] + '" stroke-width="1.5"/>';
      });
    }
    bar.querySelector("svg").innerHTML = s;
  }
  function initPost(){
    $("progress").hidden = false;
    window.addEventListener("scroll", function(){ if(!progTick){ progTick = true; requestAnimationFrame(drawProgress); } }, {passive:true});
    drawProgress();
  }

  /* ---------- charts ---------- */
  function niceStep(range, target){ var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : (f < 3 ? 2 : (f < 7 ? 5 : 10))) * mag; }
  function lineChart(box, opts){
    var W = box.clientWidth; if(!W) return;
    var narrow = W < 560, H = opts.height ? opts.height(narrow) : (narrow ? 230 : 320);
    var m = {t:16, r: narrow ? 12 : (opts.endLabels ? 150 : 24), b:28, l:44}, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var lastP = parts(SERIES.dates[SERIES.dates.length - 1]), t0 = TS[0], t1 = Date.UTC(lastP.y, lastP.m + 1, 1);
    var all = []; opts.series.forEach(function(s){ s.vals.forEach(function(v){ if(v != null) all.push(v); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), step = niceStep(hi - lo || 10, narrow ? 4 : 6);
    var y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
    function X(t){ return m.l + (t - t0) / (t1 - t0) * iw; }
    function Y(v){ return m.t + (1 - (v - y0) / (y1 - y0)) * ih; }
    function path(arr){ var s = "", pen = false; arr.forEach(function(v, i){ if(v == null){ pen = false; return; } s += (pen ? "L" : "M") + X(TS[i]).toFixed(1) + " " + Y(v).toFixed(1); pen = true; }); return s; }
    var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    for(var v = y0; v <= y1 + 1e-9; v += step){
      var yy = Y(v).toFixed(1);
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + (Math.abs(v) < 1e-9 ? "var(--rule-2)" : "var(--grid)") + '" stroke-width="1"/>';
      s += '<text x="' + (m.l - 8) + '" y="' + yy + '" dy="0.32em" text-anchor="end" font-size="11" fill="var(--muted)" style="font-variant-numeric:tabular-nums">' + (v > 0 ? "+" : (v < 0 ? MINUS : "")) + Math.abs(v) + '%</text>';
    }
    for(var mo = 0; mo <= lastP.m; mo++){
      if(narrow && mo % 2 === 1) continue;
      var tx = X(Date.UTC(lastP.y, mo, 1));
      s += '<text x="' + tx.toFixed(1) + '" y="' + (H - 8) + '" font-size="11" fill="var(--muted)">' + MON[mo] + '</text><line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih + 4) + '" stroke="var(--rule-2)"/>';
    }
    opts.series.slice().reverse().forEach(function(se){ s += '<path d="' + path(se.vals) + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.main ? 2.25 : 2) + '" stroke-linejoin="round" stroke-linecap="round"/>'; });
    var n = TS.length - 1;
    if(opts.endLabels && !narrow){
      var placed = [];
      opts.series.forEach(function(se){
        var ey = Y(se.vals[n]), ly = ey;
        placed.forEach(function(p){ if(Math.abs(ly - p) < 16) ly = p + (ly >= p ? 16 : -16); });
        placed.push(ly);
        var ex = X(TS[n]);
        s += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4" fill="' + se.color + '" stroke="var(--surface)" stroke-width="2"/>';
        s += '<text x="' + (ex + 14) + '" y="' + ly.toFixed(1) + '" dy="0.32em" font-size="12" fill="' + (se.main ? "var(--ink)" : "var(--ink-2)") + '"><tspan font-weight="650" style="font-variant-numeric:tabular-nums">' + signed(se.vals[n], 1) + '</tspan><tspan dx="6" fill="var(--muted)">' + se.short + '</tspan></text>';
      });
    }
    s += '<g class="hover" visibility="hidden"><line class="hx" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--ink-2)" stroke-width="1" stroke-opacity=".5"/>' +
      opts.series.map(function(se, i){ return '<circle class="h' + i + '" r="4" fill="' + se.color + '" stroke="var(--surface)" stroke-width="2"/>'; }).join("") + '</g>';
    s += '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
    (opts.marks || []).forEach(function(mk){ s += mk(X, Y, narrow); });
    s += '</svg><div class="tip" hidden></div>';
    box.innerHTML = s;
    var svg = box.querySelector("svg"), g = box.querySelector(".hover"), tip = box.querySelector(".tip"), cur = n;
    function place(i){
      cur = Math.max(0, Math.min(n, i));
      var x = X(TS[cur]);
      g.setAttribute("visibility", "visible"); g.querySelector(".hx").setAttribute("x1", x); g.querySelector(".hx").setAttribute("x2", x);
      opts.series.forEach(function(se, k){
        var c = g.querySelector(".h" + k), val = se.vals[cur];
        if(val == null){ c.setAttribute("visibility", "hidden"); return; }
        c.setAttribute("visibility", "visible"); c.setAttribute("cx", x); c.setAttribute("cy", Y(val));
      });
      tip.hidden = false; tip.innerHTML = "";
      var td = document.createElement("p"); td.className = "td"; td.textContent = fmtMid(SERIES.dates[cur]); tip.appendChild(td);
      opts.series.forEach(function(se){
        if(se.vals[cur] == null) return;
        var row = document.createElement("div"); row.className = "tr";
        var k = document.createElement("span"); k.className = "key"; k.style.background = se.color;
        var vv = document.createElement("span"); vv.className = "tv"; vv.textContent = signed(se.vals[cur]);
        var l = document.createElement("span"); l.className = "tl"; l.textContent = se.label;
        row.appendChild(k); row.appendChild(vv); row.appendChild(l); tip.appendChild(row);
      });
      if(opts.tipExtra){ opts.tipExtra(cur).forEach(function(txt){ var r = document.createElement("div"); r.className = "tr"; r.textContent = txt; tip.appendChild(r); }); }
      var tw = tip.offsetWidth, left = x + 14;
      if(left + tw > W) left = x - tw - 14;
      tip.style.left = Math.max(0, left) + "px"; tip.style.top = (m.t + 4) + "px";
    }
    function hide(){ g.setAttribute("visibility", "hidden"); tip.hidden = true; }
    function nearest(clientX){
      var r = svg.getBoundingClientRect(), x = clientX - r.left, t = t0 + (x - m.l) / iw * (t1 - t0), best = 0, bd = Infinity;
      for(var i = 0; i <= n; i++){ var dd = Math.abs(TS[i] - t); if(dd < bd){ bd = dd; best = i; } }
      return best;
    }
    var hit = box.querySelector(".hit");
    hit.addEventListener("pointermove", function(e){ place(nearest(e.clientX)); });
    hit.addEventListener("pointerdown", function(e){ place(nearest(e.clientX)); });
    hit.addEventListener("pointerleave", hide);
    box.onkeydown = function(e){
      if(e.key === "ArrowLeft"){ e.preventDefault(); place(cur - 1); } else if(e.key === "ArrowRight"){ e.preventDefault(); place(cur + 1); }
      else if(e.key === "Home"){ e.preventDefault(); place(0); } else if(e.key === "End"){ e.preventDefault(); place(n); } else if(e.key === "Escape"){ hide(); }
    };
    box.onfocus = function(){ place(cur); }; box.onblur = hide;
  }

  /* ---------- portfolio ---------- */
  function renderPortfolio(){
    var t = {}; LAYERS.forEach(function(l){ t[l] = {w:0, tk:[]}; });
    HOLDINGS.forEach(function(h){ t[h.layer].w += h.w; t[h.layer].tk.push(h.t); });
    var layers = LAYERS.map(function(l){ return {name:l, w:t[l].w, tk:t[l].tk}; }).sort(function(a,b){ return b.w - a.w; });
    var maxW = Math.max(SUMMARY.cash, layers[0].w);
    var alloc = layers.map(function(l){
      return '<div class="arow"><div class="aname">' + esc(l.name) + '<span class="atk">' + l.tk.join(" · ") + '</span></div><div class="abar" aria-hidden="true"><i style="width:' + (l.w / maxW * 100).toFixed(1) + '%"></i></div><div class="aval">' + l.w.toFixed(1) + '%</div></div>';
    }).join("") + '<div class="arow cash"><div class="aname">Cash<span class="atk">Money market</span></div><div class="abar" aria-hidden="true"><i style="width:' + (SUMMARY.cash / maxW * 100).toFixed(1) + '%"></i></div><div class="aval">' + SUMMARY.cash.toFixed(1) + '%</div></div>';
    var months = MONTHLY.map(function(mm){ return '<th scope="col">' + mm[0] + '</th>'; }).join("");
    function mrow(label, idx, ytd, main){ return '<tr' + (main ? ' class="main"' : '') + '><td>' + label + '</td>' + MONTHLY.map(function(mm){ return '<td class="' + cls(mm[idx]) + '">' + signed(mm[idx]) + '</td>'; }).join("") + '<td class="ytd ' + cls(ytd) + '">' + signed(ytd) + '</td></tr>'; }
    var dec = DECISIONS.map(function(d, i){ return '<li><a href="' + postUrlById(d.post) + '"><span class="dnum">' + (i + 1) + '</span><span class="d">' + fmtDay(d.d) + '</span><span>' + esc(d.label) + '</span></a></li>'; }).join("");
    $("root").innerHTML =
      '<div class="page-head"><h1 class="page-title">Portfolio</h1><p class="asof">As of the ' + fmtLong(ASOF) + ' close</p></div>' +
      '<div class="kpi-strip">' +
        '<div class="tile"><span class="label">Since start</span><span class="v ' + cls(SUMMARY.sinceStart) + '">' + signed(SUMMARY.sinceStart) + '</span><span class="cap">Account value vs. money put in</span></div>' +
        '<div class="tile"><span class="label">2026 so far</span><span class="v ' + cls(SUMMARY.ytd) + '">' + signed(SUMMARY.ytd) + '</span><span class="cap">Time-weighted &middot; S&amp;P 500 ' + signed(SUMMARY.spxYtd) + '</span></div>' +
        '<div class="tile"><span class="label">Cash</span><span class="v">' + SUMMARY.cash.toFixed(1) + '%</span><span class="cap">Of the account</span></div>' +
        '<div class="tile"><span class="label">Positions</span><span class="v">' + SUMMARY.positions + '</span><span class="cap">Plus cash</span></div>' +
      '</div>' +
      '<section class="card" aria-labelledby="perfTitle"><div class="card-head"><div><h2 class="card-title" id="perfTitle">2026 return, with the decisions behind it</h2><p class="card-sub">Time-weighted from December 31, 2025. Numbered points open the post explaining each move.</p></div>' +
        '<ul class="legend" aria-hidden="true"><li><span class="key" style="background:var(--accent)"></span>Account</li><li><span class="key" style="background:var(--ctx-1)"></span>Semiconductor ETF (SMH)</li><li><span class="key" style="background:var(--ctx-2)"></span>S&amp;P 500</li></ul></div>' +
        '<div class="chart" id="chart" tabindex="0" role="img" aria-label="Line chart of 2026 time-weighted returns with numbered decision points. Account ' + signed(SUMMARY.ytd) + ', semiconductor ETF ' + signed(SUMMARY.smhYtd) + ', S&amp;P 500 ' + signed(SUMMARY.spxYtd) + '. The decisions are listed below the chart."></div>' +
        '<ol class="decisions" aria-label="Decision points">' + dec + '</ol>' +
        '<div class="table-wrap"><table class="monthly"><caption class="sr">Monthly returns in 2026</caption><thead><tr><th scope="col">Month</th>' + months + '<th scope="col">2026</th></tr></thead><tbody>' +
          mrow("Account", 1, SUMMARY.ytd, true) + mrow("SMH", 3, SUMMARY.smhYtd) + mrow("S&amp;P 500", 2, SUMMARY.spxYtd) + '</tbody></table></div></section>' +
      '<section class="card" aria-labelledby="allocTitle"><div class="card-head"><h2 class="card-title" id="allocTitle">Where the money sits</h2><p class="card-sub">Share of the account by layer &middot; <a class="more" href="' + ROOT + 'map.html">See the bottleneck map</a></p></div><div class="alloc">' + alloc + '</div></section>' +
      '<section class="card" aria-labelledby="holdTitle"><div class="card-head"><h2 class="card-title" id="holdTitle">Holdings</h2><p class="card-sub">Select a row to open its thesis</p></div><div class="hold-wrap" id="holdWrap"></div></section>' +
      '<p class="note">' + (PARTIAL_NOTE ? esc(PARTIAL_NOTE) + " " : "") + 'Return vs. cost uses the brokerage cost basis. Time-weighted returns remove the effect of when cash was added.</p>';
    renderHoldings(); renderChart();
  }
  function renderHoldings(){
    var rows = HOLDINGS.slice().sort(function(a,b){ return state.sort === "r" ? b.r - a.r : b.w - a.w; });
    var maxW = HOLDINGS.reduce(function(mx,h){ return Math.max(mx, h.w); }, SUMMARY.cash);
    var body = rows.map(function(h){
      return '<tr data-t="' + h.t + '" tabindex="0" aria-label="' + esc(h.name) + ', ' + h.w.toFixed(1) + ' percent of account, ' + signed(h.r) + ' versus cost. Open thesis.">' +
        '<td class="tkr">' + h.t + '</td><td class="co">' + esc(h.name) + '</td><td class="ly">' + esc(h.layer) + '</td>' +
        '<td class="r"><div class="wcell"><span class="wbar" aria-hidden="true"><i style="width:' + (h.w / maxW * 100).toFixed(1) + '%"></i></span><span class="num">' + h.w.toFixed(1) + '%</span></div></td>' +
        '<td class="r ret ' + cls(h.r) + '">' + signed(h.r) + '</td></tr>';
    }).join("") + '<tr class="cashrow"><td class="tkr">CASH</td><td class="co">Money market</td><td class="ly">&nbsp;</td><td class="r"><div class="wcell"><span class="wbar" aria-hidden="true"><i style="width:' + (SUMMARY.cash / maxW * 100).toFixed(1) + '%"></i></span><span class="num">' + SUMMARY.cash.toFixed(1) + '%</span></div></td><td class="r ret">&nbsp;</td></tr>';
    $("holdWrap").innerHTML = '<table class="holdings"><thead><tr><th scope="col">Ticker</th><th scope="col">Company</th><th scope="col" class="ly">Layer</th>' +
      '<th scope="col" class="r"><button type="button" data-sort="w" aria-pressed="' + (state.sort === "w") + '">Weight</button></th><th scope="col" class="r"><button type="button" data-sort="r" aria-pressed="' + (state.sort === "r") + '">Vs. cost</button></th></tr></thead><tbody>' + body + '</tbody></table>';
    $("holdWrap").querySelectorAll("th button").forEach(function(b){ b.addEventListener("click", function(){ state.sort = b.getAttribute("data-sort"); renderHoldings(); }); });
    $("holdWrap").querySelectorAll("tbody tr[data-t]").forEach(function(tr){
      function go(){ location.href = thesisUrl(tr.getAttribute("data-t")); }
      tr.addEventListener("click", go);
      tr.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); go(); } });
    });
  }
  function renderChart(){
    var box = $("chart"); if(!box) return;
    lineChart(box, {
      endLabels:true,
      series:[{vals:SERIES.acct, color:"var(--accent)", label:"Account", short:"Account", main:true}, {vals:SERIES.smh, color:"var(--ctx-1)", label:"SMH", short:"SMH"}, {vals:SERIES.spx, color:"var(--ctx-2)", label:"S&P 500", short:"S&amp;P 500"}],
      marks:[function(X, Y, narrow){
        var r = narrow ? 7 : 9, off = narrow ? 14 : 18, out = "";
        DECISIONS.forEach(function(d, i){
          var x = X(toT(d.d)), y = Y(acctOn(d.d)) - off;
          out += '<a href="' + postUrlById(d.post) + '" aria-label="Decision ' + (i + 1) + ': ' + esc(d.label) + '"><line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (y + r).toFixed(1) + '" y2="' + (y + off - 3).toFixed(1) + '" stroke="var(--accent)" stroke-width="1"/>' +
            '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.5"/><text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" dy="0.35em" text-anchor="middle" font-size="' + (narrow ? 9 : 11) + '" font-weight="650" fill="var(--accent-ink)">' + (i + 1) + '</text></a>';
        });
        return out;
      }]
    });
  }

  /* ---------- map ---------- */
  var LEVEL = ["", "Loose", "Easing", "Balanced", "Tight", "Tightest"];
  function pinchSvg(level, w, h, style){
    var f = [0, .86, .66, .46, .27, .1][level], c = h / 2, gap = (h - 8) / 4, out = "";
    for(var i = 0; i < 5; i++){
      var off = (i - 2) * gap, yL = c + off, yP = c + off * f, yR = c + off * (0.45 + f * 0.4);
      out += '<path class="' + (i === 2 ? "c" : "") + '" d="M2 ' + yL.toFixed(1) + 'C' + (w * .32).toFixed(1) + ' ' + yL.toFixed(1) + ' ' + (w * .32).toFixed(1) + ' ' + yP.toFixed(1) + ' ' + (w * .55).toFixed(1) + ' ' + yP.toFixed(1) + 'C' + (w * .74).toFixed(1) + ' ' + yP.toFixed(1) + ' ' + (w * .74).toFixed(1) + ' ' + yR.toFixed(1) + ' ' + (w - 2) + ' ' + yR.toFixed(1) + '"/>';
    }
    return '<svg class="pinch" viewBox="0 0 ' + w + ' ' + h + '"' + (style ? ' style="' + style + '"' : '') + ' aria-hidden="true">' + out + '</svg>';
  }
  function node(t){
    var h = HOLD[t], th = THESES[t];
    if(!h) return '<a class="node watch" href="' + tickerHref(t) + '"><span class="tkr">' + t + '</span><span class="nw">Watching</span></a>';
    return '<a class="node" href="' + tickerHref(t) + '" aria-label="' + esc(th ? th.name : t) + ', ' + h.w.toFixed(1) + ' percent of account, ' + signed(h.r, 0) + ' versus cost"><span class="tkr">' + t + '</span><span class="nw">' + h.w.toFixed(1) + '%</span><span class="nr ' + cls(h.r) + '">' + signed(h.r, 0) + '</span></a>';
  }
  function renderMap(){
    var tight = MAP_LAYERS.filter(function(l){ return l.level === 5; }).map(function(l){ return l.name; }).join(" and ");
    $("root").innerHTML =
      '<div class="page-head"><h1 class="page-title">The bottleneck map</h1><p class="asof">Updated ' + fmtLong(ASOF) + '</p></div>' +
      '<p class="lede">Every AI data center depends on the same layers, from raw materials to the buildings themselves. Profits pile up wherever supply is tightest, so I try to own the tight layers and the ones likely to be next. Right now I think the tightest are ' + esc(tight.toLowerCase()) + '.</p>' +
      '<div class="map-key"><span>' + pinchSvg(1, 44, 24, "width:44px;height:24px") + 'Loose</span><span>' + pinchSvg(5, 44, 24, "width:44px;height:24px") + 'Tightest</span><span>Percent of account &middot; return vs. cost</span></div>' +
      '<div class="map">' + MAP_LAYERS.map(function(l){
        var posts = l.posts.map(function(id){ var p = BY_ID[id]; return p ? '<li><a href="' + postUrl(p) + '">' + esc(p.title) + '</a></li>' : ""; }).join("");
        return '<section class="layer" aria-label="' + esc(l.name) + '">' + pinchSvg(l.level, 120, 62) +
          '<div><h2 class="lname">' + esc(l.name) + '</h2><p class="ldesc">' + esc(l.desc) + '</p><p class="lnote"><span class="level">' + LEVEL[l.level] + '</span>' + esc(l.note) + '</p></div>' +
          '<div class="nodes">' + l.tickers.map(node).join("") + (l.watch || []).map(node).join("") + '</div>' + (posts ? '<ul class="lposts">' + posts + '</ul>' : '') + '</section>';
      }).join("") + '</div><p class="note">How tight each layer is comes from my own reading of company reports and news, not from a dataset.</p>';
  }

  /* ---------- theses ---------- */
  var STATUS_CLS = {"On track":"ok", "Under review":"review", "Broken":"broken", "Closed":"", "Watching":"watching"};
  function statusHtml(s){ return '<span class="status ' + (STATUS_CLS[s] || "") + '">' + s + '</span>'; }
  function convHtml(n){ var w = ["none","low","medium","high"][n]; return '<span class="conv" title="Conviction: ' + w + '" aria-label="Conviction ' + w + '"><i class="' + (n >= 1 ? "on" : "") + '"></i><i class="' + (n >= 2 ? "on" : "") + '"></i><i class="' + (n >= 3 ? "on" : "") + '"></i></span>'; }
  function thRow(t){
    var th = THESES[t], h = HOLD[t];
    var w = h ? '<span class="th-num w">' + h.w.toFixed(1) + '%</span>' : '<span class="th-num w muted">' + (th.watch ? "Not owned" : "Closed") + '</span>';
    var r = h ? '<span class="th-num rr ' + cls(h.r) + '">' + signed(h.r, 0) + '</span>' : (th.result != null ? '<span class="th-num rr ' + cls(th.result) + '">' + signed(th.result, 0) + '</span>' : '<span class="th-num rr muted">&ndash;</span>');
    return '<a class="th-row" href="' + thesisUrl(t) + '"><span class="tkr">' + t + '</span><span class="th-n th-name">' + esc(th.name) + '<span class="th-sub">' + esc((th.thesis.match(/^[^.]*\./) || [th.thesis])[0]) + '</span></span>' + statusHtml(th.status) + (th.conv ? convHtml(th.conv) : '<span class="conv"></span>') + w + r + '</a>';
  }
  function renderTheses(){
    var open = HOLDINGS.map(function(h){ return h.t; }).filter(function(t){ return THESES[t]; });
    var closed = Object.keys(THESES).filter(function(t){ return THESES[t].status === "Closed"; });
    var watch = Object.keys(THESES).filter(function(t){ return THESES[t].watch; });
    var review = open.filter(function(t){ return THESES[t].status === "Under review"; }).length;
    var cols = '<div class="th-cols" aria-hidden="true"><span>Ticker</span><span>Company and thesis</span><span>Status</span><span>Conviction</span><span class="r">Weight</span><span class="r">Vs. cost</span></div>';
    $("root").innerHTML =
      '<div class="page-head"><h1 class="page-title">Theses</h1><p class="asof">' + open.length + ' open &middot; ' + review + ' under review</p></div>' +
      '<p class="lede">Every position, why I own it, and what would make me sell. When a thesis weakens or breaks, it stays here with the record of how it happened.</p>' +
      '<section class="th-group"><h2 class="label">Open positions</h2>' + cols + '<div class="th-list">' + open.map(thRow).join("") + '</div></section>' +
      '<section class="th-group"><h2 class="label">Closed in 2026</h2><div class="th-list">' + closed.map(thRow).join("") + '</div></section>' +
      '<section class="th-group"><h2 class="label">Watching, not owned</h2><div class="th-list">' + watch.map(thRow).join("") + '</div></section>' +
      '<p class="note">Status and conviction are my own judgment and change as the posts do.</p>';
  }
  function renderStockChart(t){
    var box = $("tpChart"); if(!box) return;
    var a = PRICES[t]; if(!a) return;
    var base = null; for(var i = 0; i < a.length; i++){ if(a[i] != null){ base = a[i]; break; } }
    var vals = a.map(function(v){ return v == null ? null : (v / base - 1) * 100; });
    var trades = TRADES.filter(function(tr){ return tr.t === t; });
    lineChart(box, {
      height:function(narrow){ return narrow ? 210 : 280; },
      series:[{vals:vals, color:"var(--accent)", label:t, short:t, main:true}],
      tipExtra:function(i){ return trades.filter(function(tr){ return tr.d === SERIES.dates[i]; }).map(function(tr){ return tr.a + " " + tr.t; }); },
      marks:[function(X, Y){
        var out = "";
        trades.forEach(function(tr){
          var v = vals[idxOn(tr.d)]; if(v == null) return;
          var x = X(toT(tr.d)), y = Y(v);
          out += BUY[tr.a]
            ? '<path d="M' + x.toFixed(1) + ' ' + (y + 8).toFixed(1) + 'l-6 10h12z" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"><title>' + tr.a + ' ' + fmtDay(tr.d) + '</title></path>'
            : '<path d="M' + x.toFixed(1) + ' ' + (y - 8).toFixed(1) + 'l-6 -10h12z" fill="var(--ink-2)" stroke="var(--surface)" stroke-width="1.5"><title>' + tr.a + ' ' + fmtDay(tr.d) + '</title></path>';
        });
        return out;
      }]
    });
  }
  function renderThesis(t){
    var th = THESES[t], h = HOLD[t];
    var posts = POSTS.filter(function(p){ return p.allTickers.indexOf(t) > -1; });
    var trades = TRADES.filter(function(tr){ return tr.t === t; });
    var items = posts.map(function(p){ return {d:p.date, p:p}; }).concat(trades.map(function(tr){ return {d:tr.d, tr:tr}; }));
    items.sort(function(a,b){ return a.d < b.d ? 1 : (a.d > b.d ? -1 : (a.tr ? 1 : -1)); });
    var a = PRICES[t], base = null, baseDate = null;
    if(a){ for(var i = 0; i < a.length; i++){ if(a[i] != null){ base = a[i]; baseDate = SERIES.dates[i]; break; } } }
    var ytd = (a && base) ? (lastPrice(t) / base - 1) * 100 : null;
    var firstPost = posts.length ? posts[posts.length - 1] : null, sinceFirst = firstPost ? sinceChange(t, firstPost.date) : null;
    var tiles = h
      ? '<div class="tile"><span class="label">Weight</span><span class="v">' + h.w.toFixed(1) + '%</span><span class="cap">Of the account</span></div><div class="tile"><span class="label">Vs. cost</span><span class="v ' + cls(h.r) + '">' + signed(h.r, 1) + '</span><span class="cap">Brokerage cost basis</span></div>'
      : '<div class="tile"><span class="label">Position</span><span class="v">' + (th.watch ? "None" : "Closed") + '</span><span class="cap">' + esc(th.closed || "Not owned") + '</span></div><div class="tile"><span class="label">Posts</span><span class="v">' + posts.length + '</span><span class="cap">Mentioning ' + t + '</span></div>';
    tiles += '<div class="tile"><span class="label">' + (baseDate && baseDate > SERIES.dates[0] ? "Since listing" : "Stock in 2026") + '</span><span class="v ' + cls(ytd || 0) + '">' + (ytd == null ? "n/a" : signed(ytd, 0)) + '</span><span class="cap">Through ' + fmtDay(ASOF) + '</span></div>' +
      '<div class="tile"><span class="label">Since first post</span><span class="v ' + cls(sinceFirst || 0) + '">' + (sinceFirst == null ? "n/a" : signed(sinceFirst, 0)) + '</span><span class="cap">' + (firstPost ? fmtMid(firstPost.date) : "No posts yet") + '</span></div>';
    var tl = items.map(function(it){
      if(it.tr) return '<li><span class="d">' + fmtShort(it.d) + '</span><span>' + tradeBadge(it.tr) + '</span><span></span></li>';
      var c = sinceChange(t, it.p.date);
      return '<li><span class="d">' + fmtShort(it.d) + '</span><span><a href="' + postUrl(it.p) + '">' + esc(it.p.title) + '</a><span class="dk">' + esc(it.p.dek) + '</span></span>' + (c == null ? '<span></span>' : '<span class="since ' + cls0(c) + '">' + signed(c, 0) + ' since</span>') + '</li>';
    }).join("");
    var evs = (EVENTS.upcoming || []).filter(function(e){ return (e.tickers || []).indexOf(t) > -1 && !countdown(e, Date.now()).past; });
    $("root").innerHTML =
      '<a class="back" href="' + ROOT + 'theses.html"><span aria-hidden="true">&larr;</span> Theses</a>' +
      '<div class="tp-head"><span class="tp-tkr">' + t + '</span><h1 class="page-title">' + esc(th.name) + '</h1><div class="tp-badges">' + statusHtml(th.status) + (th.conv ? '<span class="conv-wrap">Conviction ' + convHtml(th.conv) + '</span>' : '') +
        (h ? '<span class="asof">' + esc(h.layer) + '</span>' : '') + (th.since ? '<span class="asof">Held since ' + esc(th.since) + '</span>' : '') + '</div></div>' +
      '<div class="kpi-strip">' + tiles + '</div>' +
      '<div class="tp-grid"><section class="card tp-block"><h2 class="label">The thesis</h2><p>' + esc(th.thesis) + '</p></section><section class="card tp-block"><h2 class="label">' + (th.status === "Closed" ? "Why I sold" : "What would change my mind") + '</h2><p>' + esc(th.trigger) + '</p></section></div>' +
      (evs.length ? '<section class="card"><div class="card-head"><h2 class="card-title">Coming up</h2><a class="more" href="' + ROOT + 'calendar.html">Full calendar <span aria-hidden="true">&rarr;</span></a></div><ul class="tline">' + evs.map(function(e){ return '<li><span class="d">' + fmtShort(e.when) + '</span><span><a href="' + ROOT + 'calendar.html#' + e.id + '">' + esc(e.title) + '</a><span class="dk">' + esc(e.watch) + '</span></span><span class="since">' + countdown(e, Date.now()).txt + '</span></li>'; }).join("") + '</ul></section>' : '') +
      (a ? '<section class="card"><div class="card-head"><div><h2 class="card-title">' + t + ' in 2026</h2><p class="card-sub">Price change' + (baseDate > SERIES.dates[0] ? " since listing on " + fmtMid(baseDate) : " from December 31, 2025") + '. Up arrows are buys and adds, down arrows are trims and sales.</p></div></div><div class="chart" id="tpChart" tabindex="0" role="img" aria-label="Price change for ' + t + ' in 2026 with trade markers"></div></section>' : '') +
      '<section class="card"><div class="card-head"><h2 class="card-title">Timeline</h2><p class="card-sub">Every post and trade, newest first</p></div><ul class="tline">' + tl + '</ul></section>';
    renderStockChart(t);
  }

  /* ---------- calendar ---------- */
  function renderCalendar(){
    var now = Date.now(), list = upcoming(now), next = list[0];
    var passedUnwritten = (EVENTS.upcoming || []).filter(function(e){ return countdown(e, now).past; });
    function chips(e){ return (e.tickers || []).map(chipLink).join(""); }
    function row(e){
      var c = countdown(e, now);
      return '<li class="ev" id="' + e.id + '"><div class="ev-date"><span class="ev-day">' + fmtDay(e.when) + '</span><span class="ev-dow">' + eventDow(e) + ' &middot; ' + eventTime(e) + '</span></div>' +
        '<div class="ev-body"><h3 class="ev-title">' + esc(e.title) + (e.tentative ? ' <span class="ev-tag">Not confirmed</span>' : '') + '</h3><p class="ev-why">' + esc(e.why) + '</p><p class="ev-watch"><span class="label">What I&rsquo;m watching</span> ' + esc(e.watch) + '</p>' + (chips(e) ? '<div class="chips">' + chips(e) + '</div>' : '') + '</div>' +
        '<div class="ev-cd"><span class="cd' + (c.soon ? " soon" : "") + '" data-ev="' + e.id + '">' + c.txt + '</span></div></li>';
    }
    var hero = next ? '<section class="ev-hero" id="' + next.id + '" aria-label="Next event"><span class="label">Next up &middot; ' + eventDow(next) + ' ' + fmtMid(next.when) + ' &middot; ' + eventTime(next) + '</span>' +
      '<h2 class="ev-hero-title">' + esc(next.title) + (next.tentative ? ' <span class="ev-tag">Not confirmed</span>' : '') + '</h2><p class="ev-why">' + esc(next.why) + '</p>' +
      '<p class="ev-watch"><span class="label">What I&rsquo;m watching</span> ' + esc(next.watch) + '</p>' + (chips(next) ? '<div class="chips">' + chips(next) + '</div>' : '') +
      '<p class="ev-hero-cd"><span class="cd-big" data-ev="' + next.id + '">' + countdown(next, now).txt + '</span></p></section>' : '';
    $("root").innerHTML =
      '<div class="page-head"><h1 class="page-title">Calendar</h1><p class="asof">Times are Eastern &middot; updated ' + fmtMid(EVENTS.updated) + '</p></div>' +
      '<p class="lede">Upcoming events that could move my holdings, what I&rsquo;m watching for in each, and how past events turned out.</p>' + hero +
      (list.length > 1 ? '<section class="th-group"><h2 class="label">After that</h2><ul class="evs">' + list.slice(1).map(row).join("") + '</ul></section>' : '') +
      (passedUnwritten.length ? '<section class="th-group"><h2 class="label">Just happened</h2><ul class="evs">' + passedUnwritten.map(function(e){ return '<li class="ev"><div class="ev-date"><span class="ev-day">' + fmtDay(e.when) + '</span><span class="ev-dow">' + eventDow(e) + '</span></div><div class="ev-body"><h3 class="ev-title">' + esc(e.title) + '</h3><p class="ev-why">My write-up is coming.</p></div><div class="ev-cd"><span class="cd">Done</span></div></li>'; }).join("") + '</ul></section>' : '') +
      '<section class="th-group"><h2 class="label">Past</h2><ul class="evs">' + (EVENTS.past || []).map(function(e){
        var p = BY_ID[e.post];
        return '<li class="ev past"><div class="ev-date"><span class="ev-day">' + fmtDay(e.when) + '</span><span class="ev-dow">' + eventDow(e) + '</span></div><div class="ev-body"><h3 class="ev-title">' + esc(e.title) + '</h3><p class="ev-why">' + esc(e.happened) + '</p>' +
          (p ? '<a class="ev-take" href="' + postUrl(p) + '"><span class="label">My post</span> ' + esc(p.title) + ' <span aria-hidden="true">&rarr;</span></a>' : '') + '</div></li>';
      }).join("") + '</ul></section>';
    if(location.hash){ var el = document.getElementById(location.hash.slice(1)); if(el){ el.classList.add("hl"); el.scrollIntoView(); } }
  }
  function tickCalendar(){
    var now = Date.now();
    document.querySelectorAll(".cd[data-ev]").forEach(function(el){
      var e = null; (EVENTS.upcoming || []).forEach(function(x){ if(x.id === el.getAttribute("data-ev")) e = x; });
      if(e){ var c = countdown(e, now); el.textContent = c.txt; el.classList.toggle("soon", !!c.soon); }
    });
    document.querySelectorAll(".cd-big[data-ev]").forEach(function(el){
      (EVENTS.upcoming || []).forEach(function(x){ if(x.id === el.getAttribute("data-ev")) el.textContent = countdown(x, now).txt; });
    });
  }

  /* ---------- boot ---------- */
  var lastW = 0, rt = null;
  function onResize(){
    var w = document.body.clientWidth; if(w === lastW) return; lastW = w;
    clearTimeout(rt);
    rt = setTimeout(function(){
      if(PAGE === "home") drawSpine();
      if(PAGE === "portfolio") renderChart();
      if(PAGE === "thesis") renderStockChart(ARG);
      if(PAGE === "post") drawProgress();
    }, 120);
  }
  if(window.ResizeObserver) new ResizeObserver(onResize).observe(document.body); else window.addEventListener("resize", onResize);

  if(PAGE === "home") initHome();
  else if(PAGE === "post") initPost();
  else if(PAGE === "portfolio") renderPortfolio();
  else if(PAGE === "map") renderMap();
  else if(PAGE === "theses") renderTheses();
  else if(PAGE === "thesis" && THESES[ARG]) renderThesis(ARG);
  else if(PAGE === "calendar"){ renderCalendar(); setInterval(tickCalendar, 30000); }
})();
