/*
 * Эвристическое обнаружение закреплённой панели DevTools.
 * Не является защитой исходного кода или механизмом авторизации.
 * Подключать обычным <script> в начале <head>, без async/defer/type="module".
 */
(function () {
  'use strict';

  const THRESHOLD_PX = 160;
  const POLL_INTERVAL_MS = 250;
  const root = document.documentElement;
  const destination = new URL('./main.html', window.location.href);
  let redirecting = false;

  // Защита от цикла при ошибочном подключении скрипта на главной странице.
  if (window.location.pathname === destination.pathname) return;

  function hasDevToolsGeometry() {
    const { outerWidth, innerWidth, outerHeight, innerHeight } = window;
    const dimensions = [outerWidth, innerWidth, outerHeight, innerHeight];

    // Нулевые/нечисловые размеры не подтверждают наличие панели.
    if (!dimensions.every(value => Number.isFinite(value) && value > 0)) {
      return false;
    }

    return outerWidth - innerWidth > THRESHOLD_PX ||
      outerHeight - innerHeight > THRESHOLD_PX;
  }

  function check() {
    if (redirecting) return true;
    if (!hasDevToolsGeometry()) return false;

    redirecting = true;
    root.dataset.security = 'blocked';
    // replace не добавляет заблокированную страницу в историю переходов.
    // Уже полученные браузером исходники эта операция не удаляет.
    window.location.replace(destination.href);
    return true;
  }

  // Важен порядок: первая проверка синхронная, до установки таймера и
  // до разбора содержимого страницы. Работает и при открытии прямого URL.
  if (check()) return;
  root.dataset.security = 'ready';

  // resize реагирует на открытие закреплённой панели; периодическая
  // проверка покрывает случаи, когда браузер не отправил это событие.
  window.addEventListener('resize', check, { passive: true });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check); // Включая восстановление из bfcache.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, POLL_INTERVAL_MS);
})();
