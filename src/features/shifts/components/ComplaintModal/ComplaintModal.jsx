import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { createComplaint } from '../../api/shiftsApi';
import './ComplaintModal.scss';

const extractErrMsg = (err, fallback) => {
  const d = err?.response?.data;
  if (!d) return fallback;
  const raw = d.error ?? d.detail ?? d.message ?? d;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null) return raw.message ?? raw.detail ?? fallback;
  return fallback;
};

/** Активный фрагмент @ник без пробелов от последнего @ до курсора. */
function getActiveMention(text, cursorPos) {
  if (cursorPos == null || cursorPos < 1) return null;
  const before = text.slice(0, cursorPos);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  const afterAt = before.slice(at + 1);
  if (/[\s\n\r]/.test(afterAt)) return null;
  return { start: at, query: afterAt };
}

const userLabel = (u) => String(u?.name || u?.username || u?.email || 'Сотрудник').trim();

const ComplaintModal = ({ open, onClose, employees, shiftId, onSuccess }) => {
  const [text, setText] = useState('');
  const [mentionedIds, setMentionedIds] = useState(() => new Set());
  const [mention, setMention] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setMentionedIds(new Set());
      setMention(null);
      setError('');
      setActiveIdx(0);
    }
  }, [open]);

  const updateMentionFromInput = useCallback(
    (value, cursorPos) => {
      const m = getActiveMention(value, cursorPos);
      if (!m) {
        setMention(null);
        return;
      }
      const q = m.query.toLowerCase();
      const filtered = employees
        .filter((u) => {
          const blob = `${u.name || ''} ${u.username || ''} ${u.email || ''}`.toLowerCase();
          return blob.includes(q);
        })
        .slice(0, 10);
      setMention({ ...m, filtered });
      setActiveIdx(0);
    },
    [employees]
  );

  const handleChange = (e) => {
    const v = e.target.value;
    const pos = e.target.selectionStart;
    setText(v);
    updateMentionFromInput(v, pos);
  };

  const handleSelect = (u) => {
    const el = taRef.current;
    if (!el || !mention) return;
    const pos = el.selectionStart;
    const before = text.slice(0, mention.start);
    const after = text.slice(pos);
    const insert = `@${userLabel(u)} `;
    const newText = before + insert + after;
    const newPos = before.length + insert.length;
    setText(newText);
    setMentionedIds((prev) => new Set([...prev, Number(u.id)]));
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  const handleKeyDown = (e) => {
    if (!mention || !mention.filtered?.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, mention.filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSelect(mention.filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setMention(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      setError('Опишите причину или суть жалобы');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createComplaint({
        body,
        mentioned_user_ids: Array.from(mentionedIds),
        ...(shiftId != null ? { shift_id: Number(shiftId) } : {}),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(extractErrMsg(err, 'Не удалось отправить жалобу'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal complaint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Жалоба</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body complaint-modal__body">
            <label htmlFor="complaint-body">Причина / текст жалобы *</label>
            <p className="complaint-modal__hint">
              Напишите текст. Чтобы указать сотрудника, введите <strong>@</strong> и выберите из списка или допишите имя.
            </p>
            <div className="complaint-modal__field-wrap">
              <textarea
                ref={taRef}
                id="complaint-body"
                className="complaint-modal__textarea"
                rows={6}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onClick={(e) => updateMentionFromInput(text, e.target.selectionStart)}
                onSelect={(e) => updateMentionFromInput(text, e.target.selectionStart)}
                placeholder="Например: задержка поставки @Иван …"
                maxLength={4000}
                disabled={submitting}
              />
              {mention && mention.filtered?.length > 0 && (
                <ul className="complaint-modal__mention-list" role="listbox">
                  {mention.filtered.map((u, i) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === activeIdx}
                        className={`complaint-modal__mention-item${i === activeIdx ? ' complaint-modal__mention-item--active' : ''}`}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => handleSelect(u)}
                      >
                        <span className="complaint-modal__mention-name">{userLabel(u)}</span>
                        {u.username && u.name ? (
                          <span className="complaint-modal__mention-meta">@{u.username}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="modal__error">{error}</p>}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {submitting ? 'Отправка…' : 'Отправить жалобу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintModal;
