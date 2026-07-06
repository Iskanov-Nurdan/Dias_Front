import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState } from '../../../shared/ui';
import { fetchClients } from '../api';
import { formatScheduleSlotLabel } from '../lib/scheduleStatsNormalize';
import { filterClientsByTrainingSlot, hasTrainingSlotFilter } from '../lib/filterClientsByTrainingSlot';
import './TrainerDetailsModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

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
            <span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка учеников…</span>
          </div>
        ) : (
          <div className="tdm__table-wrap">
            <table className="tdm__table">
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
                    <td colSpan={6} className="tdm__empty">
                      <EmptyState compact tableCell message="Нет учеников" />
                    </td>
                  </tr>
                ) : (
                  students.map((c) => {
                    const paid = isClientPaid(c);
                    const typeInfo = TYPE_MAP[c.clientType];
                    return (
                      <tr key={c.id} className={composeClientDataRowClass(c, 'tdm__row')}>
                        <td className="tdm__fio">{c.fio || '—'}</td>
                        <td className="tdm__muted">{c.phone || '—'}</td>
                        <td className="tdm__muted">{c.sportName ?? c.sport?.name ?? '—'}</td>
                        <td>
                          <span className={`tdm__paid-badge tdm__paid-badge--${paid ? 'yes' : 'no'}`}>
                            {paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        </td>
                        <td>
                          {typeInfo
                            ? <span className={`tdm__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                            : <span className="tdm__muted">{c.clientType || '—'}</span>
                          }
                        </td>
                        <td>
                          <button type="button" className="tdm__btn" onClick={() => onDetails?.(c)}>Подробнее</button>
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
          <button type="button" className="tdm__btn tdm__btn--cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerDetailsModal;
