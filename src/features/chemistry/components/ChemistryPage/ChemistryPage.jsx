import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
} from '../../../../shared/lib';
import {
  ActionMenu,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  useToast,
} from '../../../../shared/ui';
import {
  newLineKey,
  normalizeRecipeRowsState,
  validateRecipeRows,
} from '../../lib/blankRecipeShared';
import BlankRecipeRowsEditor from '../BlankRecipeRowsEditor/BlankRecipeRowsEditor';
import {
  getWorkshopBlank,
  mapWorkshopBlankFromApi,
  postWorkshopBlank,
  patchWorkshopBlank,
  deleteWorkshopBlank,
  compositionToApiPayload,
} from '../../api/blankWorkshopApi';
import '../ChemistryPage/ChemistryPage.scss';
import ChemistryPlasticProfilesTab from '../ChemistryPlasticProfilesTab/ChemistryPlasticProfilesTab';
import { useOperationalRefetch, WS_WORKSHOP } from '../../../../shared/realtime';

const rawMatQuery = { page: 1, page_size: 500, ordering: 'name' };
const blankQuery = { page: 1, page_size: 500, ordering: 'name' };

const AddBlankModal = ({ materialOptions, onClose, onCreated }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [recipeRows, setRecipeRows] = useState(() => [
    { key: newLineKey(), raw_material_id: '', quantity_per_unit: '' },
  ]);
  const [recipeError, setRecipeError] = useState('');
  const [busy, setBusy] = useState(false);

  const validateComposition = () => {
    const v = validateRecipeRows(recipeRows);
    if (!v.ok) {
      setRecipeError(v.error);
      return null;
    }
    setRecipeError('');
    return v.comp;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const comp = validateComposition();
    if (!comp) return;
    const payload = {
      name: n,
      composition: compositionToApiPayload(
        comp.map((c) => ({ raw_material_id: c.raw_material_id, quantity_per_unit: c.quantity_per_unit })),
      ),
    };
    if (payload.composition.length === 0) {
      setRecipeError('Добавьте сырьё и вес.');
      return;
    }
    setBusy(true);
    try {
      await postWorkshopBlank(payload);
      toast.success('Заготовка создана');
      onCreated?.();
      onClose();
    } catch (err) {
      toast.apiError(err, 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Добавить заготовку</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Имя *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required autoComplete="off" />
          <BlankRecipeRowsEditor
            recipeRows={recipeRows}
            setRecipeRows={setRecipeRows}
            errorText={recipeError}
            materialOptions={materialOptions}
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditBlankModal = ({ initial, onClose, onSaved }) => {
  const toast = useToast();
  const [name, setName] = useState(initial?.name || '');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !initial?.id) return;
    setBusy(true);
    try {
      await patchWorkshopBlank(initial.id, { name: n });
      toast.success('Сохранено');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.apiError(err, 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Редактировать</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Имя *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CompositionEditModal = ({ blankId, initialName, initialComposition, materialOptions, onClose, onSaved }) => {
  const toast = useToast();
  const [recipeRows, setRecipeRows] = useState(() =>
    normalizeRecipeRowsState(
      (initialComposition || []).map((c) => ({
        key: newLineKey(),
        raw_material_id: c.raw_material_id,
        quantity_per_unit:
          c.quantity_per_unit != null && c.quantity_per_unit !== ''
            ? formatNumberForInput(c.quantity_per_unit)
            : '',
      })),
    ),
  );
  const [recipeError, setRecipeError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!blankId || (initialComposition && initialComposition.length > 0)) return;
    let alive = true;
    getWorkshopBlank(blankId)
      .then((res) => {
        if (!alive) return;
        const b = mapWorkshopBlankFromApi(res.data);
        const comp = b?.composition || [];
        setRecipeRows(
          normalizeRecipeRowsState(
            comp.map((c) => ({
              key: newLineKey(),
              raw_material_id: c.raw_material_id,
              quantity_per_unit:
                c.quantity_per_unit != null && c.quantity_per_unit !== ''
                  ? formatNumberForInput(c.quantity_per_unit)
                  : '',
            })),
          ),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [blankId, initialComposition]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validateRecipeRows(recipeRows);
    if (!v.ok) {
      setRecipeError(v.error);
      return;
    }
    setRecipeError('');
    const payload = {
      composition: compositionToApiPayload(
        v.comp.map((c) => ({ raw_material_id: c.raw_material_id, quantity_per_unit: c.quantity_per_unit })),
      ),
    };
    if (payload.composition.length === 0) {
      setRecipeError('Добавьте хотя бы одну строку сырья.');
      return;
    }
    setBusy(true);
    try {
      await patchWorkshopBlank(blankId, payload);
      toast.success('Состав сохранён');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.apiError(err, 'Не удалось сохранить состав');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Состав: {initialName || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <BlankRecipeRowsEditor
            recipeRows={recipeRows}
            setRecipeRows={setRecipeRows}
            errorText={recipeError}
            materialOptions={materialOptions}
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? '…' : 'Сохранить состав'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChemistryPage = () => {
  const toast = useToast();
  const [stockTab, setStockTab] = useState('blanks');
  const [addKey, setAddKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [compositionTarget, setCompositionTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { items: rawItems } = useServerQuery('raw-materials/', rawMatQuery, { enabled: true });
  const materialOptions = useMemo(
    () =>
      (rawItems || []).map((m) => ({
        value: String(m.id),
        label: (m.name && String(m.name).trim()) || `Сырьё #${m.id}`,
      })),
    [rawItems],
  );

  const { items, loading, error, refetch } = useServerQuery('workshop/blanks/', blankQuery, {
    enabled: true,
  });
  const blanks = useMemo(
    () => (items || []).map(mapWorkshopBlankFromApi).filter(Boolean),
    [items],
  );

  const refetchAll = useCallback(() => {
    refetch();
  }, [refetch]);

  useOperationalRefetch(WS_WORKSHOP, refetchAll, true);

  return (
    <div className="page page--chemistry chemistry-blank-stock">
      <div className="chemistry-tabs" role="tablist" aria-label="Разделы заготовки">
        <button
          type="button"
          role="tab"
          aria-selected={stockTab === 'blanks'}
          className={`chemistry-tabs__tab${stockTab === 'blanks' ? ' chemistry-tabs__tab--active' : ''}`}
          onClick={() => setStockTab('blanks')}
        >
          Заготовки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={stockTab === 'profiles'}
          className={`chemistry-tabs__tab${stockTab === 'profiles' ? ' chemistry-tabs__tab--active' : ''}`}
          onClick={() => setStockTab('profiles')}
        >
          Профили
        </button>
      </div>

      {stockTab === 'blanks' ? (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start" />
            <div className="ds-toolbar__end chemistry-card__toolbar-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setAddKey((k) => k + 1);
                  setAddOpen(true);
                }}
              >
                Добавить заготовку
              </button>
            </div>
          </div>

          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetchAll} />}
          {!loading && !error && blanks.length === 0 && (
            <EmptyState title="Нет заготовок — нажмите «Добавить заготовку»" />
          )}
          {!loading && !error && blanks.length > 0 && (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table chemistry-table--prep-list">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Имя</span>
                  <span className="chemistry-table__th chemistry-table__th--num">кг / бочка</span>
                  <span className="chemistry-table__th chemistry-table__th--actions">Действия</span>
                </div>
                {blanks.map((row) => (
                  <div key={row.id} className="chemistry-table__row">
                    <span className="chemistry-table__name chemistry-table__cell-clip">{row.name}</span>
                    <span className="chemistry-table__num">
                      {formatNumberForInput(row.recipeKgPerBarrel)} кг
                    </span>
                    <div className="chemistry-table__actions chemistry-table__actions--wrap chemistry-blank-stock__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setCompositionTarget(row)}
                      >
                        Состав
                      </button>
                      <ActionMenu
                        ariaLabel="Действия"
                        items={[
                          { label: 'Редактировать', onClick: () => setEditTarget(row) },
                          { label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ id: row.id, name: row.name }) },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <ChemistryPlasticProfilesTab />
      )}

      {addOpen && (
        <AddBlankModal
          key={addKey}
          materialOptions={materialOptions}
          onClose={() => setAddOpen(false)}
          onCreated={refetchAll}
        />
      )}

      {editTarget && (
        <EditBlankModal
          key={editTarget.id}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={refetchAll}
        />
      )}

      {compositionTarget && (
        <CompositionEditModal
          key={compositionTarget.id}
          blankId={compositionTarget.id}
          initialName={compositionTarget.name}
          initialComposition={compositionTarget.composition}
          materialOptions={materialOptions}
          onClose={() => setCompositionTarget(null)}
          onSaved={refetchAll}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить заготовку?"
        message={deleteTarget ? `Удалить «${deleteTarget.name}»?` : ''}
        confirmText="Удалить"
        confirmBusy={deleteBusy}
        onConfirm={async () => {
          if (!deleteTarget?.id) return;
          setDeleteBusy(true);
          try {
            await deleteWorkshopBlank(deleteTarget.id);
            toast.success('Удалено');
            refetchAll();
            setDeleteTarget(null);
          } catch (e) {
            toast.apiError(e, 'Не удалось удалить');
          } finally {
            setDeleteBusy(false);
          }
        }}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default ChemistryPage;
