/** См. бэк `docs/WEBSOCKET_API.md` — поле `protocol_version` в каждом кадре. */
export const OPERATIONAL_WS_PROTOCOL_VERSION = 1;

/** Idle timeout: нет pong 60 с — клиент переподключается. */
export const OPERATIONAL_WS_CLOSE_IDLE_TIMEOUT = 4000;

/** Невалидный или просроченный access JWT при handshake (WEBSOCKET_API.md). */
export const OPERATIONAL_WS_CLOSE_TOKEN_REJECTED = 4001;

export const OPERATIONAL_WS_TOKEN_REJECTED_EVENT = 'dias-operational-ws-token-rejected';
