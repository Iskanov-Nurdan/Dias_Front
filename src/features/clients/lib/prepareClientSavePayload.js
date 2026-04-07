/**
 * Отделяет файлы фото от JSON-тела и убирает значения, из‑за которых часто падает PATCH на бэке (NOT NULL, сериализатор).
 */
export function prepareClientSavePayload(payload) {
  if (payload == null || typeof payload !== 'object') {
    return { body: {}, photoUploads: [] };
  }

  const { photoUploads: rawUploads, ...rest } = payload;
  const body = { ...rest };
  delete body.photoUploads;

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

  const photoUploads = Array.isArray(rawUploads) ? rawUploads : [];

  return { body, photoUploads };
}
