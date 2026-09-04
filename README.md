# Jie Tian — Academic Portfolio

Personal academic website for Jie Tian, focused on nonlinear partial differential equations and AI-assisted mathematical research.

## Structure

- `index.html` — semantic single-page portfolio
- `styles.css` — responsive design system and layout
- `script.js` — navigation, progressive reveal, and research-workflow interaction
- `sphere.js` — dependency-free WebGL nonlinear level-set surface with adaptive quality and a static fallback
- `assets/` — locally hosted subset fonts and the optimized sphere fallback
- `favicon.svg` — JT monogram
- `404.html`, `robots.txt`, `sitemap.xml` — GitHub Pages and search support
- `design-qa.md` — visual, interaction, responsive, and accessibility verification record

The production site has no runtime framework dependency and is served directly by GitHub Pages from the repository root. Vite is used only for local development and production-build verification.

## Local development

```bash
npm install
npm run dev
```

Create an optimized verification build with `npm run build`.

## Previous website

The former “Before You Go” graduation archive is preserved on the branch `archive-before-academic-portfolio`.
