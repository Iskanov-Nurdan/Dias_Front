import React, { useEffect, useRef, useState } from 'react';
import { Film, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import './VideoUpload.scss';

const VideoUpload = ({ value, onChange, num, context = '', backendEnabled = false, uploadFile, onUploadingChange }) => {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  // Освобождаем blob-ссылку при размонтировании (например, закрыли модалку,
  // не удалив и не заменив видео) — иначе она остаётся висеть в памяти.
  const valueRef = useRef(value);
  valueRef.current = value;
  const uploadingRef = useRef(false);
  useEffect(() => {
    return () => {
      if (valueRef.current && valueRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(valueRef.current);
      }
      // Если размонтировались посреди загрузки — снимаем «занято», иначе счётчик
      // у родителя (блокирующий «Сохранить») останется висеть навсегда.
      if (uploadingRef.current) onUploadingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (backendEnabled && uploadFile) {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
      setUploading(true);
      uploadingRef.current = true;
      onUploadingChange?.(true);
      try {
        const url = await uploadFile(file, context);
        onChange(url);
      } catch {
        alert('Ошибка загрузки видео. Попробуйте ещё раз.');
      } finally {
        setUploading(false);
        uploadingRef.current = false;
        onUploadingChange?.(false);
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
          {num != null && <span className="ui-vid__badge">{num}</span>}
          {!uploading && (
            // Действия — компактными иконками поверх превью: текстовые кнопки
            // не помещались в узкой карточке и обрезались на «Удали…».
            <div className="ui-vid__actions">
              <button
                type="button"
                className="ui-vid__act"
                onClick={() => ref.current.click()}
                title="Заменить видео"
                aria-label="Заменить видео"
              >
                <RefreshCw size={13} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="ui-vid__act ui-vid__act--del"
                onClick={remove}
                title="Удалить видео"
                aria-label="Удалить видео"
              >
                <Trash2 size={13} strokeWidth={2.25} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="ui-vid__empty"
          onClick={() => !uploading && ref.current.click()}
          disabled={uploading}
        >
          <span className="ui-vid__ic">
            {uploading
              ? <Loader2 size={18} strokeWidth={2} className="ui-vid__spin" />
              : <Film size={18} strokeWidth={1.75} />}
          </span>
          <span className="ui-vid__txt">{uploading ? 'Загружается…' : (num != null ? `Видео ${num}` : 'Добавить видео')}</span>
          {!uploading && <span className="ui-vid__hint">MP4, WEBM</span>}
        </button>
      )}
    </div>
  );
};

export default VideoUpload;
