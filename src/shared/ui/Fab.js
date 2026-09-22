import React from 'react';
import { Plus } from 'lucide-react';
import './Fab.scss';

/**
 * Плавающая круглая кнопка главного действия страницы (создать сущность) —
 * мобиле-онли (скрыта на десктопе/планшете через CSS), справа снизу над
 * нижней таб-навигацией с учётом safe-area. Общая для всех разделов —
 * см. shared/ui/Fab.scss, переменную --bottom-nav-h задаёт MainLayout.
 */
const Fab = ({
  onClick, label, icon: Icon = Plus, disabled = false, title,
}) => (
  <button type="button" className="ui-fab" onClick={onClick} aria-label={label} disabled={disabled} title={title}>
    <Icon size={24} />
  </button>
);

export default Fab;
