import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Plus, Banknote, CreditCard, TrendingUp, TrendingDown, Coins, ImagePlus, X as XIcon, Camera, FileText, Filter, Pencil, History, Calendar, CalendarDays, CalendarClock, Maximize2, Images, Trash2 } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { fetchShifts, closeShift, updateShift, deleteShift, fetchPhotoReports, addPhotoReport, deletePhotoReport } from './api';
import { Select, Spinner, EmptyState, ErrorState, ConfirmModal } from '../../shared/ui';
import { STATS_YEARS, formatMoney } from '../../shared/constants/common';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import './ShiftsPage.scss';

const YEAR_OPTIONS = [{ value: '', label: 'Год' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))];
const MONTH_OPTIONS = [
  { value: '', label: 'Месяц' },
  ...['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
    .map((m, i) => ({ value: String(i + 1), label: m })),
];
const DAY_OPTIONS = [
  { value: '', label: 'День' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];
const NOW = new Date();
const CURRENT_YEAR_STR = String(NOW.getFullYear());
const DEFAULT_YEAR = STATS_YEARS.includes(CURRENT_YEAR_STR) ? CURRENT_YEAR_STR : STATS_YEARS[STATS_YEARS.length - 1];
const DEFAULT_MONTH = String(NOW.getMonth() + 1);
const DEFAULT_DAY = String(NOW.getDate());

/**
 * Запись сделана сегодня?
 *
 * Сравниваем по местному календарю (клуб в UTC+6): у toISOString() вечерние
 * смены уезжают на следующую дату, и кнопка удаления пропадала бы раньше,
 * чем бэкенд перестаёт её принимать.
 */
const isCreatedToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];
const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ── Фильтры ───────────────────────────────────────────────────
const FiltersBar = ({ year, month, day, onYear, onMonth, onDay, onReset, defaultDay = '' }) => {
  const isDefault = year === DEFAULT_YEAR && month === DEFAULT_MONTH && day === defaultDay;

  return (
    <div className="shifts-filters">
      <Filter size={14} className="shifts-filters__icon" />
      <span className="shifts-filters__label">Период:</span>

      <Select
        value={String(year)}
        onChange={onYear}
        options={YEAR_OPTIONS}
        placeholder="Год"
        className="shifts-filters__select-wrap"
        icon={<Calendar size={15} />}
      />

      <Select
        value={String(month)}
        onChange={onMonth}
        options={MONTH_OPTIONS}
        placeholder="Месяц"
        className="shifts-filters__select-wrap"
        icon={<CalendarDays size={15} />}
      />

      <Select
        value={String(day)}
        onChange={onDay}
        options={DAY_OPTIONS}
        placeholder="День"
        className="shifts-filters__select-wrap"
        icon={<CalendarClock size={15} />}
      />

      {!isDefault && (
        <button type="button" className="shifts-filters__reset" onClick={onReset}>
          <XIcon size={13} /> Сбросить
        </button>
      )}
    </div>
  );
};

// ── Модалка: добавить фото ────────────────────────────────────
const AddPhotoModal = ({ open, onClose, onSubmit }) => {
  const [photos, setPhotos] = useState([]); // { file, preview }
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    const newPhotos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 10));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || (photos.length === 0 && !desc.trim())) return;
    setSaving(true);
    try {
      await onSubmit({ photos, description: desc.trim() });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setDesc('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setDesc('');
  };

  if (!open) return null;

  return (
    <div className="shift-modal__backdrop" onClick={() => { reset(); onClose(); }}>
      <div className="shift-modal shift-modal--photo" onClick={(e) => e.stopPropagation()}>
        <div className="shift-modal__header">
          <div>
            <h2 className="shift-modal__title"><Camera size={18} /> Добавить фото</h2>
          </div>
          <button type="button" className="shift-modal__close" onClick={() => { reset(); onClose(); }}>✕</button>
        </div>

        <form className="shift-modal__form" onSubmit={handleSubmit}>
          <div
            className={`shift-modal__drop-zone ${photos.length > 0 ? 'shift-modal__drop-zone--has-photos' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="shift-modal__drop-icon-wrap">
              <ImagePlus size={20} className="shift-modal__drop-icon" />
            </span>
            <span className="shift-modal__drop-text">
              {photos.length > 0 ? `Добавить ещё · уже ${photos.length}` : 'Нажмите или перетащите фото'}
            </span>
            <span className="shift-modal__drop-hint">JPG, PNG · до 10 фото</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="shift-modal__file-input"
              onChange={(e) => e.target.files.length && handleFiles(e.target.files)}
            />
          </div>

          {photos.length > 0 && (
            <div className="shift-modal__photos">
              {photos.map((p, i) => (
                <div key={i} className="shift-modal__photo-thumb">
                  <img src={p.preview} alt={p.name} className="shift-modal__photo-img" />
                  <button type="button" className="shift-modal__photo-remove" onClick={() => removePhoto(i)}>
                    <XIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="shift-modal__field">
            <span className="shift-modal__label"><FileText size={14} /> Описание</span>
            <textarea
              className="shift-modal__textarea"
              placeholder="Например: чек за оплату МБанк, итог дня…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
            />
          </label>

          <div className="shift-modal__actions">
            <button type="button" className="shift-modal__btn shift-modal__btn--cancel" onClick={() => { reset(); onClose(); }} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="shift-modal__btn shift-modal__btn--photo" disabled={saving || (photos.length === 0 && !desc.trim())}>
              {saving ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Модалка: завершить / изменить смену ───────────────────────
// initial !== null → режим правки уже закрытой смены (поля предзаполнены).
const CloseShiftModal = ({ open, onClose, onSubmit, initial = null, title = 'Завершить смену', submitLabel = 'Завершить смену' }) => {
  const [cash, setCash]             = useState(initial ? String(initial.cash ?? '') : '');
  const [card, setCard]             = useState(initial ? String(initial.card ?? '') : '');
  const [expense, setExpense]       = useState(initial ? String(initial.expense ?? '') : '');
  const [advance, setAdvance]       = useState(initial ? String(initial.advance ?? '') : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const total = (Number(cash) || 0) + (Number(card) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        cash:        Number(cash)    || 0,
        card:        Number(card)    || 0,
        expense:     Number(expense) || 0,
        advance:     Number(advance) || 0,
        total,
        description: description.trim(),
      });
      if (!initial) {
        setCash(''); setCard(''); setExpense(''); setAdvance(''); setDescription('');
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="shift-modal__backdrop" onClick={onClose}>
      <div className="shift-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shift-modal__header">
          <div>
            <h2 className="shift-modal__title">{title}</h2>
          </div>
          <button type="button" className="shift-modal__close" onClick={onClose}>✕</button>
        </div>

        <form className="shift-modal__form" onSubmit={handleSubmit}>
          <div className="shift-modal__row">
            <label className="shift-modal__field">
              <span className="shift-modal__label"><Banknote size={13} /> Наличка</span>
              <div className="shift-modal__input-wrap">
                <input type="number" min="0" step="1" placeholder="0" value={cash}
                  onChange={(e) => setCash(e.target.value)} className="shift-modal__input" autoFocus />
                <span className="shift-modal__currency">сом</span>
              </div>
            </label>

            <label className="shift-modal__field">
              <span className="shift-modal__label"><CreditCard size={13} /> Карта</span>
              <div className="shift-modal__input-wrap">
                <input type="number" min="0" step="1" placeholder="0" value={card}
                  onChange={(e) => setCard(e.target.value)} className="shift-modal__input" />
                <span className="shift-modal__currency">сом</span>
              </div>
            </label>
          </div>

          <div className="shift-modal__row">
            <label className="shift-modal__field">
              <span className="shift-modal__label shift-modal__label--muted"><TrendingDown size={13} /> Расход</span>
              <div className="shift-modal__input-wrap shift-modal__input-wrap--sub">
                <input type="number" min="0" step="1" placeholder="0" value={expense}
                  onChange={(e) => setExpense(e.target.value)} className="shift-modal__input shift-modal__input--sub" />
                <span className="shift-modal__currency">сом</span>
              </div>
            </label>

            <label className="shift-modal__field">
              <span className="shift-modal__label shift-modal__label--muted"><Coins size={13} /> Аванс</span>
              <div className="shift-modal__input-wrap shift-modal__input-wrap--sub">
                <input type="number" min="0" step="1" placeholder="0" value={advance}
                  onChange={(e) => setAdvance(e.target.value)} className="shift-modal__input shift-modal__input--sub" />
                <span className="shift-modal__currency">сом</span>
              </div>
            </label>
          </div>

          <label className="shift-modal__field">
            <span className="shift-modal__label shift-modal__label--muted"><FileText size={13} /> Описание</span>
            <textarea
              className="shift-modal__textarea"
              placeholder="Комментарий к смене (необязательно)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="shift-modal__total-block">
            <div className="shift-modal__total">
              <span className="shift-modal__total-label"><TrendingUp size={15} /> Общий итог</span>
              <span className="shift-modal__total-value">{formatMoney(total)}</span>
            </div>
            {(Number(advance) > 0 || Number(expense) > 0) && (
              <div className="shift-modal__total-subs">
                {Number(advance) > 0 && (
                  <div className="shift-modal__total-sub">
                    <span className="shift-modal__total-sub-label"><Coins size={13} /> Аванс</span>
                    <span className="shift-modal__total-sub-value">{formatMoney(Number(advance))}</span>
                  </div>
                )}
                {Number(expense) > 0 && (
                  <div className="shift-modal__total-sub">
                    <span className="shift-modal__total-sub-label"><TrendingDown size={13} /> Расход</span>
                    <span className="shift-modal__total-sub-value">{formatMoney(Number(expense))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="shift-modal__error">{error}</p>}

          <div className="shift-modal__actions">
            <button type="button" className="shift-modal__btn shift-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="shift-modal__btn shift-modal__btn--submit" disabled={saving}>
              {saving ? 'Сохранение…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Лайтбокс (blur-preview → full load) ──────────────────────
const LightboxViewer = ({ lightbox, onClose }) => {
  const [src, setSrc] = useState(lightbox.thumbUrl);
  const [loading, setLoading] = useState(lightbox.url !== lightbox.thumbUrl);

  useEffect(() => {
    if (lightbox.url === lightbox.thumbUrl) return;
    const img = new window.Image();
    img.onload = () => {
      setSrc(lightbox.url);
      setLoading(false);
    };
    img.src = lightbox.url;
    return () => { img.onload = null; };
  }, [lightbox.url, lightbox.thumbUrl]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="shifts-lightbox" onClick={onClose}>
      <button
        type="button"
        className="shifts-lightbox__close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <XIcon size={20} />
      </button>
      <img
        src={src}
        alt=""
        className={`shifts-lightbox__img${loading ? ' shifts-lightbox__img--preview' : ''}`}
        onClick={(e) => e.stopPropagation()}
      />
      {loading && (
        <div className="shifts-lightbox__spinner">
          <div className="shifts-lightbox__spinner-ring" />
        </div>
      )}
    </div>
  );
};

// ── Главная страница ──────────────────────────────────────────
const TABS = [
  { id: 'photos', label: 'Отчёты', icon: Camera },
  { id: 'shifts', label: 'Завершение смены', icon: Clock },
];

const ShiftsPage = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('photos');

  const [shifts, setShifts] = useState([]);
  const [photoReports, setPhotoReports] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [shiftsError, setShiftsError] = useState(null);
  const [photosError, setPhotosError] = useState(null);

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [openHistoryId, setOpenHistoryId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  // Что удаляем: { kind: 'shift' | 'photo', id, label }. Удаление финансовой
  // записи и фотоотчёта необратимо, поэтому всегда через подтверждение.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Фильтры для отчётов
  const [pYear, setPYear] = useState(DEFAULT_YEAR);
  const [pMonth, setPMonth] = useState(DEFAULT_MONTH);
  const [pDay, setPDay] = useState(DEFAULT_DAY);

  // Фильтры для смен
  const [sYear, setSYear] = useState(DEFAULT_YEAR);
  const [sMonth, setSMonth] = useState(DEFAULT_MONTH);
  const [sDay, setSDay] = useState('');

  const photosControllerRef = useRef(null);
  const photosRequestSeq = useRef(0);
  const loadPhotos = useCallback(async () => {
    photosControllerRef.current?.abort();
    photosControllerRef.current = new AbortController();
    const { signal } = photosControllerRef.current;
    const seq = ++photosRequestSeq.current;
    setPhotosLoading(true);
    setPhotosError(null);
    try {
      const data = await fetchPhotoReports({ year: pYear, month: pMonth, day: pDay || undefined }, signal);
      if (photosRequestSeq.current !== seq) return;
      setPhotoReports(data);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (photosRequestSeq.current !== seq) return;
      setPhotosError(getApiErrorMessage(err));
    } finally {
      if (photosRequestSeq.current === seq) setPhotosLoading(false);
    }
  }, [pYear, pMonth, pDay]);

  const shiftsControllerRef = useRef(null);
  const shiftsRequestSeq = useRef(0);
  const loadShifts = useCallback(async () => {
    shiftsControllerRef.current?.abort();
    shiftsControllerRef.current = new AbortController();
    const { signal } = shiftsControllerRef.current;
    const seq = ++shiftsRequestSeq.current;
    setShiftsLoading(true);
    setShiftsError(null);
    try {
      const data = await fetchShifts({ year: sYear, month: sMonth, day: sDay || undefined }, signal);
      if (shiftsRequestSeq.current !== seq) return;
      setShifts(data);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (shiftsRequestSeq.current !== seq) return;
      setShiftsError(getApiErrorMessage(err));
    } finally {
      if (shiftsRequestSeq.current === seq) setShiftsLoading(false);
    }
  }, [sYear, sMonth, sDay]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  const handleCloseShift = async ({ cash, card, expense, advance, total, description }) => {
    await closeShift({ cash, card, expense, advance, total, description });
    await loadShifts();
  };

  const handleEditShift = async (payload) => {
    await updateShift(editingShift.id, payload);
    await loadShifts();
  };

  const handleAddPhoto = async ({ photos, description }) => {
    await addPhotoReport({ photos, description });
    await loadPhotos();
  };

  /**
   * Удаление смены или фотоотчёта после подтверждения.
   *
   * Список перезагружаем с сервера, а не вычёркиваем запись локально: смена —
   * финансовая запись, и лучше увидеть настоящее состояние базы, чем свою
   * догадку о нём. Ошибку показываем на месте, список при этом не ломается.
   */
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    setDeletingId(`${kind}-${id}`);
    setDeleteError(null);
    try {
      if (kind === 'shift') {
        await deleteShift(id);
        await loadShifts();
      } else {
        await deletePhotoReport(id);
        await loadPhotos();
      }
    } catch (err) {
      setDeleteError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="shifts-page">

      {/* ── Табы ─────────────────────────────────────────────── */}
      <div className="shifts-tabs">
        <div className="ui-tabs shifts-tabs__nav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`ui-tabs__tab${activeTab === id ? ' ui-tabs__tab--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              {label}
              {id === 'photos' && photoReports.length > 0 && (
                <span className="ui-tabs__badge">{photoReports.length}</span>
              )}
              {id === 'shifts' && shifts.length > 0 && (
                <span className="ui-tabs__badge shifts-tabs__badge--alert">{shifts.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="shifts-tabs__action">
          {activeTab === 'photos' && (
            <button type="button" className="shifts-page__add-btn shifts-page__add-btn--photo" onClick={() => setPhotoModalOpen(true)}>
              <ImagePlus size={16} /> Добавить фото
            </button>
          )}
          {activeTab === 'shifts' && (
            <button type="button" className="shifts-page__add-btn shifts-page__add-btn--shift" onClick={() => setShiftModalOpen(true)}>
              <Plus size={16} /> Завершить смену
            </button>
          )}
        </div>
      </div>

      {/* ── Таб: Отчёты ──────────────────────────────────────── */}
      {activeTab === 'photos' && (
        <div className="shifts-tab-content">
          <FiltersBar
            year={pYear} month={pMonth} day={pDay}
            onYear={setPYear} onMonth={setPMonth} onDay={setPDay}
            onReset={() => { setPYear(DEFAULT_YEAR); setPMonth(DEFAULT_MONTH); setPDay(DEFAULT_DAY); }}
            defaultDay={DEFAULT_DAY}
          />

          {photosLoading ? (
            <div className="shifts-page__loading"><Spinner /></div>
          ) : photosError ? (
            <ErrorState compact message={photosError} onRetry={loadPhotos} />
          ) : photoReports.length === 0 ? (
            <EmptyState compact message="Фото отчётов пока нет — нажмите «Добавить фото», чтобы загрузить первый отчёт" />
          ) : (
            <div className="photo-reports">
              {photoReports.map((r, idx) => (
                <div key={r.id} className="photo-card" style={{ '--row-i': idx }}>
                  <div className="photo-card__header">
                    <div className="shift-card__avatar" style={{ background: getAvatarColor(r.employeeName), width: 36, height: 36, fontSize: 12.5 }}>
                      {getInitials(r.employeeName)}
                    </div>
                    <div className="photo-card__who">
                      <span className="photo-card__name">{r.employeeName}</span>
                      <span className="photo-card__date">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="photo-card__head-actions">
                      {(r.photos || []).length > 0 && (
                        <span className="photo-card__count">
                          <Images size={12} />
                          {r.photos.length}
                        </span>
                      )}
                      {/* Ошибочный отчёт раньше висел вечно: добавить фото
                          можно было, убрать — нет. Удаление снимает и файлы. */}
                      {isAdmin && (
                        <button
                          type="button"
                          className="shifts-del-btn"
                          onClick={() => { setDeleteError(null); setPendingDelete({ kind: 'photo', id: r.id, label: r.employeeName }); }}
                          disabled={deletingId === `photo-${r.id}`}
                          title="Удалить фото-отчёт"
                          aria-label="Удалить фото-отчёт"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.description && <p className="photo-card__desc">{r.description}</p>}
                  <div className="photo-card__photos">
                    {(r.photos || []).map((p, i) => {
                      const thumbUrl = p.thumbnail_url || p.thumbnailUrl || p.url;
                      return (
                        <button
                          key={i}
                          type="button"
                          className="photo-card__thumb-btn"
                          onClick={() => setLightbox({ url: p.url, thumbUrl })}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Фото ${i + 1}`}
                            className="photo-card__thumb"
                            loading="lazy"
                            decoding="async"
                            onLoad={(e) => {
                              e.currentTarget.classList.add('photo-card__thumb--loaded');
                              e.currentTarget.closest('.photo-card__thumb-btn').classList.add('photo-card__thumb-btn--loaded');
                            }}
                          />
                          <span className="photo-card__thumb-overlay">
                            <Maximize2 size={15} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Таб: Завершение смены ─────────────────────────────── */}
      {activeTab === 'shifts' && (
        <div className="shifts-tab-content">
          <FiltersBar
            year={sYear} month={sMonth} day={sDay}
            onYear={setSYear} onMonth={setSMonth} onDay={setSDay}
            onReset={() => { setSYear(DEFAULT_YEAR); setSMonth(DEFAULT_MONTH); setSDay(''); }}
          />

          {shiftsLoading ? (
            <div className="shifts-page__loading"><Spinner /></div>
          ) : shiftsError ? (
            <ErrorState compact message={shiftsError} onRetry={loadShifts} />
          ) : shifts.length === 0 ? (
            <EmptyState compact message="Смен пока нет — нажмите «Завершить смену», чтобы добавить первую запись" />
          ) : (
            <div className="shifts-page__list">
              {shifts.map((s, idx) => (
                <div key={s.id} className="shift-card" style={{ '--row-i': idx }}>
                  <div className="shift-card__left">
                    <div className="shift-card__avatar" style={{ background: getAvatarColor(s.employeeName) }}>
                      {getInitials(s.employeeName)}
                    </div>
                    <div className="shift-card__who">
                      <span className="shift-card__name">{s.employeeName}</span>
                      <span className="shift-card__date">{formatDate(s.createdAt)}</span>
                    </div>
                  </div>

                  <div className="shift-card__amounts">
                    <div className="shift-card__amount">
                      <span className="shift-card__amount-label"><Banknote size={13} /> Наличка</span>
                      <span className="shift-card__amount-value shift-card__amount-value--cash">{formatMoney(s.cash)}</span>
                    </div>
                    <div className="shift-card__divider">+</div>
                    <div className="shift-card__amount">
                      <span className="shift-card__amount-label"><CreditCard size={13} /> Карта</span>
                      <span className="shift-card__amount-value shift-card__amount-value--card">{formatMoney(s.card)}</span>
                    </div>
                    <div className="shift-card__divider">=</div>
                    <div className="shift-card__amount shift-card__amount--total">
                      <span className="shift-card__amount-label"><TrendingUp size={13} /> Итого</span>
                      <span className="shift-card__amount-value shift-card__amount-value--total">{formatMoney(s.total)}</span>
                    </div>
                    {Number(s.advance) > 0 && (
                      <>
                        <div className="shift-card__divider">·</div>
                        <div className="shift-card__amount">
                          <span className="shift-card__amount-label"><Coins size={13} /> Аванс</span>
                          <span className="shift-card__amount-value shift-card__amount-value--advance">{formatMoney(s.advance)}</span>
                        </div>
                      </>
                    )}
                    {Number(s.expense) > 0 && (
                      <>
                        <div className="shift-card__divider">·</div>
                        <div className="shift-card__amount">
                          <span className="shift-card__amount-label"><TrendingDown size={13} /> Расход</span>
                          <span className="shift-card__amount-value shift-card__amount-value--expense">{formatMoney(s.expense)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="shift-card__actions">
                    {s.isEdited ? (
                      <button
                        type="button"
                        className="shift-card__history-btn"
                        onClick={() => setOpenHistoryId((id) => (id === s.id ? null : s.id))}
                      >
                        <History size={13} />
                        {openHistoryId === s.id ? 'Скрыть исходные данные' : 'Изменено'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="shift-card__edit-btn"
                        onClick={() => setEditingShift(s)}
                      >
                        <Pencil size={13} /> Изменить
                      </button>
                    )}
                    {/* Только смена за сегодня и только администратору —
                        то же правило, что и на сервере. Вчерашние отчёты
                        задним числом не переписываются. */}
                    {isAdmin && isCreatedToday(s.createdAt) && (
                      <button
                        type="button"
                        className="shifts-del-btn"
                        onClick={() => { setDeleteError(null); setPendingDelete({ kind: 'shift', id: s.id, label: `${s.employeeName} · ${formatMoney(s.total)}` }); }}
                        disabled={deletingId === `shift-${s.id}`}
                        title="Удалить смену"
                        aria-label="Удалить смену"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {s.description && (
                    <p className="shift-card__desc">{s.description}</p>
                  )}

                  {openHistoryId === s.id && s.previous && (
                    <div className="shift-card__prev">
                      <span className="shift-card__prev-label">Было до изменения:</span>
                      <div className="shift-card__prev-row">
                        <span><Banknote size={12} /> {formatMoney(s.previous.cash)}</span>
                        <span><CreditCard size={12} /> {formatMoney(s.previous.card)}</span>
                        <span><TrendingUp size={12} /> {formatMoney(s.previous.total)}</span>
                        {Number(s.previous.advance) > 0 && <span><Coins size={12} /> {formatMoney(s.previous.advance)}</span>}
                        {Number(s.previous.expense) > 0 && <span><TrendingDown size={12} /> {formatMoney(s.previous.expense)}</span>}
                      </div>
                      {s.previous.description && (
                        <p className="shift-card__prev-desc">{s.previous.description}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модалки */}
      <AddPhotoModal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} onSubmit={handleAddPhoto} />
      <CloseShiftModal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} onSubmit={handleCloseShift} />

      {editingShift && (
        <CloseShiftModal
          key={editingShift.id}
          open
          initial={editingShift}
          title="Изменить смену"
          submitLabel="Сохранить изменения"
          onClose={() => setEditingShift(null)}
          onSubmit={handleEditShift}
        />
      )}

      {/* Лайтбокс */}
      {lightbox && (
        <LightboxViewer lightbox={lightbox} onClose={() => setLightbox(null)} />
      )}

      {/* Подтверждение удаления */}
      {pendingDelete && (
        <ConfirmModal
          danger
          title={pendingDelete.kind === 'shift' ? 'Удалить смену?' : 'Удалить фото-отчёт?'}
          message={
            pendingDelete.kind === 'shift'
              ? `${pendingDelete.label}. Запись исчезнет из истории и из отчётов — восстановить её будет нельзя.`
              : `Отчёт ${pendingDelete.label}. Фотографии будут удалены с сервера безвозвратно.`
          }
          confirmText="Удалить"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Не удалось удалить — говорим прямо, а не молча оставляем запись */}
      {deleteError && (
        <div className="shifts-page__delete-error" role="alert">
          <span>{deleteError}</span>
          <button type="button" onClick={() => setDeleteError(null)} aria-label="Закрыть">
            <XIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ShiftsPage;
