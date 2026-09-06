import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'dist');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    let file = target;
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch (_) {}
    let code = 200;
    let body;
    try { body = await readFile(file); }
    catch (_) { file = path.join(root, '404.html'); body = await readFile(file); code = 404; }
    res.writeHead(code, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (_) { res.writeHead(400); res.end('Bad request'); }
});
server.listen(port, host, () => console.log(`Benjamin is running at http://${host}:${port}`));
server.on('error', (e) => { console.error(e.message); process.exitCode = 1; });
if (process.argv.includes('--watch')) {
  let timer;
  let building = false;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (building) return;
      building = true;
      execFile(process.execPath, ['scripts/build.mjs'], { cwd: project }, (err, stdout, stderr) => {
        building = false;
        if (err) console.error(stderr || err.message); else console.log(stdout.trim());
      });
    }, 120);
  };
  for (const dir of ['src', 'public']) watch(path.join(project, dir), { recursive: true }, rebuild);
  console.log('Watching src/ and public/. Refresh the browser after a rebuild.');
}
