import { apiClient, TAPLINK_BACKEND_ENABLED } from '../../shared/api/client';

// Берём флаг из client.js — один переключатель для всего проекта
export const BACKEND_ENABLED = TAPLINK_BACKEND_ENABLED;

// ─── API functions ─────────────────────────────────────────────────────────────

/** GET /api/taplink/ — публичный, без авторизации */
export const fetchConfig = async (signal) => {
  const { data } = await apiClient.get('/taplink/', signal ? { signal } : {});
  return data;
};

/** PUT /api/taplink/ — сохранить конфиг (требует авторизацию) */
export const saveConfig = async (payload) => {
  const { data } = await apiClient.put('/taplink/', payload);
  return data;
};

/**
 * POST /api/taplink/upload/ — загрузить файл (фото или видео)
 * @param {File} file - файл из input[type=file]
 * @param {string} context - 'hero-bg' | 'sport-photo' | 'trainer-photo' | 'sport-video' | 'trainer-video'
 * @returns {Promise<string>} URL загруженного файла
 */
export const uploadFile = async (file, context = '') => {
  const form = new FormData();
  form.append('file', file);
  form.append('context', context);
  const { data } = await apiClient.post('/taplink/upload/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
};

/** DELETE /api/taplink/upload/ — удалить файл по URL */
export const deleteFile = async (url) => {
  await apiClient.delete('/taplink/upload/', { data: { url } });
};

/**
 * POST /api/taplink/booking/ — публичная запись на тренировку (без авторизации)
 * @param {{ name, phone, sport, trainer?, preferredTime?, comment? }} payload
 */
export const submitBooking = async (payload) => {
  const { data } = await apiClient.post('/taplink/booking/', payload);
  return data;
};

/**
 * GET /api/taplink/trainers/{id}/schedule/ — публичный график тренера для формы записи
 * (без авторизации; тот же формат ответа, что и авторизованный /trainers/{id}/schedule/).
 * Нужен, чтобы «Удобное время занятий» на лендинге показывало реальный график из CRM,
 * а не вручную вписанный в редакторе текст.
 */
export const fetchPublicTrainerSchedule = async (crmTrainerId, signal) => {
  const { data } = await apiClient.get(
    `/taplink/trainers/${crmTrainerId}/schedule/`,
    signal ? { signal } : {}
  );
  return data;
};
