import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const routes = new Map([
  ['/', ['main.html', 'text/html; charset=utf-8']],
  ['/main.html', ['main.html', 'text/html; charset=utf-8']],
  ['/2.html', ['2.html', 'text/html; charset=utf-8']],
  ['/security.js', ['security.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

export function createDemoServer() {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch {
      response.writeHead(400).end();
      return;
    }
    const route = routes.get(pathname);
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(new URL(route[0], import.meta.url));
      response.writeHead(200, {
        'Content-Type': route[1],
        'Content-Length': content.length,
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(500).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT должен быть целым числом от 1 до 65535.');
    process.exit(1);
  }
  const server = createDemoServer();
  server.on('error', error => {
    console.error(`Не удалось запустить сервер: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Откройте http://127.0.0.1:${port}/main.html`);
    console.log('Остановка сервера: Ctrl+C');
  });
}
