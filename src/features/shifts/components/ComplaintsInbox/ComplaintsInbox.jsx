import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { getComplaints } from '../../api/shiftsApi';
import './ComplaintsInbox.scss';

const formatDateTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
};

const complaintText = (c) =>
  c.body ?? c.text ?? c.reason ?? c.content ?? c.message ?? '—';

/** Только имя; логин/email/id — не для общего списка жалоб. */
const authorLabel = (c) => {
  const a = c.author;
  if (a && typeof a === 'object') {
    const n = a.name != null ? String(a.name).trim() : '';
    if (n) return n;
    return 'Сотрудник';
  }
  const name =
    c.author_name
    ?? c.created_by_name
    ?? c.user_name
    ?? c.created_by?.name
    ?? c.user?.name;
  if (name != null && String(name).trim() !== '') return String(name).trim();
  return 'Сотрудник';
};

/** Дата смены для человека; внутренний shift_id не показываем. */
const shiftContextLine = (c) => {
  const sh = c.shift;
  if (sh && typeof sh === 'object') {
    const t = sh.opened_at || sh.started_at || sh.opened;
    if (t) return `Смена: ${formatDateTime(t)}`;
  }
  const t2 = c.shift_opened_at ?? c.shift_started_at;
  if (t2) return `Смена: ${formatDateTime(t2)}`;
  return null;
};

const ComplaintsInbox = ({ className = '', reloadToken = 0, onAddComplaint }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await getComplaints({ page: 1, page_size: 200 });
      const d = res.data;
      setItems(Array.isArray(d) ? d : (d.items ?? []));
    } catch (e) {
      setItems([]);
      if (e.response?.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  return (
    <div className={`complaints-inbox ${className}`.trim()}>
      <div className="complaints-inbox__top">
        <h2 className="complaints-inbox__title">Жалобы</h2>
        <div className="complaints-inbox__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            {loading ? 'Обновление…' : 'Обновить'}
          </button>
          {onAddComplaint ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={onAddComplaint}>
              <FiPlus aria-hidden size={16} strokeWidth={2} />
              Жалоба
            </button>
          ) : null}
        </div>
      </div>

      {forbidden ? (
        <div className="complaints-inbox__empty complaints-inbox__empty--warn">
          Нет доступа к разделу жалоб. Нужны права «Моя смена» или «Журнал смен» (или роль администратора).
        </div>
      ) : loading && !items.length ? (
        <div className="complaints-inbox__loading">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="complaints-inbox__empty">Жалоб пока нет</div>
      ) : (
        <ul className="complaints-inbox__list">
          {items.map((c) => {
            const shiftLine = shiftContextLine(c);
            return (
              <li key={c.id} className="complaints-inbox__item">
                <div className="complaints-inbox__meta">
                  <span className="complaints-inbox__time">{formatDateTime(c.created_at)}</span>
                  <span className="complaints-inbox__author">{authorLabel(c)}</span>
                </div>
                <p className="complaints-inbox__text">{complaintText(c)}</p>
                {shiftLine ? <p className="complaints-inbox__shift">{shiftLine}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ComplaintsInbox;
