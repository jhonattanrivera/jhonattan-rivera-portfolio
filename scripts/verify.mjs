#!/usr/bin/env node
// Verificación de punta a punta de jhonattanrivera.com con Chromium headless.
// Uso:
//   npm run verify                 sirve la copia local (como GitHub Pages) y la prueba
//   npm run verify:live            prueba https://jhonattanrivera.com
//   node scripts/verify.mjs --url=https://otra-url/
// Capturas solo si algo falla, en .verify-tmp/ (ignorada por git).

import { createServer } from "node:http";
import { readFile, stat, mkdir, rm } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_URL = "https://jhonattanrivera.com/";
const SHOTS = join(ROOT, ".verify-tmp");
const SECTIONS = ["#top", "#sobre", "#ruta", "#oficio", "#contacto"];
const NAV = [
  { href: "#sobre", en: "About", es: "Sobre mí" },
  { href: "#ruta", en: "Journey", es: "Recorrido" },
  { href: "#oficio", en: "What I do", es: "Lo que hago" },
  { href: "#contacto", en: "Contact", es: "Contacto" },
];
// Analítica de terceros: se bloquea para no contar visitas falsas.
const BLOCKED = /cloudflareinsights\.com/;

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith("--url="));
const isLive = args.includes("--live") || !!urlArg;

const failures = [];
const fail = (msg) => failures.push(msg);

// ---------- Servidor local que imita GitHub Pages ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml", ".ico": "image/x-icon",
};
function serve() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT) || /\/(node_modules|\.git|\.verify-tmp)\//.test(file)) throw new Error("fuera");
      const info = await stat(file);
      if (!info.isFile()) throw new Error("no es archivo");
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ---------- Vigilancia de errores por página ----------
function watch(page, label, base) {
  const origin = new URL(base).origin;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Los recursos fallidos ya los reportan los vigilantes de red, con su URL.
    if (m.text().startsWith("Failed to load resource")) return;
    fail(`${label}: error de consola: ${m.text()}`);
  });
  page.on("pageerror", (e) => fail(`${label}: excepción JS: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (BLOCKED.test(r.url())) return;
    // Navegar a otra sección cancela descargas en curso; eso no es un fallo.
    if (r.failure()?.errorText === "net::ERR_ABORTED" && r.resourceType() !== "document" && !r.url().startsWith(origin)) return;
    fail(`${label}: falló la petición ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !BLOCKED.test(r.url())) fail(`${label}: HTTP ${r.status()} en ${r.url()}`);
  });
}

async function shot(page, name) {
  try {
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
  } catch { /* la captura es opcional */ }
}

const inView = (sel) =>
  `(() => { const id = ${JSON.stringify(sel)}; const el = id === "#top" ? document.querySelector("#top") : document.querySelector(id);
    if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.2; })()`;

// Baja por la página como un visitante, para que carguen las imágenes diferidas.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}

async function checkImages(page, label) {
  await scrollThrough(page);
  const ok = await page.waitForFunction(
    () => Array.from(document.images).every((i) => i.complete),
    null, { timeout: 15000 }
  ).then(() => true, () => false);
  const broken = await page.evaluate(() =>
    Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src)
  );
  if (!ok || broken.length) fail(`${label}: imágenes que no cargan: ${broken.join(", ") || "(timeout)"}`);
}

async function runViewport(browser, base, vp) {
  const context = await browser.newContext({
    viewport: vp.viewport, isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1, locale: vp.locale,
  });
  await context.route(BLOCKED, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const label = vp.name;
  watch(page, label, base);
  const before = failures.length;
  try {
    const res = await page.goto(base, { waitUntil: "load" });
    if (!res || res.status() !== 200) fail(`${label}: la portada respondió ${res?.status()}`);

    // Idioma elegido según el navegador.
    const lang = vp.locale.startsWith("es") ? "es" : "en";
    await page.waitForFunction((l) => document.documentElement.lang === l, lang, { timeout: 5000 })
      .catch(() => fail(`${label}: el idioma inicial no es ${lang}`));

    // La intro termina y deja la página usable.
    await page.waitForFunction(() => !document.querySelector(".loader") && !document.documentElement.classList.contains("intro"), null, { timeout: 10000 })
      .catch(() => fail(`${label}: la intro no terminó en 10 s`));

    for (const s of SECTIONS) if (!(await page.$(s))) fail(`${label}: falta la sección ${s}`);
    const h1 = (await page.textContent("h1"))?.replace(/\s+/g, "") || "";
    if (!h1.includes("JhonattanRivera")) fail(`${label}: el título principal no dice Jhonattan Rivera`);
    const mail = await page.getAttribute(".mail", "href");
    if (mail !== "mailto:hello@jhonattanrivera.com") fail(`${label}: el correo de contacto cambió (${mail})`);

    // Navegación: cada enlace lleva a su sección.
    for (const item of NAV) {
      if (vp.mobile) {
        await page.click(".menu-btn");
        await page.waitForSelector("#menu.open", { timeout: 3000 }).catch(() => fail(`${label}: el menú no abre`));
        const link = page.locator(`#menu nav a[href="${item.href}"]`);
        if ((await link.textContent())?.trim() !== item[lang]) fail(`${label}: el menú dice "${await link.textContent()}" y esperaba "${item[lang]}"`);
        await link.click();
        await page.waitForSelector("#menu:not(.open)", { timeout: 3000 }).catch(() => fail(`${label}: el menú no se cierra al elegir`));
      } else {
        const link = page.locator(`.nav-links a[href="${item.href}"]`);
        if ((await link.textContent())?.trim() !== item[lang]) fail(`${label}: el menú dice "${await link.textContent()}" y esperaba "${item[lang]}"`);
        await page.locator(".nav").hover();
        await link.click();
      }
      await page.waitForFunction(inView(item.href), null, { timeout: 8000 })
        .catch(() => fail(`${label}: el enlace ${item.href} no lleva a su sección`));
    }
    await page.locator('.to-top').click();
    await page.waitForFunction(() => scrollY < 50, null, { timeout: 8000 }).catch(() => fail(`${label}: "volver arriba" no sube`));

    // Cambio de idioma.
    const other = lang === "es" ? "en" : "es";
    if (vp.mobile) { await page.click(".menu-btn"); await page.waitForSelector("#menu.open"); await page.click(`#menu .lang button[data-lang="${other}"]`); await page.click(".menu-btn"); }
    else await page.click(`.nav .lang button[data-lang="${other}"]`);
    await page.waitForFunction((l) => document.documentElement.lang === l, other, { timeout: 3000 })
      .catch(() => fail(`${label}: el botón de idioma no cambia a ${other}`));
    const about = (await page.textContent(`.nav-links a[href="#sobre"]`))?.trim();
    if (about !== NAV[0][other]) fail(`${label}: tras cambiar a ${other} el menú dice "${about}"`);
    await page.reload({ waitUntil: "load" });
    if ((await page.evaluate(() => document.documentElement.lang)) !== other) fail(`${label}: el idioma elegido no se recuerda al recargar`);

    await checkImages(page, label);
  } catch (e) {
    fail(`${label}: ${e.message.split("\n")[0]}`);
  }
  if (failures.length > before) await shot(page, label);
  await context.close();
}

// Enlaces internos y archivos del sitio: anclas existentes y recursos con 200.
async function checkLinks(browser, base) {
  const context = await browser.newContext();
  await context.route(BLOCKED, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const { anchors, urls, external } = await page.evaluate(() => {
    const anchors = new Set(), urls = new Set(), external = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href");
      if (h.startsWith("#")) anchors.add(h);
      else if (/^(mailto|tel):/.test(h)) continue;
      else if (a.href.startsWith(location.origin)) urls.add(a.href.split("#")[0]);
      else external.add(a.href);
    }
    for (const el of document.querySelectorAll("link[href], img[src], script[src]")) {
      const u = el.href || el.src;
      if (u && u.startsWith(location.origin)) urls.add(u.split("#")[0]);
    }
    return { anchors: [...anchors], urls: [...urls], external: [...external] };
  });
  for (const h of anchors) if (h !== "#" && !(await page.$(h))) fail(`enlaces: el ancla ${h} no existe`);
  for (const p of ["robots.txt", "sitemap.xml", "assets/images/hero-jr.png"]) urls.push(new URL(p, base).href);
  const results = await Promise.all(urls.map(async (u) => [u, (await context.request.get(u)).status()]));
  for (const [u, s] of results) if (s !== 200) fail(`enlaces: ${u} responde ${s}`);
  for (const u of external) if (!/^https:\/\//.test(u)) fail(`enlaces: enlace externo sin https: ${u}`);
  // Solo en local: confirma que el servidor de prueba no responde 200 a todo.
  // En vivo no se comprueba: GitHub Pages a veces responde 503 a rutas inexistentes,
  // y eso volvía la prueba inestable sin decir nada del sitio.
  if (!isLive) {
    const missing = (await context.request.get(new URL("no-existe-verify", base).href)).status();
    if (missing !== 404) fail(`enlaces: una ruta inexistente responde ${missing} y no 404`);
  }
  await context.close();
  return urls.length + anchors.length;
}

// ---------- Datáfono (Fig 1): digitar un monto, acercar la tarjeta y ver la aprobación ----------
// Dos ventas por tamaño, una en cada idioma: la primera en el idioma del navegador y la
// segunda después de cambiarlo con el botón EN/ES. En celular se toca con el dedo; en
// escritorio la primera venta va con el ratón y la segunda solo con el teclado.
const POS = {
  es: { approved: "Aprobada", amount: "$59.900" },
  en: { approved: "Approved", amount: "$59,900" },
};

async function posSale(page, label, lang, input, card) {
  const svg = page.locator("#pos-svg");
  await svg.scrollIntoViewIfNeeded();
  // Digita 5 9 9 0 0 7 y borra el 7 con la tecla de borrar: queda 59.900.
  if (input === "keyboard") {
    await svg.focus();
    await page.keyboard.type("599007");
    await page.keyboard.press("Backspace");
  } else {
    for (const k of ["5", "9", "9", "0", "0", "7", "clear"]) {
      const key = page.locator(`#pos-svg [data-key="${k}"] .hit`);
      if (input === "touch") await key.tap();
      else await key.click();
    }
  }
  const amount = (await page.textContent("#pos-amount"))?.trim();
  if (amount !== POS[lang].amount) fail(`${label}: el datáfono muestra ${amount} y esperaba ${POS[lang].amount} (${lang})`);

  // Acerca la tarjeta: con el botón, tocando la tarjeta dibujada o con Enter.
  if (card === "enter") await page.keyboard.press("Enter");
  else {
    const target = page.locator(card === "button" ? '.pos-acts [data-card="tap"]' : "#pos-svg .pos-card .hit");
    if (input === "touch") await target.tap();
    else await target.click();
  }
  const approved = await page.waitForFunction((word) => {
    const s = document.getElementById("pos-status");
    return document.getElementById("pos-svg").dataset.phase === "ok" && s.textContent === word && s.getBoundingClientRect().width > 0;
  }, POS[lang].approved, { timeout: 10000 }).then(() => true, () => false);
  if (!approved) {
    fail(`${label}: el datáfono no llegó a "${POS[lang].approved}" (${lang}); pantalla: ${await page.textContent("#pos-readout")}`);
    return;
  }
  const code = (await page.textContent("#pos-code"))?.trim() || "";
  if (!/^[A-Z0-9]{6}$/.test(code)) fail(`${label}: el código de autorización "${code}" no tiene 6 caracteres`);
  const paid = (await page.textContent("#pos-okamt"))?.trim();
  if (paid !== POS[lang].amount) fail(`${label}: la venta aprobada dice ${paid} y esperaba ${POS[lang].amount}`);
}

async function checkPos(browser, base, vp) {
  const context = await browser.newContext({
    viewport: vp.viewport, isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1, locale: vp.locale,
  });
  await context.route(BLOCKED, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const label = `${vp.name} datáfono`;
  watch(page, label, base);
  const before = failures.length;
  try {
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => !document.querySelector(".loader") && !document.documentElement.classList.contains("intro"), null, { timeout: 10000 });
    const first = vp.locale.startsWith("es") ? "es" : "en";
    const other = first === "es" ? "en" : "es";

    await posSale(page, label, first, vp.mobile ? "touch" : "mouse", vp.mobile ? "button" : "card");
    if (vp.mobile) {
      const box = await page.locator(".pos-fig").boundingBox();
      if (!box || box.x < 0 || box.x + box.width > vp.viewport.width) fail(`${label}: el datáfono no cabe en ${vp.viewport.width} px`);
    }

    // Cambia el idioma desde arriba, como un visitante, y la pantalla aprobada lo sigue.
    await page.locator(".to-top").click();
    await page.waitForFunction(() => scrollY < 50, null, { timeout: 8000 });
    if (vp.mobile) {
      await page.click(".menu-btn");
      await page.waitForSelector("#menu.open");
      await page.click(`#menu .lang button[data-lang="${other}"]`);
      await page.click(".menu-btn");
      await page.waitForSelector("#menu:not(.open)");
    } else await page.click(`.nav .lang button[data-lang="${other}"]`);
    await page.waitForFunction((l) => document.documentElement.lang === l, other, { timeout: 3000 });
    const shown = await page.textContent("#pos-status");
    if (shown !== POS[other].approved) fail(`${label}: tras cambiar a ${other} la pantalla dice "${shown}"`);

    await posSale(page, label, other, vp.mobile ? "touch" : "keyboard", vp.mobile ? "card" : "enter");
  } catch (e) {
    fail(`${label}: ${e.message.split("\n")[0]}`);
  }
  if (failures.length > before) await shot(page, `${vp.name}-datafono`);
  await context.close();
}

async function main() {
  const t0 = Date.now();
  await rm(SHOTS, { recursive: true, force: true });
  let server = null;
  let base = urlArg ? urlArg.slice(6) : LIVE_URL;
  if (!isLive) {
    server = await serve();
    base = `http://127.0.0.1:${server.address().port}/`;
  }
  console.log(`verify: ${base}`);
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error("No se pudo abrir Chromium. Instálalo con: npx playwright install chromium");
    throw e;
  }
  try {
    const counted = await checkLinks(browser, base);
    await Promise.all([
      runViewport(browser, base, { name: "movil-390", viewport: { width: 390, height: 844 }, mobile: true, locale: "es-CO" }),
      runViewport(browser, base, { name: "escritorio-1440", viewport: { width: 1440, height: 900 }, mobile: false, locale: "en-US" }),
      checkPos(browser, base, { name: "movil-390", viewport: { width: 390, height: 844 }, mobile: true, locale: "es-CO" }),
      checkPos(browser, base, { name: "escritorio-1440", viewport: { width: 1440, height: 900 }, mobile: false, locale: "en-US" }),
    ]);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (failures.length) {
      console.error(`\nverify FALLÓ (${failures.length}) en ${secs} s:`);
      for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
      console.error(`Capturas en ${SHOTS}`);
      process.exitCode = 1;
    } else {
      console.log(`verify OK en ${secs} s: 2 tamaños, ${NAV.length} enlaces de menú, ${counted} enlaces y recursos internos.`);
    }
  } finally {
    await browser.close();
    if (server) { server.closeAllConnections(); server.close(); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
