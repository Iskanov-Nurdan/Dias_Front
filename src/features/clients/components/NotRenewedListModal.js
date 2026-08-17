import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserX, Eye, RefreshCw } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import { fetchAllClientsNotRenewed } from '../api';
import './StatsUnpaidModal.scss';
import './NotRenewedListModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const NotRenewedListModal = ({ open, year, month, onClose, onOpenClient, onExtend }) => {
  useModalEffect(open, onClose);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setClients([]);
    fetchAllClientsNotRenewed({ year: year || undefined, month: month || undefined }, ctrl.signal)
      .then((list) => {
        setClients(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setError('Ошибка загрузки');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, year, month, reloadSeq]);

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
              <Spinner />
            </div>
          )}
          {!loading && error && <ErrorState compact message={error} onRetry={() => setReloadSeq((s) => s + 1)} />}
          {!loading && !error && clients.length === 0 && (
            <EmptyState compact message="Все клиенты продлили абонемент" />
          )}
          {!loading && !error && clients.length > 0 && (
            <div className="ui-list__table-wrap sum__table-wrap">
              <table className="ui-list__table sum__table nrl__table">
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
                      <td>
                        <div className="ui-list__name-cell">
                          <span className="ui-avatar">{getInitials(c.fio)}</span>
                          <span className="ui-list__title">{c.fio || '—'}</span>
                        </div>
                      </td>
                      <td className="ui-list__muted">{c.trainerName ?? c.trainer?.name ?? '—'}</td>
                      <td className="ui-list__muted">{c.sportName ?? c.sport?.name ?? '—'}</td>
                      <td>
                        {c.clientType
                          ? (
                            <span className={`ui-pill sum__type-badge sum__type-badge--${c.clientType}`}>
                              {c.clientType === 'individual' ? 'Индивид.'
                                : c.clientType === 'regular' ? 'Регуляр'
                                : c.clientType === 'one-time' ? 'Разовый'
                                : c.clientType}
                            </span>
                          )
                          : <span className="ui-list__muted">—</span>}
                      </td>
                      <td className="nrl__actions-cell">
                        <div className="nrl__actions-wrap">
                          {onOpenClient && (
                            <button
                              type="button"
                              className="ui-list-btn"
                              onClick={() => { onClose(); onOpenClient(c); }}
                            >
                              <Eye size={13} /> Подробнее
                            </button>
                          )}
                          {onExtend && (
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--primary"
                              onClick={() => { onClose(); onExtend(c); }}
                            >
                              <RefreshCw size={13} /> Продлить
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
          <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default NotRenewedListModal;
