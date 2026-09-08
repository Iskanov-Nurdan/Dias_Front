import { isClientPaid, isClientSubscriptionExpired } from '../../../shared/constants/common';
import { isClientFullyPaid } from './clientMoney';

/**
 * Классы подсветки строки клиента в таблицах (список, дубликаты, модалка тренера).
 * @param {string} base например clients-list__row, dup-group__row, trainer-details-modal__row
 */
export function composeClientDataRowClass(client, base) {
  if (!client) return base;
  if (isClientSubscriptionExpired(client)) return `${base} ${base}--subscription-expired`;
  if (isClientFullyPaid(client)) return `${base} ${base}--installments-complete`;
  if (!isClientPaid(client)) return `${base} ${base}--unpaid`;
  if (client.clientType === 'one-time') return `${base} ${base}--one-time`;
  if (client.clientType === 'individual') return `${base} ${base}--individual`;
  return base;
}
