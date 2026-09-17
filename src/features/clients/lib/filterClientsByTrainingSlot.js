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
    // trainingWeekdays — полный список дней клиента (Пн/Ср/Пт и т.п.);
    // trainingWeekday сам по себе помнит только первый день группы, и
    // сверка только по нему теряла клиента при клике на «Ср» или «Пт»
    // в статистике по графику тренеров.
    const rawDays = c.trainingWeekdays ?? c.training_weekdays;
    const days = Array.isArray(rawDays) && rawDays.length > 0
      ? rawDays.map(Number)
      : [Number(c.trainingWeekday ?? c.training_weekday)];
    const cTf = String(c.trainingTimeFrom ?? c.training_time_from ?? '').slice(0, 5);
    const cTt = String(c.trainingTimeTo ?? c.training_time_to ?? '').slice(0, 5);
    return days.includes(wd) && cTf === tf && cTt === tt;
  });
}

export function hasTrainingSlotFilter(weekday, timeFrom, timeTo) {
  const wd = Number(weekday);
  const tf = String(timeFrom ?? '').slice(0, 5);
  const tt = String(timeTo ?? '').slice(0, 5);
  return Number.isFinite(wd) && wd >= 1 && wd <= 7 && Boolean(tf) && Boolean(tt);
}
