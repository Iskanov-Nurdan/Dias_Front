import React from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Trash2, Plus } from 'lucide-react';
import { useModalEffect } from '../../shared/hooks/useModalEffect';
import { formatChangeLabel, formatChangeValue } from '../../shared/lib/auditFormat';
import { ACTION_TYPES, sectionLabel } from './constants';
import './ActivityDetailModal.scss';

const ACTION_ICON = { create: Plus, update: Pencil, delete: Trash2 };

/**
 * payload.changes — массив { field, path, type, old, new, old_display,
 * new_display } (apps.activity.audit_service.build_field_changes). type
 * (scalar/enum/fk/json/file_meta) сам по себе не нужен на фронте — если
 * бэкенд посчитал *_display, его и показываем, иначе форматируем как есть.
 * У delete есть только old(_display), у create — только new(_display).
 */
const ActivityDetailModal = ({ entry, onClose }) => {
  useModalEffect(true, onClose);
  if (!entry) return null;

  const changes = Array.isArray(entry.payload?.changes) ? entry.payload.changes : [];
  const hasChanges = entry.has_detail && changes.length > 0;
  const actionInfo = ACTION_TYPES[entry.action];
  const Icon = ACTION_ICON[entry.action] ?? Pencil;

  const content = (
    <div className="activity-detail-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
      <div className="activity-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="activity-detail-modal__header">
          <h2 id="activity-detail-title" className="activity-detail-modal__title">
            <Icon size={18} /> {sectionLabel(entry.section)}
          </h2>
          <button type="button" className="activity-detail-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="activity-detail-modal__meta">
          <span className={`ui-pill ${actionInfo?.cls ?? ''}`}>{actionInfo?.label ?? entry.action}</span>
          <span className="activity-detail-modal__meta-text">
            <strong>{entry.user_name || 'Неизвестно'}</strong>{entry.actor_role_snapshot ? ` (${entry.actor_role_snapshot})` : ''}
          </span>
        </div>

        <div className="activity-detail-modal__body">
          {hasChanges ? (
            <>
              <p className="activity-detail-modal__section-label">
                {entry.action === 'delete' ? 'Что было удалено' : entry.action === 'create' ? 'Что указали' : 'Что изменилось'}
              </p>
              <div className={entry.action === 'update' ? 'activity-detail-modal__diff' : 'activity-detail-modal__snapshot'}>
                {changes.map((c, i) => {
                  const label = formatChangeLabel(entry.field_labels, c);
                  if (entry.action === 'update') {
                    return (
                      <div key={i} className="activity-detail-modal__diff-row">
                        <span className="activity-detail-modal__diff-field">{label}</span>
                        <span className="activity-detail-modal__diff-before">{formatChangeValue(c.old, c.old_display)}</span>
                        <span className="activity-detail-modal__diff-arrow">→</span>
                        <span className="activity-detail-modal__diff-after">{formatChangeValue(c.new, c.new_display)}</span>
                      </div>
                    );
                  }
                  const value = entry.action === 'delete'
                    ? formatChangeValue(c.old, c.old_display)
                    : formatChangeValue(c.new, c.new_display);
                  return (
                    <div key={i} className="activity-detail-modal__snapshot-row">
                      <span className="activity-detail-modal__snapshot-field">{label}</span>
                      <span className={`activity-detail-modal__snapshot-value${value === '—' ? ' activity-detail-modal__snapshot-value--empty' : ''}`}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="activity-detail-modal__text">{entry.description || entry.summary}</p>
          )}
        </div>

        <div className="activity-detail-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ActivityDetailModal;
