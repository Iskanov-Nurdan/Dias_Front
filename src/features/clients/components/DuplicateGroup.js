import React from 'react';
import { Eye } from 'lucide-react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

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
    <div className="ui-list__table-wrap">
      <table className="ui-list__table dup-group__table">
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
                  <div className="ui-list__name-cell">
                    <span className="ui-avatar">{getInitials(c.fio)}</span>
                    <span className="ui-list__title">{c.fio || '—'}</span>
                  </div>
                </td>
                <td data-label="Телефон">
                  <span className="ui-list__muted">{c.phone || '—'}</span>
                </td>
                <td data-label="Вид спорта">
                  <span className="ui-list__muted">{c.sportName ?? c.sport?.name ?? '—'}</span>
                </td>
                <td data-label="Оплата">
                  <span className={`ui-pill ${paid ? 'ui-pill--success' : 'ui-pill--danger'}`}>
                    {paid ? 'Оплачено' : 'Не оплачено'}
                  </span>
                </td>
                <td data-label="Тип">
                  {typeInfo ? (
                    <span className={`ui-pill dup-group__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                  ) : (
                    <span className="ui-list__muted">{c.clientType || '—'}</span>
                  )}
                </td>
                <td className="ui-list__actions" data-label="">
                  <button type="button" className="ui-list-btn" onClick={() => onDetails(c)}>
                    <Eye size={13} /> Подробнее
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
