import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Eye, Check, AlertTriangle, House, BarChart3, Swords, Users, Wallet, Phone, Plus, X, Camera, ChevronDown, Video, Clock, Lock, Star, MessageCircle, AtSign, MapPin } from 'lucide-react';
import { loadTaplinkData, saveTaplinkDataAsync, loadTaplinkDataAsync, setSessionData } from './taplinkStore';
import { BACKEND_ENABLED, uploadFile } from './api';
import { fetchSports as fetchCrmSports, fetchTrainers as fetchCrmTrainers, fetchTrainerSchedule } from '../sports-trainers/api';
import { WEEKDAYS, scheduleFromApiResponse, groupScheduleRows } from '../sports-trainers/scheduleConstants';
import { Field, PhotoUpload, VideoUpload } from '../../shared/ui';
import './TaplinkEditor.scss';

const TABS = [
  { id: 'hero',     label: 'Главная',    icon: House },
  { id: 'stats',    label: 'Статистика', icon: BarChart3 },
  { id: 'sports',   label: 'Секции',     icon: Swords },
  { id: 'trainers', label: 'Тренеры',    icon: Users },
  { id: 'prices',   label: 'Цены',       icon: Wallet },
  { id: 'footer',   label: 'Контакты',   icon: Phone },
];

/** Первый вид спорта тренера (объект или id) → название, по списку секций CRM. */
const resolveTrainerSportName = (t, crmSports) => {
  const arr = t.sportIds ?? t.sport_ids ?? t.sports ?? [];
  const first = arr[0];
  if (first == null) return '';
  if (typeof first === 'object') return first.name || '';
  const sport = crmSports.find((s) => String(s.id) === String(first));
  return sport?.name || '';
};

// Держим карточку смонтированной ещё ACCORDION_CLOSE_MS после закрытия,
// чтобы max-height/opacity успели доиграть анимацию, а не пропадали рывком.
const ACCORDION_CLOSE_MS = 300;

const useAccordion = () => {
  const [open, setOpen] = useState(null);
  const [closingIdx, setClosingIdx] = useState(null);
  const timerRef = useRef(null);

  const toggle = (i) => {
    clearTimeout(timerRef.current);
    const prevOpen = open;
    if (prevOpen !== null && prevOpen !== i) {
      setClosingIdx(prevOpen);
      timerRef.current = setTimeout(() => setClosingIdx(c => (c === prevOpen ? null : c)), ACCORDION_CLOSE_MS);
    }
    if (open === i) {
      setClosingIdx(i);
      setOpen(null);
      timerRef.current = setTimeout(() => setClosingIdx(c => (c === i ? null : c)), ACCORDION_CLOSE_MS);
    } else {
      setOpen(i);
    }
  };

  const isRendered = (i) => open === i || closingIdx === i;

  return { open, setOpen, toggle, isRendered };
};

// ─── Hero tab ─────────────────────────────────────────────────────────────────

const HeroTab = ({ data, setData }) => {
  const set = (field, val) => setData(d => ({ ...d, hero: { ...d.hero, [field]: val } }));
  return (
    <div className="tpe-section">
      <h2 className="tpe-section__title">Главный экран</h2>

      <Field label="Фоновое фото">
        <PhotoUpload
          value={data.hero.bg}
          onChange={v => set('bg', v)}
          shape="hero"
          placeholder="Загрузить фон главного экрана"
          context="hero-bg"
          backendEnabled={BACKEND_ENABLED}
          uploadFile={uploadFile}
        />
      </Field>

      <div className="tpe-card">
        <Field label="Заголовок (крупный текст)">
          <input className="tpe-input" value={data.hero.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <Field label="Подзаголовок (красный акцент)">
          <input className="tpe-input" value={data.hero.subtitle} onChange={e => set('subtitle', e.target.value)} />
        </Field>
        <Field label="Строка описания">
          <input className="tpe-input" value={data.hero.desc} onChange={e => set('desc', e.target.value)} />
        </Field>
      </div>

      <div className="tpe-preview-box">
        <p className="tpe-preview-box__label">Предпросмотр</p>
        <div
          className="tpe-hero-preview"
          style={data.hero.bg ? { backgroundImage: `url(${data.hero.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          <div className="tpe-hero-preview__title">{data.hero.title}</div>
          <div className="tpe-hero-preview__sub">{data.hero.subtitle}</div>
          <div className="tpe-hero-preview__desc">{data.hero.desc}</div>
        </div>
      </div>

      {/* ── Offer / banner ── */}
      <div className="tpe-card">
        <div className="tpe-offer-hd">
          <span className="tpe-card__subtitle">Акция / специальное предложение</span>
          <label className="tpe-switch">
            <input
              type="checkbox"
              className="tpe-switch__input"
              checked={!!(data.offer && data.offer.enabled)}
              onChange={e => setData(d => ({ ...d, offer: { ...(d.offer || {}), enabled: e.target.checked } }))}
            />
            <span className="tpe-switch__track"><span className="tpe-switch__thumb" /></span>
            <span className="tpe-switch__label">{(data.offer && data.offer.enabled) ? 'Показывать' : 'Скрыто'}</span>
          </label>
        </div>
        {data.offer && data.offer.enabled && (
          <>
            <Field label="Метка (напр. «Акция»)">
              <input className="tpe-input" value={data.offer.label || ''} onChange={e => setData(d => ({ ...d, offer: { ...d.offer, label: e.target.value } }))} />
            </Field>
            <Field label="Заголовок">
              <input className="tpe-input" value={data.offer.title || ''} onChange={e => setData(d => ({ ...d, offer: { ...d.offer, title: e.target.value } }))} />
            </Field>
            <Field label="Описание">
              <input className="tpe-input" value={data.offer.desc || ''} onChange={e => setData(d => ({ ...d, offer: { ...d.offer, desc: e.target.value } }))} />
            </Field>
            <Field label="Текст кнопки">
              <input className="tpe-input" value={data.offer.btn || ''} onChange={e => setData(d => ({ ...d, offer: { ...d.offer, btn: e.target.value } }))} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Stats tab ────────────────────────────────────────────────────────────────

const StatsTab = ({ data, setData }) => {
  const set = (i, field, val) =>
    setData(d => {
      const stats = [...d.stats];
      stats[i] = { ...stats[i], [field]: val };
      return { ...d, stats };
    });

  const addStat = () => setData(d => ({ ...d, stats: [...d.stats, { n: '', l: '' }] }));
  const removeStat = i => setData(d => ({ ...d, stats: d.stats.filter((_, idx) => idx !== i) }));

  return (
    <div className="tpe-section">
      <div className="tpe-section__hd">
        <div>
          <h2 className="tpe-section__title">Статистика</h2>
          <p className="tpe-section__desc">Цифры на главном экране публичной страницы.</p>
        </div>
        <button className="tpe-add-btn" type="button" onClick={addStat}>
          <Plus size={14} strokeWidth={2.5} /> Добавить
        </button>
      </div>
      <div className="tpe-stats-grid">
        {data.stats.map((s, i) => (
          <div key={i} className="tpe-stat-card">
            {data.stats.length > 1 && (
              <button
                type="button"
                className="tpe-stat-card__remove"
                onClick={() => removeStat(i)}
                aria-label="Удалить карточку статистики"
                title="Удалить"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
            <span className="tpe-stat-card__preview-label">Предпросмотр</span>
            <div className="tpe-stat-card__preview">
              <span className="tpe-stat-card__n">{s.n || '—'}</span>
              <span className="tpe-stat-card__l">{s.l || 'подпись'}</span>
            </div>
            <Field label="Число / текст">
              <input className="tpe-input" value={s.n} onChange={e => set(i, 'n', e.target.value)} placeholder="напр. 500+" />
            </Field>
            <Field label="Подпись">
              <input className="tpe-input" value={s.l} onChange={e => set(i, 'l', e.target.value)} placeholder="напр. Учеников" />
            </Field>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Sports tab ───────────────────────────────────────────────────────────────

const SportsTab = ({ data, setData }) => {
  const { open, toggle, isRendered } = useAccordion();
  /** sportName → { loading, rows } — живой график из CRM для развёрнутой секции. */
  const [liveSchedules, setLiveSchedules] = useState({});

  const set = (i, field, val) =>
    setData(d => {
      const sports = [...d.sports];
      sports[i] = { ...sports[i], [field]: val };
      return { ...d, sports };
    });

  const setVideo = (si, vi, val) =>
    setData(d => {
      const sports = [...d.sports];
      const videos = [...(sports[si].videos || ['', '', '', '', ''])];
      videos[vi] = val;
      sports[si] = { ...sports[si], videos };
      return { ...d, sports };
    });

  /** Тренеры этой секции — все они привязаны к CRM автоматически (см. верхний уровень редактора). */
  const trainersFor = (sportName) =>
    (data.trainers || []).filter(t => t.sportName === sportName && t.published !== false);

  /** Как только секция раскрыта — тянем настоящий график её тренеров из CRM. Ничего не сохраняется
   * в data.sports[].schedule — такого поля больше нет, сайт всегда показывает живые данные. */
  useEffect(() => {
    if (open == null) return undefined;
    const sport = data.sports[open];
    if (!sport) return undefined;
    const linked = trainersFor(sport.name);
    if (!linked.length) {
      setLiveSchedules(prev => ({ ...prev, [sport.name]: { loading: false, rows: [] } }));
      return undefined;
    }

    let cancelled = false;
    setLiveSchedules(prev => ({ ...prev, [sport.name]: { loading: true, rows: prev[sport.name]?.rows || [] } }));

    Promise.all(
      linked.map(t =>
        fetchTrainerSchedule(t.crmTrainerId, null)
          .then(schedData => ({ trainerId: t.crmTrainerId, trainerName: t.name, schedData }))
          .catch(() => null)
      )
    ).then(results => {
      if (cancelled) return;
      const rows = [];
      for (const r of results) {
        if (!r) continue;
        const scheduleRows = scheduleFromApiResponse(r.schedData || {});
        for (const g of groupScheduleRows(scheduleRows)) {
          const dayShorts = g.weekdays.map(wd => WEEKDAYS.find(w => w.weekday === wd)?.short ?? String(wd));
          const daysStr = dayShorts.join(', ');
          for (const int of g.intervals) {
            const time = `${int.start}–${int.end}`;
            rows.push({ trainerId: r.trainerId, trainerName: r.trainerName, days: daysStr, time, ageGroup: int.ageGroup || '', weekday: g.weekdays[0] });
          }
        }
      }
      rows.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time) || a.trainerName.localeCompare(b.trainerName));
      setLiveSchedules(prev => ({ ...prev, [sport.name]: { loading: false, rows } }));
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.sports, data.trainers]);

  return (
    <div className="tpe-section">
      <div className="tpe-section__hd">
        <h2 className="tpe-section__title">Секции ({data.sports.length})</h2>
        <span className="tpe-section__crm-note">Список берётся из CRM «Спорт и тренеры» — создать или удалить секцию здесь нельзя</span>
      </div>
      <div className="tpe-list">
        {data.sports.map((sport, i) => (
          <div key={sport.id || i} className={`tpe-item${open === i ? ' tpe-item--open' : ''}`}>
            <button type="button" className="tpe-item__head" onClick={() => toggle(i)} aria-expanded={open === i}>
              <span className="tpe-item__thumb-wrap">
                {sport.photo
                  ? <img src={sport.photo} alt="" className="tpe-item__thumb-img" />
                  : <span className="tpe-item__thumb-empty"><Camera size={16} strokeWidth={1.75} /></span>
                }
              </span>
              <span className="tpe-item__name">{sport.name}</span>
              {sport.published === false && <span className="tpe-item__hidden-badge">Скрыто</span>}
              <ChevronDown size={16} strokeWidth={2} className={`tpe-item__arrow${open === i ? ' tpe-item__arrow--open' : ''}`} />
            </button>

            {isRendered(i) && (
              <div className="tpe-item__body">
                <label className="tpe-switch tpe-switch--block">
                  <input
                    type="checkbox"
                    className="tpe-switch__input"
                    checked={sport.published !== false}
                    onChange={e => set(i, 'published', e.target.checked)}
                  />
                  <span className="tpe-switch__track"><span className="tpe-switch__thumb" /></span>
                  <span className="tpe-switch__label">Показывать секцию на сайте</span>
                </label>

                <Field label="Фото секции (баннер)">
                  <PhotoUpload
                    value={sport.photo}
                    onChange={v => set(i, 'photo', v)}
                    shape="rect"
                    placeholder="Загрузить фото секции"
                    context="sport-photo"
                    backendEnabled={BACKEND_ENABLED}
                    uploadFile={uploadFile}
                  />
                </Field>

                <Field label="Описание">
                  <textarea
                    className="tpe-input tpe-ta"
                    rows={3}
                    value={sport.desc}
                    onChange={e => set(i, 'desc', e.target.value)}
                  />
                </Field>

                {/* ── Schedule: всегда живьём из CRM, ручного ввода больше нет ── */}
                {(() => {
                  const live = liveSchedules[sport.name];
                  return (
                    <div className="tpe-sched-block">
                      <div className="tpe-sched-block__hd">
                        <span className="tpe-sched-block__label"><Clock size={13} strokeWidth={2} /> Расписание</span>
                        <span className="tpe-sched-block__live-badge">
                          <RefreshCw size={11} className={live?.loading ? 'tpe-spin' : ''} />
                          Живьём из CRM
                        </span>
                      </div>
                      <p className="tpe-sched-block__live-note">
                        Дни, время и возрастная категория берутся из настоящего графика тренеров этой секции —
                        задаются в разделе «Спорт и тренеры» → «Настройка графика».
                      </p>
                      {live?.loading && !live.rows.length ? (
                        <p className="tpe-sched-block__empty">Загрузка графика из CRM…</p>
                      ) : !live?.rows.length ? (
                        <p className="tpe-sched-block__empty">У тренеров этой секции пока нет графика в CRM.</p>
                      ) : (
                        live.rows.map((row, ri) => (
                          <div key={ri} className="tpe-sched-entry tpe-sched-entry--readonly">
                            {row.ageGroup && <span className="tpe-sched-readonly__chip">{row.ageGroup}</span>}
                            <span className="tpe-sched-readonly__chip tpe-sched-readonly__chip--days">{row.days}</span>
                            <span className="tpe-sched-readonly__time">{row.time}</span>
                            <span className="tpe-sched-readonly__trainers">{row.trainerName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                <div className="tpe-videos-block">
                  <p className="tpe-videos-block__label"><Video size={13} strokeWidth={2} /> Видео секции</p>
                  <div className="tpe-videos-grid">
                    {[0, 1, 2, 3, 4].map(vi => (
                      <VideoUpload
                        key={vi}
                        num={vi + 1}
                        value={(sport.videos || [])[vi] || ''}
                        onChange={v => setVideo(i, vi, v)}
                        context="sport-video"
                        backendEnabled={BACKEND_ENABLED}
                        uploadFile={uploadFile}
                      />
                    ))}
                  </div>
                  {!BACKEND_ENABLED && (
                    <p className="tpe-videos-block__note">
                      Видео сохраняются только в рамках текущей сессии браузера
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Trainers tab ─────────────────────────────────────────────────────────────

const TrainersTab = ({ data, setData }) => {
  const { open, toggle, isRendered } = useAccordion();

  const set = (i, field, val) =>
    setData(d => {
      const trainers = [...d.trainers];
      trainers[i] = { ...trainers[i], [field]: val };
      return { ...d, trainers };
    });

  const setVideo = (ti, vi, val) =>
    setData(d => {
      const trainers = [...d.trainers];
      const videos = [...(trainers[ti].videos || ['', '', '', '', ''])];
      videos[vi] = val;
      trainers[ti] = { ...trainers[ti], videos };
      return { ...d, trainers };
    });

  const setAchieve = (ti, ai, val) =>
    setData(d => {
      const trainers = [...d.trainers];
      const achievements = [...trainers[ti].achievements];
      achievements[ai] = val;
      trainers[ti] = { ...trainers[ti], achievements };
      return { ...d, trainers };
    });

  const addAchieve = ti =>
    setData(d => {
      const trainers = [...d.trainers];
      trainers[ti] = { ...trainers[ti], achievements: [...trainers[ti].achievements, ''] };
      return { ...d, trainers };
    });

  const removeAchieve = (ti, ai) =>
    setData(d => {
      const trainers = [...d.trainers];
      trainers[ti] = {
        ...trainers[ti],
        achievements: trainers[ti].achievements.filter((_, i) => i !== ai),
      };
      return { ...d, trainers };
    });

  return (
    <div className="tpe-section">
      <div className="tpe-section__hd">
        <h2 className="tpe-section__title">Тренеры ({data.trainers.length})</h2>
        <span className="tpe-section__crm-note">Список берётся из CRM «Спорт и тренеры» — создать или удалить тренера здесь нельзя</span>
      </div>
      <div className="tpe-list">
        {data.trainers.map((t, i) => (
          <div key={t.id || i} className={`tpe-item${open === i ? ' tpe-item--open' : ''}`}>
            <button type="button" className="tpe-item__head" onClick={() => toggle(i)} aria-expanded={open === i}>
              <span className="tpe-item__ava-wrap">
                {t.photo
                  ? <img src={t.photo} alt="" className="tpe-item__ava-img" />
                  : <span className="tpe-item__ava-empty"><Camera size={16} strokeWidth={1.75} /></span>
                }
              </span>
              <span className="tpe-item__info">
                <span className="tpe-item__name">{t.name}</span>
                <span className="tpe-item__sport">{t.sportName}</span>
              </span>
              {t.published === false && <span className="tpe-item__hidden-badge">Скрыт</span>}
              <ChevronDown size={16} strokeWidth={2} className={`tpe-item__arrow${open === i ? ' tpe-item__arrow--open' : ''}`} />
            </button>

            {isRendered(i) && (
              <div className="tpe-item__body">
                <label className="tpe-switch tpe-switch--block">
                  <input
                    type="checkbox"
                    className="tpe-switch__input"
                    checked={t.published !== false}
                    onChange={e => set(i, 'published', e.target.checked)}
                  />
                  <span className="tpe-switch__track"><span className="tpe-switch__thumb" /></span>
                  <span className="tpe-switch__label">Показывать тренера на сайте</span>
                </label>

                <div className="tpe-two-col">
                  <Field label="Фото тренера">
                    <PhotoUpload
                      value={t.photo}
                      onChange={v => set(i, 'photo', v)}
                      shape="round"
                      placeholder="Фото тренера"
                      context="trainer-photo"
                      backendEnabled={BACKEND_ENABLED}
                      uploadFile={uploadFile}
                    />
                  </Field>
                  <div className="tpe-trainer-fields">
                    <Field label="ФИО тренера" hint={<><Lock size={11} strokeWidth={2} /> Из CRM «Спорт и тренеры» — изменить можно только там.</>}>
                      <input className="tpe-input tpe-input--readonly" value={t.name} disabled readOnly />
                    </Field>
                    <Field label="Вид спорта" hint={<><Lock size={11} strokeWidth={2} /> Из CRM «Спорт и тренеры» — изменить можно только там.</>}>
                      <input className="tpe-input tpe-input--readonly" value={t.sportName || '—'} disabled readOnly />
                    </Field>
                    <Field label="Тренерский стаж (напр. 10 лет)">
                      <input className="tpe-input" value={t.experience} onChange={e => set(i, 'experience', e.target.value)} />
                    </Field>
                    <Field label="Instagram (username без @)">
                      <input
                        className="tpe-input"
                        placeholder="username"
                        value={t.instagram || ''}
                        onChange={e => set(i, 'instagram', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <Field label="Краткое описание (на карточке слайдера)">
                  <input className="tpe-input" value={t.shortBio} onChange={e => set(i, 'shortBio', e.target.value)} />
                </Field>

                <Field label="Полное описание (в детальном окне)">
                  <textarea
                    className="tpe-input tpe-ta"
                    rows={3}
                    value={t.bio}
                    onChange={e => set(i, 'bio', e.target.value)}
                  />
                </Field>

                <div className="tpe-field">
                  <label className="tpe-field__label">Достижения</label>
                  {t.achievements.map((a, ai) => (
                    <div key={ai} className="tpe-achieve-row">
                      <input
                        className="tpe-input"
                        placeholder={`Достижение ${ai + 1}`}
                        value={a}
                        onChange={e => setAchieve(i, ai, e.target.value)}
                      />
                      {t.achievements.length > 1 && (
                        <button type="button" className="tpe-achieve-del" onClick={() => removeAchieve(i, ai)} aria-label="Удалить достижение"><X size={14} strokeWidth={2.5} /></button>
                      )}
                    </div>
                  ))}
                  {t.achievements.length < 6 && (
                    <button type="button" className="tpe-achieve-add" onClick={() => addAchieve(i)}>
                      <Plus size={14} strokeWidth={2.5} /> Добавить достижение
                    </button>
                  )}
                </div>

                <div className="tpe-videos-block">
                  <p className="tpe-videos-block__label"><Video size={13} strokeWidth={2} /> Видео тренировок</p>
                  <div className="tpe-videos-grid">
                    {[0, 1, 2, 3, 4].map(vi => (
                      <VideoUpload
                        key={vi}
                        num={vi + 1}
                        value={(t.videos || [])[vi] || ''}
                        onChange={v => setVideo(i, vi, v)}
                        context="trainer-video"
                        backendEnabled={BACKEND_ENABLED}
                        uploadFile={uploadFile}
                      />
                    ))}
                  </div>
                  {!BACKEND_ENABLED && (
                    <p className="tpe-videos-block__note">
                      Видео сохраняются только в рамках текущей сессии браузера
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Footer tab ───────────────────────────────────────────────────────────────

// ─── Prices Tab ───────────────────────────────────────────────────────────────
const PricesTab = ({ data, setData }) => {
  const prices = data.prices || [];

  const setPrices = (fn) => setData(d => ({ ...d, prices: fn(d.prices || []) }));

  const addCard = () => setPrices(arr => [
    ...arr,
    { id: Date.now(), name: '', price: '', desc: '', hot: false },
  ]);

  const removeCard = (idx) => setPrices(arr => arr.filter((_, i) => i !== idx));

  const update = (idx, field, val) => setPrices(arr =>
    arr.map((card, i) => i === idx ? { ...card, [field]: val } : card)
  );

  return (
    <div className="tpe-section">
      <h2 className="tpe-section__title">Цены</h2>
      <p className="tpe-section__hint">Карточки цен. Отметьте «Популярное» для выделенной карточки.</p>

      <div className="tpe-prices-editor">
        {prices.length === 0 && (
          <div className="tpe-empty">Нет карточек. Нажмите «Добавить карточку», чтобы добавить тарифы.</div>
        )}
        {prices.map((card, idx) => (
          <div key={card.id || idx} className={`tpe-price-card${card.hot ? ' tpe-price-card--hot' : ''}`}>
            <div className="tpe-price-card__hd">
              <label className={`tpe-price-card__hot-toggle${card.hot ? ' tpe-price-card__hot-toggle--active' : ''}`}>
                <input
                  type="checkbox"
                  className="tpe-price-card__hot-input"
                  checked={!!card.hot}
                  onChange={e => update(idx, 'hot', e.target.checked)}
                />
                <Star size={12} strokeWidth={2} fill={card.hot ? 'currentColor' : 'none'} />
                Популярное
              </label>
              <button className="tpe-icon-btn tpe-icon-btn--danger" onClick={() => removeCard(idx)} title="Удалить" aria-label="Удалить карточку"><X size={14} strokeWidth={2.5} /></button>
            </div>
            <Field label="Название">
              <input className="tpe-input" placeholder="напр. 12 занятий" value={card.name} onChange={e => update(idx, 'name', e.target.value)} />
            </Field>
            <Field label="Цена">
              <input className="tpe-input" placeholder="напр. 4 200 сом" value={card.price} onChange={e => update(idx, 'price', e.target.value)} />
            </Field>
            <Field label="Описание / пояснение">
              <input className="tpe-input" placeholder="напр. 350 сом за занятие" value={card.desc} onChange={e => update(idx, 'desc', e.target.value)} />
            </Field>
          </div>
        ))}
      </div>

      <button className="tpe-add-btn" onClick={addCard}><Plus size={14} strokeWidth={2.5} /> Добавить карточку</button>
    </div>
  );
};

/** Похоже на ссылку/содержит @ — а поле ждёт «голый» username. Не блокирует сохранение,
 * только предупреждает: со ссылкой вместо username кнопка на сайте будет вести не туда. */
const handleFormatWarning = (value) => {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.includes('/') || v.startsWith('@')) {
    return 'Похоже на ссылку — нужен только username, без адреса и «@».';
  }
  return null;
};

const handleHint = (value) => {
  const warning = handleFormatWarning(value);
  return warning ? <span className="tpe-field-warn"><AlertTriangle size={11} strokeWidth={2} /> {warning}</span> : undefined;
};

const FooterTab = ({ data, setData }) => {
  const set = (field, val) => setData(d => ({ ...d, footer: { ...d.footer, [field]: val } }));
  const f = data.footer;
  return (
    <div className="tpe-section">
      <h2 className="tpe-section__title">Контакты и мессенджеры</h2>

      <div className="tpe-card">
        <p className="tpe-card__subtitle"><MessageCircle size={13} strokeWidth={2} /> Мессенджеры — кнопки внизу страницы</p>
        <Field label="WhatsApp (номер, напр. 77001234567)">
          <input className="tpe-input" type="tel" placeholder="77001234567" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
        </Field>
        <Field label="Telegram (username без @)" hint={handleHint(f.telegram)}>
          <input className="tpe-input" placeholder="rahmanata" value={f.telegram || ''} onChange={e => set('telegram', e.target.value)} />
        </Field>
      </div>

      <div className="tpe-card">
        <p className="tpe-card__subtitle"><AtSign size={13} strokeWidth={2} /> Социальные сети</p>
        <Field label="Instagram (username без @)" hint={handleHint(f.instagram)}>
          <input className="tpe-input" placeholder="rahmanata_kg" value={f.instagram || ''} onChange={e => set('instagram', e.target.value)} />
        </Field>
        <Field label="TikTok (username без @)" hint={handleHint(f.tiktok)}>
          <input className="tpe-input" placeholder="rahmanata_kg" value={f.tiktok || ''} onChange={e => set('tiktok', e.target.value)} />
        </Field>
      </div>

      <div className="tpe-card">
        <p className="tpe-card__subtitle"><MapPin size={13} strokeWidth={2} /> Контактные данные</p>
        <Field label="Телефон">
          <input className="tpe-input" type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} />
        </Field>
        <Field label="Адрес">
          <input className="tpe-input" value={f.address} onChange={e => set('address', e.target.value)} />
        </Field>
        <Field label="Ссылка на карту (2GIS или Google Maps)">
          <input className="tpe-input" type="url" placeholder="https://2gis.kz/..." value={f.mapUrl || ''} onChange={e => set('mapUrl', e.target.value)} />
        </Field>
        <Field label="Строка авторских прав">
          <input className="tpe-input" value={f.copy} onChange={e => set('copy', e.target.value)} />
        </Field>
      </div>

      {(f.whatsapp || f.telegram) && (
        <div className="tpe-preview-box">
          <p className="tpe-preview-box__label">Кнопки мессенджеров</p>
          <div className="tpe-messenger-preview">
            {f.whatsapp && <div className="tpe-messenger-preview__wa">WhatsApp</div>}
            {f.telegram && <div className="tpe-messenger-preview__tg">Telegram</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Editor ──────────────────────────────────────────────────────────────

const TaplinkEditor = () => {
  const [data,    setData]    = useState(() => loadTaplinkData());
  const [tab,     setTab]     = useState('hero');
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [dirty,   setDirty]   = useState(false);
  const skipDirtyRef = useRef(true);
  const navigate = useNavigate();

  // Секции и тренеры на сайте — только из CRM («Спорт и тренеры»). Создавать/удалять их
  // вручную здесь нельзя: список всегда 1:1 отражает то, что реально настроено в CRM.
  const [crmSports, setCrmSports] = useState([]);
  const [crmTrainers, setCrmTrainers] = useState([]);
  const [crmLoading, setCrmLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCrmSports({}, null).then((d) => (Array.isArray(d) ? d : d?.results ?? d?.items ?? [])).catch(() => []),
      fetchCrmTrainers({ perPage: 500 }, null).then((d) => d?.items ?? d?.results ?? (Array.isArray(d) ? d : [])).catch(() => []),
    ]).then(([sports, trainers]) => {
      if (cancelled) return;
      setCrmSports(sports);
      setCrmTrainers(trainers);
      setCrmLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Приводим data.sports/data.trainers в соответствие с CRM: новые секции/тренеры добавляются
  // автоматически с пустым маркетинговым контентом, удалённые в CRM — пропадают и здесь.
  // Название/вид спорта всегда обновляются из CRM (не редактируются вручную).
  useEffect(() => {
    // Ждём и CRM-списки, и (если включён бэкенд) загрузку сохранённого конфига —
    // иначе более поздний setData из loadTaplinkDataAsync затрёт результат сверки.
    if (crmLoading || loading) return;
    setData((d) => {
      const existingSportById = new Map((d.sports || []).map((s) => [String(s.crmSportId), s]));
      const sports = crmSports.map((cs) => {
        const existing = existingSportById.get(String(cs.id));
        return existing
          ? { ...existing, name: cs.name }
          : {
              id: `crm-sport-${cs.id}`, crmSportId: cs.id, name: cs.name, emoji: '🥋', photo: null,
              gradient: 'linear-gradient(145deg, #1a0505 0%, #6b1414 60%, #8b1a1a 100%)',
              desc: '', videos: ['', '', '', '', ''], published: true,
            };
      });

      const existingTrainerById = new Map((d.trainers || []).map((t) => [String(t.crmTrainerId), t]));
      const trainers = crmTrainers.map((ct) => {
        const sportName = resolveTrainerSportName(ct, crmSports);
        const existing = existingTrainerById.get(String(ct.id));
        return existing
          ? { ...existing, name: ct.fio || ct.name || existing.name, sportName }
          : {
              id: `crm-trainer-${ct.id}`, crmTrainerId: ct.id, name: ct.fio || ct.name || '', sportName,
              emoji: '👤', photo: null, experience: '', shortBio: '', bio: '', instagram: '',
              achievements: [''], videos: ['', '', '', '', ''], published: true,
            };
      });

      return { ...d, sports, trainers };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmSports, crmTrainers, crmLoading, loading]);

  // Load from API on mount (if backend is enabled and no fresh session data)
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    loadTaplinkDataAsync()
      .then(d => { skipDirtyRef.current = true; setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep session store in sync so TaplinkPage can access blob: video URLs
  useEffect(() => {
    setSessionData(data);
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setDirty(true);
  }, [data]);

  // Warn before leaving the tab/closing it while there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await saveTaplinkDataAsync(data);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(e?.response?.data?.error?.message || e?.message || 'Ошибка сохранения');
      setTimeout(() => setSaveErr(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    // Navigate within the SPA so blob: URLs remain valid in the same tab
    navigate('/taplink');
  };

  if (loading) {
    return (
      <div className="tpe">
        <div style={{ padding: '60px 32px', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Загрузка данных…
        </div>
      </div>
    );
  }

  const saveBtnContent = saving
    ? 'Сохранение…'
    : saved
      ? <><Check size={15} strokeWidth={2.5} /> Сохранено</>
      : 'Сохранить';

  return (
    <div className="tpe">
      <div className="tpe__top">
        <div className="tpe__top-left">
          <img src="/rahman.png" alt="Рахман Ата" className="tpe__logo" />
          <div>
            <p className="tpe__title">Редактор Taplink</p>
            <p className="tpe__subtitle">Редактируйте все элементы публичной страницы</p>
          </div>
        </div>
        <div className="tpe__actions">
          <button type="button" className="tpe__preview-btn" onClick={preview}>
            <Eye size={15} strokeWidth={2} /> Предпросмотр
          </button>
          <button
            type="button"
            className={`tpe__save-btn${saved ? ' tpe__save-btn--done' : ''}`}
            onClick={save}
            disabled={saving}
          >
            {saveBtnContent}
          </button>
        </div>
      </div>

      <div className="tpe__tabs" role="tablist" aria-label="Разделы редактора">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tpe__tab${tab === t.id ? ' tpe__tab--on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={15} strokeWidth={2} className="tpe__tab-icon" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tpe__body">
        {tab === 'hero'     && <HeroTab     data={data} setData={setData} />}
        {tab === 'stats'    && <StatsTab    data={data} setData={setData} />}
        {tab === 'sports'   && <SportsTab   data={data} setData={setData} />}
        {tab === 'trainers' && <TrainersTab data={data} setData={setData} />}
        {tab === 'prices'   && <PricesTab   data={data} setData={setData} />}
        {tab === 'footer'   && <FooterTab   data={data} setData={setData} />}
      </div>

      <div className={`tpe__bottom-bar${dirty && !saveErr ? ' tpe__bottom-bar--dirty' : ''}`}>
        <span className={`tpe__bottom-note${saveErr ? ' tpe__bottom-note--error' : saved ? ' tpe__bottom-note--ok' : ''}`}>
          {saveErr
            ? <><AlertTriangle size={13} strokeWidth={2} /> {saveErr}</>
            : saved
              ? <><Check size={13} strokeWidth={2.5} /> Изменения сохранены</>
              : dirty
                ? <>Несохранённые изменения будут потеряны при перезагрузке</>
                : 'Все изменения сохранены'}
        </span>
        <button
          type="button"
          className={`tpe__save-btn${saved ? ' tpe__save-btn--done' : ''}`}
          onClick={save}
          disabled={saving}
        >
          {saveBtnContent}
        </button>
      </div>
    </div>
  );
};

export default TaplinkEditor;
