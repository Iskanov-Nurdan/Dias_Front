import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/clients/ — apps/sales.Client (CRM-карточка контрагента с кредитным
 * лимитом). Пагинация здесь своя — ClientViewSet задаёт
 * WarehouseResultsSetPagination (max_page_size 500), а не общий
 * StandardResultsSetPagination(100).
 */
export const fetchClients = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.clientType) params.client_type = queryState.clientType;
  if (queryState?.isActive != null && queryState.isActive !== '') params.is_active = queryState.isActive;
  if (queryState?.page) params.page = queryState.page;
  params.page_size = queryState?.perPage || 20;
  const { data } = await apiClient.get('/clients/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * Лёгкий список для пикера клиента в кассе — без пагинации в UI. ClientViewSet
 * задаёт свою пагинацию с max_page_size=500, каталог клиентов не журнал,
 * поэтому тянем разом (как fetchEmployees(perPage:100) для пикеров в ОТК).
 */
export const fetchClientsLite = async (search, signal) => {
  const { data } = await apiClient.get('/clients/', {
    params: { search: search || undefined, is_active: true, page_size: 500 },
    ...withSignal({}, signal),
  });
  return data?.items ?? [];
};

/** GET /api/clients/{id}/profile/ — карточка для кассы: продажи, долг, лимит одним запросом. */
export const fetchClientProfile = async (id, signal) => {
  const { data } = await apiClient.get(`/clients/${id}/profile/`, withSignal({}, signal));
  return data;
};

const toClientBody = (payload) => ({
  name: payload.name,
  client_type: payload.clientType || 'individual',
  phone: payload.phone || '',
  phone_alt: payload.phoneAlt || '',
  contact: payload.contact || '',
  inn: payload.inn || '',
  settlement_account: payload.settlementAccount || '',
  address: payload.address || '',
  email: payload.email || '',
  messenger: payload.messenger || '',
  notes: payload.notes || '',
  credit_limit: payload.creditLimit === '' || payload.creditLimit == null ? null : Number(payload.creditLimit),
  credit_limit_mode: payload.creditLimitMode || 'soft',
});

export const createClient = async (body, signal) => {
  const { data } = await apiClient.post('/clients/', toClientBody(body), withSignal({}, signal));
  return data;
};

export const updateClient = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/clients/${id}/`, toClientBody(body), withSignal({}, signal));
  return data;
};

/** DELETE отключён на бэкенде (405) — деактивация только через is_active: false. */
export const setClientActive = async (id, isActive, signal) => {
  const { data } = await apiClient.patch(`/clients/${id}/`, { is_active: isActive }, withSignal({}, signal));
  return data;
};

/** GET /api/payments/?client_id= — история платежей клиента (нужен access-key 'payments'). */
export const fetchClientPayments = async (clientId, signal) => {
  const { data } = await apiClient.get('/payments/', {
    params: { client_id: clientId, page_size: 100 },
    ...withSignal({}, signal),
  });
  return data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
};

/**
 * POST /api/payments/ — погашение долга по продаже: payment_type='payment',
 * linked_sale. Сервер НЕ ограничивает сумму остатком долга по продаже —
 * потолок обязан держать вызывающий код (см. DebtRepayModal).
 */
export const createDebtPayment = async ({ clientId, saleId, amount, method }, signal) => {
  const { data } = await apiClient.post('/payments/', {
    client: clientId,
    linked_sale: saleId,
    payment_type: 'payment',
    payment_method: method,
    amount,
    date: new Date().toISOString().slice(0, 10),
  }, withSignal({}, signal));
  return data;
};
