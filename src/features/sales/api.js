import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/sales/select-sources/ — источники для чекаута кассы. У ответа
 * несколько параллельных списков остатков (legacy + новые) — берём именно
 * `available_warehouse_batches` (build_warehouse_batch_sale_sources): это
 * единственный набор с уже посчитанной ценой (profile_pricing_payload) и
 * реально доступным поштучным (available_pieces) остатком под режим pieces
 * (packages снят с фронта — unit_type=packages вернёт 410).
 */
export const fetchSaleSources = async (clientId, signal) => {
  const params = {};
  if (clientId) params.client = clientId;
  const { data } = await apiClient.get('/sales/select-sources/', { params, ...withSignal({}, signal) });
  return data;
};

/** GET /api/sales/ — SaleFilter: client_id, sale_status, date_from/date_to, is_defect_sale. */
export const fetchSales = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.perPage || 20, ordering: '-date' };
  if (queryState?.clientId) params.client_id = queryState.clientId;
  if (queryState?.status) params.sale_status = queryState.status;
  if (queryState?.dateFrom) params.date_from = queryState.dateFrom;
  if (queryState?.dateTo) params.date_to = queryState.dateTo;
  const { data } = await apiClient.get('/sales/', { params, ...withSignal({}, signal) });
  return data;
};

export const fetchSale = async (id, signal) => {
  const { data } = await apiClient.get(`/sales/${id}/`, withSignal({}, signal));
  return data;
};

/** Ключ идемпотентности одной попытки чекаута — см. apps/sales Sale.idempotency_key
 * (SaleSerializer.create): повторный POST с тем же ключом от того же кассира
 * не создаёт вторую продажу, отдаёт уже созданную. Генерируется один раз на
 * попытку оплаты в RegisterModal и переиспользуется при ретрае (не на каждый
 * клик — иначе идемпотентность теряет смысл).
 */
export const genIdempotencyKey = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch { /* ignore */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * POST /api/sales/ — тело: client, sale_date, sale_lines:[{warehouse_batch,
 * quantity, unit_price, discount_amount?, manual_price_override?,
 * price_override_reason?}], discount_amount? (скидка на чек),
 * payment_type (full|partial|debt), payment_method (cash|card),
 * payment_splits:[{payment_method, amount}] (смешанная оплата), paid_amount,
 * idempotency_key, comment. Цена строки по умолчанию — та, что прислал
 * select-sources; сервер сверяет её с профильной ценой (допуск 0.01), если
 * не выставлен manual_price_override — тогда сверка снимается, но только
 * для is_superuser (см. profile_sale_price.resolve_unit_sale_price), иначе
 * 403/ValidationError SALE_DISCOUNT_FORBIDDEN.
 */
export const createSale = async (body, signal) => {
  const payload = {
    client: body.clientId,
    sale_date: body.saleDate,
    unit_type: 'pieces',
    comment: body.comment || undefined,
    payment_type: body.paymentType,
    idempotency_key: body.idempotencyKey || undefined,
    sale_lines: body.lines.map((l) => ({
      warehouse_batch: l.warehouseBatchId,
      // Явно шлём читаемое имя товара — без него бэк на fallback берёт сырое
      // WarehouseBatch.product (может не совпадать с profile.name, который
      // как раз показан в каталоге/чеке кассы, и с бывает пустым).
      product: l.product || undefined,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      discount_amount: l.discountAmount || undefined,
      manual_price_override: l.manualOverride || undefined,
      price_override_reason: l.manualOverride ? (l.overrideReason || '') : undefined,
    })),
  };
  if (body.discountAmount) payload.discount_amount = body.discountAmount;
  if (body.paymentSplits?.length) {
    payload.payment_splits = body.paymentSplits.map((s) => ({ payment_method: s.method, amount: s.amount }));
  } else if (body.paymentMethod) {
    payload.payment_method = body.paymentMethod;
  }
  if (body.paymentType !== 'debt' && body.paidAmount != null && body.paidAmount !== '') {
    payload.paid_amount = body.paidAmount;
  }
  const { data } = await apiClient.post('/sales/', payload, withSignal({}, signal));
  return data;
};

// ─────────────────────────────────────────────────────────────────────────
// Возвраты — apps.sales.Return/ReturnLine. Флоу: POST /returns/ (draft) →
// POST /returns/{id}/complete/ (списывает эффект: склад назад, авто-возврат
// денег наличными если по продаже уже нет долга — см. _create_auto_refund_payment,
// иначе просто уменьшает долг клиента). Кассе нужны оба шага одной кнопкой.
// ─────────────────────────────────────────────────────────────────────────

/** GET /api/returns/select-sources/?q=&sale_id= — без sale_id: поиск продаж
 * с чем возвращать; с sale_id: строки этой продажи с доступным к возврату
 * остатком (returnable_quantity). */
export const fetchReturnableSales = async (query, signal) => {
  const { data } = await apiClient.get('/returns/select-sources/', {
    params: { q: query || undefined },
    ...withSignal({}, signal),
  });
  return data?.sales ?? [];
};

export const fetchReturnableLines = async (saleId, signal) => {
  const { data } = await apiClient.get('/returns/select-sources/', {
    params: { sale_id: saleId },
    ...withSignal({}, signal),
  });
  return data?.sale_lines ?? [];
};

/** Создаёт возврат (draft) и сразу проводит его. lines: [{saleLineId, quantity, returnTarget, conditionType}]. */
export const createReturn = async (body, signal) => {
  const payload = {
    sale: body.saleId,
    date: body.date,
    return_reason: body.reason || '',
    lines: body.lines.map((l) => ({
      sale_line: l.saleLineId,
      quantity: l.quantity,
      return_target: l.returnTarget || 'warehouse',
      condition_type: l.conditionType || 'good',
    })),
  };
  const { data: created } = await apiClient.post('/returns/', payload, withSignal({}, signal));
  const { data: completed } = await apiClient.post(`/returns/${created.id}/complete/`, {}, withSignal({}, signal));
  return completed;
};
