import React, { useEffect, useRef, useState } from 'react';
import './VideoUpload.scss';

const VideoUpload = ({ value, onChange, num, context = '', backendEnabled = false, uploadFile }) => {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  // Освобождаем blob-ссылку при размонтировании (например, закрыли модалку,
  // не удалив и не заменив видео) — иначе она остаётся висеть в памяти.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    return () => {
      if (valueRef.current && valueRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(valueRef.current);
      }
    };
  }, []);

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (backendEnabled && uploadFile) {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
      setUploading(true);
      try {
        const url = await uploadFile(file, context);
        onChange(url);
      } catch {
        alert('Ошибка загрузки видео. Попробуйте ещё раз.');
      } finally {
        setUploading(false);
      }
    } else {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
      const url = URL.createObjectURL(file);
      onChange(url);
    }
  };

  const remove = () => {
    if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
    onChange('');
  };

  return (
    <div className="ui-vid">
      <input ref={ref} type="file" accept="video/mp4,video/webm,video/*" hidden onChange={handleFile} />
      {value ? (
        <div className="ui-vid__has">
          <video src={value} controls className="ui-vid__player" />
          {!uploading && (
            <div className="ui-vid__actions">
              <button type="button" onClick={() => ref.current.click()}>Заменить</button>
              <button type="button" className="ui-vid__del" onClick={remove}>Удалить</button>
            </div>
          )}
        </div>
      ) : (
        <div className="ui-vid__empty" onClick={() => !uploading && ref.current.click()}>
          <span className="ui-vid__ic">{uploading ? '⏳' : '🎬'}</span>
          <span className="ui-vid__txt">{uploading ? 'Загружается...' : `Видео ${num}`}</span>
          {!uploading && <span className="ui-vid__hint">MP4, WEBM</span>}
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
