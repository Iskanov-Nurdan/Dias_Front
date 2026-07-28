import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadTaplinkData, saveTaplinkDataAsync, loadTaplinkDataAsync, setSessionData } from './taplinkStore';
import { BACKEND_ENABLED, uploadFile } from './api';
import Select from '../../shared/ui/Select';
import './TaplinkEditor.scss';

const TABS = [
  { id: 'hero',     label: 'Главная',    icon: '🏠' },
  { id: 'stats',    label: 'Статистика', icon: '📊' },
  { id: 'sports',   label: 'Секции',     icon: '🥋' },
  { id: 'trainers', label: 'Тренеры',    icon: '👤' },
  { id: 'prices',   label: 'Цены',       icon: '💰' },
  { id: 'footer',   label: 'Контакты',   icon: '📞' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Field = ({ label, children }) => (
  <div className="tpe-field">
    <label className="tpe-field__label">{label}</label>
    {children}
  </div>
);

// ─── Photo upload ─────────────────────────────────────────────────────────────

const PhotoUpload = ({ value, onChange, shape = 'rect', placeholder = 'Загрузить фото', context = '' }) => {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5 МБ.');
      return;
    }
    e.target.value = '';

    if (BACKEND_ENABLED) {
      setUploading(true);
      try {
        const url = await uploadFile(file, context);
        onChange(url);
      } catch {
        alert('Ошибка загрузки файла. Попробуйте ещё раз.');
      } finally {
        setUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = ev => onChange(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`tpe-photo tpe-photo--${shape}`}>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      {value ? (
        <div className="tpe-photo__has">
          <img src={value} alt="" className="tpe-photo__img" />
          {!uploading && (
            <div className="tpe-photo__overlay">
              <button type="button" className="tpe-photo__change" onClick={() => ref.current.click()}>
                Заменить
              </button>
              <button type="button" className="tpe-photo__del" onClick={() => onChange(null)}>
                Удалить
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="tpe-photo__empty" onClick={() => !uploading && ref.current.click()}>
          <span className="tpe-photo__ic">{uploading ? '⏳' : '📷'}</span>
          <span className="tpe-photo__txt">{uploading ? 'Загружается...' : placeholder}</span>
          {!uploading && <span className="tpe-photo__hint">JPG, PNG, WEBP · до 5 МБ</span>}
        </div>
      )}
    </div>
  );
};

// ─── Video upload ─────────────────────────────────────────────────────────────

const VideoUpload = ({ value, onChange, num, context = '' }) => {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (BACKEND_ENABLED) {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
      setUploading(true);
      try {
        const url = await uploadFile(file, context);
        onChange(url);
      } catch {
        alert('Ошибка загрузки видео. Попробуйте ещё раз.');
      } finally {
        setUploading(false);
      }
    } else {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
      const url = URL.createObjectURL(file);
      onChange(url);
    }
  };

  const remove = () => {
    if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
    onChange('');
  };

  return (
    <div className="tpe-vid">
      <input ref={ref} type="file" accept="video/mp4,video/webm,video/*" hidden onChange={handleFile} />
      {value ? (
        <div className="tpe-vid__has">
          <video src={value} controls className="tpe-vid__player" />
          {!uploading && (
            <div className="tpe-vid__actions">
              <button type="button" onClick={() => ref.current.click()}>Заменить</button>
              <button type="button" className="tpe-vid__del" onClick={remove}>Удалить</button>
            </div>
          )}
        </div>
      ) : (
        <div className="tpe-vid__empty" onClick={() => !uploading && ref.current.click()}>
          <span className="tpe-vid__ic">{uploading ? '⏳' : '🎬'}</span>
          <span className="tpe-vid__txt">{uploading ? 'Загружается...' : `Видео ${num}`}</span>
          {!uploading && <span className="tpe-vid__hint">MP4, WEBM</span>}
        </div>
      )}
    </div>
  );
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
          <label className="tpe-toggle">
            <input
              type="checkbox"
              checked={!!(data.offer && data.offer.enabled)}
              onChange={e => setData(d => ({ ...d, offer: { ...(d.offer || {}), enabled: e.target.checked } }))}
            />
            <span>{(data.offer && data.offer.enabled) ? 'Показывать' : 'Скрыто'}</span>
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
        <h2 className="tpe-section__title">Статистика</h2>
        <button className="tpe-add-btn" type="button" onClick={addStat}>+ Добавить</button>
      </div>
      <div className="tpe-stats-grid">
        {data.stats.map((s, i) => (
          <div key={i} className="tpe-stat-card">
            <div className="tpe-stat-card__preview">
              <span className="tpe-stat-card__n">{s.n || '—'}</span>
              <span className="tpe-stat-card__l">{s.l || 'подпись'}</span>
            </div>
            <Field label="Число / текст">
              <input className="tpe-input" value={s.n} onChange={e => set(i, 'n', e.target.value)} />
            </Field>
            <Field label="Подпись">
              <input className="tpe-input" value={s.l} onChange={e => set(i, 'l', e.target.value)} />
            </Field>
            {data.stats.length > 1 && (
              <button className="tpe-delete-sm" type="button" onClick={() => removeStat(i)}>Удалить</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Trainer multi-select ─────────────────────────────────────────────────────

const TrainerMultiSelect = ({ value = [], onChange, trainers }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const arr = Array.isArray(value) ? value : (value ? [value] : []);

  const toggle = (name) => {
    onChange(arr.includes(name) ? arr.filter(n => n !== name) : [...arr, name]);
  };

  return (
    <div className="tpe-trainer-sel tpe-sched-entry__trainer" ref={ref}>
      <button type="button" className="tpe-trainer-sel__btn" onClick={() => setOpen(o => !o)}>
        {arr.length === 0 ? (
          <span className="tpe-trainer-sel__placeholder">Тренер</span>
        ) : (
          <div className="tpe-trainer-sel__chips">
            {arr.map(name => (
              <span key={name} className="tpe-trainer-sel__chip">
                {name}
                <span
                  className="tpe-trainer-sel__chip-del"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(name); }}
                >✕</span>
              </span>
            ))}
          </div>
        )}
        <span className="tpe-trainer-sel__arrow">▾</span>
      </button>
      {open && (
        <div className="tpe-trainer-sel__dropdown">
          {trainers.length === 0 ? (
            <span className="tpe-trainer-sel__empty">Сначала добавьте тренеров во вкладке «Тренеры»</span>
          ) : trainers.map((t) => (
            <label key={t.id || t.name} className={`tpe-trainer-sel__opt${arr.includes(t.name) ? ' tpe-trainer-sel__opt--checked' : ''}`}>
              <input type="checkbox" checked={arr.includes(t.name)} onChange={() => toggle(t.name)} />
              {t.photo && <img src={t.photo} alt="" className="tpe-trainer-sel__ava" />}
              {t.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sports tab ───────────────────────────────────────────────────────────────

const SportsTab = ({ data, setData }) => {
  const [open, setOpen] = useState(null);

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

  const setSched = (si, fn) =>
    setData(d => {
      const sports = [...d.sports];
      sports[si] = { ...sports[si], schedule: fn(sports[si].schedule || []) };
      return { ...d, sports };
    });

  const addSchedRow = (si) => setSched(si, arr => [
    ...arr,
    { id: Date.now(), group: '', days: '', time: '', trainers: [] },
  ]);

  const removeSchedRow = (si, ri) => setSched(si, arr => arr.filter((_, i) => i !== ri));

  const updateSchedRow = (si, ri, field, val) => setSched(si, arr =>
    arr.map((row, i) => i === ri ? { ...row, [field]: val } : row)
  );

  const add = () => {
    const idx = data.sports.length;
    setData(d => ({
      ...d,
      sports: [...d.sports, {
        id: Date.now(), name: 'Новая секция', emoji: '🥋', photo: null,
        gradient: 'linear-gradient(145deg, #1a0505 0%, #6b1414 60%, #8b1a1a 100%)',
        desc: '', schedule: [], videos: ['', '', '', '', ''],
      }],
    }));
    setOpen(idx);
  };

  const remove = i => {
    setData(d => ({ ...d, sports: d.sports.filter((_, idx) => idx !== i) }));
    setOpen(null);
  };

  return (
    <div className="tpe-section">
      <div className="tpe-section__hd">
        <h2 className="tpe-section__title">Секции ({data.sports.length})</h2>
        <button className="tpe-add-btn" type="button" onClick={add}>+ Добавить</button>
      </div>
      <div className="tpe-list">
        {data.sports.map((sport, i) => (
          <div key={sport.id || i} className={`tpe-item${open === i ? ' tpe-item--open' : ''}`}>
            <button type="button" className="tpe-item__head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="tpe-item__thumb-wrap">
                {sport.photo
                  ? <img src={sport.photo} alt="" className="tpe-item__thumb-img" />
                  : <span className="tpe-item__thumb-empty">📷</span>
                }
              </span>
              <span className="tpe-item__name">{sport.name}</span>
              <span className="tpe-item__arrow">{open === i ? '▲' : '▼'}</span>
            </button>

            {open === i && (
              <div className="tpe-item__body">
                <Field label="Название секции">
                  <input className="tpe-input" value={sport.name} onChange={e => set(i, 'name', e.target.value)} />
                </Field>

                <Field label="Фото секции (баннер)">
                  <PhotoUpload
                    value={sport.photo}
                    onChange={v => set(i, 'photo', v)}
                    shape="rect"
                    placeholder="Загрузить фото секции"
                    context="sport-photo"
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

                {/* ── Schedule ── */}
                <div className="tpe-sched-block">
                  <div className="tpe-sched-block__hd">
                    <span className="tpe-sched-block__label">Расписание</span>
                    <button className="tpe-sched-block__add" type="button" onClick={() => addSchedRow(i)}>
                      + Добавить время
                    </button>
                  </div>
                  {(sport.schedule || []).length === 0 && (
                    <p className="tpe-sched-block__empty">Расписание не добавлено</p>
                  )}
                  {(sport.schedule || []).map((row, ri) => (
                    <div key={row.id || ri} className="tpe-sched-entry">
                      <input
                        className="tpe-input tpe-sched-entry__group"
                        placeholder="Группа (Взрослые / Дети 7–14)"
                        value={row.group}
                        onChange={e => updateSchedRow(i, ri, 'group', e.target.value)}
                      />
                      <input
                        className="tpe-input tpe-sched-entry__days"
                        placeholder="Дни (Пн, Ср, Пт)"
                        value={row.days}
                        onChange={e => updateSchedRow(i, ri, 'days', e.target.value)}
                      />
                      <input
                        className="tpe-input tpe-sched-entry__time"
                        placeholder="Время (18:00–20:00)"
                        value={row.time}
                        onChange={e => updateSchedRow(i, ri, 'time', e.target.value)}
                      />
                      <TrainerMultiSelect
                        value={row.trainers ?? (row.trainer ? [row.trainer] : [])}
                        onChange={v => updateSchedRow(i, ri, 'trainers', v)}
                        trainers={data.trainers}
                      />
                      <button
                        className="tpe-icon-btn tpe-icon-btn--danger"
                        type="button"
                        onClick={() => removeSchedRow(i, ri)}
                        title="Удалить"
                      >✕</button>
                    </div>
                  ))}
                </div>

                <div className="tpe-videos-block">
                  <p className="tpe-videos-block__label">Видео секции</p>
                  <div className="tpe-videos-grid">
                    {[0, 1, 2, 3, 4].map(vi => (
                      <VideoUpload
                        key={vi}
                        num={vi + 1}
                        value={(sport.videos || [])[vi] || ''}
                        onChange={v => setVideo(i, vi, v)}
                        context="sport-video"
                      />
                    ))}
                  </div>
                  {!BACKEND_ENABLED && (
                    <p className="tpe-videos-block__note">
                      Видео сохраняются только в рамках текущей сессии браузера
                    </p>
                  )}
                </div>

                <button className="tpe-delete-btn" type="button" onClick={() => remove(i)}>
                  🗑 Удалить секцию
                </button>
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
  const [open, setOpen] = useState(null);

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

  const add = () => {
    const idx = data.trainers.length;
    setData(d => ({
      ...d,
      trainers: [...d.trainers, {
        id: Date.now(), name: 'Новый тренер', sportName: '', emoji: '👤', photo: null,
        experience: '1 год', shortBio: '', bio: '', achievements: [''], videos: ['', '', '', '', ''],
      }],
    }));
    setOpen(idx);
  };

  const remove = i => {
    setData(d => ({ ...d, trainers: d.trainers.filter((_, idx) => idx !== i) }));
    setOpen(null);
  };

  return (
    <div className="tpe-section">
      <div className="tpe-section__hd">
        <h2 className="tpe-section__title">Тренеры ({data.trainers.length})</h2>
        <button className="tpe-add-btn" type="button" onClick={add}>+ Добавить</button>
      </div>
      <div className="tpe-list">
        {data.trainers.map((t, i) => (
          <div key={t.id || i} className={`tpe-item${open === i ? ' tpe-item--open' : ''}`}>
            <button type="button" className="tpe-item__head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="tpe-item__ava-wrap">
                {t.photo
                  ? <img src={t.photo} alt="" className="tpe-item__ava-img" />
                  : <span className="tpe-item__ava-empty">📷</span>
                }
              </span>
              <span className="tpe-item__info">
                <span className="tpe-item__name">{t.name}</span>
                <span className="tpe-item__sport">{t.sportName}</span>
              </span>
              <span className="tpe-item__arrow">{open === i ? '▲' : '▼'}</span>
            </button>

            {open === i && (
              <div className="tpe-item__body">
                <div className="tpe-two-col">
                  <Field label="Фото тренера">
                    <PhotoUpload
                      value={t.photo}
                      onChange={v => set(i, 'photo', v)}
                      shape="round"
                      placeholder="Фото тренера"
                      context="trainer-photo"
                    />
                  </Field>
                  <div className="tpe-trainer-fields">
                    <Field label="ФИО тренера">
                      <input className="tpe-input" value={t.name} onChange={e => set(i, 'name', e.target.value)} />
                    </Field>
                    <Field label="Вид спорта">
                      <Select
                        value={t.sportName}
                        onChange={v => set(i, 'sportName', v)}
                        placeholder="— выберите секцию —"
                        options={data.sports.map(s => ({ value: s.name, label: s.name }))}
                      />
                    </Field>
                    <Field label="Опыт (напр. 10 лет)">
                      <input className="tpe-input" value={t.experience} onChange={e => set(i, 'experience', e.target.value)} />
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
                        <button type="button" className="tpe-achieve-del" onClick={() => removeAchieve(i, ai)}>✕</button>
                      )}
                    </div>
                  ))}
                  {t.achievements.length < 6 && (
                    <button type="button" className="tpe-achieve-add" onClick={() => addAchieve(i)}>
                      + Добавить достижение
                    </button>
                  )}
                </div>

                <div className="tpe-videos-block">
                  <p className="tpe-videos-block__label">Видео тренировок</p>
                  <div className="tpe-videos-grid">
                    {[0, 1, 2, 3, 4].map(vi => (
                      <VideoUpload
                        key={vi}
                        num={vi + 1}
                        value={(t.videos || [])[vi] || ''}
                        onChange={v => setVideo(i, vi, v)}
                        context="trainer-video"
                      />
                    ))}
                  </div>
                  {!BACKEND_ENABLED && (
                    <p className="tpe-videos-block__note">
                      Видео сохраняются только в рамках текущей сессии браузера
                    </p>
                  )}
                </div>

                <button className="tpe-delete-btn" type="button" onClick={() => remove(i)}>
                  🗑 Удалить тренера
                </button>
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
          <div className="tpe-empty">Нет карточек. Нажмите «+ Добавить», чтобы добавить тарифы.</div>
        )}
        {prices.map((card, idx) => (
          <div key={card.id || idx} className={`tpe-price-card${card.hot ? ' tpe-price-card--hot' : ''}`}>
            <div className="tpe-price-card__hd">
              <label className="tpe-price-card__hot-toggle">
                <input
                  type="checkbox"
                  checked={!!card.hot}
                  onChange={e => update(idx, 'hot', e.target.checked)}
                />
                <span>Популярное</span>
              </label>
              <button className="tpe-icon-btn tpe-icon-btn--danger" onClick={() => removeCard(idx)} title="Удалить">✕</button>
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

      <button className="tpe-add-btn" onClick={addCard}>+ Добавить карточку</button>
    </div>
  );
};

const FooterTab = ({ data, setData }) => {
  const set = (field, val) => setData(d => ({ ...d, footer: { ...d.footer, [field]: val } }));
  const f = data.footer;
  return (
    <div className="tpe-section">
      <h2 className="tpe-section__title">Контакты и мессенджеры</h2>

      <div className="tpe-card">
        <p className="tpe-card__subtitle">Мессенджеры — кнопки внизу страницы</p>
        <Field label="WhatsApp (номер, напр. 77001234567)">
          <input className="tpe-input" type="tel" placeholder="77001234567" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
        </Field>
        <Field label="Telegram (username без @)">
          <input className="tpe-input" placeholder="rahmanata" value={f.telegram || ''} onChange={e => set('telegram', e.target.value)} />
        </Field>
      </div>

      <div className="tpe-card">
        <p className="tpe-card__subtitle">Социальные сети</p>
        <Field label="Instagram (username без @)">
          <input className="tpe-input" placeholder="rahmanata_kg" value={f.instagram || ''} onChange={e => set('instagram', e.target.value)} />
        </Field>
        <Field label="TikTok (username без @)">
          <input className="tpe-input" placeholder="rahmanata_kg" value={f.tiktok || ''} onChange={e => set('tiktok', e.target.value)} />
        </Field>
      </div>

      <div className="tpe-card">
        <p className="tpe-card__subtitle">Контактные данные</p>
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
  const navigate = useNavigate();

  // Load from API on mount (if backend is enabled and no fresh session data)
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    loadTaplinkDataAsync()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep session store in sync so TaplinkPage can access blob: video URLs
  useEffect(() => {
    setSessionData(data);
  }, [data]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await saveTaplinkDataAsync(data);
      setSaved(true);
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

  const saveBtnLabel = saving ? 'Сохранение…' : saved ? '✓ Сохранено' : 'Сохранить';

  return (
    <div className="tpe">
      <div className="tpe__top">
        <div className="tpe__top-left">
          <img src="/rahman.png" alt="" className="tpe__logo" />
          <div>
            <p className="tpe__title">Редактор Taplink</p>
            <p className="tpe__subtitle">Редактируйте все элементы публичной страницы</p>
          </div>
        </div>
        <div className="tpe__actions">
          <button type="button" className="tpe__preview-btn" onClick={preview}>
            👁 Предпросмотр
          </button>
          <button
            type="button"
            className={`tpe__save-btn${saved ? ' tpe__save-btn--done' : ''}`}
            onClick={save}
            disabled={saving}
          >
            {saveBtnLabel}
          </button>
        </div>
      </div>

      <div className="tpe__tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" className={`tpe__tab${tab === t.id ? ' tpe__tab--on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tpe__tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tpe__body">
        {tab === 'hero'     && <HeroTab     data={data} setData={setData} />}
        {tab === 'stats'    && <StatsTab    data={data} setData={setData} />}
        {tab === 'sports'   && <SportsTab   data={data} setData={setData} />}
        {tab === 'trainers' && <TrainersTab data={data} setData={setData} />}
        {tab === 'prices'   && <PricesTab   data={data} setData={setData} />}
        {tab === 'footer'   && <FooterTab   data={data} setData={setData} />}
      </div>

      <div className="tpe__bottom-bar">
        <span className="tpe__bottom-note">
          {saveErr
            ? `⚠ ${saveErr}`
            : saved
              ? '✓ Изменения сохранены'
              : 'Несохранённые изменения будут потеряны при перезагрузке'}
        </span>
        <button
          type="button"
          className={`tpe__save-btn${saved ? ' tpe__save-btn--done' : ''}`}
          onClick={save}
          disabled={saving}
        >
          {saveBtnLabel}
        </button>
      </div>
    </div>
  );
};

export default TaplinkEditor;
