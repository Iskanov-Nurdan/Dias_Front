import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Dumbbell, Globe, Video, Plus, Clock, AtSign, MessageSquare, FileText, Trophy, Check,
  KeyRound, Lock, ShieldCheck, ShieldOff, Copy,
} from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton, PhotoUpload, VideoUpload } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { BACKEND_ENABLED, uploadFile } from '../../taplink/api';
import { loadTaplinkDataAsync, saveTaplinkDataAsync } from '../../taplink/taplinkStore';
import { createTrainerAccount, updateTrainerAccount } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import '../../../shared/ui/EntityNameModal.scss';
import './TrainerFormModal.scss';

const MAX_VIDEOS = 5;
const MAX_ACHIEVEMENTS = 6;

/** Пустая карточка тренера на публичной странице (Taplink) — до первой загрузки/заполнения. */
const emptyTaplinkFields = () => ({
  photo: null,
  experience: '',
  instagram: '',
  shortBio: '',
  bio: '',
  achievements: [''],
  videos: ['', '', '', '', ''],
  published: true,
});

const TrainerFormModal = ({ trainer, sports, onSave, onClose, error, saving, onAccountChanged }) => {
  const toast = useToast();
  const [fio, setFio] = useState('');
  const [sportIds, setSportIds] = useState([]);
  const isEdit = !!trainer?.id;

  /**
   * Доступ на сайт (логин/пароль) — независимое от остальной формы действие
   * со своим запросом: выдаётся не всегда вместе с созданием тренера, а часто
   * позже, отдельным решением администратора. Поэтому у блока свои кнопки,
   * а не общий «Сохранить» формы.
   */
  const [account, setAccount] = useState({ hasAccount: false, accountLogin: null, accountActive: null });
  const [accMode, setAccMode] = useState(null); // null | 'create' | 'reset'
  const [accLogin, setAccLogin] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accSaving, setAccSaving] = useState(false);
  const [accError, setAccError] = useState(null);

  useEffect(() => {
    setAccount({
      hasAccount: !!trainer?.hasAccount,
      accountLogin: trainer?.accountLogin ?? null,
      accountActive: trainer?.accountActive ?? null,
    });
    setAccMode(null);
    setAccLogin('');
    setAccPassword('');
    setAccError(null);
  }, [trainer?.id, trainer?.hasAccount, trainer?.accountLogin, trainer?.accountActive]);

  const applyAccountResponse = (data) => {
    setAccount({
      hasAccount: !!data?.hasAccount,
      accountLogin: data?.accountLogin ?? null,
      accountActive: data?.accountActive ?? null,
    });
    onAccountChanged?.();
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setAccError(null);
    setAccSaving(true);
    try {
      const res = await createTrainerAccount(trainer.id, { login: accLogin.trim(), password: accPassword });
      applyAccountResponse(res?.data);
      setAccMode(null);
      setAccPassword('');
      toast.success('Доступ выдан — сообщите тренеру логин и пароль');
    } catch (err) {
      setAccError(getApiErrorMessage(err));
    } finally {
      setAccSaving(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!accPassword) return;
    setAccError(null);
    setAccSaving(true);
    try {
      const res = await updateTrainerAccount(trainer.id, { password: accPassword });
      applyAccountResponse(res?.data);
      setAccMode(null);
      setAccPassword('');
      toast.success('Пароль обновлён — сообщите его тренеру');
    } catch (err) {
      setAccError(getApiErrorMessage(err));
    } finally {
      setAccSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setAccError(null);
    setAccSaving(true);
    try {
      const res = await updateTrainerAccount(trainer.id, { isActive: !account.accountActive });
      applyAccountResponse(res?.data);
    } catch (err) {
      setAccError(getApiErrorMessage(err));
    } finally {
      setAccSaving(false);
    }
  };

  const handleCopyLogin = async () => {
    if (!account.accountLogin) return;
    try {
      await navigator.clipboard.writeText(account.accountLogin);
      toast.success('Логин скопирован');
    } catch {
      // Буфер обмена недоступен (нет разрешения/не https) — не критично,
      // логин и так виден на экране, просто не скопируется одним кликом
    }
  };

  // ── Публичная страница (Taplink) — тот же тренер, что и в CRM, второй набор полей
  // для маркетингового контента сайта. Хранится отдельным блобом на бэке Taplink
  // (не в модели Trainer), поэтому грузим/сохраняем его самостоятельно, не трогая
  // основной поток создания/редактирования тренера в CRM.
  const [tl, setTl] = useState(emptyTaplinkFields());
  const [tlConfig, setTlConfig] = useState(null);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlUploading, setTlUploading] = useState(0);
  const bumpTlUploading = useCallback((isUploading) => {
    setTlUploading((c) => Math.max(0, c + (isUploading ? 1 : -1)));
  }, []);

  useModalEffect(true, onClose);

  useEffect(() => {
    if (trainer) {
      setFio(trainer.fio || '');
      const ids = trainer.sportIds ?? trainer.sport_ids ?? (trainer.sports || []).map((s) => (typeof s === 'object' ? s.id : s));
      setSportIds(Array.isArray(ids) ? ids : []);
    }
  }, [trainer]);

  useEffect(() => {
    if (!trainer?.id) {
      setTl(emptyTaplinkFields());
      setTlConfig(null);
      return undefined;
    }
    let cancelled = false;
    setTlLoading(true);
    loadTaplinkDataAsync()
      .then((cfg) => {
        if (cancelled) return;
        setTlConfig(cfg);
        const found = (cfg?.trainers || []).find((t) => String(t.crmTrainerId) === String(trainer.id));
        setTl(found
          ? {
              photo: found.photo ?? null,
              experience: found.experience || '',
              instagram: found.instagram || '',
              shortBio: found.shortBio || '',
              bio: found.bio || '',
              achievements: (found.achievements || []).length ? found.achievements : [''],
              videos: (found.videos || []).length ? found.videos : ['', '', '', '', ''],
              published: found.published !== false,
            }
          : emptyTaplinkFields());
      })
      .catch(() => { if (!cancelled) setTlConfig(null); })
      .finally(() => { if (!cancelled) setTlLoading(false); });
    return () => { cancelled = true; };
  }, [trainer?.id]);

  const toggleSport = (id) => {
    setSportIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setAchievement = (idx, val) => setTl((s) => {
    const achievements = [...s.achievements];
    achievements[idx] = val;
    return { ...s, achievements };
  });
  const addAchievement = () => setTl((s) => ({ ...s, achievements: [...s.achievements, ''] }));
  const removeAchievement = (idx) => setTl((s) => ({ ...s, achievements: s.achievements.filter((_, i) => i !== idx) }));
  const setVideo = (idx, val) => setTl((s) => {
    const videos = [...s.videos];
    videos[idx] = val;
    return { ...s, videos };
  });

  // Показываем только уже загруженные видео + один слот «следующее» — вместо пяти
  // одинаковых пустых рамок, которые в сетке выглядели дырявым рядом 4+1.
  const filledVideos = tl.videos
    .map((v, i) => ({ url: v, idx: i }))
    .filter((x) => Boolean(x.url));
  const nextFreeVideoIdx = tl.videos.findIndex((v) => !v);
  const visibleVideos = nextFreeVideoIdx >= 0
    ? [...filledVideos, { url: '', idx: nextFreeVideoIdx }]
    : filledVideos;

  /** Сохраняет карточку тренера в общий конфиг Taplink — best-effort, не блокирует
   * сохранение основных CRM-полей (ФИО/виды спорта), если публичная страница не загрузилась. */
  const saveTaplinkPart = async () => {
    if (!tlConfig) {
      toast.error('Публичная страница не была загружена — фото/описание/видео не сохранены. Откройте тренера ещё раз.');
      return;
    }
    const sportName = sports?.find((s) => sportIds.includes(s.id))?.name || '';
    const list = tlConfig.trainers || [];
    const idx = list.findIndex((t) => String(t.crmTrainerId) === String(trainer.id));
    const entry = {
      ...(idx >= 0 ? list[idx] : { id: `crm-trainer-${trainer.id}`, crmTrainerId: trainer.id, emoji: '👤' }),
      name: fio,
      sportName,
      photo: tl.photo,
      experience: tl.experience,
      instagram: tl.instagram,
      shortBio: tl.shortBio,
      bio: tl.bio,
      achievements: tl.achievements.length ? tl.achievements : [''],
      videos: tl.videos,
      published: tl.published,
    };
    const trainers = idx >= 0
      ? list.map((t, i) => (i === idx ? entry : t))
      : [...list, entry];
    try {
      await saveTaplinkDataAsync({ ...tlConfig, trainers });
    } catch {
      toast.error('Не удалось сохранить публичную страницу тренера. Попробуйте ещё раз.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ fio, sportIds });
    if (isEdit) saveTaplinkPart();
  };

  const content = (
    <div className="enm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="trainer-form-modal-title">
      <div className="enm trainer-form-modal" onClick={(e) => e.stopPropagation()}>

        <div className="enm__header">
          <div className="enm__header-icon" aria-hidden>
            <User size={20} strokeWidth={1.75} />
          </div>
          <div className="enm__header-text">
            <p className="enm__header-sub">{isEdit ? 'Редактирование' : 'Новый тренер'}</p>
            <h2 id="trainer-form-modal-title" className="enm__title">{isEdit ? (trainer?.fio || 'Тренер') : 'Добавить тренера'}</h2>
          </div>
          <button type="button" className="enm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="enm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="enm__form">
          <div className="enm__body">
            {/* Фото слева, имя и виды спорта справа — карточка профиля: обе части
                примерно одной высоты, пустых зон под полями не остаётся. */}
            <div className="trainer-form-modal__crm">
              {isEdit && !tlLoading && (
                <div className="enm__field trainer-form-modal__photo-field">
                  <label className="enm__label">
                    <Globe size={13} className="enm__label-icon" />
                    Фото для сайта
                  </label>
                  <PhotoUpload
                    value={tl.photo}
                    onChange={(v) => setTl((s) => ({ ...s, photo: v }))}
                    shape="round"
                    placeholder="Фото тренера"
                    context="trainer-photo"
                    backendEnabled={BACKEND_ENABLED}
                    uploadFile={uploadFile}
                    onUploadingChange={bumpTlUploading}
                  />
                </div>
              )}

              <div className="trainer-form-modal__crm-main">
                <div className="enm__field">
                  <label className="enm__label" htmlFor="trainer-form-fio">
                    <User size={14} className="enm__label-icon" />
                    ФИО <span className="enm__required">*</span>
                  </label>
                  <input
                    id="trainer-form-fio"
                    type="text"
                    value={fio}
                    onChange={(e) => setFio(e.target.value)}
                    required
                    className="enm__input"
                    autoFocus
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div className="enm__field">
                  <label className="enm__label">
                    <Dumbbell size={14} className="enm__label-icon" />
                    Виды спорта
                    {sportIds.length > 0 && (
                      <span className="trainer-form-modal__count">{sportIds.length}</span>
                    )}
                  </label>
                  {(sports || []).length === 0 ? (
                    <p className="trainer-form-modal__empty">Сначала добавьте виды спорта во вкладке «Виды спорта»</p>
                  ) : (
                    <div className="trainer-form-modal__chips">
                      {(sports || []).map((s) => {
                        const on = sportIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            className={`trainer-form-modal__chip${on ? ' trainer-form-modal__chip--on' : ''}`}
                            onClick={() => toggleSport(s.id)}
                          >
                            {on && <Check size={13} strokeWidth={3} className="trainer-form-modal__chip-check" />}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isEdit && (
              <div className="trainer-form-modal__tl">
                <div className="trainer-form-modal__tl-head">
                  <span className="trainer-form-modal__tl-title">
                    <Globe size={14} strokeWidth={2} /> Публичная страница (Taplink)
                  </span>
                  {!tlLoading && (
                    <label className="trainer-form-modal__switch">
                      <input
                        type="checkbox"
                        className="trainer-form-modal__switch-input"
                        checked={tl.published}
                        onChange={(e) => setTl((s) => ({ ...s, published: e.target.checked }))}
                      />
                      <span className="trainer-form-modal__switch-track"><span className="trainer-form-modal__switch-thumb" /></span>
                      <span className="trainer-form-modal__switch-label">{tl.published ? 'Показывается' : 'Скрыт'}</span>
                    </label>
                  )}
                </div>

                {tlLoading ? (
                  <div className="trainer-form-modal__tl-loading">
                    <span className="trainer-form-modal__tl-spinner" aria-hidden />
                    Загрузка данных публичной страницы…
                  </div>
                ) : (
                  <>
                    <div className="trainer-form-modal__tl-cols">
                    <div className="trainer-form-modal__tl-group">
                      <span className="trainer-form-modal__tl-group-title">Профиль на сайте</span>
                      <div className="trainer-form-modal__tl-profile-fields">
                        <div className="enm__field">
                          <label className="enm__label"><Clock size={13} className="enm__label-icon" /> Тренерский стаж</label>
                          <input
                            className="enm__input"
                            placeholder="напр. 10 лет"
                            value={tl.experience}
                            onChange={(e) => setTl((s) => ({ ...s, experience: e.target.value }))}
                          />
                        </div>
                        <div className="enm__field">
                          <label className="enm__label"><AtSign size={13} className="enm__label-icon" /> Instagram</label>
                          <input
                            className="enm__input"
                            placeholder="username, без @"
                            value={tl.instagram}
                            onChange={(e) => setTl((s) => ({ ...s, instagram: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="trainer-form-modal__tl-group">
                      <span className="trainer-form-modal__tl-group-title">Описание</span>
                      <div className="enm__field">
                        <label className="enm__label"><MessageSquare size={13} className="enm__label-icon" /> Краткое (на карточке слайдера)</label>
                        <input
                          className="enm__input"
                          value={tl.shortBio}
                          onChange={(e) => setTl((s) => ({ ...s, shortBio: e.target.value }))}
                        />
                      </div>
                      <div className="enm__field">
                        <label className="enm__label"><FileText size={13} className="enm__label-icon" /> Полное (в детальном окне)</label>
                        <textarea
                          className="enm__input trainer-form-modal__textarea"
                          rows={3}
                          value={tl.bio}
                          onChange={(e) => setTl((s) => ({ ...s, bio: e.target.value }))}
                        />
                      </div>
                    </div>
                    </div>

                    {/* Достижения и видео — на всю ширину: в колонке они росли вниз
                        и оставляли соседнюю половину пустой. */}
                    <div className="trainer-form-modal__tl-group">
                      <span className="trainer-form-modal__tl-group-title">
                        <Trophy size={12} /> Достижения
                        <span className="trainer-form-modal__group-count">{tl.achievements.filter(Boolean).length} из {MAX_ACHIEVEMENTS}</span>
                      </span>
                      <div className="trainer-form-modal__achieve-grid">
                        {tl.achievements.map((a, ai) => (
                          <div key={ai} className="trainer-form-modal__achieve-row">
                            <span className="trainer-form-modal__achieve-num">{ai + 1}</span>
                            <input
                              className="enm__input"
                              placeholder={`Достижение ${ai + 1}`}
                              value={a}
                              onChange={(e) => setAchievement(ai, e.target.value)}
                            />
                            {tl.achievements.length > 1 && (
                              <button type="button" className="trainer-form-modal__achieve-del" onClick={() => removeAchievement(ai)} aria-label="Удалить достижение">
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {tl.achievements.length < MAX_ACHIEVEMENTS ? (
                        <button type="button" className="trainer-form-modal__add-btn" onClick={addAchievement}>
                          <Plus size={14} strokeWidth={2.5} /> Добавить достижение
                        </button>
                      ) : (
                        <span className="trainer-form-modal__limit-note">Максимум {MAX_ACHIEVEMENTS} достижений</span>
                      )}
                    </div>

                    <div className="trainer-form-modal__tl-group trainer-form-modal__tl-group--last">
                      <span className="trainer-form-modal__tl-group-title">
                        <Video size={12} /> Видео тренировок
                        <span className="trainer-form-modal__group-count">{filledVideos.length} из {MAX_VIDEOS}</span>
                      </span>
                      <div className="trainer-form-modal__videos-grid">
                        {visibleVideos.map(({ url, idx }, pos) => (
                          <VideoUpload
                            key={idx}
                            num={pos + 1}
                            value={url}
                            onChange={(v) => setVideo(idx, v)}
                            context="trainer-video"
                            backendEnabled={BACKEND_ENABLED}
                            uploadFile={uploadFile}
                            onUploadingChange={bumpTlUploading}
                          />
                        ))}
                      </div>
                      {filledVideos.length === MAX_VIDEOS && (
                        <span className="trainer-form-modal__limit-note">Максимум {MAX_VIDEOS} видео</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Доступ на сайт — отдельный блок с собственными кнопками: выдаётся
                не всегда вместе с созданием тренера, а часто отдельным решением
                позже. Кабинет тренера — «Мой отчёт»: свои ученики за месяц,
                кто оплатил, кто нет, кого потерял. */}
            {isEdit && (
              <div className="trainer-form-modal__access">
                <div className="trainer-form-modal__access-head">
                  <span className="trainer-form-modal__tl-title">
                    <KeyRound size={14} strokeWidth={2} /> Доступ на сайт
                  </span>
                  {account.hasAccount && (
                    <span className={`trainer-form-modal__access-badge${account.accountActive ? '' : ' trainer-form-modal__access-badge--off'}`}>
                      {account.accountActive ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                      {account.accountActive ? 'Включён' : 'Выключен'}
                    </span>
                  )}
                </div>

                {accError && <p className="enm__error" role="alert">{accError}</p>}

                {!account.hasAccount ? (
                  accMode === 'create' ? (
                    <div className="trainer-form-modal__access-form">
                      <div className="enm__field">
                        <label className="enm__label" htmlFor="trainer-acc-login">Логин</label>
                        <input
                          id="trainer-acc-login"
                          className="enm__input"
                          value={accLogin}
                          onChange={(e) => setAccLogin(e.target.value)}
                          placeholder="Например, фамилия латиницей"
                          autoFocus
                        />
                      </div>
                      <div className="enm__field">
                        <label className="enm__label" htmlFor="trainer-acc-password"><Lock size={13} className="enm__label-icon" /> Пароль</label>
                        <input
                          id="trainer-acc-password"
                          type="text"
                          className="enm__input"
                          value={accPassword}
                          onChange={(e) => setAccPassword(e.target.value)}
                          placeholder="Не короче 4 символов"
                        />
                      </div>
                      <div className="trainer-form-modal__access-actions">
                        <button type="button" className="ui-modal-btn" onClick={() => { setAccMode(null); setAccError(null); }} disabled={accSaving}>
                          Отмена
                        </button>
                        <button
                          type="button"
                          className="ui-modal-btn ui-modal-btn--primary"
                          onClick={handleCreateAccount}
                          disabled={accSaving || !accLogin.trim() || accPassword.length < 4}
                        >
                          {accSaving ? 'Сохранение…' : 'Выдать доступ'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="trainer-form-modal__access-empty">
                      <p>У тренера нет входа на сайт — он не увидит «Мой отчёт».</p>
                      <button type="button" className="trainer-form-modal__add-btn" onClick={() => setAccMode('create')}>
                        <Plus size={14} strokeWidth={2.5} /> Выдать доступ
                      </button>
                    </div>
                  )
                ) : (
                  <div className="trainer-form-modal__access-body">
                    <div className="trainer-form-modal__access-login">
                      <span className="trainer-form-modal__access-login-label">Логин</span>
                      <span className="trainer-form-modal__access-login-value">{account.accountLogin}</span>
                      <button type="button" className="trainer-form-modal__icon-btn" onClick={handleCopyLogin} title="Скопировать логин" aria-label="Скопировать логин">
                        <Copy size={13} />
                      </button>
                    </div>

                    {accMode === 'reset' ? (
                      <div className="trainer-form-modal__access-form">
                        <div className="enm__field">
                          <label className="enm__label" htmlFor="trainer-acc-new-password"><Lock size={13} className="enm__label-icon" /> Новый пароль</label>
                          <input
                            id="trainer-acc-new-password"
                            type="text"
                            className="enm__input"
                            value={accPassword}
                            onChange={(e) => setAccPassword(e.target.value)}
                            placeholder="Не короче 4 символов"
                            autoFocus
                          />
                        </div>
                        <div className="trainer-form-modal__access-actions">
                          <button type="button" className="ui-modal-btn" onClick={() => { setAccMode(null); setAccError(null); setAccPassword(''); }} disabled={accSaving}>
                            Отмена
                          </button>
                          <button
                            type="button"
                            className="ui-modal-btn ui-modal-btn--primary"
                            onClick={handleResetPassword}
                            disabled={accSaving || accPassword.length < 4}
                          >
                            {accSaving ? 'Сохранение…' : 'Сохранить пароль'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="trainer-form-modal__access-actions">
                        <button type="button" className="ui-modal-btn" onClick={() => setAccMode('reset')} disabled={accSaving}>
                          <Lock size={13} /> Сбросить пароль
                        </button>
                        <button
                          type="button"
                          className={`ui-modal-btn${account.accountActive ? ' ui-modal-btn--danger' : ' ui-modal-btn--primary'}`}
                          onClick={handleToggleActive}
                          disabled={accSaving}
                        >
                          {account.accountActive
                            ? <><ShieldOff size={13} /> Выключить доступ</>
                            : <><ShieldCheck size={13} /> Включить доступ</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="enm__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton
              loading={saving}
              disabled={tlUploading > 0}
              title={tlUploading > 0 ? 'Дождитесь загрузки файла' : undefined}
              className="ui-modal-btn ui-modal-btn--primary"
            >
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default TrainerFormModal;
