/* Jhonattan Rivera, portfolio */

(function () {
  "use strict";
  window.__jr = true;

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  const hasLibs = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const animate = hasLibs && root.classList.contains("js");
  if (!animate) root.classList.remove("js", "intro");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Small facts ---------- */
  const START_YEAR = 2020;
  const now = new Date();
  const years = Math.max(1, now.getFullYear() - START_YEAR);
  const yearsEl = $("#years-count");
  if (yearsEl) { yearsEl.dataset.to = String(years); yearsEl.textContent = String(years); }
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(now.getFullYear());

  const timeEl = $("#bogota-time");
  const clockFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false
  });
  const tickClock = () => { if (timeEl) timeEl.textContent = clockFmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 20000);

  /* ---------- Text splitting ---------- */
  function splitWords(el, chars) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement.closest(".w")) return;
      if (!node.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span");
        w.className = "w";
        if (chars) {
          Array.from(chunk).forEach((c) => {
            const ch = document.createElement("span");
            ch.className = "ch";
            ch.textContent = c;
            w.appendChild(ch);
          });
        } else {
          w.textContent = chunk;
        }
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  function splitAll() {
    $$("[data-split]").forEach((el) => splitWords(el, el.dataset.split === "chars"));
  }

  /* ---------- Language ---------- */
  const LANG_KEY = "jr-lang";
  const META = {
    en: {
      title: "Jhonattan Rivera · Integrations Manager | Payments",
      desc: "Jhonattan Rivera leads the Integrations team at Akua. He has worked in payments since 2020, at gateways, acquirers and issuers across Latin America."
    },
    es: {
      title: "Jhonattan Rivera · Integrations Manager | Pagos",
      desc: "Jhonattan Rivera lidera el equipo de Integraciones en Akua. Trabaja en pagos desde 2020, en gateways, adquirentes y emisores de Latinoamérica."
    }
  };

  function pickLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "es") return saved;
    } catch (e) {}
    return (navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
  }

  const onLangChange = [];

  function applyLang(lang) {
    root.lang = lang;
    $$("[data-en]").forEach((el) => {
      const next = el.getAttribute("data-" + lang);
      if (next == null) return;
      if (/<[a-z][\s\S]*>/i.test(next)) el.innerHTML = next;
      else el.textContent = next;
    });
    splitAll();
    document.title = META[lang].title;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", META[lang].desc);
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    onLangChange.forEach((fn) => fn(lang));
  }

  $$(".lang button").forEach((b) => b.addEventListener("click", () => {
    if (root.lang !== b.dataset.lang) applyLang(b.dataset.lang);
  }));

  // Hero name is language neutral; split it once into characters.
  $$(".hero-name .line-in").forEach((el) => splitWords(el, true));
  applyLang(pickLang());

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (animate) {
    // Pinned sections and restored scroll positions don't mix well; start at the top.
    if (!location.hash) window.scrollTo(0, 0);
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.clearScrollMemory("manual");
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (typeof window.Lenis !== "undefined") {
      lenis = new Lenis({ lerp: 0.1 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ---------- Nav and menu ---------- */
  const nav = $(".nav");
  const menu = $("#menu");
  const menuBtn = $(".menu-btn");
  let menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open
      ? (root.lang === "es" ? "Cerrar" : "Close")
      : menuBtn.getAttribute("data-" + root.lang);
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) nav.classList.remove("is-hidden");
  }

  menuBtn.addEventListener("click", () => setMenu(!menuOpen));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) setMenu(false); });

  let lastY = window.scrollY;
  function onScrollNav() {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    if (!menuOpen) {
      if (y > 240 && y > lastY + 2) nav.classList.add("is-hidden");
      else if (y < lastY - 2 || y <= 240) nav.classList.remove("is-hidden");
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : target, { duration: 1.6 });
    else if (id === "#top") window.scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", id);
  }));

  if (!animate) return;

  /* =====================================================================
     Motion
     ===================================================================== */

  /* ---------- Reveal helpers ---------- */
  function revealWords(el, delay) {
    el.classList.add("is-in");
    const chars = $$(".ch", el);
    if (chars.length) {
      gsap.fromTo(chars,
        { yPercent: 70, opacity: 0, rotate: 6 },
        { yPercent: 0, opacity: 1, rotate: 0, duration: 1.2, ease: "expo.out", stagger: 0.035, delay });
      return;
    }
    gsap.fromTo($$(".w", el),
      { opacity: 0, y: 22, filter: "blur(12px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.15, ease: "power3.out", stagger: 0.045, delay, clearProps: "filter" });
  }

  function reveal(el) {
    if (el.classList.contains("is-in")) return;
    const delay = parseFloat(el.dataset.delay || "0");
    const type = el.dataset.reveal;
    if (type === "words") return revealWords(el, delay);
    el.classList.add("is-in");
    if (type === "line") {
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "expo.inOut", delay });
    } else {
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay });
    }
  }

  $$("[data-reveal]").forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => reveal(el) });
  });

  /* ---------- Hero portrait ---------- */
  const faceMove = $(".face-move");
  const faceImg = $(".portrait img");
  const ring = $(".ring");
  const tgt = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  let heroP = 0;
  let ringA = 0;
  let ringBoost = 0;

  if (finePointer) {
    window.addEventListener("pointermove", (e) => {
      tgt.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      tgt.y = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    }, { passive: true });
  }

  gsap.ticker.add((time, dt) => {
    if (heroP >= 1) return;
    cur.x += (tgt.x - cur.x) * 0.06;
    cur.y += (tgt.y - cur.y) * 0.06;
    const floatY = Math.sin(time * 0.8) * 6;
    faceMove.style.transform =
      `translate3d(${(cur.x * 14).toFixed(2)}px, ${(cur.y * 10 + floatY).toFixed(2)}px, 0)`;
    faceImg.style.setProperty("--px", (cur.x * -10).toFixed(2) + "px");
    faceImg.style.setProperty("--py", (cur.y * -8).toFixed(2) + "px");
    const v = lenis ? lenis.velocity : 0;
    ringBoost *= 0.96;
    ringA += 0.008 * dt + v * 0.15 + ringBoost;
    ring.style.transform = `rotate(${ringA.toFixed(2)}deg)`;
  });

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom top",
    onUpdate: (self) => { heroP = self.progress; }
  });

  const heroScrub = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".hero-glow", { yPercent: 35, opacity: 0.3, ease: "none", scrollTrigger: heroScrub });

  // The hero only fits one screen on desktop. On phones it's taller than the
  // viewport, so fading it by scroll would dim the text and logos while they're being read.
  gsap.matchMedia().add("(min-width: 901px)", () => {
    gsap.to(".hero-copy", { yPercent: -16, opacity: 0.15, ease: "none", scrollTrigger: heroScrub });
    gsap.to(".face", { y: 120, scale: 0.86, ease: "none", scrollTrigger: heroScrub });
  });

  /* ---------- Intro ---------- */
  function heroIntro() {
    const tl = gsap.timeline();
    gsap.set(".hero-name", { visibility: "visible" });
    tl.fromTo(".hero-name .ch", { yPercent: 112 },
        { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.03 }, 0)
      .fromTo(nav, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "power3.out" }, 0.2)
      .fromTo(".kicker", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, 0.25)
      // Role first, then specialties: the kicker reads in the order it should be read.
      .fromTo(".kicker > span", { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.14, clearProps: "transform,opacity" }, 0.3)
      .add(() => revealWords($(".hero-sub"), 0), 0.5)
      .fromTo(".face", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out" }, 0.3)
      .fromTo(".portrait", { clipPath: "circle(0% at 50% 60%)" },
        { clipPath: "circle(50% at 50% 50%)", duration: 1.8, ease: "expo.out" }, 0.35)
      .fromTo(".portrait img", { "--ps": 1.5 }, { "--ps": 1.08, duration: 2.2, ease: "expo.out" }, 0.35)
      .fromTo(".ring", { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out" }, 0.6)
      .add(() => { ringBoost = 7; }, 0.6)
      .fromTo(".hero-foot [data-intro]", { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.12 }, 0.9);
  }

  function runIntro() {
    const loader = $(".loader");
    if (!root.classList.contains("intro") || !loader) {
      if (loader) loader.remove();
      heroIntro();
      return;
    }
    try { sessionStorage.setItem("jr-intro", "1"); } catch (e) {}
    if (lenis) lenis.stop();
    const tl = gsap.timeline({
      onComplete: () => {
        loader.remove();
        root.classList.remove("intro");
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      }
    });
    tl.fromTo(".loader-logo", { scale: 0.5, rotate: -140, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 1, ease: "expo.out" })
      .fromTo([".loader-line", ".loader-bar"], { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 }, 0.15)
      .fromTo(".loader-bar span", { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "power2.inOut" }, 0.3)
      .add(() => loader.classList.add("ok"), 1.3)
      .to(".loader-logo", { rotate: 360, duration: 1.1, ease: "expo.inOut" }, 1.3)
      .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.05, ease: "expo.inOut" }, 1.8)
      .add(heroIntro, 2.2);
    loader.addEventListener("click", () => tl.timeScale(4));
  }

  /* ---------- Thesis: words light up as you scroll ---------- */
  const thesisText = $(".thesis-text");
  let thesisWords = [];
  let intEl = null;
  let intChars = [];
  const th = { p: 0 };
  // Stable pseudo-random numbers so the scattered letters don't jump on re-render.
  const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function cacheThesis() {
    intEl = $(".int", thesisText);
    intChars = [];
    if (intEl) {
      const w = $(".w", intEl);
      if (w && !$(".ch", w)) {
        const text = w.textContent;
        w.textContent = "";
        Array.from(text).forEach((c) => {
          const ch = document.createElement("span");
          ch.className = "ch";
          ch.textContent = c;
          w.appendChild(ch);
        });
      }
      intChars = $$(".ch", intEl).map((el, i) => ({
        el,
        x: (rand(i) - 0.5) * 1.6,
        y: (rand(i + 17) - 0.5) * 1.8,
        r: (rand(i + 41) - 0.5) * 70,
        last: ""
      }));
    }
    thesisWords = $$(".w", thesisText).map((el) => ({ el, int: !!el.closest(".int"), o: -1 }));
    renderThesis();
  }

  function renderInt(k) {
    const t = Math.pow(1 - k, 3);
    intChars.forEach((c) => {
      const v = `translate(${(c.x * t).toFixed(3)}em, ${(c.y * t).toFixed(3)}em) rotate(${(c.r * t).toFixed(1)}deg)`;
      if (v !== c.last) { c.el.style.transform = v; c.last = v; }
    });
    intEl.classList.toggle("locked", k >= 0.985);
  }

  function renderThesis() {
    const n = thesisWords.length;
    const spread = 6;
    const intSpread = 14;
    const head = th.p * (n + intSpread + 2);
    let intIdx = -1;
    let intK = 0;
    for (let i = 0; i < n; i++) {
      const w = thesisWords[i];
      let k;
      if (w.int) {
        intIdx = i;
        k = intK = clamp((head - i) / intSpread);
      } else if (intIdx >= 0) {
        k = intK; // the period after the word lands with it
      } else {
        k = clamp((head - i) / spread);
      }
      const o = 0.13 + 0.87 * (w.int ? clamp(k * 1.6) : k);
      if (Math.abs(o - w.o) > 0.004) { w.el.style.opacity = o.toFixed(3); w.o = o; }
    }
    if (intEl) renderInt(intK);
  }

  gsap.to(th, {
    p: 1, ease: "none",
    scrollTrigger: { trigger: ".thesis", start: "top top", end: "+=170%", pin: true, scrub: 0.6, anticipatePin: 1 },
    onUpdate: renderThesis
  });
  onLangChange.push(cacheThesis);
  cacheThesis();

  /* ---------- Journey ---------- */
  const route = $(".route");
  const railOut = $(".rail-out");
  const railBack = $(".rail-back");
  const packet = $(".packet");
  const nodes = $$(".node");
  const stories = $$(".story");
  const mtiEl = $("#route-mti");
  const isoWait = $(".iso-wait");
  const iso = $$(".iso-lines li[data-at]").map((el) => {
    const v = $(".iso-v", el);
    return { el, v, note: $(".iso-n", el), at: parseFloat(el.dataset.at), full: v.textContent, n: -1 };
  });

  const OUT0 = 0.04, OUT1 = 0.78, HOLD = 0.88, BACK = 0.96;
  let story = -1;
  let mti = "";
  const rp = { p: 0 };

  function renderRoute() {
    const p = rp.p;
    let pos, phase;
    if (p < OUT0) { pos = 0; phase = 0; }
    else if (p < OUT1) {
      const raw = ((p - OUT0) / (OUT1 - OUT0)) * 4;
      const s = Math.min(3, Math.floor(raw));
      pos = (s + smooth(clamp(raw - s))) / 4;
      phase = 0;
    }
    else if (p < HOLD) { pos = 1; phase = 1; }
    else if (p < BACK) { pos = 1 - smooth((p - HOLD) / (BACK - HOLD)); phase = 2; }
    else { pos = 0; phase = 3; }

    railOut.style.width = (phase === 0 ? pos * 100 : 100) + "%";
    railBack.style.width = (phase === 2 ? (1 - pos) * 100 : phase === 3 ? 100 : 0) + "%";
    packet.style.left = pos * 100 + "%";
    const back = phase >= 2;
    packet.classList.toggle("is-back", back);
    route.classList.toggle("is-back", phase === 2);
    route.classList.toggle("is-done", phase === 3);

    nodes.forEach((n, i) => {
      n.classList.toggle("is-reached", phase > 0 || pos >= i / 4 - 0.001);
      n.classList.toggle("is-active", phase < 3 && Math.abs(pos - i / 4) < 0.03);
    });

    let idx = 0;
    if (phase >= 2) idx = 5;
    else if (phase === 1) idx = 4;
    else for (let i = 0; i < 5; i++) if (pos >= i / 4 - 0.1) idx = i;
    if (idx !== story) {
      stories.forEach((s, i) => s.classList.toggle("is-active", i === idx));
      story = idx;
    }

    const nextMti = back ? "0110" : "0100";
    if (nextMti !== mti) {
      const first = !mti;
      mti = nextMti;
      mtiEl.textContent = mti;
      if (!first) gsap.fromTo(mtiEl, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: "expo.out" });
    }

    isoWait.classList.toggle("is-on", p < iso[0].at);
    iso.forEach((l) => {
      const k = clamp((p - l.at) / 0.025);
      const n = Math.round(l.full.length * k);
      if (n === l.n) return;
      l.n = n;
      l.el.classList.toggle("is-on", k > 0);
      l.v.textContent = l.full.slice(0, n) + (n > 0 && n < l.full.length ? "▍" : "");
      l.note.style.opacity = k >= 1 ? "1" : "0";
    });
  }

  gsap.to(rp, {
    p: 1, ease: "none",
    scrollTrigger: {
      trigger: route, start: "top top",
      end: () => "+=" + Math.round(window.innerHeight * 4),
      pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true
    },
    onUpdate: renderRoute
  });
  renderRoute();

  /* ---------- Counters ---------- */
  $$(".count").forEach((el) => {
    const to = parseInt(el.dataset.to, 10) || 0;
    // Count in step with the card's own staggered fade, not all at once.
    const host = el.closest("[data-delay]");
    const lag = host ? parseFloat(host.dataset.delay) || 0 : 0;
    el.textContent = "0";
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => {
        const o = { v: 0 };
        gsap.to(o, {
          v: to, duration: 1.8 + Math.min(to, 40) * 0.01, ease: "power3.out", delay: 0.15 + lag,
          onUpdate: () => { el.textContent = String(Math.round(o.v)); }
        });
      }
    });
  });

  /* ---------- Vocabulary marquee ---------- */
  const marquees = $$(".marquee").map((m) => ({
    m, track: $(".marquee-track", m), dir: parseFloat(m.dataset.dir) || -1, x: 0, w: 1, vis: false, slow: 1
  }));

  function buildMarquees() {
    marquees.forEach((q) => {
      $$(".clone", q.track).forEach((c) => c.remove());
      const set = $(".marquee-set", q.track);
      for (let i = 0; i < 2; i++) {
        const c = set.cloneNode(true);
        c.classList.add("clone");
        c.setAttribute("aria-hidden", "true");
        q.track.appendChild(c);
      }
      q.w = set.offsetWidth || 1;
      q.x = q.dir > 0 ? -q.w : 0;
    });
  }

  buildMarquees();
  onLangChange.push(buildMarquees);
  // Re-measure once per frame at most, and keep the offset inside the new loop width so it never jumps.
  let marqueeResize = 0;
  window.addEventListener("resize", () => {
    if (marqueeResize) return;
    marqueeResize = requestAnimationFrame(() => {
      marqueeResize = 0;
      marquees.forEach((q) => {
        q.w = $(".marquee-set", q.track).offsetWidth || 1;
        q.x = ((q.x % q.w) - q.w) % q.w;
      });
    });
  });

  const mio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const q = marquees.find((x) => x.m === e.target); if (q) q.vis = e.isIntersecting; });
  });
  marquees.forEach((q) => {
    mio.observe(q.m);
    q.m.addEventListener("pointerenter", () => { q.slow = 0.25; });
    q.m.addEventListener("pointerleave", () => { q.slow = 1; });
  });

  let scrollDir = 1;
  if (lenis) lenis.on("scroll", (e) => { if (e.direction) scrollDir = e.direction; });

  gsap.ticker.add((time, dt) => {
    const v = lenis ? Math.abs(lenis.velocity) : 0;
    const step = (0.05 * dt + Math.min(v * 0.5, 30));
    marquees.forEach((q) => {
      if (!q.vis) return;
      q.x += q.dir * scrollDir * step * q.slow;
      if (q.x <= -q.w) q.x += q.w;
      if (q.x > 0) q.x -= q.w;
      q.track.style.transform = `translate3d(${q.x.toFixed(2)}px, 0, 0)`;
    });
  });

  /* ---------- Contact ---------- */
  gsap.fromTo(".seal", { rotate: -200, scale: 0.5, opacity: 0 }, {
    rotate: 0, scale: 1, opacity: 1, ease: "none",
    scrollTrigger: { trigger: ".contact", start: "top 90%", end: "top 25%", scrub: 0.8 }
  });

  if (finePointer) {
    const mail = $(".mail");
    const inner = $(".mail-in");
    const xTo = gsap.quickTo(inner, "x", { duration: 0.7, ease: "power3" });
    const yTo = gsap.quickTo(inner, "y", { duration: 0.7, ease: "power3" });
    mail.addEventListener("pointermove", (e) => {
      const r = mail.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.1);
      yTo((e.clientY - r.top - r.height / 2) * 0.3);
    });
    mail.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  }

  /* ---------- Go ---------- */
  onLangChange.push(() => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  runIntro();
})();
