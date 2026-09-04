# Jie Tian — Academic Portfolio

Personal academic website for Jie Tian, focused on nonlinear partial differential equations and AI-assisted mathematical research.

## Structure

- `index.html` — semantic single-page portfolio
- `styles.css` — responsive design system and layout
- `script.js` — navigation, progressive reveal, research-workflow interaction, and deferred 3D loading
- `sphere.js` — genuine Three.js geometry, physical glass rendering, 360° drag/inertia, and adaptive fallbacks
- `assets/` — locally hosted subset fonts and the optimized sphere fallback poster
- `vendor/` — the pinned browser-native Three.js runtime used by GitHub Pages
- `favicon.svg` — JT monogram
- `404.html`, `robots.txt`, `sitemap.xml` — GitHub Pages and search support
- `design-qa.md` — visual, interaction, responsive, and accessibility verification record

The site is served directly by GitHub Pages from the repository root. An import map points the browser to the pinned local Three.js runtime, while Vite is used for local development and production-build verification.

## Local development

```bash
npm install
npm run dev
```

Create an optimized verification build with `npm run build`.

## Previous website

The former “Before You Go” graduation archive is preserved on the branch `archive-before-academic-portfolio`.
