import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, UserPlus, User, Ticket, CreditCard, Wallet, SlidersHorizontal, MessageSquare, Check, Dumbbell, UserCheck, Clock, Tag } from 'lucide-react';
import { useToast } from '../../../app/providers/ToastProvider';
import { Select, SubmitButton, ConfirmModal, PhoneInput, MoneyInput } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import { isPeriodClosedError } from '../../../shared/lib/apiError';
import {
  createOneTimePayment,
  deleteOneTimePayment,
  fetchClientOneTimePayments,
} from '../api';
import { CLIENT_PHOTO_KIND_OPTIONS } from '../lib/clientPhotos';
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

// Маппинг API-полей → русские названия
const FIELD_LABELS = {
  sportId:       'Вид спорта',
  sport_id:      'Вид спорта',
  trainerId:     'Тренер',
  trainer_id:    'Тренер',
  fio:           'ФИО',
  phone:         'Телефон',
  dateStart:     'Дата начала',
  date_start:    'Дата начала',
  price:         'Цена',
  clientType:    'Тип клиента',
  client_type:   'Тип клиента',
  months:        'Месяцев',
  paid:          'Оплачено',
  trainingSlot:  'Время занятия',
  training_slot: 'Время занятия',
};

// Поле API → ключ секции формы (для автоскролла/подсветки при ошибке с бэка)
const FIELD_SECTION_KEY = {
  fio:           'personal',
  phone:         'personal',
  sportId:       'subscription',
  sport_id:      'subscription',
  trainerId:     'subscription',
  trainer_id:    'subscription',
  dateStart:     'subscription',
  date_start:    'subscription',
  clientType:    'subscription',
  client_type:   'subscription',
  trainingSlot:  'subscription',
  training_slot: 'subscription',
  price:         'payment',
  paid:          'payment',
  paymentKind:   'paymentKind',
  payment_kind:  'paymentKind',
};

// Парсит строку "sportId: Текст. trainerId: Текст." → [{field, label, message}]
const parseApiError = (error) => {
  if (!error || typeof error !== 'string') return null;
  // Пробуем распарсить как список "field: message."
  const pattern = /([a-zA-Z_]+):\s*([^.]+\.?)/g;
  const matches = [...error.matchAll(pattern)];
  if (!matches.length) return null;
  return matches.map(([, field, msg]) => ({
    field,
    label: FIELD_LABELS[field] || field,
    message: msg.trim().replace(/\.$/, ''),
  }));
};

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

/** YYYY-MM-DD для input type="date" (локальный календарный день). */
const getLocalDateInputValue = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Дата начала в форме: с бэка / при создании клиента — сегодня. */
const getDateStartFieldValue = (c) => {
  if (!c) return '';
  const raw = c.dateStart ?? c.date_start;
  if (raw) return String(raw).slice(0, 10);
  const isNew = c.id == null || String(c.id).trim() === '';
  return isNew ? getLocalDateInputValue() : '';
};

const MOBILE_FORM_MQ = '(max-width: 768px)';

const ClientFormModal = ({ client, sports, fetchTrainers, currentUserFio, onSave, onClose, error, saving, fullscreen = false }) => {
  const toast = useToast();
  const firstInputRef = useRef(null);
  const [isMobileFormLayout, setIsMobileFormLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_FORM_MQ).matches,
  );
  /** На странице клиентов: укороченные подсказки только на мобильной вёрстке */
  const compactHints = fullscreen && isMobileFormLayout;

  const panelRef = useRef(null);
  useModalEffect(true, onClose, panelRef);

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
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  const [phone, setPhone] = useState('');
  const [sportId, setSportId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [trainersList, setTrainersList] = useState([]);
  const [dateStart, setDateStart] = useState(() => getDateStartFieldValue(client));
  const [price, setPrice] = useState('');
  const [trainerPrice, setTrainerPrice] = useState('');
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
  const [paymentKind, setPaymentKind] = useState('');
  const paymentKindRef = useRef(null);
  const personalSectionRef = useRef(null);
  const subscriptionSectionRef = useRef(null);
  const paymentSectionRef = useRef(null);
  const [highlightSection, setHighlightSection] = useState(null);
  const highlightTimeoutRef = useRef(null);

  const focusSection = (ref, key) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightSection(key);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightSection((cur) => (cur === key ? null : cur));
    }, 1600);
  };

  const sectionClass = (key) =>
    `client-form-modal__section${highlightSection === key ? ' client-form-modal__section--highlight' : ''}`;

  const sectionRefsByKey = {
    personal: personalSectionRef,
    subscription: subscriptionSectionRef,
    payment: paymentSectionRef,
    paymentKind: paymentKindRef,
  };
  /** Порядок секций сверху вниз, как они идут в форме — определяет, к какому полю скроллить первым. */
  const SECTION_ORDER = ['personal', 'subscription', 'payment', 'paymentKind'];

  /** Ошибка с бэка (после неудачного сохранения) — скроллим к самому верхнему по форме невалидному полю, а не к тому, что бэк перечислил первым. */
  useEffect(() => {
    if (!error) return;
    const parsed = parseApiError(error);
    if (!parsed?.length) return;
    const keysWithErrors = new Set(
      parsed.map(({ field }) => FIELD_SECTION_KEY[field]).filter(Boolean)
    );
    const topKey = SECTION_ORDER.find((k) => keysWithErrors.has(k));
    const ref = topKey ? sectionRefsByKey[topKey] : null;
    if (ref) focusSection(ref, topKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

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

  /** Только смена клиента (id / новая карточка), не каждый новый объект-ссылка — иначе поле цены постоянно сбрасывается и кажется «нерабочим». */
  const clientFormSyncKey = client?.id != null && client?.id !== '' ? String(client.id) : 'new';

  useEffect(() => {
    if (!client) return;
    setTrainingSlotKey('');
    setFio(capitalizeWords(client.fio || ''));
    setPhone(client.phone || '');
    setSportId(client.sportId ?? client.sport_id ?? client.sport?.id ?? '');
    setTrainerId(client.trainerId ?? client.trainer_id ?? client.trainer?.id ?? '');
    setDateStart(getDateStartFieldValue(client));
    const nextClientType = client.clientType || client.client_type || 'regular';
    setClientType(nextClientType);
    const nextTrainerPrice =
      client.trainerPrice ??
      client.trainer_price ??
      client.priceTrainer ??
      client.price_trainer ??
      '';
    const nextClubPrice =
      client.clubPrice ??
      client.club_price ??
      client.priceClub ??
      client.price_club ??
      '';
    if (nextClientType === 'individual') {
      setPrice(nextClubPrice !== '' && nextClubPrice != null ? String(nextClubPrice) : '');
      setTrainerPrice(nextTrainerPrice !== '' && nextTrainerPrice != null ? String(nextTrainerPrice) : '');
    } else {
      setPrice(getPriceFieldInitialForForm(client));
      setTrainerPrice('');
    }
    setDiscount(client.discount ?? '');
    setPaid(isClientPaid(client));
    setInstallments(getInitialInstallmentRows(client));
    setGender(client.gender || '');
    setPaymentKind(client.paymentKind ?? client.payment_kind ?? '');
    const { auto, manual } = parseComment(client.comment);
    setCommentAuto(auto);
    setCommentManual(manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно не [client]: см. clientFormSyncKey
  }, [clientFormSyncKey]);

  useEffect(() => {
    if (!fetchTrainers) return;
    if (sportId) {
      let cancelled = false;
      fetchTrainers({ sportId, includeSchedule: true, perPage: 500 }, null)
        .then((d) => {
          if (cancelled) return;
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
            return '';
          });
        })
        .catch((e) => {
          if (cancelled) return;
          setTrainersList([]);
          toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки тренеров');
        });
      return () => {
        cancelled = true;
      };
    }
    setTrainersList([]);
    // Не вызывать setTrainerId('') здесь: на первом кадре sportId ещё пустой, а следующий эффект [client]
    // уже выставил trainerId — иначе получаем гонку и сброс тренера/слота. Обнуление при смене вида спорта — в onChange у Select.
    return undefined;
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
  const trainerPriceNum = Number(trainerPrice);
  const rawTrainerPriceInput = Number.isFinite(trainerPriceNum) ? trainerPriceNum : 0;
  const isIndividualClient = clientType === 'individual';
  const fioError = touched.fio && !fio.trim() ? 'Укажите ФИО' : null;
  const priceIsValid = Number.isFinite(Number(String(price).trim())) && Number(String(price).trim()) >= 0;
  const trainerPriceIsValid = Number.isFinite(Number(String(trainerPrice).trim())) && Number(String(trainerPrice).trim()) >= 0;
  const priceError = touched.price && isIndividualClient && !priceIsValid ? 'Введите корректную сумму' : null;
  const trainerPriceError = touched.trainerPrice && isIndividualClient && !trainerPriceIsValid ? 'Введите корректную сумму' : null;
  const individualTotal = Math.max(0, Math.round(rawPriceInput + rawTrainerPriceInput));
  const discountFactor = discountPct >= 100 ? 0 : 1 - discountPct / 100;

  /**
   * Поле «цена»: при скидке > 0 вводим сумму со скидкой (как «Цена» в карточке).
   * На сервер уходит договорная сумма до скидки (price).
   */
  let contractBaseAmount;
  let amountAfterDiscount;
  if (isIndividualClient) {
    contractBaseAmount = individualTotal;
    amountAfterDiscount = individualTotal;
  } else if (discountPct > 0 && discountFactor > 0) {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const built = buildActualPaymentsPayload(installments);
    if (!built.ok) {
      toast.error(built.message);
      focusSection(paymentSectionRef, 'payment');
      return;
    }

    if (!paymentKind) {
      toast.error('Выберите способ оплаты');
      focusSection(paymentKindRef, 'paymentKind');
      return;
    }

    if (isIndividualClient) {
      const club = Number(String(price).trim());
      const tr = Number(String(trainerPrice).trim());
      const clubOk = Number.isFinite(club) && club >= 0;
      const trOk = Number.isFinite(tr) && tr >= 0;
      if (!clubOk || !trOk) {
        toast.error('Укажите корректные суммы: клуб и тренеру');
        focusSection(paymentSectionRef, 'payment');
        return;
      }
      if (Math.round(club + tr) <= 0) {
        toast.error('Общая сумма должна быть больше ноля');
        focusSection(paymentSectionRef, 'payment');
        return;
      }
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

    onSave({
      fio,
      phone,
      sportId: sportId || undefined,
      trainerId: trainerId || undefined,
      dateStart: dateStart || undefined,
      price: (isIndividualClient || hasPriceField) ? contractBaseAmount : undefined,
      clubPrice: isIndividualClient ? Math.round(rawPriceInput) : undefined,
      trainerPrice: isIndividualClient ? Math.round(rawTrainerPriceInput) : undefined,
      discount: discount ? Number(discount) : undefined,
      paid,
      ...paymentsPayload,
      clientType,
      gender: gender || undefined,
      comment: commentValue,
      ...trainingPayload,
      paymentKind,
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
      <div ref={panelRef} className={`client-form-modal${fullscreen ? ' client-form-modal--fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="client-form-modal__header">
          <h2 id="client-form-modal-title" className="client-form-modal__title">
            {client?.id ? <User size={18} /> : <UserPlus size={18} />}
            {client?.id ? 'Редактировать клиента' : 'Добавить клиента'}
          </h2>
          <button type="button" className="client-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && (() => {
          const parsed = parseApiError(error);
          if (parsed) {
            return (
              <div className="client-form-modal__error-block" role="alert">
                <span className="client-form-modal__error-title">Пожалуйста, исправьте ошибки:</span>
                <ul className="client-form-modal__error-list">
                  {parsed.map(({ field, label, message }) => (
                    <li key={field} className="client-form-modal__error-item">
                      <span className="client-form-modal__error-field">{label}</span>
                      <span className="client-form-modal__error-msg">{message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          return <p className="client-form-modal__error" role="alert">{error}</p>;
        })()}
        <form onSubmit={handleSubmit} className="client-form-modal__form">
          <div className="client-form-modal__scroll">
          <div className={sectionClass('personal')} ref={personalSectionRef}>
            <h3 className="client-form-modal__section-title"><User size={14} /> Личные данные</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">ФИО <span className="form-label-required" aria-hidden="true">*</span></span>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={fio}
                  onChange={(e) => setFio(capitalizeWords(e.target.value))}
                  onBlur={() => markTouched('fio')}
                  required
                  className={`client-form-modal__input${fioError ? ' client-form-modal__input--invalid' : ''}`}
                />
                {fioError && <span className="client-form-modal__field-error">{fioError}</span>}
              </label>
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Телефон</span>
                <PhoneInput value={phone} onChange={setPhone} className="client-form-modal__input" />
              </label>
            </div>
          </div>
          <div className={sectionClass('subscription')} ref={subscriptionSectionRef}>
            <h3 className="client-form-modal__section-title"><Ticket size={14} /> Абонемент</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Вид спорта</span>
              <Select value={String(sportId)} onChange={(v) => { setSportId(v); setTrainerId(''); setTrainingSlotKey(''); setHighlightSection((cur) => (cur === 'subscription' ? null : cur)); }} options={[{ value: '', label: '—' }, ...(sports || []).map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="—" className="client-form-modal__select" icon={<Dumbbell size={15} />} />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Тренер</span>
              <Select
                value={String(trainerId)}
                onChange={(v) => {
                  setTrainerId(v);
                  setTrainingSlotKey('');
                  setHighlightSection((cur) => (cur === 'subscription' ? null : cur));
                }}
                options={[{ value: '', label: '—' }, ...(trainersList || []).map((t) => ({ value: String(t.id), label: t.fio || '' }))]}
                placeholder="—"
                className="client-form-modal__select"
                icon={<UserCheck size={15} />}
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
                  icon={<Clock size={15} />}
                />
                {!compactHints && (
                  <span className="client-form-modal__field-hint client-form-modal__hint--desktop-only">
                    {trainingSlotHint}
                  </span>
                )}
              </label>
            </div>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Дата начала</span>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="client-form-modal__input" />
              </label>
              <label className="client-form-modal__label">
                <span className="client-form-modal__label-text">Тип</span>
                <Select
                  value={clientType}
                  onChange={setClientType}
                  options={[
                    { value: 'regular', label: 'Регулярный' },
                    { value: 'individual', label: 'Индивидуальный' },
                    { value: 'one-time', label: 'Разовый' },
                  ]}
                  className="client-form-modal__select"
                  icon={<Tag size={15} />}
                />
              </label>
            </div>
          </div>
          <div className={sectionClass('payment')} ref={paymentSectionRef}>
            <h3 className="client-form-modal__section-title"><CreditCard size={14} /> Оплата</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">
                  {isIndividualClient ? 'Цена клубу, сом' : (discountPct > 0 ? 'К оплате (со скидкой), сом' : 'Цена абонемента, сом')}
                </span>
                <MoneyInput
                  value={price}
                  onChange={setPrice}
                  onBlur={() => markTouched('price')}
                  className={`client-form-modal__input${priceError ? ' client-form-modal__input--invalid' : ''}`}
                  placeholder="0"
                  autoComplete="off"
                />
                {priceError && <span className="client-form-modal__field-error">{priceError}</span>}
                {!compactHints && (
                  <span className="client-form-modal__field-hint client-form-modal__hint--desktop-only">
                    {isIndividualClient
                      ? 'Для индивидуальных клиентов укажите отдельно: сколько получает клуб и сколько — тренер. Итоги в «Зарплата» считаются автоматически.'
                      : (discountPct > 0
                          ? 'Та же сумма, что «Цена» в карточке. Ниже — договорная до скидки. Частичные взносы отдельно.'
                          : 'Общая стоимость по договору — для скидки и отображения. Частичные взносы ниже.')}
                  </span>
                )}
              </label>
            </div>

            {isIndividualClient && (
              <div className="client-form-modal__row">
                <label className="client-form-modal__label client-form-modal__label--full">
                  <span className="client-form-modal__label-text">Цена тренеру, сом</span>
                  <MoneyInput
                    value={trainerPrice}
                    onChange={setTrainerPrice}
                    onBlur={() => markTouched('trainerPrice')}
                    className={`client-form-modal__input${trainerPriceError ? ' client-form-modal__input--invalid' : ''}`}
                    placeholder="0"
                    autoComplete="off"
                  />
                  {trainerPriceError && <span className="client-form-modal__field-error">{trainerPriceError}</span>}
                  {!compactHints && (
                    <span className="client-form-modal__field-hint client-form-modal__hint--desktop-only">
                      Итого: <strong>{individualTotal.toLocaleString('ru-RU')} сом</strong>
                    </span>
                  )}
                </label>
              </div>
            )}

            <div className="client-form-modal__installments">
              <div className="client-form-modal__installments-header">
                <span className="client-form-modal__installments-title">Частичные оплаты</span>
              </div>
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
                {!compactHints && (
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

            <label className="client-form-modal__paid-toggle" aria-label="Статус оплаты">
              <input
                type="checkbox"
                className="client-form-modal__paid-input"
                checked={paid}
                onChange={e => setPaid(e.target.checked)}
              />
              <span className="client-form-modal__paid-track">
                <span className="client-form-modal__paid-thumb" />
              </span>
              <span className={`client-form-modal__paid-label ${paid ? 'client-form-modal__paid-label--yes' : 'client-form-modal__paid-label--no'}`}>
                {paid ? 'Оплачено' : 'Не оплачено'}
              </span>
            </label>
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
          </div>

          <div className={sectionClass('paymentKind')} ref={paymentKindRef}>
            <h3 className="client-form-modal__section-title"><Wallet size={14} /> Способ оплаты</h3>
            <div className="client-form-modal__row">
              <label className="client-form-modal__label client-form-modal__label--full">
                <span className="client-form-modal__label-text">Способ оплаты <span className="form-label-required" aria-hidden="true">*</span></span>
                <Select
                  value={paymentKind}
                  onChange={(v) => {
                    setPaymentKind(v);
                    setHighlightSection((cur) => (cur === 'paymentKind' ? null : cur));
                  }}
                  options={CLIENT_PHOTO_KIND_OPTIONS}
                  placeholder="Выберите..."
                  className="client-form-modal__select"
                  icon={<Wallet size={15} />}
                />
              </label>
            </div>
          </div>

          <details
            className="client-form-modal__more"
            key={isMobileFormLayout ? 'extra-mobile' : 'extra-desktop'}
          >
            <summary className="client-form-modal__more-summary">Дополнительно</summary>
            <div className="client-form-modal__more-inner">
              <div className="client-form-modal__section client-form-modal__section--flush">
                <h3 className="client-form-modal__section-title"><SlidersHorizontal size={14} /> Поля</h3>
                <div className="client-form-modal__row">
                  <label className="client-form-modal__label">
                    <span className="client-form-modal__label-text">Пол</span>
                    <Select
                      value={gender}
                      onChange={setGender}
                      options={[
                        { value: '', label: '—' },
                        { value: 'male', label: 'М' },
                        { value: 'female', label: 'Ж' },
                      ]}
                      placeholder="—"
                      className="client-form-modal__select"
                      icon={<User size={15} />}
                    />
                  </label>
                  <label className="client-form-modal__label">
                    <span className="client-form-modal__label-text">Скидка, %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={handleDiscountChange}
                      className="client-form-modal__input"
                      placeholder="0"
                      disabled={isIndividualClient}
                    />
                  </label>
                </div>
                {isMobileFormLayout && !compactHints && (
                  <p className="client-form-modal__slot-hint-mobile">{trainingSlotHint}</p>
                )}
              </div>
              <div className="client-form-modal__section client-form-modal__section--flush">
                <h3 className="client-form-modal__section-title"><MessageSquare size={14} /> Комментарий</h3>
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
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}><X size={15} /> Отмена</button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              <Check size={15} /> Сохранить
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
