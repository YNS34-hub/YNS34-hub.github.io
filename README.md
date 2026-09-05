# Jie Tian — Mathematics & AI for Research

Personal academic and project portfolio for **Jie Tian**, a mathematics master's student working on nonlinear partial differential equations and exploring how AI can support rigorous scientific reasoning.

**Live site:** https://yns34-hub.github.io/

## Focus

- Nonlinear partial differential equations
- Orlicz growth and rearrangement methods
- AI-assisted mathematical research
- Human-in-the-loop verification and research workflows
- Interactive web experiments for scientific and product communication

## What this repository contains

The site is intentionally designed as a long-term academic portfolio rather than a generic developer landing page. It combines research communication with interactive visualization and selected AI-assisted workflow experiments.

### Main sections

- **About** — research background and working principles
- **Research** — nonlinear elliptic PDEs, Orlicz growth, comparison and rearrangement methods
- **AI & Research** — how AI is used as a second reader rather than a mathematical oracle
- **Projects** — structured AI-assisted research workflow experiments
- **Thinking** — notes on human judgment, scientific questions, and AI-assisted reasoning
- **Contact** — GitHub and LinkedIn

## 3D nonlinear glass object

The hero visualization is a genuine WebGL / Three.js object rather than a 2D texture effect.

It uses:

- displaced 3D geometry generated from an icosphere
- simplex-noise deformation and localized cavities
- physical glass materials with transmission, IOR, dispersion, and clearcoat
- environment lighting and adaptive shadows
- real 360° pointer/touch rotation
- mobile and reduced-motion fallbacks

The silhouette, lighting, reflections, and refraction change as the object rotates because the geometry is truly three-dimensional.

## Tech stack

- Semantic HTML
- Modern CSS
- JavaScript
- Three.js / WebGL2
- Vite for local verification
- GitHub Pages for deployment

## Repository structure

```text
.
├── index.html        # semantic portfolio content
├── styles.css        # responsive visual system
├── script.js         # navigation and interaction layer
├── sphere.js         # nonlinear 3D geometry and glass renderer
├── assets/           # fonts and fallback assets
├── vendor/           # pinned browser-side Three.js runtime
├── favicon.svg
├── 404.html
├── robots.txt
├── sitemap.xml
└── design-qa.md      # visual / interaction QA notes
```

## Local development

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```

## Project philosophy

> AI should augment rigorous human reasoning rather than replace it.

The portfolio reflects the same principle: interactive and AI-assisted tools are useful when their scope, assumptions, and verification boundaries remain explicit.

## Previous version

The former graduation-memory website is preserved on the branch:

```text
archive-before-academic-portfolio
```

## Author

**Jie Tian**  
Mathematics Master's Student · School of Science · Harbin University of Science and Technology

- Portfolio: https://yns34-hub.github.io/
- GitHub: https://github.com/YNS34-hub
- LinkedIn: https://www.linkedin.com/in/jie-tian-08278b433/
