import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperationalRefetch, WS_WORKSHOP } from '../../../../shared/realtime';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../../../shared/api';
import { getApiErrorMessage } from '../../../../shared/lib';
import { useToast, Loading, ErrorState } from '../../../../shared/ui';
import {
  getWorkshopBlank,
  getWorkshopPreparedBlanks,
  mapWorkshopBlankFromApi,
  mapPreparedBlankRowFromApi,
  postWorkshopAddBarrel,
} from '../../api/blankWorkshopApi';
import { FiPlus } from 'react-icons/fi';
import EmployeeBlankDetailContent from './EmployeeBlankDetailContent';
import '../ChemistryPage/ChemistryPage.scss';
import './EmployeePrepareBlanksPage.scss';

const EmployeeBlankDetailPage = () => {
  const { blankId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [blank, setBlank] = useState(null);
  const [preparedRow, setPreparedRow] = useState(null);
  const [materialNameById, setMaterialNameById] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingBarrel, setAddingBarrel] = useState(false);

  const load = useCallback(async () => {
    if (!blankId) return;
    setLoading(true);
    setError('');
    try {
      const [blankRes, prepRes, rawRes] = await Promise.all([
        getWorkshopBlank(blankId),
        getWorkshopPreparedBlanks({ page: 1, page_size: 500 }),
        apiClient.get('raw-materials/', { params: { page: 1, page_size: 500, ordering: 'name' } }),
      ]);
      const mapped = mapWorkshopBlankFromApi(blankRes.data);
      setBlank(mapped);
      const prepItems = prepRes.data?.items ?? prepRes.data?.results ?? [];
      const prep = prepItems
        .map(mapPreparedBlankRowFromApi)
        .find((r) => r && String(r.blankId) === String(blankId));
      setPreparedRow(prep || null);
      const rawItems = rawRes.data?.items ?? rawRes.data?.results ?? [];
      const m = new Map();
      rawItems.forEach((x) => {
        if (x?.id != null) m.set(String(x.id), x.name || ` #${x.id}`);
      });
      setMaterialNameById(m);
    } catch (err) {
      setBlank(null);
      setPreparedRow(null);
      setError(getApiErrorMessage(err, 'Не удалось загрузить заготовку'));
    } finally {
      setLoading(false);
    }
  }, [blankId]);

  useEffect(() => {
    load();
  }, [load]);

  useOperationalRefetch(WS_WORKSHOP, load, Boolean(blankId));

  const canAddBarrel = useMemo(() => {
    const rkg = Number(blank?.recipeKgPerBarrel) || 0;
    return rkg > 0;
  }, [blank]);

  const onAddBarrel = async () => {
    if (!blank?.id) return;
    setAddingBarrel(true);
    try {
      await postWorkshopAddBarrel(Number(blank.id));
      toast.success('Добавлена 1 бочка');
      await load();
    } catch (err) {
      toast.apiError(err, 'Не удалось добавить бочку');
    } finally {
      setAddingBarrel(false);
    }
  };

  return (
    <div className="employee-prepare-detail-view">
      <header className="employee-prepare-detail-view__header">
        <div className="employee-prepare-detail-view__header-main">
          <button
            type="button"
            className="employee-prepare-detail-view__back"
            onClick={() => navigate('/prepare-blanks')}
          >
            ← К списку
          </button>
          <Link to="/prepare-blanks" className="employee-prepare-detail-view__list-link">
            Цех
          </Link>
          <h1 className="employee-prepare-detail-view__title">
            {blank?.name || 'Заготовка'}
          </h1>
        </div>
        <div className="employee-prepare-detail-view__header-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAddBarrel || addingBarrel}
            onClick={onAddBarrel}
          >
            <FiPlus aria-hidden size={16} strokeWidth={2} />
            {addingBarrel ? '…' : 'Бочка'}
          </button>
        </div>
      </header>

      <main className="employee-prepare-detail-view__main">
        {loading && <Loading />}
        {!loading && error && <ErrorState error={error} onRetry={load} />}
        {!loading && !error && blank && (
          <EmployeeBlankDetailContent
            blank={blank}
            preparedRow={preparedRow}
            materialNameById={materialNameById}
            variant="page"
          />
        )}
      </main>
    </div>
  );
};

export default EmployeeBlankDetailPage;
