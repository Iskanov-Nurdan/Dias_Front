/**
 * Жёсткое обновление приложения: снять service worker + стереть все его
 * кэши (Cache Storage) и перезагрузить страницу настоящим сетевым запросом.
 *
 * Зачем это вообще нужно — у CRA-сборки включён PWA service worker
 * (serviceWorkerRegistration.register() в src/index.js, сам воркер —
 * build/service-worker.js, Workbox GenerateSW). Он кладёт index.html и все
 * чанки в Cache Storage и дальше отдаёт их ИЗ кэша в первую очередь — это
 * нормально для офлайн-работы, но на телефоне, если сайт добавлен на
 * главный экран (standalone-режим), у пользователя физически нет ни адресной
 * строки, ни жеста pull-to-refresh, чтобы заставить браузер перепроверить
 * version — обычный F5/свайп-обновление тут недоступны. Сам воркер
 * настроен с skipWaiting()+clients.claim() (видно в сборке), то есть новая
 * версия подхватилась бы сама — но ТОЛЬКО если браузер вообще сходил в сеть
 * за новым service-worker.js, а на iOS Safari в standalone-режиме это может
 * не происходить очень долго. Эта кнопка — ручной аварийный выход: сносит
 * и воркер, и все его кэши, следующая загрузка идёт мимо них, напрямую в сеть.
 */
export async function forceAppUpdate() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* чем бы ни кончилась чистка — всё равно перезагружаем ниже */
  } finally {
    window.location.reload();
  }
}
