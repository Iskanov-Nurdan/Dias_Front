import { apiClient } from '../../shared/api/client';

// ── Blocks ──────────────────────────────────────────────
export const fetchSpreadsheets = () =>
  apiClient.get('/spreadsheets/').then((r) => r.data);

export const fetchSpreadsheet = (id) =>
  apiClient.get(`/spreadsheets/${id}/`).then((r) => r.data);

export const createSpreadsheet = (body) =>
  apiClient.post('/spreadsheets/', body).then((r) => r.data);

export const deleteSpreadsheet = (id) =>
  apiClient.delete(`/spreadsheets/${id}/`);

// ── Columns ─────────────────────────────────────────────
export const addColumn = (blockId, body) =>
  apiClient.post(`/spreadsheets/${blockId}/columns/`, body).then((r) => r.data);

export const updateColumn = (blockId, colId, body) =>
  apiClient.patch(`/spreadsheets/${blockId}/columns/${colId}/`, body).then((r) => r.data);

export const deleteColumn = (blockId, colId) =>
  apiClient.delete(`/spreadsheets/${blockId}/columns/${colId}/`);

// ── Rows ────────────────────────────────────────────────
export const addRow = (blockId, body = {}) =>
  apiClient.post(`/spreadsheets/${blockId}/rows/`, body).then((r) => r.data);

export const updateRow = (blockId, rowId, cells) =>
  apiClient.patch(`/spreadsheets/${blockId}/rows/${rowId}/`, { cells }).then((r) => r.data);

export const deleteRow = (blockId, rowId) =>
  apiClient.delete(`/spreadsheets/${blockId}/rows/${rowId}/`);
