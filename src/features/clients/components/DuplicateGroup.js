import React from 'react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';

const TYPE_MAP = {
  individual: { label: 'Индивид.',  cls: 'dup-group__type-badge--individual' },
  regular:    { label: 'Регулярный', cls: 'dup-group__type-badge--regular'    },
  'one-time': { label: 'Разовый',   cls: 'dup-group__type-badge--onetime'    },
};

const DuplicateGroup = ({ group, label, onDetails }) => (
  <div className="dup-group">
    <div className="dup-group__header">
      <span className="dup-group__label">{label}</span>
      <span className="dup-group__count">{group.length} клиента</span>
    </div>
    <div className="dup-group__table-wrap">
      <table className="dup-group__table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Телефон</th>
            <th>Вид спорта</th>
            <th>Оплата</th>
            <th>Тип</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {group.map((c) => {
            const paid = isClientPaid(c);
            const typeInfo = TYPE_MAP[c.clientType];
            return (
              <tr key={c.id} className={composeClientDataRowClass(c, 'dup-group__row')}>
                <td data-label="ФИО">
                  <span className="dup-group__name">{c.fio || '—'}</span>
                </td>
                <td data-label="Телефон">
                  <span className="dup-group__cell-value">{c.phone || '—'}</span>
                </td>
                <td data-label="Вид спорта">
                  <span className="dup-group__cell-value">{c.sportName ?? c.sport?.name ?? '—'}</span>
                </td>
                <td data-label="Оплата">
                  <span className={`dup-group__paid-badge ${paid ? 'dup-group__paid-badge--yes' : 'dup-group__paid-badge--no'}`}>
                    {paid ? 'Оплачено' : 'Не оплачено'}
                  </span>
                </td>
                <td data-label="Тип">
                  {typeInfo ? (
                    <span className={`dup-group__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                  ) : (
                    <span className="dup-group__cell-value">{c.clientType || '—'}</span>
                  )}
                </td>
                <td className="dup-group__actions" data-label="">
                  <button type="button" className="dup-group__btn" onClick={() => onDetails(c)}>
                    Подробнее
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default DuplicateGroup;
