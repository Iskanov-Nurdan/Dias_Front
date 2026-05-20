import React, { useMemo, useState, useCallback } from 'react';
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
import EmployeeBlankDetailContent from './EmployeeBlankDetailContent';
import '../ChemistryPage/ChemistryPage.scss';
import './EmployeePrepareBlanksPage.scss';

const prepareBlankDetailPageUrl = (blankId) =>
  `${window.location.origin}/prepare-blanks/view/${blankId}`;

const EmployeeBlankDetailModal = ({ blank, preparedRow, materialNameById, onClose }) => {
  if (!blank) return null;

  const openFullPage = () => {
    window.open(prepareBlankDetailPageUrl(blank.id), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide employee-prepare-detail-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="employee-prepare-detail-title"
      >
        <div className="modal__head">
          <h3 id="employee-prepare-detail-title">Подробности: {blank.name || 'Заготовка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body employee-prepare-detail-modal__body">
          <EmployeeBlankDetailContent
            blank={blank}
            preparedRow={preparedRow}
            materialNameById={materialNameById}
            variant="modal"
          />
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={openFullPage}>
            Страница
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const listQuery = { page: 1, page_size: 500, ordering: 'name' };

const EmployeePrepareBlanksPage = () => {
  const toast = useToast();
  const [detail, setDetail] = useState(null);

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

  const onAddBarrel = async (blankId) => {
    try {
      await postWorkshopAddBarrel(Number(blankId));
      toast.show('Добавлена 1 бочка');
      refetchPrepared();
    } catch (err) {
      toast.show(getApiErrorMessage(err, 'Не удалось добавить бочку'));
    }
  };

  const detailPrepared = detail ? preparedByBlankId.get(String(detail.id)) : null;

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
                      ? `${formatNumberForInput(breakdown.recipeKgPerBarrel)} кг`
                      : '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {formatNumberForInput(breakdown.barrels)}
                  </span>
                  <span className="chemistry-table__num">
                    {`${formatNumberForInput(breakdown.extraKg)} кг`}
                  </span>
                  <span className="chemistry-table__num">
                    {`${formatNumberForInput(breakdown.totalKg)} кг`}
                  </span>
                  <span className="chemistry-table__actions chemistry-table__actions--wrap">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setDetail(blank)}
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
      {detail ? (
        <EmployeeBlankDetailModal
          blank={detail}
          preparedRow={detailPrepared}
          materialNameById={materialNameById}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
};

export default EmployeePrepareBlanksPage;
