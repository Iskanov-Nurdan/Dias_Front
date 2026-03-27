import { apiClient } from '../../../shared/api';

/**
 * Смены (ShiftViewSet, доступ `my_shift`). См. `dias-back/docs/SHIFT_AND_AUDIT.md` §7.
 * GET список: date_from, date_to, line, user.
 */
/** Текущая открытая только личная смена (`line` = null); смена на линии не возвращается. */
export const getMyShift = () => apiClient.get('shifts/my/');

/**
 * Открыть смену. Тело: опционально line_id.
 * Без line_id — только личная смена (line = null). С line_id — как смена на линии (height, width, angle_deg обязательны).
 * 409: уже открыта личная смена или уже открыта смена на этой же линии; личная и линейная не блокируют друг друга.
 */
export const openShift = (data = {}) => apiClient.post('shifts/open/', data);

/**
 * Закрыть свою открытую смену. Тело: опционально line_id, размеры/comment как у закрытия линии.
 * Без line_id — только личная. С line_id — смена на этой линии (альтернатива POST lines/{id}/close/).
 */
export const closeShift = (data = {}) => apiClient.post('shifts/close/', data);

/** Заметки только к личной открытой смене; без неё POST → 404. */
export const addShiftNote = (note) => apiClient.post('shifts/notes/', { note });

/** Заметки личной открытой смены; без неё — пустой items. */
export const getMyShiftNotes = () => apiClient.get('shifts/notes/');

export const getAllShifts = (params) => apiClient.get('shifts/', { params });

/** Деталь смены: поля id, line, line_name, line_label, opened_at, closed_at, status, comment, notes_count, notes, … */
export const getShiftDetails = (id) => apiClient.get(`shifts/${id}/`);

export const getAllUsers = (params) => apiClient.get('users/', { params });

/** История смен текущего пользователя. */
export const getMyShiftHistory = (params) => apiClient.get('shifts/history/', { params });

/**
 * Жалобы (ShiftComplaint). Ответ: { items, meta }.
 * Фильтры: date (YYYY-MM-DD), date_from, date_to, author_id | author, mentioned_user_id | mentioned_user.
 * Права: my_shift или shifts (или суперпользователь) — иначе 403.
 */
export const getComplaints = (params) => apiClient.get('shifts/complaints/', { params });

/**
 * POST: body (обяз.), mentioned_user_ids (опц.), shift_id (опц., только своя открытая смена).
 */
export const createComplaint = (data) => apiClient.post('shifts/complaints/', data);

// Журнал (§6 SHIFT_AND_AUDIT): shift_id — строки с этим shift или created_at в [opened_at, closed_at];
// при shift_id не комбинировать date_from/date_to с интервалом смены на бэке.
export const getMyActivity = (params) => apiClient.get('activity/my/', { params });

/** Детальная запись журнала (личная). */
export const getMyActivityDetail = (id) => apiClient.get(`activity/my/${id}/`);

/** Детальная запись журнала (права shifts / суперпользователь). */
export const getActivityDetail = (id) => apiClient.get(`activity/${id}/`);

// Смены конкретного сотрудника (для администратора)
export const getUserShifts = (userId, params) =>
  apiClient.get('shifts/', { params: { user: userId, ...params } });

// Журнал действий конкретного сотрудника (для администратора); те же правила shift_id vs даты, что у getMyActivity.
export const getUserActivity = (userId, params) =>
  apiClient.get('activity/', { params: { user_id: userId, ...params } });
