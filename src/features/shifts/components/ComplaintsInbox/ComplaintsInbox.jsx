import React, { useState, useEffect, useCallback } from 'react';
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

/** ShiftComplaintListSerializer: author { id, name, username } (username = email на бэке). */
const authorLabel = (c) => {
  const a = c.author;
  if (a && typeof a === 'object') {
    return a.name || a.username || a.email || (a.id != null ? `#${a.id}` : null) || '—';
  }
  return (
    c.author_name
    ?? c.created_by_name
    ?? c.user_name
    ?? c.created_by?.name
    ?? c.user?.name
    ?? c.user?.username
    ?? '—'
  );
};

const mentionsLabel = (c) => {
  const m = c.mentioned_users ?? c.mentions ?? c.mentioned ?? [];
  if (!Array.isArray(m) || !m.length) return null;
  return m
    .map((x) => {
      if (typeof x === 'object' && x !== null) {
        return x.name || x.username || x.email || (x.id != null ? `#${x.id}` : null);
      }
      return x;
    })
    .filter(Boolean)
    .join(', ');
};

const ComplaintsInbox = ({ className = '', reloadToken = 0 }) => {
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
        <button type="button" className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
          {loading ? 'Обновление…' : 'Обновить'}
        </button>
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
            const ment = mentionsLabel(c);
            return (
              <li key={c.id} className="complaints-inbox__item">
                <div className="complaints-inbox__meta">
                  <span className="complaints-inbox__time">{formatDateTime(c.created_at)}</span>
                  <span className="complaints-inbox__author">{authorLabel(c)}</span>
                </div>
                <p className="complaints-inbox__text">{complaintText(c)}</p>
                {c.shift_id != null && c.shift_id !== '' ? (
                  <p className="complaints-inbox__shift">Смена: №{c.shift_id}</p>
                ) : null}
                {ment ? (
                  <p className="complaints-inbox__mentions">
                    Упомянуты: {ment}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ComplaintsInbox;
