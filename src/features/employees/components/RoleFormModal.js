import React from 'react';
import { Tag } from 'lucide-react';
import { EntityNameModal } from '../../../shared/ui';

const RoleFormModal = ({ role, onSave, onClose, error, saving }) => (
  <EntityNameModal
    item={role}
    icon={Tag}
    noun="Роль"
    newEyebrow="Новая роль"
    addTitle="Добавить роль"
    placeholder="Например: Тренер"
    onSave={onSave}
    onClose={onClose}
    error={error}
    saving={saving}
  />
);

export default RoleFormModal;
