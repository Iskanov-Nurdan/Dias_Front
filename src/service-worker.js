/* eslint-disable no-restricted-globals */

/**
 * Service worker для CRM.
 *
 * Главное правило: данные с сервера НЕ кешируются. Раньше здесь стояло правило
 * NetworkFirst на /api/ с хранением ответов 5 минут — сотрудник менял оплату,
 * обновлял страницу и видел старые цифры. Для CRM это недопустимо: список клиентов,
 * долги и оплаты должны приходить с сервера каждый раз.
 *
 * Кешируем только собственные статические файлы сборки. Их имена содержат хеш
 * содержимого, поэтому новый деплой — это новые имена файлов, устаревшее
 * содержимое отдать невозможно.
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Новая версия приложения применяется сразу, не дожидаясь закрытия всех вкладок:
// иначе после деплоя сотрудник продолжает работать в старой сборке.
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Навигация внутри SPA отдаётся из предзагруженного index.html
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    // /api/ и любые файлы с расширением обрабатывает сеть, а не кеш
    if (url.pathname.startsWith('/api/')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Картинки — единственное, что имеет смысл держать в кеше
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(png|jpg|jpeg|svg|webp)$/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);

// Разовая чистка кеша ответов API, оставшегося у сотрудников от прошлой версии SW
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('api-cache'));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
