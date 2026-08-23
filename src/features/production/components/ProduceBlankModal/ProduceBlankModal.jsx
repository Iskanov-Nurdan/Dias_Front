import React, { useMemo, useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { Select } from '../../../../shared/ui';
import {
  formatNumberForInput,
  useServerQuery,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { DEMO_PRODUCTION_VAT_MAX_KG } from '../../../chemistry/lib/blankRecipeShared';
import {
  postWorkshopBlankProductionRun,
  buildCreateBlankRunPayload,
  mapWorkshopBlankFromApi,
  mapPreparedBlankRowFromApi,
} from '../../../chemistry/api/blankWorkshopApi';
import './ProduceBlankModal.scss';

const listQ = { page: 1, page_size: 500, ordering: 'name' };
const prepQ = { page: 1, page_size: 500 };

const ProduceBlankModal = ({ onClose, onSaved }) => {
  const { items: blankItems } = useServerQuery('workshop/blanks/', listQ, { enabled: true });
  const { items: preparedItems } = useServerQuery('workshop/prepared-blanks/', prepQ, { enabled: true });

  const blanks = useMemo(
    () => (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean),
    [blankItems],
  );
  const preparedByBlankId = useMemo(() => {
    const m = new Map();
    (preparedItems || []).forEach((row) => {
      const mapped = mapPreparedBlankRowFromApi(row);
      if (mapped?.blankId) m.set(mapped.blankId, mapped);
    });
    return m;
  }, [preparedItems]);

  const [blankId, setBlankId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const blankOptions = useMemo(
    () =>
      (blanks || []).map((b) => ({
        value: String(b.id),
        label: b.name || 'Заготовка',
      })),
    [blanks],
  );

  const selectedBlank = useMemo(
    () => (blanks || []).find((b) => String(b.id) === String(blankId)),
    [blanks, blankId],
  );

  const recipeKg = selectedBlank ? Number(selectedBlank.recipeKgPerBarrel) || 0 : 0;

  const capHint = useMemo(() => {
    if (!selectedBlank || recipeKg <= 0) return null;
    if (recipeKg <= DEMO_PRODUCTION_VAT_MAX_KG) return null;
    return `В партии учитывается не больше ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг (ёмкость). По рецепту ${formatNumberForInput(recipeKg)} кг — в машину уходит ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг.`;
  }, [selectedBlank, recipeKg]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!blankId) {
      setError('Выберите заготовку.');
      return;
    }
    if (recipeKg <= 0) {
      setError('У заготовки нет массы бочки (recipe_kg_per_barrel) — проверьте состав в «Заготовка».');
      return;
    }
    const usedKg = Math.min(recipeKg, DEMO_PRODUCTION_VAT_MAX_KG);
    const prep = preparedByBlankId.get(String(blankId));
    if (prep && prep.totalKg > 1e-6) {
      if (prep.totalKg + 1e-6 < usedKg) {
        setError(
          `В «Заготовка (цех)» сейчас ${formatNumberForInput(prep.totalKg)} кг, для партии нужно ${formatNumberForInput(usedKg)} кг.`,
        );
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      await postWorkshopBlankProductionRun(
        buildCreateBlankRunPayload({
          blankId,
          blankTotalKg: recipeKg,
          blankUsedInProductionKg: usedKg,
          vatMaxKgDemo: DEMO_PRODUCTION_VAT_MAX_KG,
        }),
      );
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать выпуск'));
    } finally {
      setSubmitting(false);
    }
  };

  const overlayClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={overlayClose}>
      <div
        className="produce-blank-modal__shell"
        onClick={(ev) => ev.stopPropagation()}
        role="presentation"
      >
        <div className="modal modal--wide produce-blank-modal">
          <div className="modal__head">
            <h3>Произвести</h3>
            <button
              type="button"
              className="modal__close"
              onClick={overlayClose}
              aria-label="Закрыть"
              disabled={submitting}
            >
              ×
            </button>
          </div>
          <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
            <label>Заготовка *</label>
            <Select
              value={blankId === '' ? '' : String(blankId)}
              onChange={(v) => {
                setBlankId(v != null ? String(v) : '');
                setError('');
              }}
              placeholder="Выберите заготовку"
              options={blankOptions}
            />
            {blankOptions.length === 0 ? (
              <p className="produce-blank-modal__warn">
                Нет заготовок — создайте во вкладке «Заготовка».
              </p>
            ) : null}
            {capHint ? <p className="produce-blank-modal__hint-cap">{capHint}</p> : null}
            {selectedBlank && recipeKg > 0 ? (
              <p className="produce-blank-modal__product-hint">
                В ОТК поступит до {formatNumberForInput(Math.min(recipeKg, DEMO_PRODUCTION_VAT_MAX_KG))} кг
              </p>
            ) : null}

            {error ? <p className="modal__error">{error}</p> : null}

            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={overlayClose} disabled={submitting}>
                <FiX aria-hidden size={16} strokeWidth={2} />
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                <FiCheck aria-hidden size={16} strokeWidth={2} />
                {submitting ? '…' : 'Произвести'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProduceBlankModal;
