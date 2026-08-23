import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiCheck, FiX, FiTag, FiHash, FiMessageSquare, FiPackage, FiToggleRight,
} from 'react-icons/fi';
import { useServerQuery, getApiErrorMessage, formatNumberForInput, parseLocaleNumber } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast, Select, SearchInput, ActionMenu, DecimalInput, EntityAvatar } from '../../../../shared/ui';
import {
  createPlasticProfile,
  updatePlasticProfile,
  deletePlasticProfile,
} from '../../../production/api/productionApi';
import { readPlasticProfileWeightKg } from '../../../production/lib/readPlasticProfilePieceWeight';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './PlasticProfilesPage.scss';

const recipeTitle = (r) =>
  r.recipe || r.recipe_name || r.name || r.product || r.product_name || '—';

const canDeleteProfile = (p) => p?.deletable === true;

const PlasticProfilesPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [metaModal, setMetaModal] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const profileQuery = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);
  const {
    items: profiles,
    loading,
    error,
    refetch: refetchProfiles,
  } = useServerQuery('plastic-profiles/', profileQuery, { enabled: true });

  const recipeQuery = useMemo(() => ({ page: 1, page_size: 500 }), []);
  const {
    items: allRecipes,
    refetch: refetchRecipes,
  } = useServerQuery('recipes/', recipeQuery, { enabled: true });

  const refetchAll = useCallback(() => {
    refetchProfiles();
    refetchRecipes();
  }, [refetchProfiles, refetchRecipes]);

  useOperationalRefetch(
    ['plastic_profile', 'recipe', 'recipes', 'production_batch', 'batch'],
    refetchAll,
    true,
  );

  const recipesByProfileId = useMemo(() => {
    const m = new Map();
    (allRecipes || []).forEach((r) => {
      const pid = r.profile_id ?? r.profile?.id;
      if (pid == null) return;
      const k = Number(pid);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ id: r.id, title: recipeTitle(r) });
    });
    return m;
  }, [allRecipes]);

  const filtered = useMemo(() => {
    const list = profiles || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const blob = [p.name, p.code, p.id].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [profiles, search]);

  const goCreateRecipe = useCallback(
    (profileId) => {
      navigate(`/chemistry?profile_id=${profileId}&open=recipe`);
    },
    [navigate],
  );

  const goRecipesFiltered = useCallback(
    (profileId) => {
      navigate(`/chemistry?filter_profile_id=${profileId}`);
    },
    [navigate],
  );

  const handleMetaSave = async (payload) => {
    setSubmitError('');
    try {
      if (metaModal?.id) {
        await updatePlasticProfile(metaModal.id, payload);
        toast.success('Сохранено');
      } else {
        await createPlasticProfile(payload);
        toast.success('Профиль создан');
      }
      setMetaModal(null);
      refetchAll();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка'));
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget?.id) return;
    setDeactivateError('');
    try {
      await updatePlasticProfile(deactivateTarget.id, { is_active: false });
      setDeactivateTarget(null);
      refetchAll();
      toast.success('Деактивировано');
    } catch (err) {
      setDeactivateError(getApiErrorMessage(err, 'Ошибка'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deletePlasticProfile(deleteTarget.id);
      setDeleteTarget(null);
      refetchAll();
      toast.success('Удалено');
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Ошибка удаления'));
    }
  };

  return (
    <div className="page page--plastic-profiles">
      <div className="plastic-profiles-card">
        <div className="plastic-profiles-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <SearchInput
              className="plastic-profiles-card__search"
              placeholder="Поиск по названию, коду…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => { setSubmitError(''); setMetaModal({}); }}>
              <FiPlus aria-hidden size={16} strokeWidth={2} />
              Профиль
            </button>
          </div>
        </div>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={refetchProfiles} />}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="Нет профилей" />
        ) : !loading && !error ? (
          <div className="plastic-profiles-table-wrap">
            <div className="plastic-profiles-table">
              <div className="plastic-profiles-table__header">
                <span className="plastic-profiles-table__th">Название</span>
                <span className="plastic-profiles-table__th">Код</span>
                <span className="plastic-profiles-table__th">Есть рецепт</span>
                <span className="plastic-profiles-table__th">Статус</span>
                <span className="plastic-profiles-table__th plastic-profiles-table__th--actions">Действия</span>
              </div>
              {filtered.map((p) => {
                const recs = recipesByProfileId.get(Number(p.id)) || [];
                const hasRecipe = recs.length > 0;
                const active = p.is_active !== false;
                return (
                  <div key={p.id} className="plastic-profiles-table__block">
                    <div className="plastic-profiles-table__row">
                      <span className="plastic-profiles-table__name plastic-profiles-table__name--with-avatar">
                        <EntityAvatar name={p.name || '—'} size={28} />
                        {p.name || '—'}
                      </span>
                      <span className="plastic-profiles-table__code">{p.code || '—'}</span>
                      <span className="plastic-profiles-table__has">{hasRecipe ? 'да' : 'нет'}</span>
                      <span className="plastic-profiles-table__status">{active ? 'активен' : 'неактивен'}</span>
                      <div className="plastic-profiles-table__actions">
                        <ActionMenu
                          items={[
                            { label: 'Создать рецепт', onClick: () => goCreateRecipe(p.id) },
                            { label: 'Рецепты', onClick: () => goRecipesFiltered(p.id) },
                            { label: 'Редактировать', onClick: () => { setSubmitError(''); setMetaModal(p); } },
                            ...(active
                              ? [{ label: 'Деактивировать', onClick: () => { setDeactivateError(''); setDeactivateTarget(p); } }]
                              : []),
                            ...(canDeleteProfile(p)
                              ? [{ label: 'Удалить', danger: true, onClick: () => { setDeleteError(''); setDeleteTarget({ id: p.id, name: p.name }); } }]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                    {recs.length > 0 && (
                      <div className="plastic-profiles-table__recipes" title={recs.map((x) => x.title).join(', ')}>
                        {recs.map((x) => x.title).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {metaModal !== null && (
        <ProfileMetaModal
          initial={metaModal?.id ? metaModal : null}
          onSave={handleMetaSave}
          onClose={() => { setMetaModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deactivateTarget}
        title="Деактивировать профиль?"
        message={deactivateTarget ? `«${deactivateTarget.name || ''}» — снять с использования?` : ''}
        confirmText="Деактивировать"
        onConfirm={handleDeactivate}
        onCancel={() => { setDeactivateTarget(null); setDeactivateError(''); }}
        error={deactivateError}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить профиль?"
        message={deleteTarget ? `Удалить «${deleteTarget.name}»? Только если нет рецептов и производства.` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        error={deleteError}
      />
    </div>
  );
};

const ProfileMetaModal = ({ initial, onSave, onClose, error }) => {
  const isEdit = !!initial?.id;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [comment, setComment] = useState('');
  const [statusActive, setStatusActive] = useState(true);
  const [weightKgStr, setWeightKgStr] = useState('');

  useEffect(() => {
    if (isEdit && initial) {
      setName(initial.name || '');
      setCode(initial.code || '');
      setComment(initial.comment ?? initial.note ?? '');
      setStatusActive(initial.is_active !== false);
      const w = readPlasticProfileWeightKg(initial);
      setWeightKgStr(w != null ? formatNumberForInput(w) : '');
    } else {
      setName('');
      setCode('');
      setComment('');
      setStatusActive(true);
      setWeightKgStr('');
    }
  }, [isEdit, initial]);

  const canSave = name.trim().length > 0 && code.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    const body = {
      name: name.trim(),
      code: code.trim(),
      is_active: statusActive,
      ...(comment.trim() ? { comment: comment.trim() } : { comment: '' }),
    };
    const w = parseLocaleNumber(String(weightKgStr ?? '').trim());
    if (Number.isFinite(w) && w > 0) {
      body.weight_kg_per_piece = w;
    }
    onSave(body);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__head-titles">
            <span className="modal__eyebrow">{isEdit ? 'Редактирование' : 'Новый профиль'}</span>
            <h3>{isEdit ? 'Редактировать профиль' : 'Добавить профиль'}</h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label-icon"><FiTag aria-hidden size={15} strokeWidth={2} />Название *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Профиль 60"
              autoComplete="off"
            />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiHash aria-hidden size={15} strokeWidth={2} />Код *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Например: P60"
              autoComplete="off"
            />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiMessageSquare aria-hidden size={15} strokeWidth={2} />Комментарий</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          </div>
          <div className="modal__field">
            <label className="modal__label-icon"><FiPackage aria-hidden size={15} strokeWidth={2} />Вес одной штуки, кг</label>
            <DecimalInput
              min={0}
              value={weightKgStr}
              onChange={setWeightKgStr}
              placeholder="Например 2,5 — для ОТК и склада ГП"
            />
          </div>
          <p className="plastic-profiles-modal__hint">Нужен для окна «Произвести», ОТК и склада ГП.</p>
          <div className="modal__field">
            <label className="modal__label-icon"><FiToggleRight aria-hidden size={15} strokeWidth={2} />Статус *</label>
            <Select
              icon={FiToggleRight}
              value={statusActive ? 'active' : 'inactive'}
              onChange={(v) => setStatusActive(v === 'active')}
              options={[
                { value: 'active', label: 'активен' },
                { value: 'inactive', label: 'неактивен' },
              ]}
            />
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSave}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlasticProfilesPage;
