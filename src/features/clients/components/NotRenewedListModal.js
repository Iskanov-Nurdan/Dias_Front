import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserX } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState } from '../../../shared/ui';
import { fetchClientsNotRenewed } from '../api';
import './StatsUnpaidModal.scss';
import './NotRenewedListModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const NotRenewedListModal = ({ open, year, month, onClose, onOpenClient, onExtend }) => {
  useModalEffect(open, onClose);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setClients([]);
    fetchClientsNotRenewed({ year: year || undefined, month: month || undefined, perPage: 500 }, ctrl.signal)
      .then((res) => {
        const list = res?.items ?? res?.results ?? (Array.isArray(res) ? res : []);
        setClients(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setError('Ошибка загрузки');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, year, month]);

  if (!open) return null;

  const periodStr = [year, month ? MONTH_NAMES[Number(month)] : ''].filter(Boolean).join(' · ');

  const content = (
    <div className="sum__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="nrl-title">
      <div className="sum nrl__modal" onClick={(e) => e.stopPropagation()}>

        <div className="sum__header">
          <div className="sum__header-info">
            <div className="sum__header-sub">Не продлили · {periodStr}</div>
            <h2 id="nrl-title" className="sum__title">
              <span className="sum__title-icon"><UserX size={18} /></span>
              Не продлили — {loading ? '…' : clients.length}
            </h2>
          </div>
          <button type="button" className="sum__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="sum__body">
          {loading && (
            <div className="sum__loading">
              <span className="loading-inline">
                <span className="loading-inline__spinner" aria-hidden />
                Загрузка…
              </span>
            </div>
          )}
          {!loading && error && <p className="sum__error">{error}</p>}
          {!loading && !error && clients.length === 0 && (
            <EmptyState compact message="Все клиенты продлили абонемент" />
          )}
          {!loading && !error && clients.length > 0 && (
            <div className="sum__table-wrap">
              <table className="sum__table nrl__table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Тренер</th>
                    <th>Вид спорта</th>
                    <th>Тип</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="sum__fio">{c.fio || '—'}</td>
                      <td className="sum__muted">{c.trainerName ?? c.trainer?.name ?? '—'}</td>
                      <td className="sum__muted">{c.sportName ?? c.sport?.name ?? '—'}</td>
                      <td>
                        {c.clientType
                          ? (
                            <span className={`sum__type-badge sum__type-badge--${c.clientType}`}>
                              {c.clientType === 'individual' ? 'Индивид.'
                                : c.clientType === 'regular' ? 'Регуляр'
                                : c.clientType === 'one-time' ? 'Разовый'
                                : c.clientType}
                            </span>
                          )
                          : <span className="sum__muted">—</span>}
                      </td>
                      <td className="nrl__actions-cell">
                        <div className="nrl__actions-wrap">
                          {onOpenClient && (
                            <button
                              type="button"
                              className="sum__btn"
                              onClick={() => { onClose(); onOpenClient(c); }}
                            >
                              Подробнее
                            </button>
                          )}
                          {onExtend && (
                            <button
                              type="button"
                              className="sum__btn nrl__btn-extend"
                              onClick={() => { onClose(); onExtend(c); }}
                            >
                              Продлить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sum__footer">
          <button type="button" className="sum__btn sum__btn--cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default NotRenewedListModal;
