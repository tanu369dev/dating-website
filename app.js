(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "spark-dating-v1";
  const LIKED_YOU = [2, 5, 9, 11]; // profiles that already liked you (instant match when you like back)
  const DAILY_LIKES = 10;

  /* ---------- state ---------- */
  const defaults = () => ({
    liked: [], passed: [], matches: {}, likesLeft: DAILY_LIKES, supers: 0, likesSent: 0,
    rewinds: 3, gold: false, theme: "dark",
    filters: { show: "all", age: 40, dist: 50, interest: "", ver: false },
    me: { name: "You", bio: "", interests: ["Music", "Travel"] }
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { S = defaults(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  const byId = id => PROFILES.find(p => p.id === id);
  let last = null; // last swipe for rewind
  let busy = false;

  /* ---------- helpers ---------- */
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const compat = p => {
    const shared = p.interests.filter(i => S.me.interests.includes(i)).length;
    return Math.min(98, 52 + shared * 14 + (p.id * 7 % 9));
  };
  const open = id => { $(id).hidden = false; };
  const close = el => { el.hidden = true; };
  const avatar = n => `https://randomuser.me/api/portraits/lego/${n}.jpg`;

  /* ---------- theme ---------- */
  function applyTheme() { document.documentElement.dataset.theme = S.theme; $('meta[name="theme-color"]').content = S.theme === "dark" ? "#0f0a1f" : "#fff6f8"; }
  applyTheme();

  /* ---------- landing visuals ---------- */
  $("#year").textContent = new Date().getFullYear();
  const fl = $("#floaters");
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.textContent = ["💖", "💗", "✨", "💘", "💕"][i % 5];
    s.style.cssText = `left:${Math.random() * 100}%;font-size:${14 + Math.random() * 22}px;animation-duration:${10 + Math.random() * 14}s;animation-delay:${-Math.random() * 20}s`;
    fl.appendChild(s);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: .15 });
  const observeReveal = () => $$(".reveal:not(.in)").forEach(el => io.observe(el));
  observeReveal();
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1400), v = end * (1 - Math.pow(1 - k, 3));
      el.textContent = end >= 1e6 ? (v / 1e6).toFixed(1) + "M+" : v.toFixed(dec);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: .5 });
  $$("[data-count]").forEach(el => cio.observe(el));

  /* ---------- view switching ---------- */
  function showApp() {
    $("#landing").hidden = true; $("#app").hidden = false; window.scrollTo(0, 0);
    history.replaceState(null, "", "#app"); renderAll();
  }
  function showHome() { $("#app").hidden = true; $("#landing").hidden = false; history.replaceState(null, "", "#top"); observeReveal(); }
  function setTab(name) {
    $$(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + name));
    $$(".tabbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    if (name === "matches") renderMatches();
    if (name === "chats") renderChats();
    if (name === "profile") renderMe();
    window.scrollTo(0, 0);
  }

  /* ---------- deck ---------- */
  function queue() {
    const f = S.filters, done = new Set([...S.liked, ...S.passed]);
    return PROFILES.filter(p =>
      !done.has(p.id) &&
      (f.show === "all" || p.g === f.show) &&
      p.age <= f.age && p.dist <= f.dist &&
      (!f.interest || p.interests.includes(f.interest)) &&
      (!f.ver || p.ver));
  }
  function cardHTML(p) {
    const score = compat(p);
    return `<div class="photo" style="background-image:url('${p.img}')"></div>
      <div class="score">🔥 ${score}%</div>
      <div class="stamp like">LIKE</div><div class="stamp nope">NOPE</div><div class="stamp sup">SUPER ★</div>
      <div class="pinfo">
        <h3>${esc(p.name)} <small>${p.age}</small>${p.ver ? '<span class="ver" title="Verified">✓</span>' : ""}</h3>
        <div class="pmeta">${esc(p.job)} · ${esc(p.city)} · ${p.dist} km away</div>
        <div class="tags">${p.interests.map(i => `<span class="tag-i ${S.me.interests.includes(i) ? "match" : ""}">${esc(i)}</span>`).join("")}</div>
      </div>`;
  }
  function renderDeck() {
    const deck = $("#deck"), q = queue();
    deck.innerHTML = "";
    $("#empty").hidden = q.length > 0;
    $("#actions").hidden = q.length === 0;
    $(".hint").hidden = q.length === 0;
    deck.hidden = q.length === 0;
    q.slice(0, 3).reverse().forEach(p => {
      const c = document.createElement("div");
      c.className = "pcard"; c.dataset.id = p.id; c.innerHTML = cardHTML(p);
      deck.appendChild(c);
    });
    const top = deck.lastElementChild;
    if (top) attachDrag(top);
    $("#likesLeft").textContent = S.gold ? "∞" : S.likesLeft;
  }

  function attachDrag(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, down = false, moved = false;
    const likeS = $(".stamp.like", card), nopeS = $(".stamp.nope", card), supS = $(".stamp.sup", card);
    card.addEventListener("pointerdown", e => {
      if (busy) return; down = true; moved = false; sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId); card.classList.add("dragging");
    });
    card.addEventListener("pointermove", e => {
      if (!down) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      card.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 18}deg)`;
      likeS.style.opacity = Math.max(0, Math.min(1, dx / 100));
      nopeS.style.opacity = Math.max(0, Math.min(1, -dx / 100));
      supS.style.opacity = dy < -30 && Math.abs(dx) < 80 ? Math.min(1, -dy / 100) : 0;
    });
    const end = () => {
      if (!down) return; down = false; card.classList.remove("dragging");
      if (!moved) { openProfile(+card.dataset.id); return; }
      if (dx > 110) swipe("right");
      else if (dx < -110) swipe("left");
      else if (dy < -120 && Math.abs(dx) < 100) swipe("super");
      else { card.style.transform = ""; [likeS, nopeS, supS].forEach(s => s.style.opacity = 0); }
      dx = dy = 0;
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function swipe(dir) {
    if (busy) return;
    const card = $("#deck").lastElementChild;
    if (!card) return;
    const p = byId(+card.dataset.id);
    if (dir === "info") return openProfile(p.id);
    if (dir === "undo") return rewind();
    const positive = dir === "right" || dir === "super";
    if (positive && !S.gold && S.likesLeft <= 0) {
      card.style.transform = ""; return premium("Out of likes for today", "Go Gold for unlimited likes, Rewind and weekly Super Likes.");
    }
    if (dir === "super" && !S.gold && S.supers >= 1) {
      card.style.transform = ""; return premium("Super Like used", "Free members get 1 Super Like. Gold gets 5 every week.");
    }
    busy = true;
    const W = innerWidth;
    const t = dir === "left" ? `translate(${-W}px,40px) rotate(-25deg)`
            : dir === "right" ? `translate(${W}px,40px) rotate(25deg)`
            : `translate(0,${-innerHeight}px) scale(1.1)`;
    card.classList.remove("dragging");
    card.style.transform = t; card.style.opacity = 0;
    if (dir === "super") $(".stamp.sup", card).style.opacity = 1;

    last = { id: p.id, dir };
    if (positive) {
      S.liked.push(p.id); S.likesSent++; if (!S.gold) S.likesLeft--;
      if (dir === "super") S.supers++;
    } else S.passed.push(p.id);
    save();

    setTimeout(() => {
      busy = false; renderDeck();
      if (positive) {
        const chance = dir === "super" || LIKED_YOU.includes(p.id) || Math.random() < .4;
        if (chance) makeMatch(p);
      }
    }, 330);
  }

  function rewind() {
    if (!last) return toast("Nothing to rewind");
    if (!S.gold && S.rewinds <= 0) return premium("Rewind is a Gold feature", "Undo any swipe with unlimited Rewinds.");
    const id = last.id, wasPos = last.dir !== "left";
    S.liked = S.liked.filter(x => x !== id); S.passed = S.passed.filter(x => x !== id);
    if (wasPos) { S.likesSent--; if (!S.gold) S.likesLeft++; if (last.dir === "super") S.supers--; }
    delete S.matches[id];
    if (!S.gold) S.rewinds--;
    last = null; save(); renderDeck(); toast("Rewound ↩");
  }

  /* ---------- match ---------- */
  function makeMatch(p) {
    if (S.matches[p.id]) return;
    S.matches[p.id] = { msgs: [], unread: 0, t: Date.now() };
    save();
    $("#mImgMe").src = avatar(3); $("#mImgThem").src = p.img;
    $("#matchText").textContent = `You and ${p.name} liked each other.`;
    $("#mSay").onclick = () => { close($("#mMatch")); openChat(p.id); };
    open("#mMatch"); confetti(); renderBadges();
    // she/he may text first
    setTimeout(() => {
      const m = S.matches[p.id];
      if (m && !m.msgs.length) {
        m.msgs.push({ from: "them", text: `Hey ${S.me.name === "You" ? "you" : S.me.name}! 👋 Glad we matched.` });
        if ($("#mChat").hidden || $("#mChat").dataset.id != p.id) m.unread++;
        save(); renderBadges(); renderChats();
        if ($("#mChat").dataset.id == p.id && !$("#mChat").hidden) renderMsgs(p.id);
      }
    }, 7000);
  }

  function confetti() {
    const cv = $("#confetti"), ctx = cv.getContext("2d");
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const cols = ["#ff7a59", "#ff2d78", "#c43cff", "#ffd76a", "#2ee6a6", "#3dc5ff"];
    const ps = Array.from({ length: 110 }, () => ({
      x: cv.width / 2, y: cv.height / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 3,
      s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0]
    }));
    let f = 0;
    (function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
      if (++f < 150 && !$("#mMatch").hidden) requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---------- profile modal ---------- */
  function openProfile(id) {
    const p = byId(id), sc = compat(p);
    $("#profileBody").innerHTML = `
      <div class="cover" style="background-image:url('${p.img}')"></div>
      <div class="body">
        <h2>${esc(p.name)}, ${p.age} ${p.ver ? '<span class="ver">✓</span>' : ""}</h2>
        <div style="color:var(--muted)">${esc(p.job)} · ${esc(p.city)} · ${p.dist} km away</div>
        <p>${esc(p.bio)}</p>
        <div class="prompt"><small>${esc(p.prompt[0])}</small><p>${esc(p.prompt[1])}</p></div>
        <div><b>${sc}% compatible</b><div class="bar"><i style="width:0" data-w="${sc}"></i></div></div>
        <div class="tags">${p.interests.map(i => `<span class="tag-i ${S.me.interests.includes(i) ? "match" : ""}">${esc(i)}</span>`).join("")}</div>
        <div class="row"><button class="btn btn-ghost" data-close>Close</button>${S.matches[p.id] ? `<button class="btn btn-primary" data-chat="${p.id}">Message</button>` : ""}</div>
      </div>`;
    open("#mProfile");
    requestAnimationFrame(() => requestAnimationFrame(() => { const b = $(".bar i", $("#profileBody")); if (b) b.style.width = b.dataset.w + "%"; }));
  }

  /* ---------- matches / chats ---------- */
  function renderMatches() {
    const ids = Object.keys(S.matches).map(Number);
    $("#matchRow").innerHTML = ids.length
      ? ids.map(id => { const p = byId(id); return `<div class="mini" data-chat="${id}"><img src="${p.img}" alt=""><span>${esc(p.name)}</span></div>`; }).join("")
      : `<p class="note">No matches yet — keep swiping! 💘</p>`;
    $("#likedGrid").innerHTML = LIKED_YOU.map(id => {
      const p = byId(id); return `<div class="liked ${S.gold ? "open" : ""}" data-liked="${id}"><img src="${p.img}" alt=""></div>`;
    }).join("");
  }
  function renderChats() {
    const ids = Object.keys(S.matches).map(Number).sort((a, b) => S.matches[b].t - S.matches[a].t);
    $("#chatList").innerHTML = ids.length ? ids.map(id => {
      const p = byId(id), m = S.matches[id], l = m.msgs[m.msgs.length - 1];
      return `<div class="chat-item" data-chat="${id}"><img src="${p.img}" alt=""><div class="t"><b>${esc(p.name)}</b><p>${l ? esc(l.text) : "Say hi 👋 — you matched!"}</p></div>${m.unread ? '<span class="dot"></span>' : ""}</div>`;
    }).join("") : `<p class="note">Your conversations will show up here once you match.</p>`;
  }
  function renderBadges() {
    const n = Object.values(S.matches).reduce((a, m) => a + (m.unread || 0), 0);
    const u = $("#unread"); u.hidden = !n; u.textContent = n;
  }
  function renderMsgs(id) {
    const m = S.matches[id], box = $("#msgs");
    box.innerHTML = m.msgs.length ? m.msgs.map(x => `<div class="msg ${x.from}">${esc(x.text)}</div>`).join("")
      : `<p class="note" style="text-align:center">You matched! Break the ice 👇</p>`;
    box.scrollTop = box.scrollHeight;
  }
  function openChat(id) {
    const p = byId(id), m = S.matches[id]; if (!m) return;
    close($("#mProfile")); m.unread = 0; save(); renderBadges();
    const ch = $("#mChat"); ch.dataset.id = id;
    $("#cImg").src = p.img; $("#cName").textContent = p.name; $("#cStatus").textContent = "Online";
    $("#ice").innerHTML = ICEBREAKERS.sort(() => Math.random() - .5).slice(0, 4).map(t => `<button type="button">${esc(t)}</button>`).join("");
    renderMsgs(id); open("#mChat"); $("#cInput").focus({ preventScroll: true });
  }
  function sendMsg(text) {
    const ch = $("#mChat"), id = +ch.dataset.id, m = S.matches[id]; if (!m || !text.trim()) return;
    m.msgs.push({ from: "me", text: text.trim() }); m.t = Date.now(); save(); renderMsgs(id);
    const box = $("#msgs"), ty = document.createElement("div");
    ty.className = "msg them typing"; ty.innerHTML = "<span></span><span></span><span></span>";
    $("#cStatus").textContent = "typing…";
    setTimeout(() => { if (ch.dataset.id == id) { box.appendChild(ty); box.scrollTop = box.scrollHeight; } }, 400);
    setTimeout(() => {
      m.msgs.push({ from: "them", text: REPLIES[Math.random() * REPLIES.length | 0] }); save();
      if (!ch.hidden && ch.dataset.id == id) { renderMsgs(id); $("#cStatus").textContent = "Online"; }
      else { m.unread++; save(); renderBadges(); }
      renderChats();
    }, 1500 + Math.random() * 1200);
  }

  /* ---------- profile (me) ---------- */
  function renderMe() {
    $("#meName").value = S.me.name === "You" ? "" : S.me.name; $("#meBio").value = S.me.bio;
    $("#meTags").innerHTML = ALL_INTERESTS.map(i => `<button type="button" class="tag-i ${S.me.interests.includes(i) ? "on" : ""}" data-int="${i}">${i}</button>`).join("");
    $("#sLikes").textContent = S.likesSent; $("#sMatches").textContent = Object.keys(S.matches).length; $("#sSupers").textContent = S.supers;
  }

  /* ---------- filters / premium ---------- */
  function openFilters() {
    const f = S.filters;
    $("#fShow").value = f.show; $("#fAge").value = f.age; $("#fAgeV").textContent = f.age;
    $("#fDist").value = f.dist; $("#fDistV").textContent = f.dist; $("#fInt").value = f.interest; $("#fVer").checked = f.ver;
    open("#mFilters");
  }
  $("#fInt").innerHTML += ALL_INTERESTS.map(i => `<option>${i}</option>`).join("");
  $("#fAge").oninput = e => $("#fAgeV").textContent = e.target.value;
  $("#fDist").oninput = e => $("#fDistV").textContent = e.target.value;
  $("#fApply").onclick = () => {
    S.filters = { show: $("#fShow").value, age: +$("#fAge").value, dist: +$("#fDist").value, interest: $("#fInt").value, ver: $("#fVer").checked };
    save(); close($("#mFilters")); renderDeck(); toast("Filters applied");
  };
  $("#fClear").onclick = () => { S.filters = defaults().filters; save(); openFilters(); renderDeck(); };
  function premium(title, text) { $("#pTitle").textContent = title || "Get Spark Gold"; $("#pText").textContent = text || "Unlimited likes, Rewind, weekly Super Likes and more."; open("#mPremium"); }
  $("#pGo").onclick = () => { S.gold = true; save(); close($("#mPremium")); renderAll(); toast("👑 Gold unlocked (demo)"); };

  /* ---------- render all ---------- */
  function renderAll() { renderDeck(); renderBadges(); renderMatches(); renderChats(); renderMe(); }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const t = e.target;
    const a = t.closest("[data-action]");
    if (a) {
      const k = a.dataset.action;
      if (k === "launch") showApp();
      else if (k === "home") showHome();
      else if (k === "theme") { S.theme = S.theme === "dark" ? "light" : "dark"; applyTheme(); save(); }
      else if (k === "filters") openFilters();
      else if (k === "reset") { S.passed = []; S.liked = S.liked.filter(id => S.matches[id]); save(); renderDeck(); }
      else if (k === "boost") { toast("🚀 Boost on — you’re top profile for 30 min"); }
      else if (k === "gold") { showApp(); premium(); }
      else if (k === "resetAll") { if (confirm("Reset all demo data?")) { const th = S.theme; S = defaults(); S.theme = th; save(); renderAll(); toast("Reset done"); } }
      return;
    }
    const sw = t.closest("[data-swipe]"); if (sw) return swipe(sw.dataset.swipe);
    const tb = t.closest("[data-tab]"); if (tb) return setTab(tb.dataset.tab);
    const ch = t.closest("[data-chat]"); if (ch) return openChat(+ch.dataset.chat);
    const lk = t.closest("[data-liked]"); if (lk) { return S.gold ? openProfile(+lk.dataset.liked) : premium("See who likes you", "Gold members can see everyone who already likes them."); }
    const it = t.closest("[data-int]");
    if (it) { const i = it.dataset.int, a2 = S.me.interests; S.me.interests = a2.includes(i) ? a2.filter(x => x !== i) : [...a2, i]; save(); renderMe(); return; }
    if (t.closest("[data-close]")) return close(t.closest(".modal"));
    if (t.classList.contains("modal")) return close(t);
    const ib = t.closest("#ice button"); if (ib) { sendMsg(ib.textContent); }
  });
  $("#saveMe").onclick = () => {
    S.me.name = $("#meName").value.trim() || "You"; S.me.bio = $("#meBio").value.trim(); save(); renderDeck(); toast("Profile saved ✓");
  };
  $("#composer").addEventListener("submit", e => { e.preventDefault(); const i = $("#cInput"); sendMsg(i.value); i.value = ""; });
  document.addEventListener("keydown", e => {
    if ($("#app").hidden) return;
    if (e.key === "Escape") $$(".modal").forEach(m => m.hidden = true);
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ($$(".modal").some(m => !m.hidden)) return;
    if (!$("#tab-discover").classList.contains("active")) return;
    const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "super", z: "undo", i: "info" };
    if (map[e.key]) { e.preventDefault(); swipe(map[e.key]); }
  });

  if (location.hash === "#app") showApp();
})();
