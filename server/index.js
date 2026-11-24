import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOffice } from './app.js';

// Servidor da sala: as rotas da API e a página já construída (`dist/`).
// Endereço e porta vêm de MY_OFFICE_HOST e MY_OFFICE_PORT.

const HOST = process.env.MY_OFFICE_HOST || '127.0.0.1';
const PORT = Number(process.env.MY_OFFICE_PORT || 5199);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
  let path;
  try {
    path = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return res.writeHead(400).end();
  }
  const file = normalize(join(DIST, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(DIST.endsWith(sep) ? DIST : DIST + sep)) return res.writeHead(404).end();
  let size;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error();
    size = st.size;
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const office = createOffice();
const server = createServer((req, res) => office.handle(req, res, () => serveStatic(req, res)));
server.listen(PORT, HOST, () => console.log(`my-office em http://${HOST}:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    office.close();
    server.close(() => process.exit(0));
  });
}
