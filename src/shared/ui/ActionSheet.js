import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalEffect } from '../hooks/useModalEffect';
import './ActionSheet.scss';

const DRAG_CLOSE_THRESHOLD = 80;

/**
 * Универсальная шторка снизу (bottom sheet): контекстное меню действий на
 * строке карточки, «Ещё» в мобильной навигации и т.п. Закрывается тапом по
 * фону, Escape и свайпом вниз за хэндл/шапку (drag за область самих пунктов
 * списка не начинается — иначе тап по кнопке-действию воспринимался бы как
 * начало свайпа).
 */
const ActionSheet = ({ open, onClose, title, children }) => {
  const panelRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  useModalEffect(open, onClose, panelRef);

  if (!open) return null;

  const handleDragStart = (e) => {
    draggingRef.current = true;
    startYRef.current = e.touches ? e.touches[0].clientY : e.clientY;
  };

  const handleDragMove = (e) => {
    if (!draggingRef.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setDragY(Math.max(0, y - startYRef.current));
  };

  const handleDragEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > DRAG_CLOSE_THRESHOLD) onClose();
    else setDragY(0);
  };

  const content = (
    <div className="action-sheet__backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Действия'}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="action-sheet__handle-area"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div className="action-sheet__handle" aria-hidden />
          {title && <div className="action-sheet__title">{title}</div>}
        </div>
        <div className="action-sheet__body">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ActionSheet;
