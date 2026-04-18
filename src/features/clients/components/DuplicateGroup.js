import React from 'react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';

const DuplicateGroup = ({ group, label, onDetails }) => (
  <div className="dup-group">
    <div className="dup-group__header">
      <span className="dup-group__label">{label}</span>
      <span className="dup-group__count">{group.length} клиента</span>
    </div>
    <div className="dup-group__table-wrap">
      <table className="dup-group__table">
        <thead>
          <tr><th>ФИО</th><th>Телефон</th><th>Вид спорта</th><th>Оплачено</th><th>Тип</th><th></th></tr>
        </thead>
        <tbody>
          {group.map((c) => (
            <tr
              key={c.id}
              className={composeClientDataRowClass(c, 'dup-group__row')}
            >
              <td data-label="ФИО"><span className="dup-group__cell-value">{c.fio || '—'}</span></td>
              <td data-label="Телефон"><span className="dup-group__cell-value">{c.phone || '—'}</span></td>
              <td data-label="Вид спорта"><span className="dup-group__cell-value">{c.sportName ?? c.sport?.name ?? '—'}</span></td>
              <td data-label="Оплачено"><span className="dup-group__cell-value">{isClientPaid(c) ? 'Да' : 'Нет'}</span></td>
              <td
                data-label="Тип"
                className={c.clientType === 'individual' ? 'dup-group__type-cell dup-group__type-cell--individual' : c.clientType === 'one-time' ? 'dup-group__type-cell dup-group__type-cell--one-time' : ''}
              >
                <span className="dup-group__cell-value">{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType === 'one-time' ? 'Разовый' : c.clientType || '—'}</span>
              </td>
              <td className="dup-group__actions" data-label="">
                <button type="button" className="dup-group__btn" onClick={() => onDetails(c)}>Подробнее</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default DuplicateGroup;
