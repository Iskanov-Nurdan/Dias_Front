import React, { useState, useEffect } from 'react';
import {
  ConfirmModal,
  EmptyState,
} from '../../../../shared/ui';
import {
  newLineKey,
  normalizeRecipeRowsState,
  validateRecipeRows,
} from '../../lib/blankRecipeShared';
import { loadBlanks, saveBlanks } from '../../lib/localBlankStore';
import BlankRecipeRowsEditor from '../BlankRecipeRowsEditor/BlankRecipeRowsEditor';
import './ChemistryPage.scss';

const AddBlankModal = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [recipeRows, setRecipeRows] = useState(() => [
    { key: newLineKey(), raw_material_id: '', quantity_per_unit: '' },
  ]);
  const [recipeError, setRecipeError] = useState('');

  const validateComposition = () => {
    const v = validateRecipeRows(recipeRows);
    if (!v.ok) {
      setRecipeError(v.error);
      return null;
    }
    setRecipeError('');
    return v.comp;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const comp = validateComposition();
    if (!comp) return;
    onSave?.({ name: n, composition: comp });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Добавить заготовку</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Имя *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required autoComplete="off" />
          <BlankRecipeRowsEditor
            recipeRows={recipeRows}
            setRecipeRows={setRecipeRows}
            errorText={recipeError}
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditBlankModal = ({ initial, onClose, onSave }) => {
  const [name, setName] = useState(initial?.name || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !initial?.id) return;
    onSave?.({ id: initial.id, name: n });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Редактировать</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Имя *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CompositionOnlyModal = ({ initialName, composition, onClose, onSave }) => {
  const [recipeRows, setRecipeRows] = useState(() =>
    normalizeRecipeRowsState(
      composition?.map((c) => ({
        key: newLineKey(),
        raw_material_id: c.raw_material_id,
        quantity_per_unit: c.quantity_per_unit,
      })),
    ),
  );
  const [recipeError, setRecipeError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = validateRecipeRows(recipeRows);
    if (!v.ok) {
      setRecipeError(v.error);
      return;
    }
    setRecipeError('');
    onSave?.(v.comp);
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Состав: {initialName || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <BlankRecipeRowsEditor
            recipeRows={recipeRows}
            setRecipeRows={setRecipeRows}
            errorText={recipeError}
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить состав</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChemistryPage = () => {
  const [items, setItems] = useState(() => loadBlanks());

  useEffect(() => {
    saveBlanks(items);
  }, [items]);
  const [addKey, setAddKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [compositionTarget, setCompositionTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const saveNew = ({ name, composition }) => {
    setItems((prev) => [
      ...prev,
      {
        id: newLineKey(),
        name,
        composition,
      },
    ]);
  };

  const saveEdit = ({ id, name }) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  };

  const saveComposition = (comp) => {
    if (!compositionTarget?.id) return;
    setItems((prev) =>
      prev.map((it) => (it.id === compositionTarget.id ? { ...it, composition: comp } : it)),
    );
  };

  const doDelete = () => {
    if (!deleteTarget?.id) return;
    setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="page page--chemistry chemistry-blank-stock">
      <div className="chemistry-card">
        <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
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

        {items.length === 0 ? (
          <EmptyState title="Нет заготовок" />
        ) : (
          <div className="chemistry-table-wrap">
            <div className="chemistry-table chemistry-table--prep-list">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Имя</span>
                <span className="chemistry-table__th chemistry-table__th--actions">Действия</span>
              </div>
              {items.map((row) => (
                <div key={row.id} className="chemistry-table__row">
                  <span className="chemistry-table__name chemistry-table__cell-clip">{row.name}</span>
                  <div className="chemistry-table__actions chemistry-table__actions--wrap chemistry-blank-stock__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setEditTarget(row)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setCompositionTarget(row)}
                    >
                      Состав
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteTarget({ id: row.id, name: row.name })}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <AddBlankModal key={addKey} onClose={() => setAddOpen(false)} onSave={saveNew} />
      )}

      {editTarget && (
        <EditBlankModal
          key={editTarget.id}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      )}

      {compositionTarget && (
        <CompositionOnlyModal
          key={compositionTarget.id}
          initialName={compositionTarget.name}
          composition={compositionTarget.composition}
          onClose={() => setCompositionTarget(null)}
          onSave={saveComposition}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить заготовку?"
        message={deleteTarget ? `Удалить «${deleteTarget.name}»?` : ''}
        confirmText="Удалить"
        onConfirm={() => {
          doDelete();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ChemistryPage;
