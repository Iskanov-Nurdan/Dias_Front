import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes, History, Scissors, MoreVertical,
} from 'lucide-react';
import { fetchFoamGpStock, fetchFoamGpOperations, cutFoamGpStock } from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import {
  ErrorState, EmptyState, SkeletonTable, Pagination, Subtabs, ActionSheet,
} from '../../../shared/ui';
import CutFoamModal from './CutFoamModal';
import './FoamWarehouseTab.scss';

const gradeLabel = (row) => (row.grade_density_range ? `${row.grade_code} (${row.grade_density_range})` : row.grade_code);

const MOBILE_MQ = '(max-width: 768px)';

const TAB_STOCK = 'stock';
const TAB_OPS = 'ops';

const TABS = [
  { id: TAB_STOCK, label: 'Остатки', icon: Boxes },
  { id: TAB_OPS, label: 'История', icon: History },
];

const OUTPUT_LABEL = { cube: 'Куб', sheet: 'Лист', granule: 'Гранулят' };
const KIND_LABEL = {
  production_intake: 'Приход с производства',
  sale: 'Продажа',
  defect: 'Брак',
  return: 'Возврат',
  cut_in: 'Нарезка (приход)',
  cut_out: 'Нарезка (расход)',
};
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');

const FoamWarehouseTab = () => {
  const toast = useToast();
  const [tab, setTab] = useState(TAB_STOCK);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  const [menuRow, setMenuRow] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(null);

  const loadStock = useCallback(() => {
    setStockLoading(true);
    setStockError(null);
    fetchFoamGpStock(null)
      .then(setStock)
      .catch((err) => setStockError(getApiErrorMessage(err)))
      .finally(() => setStockLoading(false));
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);

  const [opsPage, setOpsPage] = useState(1);
  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);

  const loadOps = useCallback(() => {
    setOpsLoading(true);
    setOpsError(null);
    fetchFoamGpOperations({ page: opsPage, pageSize: 20 }, null)
      .then(setOps)
      .catch((err) => setOpsError(getApiErrorMessage(err)))
      .finally(() => setOpsLoading(false));
  }, [opsPage]);

  useEffect(() => { if (tab === TAB_OPS) loadOps(); }, [tab, loadOps]);

  const [cutRow, setCutRow] = useState(null);
  const [cutSaving, setCutSaving] = useState(false);
  const [cutError, setCutError] = useState(null);

  const handleCut = async (payload) => {
    setCutError(null);
    setCutSaving(true);
    try {
      await cutFoamGpStock(payload, null);
      setCutRow(null);
      loadStock();
      toast.success('Нарезка выполнена');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setCutError(msg);
      toast.error(msg);
    } finally {
      setCutSaving(false);
    }
  };

  const closeMenu = () => setMenuRow(null);
  const menuCanCut = menuRow ? menuRow.output_format === 'cube' && Number(menuRow.qty) > 0 : false;

  const renderStockCards = () => (
    <div className="foam-warehouse__cards">
      {stock.map((row, idx) => {
        const canCut = row.output_format === 'cube' && Number(row.qty) > 0;
        return (
          <article key={row.id ?? `${row.output_format}-${row.grade_code}-${row.thickness_cm}`} className="foam-warehouse__card" style={{ '--row-i': idx }}>
            <span className="foam-warehouse__avatar"><Boxes size={14} /></span>
            <div className="foam-warehouse__card-info">
              <div className="foam-warehouse__card-name">
                {OUTPUT_LABEL[row.output_format] || row.output_format}
                {row.grade_code ? ` · ${gradeLabel(row)}` : ''}
              </div>
              <div className="foam-warehouse__card-sub">
                {row.thickness_cm ? `${row.thickness_cm} см · ` : ''}{row.qty} шт.
              </div>
            </div>
            {canCut && (
              <button
                type="button"
                className="foam-warehouse__card-menu-btn"
                aria-label="Действия"
                onClick={() => setMenuRow(row)}
              >
                <MoreVertical size={17} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderOpsCards = () => (
    <div className="foam-warehouse__cards">
      {ops.items.map((op, idx) => (
        <article key={op.id} className="foam-warehouse__card" style={{ '--row-i': idx }}>
          <span className="foam-warehouse__avatar"><History size={14} /></span>
          <div className="foam-warehouse__card-info">
            <div className="foam-warehouse__card-name">{KIND_LABEL[op.kind] || op.kind}</div>
            <div className="foam-warehouse__card-sub">{dateFmt(op.created_at || op.date)}</div>
          </div>
          <span className={`foam-warehouse__op-qty${Number(op.qty) < 0 ? ' foam-warehouse__op-qty--out' : ' foam-warehouse__op-qty--in'}`}>
            {Number(op.qty) > 0 ? '+' : ''}{op.qty}
          </span>
        </article>
      ))}
    </div>
  );

  return (
    <div className="foam-warehouse">
      <Subtabs items={TABS} activeId={tab} onChange={setTab} />

      {tab === TAB_STOCK && (
        stockError ? <ErrorState message={stockError} onRetry={loadStock} /> : (
          <div className={isMobile ? '' : 'ui-list__table-wrap'}>
            {stockLoading ? (
              <SkeletonTable rows={6} cols={4} />
            ) : !stock.length ? (
              <EmptyState message="Склад пуст" />
            ) : isMobile ? (
              renderStockCards()
            ) : (
              <table className="ui-list__table foam-warehouse__table">
                <thead><tr><th>Формат</th><th>Марка</th><th>Толщина</th><th>Кол-во</th><th></th></tr></thead>
                <tbody>
                  {stock.map((row, idx) => (
                    <tr key={row.id ?? `${row.output_format}-${row.grade_code}-${row.thickness_cm}`} style={{ '--row-i': idx }}>
                      <td>{OUTPUT_LABEL[row.output_format] || row.output_format}</td>
                      <td>{row.grade_code ? gradeLabel(row) : '—'}</td>
                      <td>{row.thickness_cm ? `${row.thickness_cm} см` : '—'}</td>
                      <td className="foam-warehouse__qty">{row.qty}</td>
                      <td className="ui-list__actions">
                        {row.output_format === 'cube' && Number(row.qty) > 0 && (
                          <button type="button" className="ui-list-btn" onClick={() => setCutRow(row)}>
                            <Scissors size={13} /> На листы
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {tab === TAB_OPS && (
        <>
          {opsError ? <ErrorState message={opsError} onRetry={loadOps} /> : (
            <div className={isMobile ? '' : 'ui-list__table-wrap'}>
              {opsLoading ? (
                <SkeletonTable rows={6} cols={3} />
              ) : !(ops?.items?.length) ? (
                <EmptyState message="Операций пока нет" />
              ) : isMobile ? (
                renderOpsCards()
              ) : (
                <table className="ui-list__table foam-warehouse__table">
                  <thead><tr><th>Дата</th><th>Операция</th><th>Кол-во</th></tr></thead>
                  <tbody>
                    {ops.items.map((op, idx) => (
                      <tr key={op.id} style={{ '--row-i': idx }}>
                        <td>{dateFmt(op.created_at || op.date)}</td>
                        <td>{KIND_LABEL[op.kind] || op.kind}</td>
                        <td className={`foam-warehouse__op-qty${Number(op.qty) < 0 ? ' foam-warehouse__op-qty--out' : ' foam-warehouse__op-qty--in'}`}>
                          {Number(op.qty) > 0 ? '+' : ''}{op.qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <Pagination meta={ops?.meta} currentPage={opsPage} onPage={setOpsPage} loading={opsLoading} entityLabel="операций" />
        </>
      )}

      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow ? `${OUTPUT_LABEL[menuRow.output_format] || menuRow.output_format}${menuRow.grade_code ? ` · ${menuRow.grade_code}` : ''}` : ''}>
        {menuCanCut && (
          <button type="button" className="action-sheet__item" onClick={() => { setCutRow(menuRow); closeMenu(); }}>
            <Scissors size={17} /> На листы
          </button>
        )}
      </ActionSheet>

      {cutRow && (
        <CutFoamModal
          cubeRow={cutRow}
          onSave={handleCut}
          onClose={() => { setCutRow(null); setCutError(null); }}
          error={cutError}
          saving={cutSaving}
        />
      )}
    </div>
  );
};

export default FoamWarehouseTab;
