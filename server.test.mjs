import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDemoServer } from '../server.mjs';

test('HTTP: страницы, скрипт, отсутствие кеширования и границы раздачи', async t => {
  const server = createDemoServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/main.html', '/2.html', '/security.js', '/styles.css']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.text()).length > 0);
  }
  const main = await (await fetch(base + '/main.html')).text();
  assert.match(main, /href="\.\/2\.html"/);
  const second = await (await fetch(base + '/2.html')).text();
  assert.ok(second.indexOf('<script src="./security.js"></script>') < second.indexOf('<body>'));
  assert.equal((await fetch(base + '/README.md')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/package.json')).status, 404);
  assert.equal((await fetch(base + '/2.html', { method: 'POST' })).status, 405);
  const head = await fetch(base + '/security.js', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
