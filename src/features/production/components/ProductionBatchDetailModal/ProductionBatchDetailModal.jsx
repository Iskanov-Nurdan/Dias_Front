import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getProductionBatch,
  updateProductionBatch,
  submitProductionBatchForOtk,
} from '../../api/productionApi';
import { getApiErrorMessage, formatNumberForInput, parseLocaleNumber } from '../../../../shared/lib';
import { Loading, DecimalInput, IntegerInput, useToast } from '../../../../shared/ui';
import {
  batchProductionLifecycleRu,
  batchMetaEditable,
  canSendProductionBatchToOtk,
  costPerMeterFromBatch,
  costPerPieceFromBatch,
  materialCostTotalFromBatch,
  batchTotalMetersDisplay,
} from '../../lib/batchMeta';

const lineLabel = (b) => b.line_name || b.line?.name || '—';
const profileLabel = (b) =>
  b.profile?.name || b.profile_name || '—';
const recipeLabel = (b) =>
  b.recipe?.recipe || b.recipe?.name || b.recipe_name || '—';

const money = (n) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${formatNumberForInput(n)} сом`;
};

const ProductionBatchDetailModal = ({ batchId, onClose, onSaved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const [pieces, setPieces] = useState('');
  const [lengthPerPiece, setLengthPerPiece] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [otkSending, setOtkSending] = useState(false);

  const load = useCallback(() => {
    if (batchId == null) return;
    setLoading(true);
    setErr('');
    getProductionBatch(batchId)
      .then((res) => {
        const b = res.data;
        setBatch(b);
        setPieces(b?.pieces != null ? String(b.pieces) : '');
        setLengthPerPiece(
          b?.length_per_piece != null ? formatNumberForInput(parseLocaleNumber(b.length_per_piece)) : '',
        );
        setComment(b?.comment != null ? String(b.comment) : '');
        setEdit(false);
      })
      .catch((e) => {
        setErr(getApiErrorMessage(e, 'Не удалось загрузить партию'));
        setBatch(null);
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const life = useMemo(() => (batch ? batchProductionLifecycleRu(batch) : null), [batch]);
  const editable = batch ? batchMetaEditable(batch) : false;
  const canOtk = batch ? canSendProductionBatchToOtk(batch) : false;
  const cpm = batch ? costPerMeterFromBatch(batch) : null;
  const cpp = batch ? costPerPieceFromBatch(batch) : null;
  const ctot = batch ? materialCostTotalFromBatch(batch) : null;
  const tm = batch ? batchTotalMetersDisplay(batch) : null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!batch) return;
    setErr('');
    const p = parseInt(String(pieces).trim(), 10);
    const len = parseLocaleNumber(lengthPerPiece);
    if (!Number.isFinite(p) || p <= 0) {
      setErr('Укажите количество штук > 0');
      return;
    }
    if (!Number.isFinite(len) || len <= 0) {
      setErr('Укажите длину одной штуки, м > 0');
      return;
    }
    setSaving(true);
    try {
      const { data } = await updateProductionBatch(batch.id, {
        pieces: p,
        length_per_piece: len,
        ...(String(comment).trim() ? { comment: String(comment).trim() } : { comment: '' }),
      });
      setBatch(data);
      setEdit(false);
      onSaved?.();
      toast.success('Сохранено');
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Ошибка сохранения'));
    } finally {
      setSaving(false);
    }
  };

  const handleOtk = async () => {
    if (!batch) return;
    setErr('');
    setOtkSending(true);
    try {
      await submitProductionBatchForOtk(batch.id);
      toast.success('Партия передана в ОТК');
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Не удалось передать в ОТК'));
    } finally {
      setOtkSending(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide production-detail-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Партия №{batchId}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body">
          {loading && <Loading />}
          {!loading && err && !batch && <p className="modal__error">{err}</p>}
          {!loading && batch && (
            <>
              <div className="production-detail-modal__grid">
                <div>
                  <span className="production-detail-modal__k">Статус</span>
                  <span className="production-detail-modal__v">{life?.label ?? '—'}</span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Линия</span>
                  <span className="production-detail-modal__v">{lineLabel(batch)}</span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Профиль</span>
                  <span className="production-detail-modal__v">{profileLabel(batch)}</span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Рецепт</span>
                  <span className="production-detail-modal__v">{recipeLabel(batch)}</span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Метры (итог)</span>
                  <span className="production-detail-modal__v">
                    {tm != null ? formatNumberForInput(tm) : '—'}
                  </span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Себестоимость / м</span>
                  <span className="production-detail-modal__v">{money(cpm)}</span>
                </div>
                <div>
                  <span className="production-detail-modal__k">Себестоимость / шт</span>
                  <span className="production-detail-modal__v">{money(cpp)}</span>
                </div>
                {ctot != null && Number.isFinite(ctot) ? (
                  <div>
                    <span className="production-detail-modal__k">Материалы, всего</span>
                    <span className="production-detail-modal__v">{money(ctot)}</span>
                  </div>
                ) : null}
              </div>
              <p className="production-detail-modal__hint" style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                Метраж и себестоимость считаются на сервере при создании партии.
              </p>

              {!edit ? (
                <div className="production-detail-modal__readonly">
                  <p>
                    <strong>Штук:</strong> {batch.pieces ?? '—'}
                  </p>
                  <p>
                    <strong>Длина штуки, м:</strong>{' '}
                    {batch.length_per_piece != null
                      ? formatNumberForInput(parseLocaleNumber(batch.length_per_piece))
                      : '—'}
                  </p>
                  {batch.comment ? (
                    <p>
                      <strong>Комментарий:</strong> {batch.comment}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form className="production-detail-modal__form" onSubmit={handleSave}>
                  <label>Штук *</label>
                  <IntegerInput min={1} value={pieces} onChange={setPieces} required className="input" />
                  <label>Длина одной штуки, м *</label>
                  <DecimalInput min={0} value={lengthPerPiece} onChange={setLengthPerPiece} required />
                  <label>Комментарий</label>
                  <textarea rows={2} value={comment} onChange={(ev) => setComment(ev.target.value)} />
                  {err && <p className="modal__error">{err}</p>}
                  <div className="modal__actions">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        setEdit(false);
                        setErr('');
                        load();
                      }}
                      disabled={saving}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              {err && batch && !edit && <p className="modal__error">{err}</p>}

              <div className="modal__actions production-detail-modal__actions">
                {!edit && editable && (
                  <button type="button" className="btn btn--secondary" onClick={() => setEdit(true)}>
                    Редактировать
                  </button>
                )}
                {canOtk && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleOtk}
                    disabled={otkSending || edit}
                  >
                    {otkSending ? 'Отправка…' : 'Отправить в ОТК'}
                  </button>
                )}
                <button type="button" className="btn btn--secondary" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionBatchDetailModal;
