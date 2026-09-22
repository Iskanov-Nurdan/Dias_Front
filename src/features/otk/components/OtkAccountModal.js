import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Plus, Trash2, TriangleAlert,
} from 'lucide-react';
import {
  Select, SubmitButton, MoneyInput, FormModal,
} from '../../../shared/ui';
import { fetchProfiles } from '../../workshop/api';
import { fetchEmployees } from '../../employees/api';
import './OtkAccountModal.scss';

const SHIFT_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'night', label: 'Ночь' },
];

let rowSeq = 0;
const emptyLine = () => ({ key: `line-${++rowSeq}`, profileId: '', pieces: '' });

const formatKg = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 3 });

/** pool — [{blank_id, blank_name, remaining_kg, can_account}], уже загруженный на странице. */
const OtkAccountModal = ({ pool, onSave, onClose, error, saving }) => {
  const [profiles, setProfiles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lines, setLines] = useState([emptyLine()]);
  const [defectKg, setDefectKg] = useState('');
  const [defectBlankId, setDefectBlankId] = useState('');
  const [shiftPeriod, setShiftPeriod] = useState('day');
  const [operatorId, setOperatorId] = useState('');
  const [chemistId, setChemistId] = useState('');
  const [packerIds, setPackerIds] = useState([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    fetchProfiles(null).then((data) => setProfiles(data?.items ?? [])).catch(() => {});
    fetchEmployees({ perPage: 100 }, null).then((data) => setEmployees(data?.items ?? [])).catch(() => {});
  }, []);

  // Бэкенд не умеет фильтровать профили по заготовке — тянем весь активный
  // каталог и сопоставляем сами (см. apps/recipes PlasticProfileViewSet:
  // filterset_fields только is_active).
  const profileOptions = profiles
    .filter((p) => p.blank_id)
    .map((p) => ({ value: String(p.id), label: `${p.name} — ${p.blank_name}` }));

  const profileById = useMemo(() => Object.fromEntries(profiles.map((p) => [String(p.id), p])), [profiles]);
  const poolByBlankId = useMemo(() => Object.fromEntries((pool || []).map((p) => [String(p.blank_id), p])), [pool]);

  const employeeOptions = employees.map((e) => ({ value: String(e.id), label: e.name }));
  const packerOptions = employeeOptions.filter((o) => !packerIds.includes(o.value));

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const validLines = lines
    .map((l) => {
      const profile = profileById[l.profileId];
      const pieces = Number(l.pieces);
      if (!profile || !(pieces > 0)) return null;
      const kg = pieces * Number(profile.weight_kg_per_piece || 0);
      return { ...l, profile, pieces, kg, blankId: String(profile.blank_id) };
    })
    .filter(Boolean);

  const distinctBlankIds = [...new Set(validLines.map((l) => l.blankId))];
  const effectiveDefectBlankId = defectBlankId || distinctBlankIds[0] || '';
  const defectBlankOptions = distinctBlankIds.map((id) => ({ value: id, label: poolByBlankId[id]?.blank_name || id }));

  const consumedByBlank = useMemo(() => {
    const map = {};
    validLines.forEach((l) => { map[l.blankId] = (map[l.blankId] || 0) + l.kg; });
    const dKg = Number(defectKg) || 0;
    if (dKg > 0 && effectiveDefectBlankId) {
      map[effectiveDefectBlankId] = (map[effectiveDefectBlankId] || 0) + dKg;
    }
    return map;
  }, [validLines, defectKg, effectiveDefectBlankId]);

  const overages = Object.entries(consumedByBlank)
    .map(([blankId, kg]) => ({ blankId, kg, remaining: Number(poolByBlankId[blankId]?.remaining_kg ?? 0) }))
    .filter((x) => x.kg > x.remaining);

  const totalKg = Object.values(consumedByBlank).reduce((s, v) => s + v, 0);
  const hasValidLines = validLines.length > 0;
  const defectValid = !(Number(defectKg) > 0) || !!effectiveDefectBlankId;
  const canSubmit = hasValidLines && defectValid && overages.length === 0 && totalKg > 0 && !!shiftPeriod;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    const body = {
      lines: validLines.map((l) => ({ profile_id: Number(l.profileId), pieces: l.pieces })),
      shift_period: shiftPeriod,
      operator_id: operatorId ? Number(operatorId) : null,
      chemist_id: chemistId ? Number(chemistId) : null,
      packer_ids: packerIds.map(Number),
    };
    if (Number(defectKg) > 0) {
      body.defect_kg = Number(defectKg);
      body.defect_blank_id = Number(effectiveDefectBlankId);
    }
    onSave(body);
  };

  return (
    <FormModal icon={ClipboardCheck} eyebrow="Сессия учёта" title="Учесть" onClose={onClose} error={error} size="fullscreen" className="oam-modal">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body oam__body">
              <div className="oam__section">
                <h3 className="oam__section-title">Профили</h3>
                {lines.map((line) => (
                  <div key={line.key} className="oam__line">
                    <Select
                      value={line.profileId}
                      onChange={(v) => setLine(line.key, { profileId: v })}
                      options={profileOptions}
                      placeholder="Профиль — заготовка"
                      className="oam__line-profile"
                    />
                    <MoneyInput
                      value={line.pieces}
                      onChange={(v) => setLine(line.key, { pieces: v })}
                      placeholder="Штук"
                      className="oam__line-pieces"
                    />
                    <span className="oam__line-kg">
                      {line.profileId && line.pieces
                        ? formatKg(Number(line.pieces) * Number(profileById[line.profileId]?.weight_kg_per_piece || 0)) + ' кг'
                        : '—'}
                    </span>
                    <button type="button" className="oam__line-remove" onClick={() => removeLine(line.key)} disabled={lines.length <= 1} aria-label="Удалить строку">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="oam__add-line" onClick={addLine}>
                  <Plus size={14} /> Профиль
                </button>
              </div>

              {distinctBlankIds.length > 0 && (
                <div className="oam__breakdown">
                  {distinctBlankIds.map((id) => {
                    const kg = consumedByBlank[id] || 0;
                    const remaining = Number(poolByBlankId[id]?.remaining_kg ?? 0);
                    const over = kg > remaining;
                    return (
                      <div key={id} className={`oam__breakdown-row${over ? ' oam__breakdown-row--over' : ''}`}>
                        <span>{poolByBlankId[id]?.blank_name || id}</span>
                        <span>−{formatKg(kg)} кг {over ? `(доступно ${formatKg(remaining)} кг)` : `· останется ${formatKg(remaining - kg)} кг`}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="oam__section">
                <h3 className="oam__section-title">Брак</h3>
                <div className="oam__row">
                  <div className="oam__field">
                    <label className="oam__label">Кг брака</label>
                    <MoneyInput value={defectKg} onChange={setDefectKg} allowDecimals placeholder="0" className="oam__input" />
                  </div>
                  {Number(defectKg) > 0 && defectBlankOptions.length > 1 && (
                    <div className="oam__field">
                      <label className="oam__label">Заготовка для брака</label>
                      <Select value={effectiveDefectBlankId} onChange={setDefectBlankId} options={defectBlankOptions} placeholder="Выберите заготовку" />
                    </div>
                  )}
                </div>
                <p className="oam__hint">Брак возвращается в заготовку (цех).</p>
              </div>

              <div className="oam__section">
                <h3 className="oam__section-title">Сотрудники</h3>
                <div className="oam__row">
                  <div className="oam__field">
                    <label className="oam__label">Смена</label>
                    <Select value={shiftPeriod} onChange={setShiftPeriod} options={SHIFT_OPTIONS} />
                  </div>
                  <div className="oam__field">
                    <label className="oam__label">Оператор</label>
                    <Select value={operatorId} onChange={setOperatorId} options={employeeOptions} placeholder="Не выбран" />
                  </div>
                </div>
                <div className="oam__row">
                  <div className="oam__field">
                    <label className="oam__label">Химик</label>
                    <Select value={chemistId} onChange={setChemistId} options={employeeOptions} placeholder="Не выбран" />
                  </div>
                  <div className="oam__field">
                    <label className="oam__label">Упаковщики</label>
                    <Select value="" onChange={(v) => setPackerIds((prev) => [...prev, v])} options={packerOptions} placeholder="Добавить" />
                  </div>
                </div>
                {packerIds.length > 0 && (
                  <div className="oam__chips">
                    {packerIds.map((id) => (
                      <span key={id} className="oam__chip">
                        {employeeOptions.find((o) => o.value === id)?.label || id}
                        <button type="button" onClick={() => setPackerIds((prev) => prev.filter((x) => x !== id))} aria-label="Убрать">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {touched && overages.length > 0 && (
                <p className="oam__error oam__error--inline">
                  <TriangleAlert size={14} /> Недостаточно кг для: {overages.map((o) => poolByBlankId[o.blankId]?.blank_name || o.blankId).join(', ')}
                </p>
              )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
            Сохранить учёт
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default OtkAccountModal;
