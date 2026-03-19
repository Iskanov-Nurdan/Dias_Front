import React, { useState, useCallback, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import {
  createLine,
  updateLine,
  deleteLine,
  openShift,
  closeShift,
} from '../../api/linesApi';
import { apiClient } from '../../../../shared/api';
import './LinesPage.scss';

const LinesPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('line');
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '',
  });
  const [lineModal, setLineModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyLineId, setHistoryLineId] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items: lines, meta, loading, error, refetch } = useServerQuery(
    'lines/',
    activeTab === 'line' ? queryState : { page_size: 100 },
    { enabled: activeTab === 'line' || activeTab === 'history' }
  );

  const [linesWithStatus, setLinesWithStatus] = useState([]);
  const [linesWithStatusLoading, setLinesWithStatusLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'opening') return;
    const load = async () => {
      setLinesWithStatusLoading(true);
      try {
        const res = await apiClient.get('lines/', { params: { page_size: 100 } });
        const list = res.data?.items || [];
        const withStatus = await Promise.all(
          list.map(async (line) => {
            try {
              const h = await apiClient.get(`lines/${line.id}/history/`);
              const items = h.data?.items || [];
              const last = items[0];
              return {
                ...line,
                lastEvent: last,
                isOpen: last?.action === 'open',
              };
            } catch {
              return { ...line, lastEvent: null, isOpen: false };
            }
          })
        );
        setLinesWithStatus(withStatus);
      } catch {
        setLinesWithStatus([]);
      } finally {
        setLinesWithStatusLoading(false);
      }
    };
    load();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'history' || !historyLineId) {
      setHistoryItems([]);
      return;
    }
    const load = async () => {
      setHistoryLoading(true);
      try {
        const res = await apiClient.get(`lines/${historyLineId}/history/`);
        setHistoryItems(res.data?.items || []);
      } catch {
        setHistoryItems([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    load();
  }, [activeTab, historyLineId]);

  const handleFilterChange = useCallback((patch) => {
    setQueryState((prev) => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setQueryState((prev) => ({ ...prev, page }));
  }, []);

  const handleLineSubmit = async (data) => {
    setSubmitError('');
    try {
      if (lineModal?.id) {
        await updateLine(lineModal.id, data);
      } else {
        await createLine(data);
      }
      setLineModal(null);
      refetch();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await deleteLine(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const [openCloseTarget, setOpenCloseTarget] = useState(null);

  const handleOpenCloseConfirm = async () => {
    if (!openCloseTarget) return;
    const { lineId, isOpen } = openCloseTarget;
    setSubmitError('');
    try {
      if (isOpen) {
        await closeShift(lineId);
      } else {
        await openShift(lineId);
      }
      setOpenCloseTarget(null);
      setLinesWithStatus((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? {
                ...l,
                isOpen: !isOpen,
                lastEvent: {
                  action: isOpen ? 'close' : 'open',
                  date: new Date().toISOString().slice(0, 10),
                  time: new Date().toTimeString().slice(0, 5),
                },
              }
            : l
        )
      );
      toast.show('Успешно');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '—';
    const t = timeStr ? ` ${timeStr}` : '';
    return `${dateStr}${t}`;
  };

  return (
    <div className="page page--lines">
      <div className="lines-tabs">
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'line' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('line')}
        >
          Линия
        </button>
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'opening' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('opening')}
        >
          Открытие
        </button>
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'history' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История
        </button>
      </div>

      {activeTab === 'line' && (
        <div className="lines-card">
          <div className="lines-card__head">
            <h2 className="lines-card__title">Линии</h2>
            <div className="lines-card__actions">
              <input
                type="text"
                className="lines-card__search"
                placeholder="Поиск по названию..."
                value={queryState.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setLineModal({})}
              >
                Создать
              </button>
            </div>
          </div>
          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && (
            <>
              {lines.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="lines-table">
                  <div className="lines-table__header">
                    <span className="lines-table__th">НАЗВАНИЕ</span>
                    <span className="lines-table__th lines-table__th--actions">ДЕЙСТВИЯ</span>
                  </div>
                  {lines.map((line) => (
                    <div key={line.id} className="lines-table__row">
                      <span className="lines-table__name">{line.name}</span>
                      <div className="lines-table__actions">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => setLineModal(line)}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => setDeleteTarget({ id: line.id, name: line.name })}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {meta && meta.total_pages > 1 && (
                <div className="lines-card__pagination">
                  <button type="button" className="btn btn--sm" onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page <= 1}>←</button>
                  <span>Страница {meta.page} из {meta.total_pages}</span>
                  <button type="button" className="btn btn--sm" onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page >= meta.total_pages}>→</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'opening' && (
        <div className="lines-card">
          <h2 className="lines-card__title">Открытие / закрытие линии</h2>
          {linesWithStatusLoading && <Loading />}
          {!linesWithStatusLoading && (
            <>
              {linesWithStatus.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="lines-table lines-table--opening">
                  <div className="lines-table__header">
                    <span className="lines-table__th">ЛИНИЯ</span>
                    <span className="lines-table__th">СТАТУС</span>
                    <span className="lines-table__th">ПОСЛЕДНЕЕ ОТКРЫТИЕ</span>
                    <span className="lines-table__th">ПОСЛЕДНЕЕ ЗАКРЫТИЕ</span>
                    <span className="lines-table__th lines-table__th--actions">ДЕЙСТВИЯ</span>
                  </div>
                  {linesWithStatus.map((l) => (
                      <div key={l.id} className="lines-table__row">
                        <span className="lines-table__name">{l.name}</span>
                        <span>
                          <span className={`lines-table__badge ${l.isOpen ? 'lines-table__badge--open' : 'lines-table__badge--closed'}`}>
                            {l.isOpen ? 'ОТКРЫТА' : 'ЗАКРЫТА'}
                          </span>
                        </span>
                        <span className="lines-table__date">
                          {l.lastEvent?.action === 'open'
                            ? formatDateTime(l.lastEvent?.date, l.lastEvent?.time)
                            : '—'}
                        </span>
                        <span className="lines-table__date">
                          {l.lastEvent?.action === 'close'
                            ? formatDateTime(l.lastEvent?.date, l.lastEvent?.time)
                            : '—'}
                        </span>
                        <div className="lines-table__actions">
                          {l.isOpen ? (
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => setOpenCloseTarget({ lineId: l.id, isOpen: true })}
                            >
                              Закрыть смену
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--open btn--sm"
                              onClick={() => setOpenCloseTarget({ lineId: l.id, isOpen: false })}
                            >
                              Открыть смену
                            </button>
                          )}
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </>
          )}
          {submitError && <p className="lines-card__error">{submitError}</p>}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="lines-card">
          <h2 className="lines-card__title">История</h2>
          <div className="lines-card__head">
            <label className="lines-card__label">
              Линия:
              <select
                className="lines-card__select"
                value={historyLineId || ''}
                onChange={(e) => setHistoryLineId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Выберите линию —</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          </div>
          {!historyLineId && <EmptyState title="Выберите линию" />}
          {historyLineId && historyLoading && <Loading />}
          {historyLineId && !historyLoading && (
            <>
              {historyItems.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="lines-table lines-table--history">
                  <div className="lines-table__header">
                    <span className="lines-table__th">ДАТА И ВРЕМЯ</span>
                    <span className="lines-table__th">ЛИНИЯ</span>
                    <span className="lines-table__th">ДЕЙСТВИЕ</span>
                  </div>
                  {historyItems.map((h) => (
                    <div key={h.id} className="lines-table__row">
                      <span className="lines-table__date">
                        {formatDateTime(h.date, h.time)}
                      </span>
                      <span className="lines-table__name">{h.line_name || h.line}</span>
                      <span>
                        <span className={`lines-table__badge ${h.action === 'open' ? 'lines-table__badge--open' : 'lines-table__badge--closed'}`}>
                          {h.action === 'open' ? 'ОТКРЫТА' : 'ЗАКРЫТА'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {lineModal && (
        <LineFormModal
          line={lineModal?.id ? lineModal : null}
          onSubmit={handleLineSubmit}
          onClose={() => { setLineModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить линию?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!openCloseTarget}
        title={openCloseTarget?.isOpen ? 'Закрыть смену?' : 'Открыть смену?'}
        message={openCloseTarget ? (openCloseTarget.isOpen ? 'Линия будет закрыта. Выпуск запрещён.' : 'Линия будет открыта. Выпуск разрешён.') : ''}
        confirmText={openCloseTarget?.isOpen ? 'Закрыть' : 'Открыть'}
        onConfirm={handleOpenCloseConfirm}
        onCancel={() => setOpenCloseTarget(null)}
      />
    </div>
  );
};

const LineFormModal = ({ line, onSubmit, onClose, error }) => {
  const [name, setName] = useState(line?.name ?? '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{line ? 'Редактировать линию' : 'Создать линию'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name });
          }}
        >
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinesPage;
