import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../../app/providers/ToastProvider';
import { Select } from '../../../shared/ui';
import './LeadCardModal.scss';

const CHANNEL_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Другое' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'target', label: 'Реклама (таргет)' },
  { value: 'reels', label: 'Reels' },
  { value: 'stories', label: 'Stories' },
  { value: 'direct', label: 'Direct' },
  { value: 'post', label: 'Пост/лента' },
];

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'adult', label: 'Взрослый' },
  { value: 'children', label: 'Дети' },
];

const TRIAL_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'came', label: 'Пришли' },
  { value: 'rescheduled', label: 'Перенесли' },
  { value: 'no_contact', label: 'Не вышли на связь' },
  { value: 'rejected', label: 'Отказались' },
];

const RESULT_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'bought', label: 'Купили' },
  { value: 'thinking', label: 'Ушли подумать' },
  { value: 'rejected', label: 'Отказались' },
];

const STAGE_OPTIONS_PREFIX = [{ value: '', label: 'Не выбрано' }];

const LeadCardModal = ({ lead, stages = [], sports = [], trainers = [], onSave, onClose, error, saving, onLoadTrainers }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');
  const [source, setSource] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sportId, setSportId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [trainersList, setTrainersList] = useState([]);
  const [trialStatus, setTrialStatus] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [stageId, setStageId] = useState('');

  useEffect(() => {
    if (!lead) return;
    setName(lead.name ?? '');
    setPhone(lead.phone ?? '');
    setChannel(lead.channel ?? '');
    setSource(lead.source ?? '');
    setTargetType(lead.targetType ?? lead.target_type ?? '');
    setSportId(String(lead.sportId ?? lead.sport_id ?? lead.sport?.id ?? ''));
    setTrainerId(String(lead.trainerId ?? lead.trainer_id ?? lead.trainer?.id ?? lead.trainer?.pk ?? ''));
    setTrialStatus(lead.trialStatus ?? lead.trial_status ?? '');
    setResultStatus(lead.resultStatus ?? lead.result_status ?? '');
    setAmount(lead.amount != null ? String(lead.amount) : '');
    setComment(lead.comment ?? '');
    setStageId(String(lead.stageId ?? lead.stage_id ?? lead.stage?.id ?? ''));
  }, [lead]);

  const prevSportIdRef = React.useRef('');
  useEffect(() => {
    if (!onLoadTrainers) return;
    if (sportId) {
      onLoadTrainers(sportId)
        .then(setTrainersList)
        .catch((e) => {
          setTrainersList([]);
          toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки тренеров');
        });
      prevSportIdRef.current = sportId;
    } else {
      setTrainersList([]);
      if (prevSportIdRef.current) {
        setTrainerId('');
        prevSportIdRef.current = '';
      }
    }
  }, [sportId, onLoadTrainers]);

  const stageOptions = [
    ...STAGE_OPTIONS_PREFIX,
    ...stages.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const sportOptions = [
    { value: '', label: 'Не выбрано' },
    ...sports.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const trainerOptions = [
    { value: '', label: 'Не выбрано' },
    ...(trainersList.length > 0 ? trainersList : trainers ?? []).map((t) => ({
      value: String(t.id ?? t.pk ?? ''),
      label: t.fio ?? t.name ?? String(t.id ?? t.pk ?? ''),
    })),
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    const tid = trainerId ? Number(trainerId) : null;
    const sid = sportId ? Number(sportId) : null;
    onSave({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      channel: channel || undefined,
      source: source || undefined,
      targetType: targetType || undefined,
      sportId: sid,
      sport_id: sid,
      trainerId: tid,
      trainer_id: tid,
      trialStatus: trialStatus || undefined,
      resultStatus: resultStatus || undefined,
      amount: amount !== '' ? Number(amount) : undefined,
      comment: comment.trim() || undefined,
      stageId: stageId ? Number(stageId) : null,
    });
  };

  const createdAt = lead?.createdAt ?? lead?.created_at;

  const content = (
    <div className="lead-card-modal__backdrop" onClick={onClose}>
      <div className="lead-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lead-card-modal__head">
          <div>
            <h2 className="lead-card-modal__title">Карточка лида</h2>
            <p className="lead-card-modal__subtitle">Проверь данные клиента и обнови статусы после общения</p>
          </div>
          <button type="button" className="lead-card-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        {error && <p className="lead-card-modal__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="lead-card-modal__form">

          {/* ── Основное ── */}
          <section className="lead-card-modal__section">
            <h3 className="lead-card-modal__section-title">Основное</h3>
            <div className="lead-card-modal__grid">
              {createdAt && (
                <label className="lead-card-modal__label">
                  <span className="lead-card-modal__label-text">Дата заявки</span>
                  <input
                    type="text"
                    readOnly
                    value={new Date(createdAt).toLocaleDateString('ru-RU')}
                    className="lead-card-modal__input lead-card-modal__input--readonly"
                  />
                </label>
              )}
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Имя</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="lead-card-modal__input"
                  placeholder="Имя клиента"
                />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Телефон</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="lead-card-modal__input"
                  placeholder="+996 ..."
                />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Канал</span>
                <Select value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} placeholder="Не выбрано" className="lead-card-modal__select" />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Источник лида</span>
                <Select value={source} onChange={setSource} options={SOURCE_OPTIONS} placeholder="Не выбрано" className="lead-card-modal__select" />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Для себя или для детей</span>
                <Select value={targetType} onChange={setTargetType} options={TARGET_TYPE_OPTIONS} placeholder="Не выбрано" className="lead-card-modal__select" />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Вид спорта</span>
                <Select value={sportId} onChange={setSportId} options={sportOptions} placeholder="Не выбрано" className="lead-card-modal__select" />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Тренер</span>
                <Select value={trainerId} onChange={setTrainerId} options={trainerOptions} placeholder="Не выбрано" className="lead-card-modal__select" disabled={!sportId} />
              </label>
            </div>
          </section>

          {/* ── Этап воронки ── */}
          {stages.length > 0 && (
            <section className="lead-card-modal__section">
              <h3 className="lead-card-modal__section-title">Этап воронки</h3>
              <Select value={stageId} onChange={setStageId} options={stageOptions} placeholder="Не выбрано" className="lead-card-modal__select lead-card-modal__select--wide" />
            </section>
          )}

          {/* ── Статусы ── */}
          <section className="lead-card-modal__section">
            <h3 className="lead-card-modal__section-title">Статусы</h3>
            <div className="lead-card-modal__grid lead-card-modal__grid--2">
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Пробная тренировка</span>
                <Select value={trialStatus} onChange={setTrialStatus} options={TRIAL_OPTIONS} placeholder="Выбери статус" className="lead-card-modal__select" />
              </label>
              <label className="lead-card-modal__label">
                <span className="lead-card-modal__label-text">Результат</span>
                <Select value={resultStatus} onChange={setResultStatus} options={RESULT_OPTIONS} placeholder="Выбери результат" className="lead-card-modal__select" />
              </label>
            </div>
          </section>

          {/* ── Финансы и комментарии ── */}
          <section className="lead-card-modal__section">
            <h3 className="lead-card-modal__section-title">Финансы и комментарии</h3>
            <label className="lead-card-modal__label">
              <span className="lead-card-modal__label-text">Сумма</span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="lead-card-modal__input lead-card-modal__input--half"
                placeholder="0"
              />
            </label>
            <label className="lead-card-modal__label" style={{ marginTop: 12 }}>
              <span className="lead-card-modal__label-text">Комментарии и возражения</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="lead-card-modal__textarea"
                placeholder="Что говорил клиент, страхи, почему сомневается или купил..."
                rows={3}
              />
            </label>
          </section>

          <div className="lead-card-modal__actions">
            <button type="button" className="lead-card-modal__btn lead-card-modal__btn--cancel" onClick={onClose} disabled={saving}>Закрыть</button>
            <button type="submit" className="lead-card-modal__btn lead-card-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default LeadCardModal;
