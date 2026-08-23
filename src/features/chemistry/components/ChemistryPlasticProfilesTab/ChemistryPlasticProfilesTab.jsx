import React, { useMemo, useState, useCallback } from 'react';
import {
  FiPlus, FiCheck, FiX, FiTag, FiHash, FiLayers, FiDollarSign,
} from 'react-icons/fi';
import { useOperationalRefetch, WS_WORKSHOP } from '../../../../shared/realtime';
import {
  useServerQuery,
  formatNumberForInput,
  parseLocaleNumber,
} from '../../../../shared/lib';
import {
  ActionMenu,
  Loading,
  ErrorState,
  EmptyState,
  useToast,
  DecimalInput,
  ConfirmModal,
  RecordDetailsModal,
  DetailFields,
  Select,
  SearchInput,
  EntityAvatar,
} from '../../../../shared/ui';
import {
  createPlasticProfile,
  updatePlasticProfile,
  deletePlasticProfile,
} from '../../../production/api/productionApi';
import { readPlasticProfileWeightKg } from '../../../production/lib/readPlasticProfilePieceWeight';
import {
  PROFILE_EXTRA_EXPENSE_FIELDS,
  readProfileBlankId,
  readProfileBlankName,
  readProfileCostPrice,
  readProfileMarkupAmount,
  readProfileExtraExpense,
  readProfileOtherExpensesTotal,
  formatMarkupPercentDisplay,
  formatProfileCostDisplay,
  formatProfileSalePriceDisplay,
  calcProfileSaleUnitPrice,
  buildPlasticProfileExpensePayload,
} from '../../../production/lib/plasticProfilePricing';
import { mapWorkshopBlankFromApi } from '../../api/blankWorkshopApi';
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

const normProfileName = (s) => String(s ?? '').trim().toLowerCase();

const findProfileByName = (items, name, excludeId = null) => {
  const key = normProfileName(name);
  if (!key) return null;
  return items.find((p) => {
    if (excludeId != null && String(p.id) === String(excludeId)) return false;
    return normProfileName(p.name) === key;
  }) ?? null;
};

const profileDisplayName = (p) => p?.name || '—';

const initExpenseStr = (profile, apiKey) => {
  if (!profile) return '';
  const n = readProfileExtraExpense(profile, apiKey);
  return n > 0 ? formatNumberForInput(n) : '';
};

const ProfileFormModal = ({ mode, profile, onClose, onSaved, existingProfiles = [], blanks = [] }) => {
  const toast = useToast();
  const isEdit = mode === 'edit';
  const serverWeight = isEdit ? readPlasticProfileWeightKg(profile) : null;
  const serverCost = isEdit ? readProfileCostPrice(profile) : null;
  const serverMarkup = isEdit ? readProfileMarkupAmount(profile) : null;

  const [name, setName] = useState(isEdit ? profile?.name || '' : '');
  const [blankId, setBlankId] = useState(isEdit ? readProfileBlankId(profile) : '');
  const [kgStr, setKgStr] = useState(() => {
    if (!isEdit || serverWeight == null) return '';
    return splitTotalKgToFields(serverWeight).kgStr;
  });
  const [gramsStr, setGramsStr] = useState(() => {
    if (!isEdit || serverWeight == null) return '';
    return splitTotalKgToFields(serverWeight).gramsStr;
  });
  const [expenseStr, setExpenseStr] = useState(() => {
    const init = {};
    PROFILE_EXTRA_EXPENSE_FIELDS.forEach(({ apiKey }) => {
      init[apiKey] = initExpenseStr(profile, apiKey);
    });
    return init;
  });
  const [markupStr, setMarkupStr] = useState(
    isEdit && serverMarkup != null ? formatNumberForInput(serverMarkup) : '',
  );
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState('');

  const blankOptions = useMemo(
    () =>
      (blanks || []).map((b) => ({
        value: String(b.id),
        label: b.name || `#${b.id}`,
      })),
    [blanks],
  );

  const markupNum = parseLocaleNumber(markupStr);
  const markupPctDisplay = formatMarkupPercentDisplay(serverCost, markupNum);
  const expensePayloadPreview = useMemo(
    () => buildPlasticProfileExpensePayload(expenseStr),
    [expenseStr],
  );
  const otherExpensesTotal = useMemo(
    () => Object.values(expensePayloadPreview).reduce((s, n) => s + (Number(n) || 0), 0),
    [expensePayloadPreview],
  );
  const salePricePreview = serverCost != null
    ? calcProfileSaleUnitPrice(serverCost, otherExpensesTotal, markupNum >= 0 ? markupNum : 0)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.warning('Введите имя.');
      return;
    }
    const duplicate = findProfileByName(existingProfiles, n, isEdit ? profile?.id : null);
    if (duplicate) {
      setValidationError(`Товар «${profileDisplayName(duplicate)}» уже есть в списке.`);
      return;
    }
    setValidationError('');
    if (!blankId) {
      toast.warning('Выберите заготовку.');
      return;
    }
    const pieceKg = calcPieceKg(kgStr, gramsStr);
    if (!Number.isFinite(pieceKg) || pieceKg <= 0) {
      toast.warning('Укажите вес одной штуки (кг и/или граммы).');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: n,
        blank_id: Number(blankId),
        weight_kg_per_piece: pieceKg,
        markup_amount: Number.isFinite(markupNum) && markupNum >= 0 ? markupNum : 0,
        ...buildPlasticProfileExpensePayload(expenseStr),
      };
      if (isEdit) {
        await updatePlasticProfile(profile.id, payload);
        toast.success('Сохранено');
      } else {
        await createPlasticProfile({
          ...payload,
          code: buildAutoPlasticCode(),
          is_active: true,
          comment: '',
        });
        toast.success('Товар создан');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.apiError(err, isEdit ? 'Не удалось сохранить' : 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__head-titles">
            <span className="modal__eyebrow">{isEdit ? 'Редактирование' : 'Новый товар'}</span>
            <h3>{isEdit ? 'Редактировать товар' : 'Новый товар'}</h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть" disabled={busy}>
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label-icon"><FiTag aria-hidden size={15} strokeWidth={2} />Имя *</label>
            <input
              value={name}
              onChange={(ev) => {
                setName(ev.target.value);
                if (validationError) setValidationError('');
              }}
              autoComplete="off"
              required
            />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiHash aria-hidden size={15} strokeWidth={2} />Кг</label>
            <DecimalInput min={0} value={kgStr} onChange={setKgStr} placeholder="0" />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiHash aria-hidden size={15} strokeWidth={2} />Граммы (0–999)</label>
            <input
              inputMode="numeric"
              className="chemistry-plastic-profiles__grams chemistry-plastic-profiles__grams--wide"
              value={gramsStr}
              onChange={(ev) => setGramsStr(clampGramsInput(ev.target.value))}
              placeholder="0–999"
            />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiLayers aria-hidden size={15} strokeWidth={2} />Заготовка *</label>
            <Select
              icon={FiLayers}
              value={blankId === '' ? '' : String(blankId)}
              onChange={setBlankId}
              placeholder={blankOptions.length ? 'Выберите заготовку' : 'Нет заготовок'}
              options={blankOptions}
            />
          </div>
          <p className="chemistry-plastic-profiles__hint">
            В ОТК при учёте этой заготовки будут доступны только товары с этой привязкой.
          </p>
          <p className="chemistry-plastic-profiles__section-title">Прочие расходы на 1 шт, сом</p>
          {PROFILE_EXTRA_EXPENSE_FIELDS.map(({ apiKey, label }) => (
            <div className="modal__field" key={apiKey}>
              <label className="modal__label-icon"><FiDollarSign aria-hidden size={15} strokeWidth={2} />{label}</label>
              <DecimalInput
                min={0}
                value={expenseStr[apiKey] ?? ''}
                onChange={(v) => setExpenseStr((prev) => ({ ...prev, [apiKey]: v }))}
                placeholder="0"
              />
            </div>
          ))}
          <p className="chemistry-plastic-profiles__section-title">Цена</p>
          <div className="modal__field">
            <label className="modal__label-icon"><FiDollarSign aria-hidden size={15} strokeWidth={2} />Себестоимость, сом</label>
            <p className="chemistry-plastic-profiles__readonly-cost">
              {serverCost != null ? `${formatNumberForInput(serverCost)} сом` : '—'}
            </p>
          </div>
          {!isEdit || serverCost == null ? (
            <p className="chemistry-plastic-profiles__hint">
              Считается системой после первого учёта в ОТК. Изменить вручную нельзя.
            </p>
          ) : null}
          <div className="modal__field">
            <label className="modal__label-icon"><FiDollarSign aria-hidden size={15} strokeWidth={2} />Прочие расходы, сом</label>
            <p className="chemistry-plastic-profiles__readonly-cost">
              {formatNumberForInput(otherExpensesTotal)} сом
            </p>
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiDollarSign aria-hidden size={15} strokeWidth={2} />Наценка, сом</label>
            <div className="chemistry-plastic-profiles__markup-row">
              <DecimalInput min={0} value={markupStr} onChange={setMarkupStr} placeholder="0" />
              <span className="chemistry-plastic-profiles__markup-pct" title="% от себестоимости">
                {markupPctDisplay}
              </span>
            </div>
          </div>
          {serverCost == null ? (
            <p className="chemistry-plastic-profiles__hint">
              % наценки появится после расчёта себестоимости системой.
            </p>
          ) : null}
          <div className="modal__field">
            <label className="modal__label-icon"><FiDollarSign aria-hidden size={15} strokeWidth={2} />Итого цена товара, сом</label>
            <p className="chemistry-plastic-profiles__readonly-cost chemistry-plastic-profiles__readonly-cost--total">
              {salePricePreview != null ? `${formatNumberForInput(salePricePreview)} сом` : '—'}
            </p>
          </div>
          <p className="chemistry-plastic-profiles__hint">
            Себестоимость + прочие расходы + наценка.
          </p>
          {validationError && <p className="modal__error">{validationError}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const profileDetailRows = (profile) => {
  const serverWeight = readPlasticProfileWeightKg(profile);
  const viewKgGrams = splitTotalKgToFields(serverWeight);
  const viewKgDisplay = viewKgGrams.kgStr === '' && viewKgGrams.gramsStr === '' ? '—' : (viewKgGrams.kgStr || '0');
  const viewGramsDisplay = viewKgGrams.gramsStr === '' ? '—' : viewKgGrams.gramsStr;
  const extras = readProfileOtherExpensesTotal(profile);
  return [
    { section: 'Состав', label: 'Кг', value: viewKgDisplay },
    { section: 'Состав', label: 'Граммы', value: viewGramsDisplay },
    { section: 'Состав', label: 'Заготовка', value: readProfileBlankName(profile) || readProfileBlankId(profile) || '—' },
    ...PROFILE_EXTRA_EXPENSE_FIELDS.map(({ apiKey, label }) => ({
      section: 'Расходы',
      label,
      value: readProfileExtraExpense(profile, apiKey) > 0
        ? `${formatNumberForInput(readProfileExtraExpense(profile, apiKey))} сом`
        : '0 сом',
    })),
    { section: 'Расходы', label: 'Себестоимость', value: formatProfileCostDisplay(profile) },
    { section: 'Расходы', label: 'Прочие расходы', value: `${formatNumberForInput(extras)} сом` },
    {
      section: 'Цена',
      label: 'Наценка',
      value: readProfileMarkupAmount(profile) != null
        ? `${formatNumberForInput(readProfileMarkupAmount(profile))} сом`
        : '—',
    },
    {
      section: 'Цена',
      label: 'Наценка, %',
      value: formatMarkupPercentDisplay(readProfileCostPrice(profile), readProfileMarkupAmount(profile)),
    },
    { section: 'Цена', label: 'Итого цена', value: formatProfileSalePriceDisplay(profile) },
  ];
};

const ProfileRow = ({ profile, onDetails, onEdit, onDeleteRequest }) => (
  <div className="chemistry-table__row chemistry-table__row--plastic-profile-compact">
    <span className="chemistry-plastic-profiles__text chemistry-plastic-profiles__text--name chemistry-table__name--with-avatar">
      <EntityAvatar name={profile.name} size={28} />
      {profile.name || '—'}
    </span>
    <div className="chemistry-table__actions chemistry-table__actions--wrap">
      <button type="button" className="action-row__btn" onClick={() => onDetails?.(profile)}>
        Подробнее
      </button>
      <ActionMenu
        ariaLabel="Действия"
        items={[
          { label: 'Редактировать', onClick: () => onEdit?.(profile) },
          { label: 'Удалить', danger: true, onClick: () => onDeleteRequest?.(profile) },
        ]}
      />
    </div>
  </div>
);

const ChemistryPlasticProfilesTab = () => {
  const toast = useToast();
  const [formModal, setFormModal] = useState(null);
  const [detailProfile, setDetailProfile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [search, setSearch] = useState('');
  const {
    items: profiles,
    loading,
    error,
    refetch,
  } = useServerQuery('plastic-profiles/', listQ, { enabled: true });
  const { items: blankItems } = useServerQuery('workshop/blanks/', listQ, { enabled: true });
  const blanks = useMemo(
    () => (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean),
    [blankItems],
  );

  const sorted = useMemo(() => {
    const list = [...(profiles || [])];
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    return list;
  }, [profiles]);

  const visibleProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => String(p.name || '').toLowerCase().includes(q));
  }, [sorted, search]);

  const refetchAll = useCallback(() => {
    refetch();
  }, [refetch]);

  useOperationalRefetch(WS_WORKSHOP, refetchAll, true);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteError('');
    setDeleteBusy(true);
    try {
      await deletePlasticProfile(deleteTarget.id);
      toast.success(`Товар «${deleteTarget.name || ''}» удалён`);
      setDeleteTarget(null);
      refetchAll();
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.response?.data?.detail || 'Не удалось удалить.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="chemistry-card">
      <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
        <div className="ds-toolbar__start">
          <SearchInput placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ds-toolbar__end chemistry-card__toolbar-actions">
          <button type="button" className="btn btn--primary" onClick={() => setFormModal({ mode: 'add' })}>
            <FiPlus aria-hidden size={16} strokeWidth={2} />
            Товар
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetchAll} />}
      {!loading && !error && sorted.length === 0 && (
        <EmptyState title="Нет товаров — нажмите «Добавить товар»" />
      )}
      {!loading && !error && sorted.length > 0 && visibleProfiles.length === 0 && (
        <EmptyState title="Ничего не найдено" />
      )}
      {!loading && !error && visibleProfiles.length > 0 && (
        <div className="chemistry-table-wrap">
          <div className="chemistry-table chemistry-table--plastic-profiles chemistry-table--plastic-profiles-compact">
            <div className="chemistry-table__header">
              <span className="chemistry-table__th">Товар</span>
              <span className="chemistry-table__th chemistry-table__th--actions"> </span>
            </div>
            {visibleProfiles.map((p) => (
              <ProfileRow
                key={p.id}
                profile={p}
                onDetails={(item) => setDetailProfile(item)}
                onEdit={(item) => setFormModal({ mode: 'edit', profile: item })}
                onDeleteRequest={(item) => {
                  setDeleteError('');
                  setDeleteTarget({ id: item.id, name: item.name });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {detailProfile ? (
        <RecordDetailsModal
          open
          onClose={() => setDetailProfile(null)}
          title={detailProfile.name || 'Товар'}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setDetailProfile(null)}>
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setDetailProfile(null);
                  setFormModal({ mode: 'edit', profile: detailProfile });
                }}
              >
                Редактировать
              </button>
            </>
          )}
        >
          <DetailFields rows={profileDetailRows(detailProfile)} />
        </RecordDetailsModal>
      ) : null}

      {formModal ? (
        <ProfileFormModal
          mode={formModal.mode}
          profile={formModal.profile}
          existingProfiles={sorted}
          blanks={blanks}
          onClose={() => setFormModal(null)}
          onSaved={refetchAll}
        />
      ) : null}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить товар?"
        message={deleteTarget ? `Удалить «${deleteTarget.name || ''}»?` : ''}
        confirmText="Удалить"
        confirmBusy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleteBusy) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
        error={deleteError}
      />
    </div>
  );
};

export default ChemistryPlasticProfilesTab;
