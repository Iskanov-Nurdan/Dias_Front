import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserX, Eye } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import { fetchClients } from '../api';
import './StatsUnpaidModal.scss';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const StatsUnpaidModal = ({ open, year, month, onClose, onOpenClient }) => {
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
    fetchClients({ paid: false, year: year || undefined, month: month || undefined, perPage: 500 }, ctrl.signal)
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
  }, [open, year, month, reloadSeq]);

  if (!open) return null;

  const periodStr = [year, month ? MONTH_NAMES[Number(month)] : ''].filter(Boolean).join(' · ');

  const content = (
    <div className="sum__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sum-title">
      <div className="sum" onClick={(e) => e.stopPropagation()}>

        <div className="sum__header">
          <span className="sum__header-icon"><UserX size={18} /></span>
          <div className="sum__header-info">
            <div className="sum__header-sub">Статистика · {periodStr}</div>
            <h2 id="sum-title" className="sum__title">
              Не оплатили — {loading ? '…' : clients.length}
            </h2>
          </div>
          <button type="button" className="sum__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        <div className="sum__body">
          {loading && (
            <div className="sum__loading">
              <Spinner />
            </div>
          )}
          {!loading && error && <ErrorState compact message={error} onRetry={() => setReloadSeq((s) => s + 1)} />}
          {!loading && !error && clients.length === 0 && (
            <EmptyState compact message="Все клиенты оплатили за выбранный период" />
          )}
          {!loading && !error && clients.length > 0 && (
            <div className="ui-list__table-wrap sum__table-wrap">
              <table className="ui-list__table sum__table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Телефон</th>
                    <th>Тренер</th>
                    <th>Вид спорта</th>
                    <th>Тип</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      className={onOpenClient ? 'sum__row--clickable' : undefined}
                      onClick={onOpenClient ? () => { onClose(); onOpenClient(c); } : undefined}
                      role={onOpenClient ? 'button' : undefined}
                      tabIndex={onOpenClient ? 0 : undefined}
                      onKeyDown={
                        onOpenClient
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onClose();
                                onOpenClient(c);
                              }
                            }
                          : undefined
                      }
                    >
                      <td>
                        <div className="ui-list__name-cell">
                          <span className="ui-avatar">{getInitials(c.fio)}</span>
                          <span className="ui-list__title">{c.fio || '—'}</span>
                        </div>
                      </td>
                      <td className="ui-list__muted">{c.phone || '—'}</td>
                      <td className="ui-list__muted">{c.trainerName ?? c.trainer?.name ?? '—'}</td>
                      <td className="ui-list__muted">{c.sportName ?? c.sport?.name ?? '—'}</td>
                      <td>
                        {c.clientType
                          ? <span className={`ui-pill sum__type-badge sum__type-badge--${c.clientType}`}>{
                              c.clientType === 'individual' ? 'Индивид.'
                              : c.clientType === 'regular' ? 'Регуляр'
                              : c.clientType === 'one-time' ? 'Разовый'
                              : c.clientType
                            }</span>
                          : <span className="ui-list__muted">—</span>}
                      </td>
                      <td>
                        {onOpenClient && (
                          <button
                            type="button"
                            className="ui-list-btn"
                            onClick={(e) => { e.stopPropagation(); onClose(); onOpenClient(c); }}
                          >
                            <Eye size={13} /> Подробнее
                          </button>
                        )}
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

export default StatsUnpaidModal;
