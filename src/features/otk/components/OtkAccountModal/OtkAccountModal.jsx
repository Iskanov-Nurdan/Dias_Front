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
import { getAllUsers } from '../../../shifts/api/shiftsApi';
import { buildOtkAccountPayload, postOtkAccount } from '../../api/otkWorkshopApi';
import { calcOtkAccountConsumptionKg } from '../../lib/otkBlankPoolUtils';
import './OtkAccountModal.scss';

const emptyProfileLine = () => ({ profileId: '', pieces: '' });

const OtkAccountModal = ({ poolEntry, onClose, onSaved }) => {
  const toast = useToast();
  const [profileLines, setProfileLines] = useState([emptyProfileLine()]);
  const [defectUnit, setDefectUnit] = useState('kg');
  const [defectValue, setDefectValue] = useState('');
  const [defectProfileId, setDefectProfileId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [chemistId, setChemistId] = useState('');
  const [packerId, setPackerId] = useState('');
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

  const profilesById = useMemo(() => {
    const m = new Map();
    (profileItems || []).forEach((p) => {
      const w = readPlasticProfileWeightKg(p);
      m.set(String(p.id), {
        id: String(p.id),
        name: p.name || p.code || `#${p.id}`,
        weightKg: w,
      });
    });
    return m;
  }, [profileItems]);

  const profileOptions = useMemo(
    () =>
      (profileItems || []).map((p) => ({
        value: String(p.id),
        label: p.name || p.code || `#${p.id}`,
      })),
    [profileItems],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((u) => ({
        value: String(u.id),
        label: u.name || u.full_name || u.username || `#${u.id}`,
      })),
    [employees],
  );

  const remainingKg = poolEntry?.remainingKg ?? 0;

  const defectParsed = useMemo(() => {
    const trimmed = String(defectValue ?? '').trim();
    if (!trimmed) return { unit: defectUnit, value: 0, profileId: defectProfileId };
    const n = defectUnit === 'pieces' ? Math.floor(Number(trimmed)) : parseLocaleNumber(trimmed);
    return {
      unit: defectUnit,
      value: Number.isFinite(n) && n >= 0 ? n : NaN,
      profileId: defectProfileId,
    };
  }, [defectUnit, defectValue, defectProfileId]);

  const consumedKg = useMemo(
    () =>
      calcOtkAccountConsumptionKg({
        profileLines: profileLines.map((ln) => ({
          profileId: ln.profileId,
          pieces: ln.pieces,
        })),
        profilesById,
        defect: defectParsed.value > 0 || (Number.isFinite(defectParsed.value) && defectParsed.value === 0)
          ? defectParsed
          : null,
      }),
    [profileLines, profilesById, defectParsed],
  );

  const remainingAfter = Math.max(0, remainingKg - consumedKg);
  const hasValidLines = profileLines.some(
    (ln) => ln.profileId && Math.floor(Number(ln.pieces)) > 0,
  );
  const defectOk =
    String(defectValue ?? '').trim() === '' ||
    (Number.isFinite(defectParsed.value) && defectParsed.value >= 0);
  const defectProfileOk = defectUnit !== 'pieces' || String(defectValue ?? '').trim() === '' || defectProfileId;
  const overRemaining = consumedKg > remainingKg + 1e-6;
  const canSubmit = hasValidLines && defectOk && defectProfileOk && !overRemaining && consumedKg > 0;

  const addProfileLine = () => setProfileLines((prev) => [...prev, emptyProfileLine()]);

  const updateProfileLine = (idx, patch) => {
    setProfileLines((prev) => prev.map((ln, i) => (i === idx ? { ...ln, ...patch } : ln)));
  };

  const removeProfileLine = (idx) => {
    setProfileLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!poolEntry?.blankId) return;
    if (!canSubmit) {
      if (overRemaining) toast.warning('Списание больше остатка заготовки в ОТК');
      else toast.warning('Добавьте профили с количеством');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildOtkAccountPayload({
        profileLines,
        defect:
          String(defectValue ?? '').trim() !== '' && Number(defectParsed.value) >= 0
            ? defectParsed
            : null,
        operatorId,
        chemistId,
        packerId,
      });
      await postOtkAccount(poolEntry.blankId, payload);
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

  if (!poolEntry) return null;

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
            <h2 id="otk-account-title" className="otk-account-screen__title">
              Учесть: {poolEntry.blankName || 'Заготовка'}
            </h2>
            <p className="otk-account-screen__lead">
              Профили → склад. Брак → заготовка (цех). Кг считаются автоматически.
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

        <div className="otk-account-screen__stats">
          <div className="otk-account-screen__stat">
            <span className="otk-account-screen__stat-label">В ОТК</span>
            <span className="otk-account-screen__stat-value">{formatNumberForInput(remainingKg)} кг</span>
          </div>
          <div className="otk-account-screen__stat">
            <span className="otk-account-screen__stat-label">Списание</span>
            <span className="otk-account-screen__stat-value">{formatNumberForInput(consumedKg)} кг</span>
          </div>
          <div className={`otk-account-screen__stat${overRemaining ? ' otk-account-screen__stat--warn' : ''}`}>
            <span className="otk-account-screen__stat-label">Останется</span>
            <span className="otk-account-screen__stat-value">{formatNumberForInput(remainingAfter)} кг</span>
          </div>
        </div>

        <form id="otk-account-form" className="otk-account-screen__form" onSubmit={handleSubmit}>
          <div className="otk-account-screen__body">
            <section className="otk-account-card otk-account-card--profiles">
              <div className="otk-account-card__head">
                <h3 className="otk-account-card__title">Профили (готовая продукция)</h3>
                <button type="button" className="btn btn--secondary btn--sm" onClick={addProfileLine}>
                  + Профиль
                </button>
              </div>
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
                <div className={`otk-account-card__grid${defectUnit === 'pieces' ? ' otk-account-card__grid--3' : ''}`}>
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">Единица</span>
                    <Select
                      value={defectUnit}
                      onChange={(v) => setDefectUnit(v === 'pieces' ? 'pieces' : 'kg')}
                      options={[
                        { value: 'kg', label: 'Кг' },
                        { value: 'pieces', label: 'Шт' },
                      ]}
                    />
                  </div>
                  {defectUnit === 'pieces' ? (
                    <div className="otk-account-card__field">
                      <span className="otk-account-card__label">Профиль</span>
                      <Select
                        value={defectProfileId}
                        onChange={(v) => setDefectProfileId(v != null ? String(v) : '')}
                        placeholder="Выберите"
                        options={profileOptions}
                      />
                    </div>
                  ) : null}
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">
                      {defectUnit === 'pieces' ? 'Кол-во, шт' : 'Кол-во, кг'}
                    </span>
                    {defectUnit === 'pieces' ? (
                      <IntegerInput min={0} value={defectValue} onChange={setDefectValue} placeholder="0" />
                    ) : (
                      <DecimalInput min={0} value={defectValue} onChange={setDefectValue} placeholder="0" />
                    )}
                  </div>
                </div>
                <p className="otk-account-card__hint">Брак возвращается в заготовку (цех).</p>
              </section>

              <section className="otk-account-card">
                <h3 className="otk-account-card__title">Сотрудники</h3>
                <div className="otk-account-card__grid otk-account-card__grid--3">
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
                  <div className="otk-account-card__field">
                    <span className="otk-account-card__label">Упаковщик</span>
                    <Select
                      value={packerId}
                      onChange={(v) => setPackerId(v != null ? String(v) : '')}
                      placeholder="Выберите"
                      options={employeeOptions}
                    />
                  </div>
                </div>
              </section>
            </aside>
          </div>

          {(error || overRemaining) ? (
            <div className="otk-account-screen__alerts">
              {error ? <p className="otk-account-screen__alert">{error}</p> : null}
              {overRemaining ? (
                <p className="otk-account-screen__alert">
                  Списание ({formatNumberForInput(consumedKg)} кг) больше остатка ({formatNumberForInput(remainingKg)} кг).
                </p>
              ) : null}
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
