import { getApiErrorMessage } from '../../../shared/lib';

const CODE_MESSAGES = {
  NO_OPEN_SHIFT:
    'Нет открытой смены. Откройте «Моя смена» — линию выбирать не нужно.',
  LINE_SHIFT_CLOSED: 'Смена закрыта. Откройте новую в «Моя смена».',
  LINE_SHIFT_PAUSED: 'Смена на паузе. Возобновите в «Моя смена» или откройте новую.',
  LINE_INACTIVE: 'Линия недоступна. Старт по заявке не привязан к линии — обновите бэкенд start/.',
  DUPLICATE_BLANKS: 'Одна и та же заготовка выбрана дважды.',
  BLANK_NOT_FOUND: 'Заготовка не найдена.',
  BLANK_PROFILE_MISMATCH: 'Заготовка не подходит к профилям заявки.',
  BLANK_INSUFFICIENT_STOCK: 'Недостаточно заготовки в цехе.',
  INVALID_BLANKS: 'Укажите хотя бы одну заготовку.',
  MISSING_BLANK: 'Выберите заготовку.',
  LINE_STARTS_REQUIRED: 'Для каждого профиля укажите заготовку.',
  MISSING_LINE_BLANK: 'Выберите заготовку для каждого профиля в заявке.',
  UNKNOWN_ORDER_LINE: 'Неизвестная позиция заявки — обновите страницу.',
};

/** Текст ошибки старта производства без упора на «линию» в UI. */
export function getProductionStartErrorMessage(err, fallback = 'Не удалось запустить производство') {
  const data = err?.response?.data;
  const code =
    (typeof data?.code === 'string' && data.code) ||
    (typeof data?.error_code === 'string' && data.error_code) ||
    '';
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const raw = getApiErrorMessage(err, fallback);
  if (/линии|на линии|line/i.test(raw)) {
    return CODE_MESSAGES.NO_OPEN_SHIFT;
  }
  return raw;
}
