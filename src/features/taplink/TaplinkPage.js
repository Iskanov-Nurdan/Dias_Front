import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './TaplinkPage.scss';
import { loadTaplinkData, loadTaplinkDataAsync, hasSessionData } from './taplinkStore';
import { BACKEND_ENABLED, submitBooking, fetchPublicTrainerSchedule } from './api';
import { scheduleFromApiResponse, groupScheduleRows, WEEKDAYS } from '../sports-trainers/scheduleConstants';
import Select from '../../shared/ui/Select';

/**
 * Название клуба латиницей.
 *
 * Не берётся из редактируемого конфига намеренно: это транслитерация имени
 * бренда, а не редактируемый контент. Нужна, чтобы сайт находился по запросу
 * «rahman ata» — раньше латиницы не было ни в заголовке, ни в видимом тексте,
 * и по латинскому написанию поиск сайт не показывал.
 */
const LATIN_NAME = 'Rahman Ata';
const LATIN_TAGLINE = 'Rahman Ata Sport Club';

/**
 * Живой график набора тренеров (CRM) — общая логика для формы записи и карточек секции/тренера.
 * Возрастная категория приходит прямо из графика тренера (задаётся в CRM «Настройка графика»),
 * а не отдельной картой на стороне Taplink — один источник истины, разъехаться не может.
 */
function useLiveScheduleRows(trainerRefs) {
  const key = (trainerRefs || []).map(t => t.crmTrainerId).filter(Boolean).join(',');
  const [state, setState] = useState({ loading: false, rows: [] });

  useEffect(() => {
    if (!key) { setState({ loading: false, rows: [] }); return undefined; }
    const ids = key.split(',');
    const byId = new Map((trainerRefs || []).map(t => [String(t.crmTrainerId), t.name]));
    let cancelled = false;
    setState(s => ({ loading: true, rows: s.rows }));
    Promise.all(ids.map(id => fetchPublicTrainerSchedule(id, null).then(d => ({ id, d })).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        const rows = [];
        for (const r of results) {
          if (!r) continue;
          const scheduleRows = scheduleFromApiResponse(r.d || {});
          for (const g of groupScheduleRows(scheduleRows)) {
            const dayObjs = g.weekdays.map(wd => WEEKDAYS.find(w => w.weekday === wd) ?? { weekday: wd, short: String(wd) });
            for (const int of g.intervals) {
              rows.push({
                trainerId: r.id,
                trainerName: byId.get(String(r.id)) || '',
                days: dayObjs,
                start: int.start,
                end: int.end,
                weekday: g.weekdays[0],
                ageGroup: int.ageGroup || '',
              });
            }
          }
        }
        rows.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
        setState({ loading: false, rows });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key уже отражает состав trainerRefs
  }, [key]);

  return state;
}

/** Бейджи дней — общий рендер для живых слотов CRM (weekday-объекты) и ручного расписания (строки "Пн"). */
const DayChips = ({ days }) => (
  <>
    {(days || []).map((d, i) => (
      <span key={typeof d === 'object' ? d.weekday : `${d}-${i}`} className="tp-slot-day-chip">
        {typeof d === 'object' ? d.short : d}
      </span>
    ))}
  </>
);

/** Дни группы (общие для нескольких строк времени ниже) — бейджи в стиле taplink-чипов. */
const TpSlotDaysHeader = ({ days, group }) => (
  <span className="tp-slot-days-header">
    {group && <span className="tp-slot-group-chip">{group}</span>}
    <DayChips days={days} />
  </span>
);

/** Один слот: (группа +) дни + время — когда у набора дней всего один интервал.
 * `end` необязателен — ручное расписание хранит время одной строкой ("18:00–20:00"), а не парой start/end. */
const TpSlotOption = ({ days, group, start, end }) => (
  <span className="tp-slot-option">
    {group && <span className="tp-slot-group-chip">{group}</span>}
    <span className="tp-slot-days">
      <DayChips days={days} />
    </span>
    <span className="tp-slot-time">{end ? `${start}–${end}` : start}</span>
  </span>
);

/** Время внутри группы дней — без повтора бейджа дня. */
const TpSlotTimeRow = ({ start, end, group }) => (
  <span className="tp-slot-time-row">
    {group && <span className="tp-slot-group-chip tp-slot-group-chip--inline">{group}</span>}
    {end ? `${start}–${end}` : start}
  </span>
);


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

const ChevDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
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

/** Компактный значок Instagram — для тесных мест (шапка карточки-слайдера). */
const InstagramBadge = ({ username, size = 'sm' }) => {
  if (!username) return null;
  return (
    <a
      href={`https://instagram.com/${username.replace('@', '')}`}
      className={`tp-ig-badge tp-ig-badge--${size}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Instagram: @${username.replace('@', '')}`}
      title={`@${username.replace('@', '')}`}
      onClick={(e) => e.stopPropagation()}
    >
      <InstagramIcon />
    </a>
  );
};

/** Подписанная кнопка Instagram — для детальной карточки, где важно, что это кликабельная ссылка. */
const InstagramLink = ({ username }) => {
  if (!username) return null;
  const handle = username.replace('@', '');
  return (
    <a
      href={`https://instagram.com/${handle}`}
      className="tp-ig-link"
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      <InstagramIcon />
      <span>@{handle}</span>
    </a>
  );
};

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

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const PhoneFieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const DumbbellIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/><path d="M2 8.5v7M22 8.5v7M4.5 6v12M19.5 6v12"/>
  </svg>
);

const WhistleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="15" r="6"/><path d="M14.5 10.5 21 4M21 4h-4M21 4v4"/><path d="M9 12v3l2 1.5"/>
  </svg>
);

const ClockFieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>
  </svg>
);

const MessageIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>
  </svg>
);

// ─── Small components ─────────────────────────────────────────────────────────

// Direct video files (even hosted on our own https CDN) must render via <video>,
// not <iframe> — only true embeddable player pages (YouTube/TikTok/etc.) need an iframe.
const VIDEO_FILE_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const isEmbedUrl = src => /^https?:\/\//i.test(src) && !VIDEO_FILE_RE.test(src);

const VideoSlot = ({ src, onOpen }) => {
  const [ratio, setRatio] = useState(9 / 16);
  const [visible, setVisible] = useState(false);
  const elRef = useRef(null);

  // Не грузим все видео сразу при открытии карточки — только те, что реально видны
  useEffect(() => {
    if (!elRef.current || visible) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '200px' });
    obs.observe(elRef.current);
    return () => obs.disconnect();
  }, [visible]);

  if (!src) return null;
  const isEmbed = isEmbedUrl(src);

  return (
    <button
      ref={elRef}
      type="button"
      className="tp-video"
      style={{ aspectRatio: ratio }}
      onClick={() => onOpen(src)}
      aria-label="Открыть видео"
    >
      {visible && (
        isEmbed
          ? <iframe src={src} className="tp-video__frame" title="видео" tabIndex={-1} />
          : (
            <video
              src={src}
              className="tp-video__player"
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={e => {
                const v = e.currentTarget;
                v.currentTime = 0.05;
                if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
              }}
            />
          )
      )}
      <span className="tp-video__play"><PlayIcon /></span>
    </button>
  );
};

const VideoLightbox = ({ src, onClose }) => {
  if (!src) return null;
  const isEmbed = isEmbedUrl(src);

  return (
    <div className="tp-video-lb" onClick={e => { e.stopPropagation(); onClose(); }}>
      <button type="button" className="tp-video-lb__x" onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Закрыть"><XIcon /></button>
      <div className="tp-video-lb__inner" onClick={e => e.stopPropagation()}>
        {isEmbed
          ? <iframe src={src} className="tp-video-lb__frame" allowFullScreen title="видео" />
          : <video src={src} className="tp-video-lb__player" controls autoPlay playsInline />
        }
      </div>
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
    // Таймер пересоздаётся при каждом ручном переключении (next/prev меняются вместе с idx),
    // так что свайп или клик по точке уже сами по себе сбрасывают отсчёт.
    const timer = setInterval(next, 5000);
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

        {/* Шапка: секция + (инстаграм) + счётчик */}
        <div className="tp-tc__header">
          <span className="tp-tc__sport">{t.sportName}</span>
          <div className="tp-tc__header-right">
            <InstagramBadge username={t.instagram} />
            <span className="tp-tc__counter">{idx + 1} / {trainers.length}</span>
          </div>
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
            <span className="tp-tc__stat-lbl">стажа</span>
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

// ─── Collapsible lists (schedule, achievements) ────────────────────────────────

const PREVIEW_COUNT = 3;

const ExpandToggle = ({ expanded, onClick, moreLabel }) => (
  <button
    type="button"
    className={`tp-expand-toggle${expanded ? ' tp-expand-toggle--on' : ''}`}
    onClick={onClick}
  >
    {expanded ? 'Свернуть' : moreLabel}
    <ChevDown />
  </button>
);

// Группирует строки расписания сперва по «блоку» (тренер / вид спорта),
// затем внутри блока — по названию группы (Взрослые / Дети), чтобы не повторять
// одни и те же подписи на каждую отдельную пару дни+время.
const buildScheduleBlocks = (rows, blockKeyFor, blockLabelFor) => {
  const blocks = [];
  const blockByKey = new Map();

  rows.forEach((row, i) => {
    const key = blockKeyFor(row) || '';
    let block = blockByKey.get(key);
    if (!block) {
      block = { key, label: blockLabelFor(row), groups: [], groupByName: new Map() };
      blockByKey.set(key, block);
      blocks.push(block);
    }
    const gName = row.group || '';
    let group = block.groupByName.get(gName);
    if (!group) {
      group = { name: row.group, entries: [] };
      block.groupByName.set(gName, group);
      block.groups.push(group);
    }
    group.entries.push({ id: row.id ?? i, days: row.days, time: row.time });
  });

  return blocks;
};

const ScheduleList = ({ rows, blockKeyFor, blockLabelFor }) => {
  const [expanded, setExpanded] = useState(false);
  const blocks = buildScheduleBlocks(rows, blockKeyFor, blockLabelFor);
  const hasMore = blocks.length > PREVIEW_COUNT;
  const visible = expanded ? blocks : blocks.slice(0, PREVIEW_COUNT);

  return (
    <>
      <div className="tp-sched-blocks">
        {visible.map((block, bi) => (
          <div key={block.key || bi} className="tp-sched-block">
            {block.label && <div className="tp-sched-block__head">{block.label}</div>}
            {block.groups.map((group, gi) => (
              <div key={group.name || gi} className="tp-sched-group">
                {group.name && <div className="tp-sched-group__name">{group.name}</div>}
                {group.entries.map((entry, ei) => (
                  <div key={entry.id ?? ei} className="tp-sched-group__row">
                    <span className="tp-sched-group__days">{entry.days}</span>
                    <span className="tp-sched-group__time">{entry.time}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      {hasMore && (
        <ExpandToggle
          expanded={expanded}
          onClick={() => setExpanded(e => !e)}
          moreLabel={`Показать всё расписание (${rows.length})`}
        />
      )}
    </>
  );
};

const AchievementsList = ({ items }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > PREVIEW_COUNT;
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <>
      {visible.map((a, i) => (
        <div key={i} className="tp-sheet__achieve">
          <span className="tp-sheet__achieve-ic">🏆</span>
          <span>{a}</span>
        </div>
      ))}
      {hasMore && (
        <ExpandToggle
          expanded={expanded}
          onClick={() => setExpanded(e => !e)}
          moreLabel={`Показать все достижения (${items.length})`}
        />
      )}
    </>
  );
};

// ─── Sport Sheet (bottom) ─────────────────────────────────────────────────────

const SportSheet = ({ sport, trainers = [], onClose, onBook }) => {
  const [openVideo, setOpenVideo] = useState(null);
  const sportTrainers = trainers.filter(t => t.sportName === sport.name);
  const { rows: liveRows } = useLiveScheduleRows(sportTrainers);
  const scheduleRows = liveRows.map((r, i) => ({
    id: i,
    group: r.ageGroup,
    days: r.days.map(d => d.short).join(', '),
    time: `${r.start}–${r.end}`,
    trainers: [r.trainerName],
  }));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-sheet__bar" />
        <button className="tp-sheet__x" onClick={onClose}><XIcon /></button>

        <h2 className="tp-sheet__title">{sport.name}</h2>
        <p className="tp-sheet__text">{sport.desc}</p>

        {scheduleRows.length > 0 && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Расписание</h4>
            <ScheduleList
              rows={scheduleRows}
              blockKeyFor={row => row.trainers.join(', ')}
              blockLabelFor={row => row.trainers.join(', ') || null}
            />
          </div>
        )}

        {sport.videos && sport.videos.some(Boolean) && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Видео о секции</h4>
            <div className="tp-sheet__videos">
              {sport.videos.map((v, i) => <VideoSlot key={i} src={v} onOpen={setOpenVideo} />)}
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
      <VideoLightbox src={openVideo} onClose={() => setOpenVideo(null)} />
    </div>
  );
};

// ─── Trainer Sheet (bottom) ───────────────────────────────────────────────────

const TrainerSheet = ({ trainer, onClose, onBook }) => {
  const [openVideo, setOpenVideo] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const { rows: liveRows } = useLiveScheduleRows([trainer]);
  const trainerSchedule = liveRows.map((r, i) => ({
    id: i,
    group: r.ageGroup,
    days: r.days.map(d => d.short).join(', '),
    time: `${r.start}–${r.end}`,
    sportName: trainer.sportName,
  }));

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
          <span className="tp-chip">{trainer.experience} стажа</span>
        </div>

        <InstagramLink username={trainer.instagram} />

        <p className="tp-sheet__text">{trainer.bio}</p>

        <div className="tp-sheet__section">
          <h4 className="tp-sheet__sub">Достижения</h4>
          <AchievementsList items={trainer.achievements} />
        </div>

        {trainerSchedule.length > 0 && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Расписание</h4>
            <ScheduleList
              rows={trainerSchedule}
              blockKeyFor={row => row.sportName || ''}
              blockLabelFor={row => (
                trainerSchedule.some(r => r.sportName !== trainerSchedule[0].sportName) ? row.sportName : null
              )}
            />
          </div>
        )}

        {trainer.videos.some(Boolean) && (
          <div className="tp-sheet__section">
            <h4 className="tp-sheet__sub">Видео тренировок</h4>
            <div className="tp-sheet__videos">
              {trainer.videos.map((v, i) => <VideoSlot key={i} src={v} onOpen={setOpenVideo} />)}
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
      <VideoLightbox src={openVideo} onClose={() => setOpenVideo(null)} />
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

  // Для Select-компонента (приходит value напрямую, не event)
  const setSelectField = f => v => {
    setForm(p => ({ ...p, [f]: v }));
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

  const setSportSelect = v => {
    setForm(p => ({
      ...p,
      sport: v,
      trainer:       trainers.find(t => t.name === p.trainer && t.sportName === v) ? p.trainer : '',
      preferredTime: '',
    }));
    setErrors(p => ({ ...p, sport: '' }));
  };

  // Only show trainers for the selected sport
  const sportTrainers = form.sport
    ? trainers.filter(t => t.sportName === form.sport)
    : [];

  // Тренер(ы), чей РЕАЛЬНЫЙ график из CRM нужно показать: конкретный выбранный тренер,
  // либо (если тренер не выбран — «любой тренер») все тренеры этой секции.
  const scheduleTrainerRefs = form.trainer
    ? sportTrainers.filter(t => t.name === form.trainer)
    : sportTrainers;
  const { loading: liveLoading, rows: liveRows } = useLiveScheduleRows(scheduleTrainerRefs);

  const preferredTimeOptions = useMemo(() => {
    const byDaysKey = new Map();
    for (const row of liveRows) {
      const daysKey = row.days.map(d => d.weekday).join(',');
      if (!byDaysKey.has(daysKey)) byDaysKey.set(daysKey, { days: row.days, items: [] });
      byDaysKey.get(daysKey).items.push(row);
    }
    const out = [];
    for (const g of byDaysKey.values()) {
      const grouped = g.items.length > 1;
      if (grouped) {
        out.push({ header: true, key: `h-${g.days.map(d => d.weekday).join(',')}`, render: <TpSlotDaysHeader days={g.days} /> });
      }
      for (const row of g.items) {
        const daysLabel = g.days.map(d => d.short).join(', ');
        const label = [row.ageGroup, `${daysLabel} ${row.start}–${row.end}`].filter(Boolean).join(' — ');
        out.push({
          value: label,
          label,
          render: grouped
            ? <TpSlotTimeRow start={row.start} end={row.end} group={row.ageGroup} />
            : <TpSlotOption days={g.days} start={row.start} end={row.end} group={row.ageGroup} />,
          triggerRender: <TpSlotOption days={g.days} start={row.start} end={row.end} group={row.ageGroup} />,
        });
      }
    }
    return out;
  }, [liveRows]);

  const submit = async e => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Введите ФИО';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 12) errs.phone = 'Введите корректный номер телефона';
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
            <div className="tp-modal-done__ic"><CheckCircleIcon /></div>
            <h2 className="tp-modal-done__title">Заявка принята!</h2>
            <p className="tp-modal-done__text">
              Мы свяжемся с вами в течение часа для подтверждения записи.
            </p>
            <button className="tp-btn tp-btn--red tp-btn--full tp-btn--lg" onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <>
            <div className="tp-fs-modal__hero">
              <p className="tp-fs-modal__sub">Оставьте заявку — мы перезвоним вам</p>
            </div>

            <form className="tp-form" onSubmit={submit} noValidate>

              <div className="tp-form__section">
                <div className="tp-form__section-head">
                  <UserIcon />
                  <span>Контактные данные</span>
                </div>

                <div className="tp-field">
                  <label className="tp-field__label">ФИО *</label>
                  <div className="tp-field__control">
                    <span className="tp-field__ic"><UserIcon /></span>
                    <input
                      className={`tp-field__input tp-field__input--ic${errors.name ? ' tp-field__input--err' : ''}`}
                      type="text" placeholder="Бекматов Асан"
                      value={form.name} onChange={set('name')}
                      autoComplete="name"
                    />
                  </div>
                  {errors.name && <span className="tp-field__err"><AlertIcon />{errors.name}</span>}
                </div>

                <div className="tp-field">
                  <label className="tp-field__label">Телефон *</label>
                  <div className="tp-field__control">
                    <span className="tp-field__ic"><PhoneFieldIcon /></span>
                    <input
                      className={`tp-field__input tp-field__input--ic${errors.phone ? ' tp-field__input--err' : ''}`}
                      type="tel" placeholder="+996 555 123 456"
                      value={form.phone} onChange={set('phone')}
                      autoComplete="tel"
                    />
                  </div>
                  {errors.phone && <span className="tp-field__err"><AlertIcon />{errors.phone}</span>}
                </div>
              </div>

              <div className="tp-form__section">
                <div className="tp-form__section-head">
                  <WhistleIcon />
                  <span>Детали тренировки</span>
                </div>

                <div className={`tp-field${errors.sport ? ' tp-field--err' : ''}`}>
                  <label className="tp-field__label"><DumbbellIcon /> Вид спорта *</label>
                  <Select
                    value={form.sport}
                    onChange={setSportSelect}
                    placeholder="— Выберите секцию —"
                    options={sports.map(s => ({ value: s.name, label: s.name }))}
                  />
                  {errors.sport && <span className="tp-field__err"><AlertIcon />{errors.sport}</span>}
                </div>

                <div className="tp-field">
                  <label className="tp-field__label"><WhistleIcon /> Тренер <em>(необязательно)</em></label>
                  <Select
                    value={form.trainer}
                    onChange={setSelectField('trainer')}
                    disabled={!form.sport}
                    placeholder={!form.sport ? '— Сначала выберите секцию —' : 'Любой тренер'}
                    options={sportTrainers.map(t => ({ value: t.name, label: t.name }))}
                  />
                </div>

                <div className="tp-field">
                  <label className="tp-field__label"><ClockFieldIcon /> Удобное время занятий</label>
                  <Select
                    value={form.preferredTime}
                    onChange={setSelectField('preferredTime')}
                    disabled={!form.sport || liveLoading}
                    placeholder={
                      !form.sport ? '— Сначала выберите секцию —'
                      : liveLoading ? 'Загрузка графика…'
                      : !preferredTimeOptions.length ? '— Расписание не указано —'
                      : '— Выберите время —'
                    }
                    options={preferredTimeOptions}
                  />
                </div>
              </div>

              <div className="tp-form__section">
                <div className="tp-field">
                  <label className="tp-field__label"><MessageIcon /> Комментарий <em>(необязательно)</em></label>
                  <textarea
                    className="tp-field__input tp-field__ta"
                    placeholder="Уровень подготовки, пожелания, вопросы..."
                    value={form.comment} onChange={set('comment')}
                  />
                </div>
              </div>

              {errors._submit && (
                <p className="tp-field__err tp-field__err--center"><AlertIcon />{errors._submit}</p>
              )}

              <button
                type="submit"
                className="tp-btn tp-btn--red tp-btn--full tp-btn--lg"
                disabled={sending}
              >
                {sending ? 'Отправляем…' : 'Отправить заявку'}
                {sending ? <span className="tp-btn__spinner" /> : <ArrowRight />}
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
    try {
      const saved = localStorage.getItem('tp-theme');
      return saved === null ? true : saved === 'dark';
    } catch { return true; }
  });
  // Sync initial load (localStorage / session) — no flicker
  const [pageData, setPageData] = useState(() => loadTaplinkData());
  const { hero, stats, prices, offer, footer } = pageData;
  // Скрытые в редакторе (published: false) секции/тренеры на публичной странице не показываются.
  const sports = (pageData.sports || []).filter(s => s.published !== false);
  const trainers = (pageData.trainers || []).filter(t => t.published !== false);

  /**
   * Вкладка браузера и meta description — вслед за тем, что реально редактируют
   * в Taplink-редакторе (hero.title/desc), а не статичным текстом из index.html.
   * index.html остаётся верным для ботов, которые не выполняют JS (превью
   * в мессенджерах) и для самого первого кадра до гидратации; здесь же —
   * уточнение для тех, кто JS выполняет (Google, сам браузер), и восстановление
   * прежнего заголовка при уходе в CRM, чтобы вкладка не осталась "залипшей".
   *
   * Латинское написание названия добавлено намеренно: Google берёт заголовок
   * именно отсюда (он выполняет JS), и раньше в нём не было ни одного
   * латинского символа — поэтому по запросу «rahman ata» сайт не находился,
   * хотя по «рахман ата» находился.
   */
  useEffect(() => {
    const prevTitle = document.title;
    const descTag = document.querySelector('meta[name="description"]');
    const prevDesc = descTag?.getAttribute('content') ?? null;

    const city = (footer?.address || '').replace(/^г\.\s*/i, '').trim();
    const subtitle = hero?.subtitle || 'спортивный клуб';
    const place = city ? `, ${city}` : '';

    if (hero?.title) {
      document.title = `${hero.title} — ${subtitle} | ${LATIN_NAME}${place}`;
      if (descTag && hero.desc) {
        descTag.setAttribute(
          'content',
          `${hero.title} (${LATIN_NAME}) — ${subtitle}${place}. ${hero.desc}`,
        );
      }
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDesc != null) descTag.setAttribute('content', prevDesc);
    };
  }, [hero?.title, hero?.subtitle, hero?.desc, footer?.address]);

  /**
   * Микроразметка организации: контакты дописываются в тот же блок ld+json из
   * index.html, а не дублируются в нём руками. Телефон, адрес и соцсети
   * редактируются в админке, и вторая их копия в статическом HTML рано или
   * поздно разошлась бы с настоящей. Google выполняет JS, так что дописанное
   * здесь он видит.
   */
  useEffect(() => {
    const tag = document.querySelector('script[type="application/ld+json"]');
    if (!tag) return undefined;
    const prev = tag.textContent;

    try {
      const base = JSON.parse(prev);
      const social = [
        footer?.instagram && `https://instagram.com/${String(footer.instagram).replace(/^@/, '')}`,
        footer?.tiktok && `https://tiktok.com/@${String(footer.tiktok).replace(/^@/, '')}`,
      ].filter(Boolean);

      const enriched = { ...base };
      if (footer?.phone) enriched.telephone = footer.phone;
      if (footer?.address) {
        enriched.address = {
          '@type': 'PostalAddress',
          addressLocality: footer.address.replace(/^г\.\s*/i, '').trim(),
          addressCountry: 'KG',
        };
      }
      if (social.length) enriched.sameAs = social;
      if (footer?.mapUrl) enriched.hasMap = footer.mapUrl;

      tag.textContent = JSON.stringify(enriched, null, 2);
    } catch {
      // Разметку не удалось разобрать — оставляем статическую как есть,
      // это не повод ронять страницу
    }

    return () => { tag.textContent = prev; };
  }, [footer?.phone, footer?.address, footer?.instagram, footer?.tiktok, footer?.mapUrl]);

  const [activeSport,   setActiveSport]   = useState(null);
  const [activeTrainer, setActiveTrainer] = useState(null);
  const [booking,       setBooking]       = useState(null);

  // Только на самом первом визите (нет ни сессии, ни закешированных данных) есть шанс
  // на секунду увидеть дефолтный контент вместо реального — в этом случае показываем лоадер.
  const [initialLoading, setInitialLoading] = useState(() => {
    if (!BACKEND_ENABLED || hasSessionData()) return false;
    try { return !localStorage.getItem('taplink-data'); } catch { return false; }
  });

  // Async load from API when backend is ready (skipped if editor session data is present)
  useEffect(() => {
    if (!BACKEND_ENABLED || hasSessionData()) return;
    loadTaplinkDataAsync()
      .then(d => { if (d) setPageData(d); })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#17161A' : '#F0F2FA';
    document.body.style.margin = '0';
  }, [dark]);

  // Ставим класс на body чтобы Select-порталы знали о теме страницы
  useEffect(() => {
    const add = dark ? 'tp-body--dark' : 'tp-body--light';
    const rem = dark ? 'tp-body--light' : 'tp-body--dark';
    document.body.classList.add(add);
    document.body.classList.remove(rem);
    return () => document.body.classList.remove('tp-body--dark', 'tp-body--light');
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

  if (initialLoading) {
    return (
      <div className={pageClass}>
        <div className="tp-boot">
          <img src="/rahman.png" alt="Рахман Ата" className="tp-boot__logo" />
          <div className="tp-boot__spinner" />
        </div>
      </div>
    );
  }

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
          {/* Пробел после названия обязателен: без него поисковик склеивает
              текстовые узлы и в выдаче получалось «Рахман АтаСпорт Клуб».
              На вёрстку не влияет — заголовок выложен колонкой через flex. */}
          <h1 className="tp-hero__title">
            {hero.title}{' '}
            <span className="tp-hero__sub-title">{hero.subtitle}</span>
          </h1>
          <p className="tp-hero__desc">{hero.desc}</p>
          {/* Латинское написание названия — видимым текстом, а не скрытым:
              спрятанные ради поиска ключевики Google считает спамом. Это
              единственное место на странице, где бренд написан латиницей,
              и оно же делает сайт находимым по запросу «rahman ata». */}
          <p className="tp-hero__latin">{LATIN_TAGLINE}</p>
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
        </div>
      )}

      {/* ── Sheets & Modals ──────────────────────── */}
      {activeSport && (
        <SportSheet
          sport={activeSport}
          trainers={trainers}
          onClose={() => setActiveSport(null)}
          onBook={init => { setActiveSport(null); openBooking(init); }}
        />
      )}
      {activeTrainer && (
        <TrainerSheet
          trainer={activeTrainer}
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
