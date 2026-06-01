import React, { useEffect, useState } from 'react';
import './NetworkOfflineBanner.scss';

const NetworkOfflineBanner = () => {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="network-offline-banner" role="status">
      Нет соединения с интернетом. Данные могут быть неактуальны.
    </div>
  );
};

export default NetworkOfflineBanner;
