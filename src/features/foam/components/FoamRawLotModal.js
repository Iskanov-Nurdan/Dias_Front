import React, { useState } from 'react';
import { PackagePlus, Pencil, Boxes } from 'lucide-react';
import { SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './FoamModals.scss';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Три сценария одной формы — различаются только тем, какие поля показаны:
 *  - variant="new"       — новый материал: название + поставщик + приход (Кг/цена/дата)
 *  - variant="replenish" — приход к уже существующему материалу: название
 *                          зафиксировано (материал определяется тем, на какой
 *                          строке нажали «Приход»), только Кг/цена/дата
 *  - variant="rename"    — правка названия/поставщика без нового прихода;
 *                          применяется сразу ко всем лотам этого материала
 *                          (у apps.foam нет отдельного каталога материалов —
 *                          лот и есть партия, поэтому переименование это
 *                          массовое исправление у всех его лотов)
 */
const FoamRawLotModal = ({ variant, materialName, supplier: initialSupplier, onSave, onClose, error, saving }) => {
  const [name, setName] = useState(variant === 'new' ? '' : materialName || '');
  const [supplier, setSupplier] = useState(initialSupplier || '');
  const [kg, setKg] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [receivedAt, setReceivedAt] = useState(todayISO());

  const needsIntakeFields = variant !== 'rename';
  const nameEditable = variant !== 'replenish';

  const canSubmit = name.trim().length > 0 && (!needsIntakeFields || Number(kg) > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      materialName: name.trim(),
      supplier: supplier.trim(),
      bagWeightKg: kg,
      unitPrice,
      receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
    });
  };

  const title = variant === 'new' ? 'Новый материал' : variant === 'replenish' ? `Приход: ${materialName}` : `Материал: ${materialName}`;
  const Icon = variant === 'new' ? PackagePlus : variant === 'replenish' ? Boxes : Pencil;

  return (
    <FormModal icon={Icon} eyebrow="Пенополистирол" title={title} onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
            {nameEditable && (
              <div className="fm__field">
                <label className="fm__label">Название материала <span className="fm__required">*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="fm__input" autoFocus placeholder="Гранулы ПСВ-С" />
              </div>
            )}
            <div className="fm__field">
              <label className="fm__label">Поставщик</label>
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="fm__input" autoFocus={!nameEditable} />
            </div>

            {needsIntakeFields && (
              <div className="fm__row">
                <div className="fm__field">
                  <label className="fm__label">Кг <span className="fm__required">*</span></label>
                  <MoneyInput value={kg} onChange={setKg} placeholder="0" className="fm__input" />
                </div>
                <div className="fm__field">
                  <label className="fm__label">Цена за единицу (сом)</label>
                  <MoneyInput value={unitPrice} onChange={setUnitPrice} allowDecimals placeholder="0" className="fm__input" />
                </div>
              </div>
            )}
            {needsIntakeFields && (
              <div className="fm__field">
                <label className="fm__label">Дата</label>
                <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="fm__input" />
              </div>
            )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>
            {variant === 'rename' ? 'Сохранить' : 'Оприходовать'}
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default FoamRawLotModal;
