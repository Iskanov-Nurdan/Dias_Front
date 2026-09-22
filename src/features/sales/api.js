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

/**
 * POST /api/sales/ — тело: client, sale_date, sale_lines:[{warehouse_batch,
 * quantity, unit_price}], payment_type (full|partial|debt), payment_method
 * (cash|card), paid_amount, comment. Цена (unit_price) на строке — то, что
 * прислал select-sources; сервер сверяет её с профильной ценой с допуском
 * 0.01 (UNIT_PRICE_MISMATCH), свободного ввода нет.
 */
export const createSale = async (body, signal) => {
  const payload = {
    client: body.clientId,
    sale_date: body.saleDate,
    unit_type: 'pieces',
    comment: body.comment || undefined,
    payment_type: body.paymentType,
    payment_method: body.paymentMethod,
    sale_lines: body.lines.map((l) => ({
      warehouse_batch: l.warehouseBatchId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    })),
  };
  if (body.paymentType !== 'debt' && body.paidAmount != null && body.paidAmount !== '') {
    payload.paid_amount = body.paidAmount;
  }
  const { data } = await apiClient.post('/sales/', payload, withSignal({}, signal));
  return data;
};
