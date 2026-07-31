/**
 * Клиенты с неполными данными, которые нужно вручную исправить:
 * — не заполнено время занятия;
 * — оплачено, но нет ни одной частичной оплаты (нечем подтвердить сумму).
 */

const isMissingTrainingTime = (c) => {
  const tw = c.trainingWeekday ?? c.training_weekday;
  const tf = c.trainingTimeFrom ?? c.training_time_from;
  const tt = c.trainingTimeTo ?? c.training_time_to;
  return !tw && !tf && !tt;
};

const isMissingInstallmentsWhilePaid = (c) => {
  const paid = c.paid === true || c.paid === 'true';
  if (!paid) return false;
  const payments = c.actualPayments ?? c.actual_payments;
  return !Array.isArray(payments) || payments.length === 0;
};

/** @returns {string[]} читаемые причины, почему запись требует исправления */
export const getClientCorrectionReasons = (client) => {
  const reasons = [];
  if (isMissingTrainingTime(client)) reasons.push('Не заполнено время занятия');
  if (isMissingInstallmentsWhilePaid(client)) reasons.push('Оплачено, но нет частичных оплат');
  return reasons;
};

export const clientNeedsCorrection = (client) => getClientCorrectionReasons(client).length > 0;
