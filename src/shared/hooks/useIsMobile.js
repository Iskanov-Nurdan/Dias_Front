import { useEffect, useState } from 'react';

// Тот же брейкпоинт, что mixins.mobile (≤768px) и MOBILE_MQ в списках разделов.
const MOBILE_MQ = '(max-width: 768px)';

/**
 * true на телефоне — когда разметка должна быть другой (карточки вместо
 * таблицы, «⋯» + шторка вместо ряда кнопок), а не просто перекрашенной CSS.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isMobile;
}
