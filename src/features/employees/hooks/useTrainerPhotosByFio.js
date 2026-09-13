import { useEffect, useState } from 'react';
import { loadTaplinkDataAsync } from '../../taplink/taplinkStore';

const normalizeFio = (v) => (v || '').trim().toLowerCase();

/**
 * Фото сотрудников по ФИО — то же самое, что уже загружено в карточке
 * тренера («Спорт и тренеры»).
 *
 * Employee (сотрудник с логином) и Trainer (тренер с фото на публичной
 * странице) — разные сущности без общего id, поэтому единственная связь
 * между ними — совпадение ФИО: при выдаче доступа тренеру логин заводится
 * с тем же fio, что указан в карточке тренера. Конфиг Taplink кешируется
 * в localStorage (см. taplinkStore), так что повторный вызов на других
 * страницах ничего не перезапрашивает.
 *
 * Возвращает функцию getPhoto(fio), а не сырую карту: сравнение уже
 * нормализовано (обрезка пробелов, регистр), и вызывающему не нужно об
 * этом помнить на каждом месте использования.
 */
export function useTrainerPhotosByFio() {
  const [photosByFio, setPhotosByFio] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadTaplinkDataAsync()
      .then((cfg) => {
        if (cancelled) return;
        const map = {};
        for (const t of cfg?.trainers ?? []) {
          const key = normalizeFio(t?.name);
          if (key && t?.photo) map[key] = t.photo;
        }
        setPhotosByFio(map);
      })
      // Конфиг не загрузился — не повод ронять список: останутся инициалы
      .catch(() => { if (!cancelled) setPhotosByFio({}); });
    return () => { cancelled = true; };
  }, []);

  const getPhoto = (fio) => (photosByFio ? photosByFio[normalizeFio(fio)] ?? null : null);
  return getPhoto;
}
