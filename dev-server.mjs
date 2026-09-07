// dev-server.mjs — Minimal static file server for local development.
// ES modules require HTTP (they are blocked on file:// URLs), so run:
//   node dev-server.mjs
// then open http://localhost:8000 in your browser.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = 8000;
const ROOT = process.cwd();
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
};

createServer(async (req, res) => {
    try {
        let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname === '/') pathname = '/index.html';
        const file = normalize(join(ROOT, pathname));
        if (!file.startsWith(normalize(ROOT))) {
            res.writeHead(403); res.end('Forbidden'); return;
        }
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
    }
}).listen(PORT, () => {
    console.log(`Echoes of Infinity dev server → http://localhost:${PORT}`);
});
