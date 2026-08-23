import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiClipboard, FiClock, FiPlus } from 'react-icons/fi';
import { useOperationalRefetch, WS_OTK } from '../../../../shared/realtime';
import {
  EmptyState,
  Loading,
  ErrorState,
  ClientDateFilter,
  CompactList,
  Badge,
  RecordDetailsModal,
  DetailFields,
  SearchInput,
} from '../../../../shared/ui';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { getOtkBlankPool, getOtkAccountHistory } from '../../api/otkWorkshopApi';
import OtkAccountModal from '../OtkAccountModal/OtkAccountModal';
import '../OtkAccountModal/OtkAccountModal.scss';
import './OTKPage.scss';

const formatDateShort = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const POOL_COLUMNS = [
  { key: 'blank', label: 'Заготовка', width: '1.4fr' },
  { key: 'kg', label: 'Кг в ОТК', width: '0.8fr', className: 'compact-list__cell--num' },
  { key: 'status', label: 'Статус', width: '0.9fr' },
];

const ACCOUNT_HISTORY_COLUMNS = [
  { key: 'date', label: 'Дата', width: '0.9fr' },
  { key: 'blank', label: 'Заготовка', width: '1.2fr' },
  { key: 'kg', label: 'Списано', width: '0.7fr', className: 'compact-list__cell--num' },
];

const OTKPage = () => {
  const [mainTab, setMainTab] = useState('pool');
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [pool, setPool] = useState([]);
  const [accountHistory, setAccountHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [poolSearch, setPoolSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolRows, historyRows] = await Promise.all([
        getOtkBlankPool(),
        getOtkAccountHistory({ page: 1, page_size: 200, ordering: '-created_at' }),
      ]);
      setPool(poolRows);
      setAccountHistory(historyRows);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useOperationalRefetch(WS_OTK, loadAll, true);

  const poolWithKg = useMemo(
    () => pool.filter((p) => p.remainingKg >= 0.001),
    [pool],
  );

  const visiblePool = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    if (!q) return poolWithKg;
    return poolWithKg.filter((p) => String(p.blankName || '').toLowerCase().includes(q));
  }, [poolWithKg, poolSearch]);

  const visibleAccountHistory = useMemo(() => {
    let list = accountHistory;
    if (dateFilterIso) {
      list = list.filter((row) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(row, ['createdAt'])));
    }
    const q = historySearch.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => String(row.blankName || '').toLowerCase().includes(q));
    }
    return list;
  }, [accountHistory, dateFilterIso, historySearch]);

  const canOpenAccount = poolWithKg.some((p) => p.canAccount);

  const formatShiftPeriod = (v) => {
    if (v === 'night') return 'Ночь';
    if (v === 'day') return 'День';
    return '—';
  };

  const formatPackers = (row) => {
    if (row.packerNames?.length) return row.packerNames.join(', ');
    if (row.packerName) return row.packerName;
    return '—';
  };

  return (
    <div className="page page--otk">
      <div className="otk-page__tabs production-main-tabs" role="tablist" aria-label="Разделы ОТК">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'pool'}
          className={`production-main-tabs__btn${mainTab === 'pool' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('pool')}
        >
          <FiClipboard aria-hidden size={16} strokeWidth={2} />
          Проверки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'history'}
          className={`production-main-tabs__btn${mainTab === 'history' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('history')}
        >
          <FiClock aria-hidden size={16} strokeWidth={2} />
          История
        </button>
      </div>

      <div className="otk-card">
        <div className="otk-card__toolbar ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            {mainTab === 'pool' ? (
              <SearchInput
                placeholder="Поиск по заготовке"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
              />
            ) : (
              <SearchInput
                placeholder="Поиск по заготовке"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            )}
          </div>
          <div className="ds-toolbar__end">
            {mainTab === 'pool' && canOpenAccount ? (
              <button type="button" className="btn btn--primary" onClick={() => setAccountModalOpen(true)}>
                <FiPlus aria-hidden size={16} strokeWidth={2} />
                Учесть
              </button>
            ) : null}
            {mainTab === 'history' ? (
              <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="otk-date-filter" />
            ) : null}
          </div>
        </div>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={loadAll} />}

        {!loading && !error && mainTab === 'pool' && (
          poolWithKg.length === 0 ? (
            <EmptyState
              title="Нет заготовок в ОТК"
              description="Оформите выпуск в «Производство». Кнопка «Учесть» появится при остатке от 1 кг."
            />
          ) : visiblePool.length === 0 ? (
            <EmptyState title="Ничего не найдено" />
          ) : (
            <CompactList
              columns={POOL_COLUMNS}
              items={visiblePool}
              getRowKey={(p) => p.blankId}
              rowClassName={(p) => (p.canAccount ? 'compact-list__row--attention' : '')}
              renderCell={(p, key) => {
                if (key === 'blank') return p.blankName || '—';
                if (key === 'kg') return `${formatNumberForInput(p.remainingKg)} кг`;
                if (key === 'status') {
                  return p.canAccount ? (
                    <Badge variant="warning">Нужен учёт</Badge>
                  ) : (
                    <span className="compact-list__status-muted">Использовано</span>
                  );
                }
                return '—';
              }}
            />
          )
        )}

        {!loading && !error && mainTab === 'history' && (
          visibleAccountHistory.length === 0 ? (
            <EmptyState title="Учётов пока нет" />
          ) : (
            <CompactList
              columns={ACCOUNT_HISTORY_COLUMNS}
              items={visibleAccountHistory}
              getRowKey={(s) => s.id}
              renderCell={(s, key) => {
                if (key === 'date') return formatDateShort(s.createdAt);
                if (key === 'blank') return s.blankName || '—';
                if (key === 'kg') return `${formatNumberForInput(s.consumedKg)} кг`;
                return '—';
              }}
              detailsLabel="Подробнее"
              onDetails={(s) => setHistoryDetail(s)}
            />
          )
        )}
      </div>

      {accountModalOpen ? (
        <OtkAccountModal
          pool={poolWithKg}
          onClose={() => setAccountModalOpen(false)}
          onSaved={loadAll}
        />
      ) : null}

      {historyDetail ? (
        <RecordDetailsModal
          open
          onClose={() => setHistoryDetail(null)}
          title={`Учёт: ${historyDetail.blankName || ''}`}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setHistoryDetail(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              { section: 'Учёт', label: 'Дата', value: formatDateShort(historyDetail.createdAt) },
              { section: 'Учёт', label: 'Заготовка', value: historyDetail.blankName || '—' },
              { section: 'Учёт', label: 'Списано', value: `${formatNumberForInput(historyDetail.consumedKg)} кг` },
              { section: 'Учёт', label: 'Брак', value: `${formatNumberForInput(historyDetail.defectKg)} кг` },
              { section: 'Смена', label: 'Смена', value: formatShiftPeriod(historyDetail.shiftPeriod) },
              { section: 'Смена', label: 'Оператор', value: historyDetail.operatorName || '—' },
              { section: 'Смена', label: 'Химик', value: historyDetail.chemistName || '—' },
              { section: 'Смена', label: 'Упаковщики', value: formatPackers(historyDetail) },
              {
                section: 'Профили',
                label: 'Профили',
                value: (historyDetail.lines || [])
                  .map((ln) => `${ln.profileName}: ${ln.pieces} шт`)
                  .join('; ') || '—',
                full: true,
              },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

export default OTKPage;
