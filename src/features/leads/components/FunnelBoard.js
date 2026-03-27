import React, { useState } from 'react';
import { EmptyState } from '../../../shared/ui';
import './FunnelBoard.scss';

const CHANNEL_LABELS = { instagram: 'Instagram', whatsapp: 'WhatsApp', tiktok: 'TikTok', other: 'Другое' };

const TRIAL_LABELS = { came: 'Пришли', rescheduled: 'Перенесли', no_contact: 'Не вышли на связь', rejected: 'Отказались' };
const RESULT_LABELS = { bought: 'Купили', thinking: 'Ушли подумать', rejected: 'Отказались' };

const statusColor = (val, map) => {
  if (!val || !map[val]) return null;
  if (val === 'bought') return 'green';
  if (val.includes('reject') || val === 'no_contact') return 'red';
  return 'yellow';
};

const LeadMiniCard = ({ lead, onClick, onDragStart, onDragEnd }) => (
  <div
    className="funnel-board__card"
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('application/json', JSON.stringify({ leadId: lead.id }));
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
      onDragStart?.();
    }}
    onDragEnd={() => onDragEnd?.()}
    onClick={() => onClick(lead)}
  >
    <div className="funnel-board__card-name">{lead.name ?? '—'}</div>
    <div className="funnel-board__card-phone">{lead.phone ?? ''}</div>
      {lead.channel && (
      <span className="funnel-board__card-tag">{CHANNEL_LABELS[(lead.channel ?? '').toLowerCase()] ?? lead.channel}</span>
    )}
    <div className="funnel-board__card-statuses">
      {(lead.trialStatus ?? lead.trial_status) ? (
        <span className={`funnel-board__card-status funnel-board__card-status--${statusColor((lead.trialStatus ?? lead.trial_status).toLowerCase(), TRIAL_LABELS) ?? 'gray'}`}>
          {TRIAL_LABELS[(lead.trialStatus ?? lead.trial_status).toLowerCase()] ?? (lead.trialStatus ?? lead.trial_status)}
        </span>
      ) : (
        <span className="funnel-board__card-status funnel-board__card-status--gray">Без статуса</span>
      )}
    </div>
    {(lead.resultStatus ?? lead.result_status) && (
      <span className={`funnel-board__card-result funnel-board__card-result--${statusColor((lead.resultStatus ?? lead.result_status).toLowerCase(), RESULT_LABELS) ?? 'gray'}`}>
        {RESULT_LABELS[(lead.resultStatus ?? lead.result_status).toLowerCase()] ?? (lead.resultStatus ?? lead.result_status)}
      </span>
    )}
  </div>
);

const FunnelBoard = ({ stages, leadsByStage, onCardClick, onMoveLead, loading }) => {
  const [dragOverStageId, setDragOverStageId] = useState(null);
  const [, setIsDragging] = useState(false);

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageId(null);
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    setDragOverStageId(null);
    setIsDragging(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const { leadId } = JSON.parse(raw);
      if (leadId && onMoveLead) onMoveLead(leadId, stageId);
    } catch (_) {
      /* ignore */
    }
  };

  const handleDragEnd = () => {
    setDragOverStageId(null);
    setIsDragging(false);
  };

  if (stages.length === 0) {
    return (
      <div className="funnel-board__empty">
        <EmptyState compact message="Этапов пока нет. Добавьте этапы в админке." />
      </div>
    );
  }

  return (
    <div className="funnel-board">
      <div className="funnel-board__columns">
        {stages.map((stage) => {
          const leads = leadsByStage[stage.id] ?? [];
          const isDropTarget = dragOverStageId === stage.id;
          return (
            <div key={stage.id} className="funnel-board__column">
              <div className="funnel-board__column-header">
                <div className="funnel-board__column-title">
                  <span>{stage.name}</span>
                  <span className="funnel-board__column-count">{leads.length}</span>
                </div>
              </div>
              <div
                className={`funnel-board__column-body ${isDropTarget ? 'funnel-board__column-body--drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {loading ? (
                  <div className="funnel-board__loading">Загрузка…</div>
                ) : leads.length === 0 ? (
                  <div className="funnel-board__no-leads">{isDropTarget ? 'Отпустите здесь' : 'Нет лидов'}</div>
                ) : (
                  leads.map((lead) => (
                    <LeadMiniCard
                      key={lead.id}
                      lead={lead}
                      onClick={onCardClick}
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelBoard;
