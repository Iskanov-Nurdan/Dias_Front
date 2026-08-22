import React from 'react';
import { Dumbbell } from 'lucide-react';
import { EntityNameModal } from '../../../shared/ui';

const SportFormModal = ({ sport, onSave, onClose, error, saving }) => (
  <EntityNameModal
    item={sport}
    icon={Dumbbell}
    noun="Вид спорта"
    newEyebrow="Новый вид спорта"
    addTitle="Добавить вид спорта"
    placeholder="Например: Бокс"
    onSave={onSave}
    onClose={onClose}
    error={error}
    saving={saving}
  />
);

export default SportFormModal;
