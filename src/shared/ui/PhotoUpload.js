import React, { useRef, useState } from 'react';
import './PhotoUpload.scss';

const PhotoUpload = ({
  value,
  onChange,
  shape = 'rect',
  placeholder = 'Загрузить фото',
  context = '',
  backendEnabled = false,
  uploadFile,
}) => {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5 МБ.');
      return;
    }
    e.target.value = '';

    if (backendEnabled && uploadFile) {
      setUploading(true);
      try {
        const url = await uploadFile(file, context);
        onChange(url);
      } catch {
        alert('Ошибка загрузки файла. Попробуйте ещё раз.');
      } finally {
        setUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = ev => onChange(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`ui-photo ui-photo--${shape}`}>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      {value ? (
        <div className="ui-photo__has">
          <img src={value} alt="" className="ui-photo__img" />
          {!uploading && (
            <div className="ui-photo__overlay">
              <button type="button" className="ui-photo__change" onClick={() => ref.current.click()}>
                Заменить
              </button>
              <button type="button" className="ui-photo__del" onClick={() => onChange(null)}>
                Удалить
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="ui-photo__empty" onClick={() => !uploading && ref.current.click()}>
          <span className="ui-photo__ic">{uploading ? '⏳' : '📷'}</span>
          <span className="ui-photo__txt">{uploading ? 'Загружается...' : placeholder}</span>
          {!uploading && <span className="ui-photo__hint">JPG, PNG, WEBP · до 5 МБ</span>}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
