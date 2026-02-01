import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TrainerFormModal.scss';

const TrainerFormModal = ({ trainer, sports, onSave, onClose }) => {
  const [fio, setFio] = useState('');
  const [sportIds, setSportIds] = useState([]);
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
    onClose();
  };

  const content = (
    <div className="trainer-form-modal__backdrop" onClick={onClose}>
      <div className="trainer-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="trainer-form-modal__title">{trainer?.id ? 'Редактировать тренера' : 'Добавить тренера'}</h2>
        <form onSubmit={handleSubmit} className="trainer-form-modal__form">
          <label className="trainer-form-modal__label">
            ФИО
            <input type="text" value={fio} onChange={(e) => setFio(e.target.value)} required className="trainer-form-modal__input" />
          </label>
          <div className="trainer-form-modal__label">
            Виды спорта
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
            <button type="button" className="trainer-form-modal__btn trainer-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="trainer-form-modal__btn trainer-form-modal__btn--submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerFormModal;
