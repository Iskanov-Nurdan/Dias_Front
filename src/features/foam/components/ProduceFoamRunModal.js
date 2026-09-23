import React, { useState, useMemo } from 'react';
import { Factory } from 'lucide-react';
import { Select, SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import { formatNumber } from '../../../shared/constants/common';
import './FoamModals.scss';

const OUTPUT_OPTIONS = [
  { value: 'cube', label: 'Куб' },
  { value: 'granule', label: 'Гранулят (россыпь)' },
];

const LOSS_RATE = 0.035;
const CUBE_VOLUME_M3 = 1.2;

const fmtKg = (n) => `${Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} кг`;

/**
 * Предпоказ — только оценка на клиенте (реальный output_qty считает бэкенд).
 * Плотность берём серединой диапазона марки: min/max_kg_m3 — это диапазон
 * допуска, а не точное число, точнее клиенту всё равно не узнать заранее.
 */
const ProduceFoamRunModal = ({ lots, grades, onSave, onClose, error, saving }) => {
  const [lotId, setLotId] = useState('');
  const [inputKg, setInputKg] = useState('');
  const [outputFormat, setOutputFormat] = useState('cube');
  const [gradeCode, setGradeCode] = useState('');

  // Номер партии (lot_number) — внутренняя деталь FIFO, наружу не показываем;
  // сортировка по дате прихода ставит самую старую партию первой (её и нужно
  // расходовать в первую очередь).
  const lotOptions = (lots || [])
    .filter((l) => Number(l.remaining_kg) > 0)
    .slice()
    .sort((a, b) => new Date(a.received_at) - new Date(b.received_at))
    .map((l) => ({
      value: String(l.id),
      label: `${l.material_name} — приход ${new Date(l.received_at).toLocaleDateString('ru-RU')} (${fmtKg(l.remaining_kg)})`,
    }));
  const gradeOptions = (grades || []).map((g) => ({ value: g.code, label: `${g.code} (${formatNumber(g.min_kg_m3)}–${formatNumber(g.max_kg_m3)} кг/м³)` }));
  const lotById = useMemo(() => Object.fromEntries((lots || []).map((l) => [String(l.id), l])), [lots]);
  const gradeByCode = useMemo(() => Object.fromEntries((grades || []).map((g) => [g.code, g])), [grades]);

  const selectedLot = lotById[lotId];
  const selectedGrade = gradeByCode[gradeCode];
  const kg = Number(inputKg);
  const overStock = selectedLot && kg > Number(selectedLot.remaining_kg);
  const needsGrade = outputFormat === 'cube';

  const preview = useMemo(() => {
    if (!(kg > 0)) return null;
    const effectiveKg = kg * (1 - LOSS_RATE);
    if (outputFormat === 'granule') return { kind: 'granule', kg: effectiveKg };
    if (needsGrade && selectedGrade) {
      const density = (Number(selectedGrade.min_kg_m3) + Number(selectedGrade.max_kg_m3)) / 2;
      const volumeM3 = effectiveKg / density;
      const cubes = Math.floor(volumeM3 / CUBE_VOLUME_M3);
      return { kind: 'cube', cubes, effectiveKg };
    }
    return null;
  }, [kg, outputFormat, needsGrade, selectedGrade]);

  const canSubmit = !!lotId && kg > 0 && !overStock && (!needsGrade || !!gradeCode);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({ lotId: Number(lotId), inputKg, outputFormat, gradeCode: needsGrade ? gradeCode : undefined });
  };

  return (
    <FormModal icon={Factory} eyebrow="Пенополистирол" title="Запустить производство" onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="fm__field">
            <label className="fm__label">Сырьё <span className="fm__required">*</span></label>
            <Select value={lotId} onChange={setLotId} options={lotOptions} placeholder="Выберите материал" />
          </div>

          <div className="fm__row">
            <div className="fm__field">
              <label className="fm__label">Расход, кг <span className="fm__required">*</span></label>
              <MoneyInput value={inputKg} onChange={setInputKg} placeholder="0" className={`fm__input${overStock ? ' fm__input--invalid' : ''}`} />
              {overStock && <span className="fm__field-error">Доступно только {fmtKg(selectedLot.remaining_kg)}</span>}
            </div>
            <div className="fm__field">
              <label className="fm__label">Выход</label>
              <Select value={outputFormat} onChange={setOutputFormat} options={OUTPUT_OPTIONS} />
            </div>
          </div>

          {needsGrade && (
            <div className="fm__field">
              <label className="fm__label">Марка плотности <span className="fm__required">*</span></label>
              <Select value={gradeCode} onChange={setGradeCode} options={gradeOptions} placeholder="Выберите марку" />
            </div>
          )}

          {preview && (
            <div className="fm__preview">
              {preview.kind === 'cube' ? (
                <div className="fm__preview-row">
                  <span>Ориентировочный выход (−3.5% потерь)</span>
                  <strong>≈ {preview.cubes} куб.</strong>
                </div>
              ) : (
                <div className="fm__preview-row">
                  <span>Ориентировочный выход (−3.5% потерь)</span>
                  <strong>≈ {fmtKg(preview.kg)}</strong>
                </div>
              )}
            </div>
          )}
          <p className="fm__hint">Точный выход рассчитает и вернёт сервер — здесь только оценка.</p>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>Произвести</SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default ProduceFoamRunModal;
