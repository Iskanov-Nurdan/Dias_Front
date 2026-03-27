import { parseApiListResponse } from '../../../shared/lib/apiList';

/**
 * Журнал по смене: только GET с shift_id (и page_size). SHIFT_AND_AUDIT §6:
 * при shift_id не комбинировать date_from/date_to с интервалом смены.
 * Отбор только по календарным дням — отдельный вызов без shift_id.
 *
 * @param {(params: object) => Promise<{ data: unknown }>} request — например (p) => getMyActivity(p)
 * @param {object} shift — строка смены с id
 * @returns {Promise<{ items: object[], banner: string | null }>}
 */
export async function fetchShiftActivityList(request, shift) {
  let resData;
  try {
    const res = await request({ shift_id: shift.id, page_size: 100 });
    resData = res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      resData = { items: [] };
    } else {
      throw err;
    }
  }

  const items = parseApiListResponse(resData);
  return { items, banner: null };
}
