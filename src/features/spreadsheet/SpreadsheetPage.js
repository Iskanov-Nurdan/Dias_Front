import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Trash2, Pencil, Table2, ArrowLeft, Sigma, Loader } from 'lucide-react';
import { useToast } from '../../app/providers/ToastProvider';
import { ConfirmModal } from '../../shared/ui';
import * as api from './api';
import './SpreadsheetPage.scss';

const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

const now       = new Date();
const CY        = now.getFullYear();
const CM        = now.getMonth() + 1;
const YEAR_OPTS = [2024, 2025, 2026, 2027, 2028];
const DEFAULT_W = 160;
const DATE_W    = 110;
const MIN_W     = 50;

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
const apiErr = (e) => e?.response?.data?.message || e?.response?.data?.detail || 'Ошибка';

// ─────────────────────────────────────────────────────────
//  Create modal
// ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate, saving }) {
  const [name, setName]   = useState('');
  const [year, setYear]   = useState(CY);
  const [month, setMonth] = useState(CM);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, saving]);

  const submit = () => {
    if (!name.trim() || saving) { nameRef.current?.focus(); return; }
    onCreate(name.trim(), year, month);
  };

  return (
    <div className="sp-modal-backdrop" onMouseDown={onClose}>
      <div className="sp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sp-modal__header">
          <span className="sp-modal__title">Новая таблица</span>
          <button className="sp-modal__close" onClick={onClose} disabled={saving}><X size={16} /></button>
        </div>
        <div className="sp-modal__body">
          <label className="sp-modal__label">
            Название
            <input
              ref={nameRef}
              className="sp-modal__input"
              placeholder="Например: Финансы Июль"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              disabled={saving}
            />
          </label>
          <div className="sp-modal__row">
            <label className="sp-modal__label sp-modal__label--half">
              Год
              <select className="sp-modal__select" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={saving}>
                {YEAR_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="sp-modal__label sp-modal__label--half">
              Месяц
              <select className="sp-modal__select" value={month} onChange={(e) => setMonth(Number(e.target.value))} disabled={saving}>
                {MONTHS_RU.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="sp-modal__footer">
          <button className="sp-modal__btn sp-modal__btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="sp-modal__btn sp-modal__btn--primary" onClick={submit} disabled={saving || !name.trim()}>
            {saving && <Loader size={13} className="sp__spin" />}
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Gallery
// ─────────────────────────────────────────────────────────
function Gallery({ blocks, loading, opening, error, onOpen, onDelete, onCreateClick }) {
  return (
    <div className="sp-gallery">
      <div className="sp-gallery__header">
        <Table2 size={22} className="sp-gallery__icon" />
        <h1 className="sp-gallery__title">Таблицы</h1>
        <button className="sp-gallery__create-btn" onClick={onCreateClick} disabled={loading || opening}>
          <Plus size={14} /> Создать таблицу
        </button>
      </div>

      {loading && (
        <div className="sp-gallery__empty">
          <Loader size={28} className="sp__spin sp-gallery__empty-icon" />
          <p className="sp-gallery__empty-text">Загрузка...</p>
        </div>
      )}

      {!loading && error && (
        <div className="sp-gallery__empty">
          <p className="sp-gallery__empty-text" style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && blocks.length === 0 && (
        <div className="sp-gallery__empty">
          <Table2 size={40} className="sp-gallery__empty-icon" />
          <p className="sp-gallery__empty-text">Нет таблиц — создайте первую</p>
          <button className="sp-gallery__create-btn sp-gallery__create-btn--big" onClick={onCreateClick}>
            <Plus size={14} /> Создать таблицу
          </button>
        </div>
      )}

      {!loading && !error && blocks.length > 0 && (
        <div className={`sp-gallery__grid${opening ? ' sp-gallery__grid--opening' : ''}`}>
          {blocks.map((b) => (
            <div key={b.id} className="sp-card" onClick={() => !opening && onOpen(b.id)}>
              <div className="sp-card__top" />
              <div className="sp-card__body">
                <span className="sp-card__name">{b.name}</span>
                <span className="sp-card__meta">
                  {MONTHS_RU[(b.month ?? 1) - 1]} {b.year}
                  &nbsp;·&nbsp;
                  {getDaysInMonth(b.year, b.month)} дней
                </span>
              </div>
              <button
                className="sp-card__delete"
                title="Удалить"
                onClick={(e) => { e.stopPropagation(); onDelete(b); }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {opening && (
            <div className="sp-gallery__opening-overlay">
              <Loader size={22} className="sp__spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Grid (spreadsheet inside a block)
// ─────────────────────────────────────────────────────────
function Grid({ block, onBack, onBlockChange }) {
  const toast = useToast();

  const [editCell, setEditCell]     = useState(null);
  const [editVal, setEditVal]       = useState('');
  const [editColId, setEditColId]   = useState(null);
  const [editColVal, setEditColVal] = useState('');
  const [ctx, setCtx]               = useState(null);
  const [resizing, setResizing]     = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // { type: 'col'|'row', id, label }
  const ctxRef = useRef(null);

  // Always-fresh refs to avoid stale closures in effects
  const blockRef = useRef(block);
  useEffect(() => { blockRef.current = block; });
  const onBlockChangeRef = useRef(onBlockChange);
  useEffect(() => { onBlockChangeRef.current = onBlockChange; });

  const cols = block.columns ?? [];
  const rows = block.rows    ?? [];
  const getW = (col) => col.width ?? (col.locked ? DATE_W : DEFAULT_W);
  const tableWidth = cols.reduce((s, c) => s + getW(c), 0);

  // Close context menu on outside click
  useEffect(() => {
    const h = () => setCtx(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Flip context menu up/left if it overflows viewport
  useEffect(() => {
    if (!ctx || !ctxRef.current) return;
    const el = ctxRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) el.style.top  = `${ctx.y - rect.height}px`;
    if (rect.right  > window.innerWidth)  el.style.left = `${ctx.x - rect.width}px`;
  }, [ctx]);

  // ── Column resize ─────────────────────────────────────
  const startResize = (e, col) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ colId: col.id, startX: e.clientX, startWidth: getW(col) });
  };

  useEffect(() => {
    if (!resizing) return;
    let lastWidth = null;

    const onMove = (e) => {
      const w = Math.max(MIN_W, resizing.startWidth + (e.clientX - resizing.startX));
      lastWidth = w;
      const b = blockRef.current;
      onBlockChangeRef.current({
        ...b,
        columns: b.columns.map((c) => c.id === resizing.colId ? { ...c, width: w } : c),
      });
    };

    const onUp = () => {
      setResizing(null);
      if (lastWidth !== null) {
        // Fire-and-forget — width already updated optimistically
        api.updateColumn(blockRef.current.id, resizing.colId, { width: lastWidth }).catch(() => {});
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing]);

  // ── Column ops ────────────────────────────────────────
  const addColumn = async () => {
    try {
      const col = await api.addColumn(block.id, { header: `Столбец ${cols.length}`, width: DEFAULT_W });
      onBlockChange({
        ...block,
        columns: [...block.columns, col],
        rows: block.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: '' } })),
      });
    } catch (e) { toast.error(apiErr(e)); }
  };

  const removeColumn = async (colId) => {
    try {
      await api.deleteColumn(block.id, colId);
      onBlockChange({
        ...block,
        columns: block.columns.filter((c) => c.id !== colId),
        rows: block.rows.map((r) => {
          const cells = { ...r.cells };
          delete cells[colId];
          return { ...r, cells };
        }),
      });
    } catch (e) { toast.error(apiErr(e)); }
  };

  const startRenameCol = (col) => { setEditColId(col.id); setEditColVal(col.header); };

  const commitRenameCol = async () => {
    if (!editColId || !editColVal.trim()) { setEditColId(null); return; }
    const colId    = editColId;
    const newHeader = editColVal.trim();
    setEditColId(null);
    try {
      await api.updateColumn(block.id, colId, { header: newHeader });
      onBlockChange({
        ...block,
        columns: block.columns.map((c) => c.id === colId ? { ...c, header: newHeader } : c),
      });
    } catch (e) { toast.error(apiErr(e)); }
  };

  // ── Row ops ───────────────────────────────────────────
  const addRow = async () => {
    try {
      const row = await api.addRow(block.id);
      onBlockChange({ ...block, rows: [...block.rows, row] });
    } catch (e) { toast.error(apiErr(e)); }
  };

  const removeRow = async (rowId) => {
    try {
      await api.deleteRow(block.id, rowId);
      onBlockChange({ ...block, rows: block.rows.filter((r) => r.id !== rowId) });
    } catch (e) { toast.error(apiErr(e)); }
  };

  const sumRow = async (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const sumableCols = cols.filter((c) => !c.locked && !c.isTotal);
    const total = sumableCols.reduce((acc, c) => {
      const v = parseFloat(row.cells[c.id] ?? '');
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    const fmt = Number.isInteger(total) ? String(total) : total.toFixed(2);

    try {
      let totalColId = cols.find((c) => c.isTotal)?.id;
      let base = block;

      if (!totalColId) {
        const newCol = await api.addColumn(block.id, { header: 'Итого', isTotal: true, width: 120 });
        totalColId = newCol.id;
        base = {
          ...block,
          columns: [...block.columns, newCol],
          rows: block.rows.map((r) => ({ ...r, cells: { ...r.cells, [newCol.id]: '' } })),
        };
        onBlockChange(base);
      }

      const updatedRow = await api.updateRow(block.id, rowId, { [totalColId]: fmt });
      onBlockChange({
        ...base,
        rows: base.rows.map((r) => r.id === rowId ? updatedRow : r),
      });
    } catch (e) { toast.error(apiErr(e)); }
  };

  const sumColumn = async (colId) => {
    const regularRows = rows.filter((r) => !r.isTotal);
    const total = regularRows.reduce((acc, r) => {
      const v = parseFloat(r.cells?.[colId] ?? '');
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    const fmt = Number.isInteger(total) ? String(total) : total.toFixed(2);

    try {
      let totalRow = rows.find((r) => r.isTotal);
      let base = block;

      if (!totalRow) {
        const newRow = await api.addRow(block.id, { isTotal: true });
        totalRow = { ...newRow, isTotal: true };
        base = { ...block, rows: [...block.rows, totalRow] };
        onBlockChange(base);
      }

      const updatedRow = await api.updateRow(block.id, totalRow.id, { [colId]: fmt });
      onBlockChange({
        ...base,
        rows: base.rows.map((r) => r.id === totalRow.id ? { ...updatedRow, isTotal: true } : r),
      });
    } catch (e) { toast.error(apiErr(e)); }
  };

  // ── Cell editing ──────────────────────────────────────
  const startEdit = (rowId, colId, val) => { setEditCell({ rowId, colId }); setEditVal(val ?? ''); };

  const commitCell = useCallback(async () => {
    if (!editCell) return;
    const { rowId, colId } = editCell;
    const val = editVal;
    setEditCell(null);
    try {
      const updatedRow = await api.updateRow(block.id, rowId, { [colId]: val });
      onBlockChange({
        ...block,
        rows: block.rows.map((r) => r.id === rowId ? updatedRow : r),
      });
    } catch (e) { toast.error(apiErr(e)); }
  }, [editCell, editVal, block, onBlockChange, toast]);

  const navigate = (rowId, colId, dir) => {
    commitCell();
    const ri = rows.findIndex((r) => r.id === rowId);
    const ci = cols.findIndex((c) => c.id === colId);
    let nr = ri, nc = ci;
    if (dir === 'down')  nr = Math.min(ri + 1, rows.length - 1);
    if (dir === 'up')    nr = Math.max(ri - 1, 0);
    if (dir === 'right') { nc = ci + 1; while (nc < cols.length && (cols[nc]?.locked || cols[nc]?.isTotal)) nc++; }
    if (dir === 'left')  { nc = ci - 1; while (nc >= 0 && (cols[nc]?.locked || cols[nc]?.isTotal)) nc--; }
    const nRow = rows[nr]; const nCol = cols[nc];
    if (nRow && nCol && !nRow.isTotal && !nCol.locked && !nCol.isTotal) startEdit(nRow.id, nCol.id, nRow.cells[nCol.id] ?? '');
  };

  const onKey = (e, rowId, colId) => {
    if (e.key === 'Enter')      { e.preventDefault(); navigate(rowId, colId, 'down'); }
    if (e.key === 'Tab')        { e.preventDefault(); navigate(rowId, colId, e.shiftKey ? 'left' : 'right'); }
    if (e.key === 'Escape')     setEditCell(null);
    if (e.key === 'ArrowDown')  { e.preventDefault(); navigate(rowId, colId, 'down'); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); navigate(rowId, colId, 'up'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigate(rowId, colId, 'right'); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navigate(rowId, colId, 'left'); }
  };

  const openCtx = (e, type, id, meta = {}) => {
    e.preventDefault(); e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, type, id, ...meta });
  };

  return (
    <div className={`sp-grid-view${resizing ? ' sp-grid-view--resizing' : ''}`}>
      {/* Toolbar */}
      <div className="sp-grid-view__toolbar">
        <button className="sp-grid-view__back" onClick={() => { setEditCell(null); onBack(); }}>
          <ArrowLeft size={15} /> Таблицы
        </button>
        <span className="sp-grid-view__name">{block.name}</span>
        <span className="sp-grid-view__meta">{MONTHS_RU[(block.month ?? 1) - 1]} {block.year}</span>
        <div className="sp-grid-view__actions">
          <button className="sp__btn" onClick={addColumn}><Plus size={12} /><span>Столбец</span></button>
          <button className="sp__btn" onClick={addRow}><Plus size={12} /><span>Строка</span></button>
        </div>
      </div>

      {/* Table */}
      <div className="sp-grid-view__wrap">
        <table className="sp__grid" style={{ tableLayout: 'fixed', width: `${tableWidth}px` }}>
          <colgroup>
            {cols.map((col) => <col key={col.id} style={{ width: `${getW(col)}px` }} />)}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.id}
                  className={`sp__th${col.locked ? ' sp__th--date' : ''}${col.isTotal ? ' sp__th--total' : ''}`}
                  onContextMenu={(e) => !col.locked && !col.isTotal && openCtx(e, 'col', col.id)}
                >
                  {editColId === col.id ? (
                    <input
                      className="sp__header-input"
                      autoFocus
                      value={editColVal}
                      onChange={(e) => setEditColVal(e.target.value)}
                      onBlur={commitRenameCol}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRenameCol(); if (e.key === 'Escape') setEditColId(null); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="sp__th-inner">
                      {col.isTotal && <Sigma size={11} className="sp__th-sigma" />}
                      {col.header}
                      {!col.locked && !col.isTotal && <Pencil size={10} className="sp__th-pencil" />}
                    </span>
                  )}
                  {!col.locked && !col.isTotal && (
                    <div className="sp__resize-handle" onMouseDown={(e) => startResize(e, col)} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.isTotal ? 'sp__row--total' : ''}
                onContextMenu={(e) => openCtx(e, 'row', row.id, { isTotalRow: row.isTotal })}
              >
                {cols.map((col) => {
                  const isEditing  = !row.isTotal && editCell?.rowId === row.id && editCell?.colId === col.id;
                  const isReadOnly = col.locked || col.isTotal || row.isTotal;
                  const val        = row.cells?.[col.id] ?? '';
                  const display    = (row.isTotal && col.locked) ? 'Σ Итого' : val;
                  return (
                    <td
                      key={col.id}
                      className={`sp__cell${col.locked ? ' sp__cell--date' : ''}${col.isTotal ? ' sp__cell--total' : ''}${row.isTotal ? ' sp__cell--row-total' : ''}${isEditing ? ' sp__cell--editing' : ''}`}
                      onClick={() => !isReadOnly && !isEditing && startEdit(row.id, col.id, val)}
                    >
                      {isEditing ? (
                        <input
                          className="sp__cell-input"
                          autoFocus
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={commitCell}
                          onKeyDown={(e) => onKey(e, row.id, col.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {confirmDel && (
        <ConfirmModal
          title={confirmDel.type === 'col' ? `Удалить столбец «${confirmDel.label}»?` : 'Удалить строку?'}
          message={confirmDel.type === 'col' ? 'Все данные в этом столбце будут удалены безвозвратно.' : 'Все данные в этой строке будут удалены безвозвратно.'}
          confirmText="Удалить"
          danger
          onConfirm={() => { confirmDel.type === 'col' ? removeColumn(confirmDel.id) : removeRow(confirmDel.id); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {ctx && (
        <div ref={ctxRef} className="sp__ctx" style={{ top: ctx.y, left: ctx.x }} onMouseDown={(e) => e.stopPropagation()}>
          {ctx.type === 'col' && (
            <>
              <button onClick={() => { sumColumn(ctx.id); setCtx(null); }}>
                <Sigma size={12} /> Объединить всё
              </button>
              <div className="sp__ctx-divider" />
              <button onClick={() => { const col = cols.find((c) => c.id === ctx.id); if (col) startRenameCol(col); setCtx(null); }}>
                <Pencil size={12} /> Переименовать
              </button>
              <div className="sp__ctx-divider" />
              <button className="sp__ctx-btn--danger" onClick={() => { const col = cols.find((c) => c.id === ctx.id); setConfirmDel({ type: 'col', id: ctx.id, label: col?.header || 'столбец' }); setCtx(null); }}>
                <Trash2 size={12} /> Удалить столбец
              </button>
            </>
          )}
          {ctx.type === 'row' && (
            <>
              <button onClick={() => { sumRow(ctx.id); setCtx(null); }}>
                <Sigma size={12} /> Объединить всё
              </button>
              {!ctx.isTotalRow && (
                <>
                  <div className="sp__ctx-divider" />
                  <button className="sp__ctx-btn--danger" onClick={() => { setConfirmDel({ type: 'row', id: ctx.id, label: 'строку' }); setCtx(null); }}>
                    <Trash2 size={12} /> Удалить строку
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────────────────
export default function SpreadsheetPage() {
  const toast = useToast();

  const [blocks, setBlocks]             = useState([]);
  const [listLoading, setListLoading]   = useState(true);
  const [listError, setListError]       = useState(null);
  const [activeBlock, setActiveBlock]   = useState(null);
  const [blockOpening, setBlockOpening] = useState(false);
  const [view, setView]                 = useState('gallery');
  const [showCreate, setShowCreate]     = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  // Load block list on mount
  useEffect(() => {
    setListLoading(true);
    setListError(null);
    api.fetchSpreadsheets()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results ?? data?.blocks ?? []);
        setBlocks(list);
      })
      .catch((e) => setListError(apiErr(e) || 'Ошибка загрузки'))
      .finally(() => setListLoading(false));
  }, []);

  const openBlock = async (id) => {
    setBlockOpening(true);
    try {
      const block = await api.fetchSpreadsheet(id);
      setActiveBlock(block);
      setView('grid');
    } catch (e) {
      toast.error(apiErr(e) || 'Ошибка загрузки таблицы');
    } finally {
      setBlockOpening(false);
    }
  };

  const handleCreate = async (name, year, month) => {
    setCreateSaving(true);
    try {
      const block = await api.createSpreadsheet({ name, year, month });
      setBlocks((prev) => [...prev, block]);
      setShowCreate(false);
      setActiveBlock(block);
      setView('grid');
    } catch (e) {
      toast.error(apiErr(e) || 'Ошибка создания таблицы');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.deleteSpreadsheet(id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      toast.error(apiErr(e) || 'Ошибка удаления');
    }
  };

  const goBack = () => {
    setActiveBlock(null);
    setView('gallery');
  };

  return (
    <div className="sp-root">
      {view === 'gallery' && (
        <Gallery
          blocks={blocks}
          loading={listLoading}
          opening={blockOpening}
          error={listError}
          onOpen={openBlock}
          onDelete={(b) => setConfirmDelete({ id: b.id, name: b.name })}
          onCreateClick={() => setShowCreate(true)}
        />
      )}

      {view === 'grid' && activeBlock && (
        <Grid
          block={activeBlock}
          onBack={goBack}
          onBlockChange={setActiveBlock}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => !createSaving && setShowCreate(false)}
          onCreate={handleCreate}
          saving={createSaving}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Удалить таблицу?"
          message={`Таблица «${confirmDelete.name}» и все её данные будут удалены безвозвратно.`}
          confirmText="Удалить"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
