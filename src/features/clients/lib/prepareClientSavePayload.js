/**
 * Готовит тело запроса на сохранение клиента: убирает значения, из-за которых
 * часто падает PATCH на бэке (файлы в JSON, явный null по legacy-полю).
 */
export function prepareClientSavePayload(payload) {
  if (payload == null || typeof payload !== 'object') {
    return { body: {} };
  }

  const body = { ...payload };

  for (const key of Object.keys(body)) {
    const v = body[key];
    if (v instanceof File || v instanceof Blob) {
      delete body[key];
    }
  }

  // Явный null по legacy-полю часто даёт нарушение NOT NULL в БД при частичном обновлении.
  if (body.actualPaymentDate === null) {
    delete body.actualPaymentDate;
  }

  return { body };
}
