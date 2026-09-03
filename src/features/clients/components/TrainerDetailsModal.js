import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, Users } from 'lucide-react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState, Spinner } from '../../../shared/ui';
import { fetchClients } from '../api';
import { formatScheduleSlotLabel } from '../lib/scheduleStatsNormalize';
import { filterClientsByTrainingSlot, hasTrainingSlotFilter } from '../lib/filterClientsByTrainingSlot';
import './TrainerDetailsModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const TYPE_MAP = {
  individual: { label: 'Индивид.',  cls: 'tdm__type-badge--individual' },
  regular:    { label: 'Регуляр',   cls: 'tdm__type-badge--regular'    },
  'one-time': { label: 'Разовый',   cls: 'tdm__type-badge--onetime'    },
};

const TrainerDetailsModal = ({
  trainerId,
  trainerName,
  year,
  month,
  trainingWeekday,
  trainingTimeFrom,
  trainingTimeTo,
  onDetails,
  onClose,
}) => {
  useModalEffect(!!trainerId, onClose);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  const slotFilterActive = hasTrainingSlotFilter(trainingWeekday, trainingTimeFrom, trainingTimeTo);

  useEffect(() => {
    if (!trainerId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setStudents([]);
    const q = { trainerId: String(trainerId), year: year || undefined, month: month || undefined, perPage: 500 };
    if (slotFilterActive) {
      q.trainingWeekday = Number(trainingWeekday);
      q.trainingTimeFrom = String(trainingTimeFrom).slice(0, 5);
      q.trainingTimeTo = String(trainingTimeTo).slice(0, 5);
    }
    fetchClients(q, ctrl.signal)
      .then((res) => {
        let list = res?.items ?? res?.results ?? (Array.isArray(res) ? res : []);
        list = Array.isArray(list) ? list : [];
        if (slotFilterActive) {
          list = filterClientsByTrainingSlot(list, trainingWeekday, trainingTimeFrom, trainingTimeTo);
        }
        setStudents(list);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [trainerId, year, month, trainingWeekday, trainingTimeFrom, trainingTimeTo]);

  if (!trainerId) return null;

  const periodStr = [year, month ? MONTH_NAMES[Number(month)] : ''].filter(Boolean).join(' ');
  const slotLabel = slotFilterActive
    ? formatScheduleSlotLabel(Number(trainingWeekday), String(trainingTimeFrom).slice(0, 5), String(trainingTimeTo).slice(0, 5))
    : null;

  const content = (
    <div className="tdm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="tdm-title">
      <div className="tdm" onClick={(e) => e.stopPropagation()}>

        <div className="tdm__header">
          <span className="tdm__header-icon"><Users size={18} /></span>
          <div className="tdm__header-info">
            <div className="tdm__header-sub">Ученики тренера</div>
            <h2 id="tdm-title" className="tdm__title">{trainerName || '—'}</h2>
          </div>
          <button type="button" className="tdm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {(periodStr || slotLabel) && (
          <div className="tdm__meta">
            {periodStr && <span className="tdm__meta-period">{periodStr}</span>}
            {slotLabel && <span className="tdm__meta-slot">{slotLabel}</span>}
          </div>
        )}

        {loading ? (
          <div className="tdm__loading">
            <Spinner label="Загрузка учеников…" />
          </div>
        ) : (
          <div className="ui-list__table-wrap tdm__table-wrap">
            <table className="ui-list__table tdm__table">
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
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="ui-list__empty-cell tdm__empty">
                      <EmptyState compact tableCell message="Нет учеников" />
                    </td>
                  </tr>
                ) : (
                  students.map((c) => {
                    const paid = isClientPaid(c);
                    const typeInfo = TYPE_MAP[c.clientType];
                    return (
                      <tr key={c.id} className={composeClientDataRowClass(c, 'tdm__row')}>
                        <td>
                          <div className="ui-list__name-cell">
                            <span className="ui-avatar">{getInitials(c.fio)}</span>
                            <span className="ui-list__title">{c.fio || '—'}</span>
                          </div>
                        </td>
                        <td className="ui-list__muted">{c.phone || '—'}</td>
                        <td className="ui-list__muted">{c.sportName ?? c.sport?.name ?? '—'}</td>
                        <td>
                          <span className={`ui-pill ${paid ? 'ui-pill--success' : 'ui-pill--danger'}`}>
                            {paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        </td>
                        <td>
                          {typeInfo
                            ? <span className={`ui-pill tdm__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                            : <span className="ui-list__muted">{c.clientType || '—'}</span>
                          }
                        </td>
                        <td>
                          <button type="button" className="ui-list-btn" onClick={() => onDetails?.(c)}><Eye size={13} /> Подробнее</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="tdm__footer">
          <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerDetailsModal;
