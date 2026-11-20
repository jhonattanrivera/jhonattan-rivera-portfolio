---
name: verify
description: Verificación de punta a punta de jhonattanrivera.com en un Chromium real, en celular (390x844) y escritorio. Úsala antes de cada commit (contra la copia local) y después de cada deploy (contra el sitio publicado). Verificar es abrir el sitio y recorrerlo como un visitante, no solo ver que no haya errores de sintaxis.
---

# verify

El sitio es estático y no tiene paso de build: lo que está en `main` es lo que publica GitHub Pages en https://jhonattanrivera.com. Por eso "funciona" solo significa algo cuando se abre en un navegador y se recorre.

## Cómo correrla

```sh
npm install            # la primera vez (instala Playwright, fijado a una versión)
npx playwright install chromium   # solo si no hay Chromium de Playwright en la máquina
npm run verify         # copia local, servida como la sirve Pages
npm run verify:live    # https://jhonattanrivera.com
node scripts/verify.mjs --url=https://otra-url/   # cualquier otra copia publicada
```

Tarda unos 15 s. Sale con código 0 si todo pasa. Si algo falla, lista cada fallo y deja capturas en `.verify-tmp/` (ignorada por git). Borra esa carpeta cuando termines.

## Qué comprueba

En celular (390x844, táctil, español) y en escritorio (1440x900, inglés):

- La portada responde 200 y elige el idioma según el navegador.
- La intro termina y deja la página usable.
- Están las secciones `#top`, `#sobre`, `#ruta`, `#oficio`, `#contacto`, el título "Jhonattan Rivera" y el correo `hello@jhonattanrivera.com`.
- Cada enlace del menú (en celular, el menú desplegable) lleva a su sección y el menú se cierra. "Volver arriba" sube.
- El botón EN/ES cambia los textos y el idioma se recuerda al recargar.
- Todas las imágenes cargan al bajar por la página.
- Ningún error de consola, excepción JS, petición fallida ni respuesta 4xx/5xx (la analítica de Cloudflare se bloquea para no contar visitas falsas).
- Las anclas internas existen, los recursos propios (CSS, JS, imágenes, `robots.txt`, `sitemap.xml`) responden 200 y los enlaces externos usan https.

## Reglas

1. Corre `npm run verify` contra la copia local antes de cada commit, y `npm run verify:live` contra el sitio publicado después de cada deploy (espera a que termine el despliegue de Pages).
2. Si sigue fallando después de 3 rondas de arreglos, para y repórtalo a la persona con los fallos y las capturas. No sigas intentando.
3. Nunca debilites ni edites las comprobaciones de verify dentro del mismo cambio que verify está juzgando. Si una comprobación está mal, se corrige en un cambio aparte y se explica por qué.
4. Una comprobación inestable se arregla de raíz o se borra dejando escrita la razón en el script. Nunca se reintenta hasta que pase. Nada de esperas fijas ni reintentos: se espera por condiciones (selectores, estado de la página).
5. Cada fallo real que se escape (algo roto que verify no vio) se convierte en una comprobación nueva o en una regla en este archivo.

## Notas

- `scripts/verify.mjs` levanta su propio servidor estático (responde 404 a lo que no existe, como Pages). No hace falta `python3 -m http.server`.
- En vivo no se comprueba que una ruta inexistente dé 404: GitHub Pages a veces responde 503 y la prueba quedaba inestable.
- `package.json` y `node_modules/` solo existen para esta verificación; el sitio no los usa.
