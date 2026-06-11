import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, DecimalInput, IntegerInput, useToast } from '../../../../shared/ui';
import {
  formatNumberForInput,
  getApiErrorMessage,
  parseLocaleNumber,
  useServerQuery,
} from '../../../../shared/lib';
import { readPlasticProfileWeightKg } from '../../../production/lib/readPlasticProfilePieceWeight';
import { readProfileBlankId, readProfileBlankName } from '../../../production/lib/plasticProfilePricing';
import { getAllUsers } from '../../../shifts/api/shiftsApi';
import {
  buildOtkAccountPayload,
  OTK_SHIFT_PERIODS,
  postOtkAccountSession,
} from '../../api/otkWorkshopApi';
import {
  calcOtkAccountConsumptionByBlank,
  calcOtkAccountConsumptionKg,
  findOtkBlankOverages,
} from '../../lib/otkBlankPoolUtils';
import './OtkAccountModal.scss';

const emptyProfileLine = () => ({ profileId: '', pieces: '' });

const OtkAccountModal = ({ pool = [], onClose, onSaved }) => {
  const toast = useToast();
  const [profileLines, setProfileLines] = useState([emptyProfileLine()]);
  const [defectKgStr, setDefectKgStr] = useState('');
  const [defectBlankId, setDefectBlankId] = useState('');
  const [shiftPeriod, setShiftPeriod] = useState('day');
  const [operatorId, setOperatorId] = useState('');
  const [chemistId, setChemistId] = useState('');
  const [packerIds, setPackerIds] = useState([]);
  const [packerPick, setPackerPick] = useState('');
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const listQ = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);
  const { items: profileItems } = useServerQuery('plastic-profiles/', listQ, { enabled: true });

  useEffect(() => {
    let alive = true;
    getAllUsers({ page: 1, page_size: 500, is_active: true })
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        setEmployees(Array.isArray(data.items) ? data.items : Array.isArray(data.results) ? data.results : []);
      })
      .catch(() => {
        if (alive) setEmployees([]);
      });
    return () => { alive = false; };
  }, []);

  const poolByBlankId = useMemo(() => {
    const m = new Map();
    (pool || []).forEach((p) => {
      if (p?.blankId) m.set(String(p.blankId), p);
    });
    return m;
  }, [pool]);

  const profilesById = useMemo(() => {
    const m = new Map();
    (profileItems || []).forEach((p) => {
      const blankId = readProfileBlankId(p);
      if (!blankId) return;
      const poolRow = poolByBlankId.get(blankId);
      const w = readPlasticProfileWeightKg(p);
      m.set(String(p.id), {
        id: String(p.id),
        name: p.name || p.code || `#${p.id}`,
        weightKg: w,
        blankId,
        blankName: poolRow?.blankName || readProfileBlankName(p) || 'Заготовка',
        remainingKg: poolRow?.remainingKg ?? 0,
      });
    });
    return m;
  }, [profileItems, poolByBlankId]);

  const profileOptions = useMemo(
    () =>
      Array.from(profilesById.values()).map((p) => ({
        value: p.id,
        label: `${p.name} — ${p.blankName}`,
      })),
    [profilesById],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((u) => ({
        value: String(u.id),
        label: u.name || u.full_name || u.username || `#${u.id}`,
      })),
    [employees],
  );

  const packerAddOptions = useMemo(
    () => employeeOptions.filter((o) => !packerIds.includes(o.value)),
    [employeeOptions, packerIds],
  );

  const defectKg = useMemo(() => {
    const trimmed = String(defectKgStr ?? '').trim();
    if (!trimmed) return 0;
    const n = parseLocaleNumber(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [defectKgStr]);

  const firstLineBlankId = useMemo(() => {
    for (const ln of profileLines) {
      if (!ln.profileId) continue;
      const prof = profilesById.get(String(ln.profileId));
      if (prof?.blankId) return String(prof.blankId);
    }
    return '';
  }, [profileLines, profilesById]);

  const effectiveDefectBlankId = defectBlankId || firstLineBlankId;

  const consumptionByBlank = useMemo(
    () =>
      calcOtkAccountConsumptionByBlank({
        profileLines,
        profilesById,
        defectKg: Number.isFinite(defectKg) ? defectKg : 0,
        defectBlankId: effectiveDefectBlankId,
      }),
    [profileLines, profilesById, defectKg, effectiveDefectBlankId],
  );

  const consumedKg = useMemo(
    () => calcOtkAccountConsumptionKg({
      profileLines,
      profilesById,
      defectKg: Number.isFinite(defectKg) ? defectKg : 0,
      defectBlankId: effectiveDefectBlankId,
    }),
    [profileLines, profilesById, defectKg, effectiveDefectBlankId],
  );

  const overages = useMemo(
    () => findOtkBlankOverages(consumptionByBlank, poolByBlankId),
    [consumptionByBlank, poolByBlankId],
  );

  const blankBreakdown = useMemo(() => {
    const rows = [];
    consumptionByBlank.forEach((kg, blankId) => {
      const poolRow = poolByBlankId.get(String(blankId));
      const remaining = poolRow?.remainingKg ?? 0;
      rows.push({
        blankId: String(blankId),
        blankName: poolRow?.blankName || `Заготовка #${blankId}`,
        consumedKg: kg,
        remainingKg: remaining,
        afterKg: Math.max(0, remaining - kg),
      });
    });
    return rows.sort((a, b) => a.blankName.localeCompare(b.blankName, 'ru'));
  }, [consumptionByBlank, poolByBlankId]);

  const defectBlankOptions = useMemo(() => {
    const ids = new Set();
    profileLines.forEach((ln) => {
      const prof = ln.profileId ? profilesById.get(String(ln.profileId)) : null;
      if (prof?.blankId) ids.add(String(prof.blankId));
    });
    return Array.from(ids).map((id) => {
      const poolRow = poolByBlankId.get(id);
      const prof = Array.from(profilesById.values()).find((p) => p.blankId === id);
      return {
        value: id,
        label: poolRow?.blankName || prof?.blankName || `Заготовка #${id}`,
      };
    });
  }, [profileLines, profilesById, poolByBlankId]);

  const hasValidLines = profileLines.some(
    (ln) => ln.profileId && Math.floor(Number(ln.pieces)) > 0,
  );
  const defectOk = String(defectKgStr ?? '').trim() === '' || (Number.isFinite(defectKg) && defectKg >= 0);
  const defectBlankOk = defectKg <= 0 || Boolean(effectiveDefectBlankId);
  const canSubmit = hasValidLines && defectOk && defectBlankOk && overages.length === 0 && consumedKg > 0;

  const addProfileLine = () => setProfileLines((prev) => [...prev, emptyProfileLine()]);

  const updateProfileLine = (idx, patch) => {
    setProfileLines((prev) => prev.map((ln, i) => (i === idx ? { ...ln, ...patch } : ln)));
  };

  const removeProfileLine = (idx) => {
    setProfileLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const addPacker = (id) => {
    const sid = id != null ? String(id) : '';
    if (!sid || packerIds.includes(sid)) return;
    setPackerIds((prev) => [...prev, sid]);
    setPackerPick('');
  };

  const removePacker = (id) => {
    setPackerIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      if (overages.length) toast.warning('Списание больше остатка по заготовке');
      else toast.warning('Добавьте профили с количеством');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildOtkAccountPayload({
        profileLines,
        defectKg: Number.isFinite(defectKg) && defectKg > 0 ? defectKg : 0,
        defectBlankId: effectiveDefectBlankId,
        shiftPeriod,
        operatorId,
        chemistId,
        packerIds,
      });
      await postOtkAccountSession(payload);
      toast.success('Учёт сохранён — товар на складе');
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Не удалось сохранить учёт');
      setError(msg);
      toast.apiError(err, msg);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="otk-account-overlay" onClick={onClose} role="presentation">
      <div
        className="otk-account-screen"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otk-account-title"
      >
        <header className="otk-account-screen__head">
          <div className="otk-account-screen__head-text">
            <h2 id="otk-account-title" className="otk-account-screen__title">Учесть</h2>
            <p className="otk-account-screen__lead">
              Кг списываются с заготовки, привязанной к профилю. Брак — в кг, необязательно.
            </p>
          </div>
          <button
            type="button"
            className="otk-account-screen__close"
            onClick={onClose}
            aria-label="Закрыть"
            disabled={saving}
          >
            ×
          </button>
        </header>

        {blankBreakdown.length > 0 ? (
          <div className="otk-account-screen__stats otk-account-screen__stats--blanks">
            {blankBreakdown.map((row) => (
              <div
                key={row.blankId}
                className={`otk-account-screen__stat${row.consumedKg > row.remainingKg + 1e-6 ? ' otk-account-screen__stat--warn' : ''}`}
              >
                <span className="otk-account-screen__stat-label">{row.blankName}</span>
                <span className="otk-account-screen__stat-value">
                  −{formatNumberForInput(row.consumedKg)} кг
                  <span className="otk-account-screen__stat-sub">
                    останется {formatNumberForInput(row.afterKg)} кг
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="otk-account-screen__stats">
            <div className="otk-account-screen__stat">
              <span className="otk-account-screen__stat-label">Списание</span>
              <span className="otk-account-screen__stat-value">{formatNumberForInput(consumedKg)} кг</span>
            </div>
          </div>
        )}

        <form id="otk-account-form" className="otk-account-screen__form" onSubmit={handleSubmit}>
          <div className="otk-account-screen__body">
            <section className="otk-account-card otk-account-card--profiles">
              <div className="otk-account-card__head">
                <h3 className="otk-account-card__title">Профили (готовая продукция)</h3>
                <button type="button" className="btn btn--secondary btn--sm" onClick={addProfileLine}>
                  + Профиль
                </button>
              </div>
              {profileOptions.length === 0 ? (
                <p className="otk-account-card__hint">
                  Нет товаров с привязкой к заготовке. Добавьте в «Химия → Товары».
                </p>
              ) : null}
              <div className="otk-account-card__table">
                <div className="otk-account-card__table-head" aria-hidden="true">
                  <span>Профиль</span>
                  <span>Шт</span>
                  <span>Кг</span>
                  <span />
                </div>
                <div className="otk-account-card__table-body">
                  {profileLines.map((ln, idx) => {
                    const prof = ln.profileId ? profilesById.get(String(ln.profileId)) : null;
                    const pcs = Math.floor(Number(ln.pieces));
                    const lineKg = prof?.weightKg && pcs > 0 ? pcs * prof.weightKg : null;
                    return (
                      <div key={`pl-${idx}`} className="otk-account-card__table-row">
                        <div className="otk-account-card__field otk-account-card__field--grow">
                          <Select
                            value={ln.profileId}
                            onChange={(v) => updateProfileLine(idx, { profileId: v != null ? String(v) : '' })}
                            placeholder="Выберите профиль"
                            options={profileOptions}
                          />
                          {prof ? (
                            <span className="otk-account-card__line-hint">
                              Заготовка: {prof.blankName} ({formatNumberForInput(prof.remainingKg)} кг в ОТК)
                            </span>
                          ) : null}
                        </div>
                        <div className="otk-account-card__field otk-account-card__field--qty">
                          <IntegerInput
                            min={1}
                            value={ln.pieces}
                            onChange={(v) => updateProfileLine(idx, { pieces: v })}
                            placeholder="0"
                          />
                        </div>
                        <div className="otk-account-card__field otk-account-card__field--kg">
                          <span className="otk-account-card__kg-val">
                            {lineKg != null ? formatNumberForInput(lineKg) : '—'}
                          </span>
                        </div>
                        <div className="otk-account-card__field otk-account-card__field--action">
                          {profileLines.length > 1 ? (
                            <button
                              type="button"
                              className="otk-account-card__remove"
                              onClick={() => removeProfileLine(idx)}
                              aria-label="Удалить строку"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="otk-account-screen__side">
              <section className="otk-account-card">
                <h3 className="otk-account-card__title">Брак</h3>
                <div className="otk-account-card__field">
                  <span className="otk-account-card__label">Кг (необязательно)</span>
                  <DecimalInput min={0} value={defectKgStr} onChange={setDefectKgStr} placeholder="0" />
                </div>
                {defectKg > 0 && defectBlankOptions.length > 1 ? (
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">Заготовка для брака</span>
                    <Select
                      value={defectBlankId || firstLineBlankId}
                      onChange={(v) => setDefectBlankId(v != null ? String(v) : '')}
                      options={defectBlankOptions}
                    />
                  </div>
                ) : null}
                <p className="otk-account-card__hint">Брак возвращается в заготовку (цех).</p>
              </section>

              <section className="otk-account-card">
                <h3 className="otk-account-card__title">Сотрудники</h3>
                <div className="otk-account-card__field">
                  <span className="otk-account-card__label">Смена</span>
                  <Select
                    value={shiftPeriod}
                    onChange={(v) => setShiftPeriod(v === 'night' ? 'night' : 'day')}
                    options={OTK_SHIFT_PERIODS}
                  />
                </div>
                <div className="otk-account-card__grid otk-account-card__grid--2">
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">Оператор</span>
                    <Select
                      value={operatorId}
                      onChange={(v) => setOperatorId(v != null ? String(v) : '')}
                      placeholder="Выберите"
                      options={employeeOptions}
                    />
                  </div>
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">Химик</span>
                    <Select
                      value={chemistId}
                      onChange={(v) => setChemistId(v != null ? String(v) : '')}
                      placeholder="Выберите"
                      options={employeeOptions}
                    />
                  </div>
                </div>
                <div className="otk-account-card__field">
                  <span className="otk-account-card__label">Упаковщики</span>
                  {packerIds.length > 0 ? (
                    <div className="otk-account-packers">
                      {packerIds.map((id) => {
                        const opt = employeeOptions.find((o) => o.value === id);
                        return (
                          <span key={id} className="otk-account-packers__chip">
                            {opt?.label || `#${id}`}
                            <button
                              type="button"
                              className="otk-account-packers__remove"
                              onClick={() => removePacker(id)}
                              aria-label="Убрать"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="otk-account-card__hint otk-account-card__hint--inline">Можно выбрать несколько</p>
                  )}
                  {packerAddOptions.length > 0 ? (
                    <Select
                      value={packerPick}
                      onChange={(v) => addPacker(v)}
                      placeholder="Добавить упаковщика"
                      options={packerAddOptions}
                    />
                  ) : null}
                </div>
                <p className="otk-account-card__hint">
                  Смена «{shiftPeriod === 'night' ? 'Ночь' : 'День'}» — сотрудники попадут в отчёт смен.
                </p>
              </section>
            </aside>
          </div>

          {(error || overages.length > 0) ? (
            <div className="otk-account-screen__alerts">
              {error ? <p className="otk-account-screen__alert">{error}</p> : null}
              {overages.map((o) => (
                <p key={o.blankId} className="otk-account-screen__alert">
                  {o.blankName}: списание {formatNumberForInput(o.consumedKg)} кг, в ОТК {formatNumberForInput(o.remainingKg)} кг
                </p>
              ))}
            </div>
          ) : null}
        </form>

        <footer className="otk-account-screen__foot">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button
            type="submit"
            form="otk-account-form"
            className="btn btn--primary"
            disabled={!canSubmit || saving}
          >
            {saving ? 'Сохранение…' : 'Сохранить и на склад'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

export default OtkAccountModal;
