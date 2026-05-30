/* =========================================================================
   Jhonattan Rivera — Liquid Glass Portfolio
   ========================================================================= */

(function () {
  "use strict";

  /* ---------- Year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- i18n EN/ES ---------- */
  const LANG_KEY = "jr-lang";
  const initialLang = localStorage.getItem(LANG_KEY) || "en";

  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-en], [data-es]").forEach((el) => {
      const next = el.getAttribute(`data-${lang}`);
      if (next == null) return;
      // If content contains HTML tags (em), use innerHTML; else textContent
      if (/<[a-z][\s\S]*>/i.test(next)) {
        el.innerHTML = next;
      } else {
        // Preserve child elements like <em> that were swapped via innerHTML earlier
        // Replace text content while keeping structure when no markup is provided
        el.textContent = next;
      }
    });
    document.querySelectorAll(".lang-toggle").forEach((tg) => {
      tg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
      });
    });
    localStorage.setItem(LANG_KEY, lang);
  }

  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    b.addEventListener("click", () => applyLang(b.dataset.lang));
  });
  applyLang(initialLang);

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector(".nav-burger");
  const sheet = document.querySelector(".mobile-sheet");
  if (burger && sheet) {
    burger.addEventListener("click", () => {
      const open = sheet.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    sheet.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        sheet.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- Smooth anchor (in addition to CSS smooth) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", id);
    });
  });

  /* ---------- Scroll reveal via IntersectionObserver ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- Hero + section scroll transforms (Liquid Glass focus shift) ---------- */
  const heroSection = document.getElementById("hero-section");
  const heroCardWrap = document.querySelector(".hero-card-wrap");
  const heroAvatarStage = document.querySelector(".hero-avatar-stage");
  const mesh = document.querySelector(".mesh");
  const scrollCue = document.querySelector(".scroll-cue");
  const scrollStages = Array.from(document.querySelectorAll(".scroll-stage"));

  let lastScroll = -1;
  let ticking = false;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onScroll() {
    if (prefersReducedMotion) return;
    if (!ticking) {
      requestAnimationFrame(updateScroll);
      ticking = true;
    }
  }

  function updateScroll() {
    const y = window.scrollY;
    if (y === lastScroll) {
      ticking = false;
      return;
    }
    lastScroll = y;

    const vh = window.innerHeight;
    // Hero progress 0..1 (within first viewport)
    const heroP = Math.min(Math.max(y / (vh * 0.85), 0), 1);

    if (heroCardWrap) {
      const ty = heroP * -40;
      const op = 1 - heroP * 0.5;
      heroCardWrap.style.transform = `translate3d(0, ${ty}px, 0)`;
      heroCardWrap.style.opacity = String(op);
    }
    if (heroAvatarStage) {
      const ty = heroP * -60;
      const op = 1 - heroP * 0.5;
      heroAvatarStage.style.transform = `translate3d(0, ${ty}px, 0)`;
      heroAvatarStage.style.opacity = String(op);
    }
    if (scrollCue) {
      scrollCue.style.opacity = String(1 - heroP * 1.8);
    }

    // Mesh slow parallax (cheap — translateY only)
    if (mesh) {
      const meshY = y * 0.08;
      mesh.style.transform = `translate3d(0, ${meshY}px, 0)`;
    }

    // Section focus shift — each .scroll-stage gets --section-p ∈ [0,1]
    // where 1 means its center is near the viewport center.
    const viewportCenter = y + vh / 2;
    const falloff = vh * 0.75;
    for (let i = 0; i < scrollStages.length; i++) {
      const el = scrollStages[i];
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + window.scrollY + rect.height / 2;
      const distance = Math.abs(viewportCenter - elCenter);
      // p = 1 at center, 0 at falloff distance away
      const p = Math.max(0, Math.min(1, 1 - distance / falloff));
      // Smoothstep for nicer easing
      const eased = p * p * (3 - 2 * p);
      el.style.setProperty("--section-p", eased.toFixed(3));
    }

    ticking = false;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  updateScroll();

  /* ---------- Cursor-tracked specular highlight on glass ----------
     Each .glass element gets --gx / --gy updated based on cursor position,
     making the highlight glide across the surface like real glass.
  ---------------------------------------------------------------------- */
  const glassEls = Array.from(document.querySelectorAll(".glass"));
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  let glassRaf = 0;
  let lastPointer = { x: 0, y: 0 };

  function updateGlassSpecular() {
    glassRaf = 0;
    for (let i = 0; i < glassEls.length; i++) {
      const el = glassEls[i];
      const r = el.getBoundingClientRect();
      // Only update visible elements (within 1 viewport above/below)
      if (r.bottom < -window.innerHeight || r.top > window.innerHeight * 2) continue;
      const x = ((lastPointer.x - r.left) / r.width) * 100;
      const y = ((lastPointer.y - r.top) / r.height) * 100;
      el.style.setProperty("--gx", `${x}%`);
      el.style.setProperty("--gy", `${y}%`);
    }
  }

  if (!isCoarsePointer && !prefersReducedMotion) {
    window.addEventListener("pointermove", (e) => {
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      if (!glassRaf) glassRaf = requestAnimationFrame(updateGlassSpecular);
    }, { passive: true });
  }

  /* ---------- Proximity dock effect on chips + foundation logos ----------
     Each element's --prox CSS variable is set based on distance to cursor.
     The CSS uses --prox to scale, lift, and intensify the background.
  ---------------------------------------------------------------------- */
  const proximityGroups = [
    { selector: ".stack-chips", child: ".chip", radius: 160, max: 1 },
    { selector: ".foundation-logos-row", child: "a", radius: 140, max: 1 },
    { selector: ".cap-grid", child: ".cap-card", radius: 320, max: 0.4 }
  ];

  const proximityTargets = proximityGroups.flatMap(g =>
    Array.from(document.querySelectorAll(g.selector)).map(container => ({
      container,
      children: Array.from(container.querySelectorAll(g.child)),
      radius: g.radius,
      max: g.max
    }))
  );

  let proxRaf = 0;
  function updateProximity() {
    proxRaf = 0;
    for (const group of proximityTargets) {
      for (const child of group.children) {
        const r = child.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) {
          child.style.setProperty("--prox", 0);
          continue;
        }
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = lastPointer.x - cx;
        const dy = lastPointer.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const t = Math.max(0, Math.min(group.max, group.max - (dist / group.radius) * group.max));
        child.style.setProperty("--prox", t.toFixed(3));
      }
    }
  }

  if (!isCoarsePointer && !prefersReducedMotion) {
    window.addEventListener("pointermove", () => {
      if (!proxRaf) proxRaf = requestAnimationFrame(updateProximity);
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      proximityTargets.forEach(g => g.children.forEach(c => c.style.setProperty("--prox", 0)));
    });
  }

  /* ---------- Stack chip descriptions ----------
     On hover/focus/touch, show the chip's description in the group's .g-desc bar.
  ---------------------------------------------------------------------- */
  document.querySelectorAll(".stack-group").forEach((group) => {
    const desc = group.querySelector(".g-desc");
    const chips = group.querySelectorAll(".chip");
    if (!desc) return;

    function getCurrentLang() {
      return document.documentElement.lang || localStorage.getItem(LANG_KEY) || "en";
    }

    function showDescFor(chip) {
      const lang = getCurrentLang();
      const text = chip.getAttribute(`data-desc-${lang}`) || chip.getAttribute("data-desc-en") || "";
      desc.textContent = text;
      desc.classList.add("active");
    }

    function clearDesc() {
      desc.classList.remove("active");
    }

    chips.forEach((chip) => {
      chip.addEventListener("pointerenter", () => showDescFor(chip));
      chip.addEventListener("focus", () => showDescFor(chip));
      chip.addEventListener("click", () => showDescFor(chip));
      chip.addEventListener("pointerleave", clearDesc);
      chip.addEventListener("blur", clearDesc);
    });
  });

  /* ---------- Tweaks panel ----------
     Protocol: register message listener first, then announce availability.
  ---------------------------------------------------------------------- */
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "glassBlur": 40,
    "glassOpacity": 22,
    "palette": "warm",
    "showStack": true,
    "animateMesh": true
  }/*EDITMODE-END*/;

  const PALETTES = {
    warm: { b1: "#ffd55e", b2: "#f5d6c3", b3: "#d8cff2", b4: "#c8e4d6" },
    mint: { b1: "#ffe8a3", b2: "#c8e4d6", b3: "#c9d8f0", b4: "#f0e6c8" },
    dawn: { b1: "#ffd1a8", b2: "#f7c1d1", b3: "#d8d0f0", b4: "#ffe2b3" },
    mono: { b1: "#f4f1ea", b2: "#e8e3d6", b3: "#ddd6c5", b4: "#ece6d6" }
  };

  const tweaks = { ...TWEAK_DEFAULTS };
  const root = document.documentElement;

  const mobileMq = window.matchMedia("(max-width: 720px)");

  function applyTweaks() {
    // Mobile: cap blur lower and bump opacity for perf + legibility.
    const isMobile = mobileMq.matches;
    const effBlur = isMobile ? Math.min(tweaks.glassBlur, 24) : tweaks.glassBlur;
    const effOp = isMobile ? Math.max(tweaks.glassOpacity, 32) : tweaks.glassOpacity;
    root.style.setProperty("--glass-blur", `${effBlur}px`);
    root.style.setProperty("--glass-bg", `rgba(255, 255, 252, ${effOp / 100})`);
    root.style.setProperty("--glass-bg-strong", `rgba(255, 255, 252, ${Math.min(1, effOp / 100 + 0.2)})`);
    const p = PALETTES[tweaks.palette] || PALETTES.warm;
    root.style.setProperty("--blob-1", p.b1);
    root.style.setProperty("--blob-2", p.b2);
    root.style.setProperty("--blob-3", p.b3);
    root.style.setProperty("--blob-4", p.b4);
    const stack = document.getElementById("stack");
    if (stack) stack.style.display = tweaks.showStack ? "" : "none";
    if (mesh) {
      mesh.style.setProperty("animation-play-state", tweaks.animateMesh ? "running" : "paused");
      mesh.querySelectorAll("*").forEach((c) => c.style.setProperty("animation-play-state", tweaks.animateMesh ? "running" : "paused"));
    }
    // sync UI
    const blurSlider = document.getElementById("blur-slider");
    const blurVal = document.getElementById("blur-val");
    const opSlider = document.getElementById("opacity-slider");
    const opVal = document.getElementById("opacity-val");
    if (blurSlider) blurSlider.value = tweaks.glassBlur;
    if (blurVal) blurVal.textContent = `${tweaks.glassBlur}px`;
    if (opSlider) opSlider.value = tweaks.glassOpacity;
    if (opVal) opVal.textContent = `${tweaks.glassOpacity}%`;
    document.querySelectorAll("#palette-swatches .swatch").forEach((s) => {
      s.setAttribute("aria-pressed", String(s.dataset.palette === tweaks.palette));
    });
    const st = document.getElementById("stack-toggle");
    if (st) st.setAttribute("aria-pressed", String(!!tweaks.showStack));
    const mt = document.getElementById("motion-toggle");
    if (mt) mt.setAttribute("aria-pressed", String(!!tweaks.animateMesh));
  }

  function persistTweaks(partial) {
    Object.assign(tweaks, partial);
    applyTweaks();
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: partial }, "*");
    } catch (e) {}
  }

  // Hook controls
  const blurSlider = document.getElementById("blur-slider");
  if (blurSlider) {
    blurSlider.addEventListener("input", (e) => persistTweaks({ glassBlur: +e.target.value }));
  }
  const opSlider = document.getElementById("opacity-slider");
  if (opSlider) {
    opSlider.addEventListener("input", (e) => persistTweaks({ glassOpacity: +e.target.value }));
  }
  document.querySelectorAll("#palette-swatches .swatch").forEach((s) => {
    s.addEventListener("click", () => persistTweaks({ palette: s.dataset.palette }));
  });
  const stackToggle = document.getElementById("stack-toggle");
  if (stackToggle) {
    const flip = () => persistTweaks({ showStack: !tweaks.showStack });
    stackToggle.addEventListener("click", flip);
    stackToggle.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }});
  }
  const motionToggle = document.getElementById("motion-toggle");
  if (motionToggle) {
    const flip = () => persistTweaks({ animateMesh: !tweaks.animateMesh });
    motionToggle.addEventListener("click", flip);
    motionToggle.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }});
  }

  applyTweaks();
  // Re-apply when viewport crosses mobile breakpoint (rotation, resize).
  if (mobileMq.addEventListener) {
    mobileMq.addEventListener("change", applyTweaks);
  } else if (mobileMq.addListener) {
    mobileMq.addListener(applyTweaks);
  }

  /* Edit-mode protocol */
  const tweaksToggleBtn = document.getElementById("tweaks-toggle");
  const tweaksPanel = document.getElementById("tweaks-panel");
  const tweaksClose = document.getElementById("tweaks-close");

  function setPanelOpen(open) {
    if (!tweaksPanel) return;
    tweaksPanel.classList.toggle("open", open);
    tweaksPanel.setAttribute("aria-hidden", String(!open));
  }

  if (tweaksToggleBtn) {
    tweaksToggleBtn.addEventListener("click", () => {
      setPanelOpen(!tweaksPanel.classList.contains("open"));
    });
  }
  if (tweaksClose) {
    tweaksClose.addEventListener("click", () => {
      setPanelOpen(false);
      // Also dismiss edit mode in host toolbar
      try {
        window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
      } catch (e) {}
      if (tweaksToggleBtn) tweaksToggleBtn.classList.remove("visible");
    });
  }

  // Register host listener first
  window.addEventListener("message", (e) => {
    const data = e.data || {};
    if (data.type === "__activate_edit_mode") {
      if (tweaksToggleBtn) tweaksToggleBtn.classList.add("visible");
      setPanelOpen(true);
    } else if (data.type === "__deactivate_edit_mode") {
      setPanelOpen(false);
      if (tweaksToggleBtn) tweaksToggleBtn.classList.remove("visible");
    }
  });

  // Announce availability
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}

})();
