import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useToast } from '../../../app/providers/ToastProvider';
import { Select, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { isClientPaid } from '../../../shared/constants/common';
import { TrainerScheduleModal } from '../../sports-trainers/components';
import { trainerMatchesTimeAcrossWeek } from '../../sports-trainers/scheduleConstants';
import './ClientFormModal.scss';

// Первая буква каждого слова — заглавная (работает для любого языка и вставленного текста)
const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
};

const isAutoCommentLine = (line) => {
  const t = (line || '').trim();
  return t.startsWith('Добавлен:') || t.startsWith('Скидка ');
};

const parseComment = (raw) => {
  const lines = (raw || '').split('\n');
  const auto = lines.filter((l) => isAutoCommentLine(l));
  const manual = lines.filter((l) => !isAutoCommentLine(l)).join('\n').trim();
  return { auto, manual };
};

const normalizeTimeInput = (v) => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
};

const ClientFormModal = ({ client, sports, fetchTrainers, currentUserFio, onSave, onClose, error, saving }) => {
  const toast = useToast();
  const firstInputRef = useRef(null);

  useModalEffect(true, onClose);

  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  const [fio, setFio] = useState('');
  const [phone, setPhone] = useState('');
  const [sportId, setSportId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [trainersList, setTrainersList] = useState([]);
  const [dateStart, setDateStart] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState(false);
  const [clientType, setClientType] = useState('regular');
  const [gender, setGender] = useState('');
  const [commentManual, setCommentManual] = useState('');
  const [commentAuto, setCommentAuto] = useState([]);
  const [trainingTimeFrom, setTrainingTimeFrom] = useState('');
  const [trainingTimeTo, setTrainingTimeTo] = useState('');
  const [scheduleModalTrainer, setScheduleModalTrainer] = useState(null);

  useEffect(() => {
    if (client) {
      setFio(capitalizeWords(client.fio || ''));
      setPhone(client.phone || '');
      setSportId(client.sportId ?? client.sport_id ?? client.sport?.id ?? '');
      setTrainerId(client.trainerId ?? client.trainer_id ?? client.trainer?.id ?? '');
      setDateStart(client.dateStart ? client.dateStart.slice(0, 10) : '');
      setPrice(client.price ?? '');
      setDiscount(client.discount ?? '');
      setPaid(isClientPaid(client));
      setClientType(client.clientType || client.client_type || 'regular');
      setGender(client.gender || '');
      const { auto, manual } = parseComment(client.comment);
      setCommentAuto(auto);
      setCommentManual(manual);
      setTrainingTimeFrom(normalizeTimeInput(client.trainingTimeFrom ?? client.training_time_from));
      setTrainingTimeTo(normalizeTimeInput(client.trainingTimeTo ?? client.training_time_to));
    } else {
      setTrainingTimeFrom('');
      setTrainingTimeTo('');
    }
  }, [client]);

  useEffect(() => {
    if (!fetchTrainers) return;
    if (sportId) {
      const params = { sportId };
      if (trainingTimeFrom) params.timeFrom = trainingTimeFrom;
      if (trainingTimeTo) params.timeTo = trainingTimeTo;
      fetchTrainers(params, null)
        .then((d) => {
          let list = d?.items ?? d?.results ?? (Array.isArray(d) ? d : []) ?? [];
          const hasSchedule = list.some(
            (t) => t.schedule ?? t.work_schedule ?? t.workSchedule
          );
          if (hasSchedule && (trainingTimeFrom || trainingTimeTo)) {
            list = list.filter((t) =>
              trainerMatchesTimeAcrossWeek(t, trainingTimeFrom, trainingTimeTo)
            );
          }
          setTrainersList(list);
          setTrainerId((prev) => {
            if (!prev) return prev;
            return list.some((t) => String(t.id) === String(prev)) ? prev : '';
          });
        })
        .catch((e) => {
          setTrainersList([]);
          toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки тренеров');
        });
    } else {
      setTrainersList([]);
      setTrainerId('');
    }
  }, [sportId, fetchTrainers, trainingTimeFrom, trainingTimeTo, toast]);

  const priceBase = Number(price) || 0;
  const discountPct = Number(discount) || 0;
  const priceAfterDiscount = discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase;
  const formatSum = (v) => (v != null && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} сом` : '—');

  const handleSubmit = (e) => {
    e.preventDefault();
    const autoLines = [...commentAuto];
    if (!client?.id && currentUserFio) {
      const addedLine = `Добавлен: ${currentUserFio}`;
      if (!autoLines.some((l) => l.trim().startsWith('Добавлен:'))) autoLines.push(addedLine);
    }
    const discountLine = discountPct > 0 && priceBase > 0
      ? `Скидка ${discountPct}%. До: ${formatSum(priceBase)}. После: ${formatSum(priceAfterDiscount)}.`
      : '';
    const autoWithoutDiscount = autoLines.filter((l) => !l.trim().startsWith('Скидка'));
    if (discountLine) autoWithoutDiscount.push(discountLine);
    const manualPart = (commentManual || '').trim();
    const finalComment = [...autoWithoutDiscount, manualPart].filter(Boolean).join('\n').trim() || undefined;
    // При очистке комментария явно отправляем "" — иначе PATCH без поля не обновляет его на бэкенде
    const commentValue = finalComment ?? (client?.id ? '' : undefined);
    onSave({
      fio,
      phone,
      sportId: sportId || undefined,
      trainerId: trainerId || undefined,
      dateStart: dateStart || undefined,
      price: price ? Number(price) : undefined,
      discount: discount ? Number(discount) : undefined,
      paid,
      clientType,
      gender: gender || undefined,
      comment: commentValue,
      trainingTimeFrom: trainingTimeFrom || undefined,
      trainingTimeTo: trainingTimeTo || undefined,
    });
  };

  const openTrainerSchedule = () => {
    if (!trainerId) return;
    const t = trainersList.find((x) => String(x.id) === String(trainerId));
    setScheduleModalTrainer({ id: Number(trainerId), fio: t?.fio || '' });
  };

  const content = (
    <div className="client-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="client-form-modal-title">
      <div className="client-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="client-form-modal__header">
          <h2 id="client-form-modal-title" className="client-form-modal__title">{client?.id ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
          <button type="button" className="client-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="client-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="client-form-modal__form">
          <div className="client-form-modal__section">
            <h3 className="client-form-modal__section-title">Личные данные</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">ФИО <span className="form-label-required" aria-hidden="true">*</span></span>
                <input ref={firstInputRef} type="text" value={fio} onChange={(e) => setFio(capitalizeWords(e.target.value))} required className="client-form-modal__input" />
              </label>
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Телефон</span>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="client-form-modal__input" />
              </label>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Пол</span>
                <Select value={gender} onChange={setGender} options={[{ value: '', label: '—' }, { value: 'male', label: 'М' }, { value: 'female', label: 'Ж' }]} placeholder="—" className="client-form-modal__select" />
              </label>
              <div />
            </div>
          </div>
          <div className="client-form-modal__section">
            <h3 className="client-form-modal__section-title">Абонемент</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Вид спорта</span>
              <Select value={String(sportId)} onChange={(v) => { setSportId(v); setTrainerId(''); }} options={[{ value: '', label: '—' }, ...(sports || []).map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="—" className="client-form-modal__select" />
            </label>
            <div className="client-form-modal__label client-form-modal__label--trainer-wrap">
              <span className="client-form-modal__label-text">Тренер</span>
              <div className="client-form-modal__trainer-row">
                <Select
                  value={String(trainerId)}
                  onChange={(v) => setTrainerId(v)}
                  options={[{ value: '', label: '—' }, ...(trainersList || []).map((t) => ({ value: String(t.id), label: t.fio || '' }))]}
                  placeholder="—"
                  className="client-form-modal__select client-form-modal__select--trainer"
                />
                <button
                  type="button"
                  className="client-form-modal__schedule-btn"
                  onClick={openTrainerSchedule}
                  disabled={!trainerId}
                  title={!trainerId ? 'Сначала выберите тренера' : 'Показать график'}
                >
                  График
                </button>
              </div>
            </div>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">Время занятия</span>
                <div className="client-form-modal__time-range">
                  <input
                    type="time"
                    value={trainingTimeFrom}
                    onChange={(e) => setTrainingTimeFrom(e.target.value)}
                    className="client-form-modal__input client-form-modal__input--time"
                    title="С"
                  />
                  <span className="client-form-modal__time-sep">—</span>
                  <input
                    type="time"
                    value={trainingTimeTo}
                    onChange={(e) => setTrainingTimeTo(e.target.value)}
                    className="client-form-modal__input client-form-modal__input--time"
                    title="До"
                  />
                </div>
                <span className="client-form-modal__field-hint">
                  Необязательно. Список тренеров сузится по графику: время должно попадать в слот хотя бы в один из дней недели.
                </span>
              </label>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Дата начала</span>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="client-form-modal__input" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Цена</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="client-form-modal__input" placeholder="0" />
            </label>
            </div>
          </div>
          <div className="client-form-modal__section">
            <h3 className="client-form-modal__section-title">Оплата</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Скидка, %</span>
              <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} className="client-form-modal__input" placeholder="0" />
            </label>
            <div className="client-form-modal__label client-form-modal__label--toggle">
              <span className="client-form-modal__label-text">Оплачено</span>
              <div className="client-form-modal__paid-toggle" role="group" aria-label="Статус оплаты">
                <button type="button" className={`client-form-modal__paid-option ${paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(true)}>Да</button>
                <button type="button" className={`client-form-modal__paid-option ${!paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(false)}>Нет</button>
              </div>
            </div>
            </div>
            {priceBase > 0 && (
            <div className="client-form-modal__price-summary">
              <div className="client-form-modal__price-row">
                <span>До скидки</span>
                <strong>{formatSum(priceBase)}</strong>
              </div>
              {discountPct > 0 && (
                <div className="client-form-modal__price-row client-form-modal__price-row--discount">
                  <span>Со скидкой ({discountPct}%)</span>
                  <strong>{formatSum(priceAfterDiscount)}</strong>
                </div>
              )}
            </div>
            )}
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Тип</span>
                <Select value={clientType} onChange={setClientType} options={[{ value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }, { value: 'one-time', label: 'Разовый' }]} className="client-form-modal__select" />
              </label>
              <div />
            </div>
          </div>
          <div className="client-form-modal__section">
            <h3 className="client-form-modal__section-title">Комментарий</h3>
          <div className="client-form-modal__label client-form-modal__label--full">
            <div className="client-form-modal__comment-header">
              <span className="client-form-modal__label-text">Комментарий</span>
              {(commentAuto.length > 0 || commentManual.trim()) && (
                <button type="button" className="client-form-modal__comment-clear" onClick={() => { setCommentManual(''); setCommentAuto([]); }}>Очистить всё</button>
              )}
            </div>
            {commentAuto.length > 0 && (
              <div className="client-form-modal__comment-auto" aria-readonly="true">
                {commentAuto.map((line, i) => (
                  <div key={i} className="client-form-modal__comment-auto-line">{line}</div>
                ))}
              </div>
            )}
            <textarea value={commentManual} onChange={(e) => setCommentManual(e.target.value)} className="client-form-modal__input" rows={2} placeholder="Комментарий" />
          </div>
          </div>
          <div className="client-form-modal__actions">
            <button type="button" className="client-form-modal__btn client-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="client-form-modal__btn client-form-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return (
    <>
      {createPortal(content, document.body)}
      {scheduleModalTrainer?.id && (
        <TrainerScheduleModal
          trainer={scheduleModalTrainer}
          readOnly
          onClose={() => setScheduleModalTrainer(null)}
        />
      )}
    </>
  );
};

export default ClientFormModal;
