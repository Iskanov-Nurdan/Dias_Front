import React, { useState, useEffect, useCallback } from 'react';
import { Factory } from 'lucide-react';
import { fetchBlanks, fetchPreparedBlanks, fetchProductionRuns, createProductionRun } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useProductLine, PRODUCT_LINE } from '../../shared/hooks/useProductLine';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, ProductLineTabs, Fab } from '../../shared/ui';
import { ProductionRunsList, ProduceRunModal } from './components';
import { FoamProductionTab } from '../foam/components';
import './ProductionPage.scss';

/**
 * Перенесено из «Заготовки» (вкладка «Партии») — по реальному сайдбару это
 * содержимое страницы «Производство», а не «Заготовки». Пока это тонкий
 * список запусков + «Произвести» — ровно то, что реально было в старом
 * фронтенде. Настоящая система линий/смен/партий-с-ОТК на бэкенде есть
 * (apps/production: Line, Shift, ProductionBatch, RecipeRun), но старый
 * фронтенд её не строил — это отдельная задача на будущее.
 */
const ProductionPage = () => {
  const toast = useToast();
  const [line, setLine] = useProductLine();

  const [blanks, setBlanks] = useState([]);
  const [prepared, setPrepared] = useState([]);

  useEffect(() => {
    fetchBlanks(null).then((data) => setBlanks(data?.items ?? [])).catch(() => {});
  }, []);

  const loadPrepared = useCallback(() => {
    fetchPreparedBlanks(null).then((data) => setPrepared(data?.results ?? [])).catch(() => {});
  }, []);

  useEffect(() => { loadPrepared(); }, [loadPrepared]);

  const preparedByBlankId = prepared.reduce((o, p) => ({ ...o, [String(p.blank_id)]: p.total_kg }), {});

  const [runsPage, setRunsPage] = useState(1);
  const [runs, setRuns] = useState(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState(null);

  const loadRuns = useCallback(() => {
    setRunsLoading(true);
    setRunsError(null);
    fetchProductionRuns({ page: runsPage, pageSize: 20 }, null)
      .then((data) => setRuns(data))
      .catch((err) => setRunsError(getApiErrorMessage(err)))
      .finally(() => setRunsLoading(false));
  }, [runsPage]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const [showProduceModal, setShowProduceModal] = useState(false);
  const [produceError, setProduceError] = useState(null);
  const [produceSaving, setProduceSaving] = useState(false);

  const handleProduce = async (body) => {
    setProduceError(null);
    setProduceSaving(true);
    try {
      await createProductionRun(body, null);
      setShowProduceModal(false);
      loadPrepared();
      loadRuns();
      toast.success('Партия запущена');
    } catch (err) {
      setProduceError(getApiErrorMessage(err));
    } finally {
      setProduceSaving(false);
    }
  };

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="production-page">
        <ProductLineTabs value={line} onChange={setLine} />
        <FoamProductionTab />
      </div>
    );
  }

  return (
    <div className="production-page">
      <ProductLineTabs
        value={line}
        onChange={setLine}
        action={(
          <button type="button" className="production-page__add" onClick={() => setShowProduceModal(true)}>
            <Factory size={16} /> Произвести
          </button>
        )}
      />

      <ProductionRunsList
        items={runs?.items}
        loading={runsLoading}
        error={runsError}
        onRetry={loadRuns}
      />
      <Pagination
        meta={runs?.meta}
        currentPage={runsPage}
        onPage={setRunsPage}
        loading={runsLoading}
        entityLabel="партий"
      />

      {showProduceModal && (
        <ProduceRunModal
          blanks={blanks}
          preparedByBlankId={preparedByBlankId}
          onSave={handleProduce}
          onClose={() => { setShowProduceModal(false); setProduceError(null); }}
          error={produceError}
          saving={produceSaving}
        />
      )}

      <Fab onClick={() => setShowProduceModal(true)} label="Произвести" icon={Factory} />
    </div>
  );
};

export default ProductionPage;
