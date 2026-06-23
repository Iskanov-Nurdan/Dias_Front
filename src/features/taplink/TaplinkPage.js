import React, { useState, useRef, useEffect, useCallback } from 'react';
import './TaplinkPage.scss';
import { loadTaplinkData, loadTaplinkDataAsync, hasSessionData } from './taplinkStore';
import { BACKEND_ENABLED, submitBooking } from './api';


// ─── Icons ────────────────────────────────────────────────────────────────────

const SunIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1"  x2="12" y2="3"  />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1"  y1="12" x2="3"  y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const ChevLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

// ─── Small components ─────────────────────────────────────────────────────────

const VideoSlot = ({ src }) => {
  if (!src) return null;
  if (src.startsWith('http')) {
    return (
      <div className="tp-video tp-video--embed">
        <iframe src={src} className="tp-video__frame" allowFullScreen title="видео" />
      </div>
    );
  }
  return (
    <div className="tp-video tp-video--file">
      <video src={src} controls className="tp-video__player" playsInline preload="metadata" />
    </div>
  );
};

// ─── Trainer Slider ───────────────────────────────────────────────────────────

const TrainersSlider = ({ trainers, onDetails, onBook }) => {
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [dir, setDir] = useState('next');
  const touchX = useRef(null);

  const go = useCallback((next, d) => {
    setDir(d);
    setAnimKey(k => k + 1);
    setIdx(next);
  }, []);

  const prev = useCallback(() => go((idx - 1 + trainers.length) % trainers.length, 'prev'), [idx, trainers.length, go]);
  const next = useCallback(() => go((idx + 1) % trainers.length, 'next'), [idx, trainers.length, go]);

  useEffect(() => {
    if (trainers.length < 2) return;
    const timer = setInterval(next, 3000);
    return () => clearInterval(timer);
  }, [next, trainers.length]);

  const onTouchStart = e => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd   = e => {
    if (touchX.current === null) return;
    const dx = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 44) dx > 0 ? next() : prev();
    touchX.current = null;
  };

  if (!trainers.length) return null;
  const t = trainers[idx] || trainers[0];

  return (
    <div className="tp-slider" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div key={animKey} className={`tp-tc tp-tc--${animKey === 0 ? 'init' : dir}`}>

        {/* Шапка: секция + счётчик */}
        <div className="tp-tc__header">
          <span className="tp-tc__sport">{t.sportName}</span>
          <span className="tp-tc__counter">{idx + 1} / {trainers.length}</span>
        </div>

        {/* Фото */}
        <div className="tp-tc__ring">
          {t.photo
            ? <img src={t.photo} alt={t.name} className="tp-tc__ava-img" />
            : <div className="tp-tc__ava">{t.emoji || '👤'}</div>
          }
        </div>

        {/* Имя */}
        <h3 className="tp-tc__name">{t.name}</h3>

        {/* Краткое bio */}
        <p className="tp-tc__bio">{t.shortBio}</p>

        {/* Стат-полоса: опыт + главное достижение */}
        <div className="tp-tc__stats">
          <div className="tp-tc__stat">
            <span className="tp-tc__stat-val">⭐ {t.experience}</span>
            <span className="tp-tc__stat-lbl">опыта</span>
          </div>
          {t.achievements?.[0] && (
            <>
              <div className="tp-tc__stat-sep" />
              <div className="tp-tc__stat tp-tc__stat--wide">
                <span className="tp-tc__stat-val">🏆</span>
                <span className="tp-tc__stat-lbl">{t.achievements[0]}</span>
              </div>
            </>
          )}
        </div>

        {/* Кнопки */}
        <div className="tp-tc__btns">
          <button className="tp-btn tp-btn--outline" onClick={() => onDetails(t)}>Подробнее</button>
          <button className="tp-btn tp-btn--red" onClick={() => onBook(t)}>Записаться</button>
        </div>
      </div>

      <button className="tp-slider__prev" onClick={prev} aria-label="Назад"><ChevLeft /></button>
      <button className="tp-slider__next" onClick={next} aria-label="Вперёд"><ChevRight /></button>

      <div className="tp-dots">
        {trainers.map((_, i) => (
          <button
            key={i}
            className={`tp-dot${i === idx ? ' tp-dot--on' : ''}`}
            onClick={() => go(i, i >= idx ? 'next' : 'prev')}
            aria-label={`Тренер ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Sport Sheet (bottom) ─────────────────────────────────────────────────────

const SportSheet = ({ sport, onClose, onBook }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-sheet__bar" />
        <button className="tp-sheet__x" onClick={onClose}><XIcon /></button>

        <div
          className="tp-sheet__sport-thumb"
          style={sport.photo ? {} : { background: sport.gradient }}
        >
          {sport.photo
            ? <img src={sport.photo} alt={sport.name} className="tp-sheet__sport-img" />
            : <span>{sport.emoji}</span>
          }
        </div>
        <h2 className="tp-sheet__title">{sport.name}</h2>
        <p className="tp-sheet__text">{sport.desc}</p>

        {sport.schedule && sport.schedule.length > 0 && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Расписание</h4>
            <div className="tp-sched-list">
              {sport.schedule.map((row, i) => (
                <div key={row.id || i} className="tp-sched-item">
                  <div className="tp-sched-item__left">
                    {row.group && <span className="tp-sched-item__group">{row.group}</span>}
                    {row.trainer && <span className="tp-sched-item__trainer">{row.trainer}</span>}
                  </div>
                  <div className="tp-sched-item__right">
                    <span className="tp-sched-item__days">{row.days}</span>
                    <span className="tp-sched-item__time">{row.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sport.videos && sport.videos.some(Boolean) && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Видео о секции</h4>
            <div className="tp-sheet__videos">
              {sport.videos.map((v, i) => <VideoSlot key={i} src={v} />)}
            </div>
          </div>
        )}

        <button
          className="tp-btn tp-btn--red tp-btn--full"
          onClick={() => { onClose(); onBook({ sport: sport.name }); }}
        >
          Записаться на «{sport.name}»
        </button>
      </div>
    </div>
  );
};

// ─── Trainer Sheet (bottom) ───────────────────────────────────────────────────

const TrainerSheet = ({ trainer, onClose, onBook, sports = [] }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Find schedule rows that belong to this trainer across all matching sports
  const trainerSchedule = sports
    .filter(s => s.name === trainer.sportName || s.schedule?.some(r => r.trainer === trainer.name))
    .flatMap(s => (s.schedule || []).filter(r => !r.trainer || r.trainer === trainer.name)
      .map(r => ({ ...r, sportName: s.name }))
    );

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-sheet__bar" />
        <button className="tp-sheet__x" onClick={onClose}><XIcon /></button>

        <div className="tp-sheet__ring">
          {trainer.photo
            ? <img src={trainer.photo} alt={trainer.name} className="tp-sheet__ava-img" />
            : <div className="tp-sheet__ava">{trainer.emoji || '👤'}</div>
          }
        </div>
        <h2 className="tp-sheet__title">{trainer.name}</h2>

        <div className="tp-sheet__chips">
          <span className="tp-chip tp-chip--red">{trainer.sportName}</span>
          <span className="tp-chip">{trainer.experience} опыта</span>
        </div>

        <p className="tp-sheet__text">{trainer.bio}</p>

        <div className="tp-sheet__section">
          <h4 className="tp-sheet__sub">Достижения</h4>
          {trainer.achievements.map((a, i) => (
            <div key={i} className="tp-sheet__achieve">
              <span className="tp-sheet__achieve-ic">🏆</span>
              <span>{a}</span>
            </div>
          ))}
        </div>

        {trainerSchedule.length > 0 && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Расписание</h4>
            <div className="tp-sched-list">
              {trainerSchedule.map((row, i) => (
                <div key={row.id || i} className="tp-sched-item">
                  <div className="tp-sched-item__left">
                    {row.group && <span className="tp-sched-item__group">{row.group}</span>}
                    {trainerSchedule.some(r => r.sportName !== trainerSchedule[0].sportName) && (
                      <span className="tp-sched-item__trainer">{row.sportName}</span>
                    )}
                  </div>
                  <div className="tp-sched-item__right">
                    <span className="tp-sched-item__days">{row.days}</span>
                    <span className="tp-sched-item__time">{row.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trainer.videos.some(Boolean) && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Видео тренировок</h4>
            <div className="tp-sheet__videos">
              {trainer.videos.map((v, i) => <VideoSlot key={i} src={v} />)}
            </div>
          </div>
        )}

        <button
          className="tp-btn tp-btn--red tp-btn--full"
          onClick={() => { onClose(); onBook({ sport: trainer.sportName, trainer: trainer.name }); }}
        >
          Записаться к {trainer.name.split(' ')[0]}
        </button>
      </div>
    </div>
  );
};

// ─── Booking Modal (full screen) ──────────────────────────────────────────────

const EMPTY_BOOKING = { name: '', phone: '+996 ', sport: '', trainer: '', preferredTime: '', comment: '' };

const BookingModal = ({ onClose, initial = {}, dark, sports = [], trainers = [] }) => {
  const [form, setForm] = useState({ ...EMPTY_BOOKING, ...initial });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const set = f => e => {
    setForm(p => ({ ...p, [f]: e.target.value }));
    setErrors(p => ({ ...p, [f]: '' }));
  };

  // When sport changes — reset trainer & preferredTime if they don't match new sport
  const setSport = e => {
    const sport = e.target.value;
    setForm(p => ({
      ...p,
      sport,
      trainer:       trainers.find(t => t.name === p.trainer && t.sportName === sport) ? p.trainer : '',
      preferredTime: '',
    }));
    setErrors(p => ({ ...p, sport: '' }));
  };

  // Only show trainers for the selected sport
  const sportTrainers = form.sport
    ? trainers.filter(t => t.sportName === form.sport)
    : [];

  // Schedule slots for the selected sport → "Группа — Дни Время"
  const selectedSport   = sports.find(s => s.name === form.sport);
  const scheduleSlots   = selectedSport?.schedule || [];

  const submit = async e => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Введите ФИО';
    const phoneClean = form.phone.replace(/[\s\-()]/g, '');
    if (!phoneClean || phoneClean === '+996') errs.phone = 'Введите номер телефона';
    if (!form.sport) errs.sport = 'Выберите секцию';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (BACKEND_ENABLED) {
      setSending(true);
      try {
        await submitBooking({
          name:          form.name.trim(),
          phone:         form.phone.trim(),
          sport:         form.sport,
          trainer:       form.trainer || undefined,
          preferredTime: form.preferredTime.trim() || undefined,
          comment:       form.comment.trim() || undefined,
        });
        setDone(true);
      } catch {
        setErrors(p => ({ ...p, _submit: 'Ошибка отправки. Попробуйте ещё раз.' }));
      } finally {
        setSending(false);
      }
    } else {
      setDone(true);
    }
  };

  return (
    <div className={`tp-fs-modal${dark ? ' tp-page--dark' : ' tp-page--light'}`}>

      {/* Sticky top bar */}
      <div className="tp-fs-modal__bar">
        <span className="tp-fs-modal__bar-title">Онлайн-запись</span>
        <button className="tp-fs-modal__x tp-fs-modal__x--bar" onClick={onClose} aria-label="Закрыть">
          <XIcon />
        </button>
      </div>

      <div className="tp-fs-modal__body">
        {done ? (
          <div className="tp-modal-done">
            <div className="tp-modal-done__ic">✅</div>
            <h2 className="tp-modal-done__title">Заявка принята!</h2>
            <p className="tp-modal-done__text">
              Мы свяжемся с вами в течение часа для подтверждения записи.
            </p>
            <button className="tp-btn tp-btn--red tp-btn--full" onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <>
            <div className="tp-fs-modal__hero">
              <h2 className="tp-fs-modal__title">Запись на тренировку</h2>
              <p className="tp-fs-modal__sub">Оставьте заявку — мы перезвоним вам</p>
            </div>

            <form className="tp-form" onSubmit={submit} noValidate>

              <div className="tp-field">
                <label className="tp-field__label">ФИО *</label>
                <input
                  className={`tp-field__input${errors.name ? ' tp-field__input--err' : ''}`}
                  type="text" placeholder="Бекматов Асан"
                  value={form.name} onChange={set('name')}
                  autoComplete="name"
                />
                {errors.name && <span className="tp-field__err">{errors.name}</span>}
              </div>

              <div className="tp-field">
                <label className="tp-field__label">Телефон *</label>
                <input
                  className={`tp-field__input${errors.phone ? ' tp-field__input--err' : ''}`}
                  type="tel" placeholder="+996 555 123 456"
                  value={form.phone} onChange={set('phone')}
                  autoComplete="tel"
                />
                {errors.phone && <span className="tp-field__err">{errors.phone}</span>}
              </div>

              <div className="tp-field">
                <label className="tp-field__label">Вид спорта *</label>
                <select
                  className={`tp-field__input${errors.sport ? ' tp-field__input--err' : ''}`}
                  value={form.sport} onChange={setSport}
                >
                  <option value="">— Выберите секцию —</option>
                  {sports.map(s => (
                    <option key={s.id} value={s.name}>{s.emoji} {s.name}</option>
                  ))}
                </select>
                {errors.sport && <span className="tp-field__err">{errors.sport}</span>}
              </div>

              <div className="tp-field">
                <label className="tp-field__label">Тренер (необязательно)</label>
                <select
                  className="tp-field__input"
                  value={form.trainer}
                  onChange={set('trainer')}
                  disabled={!form.sport}
                >
                  <option value="">
                    {!form.sport ? '— Сначала выберите секцию —' : 'Любой тренер'}
                  </option>
                  {sportTrainers.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="tp-field">
                <label className="tp-field__label">Удобное время занятий</label>
                <select
                  className="tp-field__input"
                  value={form.preferredTime}
                  onChange={set('preferredTime')}
                  disabled={!form.sport}
                >
                  <option value="">
                    {!form.sport
                      ? '— Сначала выберите секцию —'
                      : !scheduleSlots.length
                        ? '— Расписание не указано —'
                        : '— Выберите удобное время —'}
                  </option>
                  {scheduleSlots.map((slot, i) => (
                    <option key={i} value={`${slot.group} — ${slot.days} ${slot.time}`}>
                      {slot.group} — {slot.days} {slot.time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tp-field">
                <label className="tp-field__label">Комментарий</label>
                <textarea
                  className="tp-field__input tp-field__ta"
                  placeholder="Уровень подготовки, пожелания, вопросы..."
                  value={form.comment} onChange={set('comment')}
                />
              </div>

              {errors._submit && (
                <p className="tp-field__err tp-field__err--center">{errors._submit}</p>
              )}

              <button
                type="submit"
                className="tp-btn tp-btn--red tp-btn--full tp-btn--lg"
                disabled={sending}
              >
                {sending ? 'Отправляем…' : 'Отправить заявку'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TaplinkPage = () => {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('tp-theme') === 'dark'; } catch { return false; }
  });
  // Sync initial load (localStorage / session) — no flicker
  const [pageData, setPageData] = useState(() => loadTaplinkData());
  const { hero, stats, sports, trainers, prices, offer, footer } = pageData;

  const [activeSport,   setActiveSport]   = useState(null);
  const [activeTrainer, setActiveTrainer] = useState(null);
  const [booking,       setBooking]       = useState(null);

  // Async load from API when backend is ready (skipped if editor session data is present)
  useEffect(() => {
    if (!BACKEND_ENABLED || hasSessionData()) return;
    loadTaplinkDataAsync()
      .then(d => { if (d) setPageData(d); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#15192A' : '#F0F2FA';
    document.body.style.margin = '0';
  }, [dark]);

  const toggleTheme = () => {
    setDark(d => {
      const next = !d;
      try { localStorage.setItem('tp-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  const openBooking = (init = {}) => setBooking(init);

  const pageClass = `tp-page ${dark ? 'tp-page--dark' : 'tp-page--light'}`;

  return (
    <div className={pageClass}>

      {/* ── Header ───────────────────────────────── */}
      <header className="tp-header">
        <img
          src="/rahman.png"
          alt="Рахман Ата"
          className={`tp-header__logo${!dark ? ' tp-header__logo--day' : ''}`}
        />
        <div className="tp-header__right">
          <button className="tp-theme-btn" onClick={toggleTheme} aria-label="Сменить тему">
            {dark ? '☀️' : '🌙'}
          </button>
          <button className="tp-btn tp-btn--red tp-btn--sm" onClick={() => openBooking()}>
            Записаться
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────── */}
      <section
        className={`tp-hero${hero.bg ? ' tp-hero--has-bg' : ''}`}
        style={hero.bg ? { backgroundImage: `url(${hero.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {hero.bg && <div className="tp-hero__bg-overlay" aria-hidden="true" />}
        <div className="tp-hero__glow"  aria-hidden="true" />
        <div className="tp-hero__glow2" aria-hidden="true" />
        <div className="tp-hero__body">
          <h1 className="tp-hero__title">
            {hero.title}
            <span className="tp-hero__sub-title">{hero.subtitle}</span>
          </h1>
          <p className="tp-hero__desc">{hero.desc}</p>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────── */}
      <div className="tp-stats">
        {stats.map(s => (
          <div key={s.l} className="tp-stat">
            <span className="tp-stat__n">{s.n}</span>
            <span className="tp-stat__l">{s.l}</span>
          </div>
        ))}
      </div>

      {/* ── Offer banner ─────────────────────────── */}
      {offer && offer.enabled && (
        <div className="tp-offer" onClick={() => openBooking()}>
          <span className="tp-offer__label">{offer.label}</span>
          <p className="tp-offer__title">{offer.title}</p>
          <p className="tp-offer__desc">{offer.desc}</p>
          <span className="tp-offer__btn">{offer.btn} →</span>
        </div>
      )}

      {/* ── Sports ───────────────────────────────── */}
      <section className="tp-section" id="tp-sports">
        <div className="tp-section__hd">
          <h2 className="tp-section__title">Наши секции</h2>
          <p className="tp-section__hint">Нажмите на карточку — подробности и видео</p>
        </div>
        <div className="tp-sports-grid">
          {sports.map(s => (
            <button key={s.id} className="tp-sport-card" onClick={() => setActiveSport(s)}>
              {/* Фон — градиент или фото */}
              <div
                className="tp-sport-card__bg"
                style={s.photo ? {} : { background: s.gradient }}
              >
                {s.photo && <img src={s.photo} alt={s.name} className="tp-sport-card__photo-img" />}
              </div>

              {/* Нижний overlay с названием */}
              <div className="tp-sport-card__overlay">
                <span className="tp-sport-card__name">{s.name}</span>
                <span className="tp-sport-card__arr" aria-hidden><ArrowRight size={14} /></span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Trainers ─────────────────────────────── */}
      <section className="tp-section tp-section--alt" id="tp-trainers">
        <div className="tp-section__hd">
          <h2 className="tp-section__title">Наши тренеры</h2>
          <p className="tp-section__hint">Листайте влево и вправо</p>
        </div>
        <TrainersSlider
          trainers={trainers}
          onDetails={setActiveTrainer}
          onBook={t => openBooking({ sport: t.sportName, trainer: t.name })}
        />
      </section>

      {/* ── Prices ───────────────────────────────── */}
      {prices && prices.length > 0 && (
        <section className="tp-section tp-section--alt">
          <div className="tp-section__hd">
            <h2 className="tp-section__title">Цены</h2>
          </div>
          <div className="tp-prices">
            {prices.map((p, i) => (
              <div key={p.id || i} className={`tp-price${p.hot ? ' tp-price--hot' : ''}`}>
                {p.hot && <span className="tp-price__badge">Популярное</span>}
                <span className="tp-price__name">{p.name}</span>
                <span className="tp-price__amount">{p.price}</span>
                {p.desc && <span className="tp-price__desc">{p.desc}</span>}
                <button className="tp-btn tp-btn--red tp-btn--full" onClick={() => openBooking()}>
                  Записаться
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────── */}
      <footer className="tp-footer">
        {/* Social row */}
        {(footer.instagram || footer.tiktok) && (
          <div className="tp-footer__socials">
            {footer.instagram && (
              <a
                href={`https://instagram.com/${footer.instagram.replace('@','')}`}
                className="tp-social-btn tp-social-btn--ig"
                target="_blank" rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <InstagramIcon />
                <span>Instagram</span>
              </a>
            )}
            {footer.tiktok && (
              <a
                href={`https://tiktok.com/@${footer.tiktok.replace('@','')}`}
                className="tp-social-btn tp-social-btn--tt"
                target="_blank" rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <TikTokIcon />
                <span>TikTok</span>
              </a>
            )}
          </div>
        )}

        <div className="tp-footer__contacts">
          <a href={`tel:${footer.phone.replace(/\s|\(|\)/g, '')}`} className="tp-footer__link">📞 {footer.phone}</a>
          {footer.email && <a href={`mailto:${footer.email}`} className="tp-footer__link">✉️ {footer.email}</a>}
          <span className="tp-footer__link">📍 {footer.address}</span>
        </div>

        <p className="tp-footer__copy">{footer.copy}</p>
      </footer>

      {/* ── WhatsApp / Telegram / 2GIS sticky bar ────────── */}
      {(footer.whatsapp || footer.telegram || footer.mapUrl) && (
        <div className="tp-cta-bar">
          {/* Первая строка: WA + TG */}
          {(footer.whatsapp || footer.telegram) && (
            <div className="tp-cta-bar__row">
              {footer.whatsapp && (
                <a
                  href={`https://wa.me/${footer.whatsapp.replace(/\D/g, '')}`}
                  className="tp-cta-bar__btn tp-cta-bar__btn--wa"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon />
                  <span>WhatsApp</span>
                </a>
              )}
              {footer.telegram && (
                <a
                  href={`https://t.me/${footer.telegram.replace('@', '')}`}
                  className="tp-cta-bar__btn tp-cta-bar__btn--tg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TelegramIcon />
                  <span>Telegram</span>
                </a>
              )}
            </div>
          )}
          {/* Вторая строка: 2GIS */}
          {footer.mapUrl && (
            <a
              href={footer.mapUrl}
              className="tp-cta-bar__btn tp-cta-bar__btn--gis"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPinIcon />
              <span>Открыть в 2GIS</span>
            </a>
          )}
        </div>
      )}

      {/* ── Sheets & Modals ──────────────────────── */}
      {activeSport && (
        <SportSheet
          sport={activeSport}
          onClose={() => setActiveSport(null)}
          onBook={init => { setActiveSport(null); openBooking(init); }}
        />
      )}
      {activeTrainer && (
        <TrainerSheet
          trainer={activeTrainer}
          sports={sports}
          onClose={() => setActiveTrainer(null)}
          onBook={init => { setActiveTrainer(null); openBooking(init); }}
        />
      )}
      {booking !== null && (
        <BookingModal
          dark={dark}
          onClose={() => setBooking(null)}
          initial={booking}
          sports={sports}
          trainers={trainers}
        />
      )}
    </div>
  );
};

export default TaplinkPage;
