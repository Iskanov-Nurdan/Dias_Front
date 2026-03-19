import React, { useState } from 'react';
import { useAuth } from '../../../../features/auth';
import { Loading, EmptyState, ErrorState, FilterBar, useToast } from '../../../../shared/ui';
import { useServerQuery } from '../../../../shared/lib';
import { getBatchesAwaitingOtk, getOtkHistory, acceptBatch } from '../../api';
import './OTKPage.scss';

const OTK_STATUSES = [
  { label: 'ОЖИДАЕТ', color: 'orange' },
  { label: '→', color: 'muted' },
  { label: 'ПРИНЯТО', color: 'green' },
  { label: '/', color: 'muted' },
  { label: 'БРАК', color: 'red' },
];

const formatDateTime = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};
const orderName = (b) => b.order_name || b.order_product || b.product_name || b.product?.name || b.product || b.recipe?.name || '—';
const errorToMessage = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  const code = data.code ? `[${data.code}] ` : '';
  const base = data.error || data.message || 'Ошибка';
  const details = data.details && typeof data.details === 'object'
    ? Object.entries(data.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
    : (typeof data.details === 'string' ? data.details : '');
  const missing = Array.isArray(data.missing) && data.missing.length
    ? data.missing.map((m) => {
      if (typeof m === 'object') {
        const name = m.component || m.raw_material || m.element || m.name || 'компонент';
        const req = m.required ?? m.need ?? '?';
        const avail = m.available ?? m.balance ?? 0;
        const unit = m.unit || '';
        return `${name}: нужно ${req} ${unit}, доступно ${avail} ${unit}`.trim();
      }
      return String(m);
    }).join('; ')
    : '';
  return [code + base, details, missing].filter(Boolean).join('. ');
};

const statusOtk = (b) => {
  const s = String(b.otk_status ?? b.status ?? '').toLowerCase();
  const defectQty = Number(b.otk_defect) || 0;
  if (s === 'accepted' || s === 'принято') return { label: defectQty > 0 ? 'Принято с браком' : 'Принято', color: 'green' };
  if (s === 'defect' || s === 'rejected' || s === 'брак') return { label: 'БРАК', color: 'red' };
  return { label: 'ОЖИДАЕТ', color: 'orange' };
};

const updateQuery = (setter) => (patch) => {
  setter((prev) => ({
    ...prev,
    ...patch,
    page: patch.page !== undefined ? patch.page : 1,
  }));
};

const Pagination = ({ meta, onChange }) => {
  const page = Number(meta?.page || 1);
  const totalPages = Number(meta?.total_pages || 1);
  if (totalPages <= 1) return null;
  return (
    <div className="otk-pagination">
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange({ page: page - 1 })} disabled={page <= 1}>
        Назад
      </button>
      <span>Страница {page} из {totalPages}</span>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange({ page: page + 1 })} disabled={page >= totalPages}>
        Вперёд
      </button>
    </div>
  );
};

const OTKPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('awaiting');
  const [acceptModalBatch, setAcceptModalBatch] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [awaitingQuery, setAwaitingQuery] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '',
  });
  const [historyQuery, setHistoryQuery] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '-date',
    otk_status: '',
  });

  const onAwaitingQueryChange = updateQuery(setAwaitingQuery);
  const onHistoryQueryChange = updateQuery(setHistoryQuery);

  const {
    items: awaitingList,
    meta: awaitingMeta,
    loading: loadingAwaiting,
    error: errorAwaiting,
    refetch: refetchAwaiting,
  } = useServerQuery(null, awaitingQuery, {
    enabled: activeTab === 'awaiting',
    fetcher: (queryState, signal) => getBatchesAwaitingOtk({ query: queryState, signal }),
  });

  const {
    items: historyList,
    meta: historyMeta,
    loading: loadingHistory,
    error: errorHistory,
    refetch: refetchHistory,
  } = useServerQuery(null, historyQuery, {
    enabled: activeTab === 'history',
    fetcher: (queryState, signal) => getOtkHistory({ query: queryState, signal }),
  });

  const refetchAll = () => {
    refetchAwaiting();
    refetchHistory();
  };

  const handleAcceptSubmit = async (data) => {
    if (!acceptModalBatch?.id) return;
    setSubmitError('');
    try {
      await acceptBatch(acceptModalBatch.id, {
        accepted: data.accepted,
        rejected: data.rejected,
        rejectReason: data.rejectReason,
        comment: data.comment,
        inspectorId: user?.id || null,
      });
      setAcceptModalBatch(null);
      refetchAll();
      toast.show('Результат проверки сохранён');
    } catch (err) {
      setSubmitError(errorToMessage(err));
    }
  };

  return (
    <div className="page page--otk">
      <div className="otk-statuses">
        <span className="otk-statuses__label">Статусы:</span>
        {OTK_STATUSES.map((st, i) => (
          <span
            key={i}
            className={`otk-statuses__chip otk-statuses__chip--${st.color}`}
          >
            {st.label}
          </span>
        ))}
      </div>


      <div className="otk-tabs">
        <button
          type="button"
          className={`otk-tabs__tab ${activeTab === 'awaiting' ? 'otk-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('awaiting')}
        >
          Ожидают
        </button>
        <button
          type="button"
          className={`otk-tabs__tab ${activeTab === 'history' ? 'otk-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История
        </button>
      </div>

      {activeTab === 'awaiting' && (
        <div className="otk-card">
          <h2 className="otk-card__title">Контроль качества — ожидает проверки</h2>
          <p className="otk-card__subtitle">Партии, требующие проверки ОТК</p>
          <FilterBar
            filters={[
              { key: 'search', type: 'search', placeholder: 'Поиск' },
              { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
                { value: 'date', label: 'Дата (возр.)' },
                { value: '-date', label: 'Дата (убыв.)' },
              ] },
            ]}
            queryState={awaitingQuery}
            onChange={onAwaitingQueryChange}
          />
          {loadingAwaiting && <Loading />}
          {errorAwaiting && <ErrorState error={errorAwaiting} onRetry={refetchAwaiting} />}
          {!loadingAwaiting && !errorAwaiting && awaitingList.length === 0 && (
            <EmptyState title="Нет партий, ожидающих проверки" />
          )}
          {!loadingAwaiting && !errorAwaiting && awaitingList.length > 0 && (
            <div className="otk-table otk-table--awaiting">
              <div className="otk-table__header">
                <span className="otk-table__th">ЗАКАЗ</span>
                <span className="otk-table__th">КОЛИЧЕСТВО</span>
                <span className="otk-table__th">ОПЕРАТОР</span>
                <span className="otk-table__th">ДАТА ПРОИЗВОДСТВА</span>
                <span className="otk-table__th otk-table__th--actions">ДЕЙСТВИЯ</span>
              </div>
              {awaitingList.map((b) => {
                const qty = b.quantity ?? b.released ?? 0;
                return (
                  <div key={b.id} className="otk-table__row">
                    <span>{orderName(b)}</span>
                    <span className="otk-table__qty-pill">{qty} шт</span>
                    <span>{b.operator_name || b.operator?.name || b.operator || b.assigned_to || '—'}</span>
                    <span>{formatDateTime(b.date || b.created_at)}</span>
                    <div className="otk-table__actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--sm otk-btn-check"
                        onClick={() => setAcceptModalBatch(b)}
                      >
                        <span className="otk-btn-check__icon">✓</span> Проверить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loadingAwaiting && !errorAwaiting && <Pagination meta={awaitingMeta} onChange={onAwaitingQueryChange} />}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="otk-card">
          <h2 className="otk-card__title">История контроля качества</h2>
          <p className="otk-card__subtitle">Проверенные партии</p>
          <FilterBar
            filters={[
              { key: 'search', type: 'search', placeholder: 'Поиск' },
              { key: 'otk_status', type: 'select', placeholder: 'Статус', options: [
                { value: 'accepted', label: 'Принято' },
                { value: 'rejected', label: 'Брак' },
              ] },
              { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
                { value: 'otk_checked_at', label: 'Проверка (возр.)' },
                { value: '-otk_checked_at', label: 'Проверка (убыв.)' },
              ] },
            ]}
            queryState={historyQuery}
            onChange={onHistoryQueryChange}
          />
          {loadingHistory && <Loading />}
          {errorHistory && <ErrorState error={errorHistory} onRetry={refetchHistory} />}
          {!loadingHistory && !errorHistory && historyList.length === 0 && (
            <EmptyState title="Нет записей в истории" />
          )}
          {!loadingHistory && !errorHistory && historyList.length > 0 && (
            <div className="otk-table otk-table--history">
              <div className="otk-table__header">
                <span className="otk-table__th">СТАТУС</span>
                <span className="otk-table__th">ЗАКАЗ</span>
                <span className="otk-table__th">ПРИНЯТО</span>
                <span className="otk-table__th">БРАК</span>
                <span className="otk-table__th">ПРИЧИНА БРАКА</span>
                <span className="otk-table__th">ИНСПЕКТОР ОТК</span>
                <span className="otk-table__th">ДАТА ПРОВЕРКИ</span>
                <span className="otk-table__th">КОММЕНТАРИЙ</span>
              </div>
              {historyList.map((b) => {
                const st = statusOtk(b);
                return (
                  <div key={b.id} className="otk-table__row">
                    <span className={`otk-table__status otk-table__status--${st.color}`}>
                      {st.label}
                    </span>
                    <span>{orderName(b)}</span>
                    <span className="otk-table__qty-pill otk-table__qty-pill--white">{b.otk_accepted ?? 0} шт</span>
                    <span className="otk-table__qty-pill otk-table__qty-pill--red">{b.otk_defect ?? 0} шт</span>
                    <span>{b.otk_defect_reason || '—'}</span>
                    <span>{b.otk_inspector || '—'}</span>
                    <span>{formatDateTime(b.otk_checked_at)}</span>
                    <span>{b.otk_comment || '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!loadingHistory && !errorHistory && <Pagination meta={historyMeta} onChange={onHistoryQueryChange} />}
        </div>
      )}

      {acceptModalBatch && (
        <AcceptModal
          key={acceptModalBatch.id}
          batch={acceptModalBatch}
          onSubmit={handleAcceptSubmit}
          onClose={() => { setAcceptModalBatch(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
    </div>
  );
};

const AcceptModal = ({ batch, onSubmit, onClose, error }) => {
  const produced = Number(batch?.quantity ?? batch?.released ?? 0) || 0;
  const [accepted, setAccepted] = useState(produced > 0 ? String(produced) : '');
  const [defect, setDefect] = useState('0');
  const [defectReason, setDefectReason] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const a = Number(accepted) || 0;
    const d = Number(defect) || 0;
    if (a + d <= 0) return;
    if (produced > 0 && a + d !== produced) return;
    if (d > 0 && !defectReason.trim()) return;
    onSubmit({
      accepted: a,
      rejected: d,
      rejectReason: defectReason.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  const defectQty = Number(defect) || 0;
  const defectReasonRequired = defectQty > 0;
  const acceptedQty = Number(accepted) || 0;
  const invalidTotal = produced > 0 && acceptedQty + defectQty !== produced;

  const handleAcceptedChange = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setAccepted(value);
      return;
    }
    if (produced > 0) {
      const safeAccepted = Math.min(n, produced);
      setAccepted(String(safeAccepted));
      const autoDefect = Math.max(produced - safeAccepted, 0);
      setDefect(String(autoDefect));
      return;
    }
    setAccepted(value);
  };

  const handleDefectChange = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setDefect(value);
      return;
    }
    if (produced > 0) {
      const safeDefect = Math.min(n, produced);
      setDefect(String(safeDefect));
      const autoAccepted = Math.max(produced - safeDefect, 0);
      setAccepted(String(autoAccepted));
      return;
    }
    setDefect(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Контроль качества</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <p className="otk-modal-subtitle">Проверка произведённой партии</p>
        <div className="otk-modal-readonly">
          <div className="otk-modal-readonly__row">
            <span className="otk-modal-readonly__label">Заказ:</span>
            <span>{orderName(batch)}</span>
          </div>
          <div className="otk-modal-readonly__row">
            <span className="otk-modal-readonly__label">Оператор:</span>
            <span>{batch?.operator_name || batch?.operator?.name || batch?.operator || '—'}</span>
          </div>
          <div className="otk-modal-readonly__row">
            <span className="otk-modal-readonly__label">Количество произведено:</span>
            <span>{produced} шт</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Принято (шт)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={accepted}
            onChange={(e) => handleAcceptedChange(e.target.value)}
          />
          <label>Брак (шт)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={defect}
            onChange={(e) => handleDefectChange(e.target.value)}
          />
          <label>Комментарий</label>
          <textarea
            className="otk-modal-textarea"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Примечания по качеству продукции"
            rows={2}
          />
          <label>Причина брака {defectReasonRequired && '*'}</label>
          <textarea
            className="otk-modal-textarea"
            value={defectReason}
            onChange={(e) => setDefectReason(e.target.value)}
            placeholder="Укажите причину брака (обязательно при наличии брака)"
            rows={2}
          />
          {error && <p className="modal__error">{error}</p>}
          {invalidTotal && (
            <p className="modal__error">
              Сумма «Принято + Брак» должна быть равна выпущенному количеству ({produced} шт).
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={invalidTotal}>Сохранить результат</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OTKPage;
