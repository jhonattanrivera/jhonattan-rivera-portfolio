# jhonattanrivera.com

Personal site of Jhonattan Rivera, Integrations Manager (payments) at Akua.
Live at https://jhonattanrivera.com, served by GitHub Pages from `main` (see `CNAME`).

## Stack

Plain static files, no build step:

- `index.html`: the whole page. Every translatable string carries `data-en` / `data-es`.
- `styles.css`: layout, typography and CSS transitions.
- `script.js`: language toggle (EN/ES, remembered in `localStorage`), text splitting and all motion.
- `assets/images/`: portrait, logo and company logos.
- `robots.txt`, `sitemap.xml`: crawler hints.

GSAP 3.12.5 + ScrollTrigger and Lenis 1.1.13 load from CDNs with SRI hashes.
If you bump a version, update its `integrity` attribute too, or the script will be blocked.

## Motion

The page "authorizes itself": an ISO 8583 style intro, a hero that assembles itself,
a pinned thesis whose words light up on scroll, and a pinned journey where a packet
travels customer → gateway → acquirer → network → issuer and back.

- Animation only runs when the visitor has not asked for reduced motion. With
  `prefers-reduced-motion: reduce`, or if the CDN scripts fail to load within 4 s,
  the page renders as plain, fully readable content.
- Prefer animating `transform` and `opacity`. New content should reuse the existing
  `data-reveal` (`fade`, `words`, `line`) and `data-delay` hooks so it moves like its neighbours.

## Editing copy

Change the text in both `data-en` and `data-es` (and the visible fallback text inside the tag).
Page title and description per language live in `META` in `script.js`; the Open Graph
tags in `<head>` are English only.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
