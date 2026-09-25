import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../security.js', import.meta.url), 'utf8');

function run({ dimensions = {}, href = 'http://localhost/demo/2.html' } = {}) {
  const redirects = [];
  const events = new Map();
  const documentEvents = new Map();
  const timers = [];
  const document = {
    documentElement: { dataset: { security: 'pending' } },
    visibilityState: 'visible',
    addEventListener: (name, callback) => documentEvents.set(name, callback),
  };
  const window = {
    outerWidth: 1280, innerWidth: 1280, outerHeight: 900, innerHeight: 800,
    ...dimensions,
    location: { href, pathname: new URL(href).pathname,
      replace: url => redirects.push(url) },
    addEventListener: (name, callback) => events.set(name, callback),
    setInterval: (callback, ms) => timers.push({ callback, ms }),
  };
  vm.runInNewContext(source, { window, document, URL });
  return { window, document, redirects, events, documentEvents, timers };
}

test('закрытая панель: страница доступна, перенаправления нет', () => {
  const result = run();
  assert.equal(result.document.documentElement.dataset.security, 'ready');
  assert.equal(result.redirects.length, 0);
});

for (const [name, dimensions] of [
  ['справа/слева', { innerWidth: 900 }],
  ['снизу', { innerHeight: 550 }],
  ['по обеим осям', { innerWidth: 900, innerHeight: 550 }],
]) {
  test(`панель уже открыта ${name}: синхронный replace до таймера`, () => {
    const result = run({ dimensions });
    assert.deepEqual(result.redirects, ['http://localhost/demo/main.html']);
    assert.equal(result.timers.length, 0);
    assert.equal(result.document.documentElement.dataset.security, 'blocked');
  });
}

for (const event of ['resize', 'focus', 'pageshow']) {
  test(`повторная проверка по событию ${event}`, () => {
    const result = run();
    result.window.innerWidth = 900;
    result.events.get(event)();
    assert.equal(result.redirects.length, 1);
  });
}

test('таймер обнаруживает изменение и не дублирует перенаправление', () => {
  const result = run();
  assert.equal(result.timers[0].ms, 250);
  result.window.innerHeight = 550;
  result.timers[0].callback();
  result.events.get('resize')();
  result.timers[0].callback();
  assert.equal(result.redirects.length, 1);
});

test('проверка при возвращении к видимой вкладке', () => {
  const result = run();
  result.window.innerWidth = 900;
  result.document.visibilityState = 'hidden';
  result.documentEvents.get('visibilitychange')();
  assert.equal(result.redirects.length, 0);
  result.document.visibilityState = 'visible';
  result.documentEvents.get('visibilitychange')();
  assert.equal(result.redirects.length, 1);
});

test('порог: 160 пикселей допустимы, 161 запускает перенаправление', () => {
  assert.equal(run({ dimensions: { innerWidth: 1120 } }).redirects.length, 0);
  assert.equal(run({ dimensions: { innerWidth: 1119 } }).redirects.length, 1);
});

test('главная страница не попадает в цикл', () => {
  const result = run({ href: 'http://localhost/demo/main.html',
    dimensions: { innerWidth: 900 } });
  assert.equal(result.redirects.length, 0);
  assert.equal(result.timers.length, 0);
});

test('query и fragment не переносятся в адрес назначения', () => {
  const result = run({ href: 'http://localhost/demo/2.html?q=1#part',
    dimensions: { innerWidth: 900 } });
  assert.deepEqual(result.redirects, ['http://localhost/demo/main.html']);
});

test('невалидные размеры сами по себе не считаются детекцией', () => {
  for (const value of [0, NaN, Infinity, -1]) {
    assert.equal(run({ dimensions: { outerWidth: value } }).redirects.length, 0);
  }
});

test('граница метода: отдельное окно DevTools с обычной геометрией не определяется', () => {
  // Те же наблюдаемые параметры, что у браузера без DevTools.
  assert.equal(run().redirects.length, 0);
});

test('граница метода: широкая боковая панель даёт ложное срабатывание', () => {
  assert.equal(run({ dimensions: { innerWidth: 900 } }).redirects.length, 1);
});
