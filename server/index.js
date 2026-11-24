import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOffice } from './app.js';

// Servidor da sala: as rotas da API e a página já construída (`dist/`).
// Endereço e porta vêm de MY_OFFICE_HOST e MY_OFFICE_PORT. Iniciado pelo
// systemd (ativação por socket), usa o socket que ele já abriu; com
// MY_OFFICE_IDLE_EXIT_MIN, encerra sozinho depois desse tempo sem sessões e
// sem página conectada, e o systemd volta a iniciá-lo na próxima conexão.

const HOST = process.env.MY_OFFICE_HOST || '127.0.0.1';
const PORT = Number(process.env.MY_OFFICE_PORT || 5199);
const IDLE_EXIT_MIN = Number(process.env.MY_OFFICE_IDLE_EXIT_MIN || 0);
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
const fromSystemd = process.env.LISTEN_FDS === '1' && Number(process.env.LISTEN_PID) === process.pid;
if (fromSystemd) server.listen({ fd: 3 }, () => console.log('my-office no socket do systemd'));
else server.listen(PORT, HOST, () => console.log(`my-office em http://${HOST}:${PORT}`));

function stop() {
  office.close();
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, stop);

if (IDLE_EXIT_MIN > 0) {
  let quietSince = Date.now();
  setInterval(() => {
    if (office.state.list().length || office.clients.size) quietSince = Date.now();
    else if (Date.now() - quietSince >= IDLE_EXIT_MIN * 60_000) {
      console.log(`my-office: ${IDLE_EXIT_MIN} min sem sessões nem página, encerrando`);
      stop();
    }
  }, 30_000).unref();
}
