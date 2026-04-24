import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  completeDefectRework,
  createDefect,
  deleteDefect,
  sellDefect,
  sendDefectToRework,
  updateDefect,
  writeoffDefect,
} from '../../api/defectsApi';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'on_stock', label: 'На складе брака' },
  { value: 'sent_to_rework', label: 'На переработке' },
  { value: 'reworked', label: 'Переработан' },
  { value: 'sold', label: 'Продан' },
  { value: 'written_off', label: 'Списан' },
];

const statusLabel = (v) => STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';

const statusVariant = (v) => {
  switch (v) {
    case 'new': return 'default';
    case 'on_stock': return 'warning';
    case 'sent_to_rework': return 'primary';
    case 'reworked': return 'success';
    case 'sold': return 'success';
    case 'written_off': return 'danger';
    default: return 'default';
  }
};

const sourceLabel = (t) => {
  if (t === 'otk') return 'ОТК';
  if (t === 'return') return 'Возврат';
  return t || '—';
};

const canEditDefect = (s) => ['new', 'on_stock'].includes(s);
const canSendDefectToRework = (s) => ['new', 'on_stock'].includes(s);
const canCompleteDefectRework = (s) => s === 'sent_to_rework';
const canSellOrWriteoffDefect = (s) => s === 'on_stock';
const canDeleteDefect = (s) => s === 'new';

const DefectsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDefect, setModalDefect] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [writeoffTarget, setWriteoffTarget] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [sendReworkTarget, setSendReworkTarget] = useState(null);
  const [completeReworkTarget, setCompleteReworkTarget] = useState(null);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [sellClient, setSellClient] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [clients, setClients] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const { items, meta, raw, loading, error, refetch } = useServerQuery('defects/', queryState, { enabled: true });
  useOperationalRefetch(['defect_record', 'sale', 'rework_request'], refetch, true);

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const r = raw;
    const ps = Number(queryState.page_size) || 20;
    if (r && typeof r.count === 'number' && ps > 0) {
      const pages = Math.max(1, Math.ceil(r.count / ps));
      return { page: queryState.page, pages, total: r.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
  }, []);

  const onSubmitDefect = async (payload) => {
    setSubmitError('');
    try {
      if (modalDefect?.id) await updateDefect(modalDefect.id, payload);
      else await createDefect(payload);
      setModalDefect(null);
      refetch();
      toast.show('Запись брака сохранена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения записи брака'));
    }
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setSubmitError('');
    try {
      await deleteDefect(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Запись брака удалена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления'));
    }
  };

  const runAction = async (fn, okText) => {
    setSubmitError('');
    try {
      await fn();
      refetch();
      toast.show(okText);
      return true;
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
      return false;
    }
  };

  const deleteMessage = deleteTarget
    ? `Удалить запись брака по продукту «${deleteTarget.product || 'без названия'}»?`
    : '';

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]}
            placeholder="Статус"
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDefect({})}>Создать брак</button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет записей брака" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <>
          <div className="commercial-table-wrap">
            <table className="data-table data-table--fixed data-table--row-actions">
            <thead>
              <tr>
                <th>Продукт</th>
                <th className="data-table__cell--num">Количество</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Причина</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const st = d.status;
                const menuItems = [];
                if (canEditDefect(st)) {
                  menuItems.push({ label: 'Редактировать', onClick: () => setModalDefect(d) });
                }
                if (canSendDefectToRework(st)) {
                  menuItems.push({
                    label: 'На переработку',
                    onClick: () => { setSendReworkTarget(d); setSubmitError(''); },
                  });
                }
                if (canCompleteDefectRework(st)) {
                  menuItems.push({
                    label: 'Завершить переработку',
                    onClick: () => { setCompleteReworkTarget(d); setSubmitError(''); },
                  });
                }
                if (canSellOrWriteoffDefect(st)) {
                  menuItems.push({
                    label: 'Продать',
                    onClick: () => {
                      setSellTarget(d);
                      setSellQty(String(d.quantity_pcs ?? ''));
                      setSellClient('');
                      setSellPrice('');
                      setSubmitError('');
                    },
                  });
                  menuItems.push({
                    label: 'Списать',
                    danger: true,
                    onClick: () => { setWriteoffTarget(d); setWriteoffReason(''); setSubmitError(''); },
                  });
                }
                if (canDeleteDefect(st)) {
                  menuItems.push({
                    label: 'Удалить',
                    danger: true,
                    onClick: () => { setDeleteTarget(d); setSubmitError(''); },
                  });
                }

                return (
                  <tr key={d.id}>
                    <td>{d.product || '—'}</td>
                    <td className="data-table__cell--num">{d.quantity_pcs != null ? formatQuantityDisplay(d.quantity_pcs) : '—'}</td>
                    <td>{sourceLabel(d.source_type)}</td>
                    <td><Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></td>
                    <td>{d.defect_reason || d.writeoff_reason || '—'}</td>
                    <td>
                      {menuItems.length ? (
                        <ActionMenu ariaLabel="Действия" items={menuItems} />
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
        </>
      )}

      {modalDefect && (
        <DefectModal
          defect={modalDefect?.id ? modalDefect : null}
          onClose={() => { setModalDefect(null); setSubmitError(''); }}
          onSubmit={onSubmitDefect}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить запись брака?"
        message={deleteMessage}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!sendReworkTarget}
        title="Передать на переработку"
        message="Статус записи брака изменится на сервере. Продолжить?"
        confirmText="Передать"
        onConfirm={async () => {
          if (!sendReworkTarget?.id) return;
          const ok = await runAction(() => sendDefectToRework(sendReworkTarget.id), 'Передано на переработку');
          if (ok) setSendReworkTarget(null);
        }}
        onCancel={() => { setSendReworkTarget(null); setSubmitError(''); }}
        error={sendReworkTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!completeReworkTarget}
        title="Завершить переработку"
        message="Завершить переработку по этой записи брака на сервере?"
        confirmText="Завершить"
        onConfirm={async () => {
          if (!completeReworkTarget?.id) return;
          const ok = await runAction(() => completeDefectRework(completeReworkTarget.id), 'Переработка завершена');
          if (ok) setCompleteReworkTarget(null);
        }}
        onCancel={() => { setCompleteReworkTarget(null); setSubmitError(''); }}
        error={completeReworkTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!writeoffTarget}
        title="Списать брак"
        message={(
          <div>
            <p>Укажите причину списания:</p>
            <textarea rows={3} value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} />
          </div>
        )}
        confirmText="Списать"
        onConfirm={async () => {
          const reason = writeoffReason.trim();
          if (!reason) {
            setSubmitError('Укажите причину списания');
            return;
          }
          if (!writeoffTarget?.id) return;
          const ok = await runAction(() => writeoffDefect(writeoffTarget.id, reason), 'Брак списан');
          if (ok) {
            setWriteoffTarget(null);
            setWriteoffReason('');
          }
        }}
        onCancel={() => { setWriteoffTarget(null); setWriteoffReason(''); setSubmitError(''); }}
        error={writeoffTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!sellTarget}
        title="Продать брак"
        message={(
          <div>
            <label>Клиент</label>
            <Select
              value={sellClient}
              onChange={setSellClient}
              options={[{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || 'Без названия' }))]}
            />
            <label>Цена</label>
            <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            <label>Количество</label>
            <input value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
          </div>
        )}
        confirmText="Продать"
        onConfirm={async () => {
          const cid = Number(sellClient);
          const price = parseLocaleNumber(sellPrice);
          const qty = parseLocaleNumber(sellQty);
          if (!sellClient || !Number.isFinite(cid) || cid <= 0) {
            setSubmitError('Выберите клиента');
            return;
          }
          if (!Number.isFinite(price) || price < 0) {
            setSubmitError('Укажите корректную цену');
            return;
          }
          if (!Number.isFinite(qty) || qty <= 0) {
            setSubmitError('Укажите корректное количество');
            return;
          }
          if (!sellTarget?.id) return;
          const ok = await runAction(
            () => sellDefect(sellTarget.id, {
              client_id: cid,
              price,
              quantity: qty,
              date: new Date().toISOString().slice(0, 10),
            }),
            'Продажа брака создана',
          );
          if (ok) setSellTarget(null);
        }}
        onCancel={() => { setSellTarget(null); setSubmitError(''); }}
        error={sellTarget ? submitError : undefined}
      />
    </div>
  );
};

const DefectModal = ({ defect, onClose, onSubmit, error }) => {
  const [sourceType, setSourceType] = useState(defect?.source_type || 'return');
  const [product, setProduct] = useState(defect?.product || '');
  const [quantityPcs, setQuantityPcs] = useState(defect?.quantity_pcs != null ? String(defect.quantity_pcs) : '');
  const [kgCoeff, setKgCoeff] = useState(defect?.kg_coefficient != null ? String(defect.kg_coefficient) : '');
  const [reason, setReason] = useState(defect?.defect_reason || '');
  const [comment, setComment] = useState(defect?.comment || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{defect ? 'Брак' : 'Новая запись брака'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              source_type: sourceType,
              product: product.trim(),
              quantity_pcs: parseLocaleNumber(quantityPcs) || 0,
              ...(kgCoeff ? { kg_coefficient: parseLocaleNumber(kgCoeff) } : {}),
              defect_reason: reason.trim() || undefined,
              comment: comment.trim() || undefined,
            });
          }}
        >
          <label>Источник</label>
          <Select value={sourceType} onChange={setSourceType} options={[{ value: 'otk', label: 'ОТК' }, { value: 'return', label: 'Возврат' }]} />
          <label>Продукт *</label>
          <input value={product} onChange={(e) => setProduct(e.target.value)} required />
          <label>Количество (шт) *</label>
          <input value={quantityPcs} onChange={(e) => setQuantityPcs(e.target.value)} required />
          <label>Коэффициент кг/ед.</label>
          <input value={kgCoeff} onChange={(e) => setKgCoeff(e.target.value)} />
          <label>Причина брака</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DefectsPage;
