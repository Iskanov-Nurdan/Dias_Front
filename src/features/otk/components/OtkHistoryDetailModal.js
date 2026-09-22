import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { FormModal } from '../../../shared/ui';
import './OtkAccountModal.scss';
import './OtkHistoryDetailModal.scss';

const SHIFT_LABELS = { day: 'День', night: 'Ночь' };

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const OtkHistoryDetailModal = ({ item, onClose }) => (
  <FormModal icon={ClipboardCheck} eyebrow="Учёт ОТК" title={item?.blank_name} onClose={onClose} size="fullscreen" className="ohdm">
    <div className="form-modal__form">
      <div className="form-modal__body oam__body">
        <div className="oam__section">
          <h3 className="oam__section-title">Учёт</h3>
          <dl className="ohdm__grid">
            <div><dt>Дата</dt><dd>{formatDateTime(item?.created_at)}</dd></div>
            <div><dt>Списано</dt><dd>{formatKg(item?.consumed_kg)}</dd></div>
            <div><dt>Брак</dt><dd>{Number(item?.defect_kg) > 0 ? formatKg(item.defect_kg) : '—'}</dd></div>
            <div><dt>Остаток после</dt><dd>{formatKg(item?.remaining_kg_after)}</dd></div>
          </dl>
        </div>

        {item?.blank_breakdown?.length > 1 && (
          <div className="oam__section">
            <h3 className="oam__section-title">По заготовкам</h3>
            <div className="oam__breakdown">
              {item.blank_breakdown.map((b) => (
                <div key={b.blank_id} className="oam__breakdown-row">
                  <span>{b.blank_name}</span>
                  <span>−{formatKg(b.consumed_kg)} кг · осталось {formatKg(b.remaining_kg_after)} кг</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="oam__section">
          <h3 className="oam__section-title">Смена</h3>
          <dl className="ohdm__grid">
            <div><dt>Смена</dt><dd>{SHIFT_LABELS[item?.shift_period] || item?.shift_period || '—'}</dd></div>
            <div><dt>Оператор</dt><dd>{item?.operator_name || '—'}</dd></div>
            <div><dt>Химик</dt><dd>{item?.chemist_name || '—'}</dd></div>
            <div><dt>Упаковщики</dt><dd>{(item?.packer_names ?? []).join(', ') || '—'}</dd></div>
          </dl>
        </div>

        <div className="oam__section">
          <h3 className="oam__section-title">Профили</h3>
          {/* Список вместо таблицы — на мобиле таблиц быть не должно, а
              строк тут обычно немного (одна сессия учёта = пара профилей). */}
          <div className="ohdm__lines">
            {(item?.lines ?? []).map((l) => (
              <div key={l.profile_id} className="ohdm__line">
                <span className="ohdm__line-name">{l.profile_name}</span>
                <span className="ohdm__line-pieces">{l.pieces} шт</span>
                <span className="ohdm__line-kg">{formatKg(l.kg)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-modal__actions">
        <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  </FormModal>
);

export default OtkHistoryDetailModal;
