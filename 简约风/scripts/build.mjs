import { readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createProfile } from './profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const pages = [
  { id: 'index', title: 'Benjamin / Mathematics & AI-assisted research', description: 'Benjamin, also known as Jie Tian. A working index of graduate research in nonlinear equations and experiments in AI-assisted mathematical research.' },
  { id: 'research', title: 'Research / Benjamin', description: 'Jie Tian\'s graduate research in nonlinear elliptic equations, Orlicz growth, rearrangement methods and comparison principles.' },
  { id: 'practice', title: 'Reviewer-first mathematical revision audit / Benjamin', description: 'A private research-workflow prototype connecting reviewer questions, manuscript evidence and human decisions. Validation pending.' },
  { id: 'about', title: 'About Benjamin / Jie Tian', description: 'Jie Tian, mathematics master\'s student at Harbin University of Science and Technology, exploring nonlinear analysis and AI-assisted research practice.' },
  { id: 'colophon', title: 'Colophon / Benjamin', description: 'How this working index is made: readable typography, a finite mathematical illustration, native scrolling and a small static website.' },
  { id: '404', title: 'Page not found / Benjamin', description: 'This page is not in the index. Return to Benjamin\'s research, practice and contact information.' }
];
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
const template = await readFile(path.join(root, 'src/template.html'), 'utf8');
for (const page of pages) {
  const content = (await readFile(path.join(root, `src/pages/${page.id}.html`), 'utf8')).replace('{{PROFILE}}', createProfile());
  const nav = [['index', 'Index'], ['research', 'Research'], ['practice', 'Practice'], ['about', 'About']]
    .map(([id, label]) => `<a href="${id}.html"${id === page.id ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const tokens = { TITLE: escape(page.title), DESCRIPTION: escape(page.description), CANONICAL: page.id === 'index' ? '' : `${page.id}.html`, BODY_CLASS: page.id === 'index' ? 'home-page' : 'article-page', PAGE: page.id, NAV: nav, CONTENT: content };
  let output = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, token) => {
    if (!(token in tokens)) throw new Error(`Unknown template token: ${token}`);
    return tokens[token];
  });
  if (page.id === '404') output = output.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
  await writeFile(path.join(out, `${page.id}.html`), output);
}
await writeFile(path.join(out, '.nojekyll'), '');
await writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://yns34-hub.github.io/sitemap.xml\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p => p.id !== '404').map(p => `<url><loc>https://yns34-hub.github.io/${p.id === 'index' ? '' : p.id + '.html'}</loc></url>`).join('')}</urlset>\n`;
await writeFile(path.join(out, 'sitemap.xml'), sitemap);
console.log(`Built ${pages.length} pages to dist/ with no dependencies.`);
