import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
  parseLocaleNumber,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Loading, ErrorState, EmptyState, useToast, DecimalInput } from '../../../../shared/ui';
import {
  createPlasticProfile,
  updatePlasticProfile,
} from '../../../production/api/productionApi';
import { readPlasticProfileWeightKg } from '../../../production/lib/readPlasticProfilePieceWeight';
import '../ChemistryPage/ChemistryPage.scss';

const listQ = { page: 1, page_size: 500, ordering: 'name' };

const clampGramsInput = (raw) => {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 3);
  if (d === '') return '';
  return String(Math.min(999, parseInt(d, 10)));
};

const calcPieceKg = (kgStr, gramsStr) => {
  const kgNum = parseLocaleNumber(kgStr ?? '');
  const g = clampGramsInput(gramsStr);
  const gNum = g === '' ? 0 : parseInt(g, 10);
  const k = Number.isFinite(kgNum) ? kgNum : 0;
  return k + gNum / 1000;
};

const splitTotalKgToFields = (totalKg) => {
  const n = Number(totalKg);
  if (!Number.isFinite(n) || n <= 0) return { kgStr: '', gramsStr: '' };
  const totalG = Math.round(n * 1000);
  const fullKg = Math.floor(totalG / 1000);
  const grams = totalG % 1000;
  return {
    kgStr: fullKg === 0 && grams > 0 ? '0' : formatNumberForInput(fullKg),
    gramsStr: grams === 0 ? '' : String(grams),
  };
};

const buildAutoPlasticCode = () => {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `GP${t}${r}`.slice(0, 20);
};

const AddProfileModal = ({ onClose, onCreated }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [kgStr, setKgStr] = useState('');
  const [gramsStr, setGramsStr] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.show('Введите имя.');
      return;
    }
    const pieceKg = calcPieceKg(kgStr, gramsStr);
    if (!Number.isFinite(pieceKg) || pieceKg <= 0) {
      toast.show('Укажите вес одной штуки (кг и/или граммы).');
      return;
    }
    setBusy(true);
    try {
      await createPlasticProfile({
        name: n,
        code: buildAutoPlasticCode(),
        is_active: true,
        comment: '',
        weight_kg_per_piece: pieceKg,
      });
      toast.show('Товар создан');
      onCreated?.();
      onClose();
    } catch (err) {
      toast.show(getApiErrorMessage(err, 'Не удалось создать'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Новый товар</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Имя *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" required />
          <label>Кг</label>
          <DecimalInput min={0} value={kgStr} onChange={setKgStr} placeholder="0" />
          <label>Граммы (0–999)</label>
          <input
            inputMode="numeric"
            className="chemistry-plastic-profiles__grams chemistry-plastic-profiles__grams--wide"
            value={gramsStr}
            onChange={(ev) => setGramsStr(clampGramsInput(ev.target.value))}
            placeholder="0–999"
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

const ProfileRow = ({ profile, onSaved }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [kgStr, setKgStr] = useState('');
  const [gramsStr, setGramsStr] = useState('');
  const [busy, setBusy] = useState(false);

  const serverWeight = readPlasticProfileWeightKg(profile);

  const applyServerToFields = useCallback(() => {
    setName(profile.name || '');
    const { kgStr: k, gramsStr: g } = splitTotalKgToFields(serverWeight);
    setKgStr(k);
    setGramsStr(g);
  }, [profile.name, serverWeight]);

  useEffect(() => {
    if (!editing) {
      applyServerToFields();
    }
  }, [profile.id, applyServerToFields, editing]);

  const viewKgGrams = useMemo(() => splitTotalKgToFields(serverWeight), [serverWeight]);
  const viewKgDisplay = viewKgGrams.kgStr === '' && viewKgGrams.gramsStr === '' ? '—' : (viewKgGrams.kgStr || '0');
  const viewGramsDisplay = viewKgGrams.gramsStr === '' ? '—' : viewKgGrams.gramsStr;

  const handleSave = async () => {
    const n = name.trim();
    if (!n) {
      toast.show('Введите имя.');
      return;
    }
    const pieceKg = calcPieceKg(kgStr, gramsStr);
    if (!Number.isFinite(pieceKg) || pieceKg <= 0) {
      toast.show('Укажите вес одной штуки (кг и/или граммы).');
      return;
    }
    setBusy(true);
    try {
      await updatePlasticProfile(profile.id, {
        name: n,
        weight_kg_per_piece: pieceKg,
      });
      toast.show('Сохранено');
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.show(getApiErrorMessage(err, 'Не удалось сохранить'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEdit = () => {
    applyServerToFields();
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="chemistry-table__row chemistry-table__row--plastic-profile-view">
        <span className="chemistry-plastic-profiles__text">{profile.name || '—'}</span>
        <span className="chemistry-plastic-profiles__text chemistry-plastic-profiles__text--num">{viewKgDisplay}</span>
        <span className="chemistry-plastic-profiles__text chemistry-plastic-profiles__text--num">{viewGramsDisplay}</span>
        <div className="chemistry-table__actions chemistry-table__actions--wrap">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
            Редактировать
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chemistry-table__row chemistry-table__row--plastic-profile-edit">
      <input
        className="chemistry-plastic-profiles__name"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        autoComplete="off"
        aria-label="Имя товара"
      />
      <div className="chemistry-plastic-profiles__cell-num">
        <DecimalInput min={0} value={kgStr} onChange={setKgStr} placeholder="0" />
      </div>
      <div className="chemistry-plastic-profiles__cell-num">
        <input
          inputMode="numeric"
          className="chemistry-plastic-profiles__grams chemistry-plastic-profiles__grams--in-row"
          value={gramsStr}
          onChange={(ev) => setGramsStr(clampGramsInput(ev.target.value))}
          placeholder="0–999"
          aria-label="Граммы"
        />
      </div>
      <div className="chemistry-table__actions chemistry-table__actions--wrap">
        <button type="button" className="btn btn--primary btn--sm" onClick={handleSave} disabled={busy}>
          {busy ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={handleCancelEdit} disabled={busy}>
          Отмена
        </button>
      </div>
    </div>
  );
};

const ChemistryPlasticProfilesTab = () => {
  const [addOpen, setAddOpen] = useState(false);
  const {
    items: profiles,
    loading,
    error,
    refetch,
  } = useServerQuery('plastic-profiles/', listQ, { enabled: true });

  const sorted = useMemo(() => {
    const list = [...(profiles || [])];
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    return list;
  }, [profiles]);

  const refetchAll = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="chemistry-card">
      <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
        <div className="ds-toolbar__start" />
        <div className="ds-toolbar__end chemistry-card__toolbar-actions">
          <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
            Добавить товар
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetchAll} />}
      {!loading && !error && sorted.length === 0 && (
        <EmptyState title="Нет товаров — нажмите «Добавить товар»" />
      )}
      {!loading && !error && sorted.length > 0 && (
        <div className="chemistry-table-wrap">
          <div className="chemistry-table chemistry-table--plastic-profiles">
            <div className="chemistry-table__header">
              <span className="chemistry-table__th">Имя</span>
              <span className="chemistry-table__th chemistry-table__th--num">Кг</span>
              <span className="chemistry-table__th chemistry-table__th--num">Граммы</span>
              <span className="chemistry-table__th chemistry-table__th--actions"> </span>
            </div>
            {sorted.map((p) => (
              <ProfileRow key={p.id} profile={p} onSaved={refetchAll} />
            ))}
          </div>
        </div>
      )}

      {addOpen ? (
        <AddProfileModal onClose={() => setAddOpen(false)} onCreated={refetchAll} />
      ) : null}
    </div>
  );
};

export default ChemistryPlasticProfilesTab;
