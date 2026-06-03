import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [accountTarget, setAccountTarget] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);

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

  const visibleAccountHistory = useMemo(() => {
    if (!dateFilterIso) return accountHistory;
    return accountHistory.filter((row) =>
      matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(row, ['createdAt'])),
    );
  }, [accountHistory, dateFilterIso]);

  const openAccount = (entry) => {
    if (!entry?.canAccount) return;
    setAccountTarget(entry);
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
          Проверки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'history'}
          className={`production-main-tabs__btn${mainTab === 'history' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('history')}
        >
          История
        </button>
      </div>

      <div className="otk-card">
        <div className="otk-card__toolbar">
          <h2 className="otk-card__title">{mainTab === 'pool' ? 'Заготовки в ОТК' : 'Учёты ОТК'}</h2>
          {mainTab === 'history' ? (
            <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="otk-date-filter" />
          ) : null}
        </div>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={loadAll} />}

        {!loading && !error && mainTab === 'pool' && (
          poolWithKg.length === 0 ? (
            <EmptyState
              title="Нет заготовок в ОТК"
              description="Оформите выпуск в «Производство». Кнопка «Учесть» появится при остатке от 1 кг."
            />
          ) : (
            <CompactList
              columns={POOL_COLUMNS}
              items={poolWithKg}
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
              detailsLabel={(p) => (p.canAccount ? 'Учесть' : null)}
              showDetails={(p) => Boolean(p.canAccount)}
              onDetails={(p) => openAccount(p)}
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

      {accountTarget ? (
        <OtkAccountModal
          poolEntry={accountTarget}
          onClose={() => setAccountTarget(null)}
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
              { label: 'Дата', value: formatDateShort(historyDetail.createdAt) },
              { label: 'Заготовка', value: historyDetail.blankName || '—' },
              { label: 'Списано', value: `${formatNumberForInput(historyDetail.consumedKg)} кг` },
              { label: 'Брак', value: `${formatNumberForInput(historyDetail.defectKg)} кг` },
              { label: 'Оператор', value: historyDetail.operatorName || '—' },
              { label: 'Химик', value: historyDetail.chemistName || '—' },
              { label: 'Упаковщик', value: historyDetail.packerName || '—' },
              {
                label: 'Профили',
                value: (historyDetail.lines || [])
                  .map((ln) => `${ln.profileName}: ${ln.pieces} шт`)
                  .join('; ') || '—',
              },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

export default OTKPage;
