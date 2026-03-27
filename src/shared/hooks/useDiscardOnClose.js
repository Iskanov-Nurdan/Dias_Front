import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Закрытие модалки: если needConfirm() истинно — сначала диалог, иначе сразу onClose.
 * needConfirm может меняться каждый рендер (например, () => draft.length > 0).
 */
export function useDiscardOnClose(onClose, needConfirm) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const needRef = useRef(needConfirm);
  useEffect(() => {
    needRef.current = needConfirm;
  }, [needConfirm]);

  const requestClose = useCallback(() => {
    if (needRef.current()) setDiscardConfirmOpen(true);
    else onClose();
  }, [onClose]);

  const confirmDiscardAndClose = useCallback(() => {
    setDiscardConfirmOpen(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => setDiscardConfirmOpen(false), []);

  return {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  };
}
