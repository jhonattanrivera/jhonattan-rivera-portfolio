/* Fig 1: an isometric card terminal that actually charges.
   Type an amount, tap or insert the card, and watch the authorization
   go acquirer → network → issuer until it comes back approved.
   Plain SVG built by a small projection kernel; no libraries. */

(function () {
  "use strict";

  const svg = document.getElementById("pos-svg");
  if (!svg) return;
  const section = svg.closest(".pos");
  const readout = document.getElementById("pos-readout");
  const live = document.getElementById("pos-live");
  const root = document.documentElement;
  const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Iso kernel ---------- */
  const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6), OX = 418, OY = 222;
  const n = (v) => +v.toFixed(3);
  const P = (x, y, z) => [(x - y) * C + OX, (x + y) * S - z + OY];
  const D = (x, y, z) => [(x - y) * C, (x + y) * S - z];
  const plane = (O, U, V) => {
    const o = P(...O), u = D(...U), v = D(...V);
    return `matrix(${n(u[0])} ${n(u[1])} ${n(v[0])} ${n(v[1])} ${n(o[0])} ${n(o[1])})`;
  };
  const TOP = (x, y, z) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
  const FRONT = (x, y, z) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
  const SIDE = (x, y, z) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);
  const rect = (t, w, h, r = 0, cls = "f") =>
    `<g transform="${t}"><rect class="${cls}" width="${w}" height="${h}" rx="${r}"/></g>`;
  const box = (x, y, z, w, d, h, r = 0) =>
    rect(SIDE(x + w, y + d, z + h), d, h, Math.min(r, h / 4)) +
    rect(FRONT(x, y + d, z + h), w, h, Math.min(r, h / 4)) +
    rect(TOP(x, y, z + h), w, d, r, "f t");
  const poly = (pts) => pts.map((p) => P(...p).map(n).join(",")).join(" ");

  /* ---------- Geometry (x right-down, y left-down, z up) ---------- */
  const W = 192, DP = 330, H = 26;                     // body
  const RD = 96, RH = 124, TZ = H + RH;                 // screen housing at the back
  const PITCH = 52, KW = 44, KD = 40, KH = 7;           // keys
  const KX = (W - (2 * PITCH + KW)) / 2, KY = RD + 20;
  const CW = 92, CL = 146, CT = 3;                      // card, long side along y
  const CX = (W - CW) / 2, CY = DP + 18;                // card at rest, pointing at the slot
  const CZ = 11;                                        // card height inside the chip slot
  const PX = 38, PY = 14, PW = 116, PH = 64;            // receipt
  const GX = 14, GY = 24, GW = 164, GH = 86;            // screen glass on the housing front

  const KEYS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["cancel", "0", "clear"]];
  // Card flight paths, as offsets from its resting place.
  const PATHS = {
    tap: [[0, 0, 0], [0, 0, 48], [0, -242, 196], [0, -373, 196], [0, -373, 160]],
    chip: [[0, 0, 0], [0, -18, CZ], [0, -110, CZ]]
  };

  /* ---------- Scene, back to front ---------- */
  let s = `<defs>
    <clipPath id="pos-clip-slot" clipPathUnits="userSpaceOnUse"><polygon points="${poly([[-3000, DP, CZ + CT / 2], [3000, DP, CZ + CT / 2], [3000, DP + 6000, CZ + CT / 2], [-3000, DP + 6000, CZ + CT / 2]])}"/></clipPath>
    <clipPath id="pos-clip-paper" clipPathUnits="userSpaceOnUse"><polygon points="${poly([[-3000, PY, TZ], [3000, PY, TZ], [3000, PY, TZ + 6000], [-3000, PY, TZ + 6000]])}"/></clipPath>
  </defs>`;

  // Body, with the keypad recess on its deck and the chip slot on its front.
  s += `<g aria-hidden="true">` + box(0, 0, 0, W, DP, H, 12);
  s += `<g transform="${TOP(0, 0, H)}"><rect class="d" x="12" y="${RD + 10}" width="${W - 24}" height="${DP - RD - 18}" rx="12"/></g>`;
  s += `<g transform="${SIDE(W, DP, H)}"><path class="d" d="M14 ${H / 2}H${DP - 14}"/></g></g>`;
  s += `<g class="pos-slot" transform="${FRONT(0, DP, H)}"><rect class="hit" x="26" y="0" width="${W - 52}" height="${H}"/><rect class="slot" x="44" y="10" width="104" height="7" rx="3.5"/></g>`;

  // Screen housing: vents on the side, LEDs and glass on the front, printer and reader on top.
  s += `<g aria-hidden="true">` + box(0, 0, H, W, RD, RH, 10);
  s += `<g transform="${SIDE(W, RD, TZ)}">${Array.from({ length: 9 }, (_, i) => `<path class="d" d="M${20 + i * 7} 26v40"/>`).join("")}</g>`;
  s += `<g transform="${TOP(0, 0, TZ)}">
    <rect class="slot" x="${PX - 5}" y="${PY - 3}" width="${PW + 10}" height="6" rx="3"/>
    <path class="d" d="M10 32H${W - 10}"/>
    ${[8, 15, 22].map((r) => `<circle class="cl" cx="${W / 2}" cy="64" r="${r}"/>`).join("")}
  </g></g>`;

  const stepRow = (i) => {
    const y = 40 + i * 16;
    return `<g class="st" data-step="${i}"><circle class="st-dot" cx="12" cy="${y - 3.5}" r="2.6"/>` +
      `<text class="st-l" x="22" y="${y}" font-size="10">·</text>` +
      `<text class="st-v" x="156" y="${y}" font-size="10" text-anchor="end">···</text></g>`;
  };
  s += `<g transform="${FRONT(0, RD, TZ)}">
    ${[0, 1, 2, 3].map((i) => `<rect class="led" data-led="${i}" x="${55 + i * 22}" y="11" width="16" height="3" rx="1.5"/>`).join("")}
    <rect class="glass" x="${GX}" y="${GY}" width="${GW}" height="${GH}" rx="6"/>
    <text class="mark" x="${W - 14}" y="${RH - 5}" font-size="7" text-anchor="end" aria-hidden="true">JR</text>
    <g transform="translate(${GX} ${GY})">
      <g data-scr="entry">
        <text class="s-dim cap" id="pos-head" x="8" y="15" font-size="8.5">·</text>
        <text class="s-dim cap" x="156" y="15" font-size="8.5" text-anchor="end">COP</text>
        <path class="d" d="M8 21H156"/>
        <text class="s-live" id="pos-amount" x="156" y="55" font-size="28" text-anchor="end">$0</text>
        <text class="s-mid" id="pos-prompt" x="8" y="76" font-size="10.5">·</text>
      </g>
      <g data-scr="proc">
        <text class="s-dim cap" id="pos-ptitle" x="8" y="15" font-size="8.5">·</text>
        <text class="s-mid" id="pos-pamt" x="156" y="15" font-size="8.5" text-anchor="end">·</text>
        <path class="d" d="M8 21H156"/>
        <path class="st-rail" d="M12 36.5V68.5"/>
        ${[0, 1, 2].map(stepRow).join("")}
      </g>
      <g data-scr="ok">
        <text class="s-dim cap" id="pos-okhead" x="8" y="15" font-size="8.5">·</text>
        <text class="s-mid" id="pos-okamt" x="156" y="15" font-size="8.5" text-anchor="end">·</text>
        <path class="d" d="M8 21H156"/>
        <circle class="ok-ring" cx="17" cy="45" r="9"/>
        <path class="ok-tick" d="M12.6 45.4l3 3 5.8-6.4"/>
        <text class="s-ok" id="pos-status" x="34" y="52.5" font-size="22"></text>
        <text class="s-mid" x="8" y="76" font-size="10.5"><tspan id="pos-codel">·</tspan> <tspan class="s-live" id="pos-code"></tspan></text>
      </g>
    </g>
  </g>`;

  // Receipt: hidden inside the printer until a sale is approved.
  s += `<g clip-path="url(#pos-clip-paper)" aria-hidden="true"><g class="paper" id="pos-paper"><g transform="${FRONT(PX, PY, TZ + PH)}">
    <path class="paper-f" d="M0 ${PH}V4${Array.from({ length: 14 }, (_, i) => `l${PW / 28} ${i % 2 ? 3 : -3}l${PW / 28} ${i % 2 ? -3 : 3}`).join("")}V${PH}Z"/>
    <text class="paper-t" id="pos-r1" x="10" y="17" font-size="7.5">·</text>
    <text class="paper-t" id="pos-r2" x="10" y="29" font-size="7.5">·</text>
    <text class="paper-t" id="pos-r3" x="10" y="41" font-size="7.5">·</text>
    <path class="paper-d" d="M10 50H${PW - 10}"/>
    <text class="paper-t" x="10" y="60" font-size="7.5">•••• 2020</text>
  </g></g></g>`;

  // Keys: rows front-ward, then left to right, so nearer keys cover farther ones.
  // A screen-space path drawn on a key top: maps screen offsets from the key centre
  // back to the plane, so the glyph reads upright (× and ←) instead of skewed.
  const onTop = (pts) => pts.map(([sx, sy], i) => {
    const a = (sx / C + sy / S) / 2, b = (sy / S - sx / C) / 2;
    return (i ? "L" : "M") + n(KW / 2 + a) + " " + n(KD / 2 + b);
  }).join("");
  const GLYPH = {
    cancel: onTop([[-6, -6], [6, 6]]) + onTop([[6, -6], [-6, 6]]),
    clear: onTop([[7, 0], [-7, 0]]) + onTop([[-2.5, -4.5], [-7, 0], [-2.5, 4.5]])
  };
  KEYS.forEach((row, r) => row.forEach((k, c) => {
    const x = KX + c * PITCH, y = KY + r * PITCH, fn = k in GLYPH;
    const label = fn ? `<path class="kg" d="${GLYPH[k]}"/>` : `<text class="kl" x="${KW / 2}" y="${KD / 2 + 6.5}">${k}</text>`;
    // The hit area fills the key's whole cell (the key plus the gap in front and beside it),
    // so a tap between keys still counts, without covering any neighbour's visible faces.
    s += `<g class="k${fn ? " fn" : ""}" data-key="${k}" role="button">${box(x, y, H, KW, KD, KH, 6)}` +
      `<g transform="${TOP(x, y, H + KH)}"><rect class="hit" x="${-(PITCH - KW) / 2}" y="0" width="${PITCH}" height="${PITCH}"/>${label}</g></g>`;
  }));

  // Card, last: it is always the nearest thing to the viewer.
  s += `<g id="pos-cardwrap" aria-hidden="true"><g class="pos-card" id="pos-card">${box(CX, CY, 0, CW, CL, CT, 7)}
    <g transform="${TOP(CX, CY, CT)}"><rect class="hit" x="-4" y="-4" width="${CW + 8}" height="${CL + 8}" rx="9"/><g transform="matrix(0 1 -1 0 ${CW} 0)">
      <rect class="c-chip" x="18" y="30" width="24" height="19" rx="3.5"/>
      <path class="c-line" d="M18 39.5h24M30 30v19M26 34.5h8M26 44.5h8"/>
      <text class="c-t" x="18" y="70" font-size="10">•••• 2020</text>
      <text class="c-t" x="${CL - 14}" y="20" font-size="10" text-anchor="end">JR</text>
    </g></g>
  </g></g>`;

  svg.innerHTML = s;
  section.hidden = false;

  /* ---------- Words ---------- */
  const T = {
    es: {
      label: "Datáfono interactivo. Digita un monto con el teclado y luego acerca o inserta la tarjeta.",
      sale: "VENTA", enter: "Digite el monto", present: "Acerque o inserte", need: "Primero el monto",
      cancelled: "Operación cancelada", readTap: "LEYENDO TARJETA", readChip: "LEYENDO CHIP",
      processing: "PROCESANDO", steps: ["Adquirente", "Red", "Emisor"], ok: "ok",
      approved: "Aprobada", code: "Cód. aut.", codeLong: "Código de autorización", remove: "RETIRE LA TARJETA",
      keys: { cancel: "Cancelar", clear: "Borrar" },
      r: { ready: "lista", key: "tecla", clear: "borrar", cancel: "cancelada", need: "falta el monto",
        tap: "sin contacto", chip: "chip", reading: "leyendo", approved: "aprobada" },
      receipt: ["VENTA", "APROBADA 00", "AUT"]
    },
    en: {
      label: "Interactive card terminal. Type an amount on the keypad, then tap or insert the card.",
      sale: "SALE", enter: "Enter amount", present: "Tap or insert card", need: "Amount first",
      cancelled: "Transaction cancelled", readTap: "READING CARD", readChip: "READING CHIP",
      processing: "PROCESSING", steps: ["Acquirer", "Network", "Issuer"], ok: "ok",
      approved: "Approved", code: "Auth code", codeLong: "Authorization code", remove: "REMOVE CARD",
      keys: { cancel: "Cancel", clear: "Clear" },
      r: { ready: "ready", key: "key", clear: "clear", cancel: "cancelled", need: "amount needed",
        tap: "contactless", chip: "chip", reading: "reading", approved: "approved" },
      receipt: ["SALE", "APPROVED 00", "AUTH"]
    }
  };
  const lang = () => (root.lang === "es" ? "es" : "en");
  const t = () => T[lang()];
  const money = (v) => "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === "es" ? "." : ",");

  /* ---------- State ---------- */
  const MAX_DIGITS = 7;
  const st = {
    phase: "entry",        // entry · read · proc · ok
    digits: "",
    mode: "tap",           // tap · chip
    step: -1,              // 0 acquirer · 1 network · 2 issuer · 3 all answered
    leds: 0,
    code: "",
    note: null,            // cancel · need
    last: null,            // what the readout reports for the last key
    remove: false,
    printed: false,
    run: 0                 // bumps on every reset, so stale async steps stop
  };
  const amount = () => parseInt(st.digits || "0", 10);

  const $ = (id) => document.getElementById(id);
  const el = {
    head: $("pos-head"), amount: $("pos-amount"), prompt: $("pos-prompt"),
    ptitle: $("pos-ptitle"), pamt: $("pos-pamt"), okhead: $("pos-okhead"), okamt: $("pos-okamt"),
    status: $("pos-status"), codel: $("pos-codel"), code: $("pos-code"),
    paper: $("pos-paper"), r1: $("pos-r1"), r2: $("pos-r2"), r3: $("pos-r3"),
    card: $("pos-card"), wrap: $("pos-cardwrap")
  };
  const keyEls = new Map(Array.from(svg.querySelectorAll(".k")).map((k) => [k.dataset.key, k]));
  const leds = Array.from(svg.querySelectorAll(".led"));
  const steps = Array.from(svg.querySelectorAll(".st"));

  /* ---------- View ---------- */
  function render() {
    const w = t(), v = amount(), m = money(v);
    svg.dataset.phase = st.phase;
    svg.classList.toggle("ready", st.phase === "entry" && v > 0);

    el.head.textContent = w.sale;
    el.amount.textContent = m;
    el.amount.setAttribute("font-size", String(Math.min(28, +(146 / (m.length * 0.6)).toFixed(1))));
    el.prompt.textContent = st.note === "cancel" ? w.cancelled : st.note === "need" ? w.need : v > 0 ? w.present : w.enter;
    el.prompt.classList.toggle("note", !!st.note);

    el.ptitle.textContent = st.phase === "read" ? (st.mode === "chip" ? w.readChip : w.readTap) : w.processing;
    el.pamt.textContent = m;
    steps.forEach((row, i) => {
      row.classList.toggle("done", st.phase === "proc" && st.step > i);
      row.classList.toggle("cur", st.phase === "proc" && st.step === i);
      row.querySelector(".st-l").textContent = w.steps[i];
      row.querySelector(".st-v").textContent = st.phase === "proc" && st.step > i ? (i === 2 ? "00" : w.ok) : "···";
    });

    el.okhead.textContent = st.remove ? w.remove : w.sale;
    el.okhead.classList.toggle("note", st.remove);
    el.okamt.textContent = m;
    el.status.textContent = st.phase === "ok" ? w.approved : "";
    el.codel.textContent = w.code;
    el.code.textContent = st.phase === "ok" ? st.code : "";

    el.r1.textContent = `${w.receipt[0]}  ${m}`;
    el.r2.textContent = w.receipt[1];
    el.r3.textContent = `${w.receipt[2]} ${st.code}`;

    const lit = st.phase === "entry" ? (v > 0 ? 1 : 0) : st.leds;
    leds.forEach((l, i) => l.classList.toggle("on", i < lit));

    readout.textContent = readoutText(w, m);
  }

  function readoutText(w, m) {
    const r = w.r;
    if (st.phase === "ok") return `${r.approved} · 00 · ${st.code}`;
    if (st.phase === "read") return `${r[st.mode]} · ${r.reading}`;
    if (st.phase === "proc") return `${r[st.mode]} · ${w.steps[Math.min(st.step, 2)].toLowerCase()}`;
    if (st.note === "need") return r.need;
    if (st.note === "cancel") return `${r.cancel} · ${m}`;
    if (st.last === "clear") return `${r.clear} · ${m}`;
    if (st.last) return `${r.key} ${st.last} · ${m}`;
    return `${r.ready} · ${m}`;
  }

  function relabel() {
    const w = t();
    svg.setAttribute("aria-label", w.label);
    keyEls.forEach((k, key) => k.setAttribute("aria-label", w.keys[key] || key));
  }

  let sayTimer = 0;
  function say(msg) {
    clearTimeout(sayTimer);
    // Clear first so the same message twice in a row is still announced.
    live.textContent = "";
    sayTimer = setTimeout(() => { live.textContent = msg; }, 60);
  }

  let noteTimer = 0;
  function flash(kind) {
    st.note = kind;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { st.note = null; render(); }, 1800);
  }

  /* ---------- Card motion ---------- */
  let cardAt = "rest";
  let cardQ = Promise.resolve();
  const shift = (p) => { const d = D(...p); return `translate(${n(d[0])}px, ${n(d[1])}px)`; };

  function fly(pts, chip, home) {
    return new Promise((done) => {
      if (chip) el.wrap.setAttribute("clip-path", "url(#pos-clip-slot)");
      const frames = pts.map((p) => ({ transform: shift(p) }));
      const end = () => {
        el.card.style.transform = frames[frames.length - 1].transform;
        if (chip && home) el.wrap.removeAttribute("clip-path");
        done();
      };
      if (still() || typeof el.card.animate !== "function") { end(); return; }
      // Spend time in proportion to distance travelled on screen.
      const lens = pts.slice(1).map((p, i) => Math.hypot(...D(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2])));
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      const keyed = frames.map((f, i) => {
        if (i) acc += lens[i - 1];
        return { transform: f.transform, offset: acc / total };
      });
      const a = el.card.animate(keyed, {
        duration: Math.max(520, Math.min(1000, 240 + total * 1.1)),
        easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards"
      });
      a.onfinish = () => { end(); a.cancel(); };
    });
  }

  function moveCard(to) {
    if (to === cardAt) return cardQ;
    const from = cardAt;
    cardAt = to;
    cardQ = cardQ.then(async () => {
      if (from !== "rest") await fly(PATHS[from].slice().reverse(), from === "chip", true);
      if (to !== "rest") await fly(PATHS[to], to === "chip", false);
    });
    return cardQ;
  }

  function shake() {
    if (still() || typeof el.card.animate !== "function" || cardAt !== "rest") return;
    el.card.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }],
      { duration: 340, easing: "ease-out", composite: "add" }
    );
  }

  /* ---------- Receipt ---------- */
  function print() {
    st.printed = true;
    el.paper.classList.remove("snap", "torn");
    el.paper.classList.add("out");
  }
  function tear() {
    if (!st.printed) return;
    st.printed = false;
    el.paper.classList.add("torn");
    setTimeout(() => {
      if (st.printed) return;
      el.paper.classList.add("snap");
      el.paper.classList.remove("out", "torn");
    }, still() ? 0 : 380);
  }

  /* ---------- Flow ---------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const AUTH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const authCode = () => Array.from({ length: 6 }, () => AUTH[Math.floor(Math.random() * AUTH.length)]).join("");

  function reset() {
    st.run++;
    st.phase = "entry";
    st.digits = "";
    st.step = -1;
    st.leds = 0;
    st.remove = false;
    st.last = null;
    tear();
    moveCard("rest");
  }

  function press(k) {
    const key = keyEls.get(k);
    if (key) {
      key.classList.add("down");
      clearTimeout(key._up);
      key._up = setTimeout(() => key.classList.remove("down"), 110);
    }
    if (st.phase === "read" || st.phase === "proc") {
      if (k !== "cancel") return;
      reset();
      flash("cancel");
      render();
      say(t().cancelled);
      return;
    }
    if (st.phase === "ok") reset();
    if (k === "cancel") {
      const had = st.digits;
      st.digits = "";
      if (had) { flash("cancel"); say(t().cancelled); }
    } else if (k === "clear") {
      st.digits = st.digits.slice(0, -1);
    } else if (st.digits.length < MAX_DIGITS && !(st.digits === "" && k === "0")) {
      st.digits += k;
    }
    if (k !== "cancel") { st.note = null; clearTimeout(noteTimer); }
    st.last = k === "cancel" ? null : k;
    render();
    if (k !== "cancel") say(money(amount()));
  }

  async function present(mode) {
    if (st.phase === "read" || st.phase === "proc") return;
    if (st.phase === "ok") reset();
    if (!amount()) {
      flash("need");
      render();
      shake();
      say(t().need);
      return;
    }
    const run = ++st.run;
    const alive = () => run === st.run;
    st.phase = "read";
    st.mode = mode;
    st.step = -1;
    st.leds = 0;
    st.note = null;
    render();

    await moveCard(mode);
    if (!alive()) return;
    if (mode === "tap") {
      for (let i = 1; i <= 4; i++) {
        st.leds = i;
        render();
        await wait(100);
        if (!alive()) return;
      }
      moveCard("rest");
    } else {
      await wait(420);
      if (!alive()) return;
    }

    st.phase = "proc";
    st.leds = 0;
    const hops = [420, 380, 480];
    for (let i = 0; i < hops.length; i++) {
      st.step = i;
      render();
      await wait(hops[i]);
      if (!alive()) return;
    }
    st.step = 3;
    render();
    await wait(320);
    if (!alive()) return;

    st.phase = "ok";
    st.code = authCode();
    render();
    print();
    say(`${t().approved}. ${t().codeLong} ${st.code.split("").join(" ")}.`);

    if (mode === "chip") {
      await wait(1300);
      if (!alive()) return;
      st.remove = true;
      render();
      await moveCard("rest");
      if (!alive()) return;
      st.remove = false;
      render();
    }
  }

  /* ---------- Input: pointer, touch and keyboard share the same functions ---------- */
  svg.addEventListener("click", (e) => {
    const key = e.target.closest(".k");
    if (key) { press(key.dataset.key); return; }
    if (e.target.closest(".pos-card")) { present("tap"); return; }
    if (e.target.closest(".pos-slot")) present("chip");
  });

  svg.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === "Backspace") k = "clear";
    else if (e.key === "Escape" || e.key === "Delete") k = "cancel";
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) present("tap");
      return;
    }
    if (!k) return;
    e.preventDefault();
    press(k);
  });

  section.querySelectorAll("[data-card]").forEach((b) => b.addEventListener("click", () => present(b.dataset.card)));

  // The site's EN/ES toggle sets <html lang>; follow it.
  new MutationObserver(() => { relabel(); render(); })
    .observe(root, { attributes: true, attributeFilter: ["lang"] });

  relabel();
  render();
})();
