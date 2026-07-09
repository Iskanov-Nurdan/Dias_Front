import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Plus, Banknote, CreditCard, TrendingUp, TrendingDown, Coins, ImagePlus, X as XIcon, Camera, FileText, Filter } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { fetchShifts, closeShift, fetchPhotoReports, addPhotoReport } from './api';
import { Select } from '../../shared/ui';
import './ShiftsPage.scss';

const FIXED_YEARS = [2026, 2027];
const YEAR_OPTIONS = [{ value: '', label: 'Год' }, ...FIXED_YEARS.map((y) => ({ value: String(y), label: String(y) }))];
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
const DEFAULT_YEAR = String(NOW.getFullYear());
const DEFAULT_MONTH = String(NOW.getMonth() + 1);

const formatMoney = (v) => Number(v).toLocaleString('ru-RU') + ' сом';

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
const FiltersBar = ({ year, month, day, onYear, onMonth, onDay, onReset }) => {
  const isDefault = year === DEFAULT_YEAR && month === DEFAULT_MONTH && !day;

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
      />

      <Select
        value={String(month)}
        onChange={onMonth}
        options={MONTH_OPTIONS}
        placeholder="Месяц"
        className="shifts-filters__select-wrap"
      />

      <Select
        value={String(day)}
        onChange={onDay}
        options={DAY_OPTIONS}
        placeholder="День"
        className="shifts-filters__select-wrap"
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
            <ImagePlus size={28} className="shift-modal__drop-icon" />
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

// ── Модалка: завершить смену ──────────────────────────────────
const CloseShiftModal = ({ open, onClose, onSubmit }) => {
  const [cash, setCash]       = useState('');
  const [card, setCard]       = useState('');
  const [expense, setExpense] = useState('');
  const [advance, setAdvance] = useState('');
  const [saving, setSaving]   = useState(false);

  const total = (Number(cash) || 0) + (Number(card) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit({
        cash:    Number(cash)    || 0,
        card:    Number(card)    || 0,
        expense: Number(expense) || 0,
        advance: Number(advance) || 0,
        total,
      });
      setCash(''); setCard(''); setExpense(''); setAdvance('');
      onClose();
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
            <h2 className="shift-modal__title">Завершить смену</h2>
          </div>
          <button type="button" className="shift-modal__close" onClick={onClose}>✕</button>
        </div>

        <form className="shift-modal__form" onSubmit={handleSubmit}>
          <label className="shift-modal__field">
            <span className="shift-modal__label"><Banknote size={15} /> Наличка</span>
            <div className="shift-modal__input-wrap">
              <input type="number" min="0" step="1" placeholder="0" value={cash}
                onChange={(e) => setCash(e.target.value)} className="shift-modal__input" autoFocus />
              <span className="shift-modal__currency">сом</span>
            </div>
          </label>

          <label className="shift-modal__field">
            <span className="shift-modal__label"><CreditCard size={15} /> Карта</span>
            <div className="shift-modal__input-wrap">
              <input type="number" min="0" step="1" placeholder="0" value={card}
                onChange={(e) => setCard(e.target.value)} className="shift-modal__input" />
              <span className="shift-modal__currency">сом</span>
            </div>
          </label>

          <label className="shift-modal__field">
            <span className="shift-modal__label"><TrendingDown size={15} /> Расход</span>
            <div className="shift-modal__input-wrap">
              <input type="number" min="0" step="1" placeholder="0" value={expense}
                onChange={(e) => setExpense(e.target.value)} className="shift-modal__input" />
              <span className="shift-modal__currency">сом</span>
            </div>
          </label>

          <label className="shift-modal__field">
            <span className="shift-modal__label"><Coins size={15} /> Аванс</span>
            <div className="shift-modal__input-wrap">
              <input type="number" min="0" step="1" placeholder="0" value={advance}
                onChange={(e) => setAdvance(e.target.value)} className="shift-modal__input" />
              <span className="shift-modal__currency">сом</span>
            </div>
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

          <div className="shift-modal__actions">
            <button type="button" className="shift-modal__btn shift-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="shift-modal__btn shift-modal__btn--submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Завершить смену'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Главная страница ──────────────────────────────────────────
const TABS = [
  { id: 'photos', label: 'Отчёты', icon: Camera },
  { id: 'shifts', label: 'Завершение смены', icon: Clock },
];

const ShiftsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('photos');

  const [shifts, setShifts] = useState([]);
  const [photoReports, setPhotoReports] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Фильтры для отчётов
  const [pYear, setPYear] = useState(DEFAULT_YEAR);
  const [pMonth, setPMonth] = useState(DEFAULT_MONTH);
  const [pDay, setPDay] = useState('');

  // Фильтры для смен
  const [sYear, setSYear] = useState(DEFAULT_YEAR);
  const [sMonth, setSMonth] = useState(DEFAULT_MONTH);
  const [sDay, setSDay] = useState('');

  const loadPhotos = useCallback(async () => {
    setPhotosLoading(true);
    try {
      const data = await fetchPhotoReports({ year: pYear, month: pMonth, day: pDay || undefined });
      setPhotoReports(data);
    } finally {
      setPhotosLoading(false);
    }
  }, [pYear, pMonth, pDay]);

  const loadShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const data = await fetchShifts({ year: sYear, month: sMonth, day: sDay || undefined });
      setShifts(data);
    } finally {
      setShiftsLoading(false);
    }
  }, [sYear, sMonth, sDay]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  const handleCloseShift = async ({ cash, card, expense, advance, total }) => {
    await closeShift({ cash, card, expense, advance, total });
    await loadShifts();
  };

  const handleAddPhoto = async ({ photos, description }) => {
    await addPhotoReport({ photos, description });
    await loadPhotos();
  };

  return (
    <div className="shifts-page">

      {/* ── Табы ─────────────────────────────────────────────── */}
      <div className="shifts-tabs">
        <div className="shifts-tabs__nav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`shifts-tabs__btn${activeTab === id ? ' shifts-tabs__btn--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              {label}
              {id === 'photos' && photoReports.length > 0 && (
                <span className="shifts-tabs__badge">{photoReports.length}</span>
              )}
              {id === 'shifts' && shifts.length > 0 && (
                <span className="shifts-tabs__badge shifts-tabs__badge--shift">{shifts.length}</span>
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
            onReset={() => { setPYear(DEFAULT_YEAR); setPMonth(DEFAULT_MONTH); setPDay(''); }}
          />

          {photosLoading ? (
            <div className="shifts-page__loading"><span>Загрузка…</span></div>
          ) : photoReports.length === 0 ? (
            <div className="shifts-section__empty">
              <Camera size={40} strokeWidth={1} className="shifts-page__empty-icon" />
              <p>Фото отчётов пока нет</p>
              <span>Нажмите «Добавить фото» чтобы загрузить первый отчёт</span>
            </div>
          ) : (
            <div className="photo-reports">
              {photoReports.map((r) => (
                <div key={r.id} className="photo-card">
                  <div className="photo-card__header">
                    <div className="shift-card__avatar" style={{ background: getAvatarColor(r.employeeName), width: 34, height: 34, fontSize: 12 }}>
                      {getInitials(r.employeeName)}
                    </div>
                    <div className="photo-card__who">
                      <span className="photo-card__name">{r.employeeName}</span>
                      <span className="photo-card__date">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                  {r.description && <p className="photo-card__desc">{r.description}</p>}
                  <div className="photo-card__photos">
                    {(r.photos || []).map((p, i) => (
                      <button key={i} type="button" className="photo-card__thumb-btn" onClick={() => setLightbox(p)}>
                        <img src={p.url} alt={`Фото ${i + 1}`} className="photo-card__thumb" />
                      </button>
                    ))}
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
            <div className="shifts-page__loading"><span>Загрузка…</span></div>
          ) : shifts.length === 0 ? (
            <div className="shifts-section__empty">
              <Clock size={40} strokeWidth={1} className="shifts-page__empty-icon" />
              <p>Смен пока нет</p>
              <span>Нажмите «Завершить смену» чтобы добавить первую запись</span>
            </div>
          ) : (
            <div className="shifts-page__list">
              {shifts.map((s) => (
                <div key={s.id} className="shift-card">
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модалки */}
      <AddPhotoModal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} onSubmit={handleAddPhoto} />
      <CloseShiftModal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} onSubmit={handleCloseShift} />

      {/* Лайтбокс */}
      {lightbox && (
        <div className="shifts-lightbox" onClick={() => setLightbox(null)}>
          <button className="shifts-lightbox__close" onClick={() => setLightbox(null)}><XIcon size={20} /></button>
          <img src={lightbox.url} alt="" className="shifts-lightbox__img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default ShiftsPage;
