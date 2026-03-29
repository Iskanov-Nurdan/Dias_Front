import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../features/auth';
import { useDiscardOnClose, useDirtyFromBaseline, useIsMobile } from '../../../../shared/hooks';
import { Loading, EmptyState, ErrorState, FilterBar, FiltersModal, useToast, DecimalInput, ConfirmModal } from '../../../../shared/ui';
import {
  useServerQuery,
  formatNumberForInput,
  formatQuantityDisplay,
  parseLocaleNumber,
  otkResultStatusRu,
  recipeOutputUnitKindRu,
} from '../../../../shared/lib';
import { getBatchesAwaitingOtk, getOtkHistory, acceptBatch } from '../../api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './OTKPage.scss';

const formatDateTime = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};
const orderName = (b) => b.order_name || b.order_product || b.product_name || b.product?.name || b.product || b.recipe?.name || '—';

const releasedQty = (b) => b.quantity ?? b.released ?? b.produced ?? 0;

/** Подсказка: GET /api/otk/pending/ — recipe_name, recipe_output_quantity (норма). */
const recipeContextHint = (b) => {
  const rname = b.recipe_name || b.recipe?.recipe || b.recipe?.name;
  const ro =
    b.recipe_output_quantity ??
    b.recipe_expected_qty ??
    b.expected_quantity ??
    b.recipe?.output_quantity;
  const ukindRaw = b.recipe_output_unit_kind;
  const ukind = ukindRaw ? `, ед. нормы: ${recipeOutputUnitKindRu(ukindRaw) || ukindRaw}` : '';
  if (ro != null && ro !== '') {
    return rname
      ? `Норма по рецепту «${rname}»: ${ro}${ukind}`
      : `Норма по рецепту (справочно): ${ro}${ukind}`;
  }
  if (rname) return `Рецептура: ${rname}. Габариты — при открытии смены на линии.`;
  return 'Объём партии — по данным выпуска; габариты линии — в смене.';
};
const errorToMessage = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
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
  let msg = [base, details, missing].filter(Boolean).join('. ');
  if (/otk_accepted|otk_defect/i.test(msg)) {
    msg = 'Не удалось сохранить. Укажите «Принято» и «Брак» (брак может быть 0).';
  }
  return msg;
};

const statusOtk = (b) => {
  const { label, tone } = otkResultStatusRu(b);
  const display = b.otk_status_display != null && String(b.otk_status_display).trim() !== ''
    ? String(b.otk_status_display).trim()
    : label;
  const color = tone === 'green' ? 'green' : tone === 'red' ? 'red' : tone === 'amber' ? 'amber' : 'orange';
  return { label: display, color };
};

const shiftParamsLine = (b) => {
  const h = b.shift_height ?? b.height ?? b.line_height;
  const w = b.shift_width ?? b.width ?? b.line_width;
  const a = b.shift_angle_deg ?? b.angle_deg ?? b.line_angle_deg;
  if ((h == null || h === '') && (w == null || w === '') && (a == null || a === '')) return '—';
  const deg = a != null && a !== '' ? `${a}°` : '—';
  return `${h ?? '—'} × ${w ?? '—'} × ${deg}`;
};

const lineLabel = (b) =>
  b.line_name || b.line?.name || b.production_line || b.line || '—';

const updateQuery = (setter) => (patch) => {
  setter((prev) => ({
    ...prev,
    ...patch,
    page: patch.page !== undefined ? patch.page : 1,
  }));
};

const OTK_AWAITING_MODAL_FILTERS = [
  {
    key: 'ordering',
    type: 'ordering',
    placeholder: 'Сортировка',
    options: [
      { value: 'date', label: 'Дата (возр.)' },
      { value: '-date', label: 'Дата (убыв.)' },
    ],
  },
];

const OTK_HISTORY_MODAL_FILTERS = [
  {
    key: 'otk_status',
    type: 'select',
    placeholder: 'Статус',
    options: [
      { value: 'accepted', label: 'Принято' },
      { value: 'rejected', label: 'Забраковано' },
    ],
  },
  {
    key: 'ordering',
    type: 'ordering',
    placeholder: 'Сортировка',
    options: [
      { value: 'otk_checked_at', label: 'Проверка (возр.)' },
      { value: '-otk_checked_at', label: 'Проверка (убыв.)' },
    ],
  },
];

const Pagination = ({ meta, onChange }) => {
  const page = Number(meta?.page || 1);
  const totalPages = Number(meta?.total_pages ?? meta?.totalPages ?? 1);
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

const HistoryDetailModal = ({ batch, onClose }) => {
  if (!batch) return null;
  const st = statusOtk(batch);
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--wide otk-history-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Запись ОТК №{batch.id}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="modal__body otk-history-detail-modal__body">
          <div className="otk-modal-summary">
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Статус</span>
              <span className="otk-modal-summary__value">
                <span className={`otk-table__status otk-table__status--${st.color}`}>{st.label}</span>
              </span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Задание / продукт</span>
              <span className="otk-modal-summary__value">{orderName(batch)}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Принято</span>
              <span className="otk-modal-summary__value">{batch.otk_accepted ?? 0} шт</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Брак</span>
              <span className="otk-modal-summary__value">{batch.otk_defect ?? 0} шт</span>
            </div>
            <div className="otk-modal-summary__item otk-modal-summary__item--span-row">
              <span className="otk-modal-summary__label">Причина</span>
              <span className="otk-modal-summary__value">{batch.otk_defect_reason || '—'}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Инспектор</span>
              <span className="otk-modal-summary__value">{batch.otk_inspector || '—'}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Проверка</span>
              <span className="otk-modal-summary__value otk-history-detail-modal__mono">{formatDateTime(batch.otk_checked_at)}</span>
            </div>
            <div className="otk-modal-summary__item otk-modal-summary__item--span-row">
              <span className="otk-modal-summary__label">Комментарий</span>
              <span className="otk-modal-summary__value">{batch.otk_comment || '—'}</span>
            </div>
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const OTKPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [otkFiltersOpen, setOtkFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('awaiting');
  const [acceptModalBatch, setAcceptModalBatch] = useState(null);
  const [historyDetailBatch, setHistoryDetailBatch] = useState(null);
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

  useEffect(() => {
    if (activeTab !== 'history') setHistoryDetailBatch(null);
  }, [activeTab]);

  useEffect(() => {
    setOtkFiltersOpen(false);
  }, [activeTab]);

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

  const refetchAll = useCallback(() => {
    refetchAwaiting();
    refetchHistory();
  }, [refetchAwaiting, refetchHistory]);

  useOperationalRefetch(['production_batch', 'recipe_run'], refetchAll, true);

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
          <h2 className="otk-card__title">Ожидают проверки</h2>
          {isMobile ? (
            <>
              <div className="otk-filters-mobile">
                <input
                  type="search"
                  className="ds-toolbar__search ds-toolbar__search--full"
                  placeholder="Поиск"
                  value={awaitingQuery.search}
                  onChange={(e) => onAwaitingQueryChange({ search: e.target.value })}
                />
                <button type="button" className="btn btn--secondary" onClick={() => setOtkFiltersOpen(true)}>
                  Фильтры
                </button>
              </div>
              <FiltersModal
                open={otkFiltersOpen}
                onClose={() => setOtkFiltersOpen(false)}
                onReset={() => onAwaitingQueryChange({ ordering: '' })}
                title="Сортировка"
              >
                <FilterBar
                  stack
                  filters={OTK_AWAITING_MODAL_FILTERS}
                  queryState={awaitingQuery}
                  onChange={onAwaitingQueryChange}
                />
              </FiltersModal>
            </>
          ) : (
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
          )}
          {loadingAwaiting && <Loading />}
          {errorAwaiting && <ErrorState error={errorAwaiting} onRetry={refetchAwaiting} />}
          {!loadingAwaiting && !errorAwaiting && awaitingList.length === 0 && (
            <EmptyState title="Нет партий на проверку" />
          )}
          {!loadingAwaiting && !errorAwaiting && awaitingList.length > 0 && (
            <div className="otk-table otk-table--awaiting">
              <div className="otk-table__header">
                <span className="otk-table__th otk-table__th--id">№ ОТК</span>
                <span className="otk-table__th">Продукт</span>
                <span className="otk-table__th">Линия</span>
                <span className="otk-table__th">Выпуск</span>
                <span className="otk-table__th">Размеры</span>
                <span className="otk-table__th">Оператор</span>
                <span className="otk-table__th">Дата</span>
                <span className="otk-table__th otk-table__th--actions" />
              </div>
              {awaitingList.map((b) => {
                const qty = releasedQty(b);
                return (
                  <div key={b.id} className="otk-table__row">
                    <span className="otk-table__batch-id" title="Номер партии в ОТК">#{b.id}</span>
                    <span>{orderName(b)}</span>
                    <span>{lineLabel(b)}</span>
                    <span className="otk-table__qty-pill" title={recipeContextHint(b)}>{qty} шт</span>
                    <span>{shiftParamsLine(b)}</span>
                    <span>{b.operator_name || b.operator?.name || b.operator || b.assigned_to || '—'}</span>
                    <span>{formatDateTime(b.date || b.created_at)}</span>
                    <div className="otk-table__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm otk-btn-check"
                        onClick={() => setAcceptModalBatch(b)}
                      >
                        Проверить
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
          <h2 className="otk-card__title">История</h2>
          {isMobile ? (
            <>
              <div className="otk-filters-mobile">
                <input
                  type="search"
                  className="ds-toolbar__search ds-toolbar__search--full"
                  placeholder="Поиск"
                  value={historyQuery.search}
                  onChange={(e) => onHistoryQueryChange({ search: e.target.value })}
                />
                <button type="button" className="btn btn--secondary" onClick={() => setOtkFiltersOpen(true)}>
                  Фильтры
                </button>
              </div>
              <FiltersModal
                open={otkFiltersOpen}
                onClose={() => setOtkFiltersOpen(false)}
                onReset={() => onHistoryQueryChange({ otk_status: '', ordering: '' })}
                title="Фильтры"
              >
                <FilterBar
                  stack
                  filters={OTK_HISTORY_MODAL_FILTERS}
                  queryState={historyQuery}
                  onChange={onHistoryQueryChange}
                />
              </FiltersModal>
            </>
          ) : (
            <FilterBar
              filters={[
                { key: 'search', type: 'search', placeholder: 'Поиск' },
                { key: 'otk_status', type: 'select', placeholder: 'Статус', options: [
                  { value: 'accepted', label: 'Принято' },
                  { value: 'rejected', label: 'Забраковано' },
                ] },
                { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
                  { value: 'otk_checked_at', label: 'Проверка (возр.)' },
                  { value: '-otk_checked_at', label: 'Проверка (убыв.)' },
                ] },
              ]}
              queryState={historyQuery}
              onChange={onHistoryQueryChange}
            />
          )}
          {loadingHistory && <Loading />}
          {errorHistory && <ErrorState error={errorHistory} onRetry={refetchHistory} />}
          {!loadingHistory && !errorHistory && historyList.length === 0 && (
            <EmptyState title="Нет записей в истории" />
          )}
          {!loadingHistory && !errorHistory && historyList.length > 0 && (
            <div className="otk-table otk-table--history">
              <div className="otk-table__header">
                <span className="otk-table__th">Статус</span>
                <span className="otk-table__th otk-table__th--id">№ ОТК</span>
                <span className="otk-table__th">Задание / продукт</span>
                <span className="otk-table__th">Принято</span>
                <span className="otk-table__th">Брак</span>
                <span className="otk-table__th">Комментарий</span>
              </div>
              {historyList.map((b) => {
                const st = statusOtk(b);
                return (
                  <div
                    key={b.id}
                    className="otk-table__row otk-table__row--clickable"
                    onClick={() => setHistoryDetailBatch(b)}
                    onKeyDown={(e) => e.key === 'Enter' && setHistoryDetailBatch(b)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={`otk-table__status otk-table__status--${st.color}`}>
                      {st.label}
                    </span>
                    <span className="otk-table__batch-id" title="Номер партии в ОТК">#{b.id}</span>
                    <span>{orderName(b)}</span>
                    <span className="otk-table__qty-pill otk-table__qty-pill--white">{b.otk_accepted ?? 0} шт</span>
                    <span className="otk-table__qty-pill otk-table__qty-pill--red">{b.otk_defect ?? 0} шт</span>
                    <span>{b.otk_comment || '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!loadingHistory && !errorHistory && <Pagination meta={historyMeta} onChange={onHistoryQueryChange} />}
        </div>
      )}

      {historyDetailBatch && (
        <HistoryDetailModal batch={historyDetailBatch} onClose={() => setHistoryDetailBatch(null)} />
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
  const produced = Number(releasedQty(batch)) || 0;
  const [accepted, setAccepted] = useState(produced > 0 ? formatNumberForInput(produced) : '');
  const [defect, setDefect] = useState('0');
  const [defectReason, setDefectReason] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const a = Math.max(0, Math.floor(parseLocaleNumber(accepted) || 0));
    const d = Math.max(0, Math.floor(parseLocaleNumber(defect) || 0));
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

  const defectQty = Math.max(0, Math.floor(parseLocaleNumber(defect) || 0));
  const defectReasonRequired = defectQty > 0;
  const acceptedQty = Math.max(0, Math.floor(parseLocaleNumber(accepted) || 0));
  const invalidTotal = produced > 0 && acceptedQty + defectQty !== produced;

  const handleAcceptedChange = (value) => {
    const n = parseLocaleNumber(value);
    if (value === '' || value === '-' || !Number.isFinite(n) || n < 0) {
      setAccepted(value);
      return;
    }
    if (produced > 0) {
      const safeAccepted = Math.min(Math.floor(n), produced);
      setAccepted(formatNumberForInput(safeAccepted));
      const autoDefect = Math.max(produced - safeAccepted, 0);
      setDefect(formatNumberForInput(autoDefect));
      return;
    }
    setAccepted(value);
  };

  const handleDefectChange = (value) => {
    const n = parseLocaleNumber(value);
    if (value === '' || value === '-' || !Number.isFinite(n) || n < 0) {
      setDefect(value);
      return;
    }
    if (produced > 0) {
      const safeDefect = Math.min(Math.floor(n), produced);
      setDefect(formatNumberForInput(safeDefect));
      const autoAccepted = Math.max(produced - safeDefect, 0);
      setAccepted(formatNumberForInput(autoAccepted));
      return;
    }
    setDefect(value);
  };

  const isDirty = useDirtyFromBaseline(String(batch?.id ?? ''), false, {
    accepted: String(accepted ?? '').trim(),
    defect: String(defect ?? '').trim(),
    defectReason: defectReason.trim(),
    comment: comment.trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide otk-accept-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head otk-accept-modal__head">
          <h3>Проверка партии</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form className="otk-accept-form" onSubmit={handleSubmit}>
          <div className="otk-modal-summary">
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Продукт</span>
              <span className="otk-modal-summary__value">{orderName(batch)}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Линия</span>
              <span className="otk-modal-summary__value">{lineLabel(batch)}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Размеры</span>
              <span className="otk-modal-summary__value">{shiftParamsLine(batch)}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Оператор</span>
              <span className="otk-modal-summary__value">{batch?.operator_name || batch?.operator?.name || batch?.operator || '—'}</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">К проверке, шт</span>
              <span className="otk-modal-summary__value">{formatQuantityDisplay(produced)}</span>
            </div>
          </div>
          <div className="otk-accept-form__row">
            <div className="otk-accept-form__field">
              <label htmlFor={`otk-acc-${batch.id}`}>Принято, шт</label>
              <DecimalInput
                id={`otk-acc-${batch.id}`}
                min={0}
                max={produced > 0 ? produced : undefined}
                value={accepted}
                onChange={handleAcceptedChange}
              />
            </div>
            <div className="otk-accept-form__field">
              <label htmlFor={`otk-def-${batch.id}`}>Брак, шт</label>
              <DecimalInput
                id={`otk-def-${batch.id}`}
                min={0}
                max={produced > 0 ? produced : undefined}
                value={defect}
                onChange={handleDefectChange}
              />
            </div>
          </div>
          <div className="otk-accept-form__row">
            <div className="otk-accept-form__field">
              <label htmlFor={`otk-cm-${batch.id}`}>Комментарий</label>
              <input
                id={`otk-cm-${batch.id}`}
                type="text"
                className="otk-accept-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="необязательно"
                autoComplete="off"
              />
            </div>
            <div className="otk-accept-form__field">
              <label htmlFor={`otk-rs-${batch.id}`}>
                Причина брака
                {defectReasonRequired ? ' *' : ''}
              </label>
              <input
                id={`otk-rs-${batch.id}`}
                type="text"
                className="otk-accept-input"
                value={defectReason}
                onChange={(e) => setDefectReason(e.target.value)}
                placeholder={defectReasonRequired ? 'обязательно при браке' : 'при браке'}
                autoComplete="off"
              />
            </div>
          </div>
          {error && <p className="modal__error otk-accept-form__error">{error}</p>}
          {invalidTotal && (
            <p className="modal__error otk-accept-form__error">
              Сумма принято + брак должна быть {formatQuantityDisplay(produced)} шт
            </p>
          )}
          <div className="modal__actions otk-accept-form__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={invalidTotal}>Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OTKPage;
