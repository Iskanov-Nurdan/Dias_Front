import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Dumbbell } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import '../../../shared/ui/EntityNameModal.scss';
import './TrainerFormModal.scss';

const TrainerFormModal = ({ trainer, sports, onSave, onClose, error, saving }) => {
  const [fio, setFio] = useState('');
  const [sportIds, setSportIds] = useState([]);
  const isEdit = !!trainer?.id;

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
    <div className="enm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="trainer-form-modal-title">
      <div className="enm trainer-form-modal" onClick={(e) => e.stopPropagation()}>

        <div className="enm__header">
          <div>
            <p className="enm__header-sub">{isEdit ? 'Редактирование' : 'Новый тренер'}</p>
            <h2 id="trainer-form-modal-title" className="enm__title">{isEdit ? (trainer?.fio || 'Тренер') : 'Добавить тренера'}</h2>
          </div>
          <button type="button" className="enm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="enm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="enm__form">
          <div className="enm__body">
            <div className="enm__field">
              <label className="enm__label" htmlFor="trainer-form-fio">
                <User size={14} className="enm__label-icon" />
                ФИО <span className="enm__required">*</span>
              </label>
              <input
                id="trainer-form-fio"
                type="text"
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                required
                className="enm__input"
                autoFocus
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div className="enm__field">
              <label className="enm__label">
                <Dumbbell size={14} className="enm__label-icon" />
                Виды спорта
              </label>
              <div className="trainer-form-modal__checkboxes">
                {(sports || []).map((s) => (
                  <label key={s.id} className="trainer-form-modal__checkbox">
                    <input type="checkbox" checked={sportIds.includes(s.id)} onChange={() => toggleSport(s.id)} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="enm__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerFormModal;
