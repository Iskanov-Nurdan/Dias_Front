import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Check } from 'lucide-react';
import { EmptyState, Spinner } from '../../../shared/ui';
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

/**
 * Карточка лида на доске.
 *
 * Перенос мышью (HTML5 drag&drop) на тач-экранах не работает вовсе — с
 * телефона этап сменить было нечем. Поэтому у карточки есть кнопка со
 * списком этапов: тот же перенос, только нажатием.
 */
const LeadMiniCard = ({ lead, stageId, stages, onClick, onDragStart, onDragEnd, onMoveLead }) => {
  const [menuPos, setMenuPos] = useState(null);
  const menuOpen = menuPos !== null;
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  /**
   * Меню живёт в портале, а не внутри карточки.
   *
   * У колонки overflow-y: auto — меню у нижней карточки обрезалось бы по краю
   * колонки. Поэтому позиционируем по координатам кнопки на экране.
   */
  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right, anchorTop: r.top });
  };

  // Не хватило места снизу — разворачиваем вверх
  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current) return;
    const el = menuRef.current;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      el.style.top = `${Math.max(8, menuPos.anchorTop - r.height - 6)}px`;
    }
  }, [menuOpen, menuPos]);

  // Закрываем по клику вне, по Esc и при прокрутке: меню с фиксированной
  // позицией иначе отвиснет от своей карточки
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuPos(null);
    const onDocDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuOpen]);

  const otherStages = stages.filter((st) => st.id !== stageId);

  return (
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
    <div className="funnel-board__card-top">
      <div className="funnel-board__card-name">{lead.name ?? '—'}</div>

      {otherStages.length > 0 && (
        <button
          ref={btnRef}
          type="button"
          className="funnel-board__move-btn"
          // Карточка целиком открывает лид — нажатие на кнопку не должно
          // заодно открывать модалку
          onClick={(e) => { e.stopPropagation(); if (menuOpen) setMenuPos(null); else openMenu(); }}
          aria-label="Перенести на другой этап"
          aria-expanded={menuOpen}
          title="Перенести на другой этап"
        >
          <ArrowRightLeft size={13} />
        </button>
      )}

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          className="funnel-board__move-menu"
          style={{ top: menuPos.top, right: menuPos.right }}
          role="menu"
        >
          <span className="funnel-board__move-title">Перенести на этап</span>
          {stages.map((st) => (
            <button
              key={st.id}
              type="button"
              role="menuitem"
              className={`funnel-board__move-item${st.id === stageId ? ' funnel-board__move-item--current' : ''}`}
              disabled={st.id === stageId}
              onClick={() => { setMenuPos(null); onMoveLead?.(lead.id, st.id); }}
            >
              <span>{st.name}</span>
              {st.id === stageId && <Check size={13} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
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
};

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
                  <div className="funnel-board__loading"><Spinner /></div>
                ) : leads.length === 0 ? (
                  <div className="funnel-board__no-leads">{isDropTarget ? 'Отпустите здесь' : 'Нет лидов'}</div>
                ) : (
                  leads.map((lead) => (
                    <LeadMiniCard
                      key={lead.id}
                      lead={lead}
                      stageId={stage.id}
                      stages={stages}
                      onMoveLead={onMoveLead}
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
