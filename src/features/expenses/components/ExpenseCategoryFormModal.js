import React from 'react';
import { Tag } from 'lucide-react';
import { EntityNameModal } from '../../../shared/ui';

const ExpenseCategoryFormModal = ({ category, onSave, onClose, error, saving }) => (
  <EntityNameModal
    item={category}
    icon={Tag}
    noun="Категория"
    newEyebrow="Новая категория"
    addTitle="Добавить категорию"
    placeholder="Например: Аренда"
    onSave={onSave}
    onClose={onClose}
    error={error}
    saving={saving}
  />
);

export default ExpenseCategoryFormModal;
