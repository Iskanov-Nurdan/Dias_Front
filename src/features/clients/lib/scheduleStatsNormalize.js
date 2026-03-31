import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pickTrainerId = (raw) => raw?.trainerId ?? raw?.trainer_id ?? null;
const pickTrainerName = (raw) => String(raw?.trainerName ?? raw?.trainer_name ?? '').trim();

const normalizeSlotFields = (raw) => ({
  weekday: num(raw?.weekday ?? raw?.week_day),
  timeFrom: String(raw?.timeFrom ?? raw?.time_from ?? '').slice(0, 5),
  timeTo: String(raw?.timeTo ?? raw?.time_to ?? '').slice(0, 5),
  total: num(raw?.total ?? raw?.count ?? raw?.students),
  paid: num(raw?.paid),
  unpaid: num(raw?.unpaid),
});

const normalizeUnassigned = (raw) => {
  if (raw == null || typeof raw !== 'object') return null;
  const total = num(raw.total ?? raw.count);
  const paid = num(raw.paid);
  const unpaid = num(raw.unpaid);
  if (total === 0 && paid === 0 && unpaid === 0 && raw.total == null && raw.count == null) return null;
  return { total, paid, unpaid };
};

/**
 * Унифицирует ответ GET /clients/stats/schedule/ (вложенный или плоский список).
 * @returns {{ trainers: Array<{ trainerId, trainerName, slots: Array }>, unassigned: { total, paid, unpaid } | null }}
 */
export function normalizeClientsScheduleStatsResponse(data) {
  if (!data || typeof data !== 'object') {
    return { trainers: [], unassigned: null };
  }

  const flat = data.items ?? data.rows ?? data.by_slot ?? data.bySlot ?? data.slots;
  if (Array.isArray(flat) && flat.length > 0) {
    const map = new Map();
    for (const raw of flat) {
      const slot = normalizeSlotFields(raw);
      const trainerId = pickTrainerId(raw);
      const trainerName = pickTrainerName(raw);
      const key = trainerId != null ? `id:${trainerId}` : `name:${trainerName || '—'}`;
      if (!map.has(key)) {
        map.set(key, { trainerId, trainerName: trainerName || '—', slots: [] });
      }
      map.get(key).slots.push(slot);
    }
    return {
      trainers: Array.from(map.values()),
      unassigned: normalizeUnassigned(data.withoutSlot ?? data.without_slot ?? data.no_schedule ?? data.unassigned),
    };
  }

  const trainersRaw = data.trainers ?? data.by_trainer ?? data.byTrainer;
  if (Array.isArray(trainersRaw) && trainersRaw.length > 0) {
    const trainers = trainersRaw.map((t) => {
      const trainerId = pickTrainerId(t);
      const trainerName = pickTrainerName(t) || '—';
      const slotsRaw = t.slots ?? t.intervals ?? t.time_slots ?? t.timeSlots ?? [];
      const slots = (Array.isArray(slotsRaw) ? slotsRaw : []).map((r) => ({
        ...normalizeSlotFields(r),
      }));
      return { trainerId, trainerName, slots };
    });
    return {
      trainers,
      unassigned: normalizeUnassigned(data.withoutSlot ?? data.without_slot ?? data.no_schedule ?? data.unassigned),
    };
  }

  return {
    trainers: [],
    unassigned: normalizeUnassigned(data.withoutSlot ?? data.without_slot ?? data.no_schedule ?? data.unassigned),
  };
}

export function sortScheduleSlots(slots) {
  return [...(slots || [])].sort((a, b) => {
    const wd = (a.weekday || 0) - (b.weekday || 0);
    if (wd !== 0) return wd;
    return String(a.timeFrom).localeCompare(String(b.timeFrom), undefined, { numeric: true });
  });
}

export function formatScheduleSlotLabel(weekday, timeFrom, timeTo) {
  const w = WEEKDAYS.find((x) => x.weekday === Number(weekday));
  const short = w?.short ?? String(weekday ?? '—');
  const tf = timeFrom || '—';
  const tt = timeTo || '—';
  return `${short} ${tf}–${tt}`;
}
