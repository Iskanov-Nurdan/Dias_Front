import React, { useEffect, useMemo, useState } from 'react';
import {
  getPlasticProfiles,
  createProductionBatch,
} from '../../production/api/productionApi';
import {
  fetchLinesWithShiftSnapshot,
  LINES_QUERY_OPEN_SHIFT_FOR_PRODUCTION_BATCH,
} from '../api/linesApi';
import { apiClient } from '../../../shared/api';
import {
  getApiErrorMessage,
  parseLocaleNumber,
  parseApiListResponse,
} from '../../../shared/lib';
import { Loading, DecimalInput, IntegerInput, Select } from '../../../shared/ui';

const isLineEligibleForBatch = (ln) => {
  if (!ln || typeof ln !== 'object') return false;
  const open = ln.shift_is_open === true || ln.isOpen === true;
  if (!open) return false;
  if (ln.shift_is_paused === true || ln.isPaused === true) return false;
  const snap = ln.shift_snapshot || ln.shiftSnapshot;
  if (snap && (snap.is_paused === true || snap.paused === true)) return false;
  return true;
};

/**
 * Создание партии профиля: POST /api/batches/ (ProductionBatchCreateUpdateSerializer).
 * total_meters считает только бэкенд.
 * lineId опционален: без него показывается выбор линии (только с открытой сменой).
 * Порядок полей в форме: профиль → рецепт → линия (если выбирается) → штуки → длина. Без ввода total_meters и себестоимости.
 */
const ProductionBatchModal = ({ lineId: lineIdProp, lineName, onClose, onSuccess }) => {
  const needsLinePick = lineIdProp == null || lineIdProp === '';
  const [pickedLineId, setPickedLineId] = useState(
    needsLinePick ? '' : String(lineIdProp),
  );
  const [lines, setLines] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [profileId, setProfileId] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [pieces, setPieces] = useState('');
  const [lengthPerPiece, setLengthPerPiece] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    const linesPromise = needsLinePick
      ? fetchLinesWithShiftSnapshot({
        page_size: 200,
        ...LINES_QUERY_OPEN_SHIFT_FOR_PRODUCTION_BATCH,
      }).catch(() => [])
      : Promise.resolve([]);
    Promise.all([
      linesPromise,
      getPlasticProfiles({ page_size: 500 }).then((r) => parseApiListResponse(r.data)),
      apiClient.get('recipes/', { params: { page_size: 500 } }).then((r) => parseApiListResponse(r.data)),
    ])
      .then(([ln, p, rec]) => {
        if (!cancelled) {
          if (needsLinePick) setLines(Array.isArray(ln) ? ln : []);
          setProfiles(p);
          setRecipes(rec);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLines([]);
          setProfiles([]);
          setRecipes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsLinePick]);

  const eligibleLines = useMemo(() => (lines || []).filter(isLineEligibleForBatch), [lines]);

  const resolvedLineId = needsLinePick ? pickedLineId : String(lineIdProp);
  const resolvedLineName = useMemo(() => {
    if (lineName) return lineName;
    if (!needsLinePick || !pickedLineId) return '';
    const ln = eligibleLines.find((l) => String(l.id) === String(pickedLineId));
    return ln?.name || '';
  }, [lineName, needsLinePick, pickedLineId, eligibleLines]);

  const recipesForProfile = useMemo(() => {
    if (!profileId) return [];
    const pid = Number(profileId);
    return recipes.filter((r) => {
      const rid = r.profile_id ?? r.profile?.id;
      return rid != null && Number(rid) === pid;
    });
  }, [recipes, profileId]);

  useEffect(() => {
    setRecipeId('');
  }, [profileId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const p = parseInt(String(pieces).trim(), 10);
    const len = parseLocaleNumber(lengthPerPiece);
    const rid = recipeId ? Number(recipeId) : NaN;
    const prid = profileId ? Number(profileId) : NaN;
    if (!profiles.length) {
      setError('Сначала создайте профиль (раздел «Профили»).');
      return;
    }
    if (!Number.isFinite(prid) || prid <= 0) {
      setError('Выберите профиль');
      return;
    }
    if (!Number.isFinite(rid) || rid <= 0) {
      setError('Выберите рецепт для этого профиля');
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setError('Укажите количество штук > 0');
      return;
    }
    if (!Number.isFinite(len) || len <= 0) {
      setError('Укажите длину одной штуки, м > 0');
      return;
    }
    const lid = Number(resolvedLineId);
    if (!Number.isFinite(lid) || lid <= 0) {
      setError('Выберите линию с открытой сменой');
      return;
    }
    if (needsLinePick && !eligibleLines.some((l) => String(l.id) === String(resolvedLineId))) {
      setError('Линия недоступна для партии (смена закрыта или на паузе).');
      return;
    }
    setSaving(true);
    try {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await createProductionBatch({
        profile: prid,
        recipe: rid,
        line: lid,
        date,
        pieces: p,
        length_per_piece: len,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Ошибка создания партии'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая партия{resolvedLineName ? ` — ${resolvedLineName}` : ''}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body">
          {loadingMeta ? (
            <Loading />
          ) : (
            <form onSubmit={handleSubmit}>
              {profiles.length === 0 && (
                <p className="modal__error" role="alert">
                  Нет профилей. Сначала создайте профиль в разделе «Профили», затем рецепт — без них партию не создать.
                </p>
              )}
              <label>Профиль *</label>
              <Select
                value={profileId === '' ? '' : String(profileId)}
                onChange={setProfileId}
                placeholder={profiles.length ? 'Выберите профиль' : 'Сначала создайте профиль'}
                disabled={!profiles.length}
                options={profiles.map((p) => ({
                  value: String(p.id),
                  label: p.name || 'Профиль',
                }))}
              />
              <label>Рецепт (норма на 1 м, только для выбранного профиля) *</label>
              <Select
                value={recipeId === '' ? '' : String(recipeId)}
                onChange={setRecipeId}
                placeholder={profileId ? 'Выберите рецепт' : 'Сначала выберите профиль'}
                disabled={!profileId}
                options={recipesForProfile.map((r) => ({
                  value: String(r.id),
                  label: r.recipe || r.name || r.product || 'Рецепт',
                }))}
              />
              {needsLinePick && (
                <>
                  <label>Линия *</label>
                  <Select
                    value={pickedLineId === '' ? '' : String(pickedLineId)}
                    onChange={setPickedLineId}
                    placeholder={eligibleLines.length ? 'Выберите линию' : 'Нет линий с активной сменой'}
                    options={eligibleLines.map((ln) => {
                      const snap = ln.shift_snapshot || ln.shiftSnapshot;
                      const params = snap
                        ? ` · ${snap.height ?? '—'}×${snap.width ?? '—'}`
                        : '';
                      return { value: String(ln.id), label: `${ln.name || 'Линия'}${params}` };
                    })}
                  />
                  {eligibleLines.length === 0 && (
                    <p className="modal__error">Откройте смену на линии без остановки — иначе партию не создать.</p>
                  )}
                </>
              )}
              <label>Количество штук *</label>
              <IntegerInput min={1} value={pieces} onChange={setPieces} required placeholder="Напр. 20" className="input" />
              <label>Длина одной штуки, м *</label>
              <DecimalInput
                min={0}
                value={lengthPerPiece}
                onChange={setLengthPerPiece}
                required
                placeholder="Напр. 6"
              />
              <label>Комментарий</label>
              <textarea rows={2} value={comment} onChange={(ev) => setComment(ev.target.value)} />
              {error && <p className="modal__error">{error}</p>}
              <div className="modal__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !profiles.length}
                >
                  {saving ? 'Создание…' : 'Создать партию'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionBatchModal;
