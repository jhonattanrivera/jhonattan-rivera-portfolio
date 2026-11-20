/* Fig 1: an isometric card terminal that actually charges.
   Shaped like a countertop POS: a wedge body with the printer at the back, the
   screen and keypad on one sloped deck, red/yellow/green keys and the chip slot
   at the front. Type an amount, then drag the card over the screen (contactless)
   or into the slot (chip), or use the buttons, and watch the authorization go
   acquirer → network → issuer until it comes back approved.
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
  const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
  const n = (v) => +v.toFixed(3);
  // No origin offset: the viewBox is fitted to the drawing below, so a point and a
  // direction project the same way.
  const P = (x, y, z) => [(x - y) * C, (x + y) * S - z];
  const plane = (O, U, V) => {
    const o = P(...O), u = P(...U), v = P(...V);
    return `matrix(${n(u[0])} ${n(u[1])} ${n(v[0])} ${n(v[1])} ${n(o[0])} ${n(o[1])})`;
  };
  const neg = (v) => v.map((a) => -a);
  // A frame is an origin plus three axes. The keys live in the sloped frame of the deck.
  const frame = (o, ex, ey, ez) => ({ o, ex, ey, ez });
  const at = (F, u, v, w) => F.o.map((c, i) => c + u * F.ex[i] + v * F.ey[i] + w * F.ez[i]);
  const TOP = (F, u, v, w) => plane(at(F, u, v, w), F.ex, F.ey);
  const FRONT = (F, u, v, w) => plane(at(F, u, v, w), F.ex, neg(F.ez));
  const SIDE = (F, u, v, w) => plane(at(F, u, v, w), neg(F.ey), neg(F.ez));
  const rect = (t, w, h, r = 0, cls = "f") =>
    `<g transform="${t}"><rect class="${cls}" width="${w}" height="${h}" rx="${r}"/></g>`;
  const box = (F, x, y, z, w, d, h, r = 0) =>
    rect(SIDE(F, x + w, y + d, z + h), d, h, Math.min(r, h / 4)) +
    rect(FRONT(F, x, y + d, z + h), w, h, Math.min(r, h / 4)) +
    rect(TOP(F, x, y, z + h), w, d, r, "f t");
  const poly = (pts) => pts.map((p) => P(...p).map(n).join(",")).join(" ");

  /* ---------- Geometry (x right-down, y left-down, z up; the operator stands at +y) ---------- */
  const W = 196, L = 420;                        // footprint
  const YP = 110, ZP = 70;                       // printer: the back section and its top
  const ZD = 48, ZF = 22;                        // deck height where the printer ends and at the front edge
  const SLOPE = (ZD - ZF) / (L - YP);
  const WORLD = frame([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const DECK = frame([0, YP, ZD], [1, 0, 0], [0, 1, -SLOPE], [0, SLOPE, 1]);
  const DL = L - YP;                             // deck length
  const GX = 16, GY = 14, GW = 164, GH = 86;     // screen glass on the deck
  const KX = 20, KY = 128, KW = 46, KD = 27, KH = 5, KPX = 55, KPY = 35;   // keys
  const CW = 92, CL = 146, CT = 3;               // card, long side along y
  const SZ = 9;                                  // card height inside the chip slot
  const PX = 34, PY = 22, PW = W - 68, PH = 64;  // receipt

  const KEYS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["*", "0", "#"], ["cancel", "clear", "ok"]];
  const LETTERS = { 2: "ABC", 3: "DEF", 4: "GHI", 5: "JKL", 6: "MNO", 7: "PQRS", 8: "TUV", 9: "WXYZ" };
  const FN = { cancel: "red", clear: "amber", ok: "green" };

  // Where the card's corner sits on the way to each place (world coordinates).
  const SX = (W - CW) / 2;
  const hv = at(DECK, W / 2, GY + GH + 30, 0);  // deck point the card hovers over to tap
  // At rest the card lies on the table in front of the terminal, a little right of the slot.
  const RX = W - CW + 8, RY = L + 20;
  const WP = {
    rest: [RX, RY, 0],
    lift: [RX, RY, 40],
    hoverHi: [hv[0] - CW / 2, hv[1] - CL / 2, hv[2] + 64],
    hover: [hv[0] - CW / 2, hv[1] - CL / 2, hv[2] + 30],
    align: [SX, L + 4, SZ],
    inserted: [SX, L + 4 - 112, SZ]
  };
  const ROUTES = {
    tapIn: ["lift", "hoverHi", "hover"], tapOut: ["hoverHi", "lift", "rest"], dragTap: ["hoverHi", "hover"],
    chipAlign: ["align"], chipPush: ["inserted"], chipBack: ["align"], chipOut: ["rest"]
  };
  const offset = (k) => P(WP[k][0] - WP.rest[0], WP[k][1] - WP.rest[1], WP[k][2] - WP.rest[2]);
  const route = (name) => ROUTES[name].map(offset);

  /* ---------- Scene, back to front ---------- */
  let s = `<defs>
    <clipPath id="pos-clip-slot" clipPathUnits="userSpaceOnUse"><polygon points="${poly([[-3000, L, SZ + CT / 2], [3000, L, SZ + CT / 2], [3000, L + 6000, SZ + CT / 2], [-3000, L + 6000, SZ + CT / 2]])}"/></clipPath>
    <clipPath id="pos-clip-paper" clipPathUnits="userSpaceOnUse"><polygon points="${poly([[-3000, PY, ZP], [3000, PY, ZP], [3000, PY, ZP + 6000], [-3000, PY, ZP + 6000]])}"/></clipPath>
    <filter id="pos-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="pos-lift" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="16" stdDeviation="9" flood-color="#000" flood-opacity=".6"/></filter>
  </defs>`;

  // Shadow on the table, then the body: the right side in profile (a wedge with the
  // printer hump at the back), the front edge with the chip slot, the sloped deck.
  s += `<polygon class="shadow" filter="url(#pos-soft)" points="${poly([[2, 4, 0], [W + 8, 4, 0], [W + 8, L + 10, 0], [2, L + 10, 0]])}"/>`;
  s += `<g aria-hidden="true"><g transform="${plane([W, 0, 0], [0, 1, 0], [0, 0, -1])}"><path class="f" d="M0 0V${-(ZP - 14)}Q0 ${-ZP} 14 ${-ZP}H${YP - 8}Q${YP} ${-ZP} ${YP} ${-(ZP - 8)}V${-ZD}L${L - 5} ${-(ZF + 5 * SLOPE)}Q${L} ${-ZF} ${L} ${-(ZF - 5)}V-6Q${L} 0 ${L - 6} 0Z"/></g>`;
  s += `<g transform="${plane([W, 0, 0], [0, 1, 0], [0, 0, -1])}"><path class="d" d="M${YP + 18} ${-(ZD - 18 * SLOPE) + 9}L${L - 14} ${-(ZF + 14 * SLOPE) + 9}"/></g>`;
  s += rect(FRONT(WORLD, 0, L, ZF), W, ZF, 6) + `</g>`;
  s += `<g class="pos-slot" transform="${FRONT(WORLD, 0, L, ZF)}"><rect class="hit" x="22" y="0" width="${W - 44}" height="${ZF}"/><rect class="slot" x="${SX - 6}" y="${ZF - SZ - 5}" width="${CW + 12}" height="6" rx="3"/></g>`;

  s += `<g aria-hidden="true">${rect(TOP(DECK, 0, 0, 0), W, DL, 10, "f t")}`;
  // Bezel around the screen and soft keys, the recess the keypad sits in.
  s += rect(TOP(DECK, 8, 6, 0), W - 16, GY + GH + 26, 9, "bz");
  s += rect(TOP(DECK, 10, KY - 8, 0), W - 20, 5 * KPY + 6, 10, "d");
  s += `<g transform="${TOP(DECK, 0, 0, 0)}">${[0, 1, 2, 3].map((i) => `<rect class="sk" x="${26 + i * 38}" y="${GY + GH + 7}" width="28" height="8" rx="4"/>`).join("")}</g>`;

  const stepRow = (i) => {
    const y = 40 + i * 16;
    return `<g class="st" data-step="${i}"><circle class="st-dot" cx="12" cy="${y - 3.5}" r="2.6"/>` +
      `<text class="st-l" x="22" y="${y}" font-size="10">·</text>` +
      `<text class="st-v" x="156" y="${y}" font-size="10" text-anchor="end">···</text></g>`;
  };
  s += `<g transform="${TOP(DECK, GX, GY, 0)}">
    <rect class="glass" width="${GW}" height="${GH}" rx="5"/>
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
  </g></g>`;

  // Printer: the raised back section. Its front face carries the contactless mark and
  // the four reader lights; its top has the lid seam, the paper exit and the tear bar.
  s += `<g aria-hidden="true">${rect(FRONT(WORLD, 0, YP, ZP), W, ZP - ZD, 6)}`;
  s += `<g transform="${FRONT(WORLD, 0, YP, ZP)}">
    <g class="nfc">${[3.5, 7, 10.5].map((r) => `<path d="M${30 + r * 0.55} ${11 - r * 0.85}A${r} ${r} 0 0 1 ${30 + r * 0.55} ${11 + r * 0.85}"/>`).join("")}</g>
    ${[0, 1, 2, 3].map((i) => `<rect class="led" data-led="${i}" x="${68 + i * 18}" y="9.5" width="13" height="3.5" rx="1.75"/>`).join("")}
  </g>`;
  s += rect(TOP(WORLD, 0, 0, ZP), W, YP, 14, "f t");
  s += `<g transform="${TOP(WORLD, 0, 0, ZP)}">
    <rect class="slot" x="${PX - 5}" y="${PY - 3}" width="${PW + 10}" height="6" rx="3"/>
    <path class="d" d="M${PX - 2} ${PY + 9}${Array.from({ length: 16 }, (_, i) => `l${(PW + 4) / 16} ${i % 2 ? -2 : 2}`).join("")}"/>
    <path class="d" d="M12 ${YP - 34}H${W - 12}"/>
    <text class="mark" x="${W - 16}" y="${YP - 14}" font-size="9" text-anchor="end">JR</text>
  </g></g>`;

  // Receipt: hidden inside the printer until a sale is approved.
  s += `<g clip-path="url(#pos-clip-paper)" aria-hidden="true"><g class="paper" id="pos-paper"><g transform="${FRONT(WORLD, PX, PY, ZP + PH)}">
    <path class="paper-f" d="M0 ${PH}V4${Array.from({ length: 14 }, (_, i) => `l${PW / 28} ${i % 2 ? 3 : -3}l${PW / 28} ${i % 2 ? -3 : 3}`).join("")}V${PH}Z"/>
    <text class="paper-t" id="pos-r1" x="10" y="17" font-size="7.5">·</text>
    <text class="paper-t" id="pos-r2" x="10" y="29" font-size="7.5">·</text>
    <text class="paper-t" id="pos-r3" x="10" y="41" font-size="7.5">·</text>
    <path class="paper-d" d="M10 50H${PW - 10}"/>
    <text class="paper-t" x="10" y="60" font-size="7.5">•••• 2020</text>
  </g></g></g>`;

  // Keys on the sloped deck: rows front-ward, then left to right, so nearer keys
  // cover farther ones. Labels are drawn on each key top.
  const cx = KW / 2, cy = KD / 2;
  const LABEL = {
    cancel: `<path class="kg" d="M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}"/>`,
    clear: `<path class="kg" d="M${cx + 3} ${cy - 6}L${cx - 4} ${cy}L${cx + 3} ${cy + 6}"/>`,
    ok: `<circle class="kg" cx="${cx}" cy="${cy}" r="5.5"/>`
  };
  KEYS.forEach((row, r) => row.forEach((k, c) => {
    const x = KX + c * KPX, y = KY + r * KPY, fn = FN[k];
    const label = LABEL[k] || (LETTERS[k]
      ? `<text class="kl" x="${cx - 6}" y="${cy + 6}">${k}</text><text class="kt" x="${cx + 3}" y="${cy + 3.5}">${LETTERS[k]}</text>`
      : `<text class="kl" x="${cx}" y="${cy + 6}">${k}</text>`);
    // The hit area fills the key's whole cell (the key plus the gap in front and beside it),
    // so a tap between keys still counts, without covering any neighbour's visible faces.
    s += `<g class="k${fn ? ` fn ${fn}` : ""}" data-key="${k}" role="button">${box(DECK, x, y, 0, KW, KD, KH, 6)}` +
      `<g transform="${TOP(DECK, x, y, KH)}"><rect class="hit" x="${-(KPX - KW) / 2}" y="0" width="${KPX}" height="${KPY}"/>${label}</g></g>`;
  }));

  // Card, last: it is always the nearest thing to the viewer.
  const R = WP.rest;
  s += `<g id="pos-cardwrap" aria-hidden="true"><g class="pos-card" id="pos-card"><g class="pos-card-in">${box(WORLD, R[0], R[1], 0, CW, CL, CT, 7)}
    <g transform="${TOP(WORLD, R[0], R[1], CT)}"><rect class="hit" x="-6" y="-6" width="${CW + 12}" height="${CL + 12}" rx="9"/><g transform="matrix(0 1 -1 0 ${CW} 0)">
      <rect class="c-chip" x="18" y="30" width="24" height="19" rx="3.5"/>
      <path class="c-line" d="M18 39.5h24M30 30v19M26 34.5h8M26 44.5h8"/>
      <text class="c-t" x="18" y="70" font-size="10">•••• 2020</text>
      <text class="c-t" x="${CL - 14}" y="20" font-size="10" text-anchor="end">JR</text>
    </g></g>
  </g></g></g>`;

  // Fit the viewBox to the terminal, the printed receipt and every place the card goes.
  const pts = [];
  const span = (o, w, d, h) => { for (const a of [0, w]) for (const b of [0, d]) for (const c of [0, h]) pts.push(P(o[0] + a, o[1] + b, o[2] + c)); };
  span([0, 0, 0], W + 8, L + 10, ZP);
  span([PX, PY, ZP], PW, 0, PH);
  ["rest", "lift", "hoverHi", "align"].forEach((k) => span(WP[k], CW, CL, CT));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = 8;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  svg.setAttribute("viewBox", `${n(x0)} ${n(y0)} ${n(Math.max(...xs) + pad - x0)} ${n(Math.max(...ys) + pad - y0)}`);

  svg.innerHTML = s;
  section.hidden = false;

  /* ---------- Words ---------- */
  const WORDS = {
    es: {
      label: "Datáfono interactivo. Digita un monto con el teclado y arrastra la tarjeta sobre la pantalla o hacia la ranura.",
      sale: "VENTA", enter: "Digite el monto", present: "Acerque o inserte", need: "Primero el monto",
      cancelled: "Operación cancelada", readTap: "LEYENDO TARJETA", readChip: "LEYENDO CHIP",
      processing: "PROCESANDO", steps: ["Adquirente", "Red", "Emisor"], ok: "ok",
      approved: "Aprobada", code: "Cód. aut.", codeLong: "Código de autorización", remove: "RETIRE LA TARJETA",
      keys: { cancel: "Cancelar", clear: "Borrar", ok: "Aceptar", "*": "Asterisco", "#": "Numeral" },
      r: { ready: "lista", key: "tecla", clear: "borrar", cancel: "cancelada", need: "falta el monto",
        tap: "sin contacto", chip: "chip", reading: "leyendo", approved: "aprobada",
        drag: "llévala a la pantalla o a la ranura", dropTap: "suelta para pagar sin contacto", dropChip: "suelta para insertar" },
      receipt: ["VENTA", "APROBADA 00", "AUT"]
    },
    en: {
      label: "Interactive card terminal. Type an amount on the keypad, then drag the card over the screen or into the slot.",
      sale: "SALE", enter: "Enter amount", present: "Tap or insert card", need: "Amount first",
      cancelled: "Transaction cancelled", readTap: "READING CARD", readChip: "READING CHIP",
      processing: "PROCESSING", steps: ["Acquirer", "Network", "Issuer"], ok: "ok",
      approved: "Approved", code: "Auth code", codeLong: "Authorization code", remove: "REMOVE CARD",
      keys: { cancel: "Cancel", clear: "Clear", ok: "Enter", "*": "Star", "#": "Hash" },
      r: { ready: "ready", key: "key", clear: "clear", cancel: "cancelled", need: "amount needed",
        tap: "contactless", chip: "chip", reading: "reading", approved: "approved",
        drag: "take it to the screen or the slot", dropTap: "release to tap", dropChip: "release to insert" },
      receipt: ["SALE", "APPROVED 00", "AUTH"]
    }
  };
  const lang = () => (root.lang === "es" ? "es" : "en");
  const t = () => WORDS[lang()];
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
  let drag = null;         // the card while a finger or the mouse holds it

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
    if (drag && drag.moved) return drag.zone === "tap" ? r.dropTap : drag.zone === "chip" ? r.dropChip : r.drag;
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

  let inviteTimer = 0;
  function invite() {
    svg.classList.add("invite");
    clearTimeout(inviteTimer);
    inviteTimer = setTimeout(() => svg.classList.remove("invite"), 1600);
  }

  /* ---------- Card motion ---------- */
  // The card is moved as a screen-space offset from where it rests, so a drag and a
  // scripted flight share one position and a flight can start wherever the drag ended.
  let cardAt = "rest";
  let cardQ = Promise.resolve();
  let cardOff = [0, 0];
  let flying = 0;
  const tr = (o) => `translate(${n(o[0])}px, ${n(o[1])}px)`;
  const setCard = (o) => { cardOff = o; el.card.style.transform = tr(o); };

  function fly(stops, opts = {}) {
    return new Promise((done) => {
      if (opts.clip) el.wrap.setAttribute("clip-path", "url(#pos-clip-slot)");
      const all = [cardOff, ...stops];
      flying++;
      const end = () => {
        setCard(all[all.length - 1]);
        if (opts.clip && !opts.keep) el.wrap.removeAttribute("clip-path");
        flying--;
        done();
      };
      // Spend time in proportion to distance travelled on screen.
      const lens = all.slice(1).map((p, i) => Math.hypot(p[0] - all[i][0], p[1] - all[i][1]));
      const total = lens.reduce((a, b) => a + b, 0);
      if (still() || typeof el.card.animate !== "function" || total < 0.5) { end(); return; }
      let acc = 0;
      const frames = all.map((p, i) => {
        if (i) acc += lens[i - 1];
        return { transform: tr(p), offset: acc / total };
      });
      const a = el.card.animate(frames, {
        duration: Math.max(380, Math.min(1000, 220 + total * 1.1)),
        easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards"
      });
      a.onfinish = () => { end(); a.cancel(); };
    });
  }

  function moveCard(to, fromDrag = false) {
    if (to === cardAt && !fromDrag) return cardQ;
    const from = cardAt;
    cardAt = to;
    cardQ = cardQ.then(async () => {
      if (from === "tap") await fly(route("tapOut"));
      if (from === "chip") { await fly(route("chipBack"), { clip: true }); await fly(route("chipOut")); }
      svg.classList.toggle("lifted", to === "tap");
      if (to === "tap") await fly(route(fromDrag ? "dragTap" : "tapIn"));
      if (to === "chip") { await fly(route("chipAlign")); await fly(route("chipPush"), { clip: true, keep: true }); }
      if (to === "rest" && from === "rest") await fly([[0, 0]]);   // back home after a drag
    });
    return cardQ;
  }

  function shake() {
    if (still() || typeof el.card.animate !== "function" || cardAt !== "rest" || drag) return;
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
    if (k === "*" || k === "#") return;
    if (k === "ok") {
      // Green key: confirms the amount and points at where the card goes.
      if (st.phase === "ok") { reset(); render(); return; }
      if (!amount()) { flash("need"); render(); shake(); say(t().need); return; }
      invite();
      say(t().present);
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

  async function present(mode, fromDrag = false) {
    if (st.phase === "read" || st.phase === "proc") { if (fromDrag) moveCard("rest", true); return; }
    if (st.phase === "ok") reset();
    if (!amount()) {
      flash("need");
      render();
      say(t().need);
      if (fromDrag) moveCard("rest", true).then(shake);
      else shake();
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

    await moveCard(mode, fromDrag);
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

  /* ---------- Drag the card: over the screen to tap, into the slot to insert ---------- */
  const cardHit = svg.querySelector(".pos-card .hit");
  const toSvg = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const CARD_MID = P(RX + CW / 2, RY + CL / 2, CT);
  const CARD_LEAD = P(RX + CW / 2, RY, CT);   // middle of the chip end, which goes in first
  const TAP_AT = P(...at(DECK, GX + GW / 2, GY + GH / 2, 0));
  // Screen point back to the world, assuming it sits at height z.
  const onZ = (p, z) => { const a = p[0] / C, b = (p[1] + z) / S; return [(a + b) / 2, (b - a) / 2]; };
  const canDrag = () => cardAt === "rest" && !flying && st.phase !== "read" && st.phase !== "proc";

  function zoneFor(o) {
    // Chip: the chip end has been brought to the mouth of the slot (or a little past it).
    const [lx, ly] = onZ([CARD_LEAD[0] + o[0], CARD_LEAD[1] + o[1]], SZ + CT);
    if (Math.abs(lx - W / 2) < 52 && ly > L - 70 && ly < L + 12) return "chip";
    // Tap: the card is held over the screen.
    const mid = [CARD_MID[0] + o[0], CARD_MID[1] + o[1]];
    if (Math.hypot(mid[0] - TAP_AT[0], mid[1] - TAP_AT[1]) < 120) return "tap";
    return "";
  }

  let suppressClick = false;
  cardHit.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || !canDrag()) return;
    drag = { id: e.pointerId, from: toSvg(e), cx: e.clientX, cy: e.clientY, moved: false, zone: "" };
    try { cardHit.setPointerCapture(e.pointerId); } catch (_) { /* not supported: moves still arrive */ }
  });
  cardHit.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < 6) return;   // still a click
      drag.moved = true;
      if (st.phase === "ok") { reset(); render(); }
      svg.classList.add("dragging", "lifted");
    }
    const p = toSvg(e);
    const o = [p[0] - drag.from[0], p[1] - drag.from[1]];
    setCard(o);
    const zone = zoneFor(o);
    if (zone !== drag.zone) {
      drag.zone = zone;
      svg.dataset.zone = zone;
      render();
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    svg.classList.remove("dragging", "lifted");
    delete svg.dataset.zone;
    if (!d.moved) return;   // a plain click: the click handler takes it
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (!cancelled && d.zone) present(d.zone, true);
    else { moveCard("rest", true); render(); }
  }
  cardHit.addEventListener("pointerup", (e) => endDrag(e, false));
  cardHit.addEventListener("pointercancel", (e) => endDrag(e, true));
  // iOS Safari scrolls the page unless the touch is cancelled here, whatever touch-action says.
  svg.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });

  /* ---------- Input: pointer, touch and keyboard share the same functions ---------- */
  svg.addEventListener("click", (e) => {
    const key = e.target.closest(".k");
    if (key) { press(key.dataset.key); return; }
    if (e.target.closest(".pos-card")) {
      if (suppressClick) return;
      present("tap");
      return;
    }
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
