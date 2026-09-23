import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** Списки apps.foam — форма пагинации не гарантирована, читаем защитно. */
const listItems = (data) => data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);

// ── Сырьё (Склад сырья №2 — Пенополистирол) ──────────────────────────────

export const fetchFoamRawLots = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20, ordering: '-received_at' };
  const { data } = await apiClient.get('/foam/raw-lots/', { params, ...withSignal({}, signal) });
  return { items: listItems(data), meta: data?.meta };
};

export const createFoamRawLot = async (body, signal) => {
  const payload = {
    material_name: body.materialName,
    supplier: body.supplier,
    bag_weight_kg: body.bagWeightKg,
  };
  if (body.unitPrice != null && body.unitPrice !== '') payload.unit_price = body.unitPrice;
  if (body.receivedAt) payload.received_at = body.receivedAt;
  const { data } = await apiClient.post('/foam/raw-lots/', payload, withSignal({}, signal));
  return data;
};

/** PATCH — на бэкенде правится material_name/supplier/unit_price/received_at, вес/остаток — нет (см. FoamRawLotUpdateSerializer). */
export const updateFoamRawLot = async (id, body, signal) => {
  const payload = { material_name: body.materialName, supplier: body.supplier };
  if (body.unitPrice != null && body.unitPrice !== '') payload.unit_price = body.unitPrice;
  if (body.receivedAt) payload.received_at = body.receivedAt;
  const { data } = await apiClient.patch(`/foam/raw-lots/${id}/`, payload, withSignal({}, signal));
  return data;
};

/** DELETE — сервер вернёт 409 LOT_IN_USE, если лот уже расходовался. */
export const deleteFoamRawLot = async (id, signal) => {
  await apiClient.delete(`/foam/raw-lots/${id}/`, withSignal({}, signal));
};

export const fetchFoamDensityGrades = async (signal) => {
  const { data } = await apiClient.get('/foam/density-grades/', withSignal({}, signal));
  return listItems(data);
};

export const createFoamDensityGrade = async (body, signal) => {
  const { data } = await apiClient.post('/foam/density-grades/', {
    code: body.code,
    min_kg_m3: body.minKgM3,
    max_kg_m3: body.maxKgM3,
  }, withSignal({}, signal));
  return data;
};

export const updateFoamDensityGrade = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/foam/density-grades/${id}/`, {
    code: body.code,
    min_kg_m3: body.minKgM3,
    max_kg_m3: body.maxKgM3,
  }, withSignal({}, signal));
  return data;
};

/** DELETE — сервер вернёт 409 DENSITY_GRADE_IN_USE, если марка уже использована. */
export const deleteFoamDensityGrade = async (id, signal) => {
  await apiClient.delete(`/foam/density-grades/${id}/`, withSignal({}, signal));
};

// ── Производство ─────────────────────────────────────────────────────────

export const fetchFoamProductionRuns = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20, ordering: '-produced_at' };
  const { data } = await apiClient.get('/foam/production-runs/', { params, ...withSignal({}, signal) });
  return { items: listItems(data), meta: data?.meta };
};

/**
 * output_format: 'cube' | 'sheet' | 'granule'. grade_code обязателен только
 * для cube — потеря 3.5% и выход считаются на бэкенде, клиент лишь
 * предпоказывает то же самое число (см. FoamProductionTab).
 */
export const createFoamProductionRun = async (body, signal) => {
  const payload = {
    lot_id: body.lotId,
    input_kg: body.inputKg,
    output_format: body.outputFormat,
  };
  if (body.outputFormat === 'cube' && body.gradeCode) payload.grade_code = body.gradeCode;
  const { data } = await apiClient.post('/foam/production-runs/', payload, withSignal({}, signal));
  return data;
};

// ── Склад ГП (Пенопласт) ──────────────────────────────────────────────────

export const fetchFoamGpStock = async (signal) => {
  const { data } = await apiClient.get('/foam/gp-stock/', { params: { page_size: 500 }, ...withSignal({}, signal) });
  return listItems(data);
};

export const cutFoamGpStock = async (body, signal) => {
  const { data } = await apiClient.post('/foam/gp-stock/cut/', {
    cube_stock_id: body.cubeStockId,
    thickness_cm: body.thicknessCm,
    cubes_qty: body.cubesQty,
  }, withSignal({}, signal));
  return data;
};

export const fetchFoamGpOperations = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20, ordering: '-created_at' };
  if (queryState?.kind) params.kind = queryState.kind;
  if (queryState?.dateFrom) params.date_from = queryState.dateFrom;
  if (queryState?.dateTo) params.date_to = queryState.dateTo;
  const { data } = await apiClient.get('/foam/gp-operations/', { params, ...withSignal({}, signal) });
  return { items: listItems(data), meta: data?.meta };
};

// ── Продажи (свой учёт клиента — без общего справочника Клиентов) ─────────

export const fetchFoamSales = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20, ordering: '-date' };
  if (queryState?.dateFrom) params.date_from = queryState.dateFrom;
  if (queryState?.dateTo) params.date_to = queryState.dateTo;
  const { data } = await apiClient.get('/foam/sales/', { params, ...withSignal({}, signal) });
  return { items: listItems(data), meta: data?.meta };
};

export const createFoamSale = async (body, signal) => {
  const payload = {
    client: body.client,
    sale_date: body.saleDate,
    lines: body.lines.map((l) => ({ stock_id: l.stockId, qty: l.qty, unit_price: l.unitPrice })),
  };
  if (body.paidAmount != null && body.paidAmount !== '') payload.paid_amount = body.paidAmount;
  const { data } = await apiClient.post('/foam/sales/', payload, withSignal({}, signal));
  return data;
};
