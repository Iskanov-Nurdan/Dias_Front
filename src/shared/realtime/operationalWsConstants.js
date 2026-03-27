/** См. бэк `docs/WEBSOCKET_API.md` — поле `protocol_version` в каждом кадре. */
export const OPERATIONAL_WS_PROTOCOL_VERSION = 1;

/** Невалидный или просроченный access JWT при handshake (WEBSOCKET_API.md). */
export const OPERATIONAL_WS_CLOSE_TOKEN_REJECTED = 4001;

export const OPERATIONAL_WS_TOKEN_REJECTED_EVENT = 'dias-operational-ws-token-rejected';
