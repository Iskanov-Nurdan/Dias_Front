import {
  isCanceledError,
  getApiErrorCode,
  isForbiddenError,
  isPeriodClosedError,
  isTooManyRequestsError,
  getApiErrorMessage,
} from './apiError';

describe('apiError', () => {
  describe('isCanceledError', () => {
    it('returns false for null/undefined', () => {
      expect(isCanceledError(null)).toBe(false);
      expect(isCanceledError(undefined)).toBe(false);
    });

    it('returns true for AbortError', () => {
      expect(isCanceledError({ name: 'AbortError' })).toBe(true);
    });

    it('returns true for CanceledError', () => {
      expect(isCanceledError({ name: 'CanceledError' })).toBe(true);
    });

    it('returns true for ERR_CANCELED', () => {
      expect(isCanceledError({ code: 'ERR_CANCELED' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isCanceledError({ name: 'TypeError' })).toBe(false);
      expect(isCanceledError(new Error('network'))).toBe(false);
    });
  });

  describe('getApiErrorCode', () => {
    it('returns code from error.response.data.error', () => {
      expect(getApiErrorCode({ response: { data: { error: { code: 'period_closed' } } } })).toBe('period_closed');
    });

    it('returns null when no code', () => {
      expect(getApiErrorCode({})).toBe(null);
      expect(getApiErrorCode({ response: {} })).toBe(null);
    });
  });

  describe('isForbiddenError', () => {
    it('returns true for 403', () => {
      expect(isForbiddenError({ response: { status: 403 } })).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isForbiddenError({ response: { status: 401 } })).toBe(false);
      expect(isForbiddenError({ response: { status: 404 } })).toBe(false);
    });
  });

  describe('isPeriodClosedError', () => {
    it('returns true for period_closed code', () => {
      expect(isPeriodClosedError({ response: { data: { error: { code: 'period_closed' } } } })).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(isPeriodClosedError({ response: { data: { error: { code: 'validation_error' } } } })).toBe(false);
    });
  });

  describe('isTooManyRequestsError', () => {
    it('returns true for too_many_requests code', () => {
      expect(isTooManyRequestsError({ response: { data: { error: { code: 'too_many_requests' } } } })).toBe(true);
    });
  });

  describe('getApiErrorMessage', () => {
    it('returns error.message from error.response.data', () => {
      const err = { response: { data: { error: { message: 'Период закрыт' } } } };
      expect(getApiErrorMessage(err)).toBe('Период закрыт');
    });

    it('returns message from data.message', () => {
      const err = { response: { data: { message: 'Validation failed' } } };
      expect(getApiErrorMessage(err)).toBe('Validation failed');
    });

    it('returns data.detail', () => {
      const err = { response: { data: { detail: 'Not found' } } };
      expect(getApiErrorMessage(err)).toBe('Not found');
    });

    it('returns err.message when no response data', () => {
      expect(getApiErrorMessage(new Error('Network Error'))).toBe('Network Error');
    });

    it('returns default when empty', () => {
      expect(getApiErrorMessage({})).toBe('Ошибка запроса');
    });
  });
});
