import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isClientPaid } from '../../../shared/constants/common';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState } from '../../../shared/ui';
import { fetchClients } from '../api';
import './TrainerDetailsModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const TrainerDetailsModal = ({ trainerId, trainerName, year, month, onDetails, onClose }) => {
  useModalEffect(!!trainerId, onClose);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trainerId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setStudents([]);
    const q = { trainerId: String(trainerId), year: year || undefined, month: month || undefined, perPage: 500 };
    fetchClients(q, ctrl.signal)
      .then((res) => {
        const list = res?.items ?? res?.results ?? (Array.isArray(res) ? res : []);
        setStudents(Array.isArray(list) ? list : []);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [trainerId, year, month]);

  if (!trainerId) return null;

  const periodStr = [year, month ? MONTH_NAMES[Number(month)] : ''].filter(Boolean).join(' ');

  const content = (
    <div className="trainer-details-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="trainer-details-modal-title">
      <div className="trainer-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trainer-details-modal__header">
          <h2 id="trainer-details-modal-title" className="trainer-details-modal__title">
            Ученики: {trainerName || '—'}
          </h2>
          <button type="button" className="trainer-details-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {periodStr && <p className="trainer-details-modal__period">Период: {periodStr}</p>}

        {loading ? (
          <div className="trainer-details-modal__loading">
            <span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка учеников…</span>
          </div>
        ) : (
          <div className="trainer-details-modal__table-wrap">
            <table className="trainer-details-modal__table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Телефон</th>
                  <th>Вид спорта</th>
                  <th>Оплатили</th>
                  <th>Тип</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="trainer-details-modal__empty">
                      <EmptyState compact message="Нет учеников" />
                    </td>
                  </tr>
                ) : (
                  students.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        !isClientPaid(c)
                          ? 'trainer-details-modal__row trainer-details-modal__row--unpaid'
                          : c.clientType === 'one-time'
                            ? 'trainer-details-modal__row trainer-details-modal__row--one-time'
                            : c.clientType === 'individual'
                              ? 'trainer-details-modal__row trainer-details-modal__row--individual'
                              : 'trainer-details-modal__row'
                      }
                    >
                      <td>{c.fio || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.sportName ?? c.sport?.name ?? '—'}</td>
                      <td>{isClientPaid(c) ? 'Да' : 'Нет'}</td>
                      <td className={c.clientType === 'individual' ? 'trainer-details-modal__type-cell trainer-details-modal__type-cell--individual' : c.clientType === 'one-time' ? 'trainer-details-modal__type-cell trainer-details-modal__type-cell--one-time' : ''}>
                        {c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType === 'one-time' ? 'Разовый' : c.clientType || '—'}
                      </td>
                      <td>
                        <button type="button" className="trainer-details-modal__btn" onClick={() => onDetails?.(c)}>Подробнее</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="trainer-details-modal__footer">
          <button type="button" className="trainer-details-modal__btn trainer-details-modal__btn--cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerDetailsModal;
