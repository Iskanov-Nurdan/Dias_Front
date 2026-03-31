/**
 * Оставляет клиентов с тем же слотом занятий (день недели 1–7, время начала/конца HH:mm), что и в карточке клиента.
 */
export function filterClientsByTrainingSlot(clients, weekday, timeFrom, timeTo) {
  if (!Array.isArray(clients) || !clients.length) return [];
  const wd = Number(weekday);
  const tf = String(timeFrom ?? '').slice(0, 5);
  const tt = String(timeTo ?? '').slice(0, 5);
  if (!Number.isFinite(wd) || wd < 1 || wd > 7 || !tf || !tt) return clients;

  return clients.filter((c) => {
    const cWd = Number(c.trainingWeekday ?? c.training_weekday);
    const cTf = String(c.trainingTimeFrom ?? c.training_time_from ?? '').slice(0, 5);
    const cTt = String(c.trainingTimeTo ?? c.training_time_to ?? '').slice(0, 5);
    return cWd === wd && cTf === tf && cTt === tt;
  });
}

export function hasTrainingSlotFilter(weekday, timeFrom, timeTo) {
  const wd = Number(weekday);
  const tf = String(timeFrom ?? '').slice(0, 5);
  const tt = String(timeTo ?? '').slice(0, 5);
  return Number.isFinite(wd) && wd >= 1 && wd <= 7 && Boolean(tf) && Boolean(tt);
}
