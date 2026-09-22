import React, { useState, useEffect, useCallback } from 'react';
import { fetchPreparedBlanks, addBarrel } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { ConfirmModal } from '../../shared/ui';
import { PreparedBlanksList, FloorDetailModal } from './components';
import './WorkshopPage.scss';

/** «Цех» — отдельная страница (не вкладка «Заготовки»): в сайдбаре это свой пункт меню. */
const WorkshopFloorPage = () => {
  const toast = useToast();
  const [prepared, setPrepared] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingBarrelId, setAddingBarrelId] = useState(null);
  const [detailsBlank, setDetailsBlank] = useState(null);
  // Списывает реальное сырьё по FIFO — такое же по цене ошибки действие,
  // как удаление, поэтому подтверждаем так же, как и везде в приложении.
  const [confirmBarrel, setConfirmBarrel] = useState(null);
  // Бампится при каждом успешном добавлении бочки — окно «Подробнее», если
  // оно открыто на этой же заготовке, перечитывает данные по этому триггеру.
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    // Свой формат пагинации у этого эндпоинта: {count, next, previous, results}.
    fetchPreparedBlanks(null)
      .then((data) => setPrepared(data?.results ?? []))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestAddBarrel = (row) => setConfirmBarrel(row);

  const confirmAddBarrel = () => {
    if (!confirmBarrel) return;
    const { blank_id: blankId, blank_name: blankName } = confirmBarrel;
    setConfirmBarrel(null);
    setAddingBarrelId(blankId);
    addBarrel(blankId, null)
      .then(() => {
        load();
        setRefreshToken((v) => v + 1);
        toast.success(`Бочка добавлена: ${blankName}`);
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setAddingBarrelId(null));
  };

  return (
    <div className="workshop-page">
      <PreparedBlanksList
        items={prepared}
        loading={loading}
        error={error}
        onRetry={load}
        onAddBarrel={requestAddBarrel}
        addingBarrelId={addingBarrelId}
        onDetails={setDetailsBlank}
      />

      {detailsBlank && (
        <FloorDetailModal
          blankId={detailsBlank.blank_id}
          blankName={detailsBlank.blank_name}
          refreshToken={refreshToken}
          onClose={() => setDetailsBlank(null)}
          onRequestAddBarrel={() => requestAddBarrel(detailsBlank)}
          addingBarrel={addingBarrelId === detailsBlank.blank_id}
        />
      )}

      {confirmBarrel && (
        <ConfirmModal
          title="Добавить бочку?"
          message={`Спишет сырьё по рецепту «${confirmBarrel.blank_name}» и добавит 1 бочку на цех. Действие нельзя отменить.`}
          confirmText="Добавить"
          onConfirm={confirmAddBarrel}
          onCancel={() => setConfirmBarrel(null)}
        />
      )}
    </div>
  );
};

export default WorkshopFloorPage;
