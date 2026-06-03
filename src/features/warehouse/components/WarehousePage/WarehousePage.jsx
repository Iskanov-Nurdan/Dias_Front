import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { parseApiListResponse } from '../../../../shared/lib/apiList';
import {
  EmptyState,
  ErrorState,
  Loading,
  ClientDateFilter,
  RecordDetailsModal,
  DetailFields,
  CompactList,
} from '../../../../shared/ui';
import { useOperationalRefetch, WS_WAREHOUSE } from '../../../../shared/realtime';
import { getGpStock, getWarehouseOperations } from '../../api/warehouseApi';
import './WarehousePage.scss';

const gpFmtIso = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const mapGpStockRowFromApi = (row) => {
  if (!row || typeof row !== 'object') return null;
  return {
    key: `${row.product_id ?? row.profile_id}-${row.blank_id ?? 'x'}`,
    productId: row.product_id ?? row.profile_id,
    productName: row.product_name ?? row.profile_name ?? '—',
    blankName: row.blank_name ?? '—',
    pieces: Number(row.pieces ?? row.available_pieces) || 0,
  };
};

const STOCK_COLUMNS = [{ key: 'line', label: 'Остаток', width: '1fr' }];

const aggregateStockByProduct = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = String(row.productId ?? row.productName);
    const prev = map.get(key);
    if (prev) {
      prev.pieces += row.pieces;
      prev.breakdown.push(row);
    } else {
      map.set(key, {
        key,
        productId: row.productId,
        productName: row.productName,
        pieces: row.pieces,
        breakdown: [row],
      });
    }
  });
  return Array.from(map.values()).sort((a, b) =>
    String(a.productName).localeCompare(String(b.productName), 'ru'),
  );
};

const operationKindLabel = (kind) => {
  const k = String(kind || '').toLowerCase();
  if (k === 'otk_account') return 'Приёмка ОТК';
  if (k === 'accept') return 'Приёмка';
  if (k === 'sale') return 'Продажа';
  if (k === 'return') return 'Возврат';
  if (k === 'defect') return 'Брак';
  return kind || '—';
};

const WarehouseStockPanel = () => {
  const [mainTab, setMainTab] = useState('stock');
  const [stock, setStock] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [detailRow, setDetailRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockRes, opsRes] = await Promise.all([
        getGpStock({ page: 1, page_size: 500 }),
        getWarehouseOperations({ page: 1, page_size: 200, ordering: '-created_at' }),
      ]);
      setStock(parseApiListResponse(stockRes.data).map(mapGpStockRowFromApi).filter(Boolean));
      const opsData = opsRes?.data;
      setOperations(Array.isArray(opsData?.items) ? opsData.items : parseApiListResponse(opsData));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useOperationalRefetch(WS_WAREHOUSE, load, true);

  const aggregatedStock = useMemo(() => aggregateStockByProduct(stock), [stock]);

  const filteredOps = useMemo(() => {
    if (!dateFilterIso) return operations;
    return operations.filter((op) =>
      matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(op, ['created_at', 'at', 'timestamp'])),
    );
  }, [operations, dateFilterIso]);

  return (
    <div className="warehouse-gp warehouse-gp--stock">
      <div className="warehouse-gp__main-tabs production-main-tabs" role="tablist" aria-label="Склад ГП">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'stock'}
          className={`production-main-tabs__btn${mainTab === 'stock' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('stock')}
        >
          Остатки
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

      <div className="warehouse-gp__toolbar">
        <ClientDateFilter
          value={dateFilterIso}
          onChange={setDateFilterIso}
          id="warehouse-gp-date-filter"
          className="warehouse-gp__date-filter"
        />
      </div>

      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={load} />}

      {!loading && !error && mainTab === 'stock' && (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">Готовая продукция</h2>
          {aggregatedStock.length === 0 ? (
            <EmptyState title="Склад пуст" description="Товар попадает сюда после учёта в ОТК." />
          ) : (
            <CompactList
              className="compact-list--warehouse-stock"
              columns={STOCK_COLUMNS}
              items={aggregatedStock}
              getRowKey={(row) => row.key}
              renderCell={(row, key) => {
                if (key === 'line') {
                  return `${row.productName} ${formatNumberForInput(row.pieces)} шт`;
                }
                return '—';
              }}
              detailsLabel="Подробнее"
              onDetails={(row) => setDetailRow(row)}
            />
          )}
        </section>
      )}

      {!loading && !error && mainTab === 'history' && (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">Движения склада</h2>
          {filteredOps.length === 0 ? (
            <EmptyState title="Записей нет" />
          ) : (
            <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
              <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Операция</th>
                    <th>Товар</th>
                    <th className="data-table__cell--num">Шт</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOps.map((op, idx) => (
                    <tr key={op.id ?? idx}>
                      <td className="data-table__cell--muted">
                        {gpFmtIso(op.created_at ?? op.at ?? op.timestamp)}
                      </td>
                      <td>{operationKindLabel(op.kind ?? op.operation_type ?? op.kind_label)}</td>
                      <td className="warehouse-gp__product">{op.product_name ?? op.profile_name ?? '—'}</td>
                      <td className="data-table__cell--num">
                        {op.pieces != null ? formatNumberForInput(op.pieces) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {detailRow ? (
        <RecordDetailsModal
          open
          onClose={() => setDetailRow(null)}
          title={detailRow.productName}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setDetailRow(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              ...(detailRow.breakdown?.length > 1
                ? detailRow.breakdown.map((part) => ({
                    label: part.blankName || 'Заготовка',
                    value: `${formatNumberForInput(part.pieces)} шт`,
                  }))
                : [{ label: 'Количество', value: `${formatNumberForInput(detailRow.pieces)} шт` }]),
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

const WarehousePage = () => (
  <div className="page page--warehouse commercial-page">
    <WarehouseStockPanel />
  </div>
);

export default WarehousePage;
