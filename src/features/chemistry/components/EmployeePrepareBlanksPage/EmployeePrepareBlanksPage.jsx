import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useServerQuery,
  formatNumberForInput,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { useToast, EmptyState, ErrorState, Loading } from '../../../../shared/ui';
import {
  mapWorkshopBlankFromApi,
  mapPreparedBlankRowFromApi,
  postWorkshopAddBarrel,
} from '../../api/blankWorkshopApi';
import '../ChemistryPage/ChemistryPage.scss';
import './EmployeePrepareBlanksPage.scss';
import { useOperationalRefetch, WS_WORKSHOP } from '../../../../shared/realtime';

const formatWorkshopNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return formatNumberForInput(value);
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return formatNumberForInput(rounded);
};

const listQuery = { page: 1, page_size: 500, ordering: 'name' };

const EmployeePrepareBlanksPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const blanksQ = useMemo(() => listQuery, []);
  const preparedQ = useMemo(() => listQuery, []);
  const materialsQ = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);

  const {
    items: blankItems,
    loading: blanksLoading,
    error: blanksError,
    refetch: refetchBlanks,
  } = useServerQuery('workshop/blanks/', blanksQ, { enabled: true });
  const {
    items: preparedItems,
    loading: prepLoading,
    error: prepError,
    refetch: refetchPrepared,
  } = useServerQuery('workshop/prepared-blanks/', preparedQ, { enabled: true });
  const { items: rawItems } = useServerQuery('raw-materials/', materialsQ, { enabled: true });

  const blanks = useMemo(
    () => (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean),
    [blankItems],
  );

  const preparedByBlankId = useMemo(() => {
    const m = new Map();
    (preparedItems || []).forEach((row) => {
      const mapped = mapPreparedBlankRowFromApi(row);
      if (mapped?.blankId) m.set(mapped.blankId, mapped);
    });
    return m;
  }, [preparedItems]);

  const materialNameById = useMemo(() => {
    const m = new Map();
    (rawItems || []).forEach((x) => {
      if (x?.id != null) m.set(String(x.id), x.name || ` #${x.id}`);
    });
    return m;
  }, [rawItems]);

  const rows = useMemo(
    () =>
      blanks.map((b) => {
        const sid = String(b.id);
        const prep = preparedByBlankId.get(sid);
        const rkg = Number(b.recipeKgPerBarrel) || 0;
        const breakdown = prep || {
          blankId: sid,
          barrels: 0,
          extraKg: 0,
          recipeKgPerBarrel: rkg,
          totalKg: 0,
          fromMachineRemainderKg: null,
          fromDefectKg: null,
          pureKg: null,
        };
        if (!prep && rkg > 0) {
          breakdown.recipeKgPerBarrel = rkg;
          breakdown.totalKg = breakdown.barrels * rkg + breakdown.extraKg;
        }
        return { blank: b, breakdown };
      }),
    [blanks, preparedByBlankId],
  );

  const loading = blanksLoading || prepLoading;
  const error = blanksError || prepError;

  const refetchAll = useCallback(() => {
    refetchBlanks();
    refetchPrepared();
  }, [refetchBlanks, refetchPrepared]);

  useOperationalRefetch(WS_WORKSHOP, refetchAll, true);

  const onAddBarrel = async (blankId) => {
    try {
      await postWorkshopAddBarrel(Number(blankId));
      toast.success('Добавлена 1 бочка');
      refetchPrepared();
    } catch (err) {
      toast.apiError(err, 'Не удалось добавить бочку');
    }
  };

  return (
    <div className="page page--chemistry chemistry-blank-stock">
      <div className="chemistry-card">
        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={refetchAll} />}
        {!loading && !error && blanks.length === 0 && (
          <EmptyState title="Нет заготовок — создайте рецепт во вкладке «Заготовка»" />
        )}
        {!loading && !error && blanks.length > 0 && (
          <div className="chemistry-table-wrap">
            <div className="chemistry-table employee-prepare-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Рецепт</span>
                <span className="chemistry-table__th chemistry-table__th--num">кг / бочка</span>
                <span className="chemistry-table__th chemistry-table__th--num">Бочек</span>
                <span className="chemistry-table__th chemistry-table__th--num">Доп. кг</span>
                <span className="chemistry-table__th chemistry-table__th--num">Всего, кг</span>
                <span className="chemistry-table__th chemistry-table__th--actions"> </span>
              </div>
              {rows.map(({ blank, breakdown }) => (
                <div key={blank.id} className="chemistry-table__row">
                  <span className="chemistry-table__name chemistry-table__cell-clip">
                    {blank.name || '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {breakdown.recipeKgPerBarrel > 0
                      ? `${formatWorkshopNumber(breakdown.recipeKgPerBarrel)} кг`
                      : '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {formatWorkshopNumber(breakdown.barrels)}
                  </span>
                  <span className="chemistry-table__num">
                    {`${formatWorkshopNumber(breakdown.extraKg)} кг`}
                  </span>
                  <span className="chemistry-table__num">
                    {`${formatWorkshopNumber(breakdown.totalKg)} кг`}
                  </span>
                  <span className="chemistry-table__actions chemistry-table__actions--wrap">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => navigate(`/prepare-blanks/${blank.id}`)}
                    >
                      Подробности
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={!breakdown.recipeKgPerBarrel || breakdown.recipeKgPerBarrel <= 0}
                      onClick={() => onAddBarrel(blank.id)}
                    >
                      + бочка
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePrepareBlanksPage;
