import React from 'react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';

const DuplicateGroup = ({ group, label, onDetails }) => (
  <div className="dup-group">
    <div className="dup-group__header">
      <span className="dup-group__label">{label}</span>
      <span className="dup-group__count">{group.length} клиента</span>
    </div>
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
            <td>{c.fio || '—'}</td>
            <td>{c.phone || '—'}</td>
            <td>{c.sportName ?? c.sport?.name ?? '—'}</td>
            <td>{isClientPaid(c) ? 'Да' : 'Нет'}</td>
            <td className={c.clientType === 'individual' ? 'dup-group__type-cell dup-group__type-cell--individual' : c.clientType === 'one-time' ? 'dup-group__type-cell dup-group__type-cell--one-time' : ''}>{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType === 'one-time' ? 'Разовый' : c.clientType || '—'}</td>
            <td>
              <button type="button" className="dup-group__btn" onClick={() => onDetails(c)}>Подробнее</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DuplicateGroup;
