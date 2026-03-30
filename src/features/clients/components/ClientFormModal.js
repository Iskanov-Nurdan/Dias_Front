import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useToast } from '../../../app/providers/ToastProvider';
import { Select, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { isClientPaid } from '../../../shared/constants/common';
import { fetchTrainerSchedule } from '../../sports-trainers/api';
import {
  flattenScheduleToSlotOptions,
  matchClientToSlotKey,
  parseTrainingSlotKey,
} from '../../sports-trainers/scheduleConstants';
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
  const [trainingSlotKey, setTrainingSlotKey] = useState('');
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [scheduleSlotsLoading, setScheduleSlotsLoading] = useState(false);

  useEffect(() => {
    setTrainingSlotKey('');
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
    }
  }, [client]);

  useEffect(() => {
    if (!fetchTrainers) return;
    if (sportId) {
      fetchTrainers({ sportId }, null)
        .then((d) => {
          const list = d?.items ?? d?.results ?? (Array.isArray(d) ? d : []) ?? [];
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
  }, [sportId, fetchTrainers, toast]);

  useEffect(() => {
    if (!trainerId) {
      setScheduleSlots([]);
      setScheduleSlotsLoading(false);
      setTrainingSlotKey('');
      return undefined;
    }
    let cancelled = false;
    setScheduleSlotsLoading(true);
    fetchTrainerSchedule(trainerId, null)
      .then((data) => {
        if (cancelled) return;
        const options = flattenScheduleToSlotOptions(data);
        setScheduleSlots(options);
        setTrainingSlotKey((prev) =>
          prev && options.some((o) => String(o.value) === String(prev)) ? prev : ''
        );
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e.response?.status;
        if (status === 404) {
          setScheduleSlots([]);
        } else {
          setScheduleSlots([]);
          toast.error(
            e?.userMessage ??
              e?.response?.data?.error?.message ??
              e?.response?.data?.message ??
              'Не удалось загрузить график тренера'
          );
        }
        setTrainingSlotKey('');
      })
      .finally(() => {
        if (!cancelled) setScheduleSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId, toast]);

  useEffect(() => {
    if (!client?.id || !trainerId || scheduleSlots.length === 0) return;
    const cid = client.trainerId ?? client.trainer_id ?? client.trainer?.id;
    if (String(cid ?? '') !== String(trainerId)) return;
    const tw = client.trainingWeekday ?? client.training_weekday;
    const tf = normalizeTimeInput(client.trainingTimeFrom ?? client.training_time_from);
    const tt = normalizeTimeInput(client.trainingTimeTo ?? client.training_time_to);
    if (!tf && !tt && (tw == null || tw === '')) return;
    const key = matchClientToSlotKey(scheduleSlots, tw, tf, tt);
    if (key) setTrainingSlotKey(key);
  }, [
    client?.id,
    client?.trainerId,
    client?.trainer_id,
    client?.trainer,
    client?.trainingWeekday,
    client?.training_weekday,
    client?.trainingTimeFrom,
    client?.training_time_from,
    client?.trainingTimeTo,
    client?.training_time_to,
    scheduleSlots,
    trainerId,
  ]);

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
    const slot = parseTrainingSlotKey(trainingSlotKey);
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
      trainingWeekday: slot.trainingWeekday,
      trainingTimeFrom: slot.trainingTimeFrom,
      trainingTimeTo: slot.trainingTimeTo,
    });
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
              <Select value={String(sportId)} onChange={(v) => { setSportId(v); setTrainerId(''); setTrainingSlotKey(''); }} options={[{ value: '', label: '—' }, ...(sports || []).map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="—" className="client-form-modal__select" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Тренер</span>
              <Select
                value={String(trainerId)}
                onChange={(v) => {
                  setTrainerId(v);
                  setTrainingSlotKey('');
                }}
                options={[{ value: '', label: '—' }, ...(trainersList || []).map((t) => ({ value: String(t.id), label: t.fio || '' }))]}
                placeholder="—"
                className="client-form-modal__select"
              />
            </label>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">Время занятия</span>
                <Select
                  value={String(trainingSlotKey)}
                  onChange={(v) => setTrainingSlotKey(v)}
                  options={[
                    { value: '', label: scheduleSlotsLoading ? 'Загрузка…' : '—' },
                    ...scheduleSlots,
                  ]}
                  placeholder={scheduleSlotsLoading ? 'Загрузка…' : '—'}
                  disabled={!trainerId || scheduleSlotsLoading}
                  className="client-form-modal__select"
                />
                <span className="client-form-modal__field-hint">
                  {trainerId
                    ? scheduleSlots.length
                      ? 'Выберите слот из графика тренера (настраивается в разделе «Спорт и тренеры»).'
                      : scheduleSlotsLoading
                        ? 'Загрузка слотов…'
                        : 'У этого тренера нет интервалов в графике — настройте график в разделе «Спорт и тренеры».'
                    : 'Сначала выберите тренера.'}
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
  return createPortal(content, document.body);
};

export default ClientFormModal;
