import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './TrainerFormModal.scss';

const TrainerFormModal = ({ trainer, sports, onSave, onClose, error, saving }) => {
  const [fio, setFio] = useState('');
  const [sportIds, setSportIds] = useState([]);

  useModalEffect(true, onClose);

  useEffect(() => {
    if (trainer) {
      setFio(trainer.fio || '');
      const ids = trainer.sportIds ?? trainer.sport_ids ?? (trainer.sports || []).map((s) => (typeof s === 'object' ? s.id : s));
      setSportIds(Array.isArray(ids) ? ids : []);
    }
  }, [trainer]);

  const toggleSport = (id) => {
    setSportIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ fio, sportIds });
  };

  const content = (
    <div className="trainer-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="trainer-form-modal-title">
      <div className="trainer-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trainer-form-modal__header">
          <h2 id="trainer-form-modal-title" className="trainer-form-modal__title">{trainer?.id ? 'Редактировать тренера' : 'Добавить тренера'}</h2>
          <button type="button" className="trainer-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="trainer-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="trainer-form-modal__form">
          <label className="trainer-form-modal__label">
            <span className="trainer-form-modal__label-caption">ФИО <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={fio} onChange={(e) => setFio(e.target.value)} required className="trainer-form-modal__input" />
          </label>
          <div className="trainer-form-modal__label">
            <span className="trainer-form-modal__label-caption">Виды спорта</span>
            <div className="trainer-form-modal__checkboxes">
              {(sports || []).map((s) => (
                <label key={s.id} className="trainer-form-modal__checkbox">
                  <input type="checkbox" checked={sportIds.includes(s.id)} onChange={() => toggleSport(s.id)} />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="trainer-form-modal__actions">
            <button type="button" className="trainer-form-modal__btn trainer-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="trainer-form-modal__btn trainer-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerFormModal;
