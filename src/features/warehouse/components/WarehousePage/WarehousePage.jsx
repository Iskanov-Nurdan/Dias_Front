import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
  extractIsoDatePart,
} from '../../../../shared/lib';
import { EmptyState, ErrorState, IntegerInput, Loading, SearchableSelect, useToast, ClientDateFilter } from '../../../../shared/ui';
import {
  mapBlankProductionRunFromApi,
  postWorkshopRunAcceptGp,
} from '../../../chemistry/api/blankWorkshopApi';
import {
  isBlankRunOtkRecorded,
  resolveRecipeKgForRun,
  resolveUsedKgForRun,
  getGpAcceptBounds,
} from '../../../chemistry/lib/workshopRunUtils';
import { postGpPackage, getGpUnpackedBalance, getGpPackages } from '../../api/warehouseApi';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './WarehousePage.scss';

const gpFmtIso = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const cellNum = (v, suffix = '') => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${formatNumberForInput(n)}${suffix}`;
};

const normGpSearch = (s) => String(s ?? '').trim().toLowerCase();

/** Каждый токен из запроса (через пробел) должен встречаться в объединённых полях — удобно для «профиль 6». */
const rowMatchesMultiTokenQuery = (q, ...fields) => {
  const raw = normGpSearch(q);
  if (!raw) return true;
  const hay = fields
    .map((f) => (f == null ? '' : String(f)))
    .join(' ')
    .toLowerCase();
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
};

const WarehouseGpAcceptModal = ({ run, onClose, onAccepted }) => {
  const toast = useToast();
  const bounds = useMemo(() => getGpAcceptBounds(run), [run]);
  const [piecesDraft, setPiecesDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!run) return;
    const b = getGpAcceptBounds(run);
    if (b.ok) setPiecesDraft(String(b.maxPieces));
    else setPiecesDraft('');
  }, [run?.id, run?.goodKg, run?.goodPieces, run?.weightKgPerPiece, run?.vatMaxKgDemo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!run?.id) return;
    if (!bounds.ok) {
      toast.show('Нет данных для приёмки: вес штуки и годный объём по строке');
      return;
    }
    const trimmed = String(piecesDraft ?? '').trim();
    if (trimmed === '') {
      toast.show('Укажите количество принятых штук');
      return;
    }
    const n = Math.floor(Number(trimmed));
    if (!Number.isFinite(n) || n < 0 || n > bounds.maxPieces) {
      toast.show(`От 0 до ${bounds.maxPieces} шт (по расчёту ОТК)`);
      return;
    }
    setSubmitting(true);
    try {
      await postWorkshopRunAcceptGp(run.id, { accepted_pieces: n });
      toast.show(
        n < bounds.maxPieces
          ? 'Принято. Остаток в «Заготовка (цех)»'
          : 'Принято на склад ГП',
      );
      onAccepted?.();
      onClose();
    } catch (err) {
      toast.show(getApiErrorMessage(err, 'Не удалось сохранить приёмку'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!run) return null;

  const parsed =
    String(piecesDraft ?? '').trim() === '' ? NaN : Math.floor(Number(piecesDraft));
  const previewAcceptedKg =
    bounds.ok && Number.isFinite(parsed) && parsed >= 0 ? parsed * bounds.weightKgPerPiece : null;
  const previewRemainder =
    bounds.ok && previewAcceptedKg != null ? Math.max(0, bounds.goodKg - previewAcceptedKg) : null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide warehouse-gp-accept-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="warehouse-gp-accept-title"
      >
        <div className="modal__head">
          <h3 id="warehouse-gp-accept-title">Приёмка: {run.productName || 'Товар'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          {!bounds.ok ? (
            <p className="modal__error">
              Не задан вес одной штуки или годный объём. Проверьте товар и запись ОТК.
            </p>
          ) : (
            <>
              <label htmlFor="gp-accept-pieces">
                Принято, шт <span className="warehouse-gp-accept-modal__max">(макс. {bounds.maxPieces})</span>
              </label>
              <input
                id="gp-accept-pieces"
                inputMode="numeric"
                className="warehouse-gp-accept-modal__pieces-input"
                value={piecesDraft}
                onChange={(ev) => setPiecesDraft(ev.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                autoComplete="off"
              />
              <div className="warehouse-gp-accept-modal__preview">
                <div>
                  <span className="warehouse-gp-accept-modal__preview-label">На склад ГП, кг</span>
                  <span className="warehouse-gp-accept-modal__preview-value">
                    {previewAcceptedKg != null ? `${formatNumberForInput(previewAcceptedKg)} кг` : '—'}
                  </span>
                </div>
                <div>
                  <span className="warehouse-gp-accept-modal__preview-label">Остаток в машине, кг</span>
                  <span className="warehouse-gp-accept-modal__preview-value">
                    {previewRemainder != null ? `${formatNumberForInput(previewRemainder)} кг` : '—'}
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!bounds.ok || submitting}>
              {submitting ? '…' : 'Сохранить приёмку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const acceptedPiecesLabel = (r) => {
  if (r.gpAcceptedPieces != null && Number.isFinite(Number(r.gpAcceptedPieces))) {
    return formatNumberForInput(Number(r.gpAcceptedPieces));
  }
  if (r.goodPieces != null && Number.isFinite(Number(r.goodPieces))) {
    return formatNumberForInput(Math.floor(Number(r.goodPieces)));
  }
  return '—';
};

const buildGpRunDetailRows = (r, { accepted }) => {
  const u = resolveUsedKgForRun(r);
  const usedStr = u > 0 ? `${formatNumberForInput(u)} кг` : '—';
  const goodPiecesStr =
    r.goodPieces != null && Number.isFinite(Number(r.goodPieces))
      ? formatNumberForInput(Number(r.goodPieces))
      : '—';
  const rows = [
    ['Заготовка', r.blankName || '—'],
    ['Дата выпуска', gpFmtIso(r.createdAt)],
    ['Заготовка, кг', cellNum(resolveRecipeKgForRun(r), ' кг')],
    ['В производстве, кг', usedStr],
    ['Брак, кг', cellNum(r.defectKg, ' кг')],
    ['Годного, кг', cellNum(r.goodKg, ' кг')],
    ['Шт (расч.)', goodPiecesStr],
    ['кг/шт', cellNum(r.weightKgPerPiece, ' кг')],
  ];
  if (accepted) {
    rows.push(
      ['Принято, шт', acceptedPiecesLabel(r)],
      ['На склад, кг', cellNum(r.gpAcceptedKg, ' кг')],
      ['Остаток машины, кг', cellNum(r.gpMachineRemainderKg, ' кг')],
      ['Дата приёмки', gpFmtIso(r.gpAcceptedAt)],
    );
  }
  return rows;
};

const gpPiecesNum = (r) => {
  if (r.gpAcceptedPieces != null && Number.isFinite(Number(r.gpAcceptedPieces))) {
    return Number(r.gpAcceptedPieces);
  }
  if (r.goodPieces != null && Number.isFinite(Number(r.goodPieces))) {
    return Math.floor(Number(r.goodPieces));
  }
  return 0;
};

const gpAcceptedKgNum = (r) => {
  if (r.gpAcceptedKg != null && Number.isFinite(Number(r.gpAcceptedKg))) return Number(r.gpAcceptedKg);
  return 0;
};

/** Неупакованные шт по строке (с бэка или = принято, если поля ещё нет). */
const gpUnpackedPiecesForRun = (r) => {
  if (r.unpackedPieces != null && Number.isFinite(Number(r.unpackedPieces))) {
    return Math.max(0, Math.floor(Number(r.unpackedPieces)));
  }
  return gpPiecesNum(r);
};

const gpPackedPiecesForRun = (r) => {
  if (r.packedPieces != null && Number.isFinite(Number(r.packedPieces))) {
    return Math.max(0, Math.floor(Number(r.packedPieces)));
  }
  const acc = gpPiecesNum(r);
  const un = gpUnpackedPiecesForRun(r);
  return Math.max(0, acc - un);
};

const gpUnpackedKgForRun = (r) => {
  if (r.unpackedKg != null && Number.isFinite(Number(r.unpackedKg))) return Number(r.unpackedKg);
  const accKg = gpAcceptedKgNum(r);
  const accPc = gpPiecesNum(r);
  const unPc = gpUnpackedPiecesForRun(r);
  if (accPc <= 0 || !Number.isFinite(accKg)) return 0;
  return (unPc / accPc) * accKg;
};

const gpPackedKgForRun = (r) => {
  const accKg = gpAcceptedKgNum(r);
  const accPc = gpPiecesNum(r);
  const pk = gpPackedPiecesForRun(r);
  if (accPc <= 0 || !Number.isFinite(accKg)) return 0;
  return (pk / accPc) * accKg;
};

const acceptedGroupKey = (r) => {
  const pid = String(r.productId || '').trim();
  const bid = String(r.blankId || '').trim();
  if (pid && bid) return `id:${pid}|${bid}`;
  const pn = String(r.productName || '').trim().toLowerCase();
  const bn = String(r.blankName || '').trim().toLowerCase();
  return `nm:${pn}|${bn}`;
};

const mapBalanceLineToRunStub = (ln, productId, blankId) => ({
  id: String(ln.run_id ?? ln.id ?? ln.blank_production_run_id ?? ''),
  productId: productId != null ? String(productId) : '',
  blankId: blankId != null ? String(blankId) : '',
  productName: ln.product_name,
  blankName: ln.blank_name,
  gpAcceptedAt: ln.gp_accepted_at ?? ln.accepted_at,
  gpAcceptedPieces: ln.gp_accepted_pieces ?? ln.accepted_pieces,
  gpAcceptedKg: ln.gp_accepted_kg ?? ln.accepted_kg,
  unpackedPieces: ln.unpacked_pieces,
  unpackedKg: ln.unpacked_kg,
});

const mapApiBalanceGroupToGroup = (g, runsById) => {
  const productId = g.product_id ?? g.productId;
  const blankId = g.blank_id ?? g.blankId;
  const pidStr = productId != null ? String(productId) : '';
  const bidStr = blankId != null ? String(blankId) : '';
  const lines = Array.isArray(g.lines) ? g.lines : [];
  const runsList = lines
    .map((ln) => {
      const rid = String(ln.run_id ?? ln.id ?? ln.blank_production_run_id ?? '');
      if (!rid) return null;
      return runsById.get(rid) || mapBalanceLineToRunStub(ln, pidStr, bidStr);
    })
    .filter(Boolean);
  const up = Number(g.unpacked_pieces ?? g.unpackedPieces ?? 0);
  const uk = Number(g.unpacked_kg ?? g.unpackedKg ?? 0);
  const key =
    pidStr && bidStr
      ? `id:${pidStr}|${bidStr}`
      : `nm:${String(g.product_name ?? g.productName ?? '').toLowerCase()}|${String(
        g.blank_name ?? g.blankName ?? '',
      ).toLowerCase()}`;
  return {
    key,
    productId: pidStr,
    blankId: bidStr,
    productName: g.product_name ?? g.productName ?? '—',
    blankName: g.blank_name ?? g.blankName ?? '—',
    totalPieces: Math.max(0, Math.floor(Number.isFinite(up) ? up : 0)),
    totalKg: Number.isFinite(uk) ? uk : 0,
    runs: runsList,
  };
};

const aggregateUnpackedGroupsFromRuns = (acceptedRuns) => {
  const map = new Map();
  for (const r of acceptedRuns) {
    const un = gpUnpackedPiecesForRun(r);
    if (un <= 0) continue;
    const k = acceptedGroupKey(r);
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        productName: r.productName || '—',
        blankName: r.blankName || '—',
        productId: r.productId,
        blankId: r.blankId,
        runs: [],
        totalPieces: 0,
        totalKg: 0,
      };
      map.set(k, g);
    }
    g.runs.push(r);
    g.totalPieces += un;
    g.totalKg += gpUnpackedKgForRun(r);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.runs.sort((a, b) => String(b.gpAcceptedAt || '').localeCompare(String(a.gpAcceptedAt || '')));
  }
  groups.sort((a, b) => {
    const ta = Math.max(0, ...a.runs.map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    const tb = Math.max(0, ...b.runs.map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    return tb - ta;
  });
  return groups;
};

const mergeUnpackedBalanceAndRuns = (balanceItems, acceptedRuns, runsById) => {
  if (Array.isArray(balanceItems) && balanceItems.length > 0) {
    return balanceItems
      .map((raw) => mapApiBalanceGroupToGroup(raw, runsById))
      .filter((g) => g.totalPieces > 0);
  }
  return aggregateUnpackedGroupsFromRuns(acceptedRuns);
};

const aggregatePackedGroupsFromRuns = (acceptedRuns) => {
  const map = new Map();
  for (const r of acceptedRuns) {
    const pk = gpPackedPiecesForRun(r);
    if (pk <= 0) continue;
    const k = acceptedGroupKey(r);
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        source: 'runs',
        productName: r.productName || '—',
        blankName: r.blankName || '—',
        productId: r.productId,
        blankId: r.blankId,
        runs: [],
        packages: [],
        totalPieces: 0,
        totalKg: 0,
      };
      map.set(k, g);
    }
    g.runs.push(r);
    g.totalPieces += pk;
    g.totalKg += gpPackedKgForRun(r);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.runs.sort((a, b) => String(b.gpAcceptedAt || '').localeCompare(String(a.gpAcceptedAt || '')));
  }
  groups.sort((a, b) => {
    const ta = Math.max(0, ...a.runs.map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    const tb = Math.max(0, ...b.runs.map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    return tb - ta;
  });
  return groups;
};

/** Схлопывает группы с одинаковой парой товар/заготовка (разные ключи id vs имя). */
const mergePackedRunGroupsByProductBlank = (groups) => {
  if (!groups?.length) return [];
  const byName = new Map();
  for (const g of groups) {
    const nk = `nm:${String(g.productName || '').trim().toLowerCase()}|${String(g.blankName || '').trim().toLowerCase()}`;
    const existing = byName.get(nk);
    if (!existing) {
      byName.set(nk, {
        ...g,
        runs: [...(g.runs || [])],
        totalPieces: g.totalPieces,
        totalKg: g.totalKg,
      });
      continue;
    }
    const idKey = existing.key.startsWith('id:')
      ? existing.key
      : g.key.startsWith('id:')
        ? g.key
        : existing.key;
    const runById = new Map((existing.runs || []).map((r) => [String(r.id), r]));
    for (const r of g.runs || []) {
      const id = String(r.id);
      if (!runById.has(id)) runById.set(id, r);
    }
    existing.runs = [...runById.values()];
    existing.totalPieces += g.totalPieces;
    existing.totalKg += g.totalKg;
    existing.key = idKey;
    if (String(g.key || '').startsWith('id:')) {
      existing.productId = g.productId ?? existing.productId;
      existing.blankId = g.blankId ?? existing.blankId;
    }
    byName.set(nk, existing);
  }
  const out = [...byName.values()];
  for (const g of out) {
    (g.runs || []).sort((a, b) => String(b.gpAcceptedAt || '').localeCompare(String(a.gpAcceptedAt || '')));
  }
  out.sort((a, b) => {
    const ta = Math.max(0, ...(a.runs || []).map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    const tb = Math.max(0, ...(b.runs || []).map((x) => new Date(x.gpAcceptedAt || 0).getTime()));
    return tb - ta;
  });
  return out;
};

const aggregatePackedGroupsFromPackages = (mappedRows) => {
  const map = new Map();
  for (const row of mappedRows) {
    const pc = Number(row.pieces);
    if (!Number.isFinite(pc) || pc <= 0) continue;
    const pid = row.productId != null ? String(row.productId).trim() : '';
    const bid = row.blankId != null ? String(row.blankId).trim() : '';
    const key =
      pid && bid
        ? `id:${pid}|${bid}`
        : `nm:${String(row.productName || '').toLowerCase()}|${String(row.blankName || '').toLowerCase()}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        source: 'packages',
        productName: row.productName || '—',
        blankName: row.blankName || '—',
        productId: pid || row.productId,
        blankId: bid || row.blankId,
        runs: [],
        packages: [],
        totalPieces: 0,
        totalKg: 0,
      };
      map.set(key, g);
    }
    g.packages.push(row);
    g.totalPieces += pc;
    const kg = row.kg != null && Number.isFinite(Number(row.kg)) ? Number(row.kg) : 0;
    g.totalKg += kg;
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.packages.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }
  groups.sort((a, b) => {
    const ta = Math.max(0, ...a.packages.map((x) => new Date(x.at || 0).getTime()));
    const tb = Math.max(0, ...b.packages.map((x) => new Date(x.at || 0).getTime()));
    return tb - ta;
  });
  return groups;
};

const gpKindRu = (k) => {
  const s = String(k || '').toLowerCase();
  if (s === 'pallet') return 'Паллета';
  if (s === 'box') return 'Короб';
  if (s === 'other') return 'Другое';
  return k ? String(k) : '—';
};

const WAREHOUSE_RUN_DATE_FIELDS = ['otkRecordedAt', 'gpAcceptedAt', 'createdAt'];

const filterWarehouseRunByClientDate = (r, filterIso) =>
  matchesClientDateFilter(filterIso, pickFirstIsoDate(r, WAREHOUSE_RUN_DATE_FIELDS));

const unpackedGroupMatchesClientDate = (g, filterIso) => {
  if (!filterIso) return true;
  return (g.runs || []).some((r) => filterWarehouseRunByClientDate(r, filterIso));
};

const packedGroupMatchesClientDate = (g, filterIso) => {
  if (!filterIso) return true;
  if ((g.packages || []).length > 0) {
    return g.packages.some((p) => matchesClientDateFilter(filterIso, extractIsoDatePart(p.at)));
  }
  return (g.runs || []).some((r) => filterWarehouseRunByClientDate(r, filterIso));
};

const WarehouseGpAcceptedGroupModal = ({ group, listVariant = 'accepted', onClose, onOpenRunDetail }) => {
  const isUnpacked = listVariant === 'unpacked';
  const isPacked = listVariant === 'packed';
  const [detailFilter, setDetailFilter] = useState('');

  const displayRuns = useMemo(() => {
    if (!group?.runs?.length) return [];
    if (isUnpacked) return group.runs.filter((r) => gpUnpackedPiecesForRun(r) > 0);
    if (isPacked) return group.runs.filter((r) => gpPackedPiecesForRun(r) > 0);
    return group.runs;
  }, [group, isUnpacked, isPacked]);

  useEffect(() => {
    setDetailFilter('');
  }, [group?.key, listVariant]);

  const filteredPackages = useMemo(() => {
    const pkgs = group?.packages || [];
    if (!normGpSearch(detailFilter)) return pkgs;
    return pkgs.filter((p) =>
      rowMatchesMultiTokenQuery(
        detailFilter,
        gpFmtIso(p.at),
        gpKindRu(p.kind),
        p.label,
        p.pieces,
        p.kg,
        String(p.id ?? ''),
      ),
    );
  }, [group?.packages, detailFilter]);

  const filteredDisplayRuns = useMemo(() => {
    if (!normGpSearch(detailFilter)) return displayRuns;
    return displayRuns.filter((r) =>
      rowMatchesMultiTokenQuery(
        detailFilter,
        r.productName,
        r.blankName,
        gpFmtIso(r.gpAcceptedAt),
        acceptedPiecesLabel(r),
        String(r.id ?? ''),
      ),
    );
  }, [displayRuns, detailFilter]);

  if (!group) return null;

  const acceptedTotalPieces = (group.runs || []).reduce((s, r) => s + gpPiecesNum(r), 0);
  const isPackedFromPackages = isPacked && group.source === 'packages' && (group.packages || []).length > 0;
  const allPackages = group.packages || [];
  const showDetailFilter =
    isPackedFromPackages ? allPackages.length > 0 : displayRuns.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal modal--wide warehouse-gp-group-modal${
          isPackedFromPackages ? ' warehouse-gp-group-modal--packages' : ''
        }`}
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="warehouse-gp-group-title"
      >
        <div className="modal__head">
          <h3 id="warehouse-gp-group-title">
            {isPacked ? 'Упаковано' : 'Приёмки'}: {group.productName || '—'}
          </h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body warehouse-gp-group-modal__body">
          <p className="warehouse-gp-group-modal__summary">
            <strong>{group.blankName || '—'}</strong>
            {isUnpacked && (
              <>
                {' · '}
                неупаковано <strong>{formatNumberForInput(group.totalPieces)} шт</strong>,{' '}
                <strong>{formatNumberForInput(group.totalKg)} кг</strong> · строк: {displayRuns.length}
                <span className="warehouse-gp-group-modal__subline">
                  Принято всего: {formatNumberForInput(acceptedTotalPieces)} шт
                </span>
              </>
            )}
            {isPacked && (
              <>
                {' · '}
                упаковано <strong>{formatNumberForInput(group.totalPieces)} шт</strong>,{' '}
                <strong>{formatNumberForInput(group.totalKg)} кг</strong>
                {isPackedFromPackages ? (
                  <> · упаковок: {group.packages.length}</>
                ) : (
                  <> · приёмок (строк): {displayRuns.length}</>
                )}
              </>
            )}
            {!isUnpacked && !isPacked && (
              <>
                {' · '}
                всего <strong>{formatNumberForInput(group.totalPieces)} шт</strong>,{' '}
                <strong>{formatNumberForInput(group.totalKg)} кг</strong> на склад · строк:{' '}
                {group.runs.length}
              </>
            )}
          </p>
          {normGpSearch(detailFilter) && showDetailFilter ? (
            <p className="warehouse-gp-group-modal__filter-meta">
              {isPackedFromPackages
                ? `По фильтру таблицы: ${filteredPackages.length} из ${allPackages.length} упаковок`
                : `По фильтру таблицы: ${filteredDisplayRuns.length} из ${displayRuns.length} строк`}
            </p>
          ) : null}
          {showDetailFilter ? (
            <div className="warehouse-gp-group-modal__filter-row">
              <input
                type="search"
                className="warehouse-gp-group-modal__filter-input"
                value={detailFilter}
                onChange={(ev) => setDetailFilter(ev.target.value)}
                placeholder="Фильтр: дата, тип, метка, шт, id…"
                aria-label="Фильтр строк таблицы"
                autoComplete="off"
              />
              {normGpSearch(detailFilter) ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetailFilter('')}>
                  Сбросить
                </button>
              ) : null}
            </div>
          ) : null}
          <div
            className={`commercial-table-wrap warehouse-gp-group-modal__table-wrap${
              showDetailFilter ? ' warehouse-gp-group-modal__table-wrap--scroll' : ''
            }`}
          >
            {isPackedFromPackages ? (
              !allPackages.length ? (
                <p className="warehouse-gp-group-modal__empty">Нет записей упаковок.</p>
              ) : (
                <table className="data-table data-table--tight warehouse-gp-group-modal__table">
                  <thead>
                    <tr>
                      <th>Дата упаковки</th>
                      <th>Тип</th>
                      <th>Метка</th>
                      <th className="data-table__cell--num">Шт</th>
                      <th className="data-table__cell--num">Кг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="warehouse-gp-group-modal__empty-cell">
                          Нет строк по фильтру — измените запрос или сбросьте.
                        </td>
                      </tr>
                    ) : (
                      filteredPackages.map((p) => (
                        <tr key={String(p.id)}>
                          <td className="data-table__cell--muted">{gpFmtIso(p.at)}</td>
                          <td>{gpKindRu(p.kind)}</td>
                          <td>{p.label ? String(p.label) : '—'}</td>
                          <td className="data-table__cell--num">
                            {p.pieces != null && Number.isFinite(Number(p.pieces))
                              ? formatNumberForInput(Number(p.pieces))
                              : '—'}
                          </td>
                          <td className="data-table__cell--num">{cellNum(p.kg, ' кг')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )
            ) : displayRuns.length === 0 ? (
              <p className="warehouse-gp-group-modal__empty">
                {isUnpacked
                  ? 'Нет приёмок с остатком неупакованного — всё уже упаковано по этим строкам.'
                  : isPacked
                    ? 'Нет строк с упакованным количеством.'
                    : 'Нет строк для отображения.'}
              </p>
            ) : filteredDisplayRuns.length === 0 ? (
              <p className="warehouse-gp-group-modal__empty">
                Нет строк по фильтру — измените запрос или сбросьте.
              </p>
            ) : (
            <table className="data-table data-table--tight warehouse-gp-group-modal__table">
              <thead>
                <tr>
                  <th>Дата приёмки</th>
                  {isUnpacked && (
                    <>
                      <th className="data-table__cell--num">Принято, шт</th>
                      <th className="data-table__cell--num">Неупак., шт</th>
                      <th className="data-table__cell--num">Неупак., кг</th>
                    </>
                  )}
                  {isPacked && (
                    <>
                      <th className="data-table__cell--num">Упак., шт</th>
                      <th className="data-table__cell--num">Упак., кг</th>
                    </>
                  )}
                  {!isUnpacked && !isPacked && (
                    <>
                      <th className="data-table__cell--num">Шт</th>
                      <th className="data-table__cell--num">На склад, кг</th>
                    </>
                  )}
                  <th className="warehouse-gp__th-actions"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredDisplayRuns.map((r) => (
                  <tr key={r.id}>
                    <td className="data-table__cell--muted">{gpFmtIso(r.gpAcceptedAt)}</td>
                    {isUnpacked && (
                      <>
                        <td className="data-table__cell--num">{acceptedPiecesLabel(r)}</td>
                        <td className="data-table__cell--num">
                          {formatNumberForInput(gpUnpackedPiecesForRun(r))}
                        </td>
                        <td className="data-table__cell--num">
                          {cellNum(gpUnpackedKgForRun(r), ' кг')}
                        </td>
                      </>
                    )}
                    {isPacked && (
                      <>
                        <td className="data-table__cell--num">
                          {formatNumberForInput(gpPackedPiecesForRun(r))}
                        </td>
                        <td className="data-table__cell--num">{cellNum(gpPackedKgForRun(r), ' кг')}</td>
                      </>
                    )}
                    {!isUnpacked && !isPacked && (
                      <>
                        <td className="data-table__cell--num">{acceptedPiecesLabel(r)}</td>
                        <td className="data-table__cell--num">{cellNum(r.gpAcceptedKg, ' кг')}</td>
                      </>
                    )}
                    <td className="warehouse-gp__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => onOpenRunDetail(r)}
                      >
                        Детали строки
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const PACK_KIND_OPTIONS = [
  { value: 'pallet', label: 'Паллета', searchText: 'Паллета pallet поддон' },
  { value: 'box', label: 'Короб', searchText: 'Короб box картон' },
  { value: 'other', label: 'Другое', searchText: 'Другое мешок пачка' },
];

const parsePackInt = (s) => {
  const n = Math.floor(Number(String(s ?? '').replace(/\D/g, '')));
  return Number.isFinite(n) ? n : 0;
};

const newCustomPackLine = () => ({
  id:
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  numPacks: '1',
  perPack: '1',
});

const buildGpPackLinesPayload = (splitMode, singlePieces, uniformNumPacks, uniformPerPack, customLines) => {
  if (splitMode === 'single') {
    return [{ package_count: 1, pieces_per_package: parsePackInt(singlePieces) }];
  }
  if (splitMode === 'uniform') {
    return [
      {
        package_count: parsePackInt(uniformNumPacks),
        pieces_per_package: parsePackInt(uniformPerPack),
      },
    ];
  }
  return customLines.map((row) => ({
    package_count: parsePackInt(row.numPacks),
    pieces_per_package: parsePackInt(row.perPack),
  }));
};

const mapGpPackApiError = (err) => {
  const d = err?.response?.data;
  const code = String(d?.code || d?.error?.code || '').toUpperCase();
  if (code === 'EMPTY_LABEL_WHEN_REQUIRED') {
    return 'Для короба и паллеты укажите метку (№ / код)';
  }
  if (code === 'INSUFFICIENT_UNPACKED_PIECES') {
    return 'Недостаточно неупакованных штук — обновите страницу';
  }
  if (code === 'INVALID_SPLIT' || code === 'INVALID_KIND') {
    return d?.detail || d?.message || 'Неверные параметры упаковки';
  }
  if (code === 'PRODUCT_BLANK_MISMATCH') {
    return 'Товар и заготовка не совпадают с операцией';
  }
  if (code === 'VALIDATION_ERROR') {
    const errs = d?.errors;
    if (errs && typeof errs === 'object' && !Array.isArray(errs)) {
      const entries = Object.entries(errs);
      const first = entries[0];
      if (first) {
        const msg = Array.isArray(first[1]) ? first[1].join(', ') : String(first[1]);
        return `${first[0]}: ${msg}`;
      }
    }
    return typeof d?.detail === 'string' ? d.detail : 'Ошибка валидации полей';
  }
  return getApiErrorMessage(err, 'Ошибка упаковки');
};

const WarehouseGpPackModal = ({ group, onClose, onPacked }) => {
  const toast = useToast();
  const [kind, setKind] = useState('box');
  const [label, setLabel] = useState('');
  /** single | uniform | custom */
  const [splitMode, setSplitMode] = useState('single');
  const [singlePieces, setSinglePieces] = useState('');
  const [uniformNumPacks, setUniformNumPacks] = useState('1');
  const [uniformPerPack, setUniformPerPack] = useState('');
  const [customLines, setCustomLines] = useState(() => [newCustomPackLine()]);
  const [submitting, setSubmitting] = useState(false);

  const maxPieces = Math.max(0, Math.floor(group?.totalPieces ?? 0));

  useEffect(() => {
    if (!group) return;
    setKind('box');
    setLabel('');
    setSplitMode('single');
    setSinglePieces(maxPieces > 0 ? String(maxPieces) : '');
    setUniformNumPacks('1');
    setUniformPerPack(maxPieces > 0 ? String(Math.min(10, maxPieces)) : '');
    setCustomLines([newCustomPackLine()]);
  }, [group?.key, maxPieces]);

  const plannedPieces = useMemo(() => {
    if (splitMode === 'single') return parsePackInt(singlePieces);
    if (splitMode === 'uniform') {
      return parsePackInt(uniformNumPacks) * parsePackInt(uniformPerPack);
    }
    return customLines.reduce((sum, row) => sum + parsePackInt(row.numPacks) * parsePackInt(row.perPack), 0);
  }, [splitMode, singlePieces, uniformNumPacks, uniformPerPack, customLines]);

  const remainder = maxPieces - plannedPieces;

  const addCustomLine = () => {
    setCustomLines((prev) => [...prev, newCustomPackLine()]);
  };

  const removeCustomLine = (id) => {
    setCustomLines((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const updateCustomLine = (id, field, value) => {
    setCustomLines((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  if (!group) return null;

  const describePlanForToast = () => {
    const kindLabel = PACK_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind;
    if (splitMode === 'single') {
      return `${kindLabel}: 1×${parsePackInt(singlePieces)} шт`;
    }
    if (splitMode === 'uniform') {
      const n = parsePackInt(uniformNumPacks);
      const m = parsePackInt(uniformPerPack);
      return `${kindLabel}: ${n} уп. × ${m} шт = ${plannedPieces} шт`;
    }
    const parts = customLines.map((row) => {
      const n = parsePackInt(row.numPacks);
      const m = parsePackInt(row.perPack);
      return `${n}×${m}`;
    });
    return `${kindLabel}: ${parts.join(' + ')} = ${plannedPieces} шт`;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (maxPieces <= 0) return;
    const productId = Number(group.productId);
    const blankId = Number(group.blankId);
    if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(blankId) || blankId <= 0) {
      toast.show('В группе нет product_id / blank_id — упаковка только для строк с ID из API');
      return;
    }
    if ((kind === 'box' || kind === 'pallet') && !String(label || '').trim()) {
      toast.show('Для короба и паллеты укажите метку');
      return;
    }
    if (plannedPieces <= 0) {
      toast.show('Укажите, сколько штук уходит в упаковку (итог должен быть больше 0)');
      return;
    }
    if (plannedPieces > maxPieces) {
      toast.show(`По плану ${plannedPieces} шт — больше доступных ${maxPieces} шт`);
      return;
    }
    if (splitMode === 'uniform') {
      const n = parsePackInt(uniformNumPacks);
      const m = parsePackInt(uniformPerPack);
      if (n < 1 || m < 1) {
        toast.show('Укажите число упаковок ≥ 1 и шт в каждой ≥ 1');
        return;
      }
    }
    if (splitMode === 'custom') {
      const bad = customLines.some((row) => parsePackInt(row.numPacks) < 1 || parsePackInt(row.perPack) < 1);
      if (bad) {
        toast.show('В каждой строке: упаковок ≥ 1 и шт в упаковке ≥ 1');
        return;
      }
    }

    const lines = buildGpPackLinesPayload(splitMode, singlePieces, uniformNumPacks, uniformPerPack, customLines);
    const clientRequestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const body = {
      product_id: productId,
      blank_id: blankId,
      kind,
      label: String(label || '').trim(),
      split_mode: splitMode,
      lines,
      total_pieces: plannedPieces,
      client_request_id: clientRequestId,
    };

    setSubmitting(true);
    try {
      await postGpPackage(body);
      toast.show(`Упаковано: ${describePlanForToast()}`);
      onPacked?.();
      onClose();
    } catch (err) {
      toast.show(mapGpPackApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide warehouse-gp-pack-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="warehouse-gp-pack-title"
      >
        <div className="modal__head">
          <h3 id="warehouse-gp-pack-title">Упаковка</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={submit}>
          <p className="warehouse-gp-pack-modal__lede">
            <span className="warehouse-gp-pack-modal__product-line">
              {group.productName || '—'} · {group.blankName || '—'}
            </span>
            <span className="warehouse-gp-pack-modal__avail">
              {formatNumberForInput(maxPieces)} шт · {formatNumberForInput(group.totalKg)} кг
            </span>
          </p>

          <label>Тип</label>
          <SearchableSelect
            value={kind}
            onChange={(v) => setKind(v != null ? String(v) : 'box')}
            options={PACK_KIND_OPTIONS}
            placeholder="Выберите"
          />

          <label htmlFor="gp-pack-label">
            Метка{kind === 'box' || kind === 'pallet' ? ' *' : ''}
          </label>
          <input
            id="gp-pack-label"
            type="text"
            value={label}
            onChange={(ev) => setLabel(ev.target.value)}
            placeholder={kind === 'box' || kind === 'pallet' ? 'Обязательно для короба / паллеты' : '№ / код'}
            autoComplete="off"
          />

          <fieldset className="warehouse-gp-pack-modal__fieldset">
            <legend className="warehouse-gp-pack-modal__legend">Распределение</legend>
            <div className="warehouse-gp-pack-modal__modes">
              <label className="warehouse-gp-pack-modal__mode">
                <input
                  type="radio"
                  name="gp-pack-split"
                  checked={splitMode === 'single'}
                  onChange={() => setSplitMode('single')}
                />
                <span>Одна упаковка</span>
              </label>
              <label className="warehouse-gp-pack-modal__mode">
                <input
                  type="radio"
                  name="gp-pack-split"
                  checked={splitMode === 'uniform'}
                  onChange={() => setSplitMode('uniform')}
                />
                <span>Несколько одинаковых</span>
              </label>
              <label className="warehouse-gp-pack-modal__mode">
                <input
                  type="radio"
                  name="gp-pack-split"
                  checked={splitMode === 'custom'}
                  onChange={() => setSplitMode('custom')}
                />
                <span>Разные размеры</span>
              </label>
            </div>

            {splitMode === 'single' && (
              <div className="warehouse-gp-pack-modal__block">
                <label htmlFor="gp-pack-single">Шт в этой упаковке *</label>
                <IntegerInput
                  id="gp-pack-single"
                  min={1}
                  max={maxPieces || undefined}
                  value={singlePieces}
                  onChange={setSinglePieces}
                />
              </div>
            )}

            {splitMode === 'uniform' && (
              <div className="warehouse-gp-pack-modal__block warehouse-gp-pack-modal__grid2">
                <div>
                  <label htmlFor="gp-pack-n">Упаковок *</label>
                  <IntegerInput
                    id="gp-pack-n"
                    min={1}
                    value={uniformNumPacks}
                    onChange={setUniformNumPacks}
                  />
                </div>
                <div>
                  <label htmlFor="gp-pack-m">Шт в каждой *</label>
                  <IntegerInput
                    id="gp-pack-m"
                    min={1}
                    max={maxPieces || undefined}
                    value={uniformPerPack}
                    onChange={setUniformPerPack}
                  />
                </div>
              </div>
            )}

            {splitMode === 'custom' && (
              <div className="warehouse-gp-pack-modal__block">
                <div className="warehouse-gp-pack-modal__custom-head">
                  <span>Строки</span>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={addCustomLine}>
                    + строка
                  </button>
                </div>
                <div className="warehouse-gp-pack-modal__custom-rows">
                  {customLines.map((row) => {
                    const lineTotal = parsePackInt(row.numPacks) * parsePackInt(row.perPack);
                    return (
                      <div key={row.id} className="warehouse-gp-pack-modal__custom-row">
                        <div>
                          <label className="warehouse-gp-pack-modal__sublabel">Упаковок</label>
                          <IntegerInput
                            min={1}
                            value={row.numPacks}
                            onChange={(v) => updateCustomLine(row.id, 'numPacks', v)}
                          />
                        </div>
                        <div>
                          <label className="warehouse-gp-pack-modal__sublabel">Шт в каждой</label>
                          <IntegerInput
                            min={1}
                            max={maxPieces || undefined}
                            value={row.perPack}
                            onChange={(v) => updateCustomLine(row.id, 'perPack', v)}
                          />
                        </div>
                        <div className="warehouse-gp-pack-modal__custom-subtotal">
                          <span className="warehouse-gp-pack-modal__sublabel">Итого шт</span>
                          <span className="warehouse-gp-pack-modal__subtotal-val">{lineTotal}</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm warehouse-gp-pack-modal__row-remove"
                          onClick={() => removeCustomLine(row.id)}
                          disabled={customLines.length <= 1}
                          aria-label="Удалить строку"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>

          <div
            className={
              remainder < 0
                ? 'warehouse-gp-pack-modal__summary warehouse-gp-pack-modal__summary--warn'
                : 'warehouse-gp-pack-modal__summary'
            }
          >
            <span>
              План: <strong>{formatNumberForInput(plannedPieces)} шт</strong>
            </span>
            <span>
              Остаток: <strong>{formatNumberForInput(Math.max(0, remainder))} шт</strong>
            </span>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={maxPieces <= 0 || plannedPieces <= 0 || remainder < 0 || submitting}
            >
              {submitting ? '…' : 'Создать упаковку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WarehouseGpRunDetailModal = ({ run, accepted, onClose }) => {
  if (!run) return null;
  const rows = buildGpRunDetailRows(run, { accepted });
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide warehouse-gp-detail-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="warehouse-gp-detail-title"
      >
        <div className="modal__head">
          <h3 id="warehouse-gp-detail-title">Подробнее: {run.productName || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body warehouse-gp-detail-modal__body">
          {rows.map(([k, v], i) => (
            <div key={`gp-detail-${i}`} className="warehouse-gp-detail-modal__row">
              <span className="warehouse-gp-detail-modal__k">{k}</span>
              <span className="warehouse-gp-detail-modal__v">{v}</span>
            </div>
          ))}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const gpRunsQuery = { page: 1, page_size: 500, ordering: '-created_at' };

const gpPackagesListQuery = { page: 1, page_size: 500, ordering: '-created_at' };

const normalizePackagesListPayload = (data) => {
  if (!data || typeof data !== 'object') return { items: [] };
  if (Array.isArray(data)) return { items: data };
  if (Array.isArray(data.items)) return { items: data.items };
  if (Array.isArray(data.results)) return { items: data.results };
  return { items: [] };
};

const mapGpPackageHistoryRow = (row, idx) => {
  const id = row.id ?? row.pk ?? `idx-${idx}`;
  const at = row.created_at ?? row.createdAt ?? row.packaged_at ?? row.performed_at;
  const pieces =
    row.total_pieces ??
    row.totalPieces ??
    row.pieces ??
    row.pieces_count ??
    row.piece_count ??
    null;
  const productId = row.product_id ?? row.productId ?? row.product?.id ?? null;
  const blankId = row.blank_id ?? row.blankId ?? row.blank?.id ?? null;
  const kg =
    row.total_weight_kg ??
    row.total_kg ??
    row.totalKg ??
    row.net_weight_kg ??
    row.net_kg ??
    row.weight_kg ??
    null;
  return {
    id,
    at,
    productId,
    blankId,
    productName: row.product_name ?? row.productName ?? row.product?.name ?? '—',
    blankName: row.blank_name ?? row.blankName ?? row.blank?.name ?? '—',
    kind: row.kind ?? row.package_kind,
    label: row.label ?? row.code ?? '',
    pieces,
    kg,
  };
};

const WarehouseGpAcceptPanel = () => {
  const [acceptRun, setAcceptRun] = useState(null);
  const [detailRun, setDetailRun] = useState(null);
  const [detailAccepted, setDetailAccepted] = useState(false);
  const [groupModal, setGroupModal] = useState(null);
  const [packGroup, setPackGroup] = useState(null);
  const [mainTab, setMainTab] = useState('pending');
  const { items: runItems, loading, error, refetch } = useServerQuery(
    'workshop/blank-production-runs/',
    gpRunsQuery,
    { enabled: true },
  );
  const runs = useMemo(
    () => (runItems || []).map(mapBlankProductionRunFromApi).filter(Boolean),
    [runItems],
  );

  const runsById = useMemo(() => {
    const m = new Map();
    for (const r of runs) {
      if (r?.id != null) m.set(String(r.id), r);
    }
    return m;
  }, [runs]);

  const { pending, accepted } = useMemo(() => {
    const pend = runs.filter((r) => isBlankRunOtkRecorded(r) && !r.gpAcceptedAt);
    const acc = runs
      .filter((r) => r.gpAcceptedAt)
      .sort((a, b) => String(b.gpAcceptedAt || '').localeCompare(String(a.gpAcceptedAt || '')));
    return { pending: pend, accepted: acc };
  }, [runs]);

  const {
    items: balanceRawItems,
    loading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useServerQuery('warehouse/gp-unpacked-balance/', {}, {
    enabled: accepted.length > 0,
    fetcher: async (_query, signal) => {
      const res = await getGpUnpackedBalance({}, { signal });
      const d = res.data;
      const groups = Array.isArray(d?.groups) ? d.groups : [];
      return { items: groups };
    },
  });

  const {
    items: packageRawItems,
    loading: packagesLoading,
    error: packagesError,
    refetch: refetchPackages,
  } = useServerQuery('warehouse/gp-packages/', gpPackagesListQuery, {
    enabled: true,
    fetcher: async (query, signal) => {
      const res = await getGpPackages(query, { signal });
      return normalizePackagesListPayload(res.data);
    },
  });

  const packageHistoryRows = useMemo(
    () => (packageRawItems || []).map(mapGpPackageHistoryRow),
    [packageRawItems],
  );

  const unpackedGroups = useMemo(() => {
    const balanceGroupsForMerge = balanceError ? [] : balanceRawItems;
    const raw = mergeUnpackedBalanceAndRuns(balanceGroupsForMerge, accepted, runsById);
    return raw
      .map((g) => {
        const runs = (g.runs || []).filter((r) => gpUnpackedPiecesForRun(r) > 0);
        const totalPieces = runs.reduce((s, r) => s + gpUnpackedPiecesForRun(r), 0);
        const totalKg = runs.reduce((s, r) => s + gpUnpackedKgForRun(r), 0);
        return { ...g, runs, totalPieces, totalKg };
      })
      .filter((g) => g.totalPieces > 0);
  }, [balanceError, balanceRawItems, accepted, runsById]);

  const packedGroups = useMemo(() => {
    const fromPkgs = aggregatePackedGroupsFromPackages(packageHistoryRows);
    if (fromPkgs.length > 0) return fromPkgs;
    return mergePackedRunGroupsByProductBlank(aggregatePackedGroupsFromRuns(accepted));
  }, [packageHistoryRows, accepted]);

  const [listQuery, setListQuery] = useState('');
  const [dateFilterIso, setDateFilterIso] = useState('');

  const pendingAfterSearch = useMemo(
    () =>
      pending.filter((r) =>
        rowMatchesMultiTokenQuery(listQuery, r.productName, r.blankName, String(r.id ?? '')),
      ),
    [pending, listQuery],
  );

  const filteredPending = useMemo(() => {
    if (!dateFilterIso) return pendingAfterSearch;
    return pendingAfterSearch.filter((r) =>
      matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(r, ['otkRecordedAt', 'createdAt'])),
    );
  }, [pendingAfterSearch, dateFilterIso]);

  const unpackedGroupsAfterSearch = useMemo(
    () =>
      unpackedGroups.filter((g) =>
        rowMatchesMultiTokenQuery(
          listQuery,
          g.productName,
          g.blankName,
          String(g.productId ?? ''),
          String(g.blankId ?? ''),
          g.key,
        ),
      ),
    [unpackedGroups, listQuery],
  );

  const filteredUnpackedGroups = useMemo(() => {
    if (!dateFilterIso) return unpackedGroupsAfterSearch;
    return unpackedGroupsAfterSearch.filter((g) => unpackedGroupMatchesClientDate(g, dateFilterIso));
  }, [unpackedGroupsAfterSearch, dateFilterIso]);

  const packedGroupsAfterSearch = useMemo(
    () =>
      packedGroups.filter((g) =>
        rowMatchesMultiTokenQuery(
          listQuery,
          g.productName,
          g.blankName,
          String(g.productId ?? ''),
          String(g.blankId ?? ''),
          g.key,
        ),
      ),
    [packedGroups, listQuery],
  );

  const filteredPackedGroups = useMemo(() => {
    if (!dateFilterIso) return packedGroupsAfterSearch;
    return packedGroupsAfterSearch.filter((g) => packedGroupMatchesClientDate(g, dateFilterIso));
  }, [packedGroupsAfterSearch, dateFilterIso]);

  const packageHistoryAfterSearch = useMemo(
    () =>
      packageHistoryRows.filter((row) =>
        rowMatchesMultiTokenQuery(
          listQuery,
          row.productName,
          row.blankName,
          row.label,
          gpKindRu(row.kind),
          String(row.id ?? ''),
          gpFmtIso(row.at),
        ),
      ),
    [packageHistoryRows, listQuery],
  );

  const filteredPackageHistoryRows = useMemo(() => {
    if (!dateFilterIso) return packageHistoryAfterSearch;
    return packageHistoryAfterSearch.filter((row) =>
      matchesClientDateFilter(dateFilterIso, extractIsoDatePart(row.at)),
    );
  }, [packageHistoryAfterSearch, dateFilterIso]);

  const searchStats = useMemo(() => {
    if (mainTab === 'pending') return { shown: filteredPending.length, total: pendingAfterSearch.length };
    if (mainTab === 'unpacked') {
      return { shown: filteredUnpackedGroups.length, total: unpackedGroupsAfterSearch.length };
    }
    if (mainTab === 'packed') return { shown: filteredPackedGroups.length, total: packedGroupsAfterSearch.length };
    if (mainTab === 'history') {
      return { shown: filteredPackageHistoryRows.length, total: packageHistoryAfterSearch.length };
    }
    return { shown: 0, total: 0 };
  }, [
    mainTab,
    filteredPending,
    pendingAfterSearch,
    filteredUnpackedGroups,
    unpackedGroupsAfterSearch,
    filteredPackedGroups,
    packedGroupsAfterSearch,
    filteredPackageHistoryRows,
    packageHistoryAfterSearch,
  ]);

  const refetchAllGp = useCallback(() => {
    refetch();
    refetchBalance();
    refetchPackages();
  }, [refetch, refetchBalance, refetchPackages]);

  useOperationalRefetch(['warehouse_package'], refetchAllGp, true);

  const openPendingDetail = useCallback((r) => {
    setGroupModal(null);
    setPackGroup(null);
    setDetailRun(r);
    setDetailAccepted(false);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailRun(null);
  }, []);

  const openAccept = useCallback((r) => {
    setDetailRun(null);
    setGroupModal(null);
    setPackGroup(null);
    setAcceptRun(r);
  }, []);

  const openRunDetailFromGroup = useCallback((run) => {
    setGroupModal(null);
    setDetailRun(run);
    setDetailAccepted(true);
  }, []);

  const openGroupModalUnpacked = useCallback((g) => {
    setPackGroup(null);
    setGroupModal({ group: g, listVariant: 'unpacked' });
  }, []);

  const openGroupModalPacked = useCallback((g) => {
    setPackGroup(null);
    setGroupModal({ group: g, listVariant: 'packed' });
  }, []);

  const openPackModal = useCallback((g) => {
    setGroupModal(null);
    setPackGroup(g);
  }, []);

  return (
    <div className="warehouse-gp">
      <div
        className="warehouse-gp__main-tabs production-main-tabs"
        role="tablist"
        aria-label="Разделы склада ГП"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'pending'}
          className={`production-main-tabs__btn${
            mainTab === 'pending' ? ' production-main-tabs__btn--active' : ''
          }`}
          onClick={() => setMainTab('pending')}
        >
          К приёмке
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'unpacked'}
          className={`production-main-tabs__btn${
            mainTab === 'unpacked' ? ' production-main-tabs__btn--active' : ''
          }`}
          onClick={() => setMainTab('unpacked')}
        >
          Не упаковано
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'packed'}
          className={`production-main-tabs__btn${
            mainTab === 'packed' ? ' production-main-tabs__btn--active' : ''
          }`}
          onClick={() => setMainTab('packed')}
        >
          Упаковано
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'history'}
          className={`production-main-tabs__btn${
            mainTab === 'history' ? ' production-main-tabs__btn--active' : ''
          }`}
          onClick={() => setMainTab('history')}
        >
          История
        </button>
      </div>

      <div className="warehouse-gp__toolbar">
        <input
          type="search"
          className="warehouse-gp__search-input"
          value={listQuery}
          onChange={(e) => setListQuery(e.target.value)}
          placeholder="Поиск по вкладке: товар, заготовка, метка, тип, дата, id…"
          aria-label="Поиск по списку на вкладке"
          autoComplete="off"
        />
        <ClientDateFilter
          value={dateFilterIso}
          onChange={setDateFilterIso}
          id="warehouse-gp-date-filter"
          className="warehouse-gp__date-filter"
        />
        <div className="warehouse-gp__toolbar-end">
          {(normGpSearch(listQuery) || dateFilterIso) ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setListQuery('');
                setDateFilterIso('');
              }}
            >
              Сбросить
            </button>
          ) : null}
          {searchStats.total > 0 ? (
            <span className="warehouse-gp__toolbar-count" aria-live="polite">
              Показано: {searchStats.shown} из {searchStats.total}
            </span>
          ) : null}
        </div>
      </div>

      {mainTab === 'pending' ? (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">К приёмке (после ОТК)</h2>
          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && pending.length === 0 ? (
            <EmptyState title="Нет строк на приёмку" />
          ) : null}
          {!loading && !error && pending.length > 0 && pendingAfterSearch.length === 0 ? (
            <EmptyState title="Ничего не найдено — измените поиск или сбросьте" />
          ) : null}
          {!loading && !error && pendingAfterSearch.length > 0 && filteredPending.length === 0 ? (
            <EmptyState title="На выбранную дату строк нет" />
          ) : null}
          {!loading && !error && filteredPending.length > 0 ? (
            <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
              <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Заготовка</th>
                    <th className="warehouse-gp__th-actions"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.map((r) => (
                    <tr key={r.id}>
                      <td className="warehouse-gp__product">{r.productName || '—'}</td>
                      <td className="data-table__cell--muted">{r.blankName || '—'}</td>
                      <td className="warehouse-gp__actions">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => openPendingDetail(r)}
                        >
                          Подробнее
                        </button>
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => openAccept(r)}>
                          Принять
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {mainTab === 'unpacked' ? (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">Не упаковано</h2>
          {accepted.length === 0 ? (
            <EmptyState title="Пока ничего не принято" />
          ) : (
            <>
              {balanceLoading ? (
                <p className="warehouse-gp__balance-hint">Обновление остатков неупакованного…</p>
              ) : null}
              {balanceError ? (
                <p className="warehouse-gp__balance-hint">
                  Остатки с сервера недоступны — показано по данным строк (при необходимости обновите).
                </p>
              ) : null}
              {unpackedGroups.length === 0 ? (
                <EmptyState title="Неупакованного нет — всё в упаковке или остаток 0" />
              ) : unpackedGroupsAfterSearch.length === 0 ? (
                <EmptyState title="Ничего не найдено — измените поиск или сбросьте" />
              ) : filteredUnpackedGroups.length === 0 ? (
                <EmptyState title="На выбранную дату групп нет" />
              ) : (
                <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
                  <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th>Заготовка</th>
                        <th className="data-table__cell--num">Неупак., шт</th>
                        <th className="data-table__cell--num">Неупак., кг</th>
                        <th className="data-table__cell--num">Приёмок</th>
                        <th className="warehouse-gp__th-actions"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnpackedGroups.map((g) => (
                        <tr key={g.key}>
                          <td className="warehouse-gp__product">{g.productName || '—'}</td>
                          <td className="data-table__cell--muted">{g.blankName || '—'}</td>
                          <td className="data-table__cell--num">{formatNumberForInput(g.totalPieces)}</td>
                          <td className="data-table__cell--num">{formatNumberForInput(g.totalKg)} кг</td>
                          <td className="data-table__cell--num">{g.runs.length}</td>
                          <td className="warehouse-gp__actions">
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => openGroupModalUnpacked(g)}
                            >
                              Подробнее
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => openPackModal(g)}
                            >
                              Упаковать
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      {mainTab === 'packed' ? (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">Упаковано</h2>
          {packedGroups.length === 0 ? (
            <EmptyState title="Упакованных позиций пока нет" />
          ) : packedGroupsAfterSearch.length === 0 ? (
            <EmptyState title="Ничего не найдено — измените поиск или сбросьте" />
          ) : filteredPackedGroups.length === 0 ? (
            <EmptyState title="На выбранную дату групп нет" />
          ) : (
            <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
              <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Заготовка</th>
                    <th className="data-table__cell--num">Упак., шт</th>
                    <th className="data-table__cell--num">Упак., кг</th>
                    <th className="data-table__cell--num">Упаковок</th>
                    <th className="warehouse-gp__th-actions"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackedGroups.map((g) => (
                    <tr key={g.key}>
                      <td className="warehouse-gp__product">{g.productName || '—'}</td>
                      <td className="data-table__cell--muted">{g.blankName || '—'}</td>
                      <td className="data-table__cell--num">{formatNumberForInput(g.totalPieces)}</td>
                      <td className="data-table__cell--num">{formatNumberForInput(g.totalKg)} кг</td>
                      <td className="data-table__cell--num">
                        {g.source === 'packages' ? g.packages.length : (g.runs || []).length}
                      </td>
                      <td className="warehouse-gp__actions">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => openGroupModalPacked(g)}
                        >
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {mainTab === 'history' ? (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">История упаковок</h2>
          {packagesLoading && <Loading />}
          {packagesError ? (
            <ErrorState error={packagesError} onRetry={refetchPackages} />
          ) : null}
          {!packagesLoading && !packagesError && packageHistoryRows.length === 0 ? (
            <EmptyState title="Записей нет или список недоступен с бэка" />
          ) : null}
          {!packagesLoading && !packagesError && packageHistoryAfterSearch.length > 0 && filteredPackageHistoryRows.length === 0 ? (
            <EmptyState title="На выбранную дату записей нет" />
          ) : null}
          {!packagesLoading && !packagesError && packageHistoryRows.length > 0 && packageHistoryAfterSearch.length === 0 ? (
            <EmptyState title="Ничего не найдено — измените поиск или сбросьте" />
          ) : null}
          {!packagesLoading && !packagesError && filteredPackageHistoryRows.length > 0 ? (
            <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
              <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Товар</th>
                    <th>Заготовка</th>
                    <th>Тип</th>
                    <th>Метка</th>
                    <th className="data-table__cell--num">Шт</th>
                    <th className="data-table__cell--num">Кг</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackageHistoryRows.map((row) => (
                    <tr key={String(row.id)}>
                      <td className="data-table__cell--muted">{gpFmtIso(row.at)}</td>
                      <td className="warehouse-gp__product">{row.productName}</td>
                      <td className="data-table__cell--muted">{row.blankName}</td>
                      <td>{gpKindRu(row.kind)}</td>
                      <td>{row.label ? String(row.label) : '—'}</td>
                      <td className="data-table__cell--num">
                        {row.pieces != null && Number.isFinite(Number(row.pieces))
                          ? formatNumberForInput(Number(row.pieces))
                          : '—'}
                      </td>
                      <td className="data-table__cell--num">{cellNum(row.kg, ' кг')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {groupModal ? (
        <WarehouseGpAcceptedGroupModal
          group={groupModal.group}
          listVariant={groupModal.listVariant}
          onClose={() => setGroupModal(null)}
          onOpenRunDetail={openRunDetailFromGroup}
        />
      ) : null}
      {packGroup ? (
        <WarehouseGpPackModal
          group={packGroup}
          onClose={() => setPackGroup(null)}
          onPacked={refetchAllGp}
        />
      ) : null}
      {detailRun ? (
        <WarehouseGpRunDetailModal run={detailRun} accepted={detailAccepted} onClose={closeDetail} />
      ) : null}
      {acceptRun ? (
        <WarehouseGpAcceptModal
          run={acceptRun}
          onClose={() => setAcceptRun(null)}
          onAccepted={refetchAllGp}
        />
      ) : null}
    </div>
  );
};

const WarehousePage = () => (
  <div className="page page--warehouse commercial-page">
    <WarehouseGpAcceptPanel />
  </div>
);

export default WarehousePage;
