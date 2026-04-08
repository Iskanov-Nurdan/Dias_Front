import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useToast } from '../../../app/providers/ToastProvider';
import { Select, SubmitButton, ConfirmModal } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import { isPeriodClosedError } from '../../../shared/lib/apiError';
import {
  createOneTimePayment,
  deleteClientPhoto,
  deleteOneTimePayment,
  fetchClientOneTimePayments,
  fetchClientPhotos,
} from '../api';
import { CLIENT_PHOTO_KIND_OPTIONS, getClientPhotoKindLabel } from '../lib/clientPhotos';
import { fetchTrainerSchedule } from '../../sports-trainers/api';
import {
  flattenScheduleToSlotOptions,
  matchClientToSlotKey,
  parseTrainingSlotKey,
} from '../../sports-trainers/scheduleConstants';
import {
  buildActualPaymentsPayload,
  emptyInstallmentRow,
  getInitialInstallmentRows,
  getPriceFieldInitialForForm,
} from '../lib/clientActualPayments';
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

const MOBILE_FORM_MQ = '(max-width: 768px)';

const ClientFormModal = ({ client, sports, fetchTrainers, currentUserFio, onSave, onClose, error, saving, fullscreen = false }) => {
  const toast = useToast();
  const firstInputRef = useRef(null);
  const [isMobileFormLayout, setIsMobileFormLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_FORM_MQ).matches,
  );

  useModalEffect(true, onClose);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_FORM_MQ);
    const sync = () => setIsMobileFormLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
  const [installments, setInstallments] = useState(() => [emptyInstallmentRow()]);
  const [clientType, setClientType] = useState(
    () => client?.clientType || client?.client_type || 'regular',
  );
  const [gender, setGender] = useState('');
  const [commentManual, setCommentManual] = useState('');
  const [commentAuto, setCommentAuto] = useState([]);
  const [trainingSlotKey, setTrainingSlotKey] = useState('');
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [scheduleSlotsLoading, setScheduleSlotsLoading] = useState(false);
  const [oneTimePayments, setOneTimePayments] = useState([]);
  const [oneTimeLoading, setOneTimeLoading] = useState(false);
  const [oneTimeNewAmount, setOneTimeNewAmount] = useState('');
  const [oneTimeAdding, setOneTimeAdding] = useState(false);
  const [confirmDeleteOneTime, setConfirmDeleteOneTime] = useState(null);
  const [deletingOneTimeId, setDeletingOneTimeId] = useState(null);

  const photoInputRef = useRef(null);
  const [serverPhotos, setServerPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoDeletingId, setPhotoDeletingId] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [defaultPhotoKind, setDefaultPhotoKind] = useState('receipt');

  useEffect(() => {
    if (!client?.id || clientType !== 'one-time') {
      setOneTimePayments([]);
      setOneTimeLoading(false);
      setOneTimeNewAmount('');
      return undefined;
    }
    let cancelled = false;
    setOneTimeLoading(true);
    fetchClientOneTimePayments(client.id, null)
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? res?.results ?? res?.data ?? [];
        setOneTimePayments(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setOneTimePayments([]);
      })
      .finally(() => {
        if (!cancelled) setOneTimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.id, clientType]);

  useEffect(() => {
    if (clientType !== 'one-time') setConfirmDeleteOneTime(null);
  }, [clientType]);

  useEffect(() => {
    return () => {
      pendingPhotos.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [pendingPhotos]);

  /** Только смена клиента (id / новая карточка), не каждый новый объект-ссылка — иначе поле цены постоянно сбрасывается и кажется «нерабочим». */
  const clientFormSyncKey = client?.id != null && client?.id !== '' ? String(client.id) : 'new';

  useEffect(() => {
    setPendingPhotos([]);
    setServerPhotos([]);
    if (!client?.id) {
      setPhotosLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPhotosLoading(true);
    fetchClientPhotos(client.id, null)
      .then((res) => {
        if (!cancelled) setServerPhotos(res?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setServerPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientFormSyncKey, client?.id]);

  useEffect(() => {
    if (!client) return;
    setTrainingSlotKey('');
    setFio(capitalizeWords(client.fio || ''));
    setPhone(client.phone || '');
    setSportId(client.sportId ?? client.sport_id ?? client.sport?.id ?? '');
    setTrainerId(client.trainerId ?? client.trainer_id ?? client.trainer?.id ?? '');
    setDateStart(client.dateStart ? client.dateStart.slice(0, 10) : '');
    setPrice(getPriceFieldInitialForForm(client));
    setDiscount(client.discount ?? '');
    setPaid(isClientPaid(client));
    setInstallments(getInitialInstallmentRows(client));
    setClientType(client.clientType || client.client_type || 'regular');
    setGender(client.gender || '');
    const { auto, manual } = parseComment(client.comment);
    setCommentAuto(auto);
    setCommentManual(manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно не [client]: см. clientFormSyncKey
  }, [clientFormSyncKey]);

  useEffect(() => {
    if (!fetchTrainers) return;
    if (sportId) {
      fetchTrainers({ sportId, includeSchedule: true, perPage: 500 }, null)
        .then((d) => {
          let list = d?.items ?? d?.results ?? (Array.isArray(d) ? d : []) ?? [];
          const tid = client?.trainerId ?? client?.trainer_id ?? client?.trainer?.id;
          if (tid != null && tid !== '' && !list.some((t) => String(t.id) === String(tid))) {
            const tr = client?.trainer;
            if (tr && String(tr.id) === String(tid)) {
              list = [...list, { ...tr, id: tr.id, fio: tr.fio ?? tr.name ?? '' }];
            }
          }
          setTrainersList(list);
          setTrainerId((prev) => {
            if (!prev) return prev;
            if (list.some((t) => String(t.id) === String(prev))) return prev;
            return prev;
          });
        })
        .catch((e) => {
          setTrainersList([]);
          toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки тренеров');
        });
    } else {
      setTrainersList([]);
      // Не вызывать setTrainerId('') здесь: на первом кадре sportId ещё пустой, а следующий эффект [client]
      // уже выставил trainerId — иначе получаем гонку и сброс тренера/слота. Обнуление при смене вида спорта — в onChange у Select.
    }
    // merge использует client.trainer из замыкания; id тренера в deps достаточно при смене карточки
    // eslint-disable-next-line react-hooks/exhaustive-deps -- см. выше
  }, [sportId, fetchTrainers, toast, client?.id, client?.trainerId, client?.trainer_id, client?.trainer?.id]);

  useEffect(() => {
    if (!trainerId) {
      setScheduleSlots([]);
      setScheduleSlotsLoading(false);
      setTrainingSlotKey('');
      return undefined;
    }

    const trainer = trainersList.find((x) => String(x.id) === String(trainerId));
    const embedded = trainer?.schedule;
    if (trainer && embedded != null && typeof embedded === 'object') {
      const options = flattenScheduleToSlotOptions(embedded);
      setScheduleSlots(options);
      setScheduleSlotsLoading(false);
      setTrainingSlotKey((prev) =>
        prev && options.some((o) => String(o.value) === String(prev)) ? prev : ''
      );
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
        setScheduleSlots([]);
        toast.error(
          e?.userMessage ??
            e?.response?.data?.error?.message ??
            e?.response?.data?.message ??
            'Не удалось загрузить график тренера'
        );
        setTrainingSlotKey('');
      })
      .finally(() => {
        if (!cancelled) setScheduleSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId, trainersList, toast]);

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

  const discountPct = Number(discount) || 0;
  const priceInputNum = Number(price);
  const rawPriceInput = Number.isFinite(priceInputNum) ? priceInputNum : 0;
  const discountFactor = discountPct >= 100 ? 0 : 1 - discountPct / 100;

  /**
   * Поле «цена»: при скидке > 0 вводим сумму со скидкой (как «Цена» в карточке).
   * На сервер уходит договорная сумма до скидки (price).
   */
  let contractBaseAmount;
  let amountAfterDiscount;
  if (discountPct > 0 && discountFactor > 0) {
    amountAfterDiscount = rawPriceInput;
    contractBaseAmount = Math.round(amountAfterDiscount / discountFactor);
  } else if (discountPct > 0) {
    amountAfterDiscount = 0;
    contractBaseAmount = rawPriceInput;
  } else {
    contractBaseAmount = rawPriceInput;
    amountAfterDiscount = rawPriceInput;
  }

  const formatSum = (v) => (v != null && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} сом` : '—');

  const trainingSlotHint = trainerId
    ? scheduleSlots.length
      ? 'Выберите слот из графика тренера (настраивается в разделе «Спорт и тренеры»).'
      : scheduleSlotsLoading
        ? 'Загрузка слотов…'
        : 'У этого тренера нет интервалов в графике — настройте график в разделе «Спорт и тренеры».'
    : 'Сначала выберите тренера.';

  const addInstallmentRow = () => {
    setInstallments((prev) => [...prev, emptyInstallmentRow()]);
  };

  const removeInstallmentRow = (key) => {
    setInstallments((prev) => {
      if (prev.length <= 1) return [emptyInstallmentRow()];
      return prev.filter((r) => r._key !== key);
    });
  };

  const updateInstallment = (key, field, value) => {
    setInstallments((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  };

  const reloadOneTimePayments = async (clientId) => {
    if (!clientId) return;
    try {
      const res = await fetchClientOneTimePayments(clientId, null);
      const items = res?.items ?? res?.results ?? res?.data ?? [];
      setOneTimePayments(Array.isArray(items) ? items : []);
    } catch {
      setOneTimePayments([]);
    }
  };

  /** Дельта к договорной сумме до скидки; в поле ввода отображаем итог со скидкой, если скидка есть. */
  const applySubscriptionPriceDeltaLocal = (deltaSom) => {
    if (!Number.isFinite(deltaSom) || deltaSom === 0) return;
    const d = Number(discount) || 0;
    const factor = d >= 100 ? 0 : 1 - d / 100;
    setPrice((prev) => {
      const cur = Number(prev);
      const curSafe = Number.isFinite(cur) ? cur : 0;
      if (d > 0 && factor > 0) {
        const base = Math.round(curSafe / factor);
        const newBase = Math.max(0, base + Math.round(deltaSom));
        return String(Math.round(newBase * factor));
      }
      return String(Math.max(0, Math.round(curSafe + deltaSom)));
    });
  };

  const handleDiscountChange = (e) => {
    const raw = e.target.value;
    const nextNum = raw === '' ? 0 : Math.min(100, Math.max(0, Number(raw)));
    const prevNum = Number(discount) || 0;
    const p = Number(price);
    const pSafe = Number.isFinite(p) ? p : 0;

    if (prevNum > 0 && nextNum === 0) {
      const f = 1 - prevNum / 100;
      setPrice(f > 0 && pSafe > 0 ? String(Math.round(pSafe / f)) : String(pSafe));
    } else if (prevNum === 0 && nextNum > 0) {
      const f = 1 - nextNum / 100;
      setPrice(f > 0 ? String(Math.round(pSafe * f)) : String(pSafe));
    } else if (prevNum > 0 && nextNum > 0 && prevNum !== nextNum) {
      const fOld = 1 - prevNum / 100;
      const base = fOld > 0 && pSafe > 0 ? Math.round(pSafe / fOld) : pSafe;
      const fNew = 1 - nextNum / 100;
      setPrice(fNew > 0 ? String(Math.round(base * fNew)) : String(base));
    }
    setDiscount(raw === '' ? '' : String(nextNum));
  };

  const handleAddOneTimePayment = async () => {
    const cid = client?.id;
    if (!cid) return;
    const n = Number(String(oneTimeNewAmount).trim());
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Укажите сумму больше ноля');
      return;
    }
    setOneTimeAdding(true);
    try {
      await createOneTimePayment(cid, { amount: n }, null);
      setOneTimeNewAmount('');
      await reloadOneTimePayments(cid);
      applySubscriptionPriceDeltaLocal(n);
      toast.success(
        `Доплата ${n.toLocaleString('ru-RU')} сом на сервере. Нажмите «Сохранить», чтобы записать цену абонемента.`
      );
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (e.response?.data?.error?.message ?? e.response?.data?.message ?? e.message ?? 'Ошибка');
      toast.error(msg);
    } finally {
      setOneTimeAdding(false);
    }
  };

  const handleDeleteOneTimePayment = async (payment) => {
    const cid = client?.id;
    if (!cid || !payment?.id) return;
    const removed = Number(payment.amount);
    const delta = Number.isFinite(removed) && removed > 0 ? -Math.round(removed) : 0;
    setConfirmDeleteOneTime(null);
    setDeletingOneTimeId(payment.id);
    try {
      await deleteOneTimePayment(cid, payment.id, null);
      setOneTimePayments((prev) => prev.filter((p) => p.id !== payment.id));
      applySubscriptionPriceDeltaLocal(delta);
      toast.success('Доплата удалена. Нажмите «Сохранить», чтобы записать цену абонемента.');
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (e.response?.data?.error?.message ?? e.response?.data?.message ?? e.message ?? 'Ошибка удаления');
      toast.error(msg);
    } finally {
      setDeletingOneTimeId(null);
    }
  };

  const handlePhotoFilesChange = (e) => {
    const fl = e.target.files;
    if (!fl?.length) return;
    const next = Array.from(fl).map((file) => ({
      _key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      kind: defaultPhotoKind,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingPhotos((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removePendingPhoto = (_key) => {
    setPendingPhotos((prev) => {
      const row = prev.find((x) => x._key === _key);
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((x) => x._key !== _key);
    });
  };

  const updatePendingPhotoKind = (_key, kind) => {
    setPendingPhotos((prev) => prev.map((x) => (x._key === _key ? { ...x, kind } : x)));
  };

  const handleDeleteServerPhoto = async (photo) => {
    const cid = client?.id;
    if (!cid || !photo?.id) return;
    setPhotoDeletingId(photo.id);
    try {
      await deleteClientPhoto(cid, photo.id, null);
      setServerPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast.success('Фото удалено');
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ??
          err?.response?.data?.message ??
          err?.message ??
          'Не удалось удалить фото'
      );
    } finally {
      setPhotoDeletingId(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const built = buildActualPaymentsPayload(installments);
    if (!built.ok) {
      toast.error(built.message);
      return;
    }
    const autoLines = [...commentAuto];
    if (!client?.id && currentUserFio) {
      const addedLine = `Добавлен: ${currentUserFio}`;
      if (!autoLines.some((l) => l.trim().startsWith('Добавлен:'))) autoLines.push(addedLine);
    }
    const priceTrim = String(price).trim();
    const hasPriceField = priceTrim !== '' && Number.isFinite(Number(priceTrim));
    const discountLine = discountPct > 0 && contractBaseAmount > 0
      ? `Скидка ${discountPct}%. До: ${formatSum(contractBaseAmount)}. После: ${formatSum(amountAfterDiscount)}.`
      : '';
    const autoWithoutDiscount = autoLines.filter((l) => !l.trim().startsWith('Скидка'));
    if (discountLine) autoWithoutDiscount.push(discountLine);
    const manualPart = (commentManual || '').trim();
    const finalComment = [...autoWithoutDiscount, manualPart].filter(Boolean).join('\n').trim() || undefined;
    // При очистке комментария явно отправляем "" — иначе PATCH без поля не обновляет его на бэкенде
    const commentValue = finalComment ?? (client?.id ? '' : undefined);
    const slot = parseTrainingSlotKey(trainingSlotKey);
    /** null — бэкенд обнуляет training_* при PATCH (пустой слот). */
    const trainingPayload = trainingSlotKey
      ? {
          trainingWeekday: slot.trainingWeekday,
          trainingTimeFrom: slot.trainingTimeFrom,
          trainingTimeTo: slot.trainingTimeTo,
        }
      : {
          trainingWeekday: null,
          trainingTimeFrom: null,
          trainingTimeTo: null,
        };
    const paymentsPayload = {};
    if (client?.id) {
      paymentsPayload.actualPayments = built.payload;
      paymentsPayload.actualPaymentDate = null;
    } else if (built.payload.length > 0) {
      paymentsPayload.actualPayments = built.payload;
    }

    const photoUploads = pendingPhotos.map(({ file, kind }) => ({ file, kind })).filter((x) => x.file);

    onSave({
      fio,
      phone,
      sportId: sportId || undefined,
      trainerId: trainerId || undefined,
      dateStart: dateStart || undefined,
      price: hasPriceField ? contractBaseAmount : undefined,
      discount: discount ? Number(discount) : undefined,
      paid,
      ...paymentsPayload,
      clientType,
      gender: gender || undefined,
      comment: commentValue,
      ...trainingPayload,
      ...(photoUploads.length > 0 ? { photoUploads } : {}),
    });
  };

  const content = (
    <div
      className={`client-form-modal__backdrop${fullscreen ? ' client-form-modal__backdrop--fullscreen' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-modal-title"
    >
      <div className={`client-form-modal${fullscreen ? ' client-form-modal--fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="client-form-modal__header">
          <h2 id="client-form-modal-title" className="client-form-modal__title">{client?.id ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
          <button type="button" className="client-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="client-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="client-form-modal__form">
          <div className="client-form-modal__scroll">
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
            {!isMobileFormLayout && (
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Пол</span>
                <Select value={gender} onChange={setGender} options={[{ value: '', label: '—' }, { value: 'male', label: 'М' }, { value: 'female', label: 'Ж' }]} placeholder="—" className="client-form-modal__select" />
              </label>
              <div />
            </div>
            )}
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
                {!fullscreen && (
                  <span className="client-form-modal__field-hint client-form-modal__hint--desktop-only">
                    {trainingSlotHint}
                  </span>
                )}
              </label>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">Дата начала</span>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="client-form-modal__input" />
              </label>
            </div>
          </div>
          <div className="client-form-modal__section">
            <h3 className="client-form-modal__section-title">Оплата</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">
                  {discountPct > 0 ? 'К оплате (со скидкой), сом' : 'Цена абонемента, сом'}
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="client-form-modal__input"
                  placeholder="0"
                  min="0"
                  step="1"
                  autoComplete="off"
                  inputMode="numeric"
                />
                {!fullscreen && (
                  <span className="client-form-modal__field-hint client-form-modal__hint--desktop-only">
                    {discountPct > 0
                      ? 'Та же сумма, что «Цена» в карточке. Ниже — договорная до скидки. Частичные взносы отдельно.'
                      : 'Общая стоимость по договору — для скидки и отображения. Частичные взносы ниже.'}
                  </span>
                )}
              </label>
            </div>

            <div className="client-form-modal__installments">
              <div className="client-form-modal__installments-header">
                <span className="client-form-modal__installments-title">Частичные оплаты</span>
                {!fullscreen && <span className="client-form-modal__optional">необязательно</span>}
              </div>
              {!fullscreen && (
                <p className="client-form-modal__installments-hint">
                  Несколько платежей (например, долями): у каждой строки — сумма и день фактической оплаты. Попадает в отчёт «Записи по дням».
                </p>
              )}
              <div className="client-form-modal__installments-grid client-form-modal__installments-grid--head" aria-hidden>
                <span>Сумма, сом</span>
                <span>Дата оплаты</span>
                <span className="client-form-modal__installments-actions-head" />
              </div>
              {installments.map((row) => (
                <div key={row._key} className="client-form-modal__installments-grid">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.amount}
                    onChange={(e) => updateInstallment(row._key, 'amount', e.target.value)}
                    className="client-form-modal__input"
                    placeholder="0"
                    aria-label="Сумма частичной оплаты"
                  />
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateInstallment(row._key, 'date', e.target.value)}
                    className="client-form-modal__input"
                    aria-label="Дата частичной оплаты"
                  />
                  <div className="client-form-modal__installment-remove-wrap">
                    <button
                      type="button"
                      className="client-form-modal__installment-remove"
                      onClick={() => removeInstallmentRow(row._key)}
                      aria-label="Удалить строку оплаты"
                      title="Удалить строку"
                    >
                      <Trash2 size={18} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="client-form-modal__installment-add" onClick={addInstallmentRow}>
                <Plus size={18} strokeWidth={1.75} aria-hidden />
                Добавить платёж
              </button>
            </div>

            {client?.id && clientType === 'one-time' ? (
              <div className="client-form-modal__installments client-form-modal__onetime-wrap">
                <div className="client-form-modal__installments-header">
                  <span className="client-form-modal__installments-title">Разовые доплаты</span>
                </div>
                {!fullscreen && (
                  <p className="client-form-modal__installments-hint">
                    Доплаты по месяцам (как на вкладке «Разовый»). Добавление и удаление строки доплаты сразу уходит на сервер. Поле суммы к оплате / абонемента подстраиваем только в форме; чтобы записать на сервер, нажмите «Сохранить» внизу окна.
                  </p>
                )}
                {oneTimeLoading && oneTimePayments.length === 0 ? (
                  <p className="client-form-modal__onetime-loading">Загрузка…</p>
                ) : null}
                {oneTimePayments.map((p) => (
                  <div key={p.id} className="client-form-modal__onetime-row">
                    <span className="client-form-modal__onetime-amount">{formatMoney(p.amount)}</span>
                    <span className="client-form-modal__onetime-date">
                      {p.date ? new Date(p.date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <div className="client-form-modal__installment-remove-wrap">
                      <button
                        type="button"
                        className="client-form-modal__installment-remove"
                        onClick={() => setConfirmDeleteOneTime(p)}
                        disabled={deletingOneTimeId === p.id}
                        aria-label="Удалить разовую доплату"
                        title="Удалить"
                      >
                        <Trash2 size={18} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="client-form-modal__onetime-add-row">
                  <label className="client-form-modal__onetime-add-label">
                    <span className="client-form-modal__onetime-add-label-text">Сумма, сом</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={oneTimeNewAmount}
                      onChange={(e) => setOneTimeNewAmount(e.target.value)}
                      className="client-form-modal__input"
                      placeholder="0"
                      disabled={oneTimeAdding}
                    />
                  </label>
                  <button
                    type="button"
                    className="client-form-modal__onetime-add-btn"
                    onClick={handleAddOneTimePayment}
                    disabled={oneTimeAdding}
                  >
                    Добавить доплату
                  </button>
                </div>
              </div>
            ) : null}

            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Скидка, %</span>
              <input type="number" min="0" max="100" value={discount} onChange={handleDiscountChange} className="client-form-modal__input" placeholder="0" />
            </label>
            <div className="client-form-modal__label client-form-modal__label--toggle">
              <span className="client-form-modal__label-text">Оплачено</span>
              <div className="client-form-modal__paid-toggle" role="group" aria-label="Статус оплаты">
                <button type="button" className={`client-form-modal__paid-option ${paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(true)}>Да</button>
                <button type="button" className={`client-form-modal__paid-option ${!paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(false)}>Нет</button>
              </div>
            </div>
            </div>
            {(contractBaseAmount > 0 || rawPriceInput > 0) && (
            <div className="client-form-modal__price-summary">
              <div className="client-form-modal__price-row">
                <span>До скидки</span>
                <strong>{formatSum(contractBaseAmount)}</strong>
              </div>
              {discountPct > 0 && (
                <div className="client-form-modal__price-row client-form-modal__price-row--discount">
                  <span>Со скидкой ({discountPct}%)</span>
                  <strong>{formatSum(amountAfterDiscount)}</strong>
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
            <h3 className="client-form-modal__section-title">Фото для сверки</h3>
            {!fullscreen && (
              <p className="client-form-modal__photos-hint">
                Чеки и наличные — неограниченное число снимков. Новые файлы отправляются на сервер при нажатии «Сохранить» (сначала карточка, затем фото).
              </p>
            )}
            <div className="client-form-modal__row client-form-modal__row--photos-toolbar">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Тип для новых фото</span>
                <Select
                  value={defaultPhotoKind}
                  onChange={setDefaultPhotoKind}
                  options={CLIENT_PHOTO_KIND_OPTIONS}
                  className="client-form-modal__select"
                />
              </label>
              <div className="client-form-modal__photos-add-wrap">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="client-form-modal__photos-file-input"
                  onChange={handlePhotoFilesChange}
                />
                <button
                  type="button"
                  className="client-form-modal__photos-add-btn"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <ImagePlus size={18} strokeWidth={1.75} aria-hidden />
                  Добавить фото
                </button>
              </div>
            </div>

            {client?.id ? (
              photosLoading ? (
                <p className="client-form-modal__photos-loading">Загрузка фото…</p>
              ) : serverPhotos.length > 0 ? (
                <ul className="client-form-modal__photos-grid" aria-label="Сохранённые фото">
                  {serverPhotos.map((ph) => (
                    <li key={ph.id} className="client-form-modal__photos-item">
                      <a
                        href={ph.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="client-form-modal__photos-thumb-link"
                      >
                        <img src={ph.url} alt="" className="client-form-modal__photos-thumb" />
                      </a>
                      <span className="client-form-modal__photos-kind">{getClientPhotoKindLabel(ph.kind)}</span>
                      <button
                        type="button"
                        className="client-form-modal__photos-remove"
                        onClick={() => handleDeleteServerPhoto(ph)}
                        disabled={photoDeletingId === ph.id}
                        aria-label="Удалить фото"
                        title="Удалить"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="client-form-modal__photos-empty">Пока нет загруженных фото</p>
              )
            ) : null}

            {pendingPhotos.length > 0 ? (
              <div className="client-form-modal__photos-pending">
                {!fullscreen && (
                  <span className="client-form-modal__photos-pending-title">Будут загружены при сохранении</span>
                )}
                <ul className="client-form-modal__photos-grid" aria-label="Очередь загрузки">
                  {pendingPhotos.map((row) => (
                    <li key={row._key} className="client-form-modal__photos-item client-form-modal__photos-item--pending">
                      <span className="client-form-modal__photos-thumb-wrap">
                        <img src={row.previewUrl} alt="" className="client-form-modal__photos-thumb" />
                      </span>
                      <Select
                        value={row.kind}
                        onChange={(v) => updatePendingPhotoKind(row._key, v)}
                        options={CLIENT_PHOTO_KIND_OPTIONS}
                        className="client-form-modal__select client-form-modal__photos-pending-kind"
                      />
                      <button
                        type="button"
                        className="client-form-modal__photos-remove"
                        onClick={() => removePendingPhoto(row._key)}
                        aria-label="Убрать из очереди"
                        title="Убрать"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <details
            className="client-form-modal__more"
            key={isMobileFormLayout ? 'extra-mobile' : 'extra-desktop'}
            {...(!isMobileFormLayout ? { open: true } : {})}
          >
            <summary className="client-form-modal__more-summary">Дополнительно</summary>
            <div className="client-form-modal__more-inner">
              {isMobileFormLayout && (
                <div className="client-form-modal__section client-form-modal__section--flush">
                  <label className="client-form-modal__label">
                    <span className="client-form-modal__label-text">Пол</span>
                    <Select value={gender} onChange={setGender} options={[{ value: '', label: '—' }, { value: 'male', label: 'М' }, { value: 'female', label: 'Ж' }]} placeholder="—" className="client-form-modal__select" />
                  </label>
                  {!fullscreen && <p className="client-form-modal__slot-hint-mobile">{trainingSlotHint}</p>}
                </div>
              )}
              <div className="client-form-modal__section client-form-modal__section--flush">
                <h3 className="client-form-modal__section-title">Комментарий</h3>
                <div className="client-form-modal__label client-form-modal__label--full">
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
            </div>
          </details>
          </div>
          <div className="client-form-modal__actions">
            <button type="button" className="client-form-modal__btn client-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="client-form-modal__btn client-form-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
        {confirmDeleteOneTime && (
          <ConfirmModal
            title="Удалить доплату?"
            message={`Удалить доплату ${formatMoney(confirmDeleteOneTime.amount)} от ${confirmDeleteOneTime.date ? new Date(confirmDeleteOneTime.date).toLocaleDateString('ru-RU') : '—'}?`}
            confirmText="Удалить"
            onConfirm={() => handleDeleteOneTimePayment(confirmDeleteOneTime)}
            onCancel={() => setConfirmDeleteOneTime(null)}
            danger
          />
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ClientFormModal;
