import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  Factory, Box, CloudSnow, Beaker,
} from 'lucide-react';
import { fetchFoamRawLots, fetchFoamDensityGrades, fetchFoamProductionRuns, createFoamProductionRun } from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import {
  ErrorState, EmptyState, SkeletonTable, Pagination, Fab,
} from '../../../shared/ui';
import ProduceFoamRunModal from './ProduceFoamRunModal';
import { OUTPUT_LABEL, foamUnit } from '../stockLabel';
import './FoamProductionTab.scss';

const MOBILE_MQ = '(max-width: 768px)';

const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');
/** «41.2 шт · Куб (F15)» / «48.3 кг · Гранулят» — гранулят взвешивают, куб считают штуками (см. shared/stockLabel foamUnit). */
const outputText = (r) => `${r.output_qty} ${foamUnit(r.output_format)} · ${OUTPUT_LABEL[r.output_format] || r.output_format}${r.grade_code ? ` (${r.grade_code})` : ''}`;

const FoamProductionTab = () => {
  const toast = useToast();
  const [lots, setLots] = useState([]);
  const [grades, setGrades] = useState([]);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    fetchFoamRawLots({ pageSize: 100 }, null).then((data) => setLots(data.items)).catch(() => {});
    fetchFoamDensityGrades(null).then(setGrades).catch(() => {});
  }, []);

  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFoamProductionRuns({ page, pageSize: 20 }, null)
      .then((data) => setRuns(data))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const items = runs?.items ?? [];
    const cubes = items.filter((r) => r.output_format === 'cube').reduce((s, r) => s + Number(r.output_qty || 0), 0);
    const granuleKg = items.filter((r) => r.output_format === 'granule').reduce((s, r) => s + Number(r.output_qty || 0), 0);
    return { total: runs?.meta?.total ?? items.length, cubes, granuleKg };
  }, [runs]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleProduce = async (payload) => {
    setFormError(null);
    setSaving(true);
    try {
      await createFoamProductionRun(payload, null);
      setModalOpen(false);
      fetchFoamRawLots({ pageSize: 100 }, null).then((data) => setLots(data.items)).catch(() => {});
      load();
      toast.success('Партия запущена');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="foam-production">
      <div className="foam-production__stats">
        <div className="foam-production__stat">
          <span className="foam-production__stat-label">Всего запусков</span>
          <span className="foam-production__stat-value">{stats.total}</span>
        </div>
        <div className="foam-production__stat">
          <span className="foam-production__stat-label"><Box size={13} /> Кубов произведено</span>
          <span className="foam-production__stat-value">{stats.cubes}</span>
        </div>
        <div className="foam-production__stat">
          <span className="foam-production__stat-label"><CloudSnow size={13} /> Гранулята, кг</span>
          <span className="foam-production__stat-value">{stats.granuleKg.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</span>
        </div>
      </div>

      <div className="foam-production__toolbar">
        <button type="button" className="foam-production__add foam-production__add--desktop-only" onClick={() => setModalOpen(true)}>
          <Factory size={16} /> Произвести
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : loading ? (
        isMobile ? <SkeletonTable rows={6} cols={5} /> : (
          <div className="ui-list__table-wrap"><SkeletonTable rows={6} cols={5} /></div>
        )
      ) : !(runs?.items?.length) ? (
        <EmptyState message="Запусков пока нет" actionLabel="Произвести" onAction={() => setModalOpen(true)} />
      ) : isMobile ? (
        <div className="foam-production__cards">
          {runs.items.map((r, idx) => (
            <div key={r.id} className="foam-production__card" style={{ '--row-i': idx }}>
              <div className="foam-production__card-icon"><Beaker size={16} /></div>
              <div className="foam-production__card-body">
                <div className="foam-production__card-title">{r.material_name || `материал №${r.lot_id}`}</div>
                <div className="foam-production__card-sub">
                  Расход {Number(r.input_kg).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} кг · Выход {outputText(r)}
                </div>
                <div className="foam-production__card-meta">{r.operator || '—'} · {dateFmt(r.produced_at)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-list__table-wrap">
          <table className="ui-list__table foam-production__table">
            <thead>
              <tr><th>Дата</th><th>Материал</th><th>Расход, кг</th><th>Выход</th><th>Оператор</th></tr>
            </thead>
            <tbody>
              {runs.items.map((r, idx) => (
                <tr key={r.id} style={{ '--row-i': idx }}>
                  <td>{dateFmt(r.produced_at)}</td>
                  <td>{r.material_name || `материал №${r.lot_id}`}</td>
                  <td>{Number(r.input_kg).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                  <td>{outputText(r)}</td>
                  <td>{r.operator || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={runs?.meta} currentPage={page} onPage={setPage} loading={loading} entityLabel="запусков" />
      <Fab onClick={() => setModalOpen(true)} label="Произвести" icon={Factory} />

      {modalOpen && (
        <ProduceFoamRunModal
          lots={lots}
          grades={grades}
          onSave={handleProduce}
          onClose={() => { setModalOpen(false); setFormError(null); }}
          error={formError}
          saving={saving}
        />
      )}
    </div>
  );
};

export default FoamProductionTab;
