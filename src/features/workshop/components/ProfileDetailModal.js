import React from 'react';
import { Grid3x3 } from 'lucide-react';
import { FormModal } from '../../../shared/ui';
import './BlankModal.scss';
import './ProfileFormModal.scss';
import './ProfileDetailModal.scss';

const EXTRA_FIELDS = [
  { key: 'extra_rubber', label: 'Резинка' },
  { key: 'extra_label', label: 'Этикетка' },
  { key: 'extra_labor', label: 'Рабочая сила' },
  { key: 'extra_electricity', label: 'Свет' },
  { key: 'extra_repair', label: 'Ремонт' },
];

const formatMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сом` : '—';
};

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

const ProfileDetailModal = ({ item, onClose }) => (
  <FormModal icon={Grid3x3} eyebrow="Подробности" title={item?.name} onClose={onClose} size="fullscreen" className="pfm">
    <div className="form-modal__form">
        <div className="form-modal__body pdm__body">
          <dl className="pdm__grid">
            <div><dt>Код</dt><dd>{item?.code || '—'}</dd></div>
            <div><dt>Заготовка</dt><dd>{item?.blank_name || '—'}</dd></div>
            <div><dt>Вес одной штуки</dt><dd>{item?.weight_kg_per_piece != null ? formatKg(item.weight_kg_per_piece) : '—'}</dd></div>
            <div><dt>Статус</dt><dd>{item?.is_active === false ? 'Неактивен' : 'Активен'}</dd></div>
          </dl>

          <div className="pfm__section">
            <h3 className="pfm__section-title">Прочие расходы</h3>
            <dl className="pdm__grid pdm__grid--extras">
              {EXTRA_FIELDS.map((f) => (
                <div key={f.key}><dt>{f.label}</dt><dd>{formatMoney(item?.[f.key])}</dd></div>
              ))}
            </dl>
          </div>

          <div className="pfm__section">
            <h3 className="pfm__section-title">Цена</h3>
            <dl className="pdm__grid">
              <div><dt>Себестоимость</dt><dd>{item?.cost_price != null ? formatMoney(item.cost_price) : '—'}</dd></div>
              <div><dt>Прочие расходы</dt><dd>{item?.other_expenses_total != null ? formatMoney(item.other_expenses_total) : '—'}</dd></div>
              <div><dt>Наценка</dt><dd>{formatMoney(item?.markup_amount)}</dd></div>
              <div><dt>Итого цена товара</dt><dd className="pdm__total">{item?.sale_unit_price != null ? formatMoney(item.sale_unit_price) : '—'}</dd></div>
            </dl>
            {item?.cost_price == null && (
              <p className="pfm__hint-text">Себестоимость считается системой после первого учёта в ОТК.</p>
            )}
          </div>

          {item?.recipes?.length > 0 && (
            <div className="pfm__section">
              <h3 className="pfm__section-title">Рецепты ({item.recipes.length})</h3>
              <div className="pdm__pills">
                {item.recipes.map((r) => (
                  <span key={r.id} className="ui-pill">{r.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

      <div className="form-modal__actions">
        <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  </FormModal>
);

export default ProfileDetailModal;
