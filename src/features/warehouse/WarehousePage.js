import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Boxes, History, Search } from 'lucide-react';
import { fetchGpStock, fetchWarehouseOperations } from './api';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useProductLine, PRODUCT_LINE } from '../../shared/hooks/useProductLine';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, ProductLineTabs, Subtabs } from '../../shared/ui';
import { WarehouseStockList, WarehouseStockDetailModal, WarehouseOperationsList } from './components';
import { FoamWarehouseTab } from '../foam/components';
import './WarehousePage.scss';

const TAB_STOCK = 'stock';
const TAB_OPERATIONS = 'operations';

const TABS = [
  { id: TAB_STOCK, label: 'Остатки', icon: Boxes },
  { id: TAB_OPERATIONS, label: 'История', icon: History },
];

const normalize = (s) => (s || '').trim().toLowerCase();

/** Сырой ответ /gp-stock/ — по товару и заготовке отдельно; сворачиваем в одну строку на товар. */
const aggregateStockByProduct = (rows) => {
  const byProduct = new Map();
  for (const row of rows) {
    const productId = row.product_id ?? row.profile_id;
    const productName = row.product_name ?? row.profile_name ?? '—';
    const blankName = row.blank_name ?? '—';
    const pieces = Number(row.pieces ?? row.available_pieces) || 0;
    if (!byProduct.has(productId)) {
      byProduct.set(productId, { productId, productName, pieces: 0, breakdown: [] });
    }
    const entry = byProduct.get(productId);
    entry.pieces += pieces;
    entry.breakdown.push({ blankName, pieces });
  }
  return [...byProduct.values()];
};

const WarehousePage = () => {
  const [line, setLine] = useProductLine();
  const [activeTab, setActiveTab] = useState(TAB_STOCK);

  // ── Остатки (агрегат по товару — каталог небольшой, грузим целиком) ──
  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const [detailsItem, setDetailsItem] = useState(null);

  const loadStock = useCallback(() => {
    setStockLoading(true);
    setStockError(null);
    fetchGpStock(null)
      .then((data) => setStockRows(aggregateStockByProduct(data?.items ?? [])))
      .catch((err) => setStockError(getApiErrorMessage(err)))
      .finally(() => setStockLoading(false));
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);

  const stockFiltered = useMemo(() => {
    const q = normalize(debouncedSearch);
    if (!q) return stockRows;
    return stockRows.filter((r) => normalize(r.productName).includes(q));
  }, [stockRows, debouncedSearch]);

  // ── История (журнал растёт без остановки — серверная пагинация) ──
  const [opsPage, setOpsPage] = useState(1);
  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);

  const loadOps = useCallback(() => {
    setOpsLoading(true);
    setOpsError(null);
    fetchWarehouseOperations({ page: opsPage, pageSize: 20 }, null)
      .then((data) => setOps(data))
      .catch((err) => setOpsError(getApiErrorMessage(err)))
      .finally(() => setOpsLoading(false));
  }, [opsPage]);

  useEffect(() => {
    if (activeTab === TAB_OPERATIONS) loadOps();
  }, [activeTab, loadOps]);

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="warehouse-page">
        <ProductLineTabs value={line} onChange={setLine} />
        <FoamWarehouseTab />
      </div>
    );
  }

  return (
    <div className="warehouse-page">
      <ProductLineTabs value={line} onChange={setLine} />
      <Subtabs items={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === TAB_STOCK && (
        <>
          <div className="warehouse-page__toolbar">
            <div className="ui-search warehouse-page__search">
              <Search size={16} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск по товару"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="ui-search__input"
              />
            </div>
          </div>
          <WarehouseStockList
            items={stockFiltered}
            loading={stockLoading}
            error={stockError}
            onRetry={loadStock}
            onDetails={setDetailsItem}
            emptyMessage={debouncedSearch ? 'Ничего не найдено' : 'Склад пуст — товар попадает сюда после учёта в ОТК'}
          />
        </>
      )}

      {activeTab === TAB_OPERATIONS && (
        <>
          <WarehouseOperationsList
            items={ops?.items}
            loading={opsLoading}
            error={opsError}
            onRetry={loadOps}
          />
          <Pagination
            meta={ops?.meta}
            currentPage={opsPage}
            onPage={setOpsPage}
            loading={opsLoading}
            entityLabel="операций"
          />
        </>
      )}

      {detailsItem && (
        <WarehouseStockDetailModal item={detailsItem} onClose={() => setDetailsItem(null)} />
      )}
    </div>
  );
};

export default WarehousePage;
