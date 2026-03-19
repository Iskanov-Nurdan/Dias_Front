import { apiClient } from '../../../shared/api';

export const getMyShift = () => apiClient.get('shifts/my/');

export const openShift = () => apiClient.post('shifts/open/');

export const closeShift = (data = {}) => apiClient.post('shifts/close/', data);

export const addShiftNote = (note) => apiClient.post('shifts/notes/', { note });

export const getMyShiftNotes = () => apiClient.get('shifts/notes/');

export const getAllShifts = (params) => apiClient.get('shifts/', { params });

export const getShiftDetails = (id) => apiClient.get(`shifts/${id}/`);

export const getAllUsers = (params) => apiClient.get('users/', { params });

// История смен текущего сотрудника
export const getMyShiftHistory = (params) => apiClient.get('shifts/history/', { params });

// Журнал действий текущего сотрудника
export const getMyActivity = (params) => apiClient.get('activity/my/', { params });

// Смены конкретного сотрудника (для администратора)
export const getUserShifts = (userId, params) =>
  apiClient.get('shifts/', { params: { user: userId, ...params } });

// Журнал действий конкретного сотрудника (для администратора)
export const getUserActivity = (userId, params) =>
  apiClient.get('activity/', { params: { user_id: userId, ...params } });
