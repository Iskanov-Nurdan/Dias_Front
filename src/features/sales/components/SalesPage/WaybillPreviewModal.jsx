import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { Loading } from '../../../../shared/ui';
import { downloadSaleWaybill } from '../../api/salesApi';
import { WAYBILL_DEFAULT_UNIT, WAYBILL_SUPPLIER } from '../../config/waybillConfig';
import './WaybillPreviewModal.scss';

const toDate = (value) => (value ? String(value).slice(0, 10) : '—');

const toMoney = (value) => {
  if (value == null || value === '') return '0';
  return formatQuantityDisplay(value);
};

const normalizeLines = (sale) => {
  const raw = Array.isArray(sale?.lines) ? sale.lines : [];
  return raw
    .map((line, idx) => {
      const quantity = parseLocaleNumber(line?.quantity ?? line?.sold_pieces ?? line?.ordered_quantity ?? 0) || 0;
      const unitPrice = parseLocaleNumber(line?.unit_price ?? line?.price ?? 0) || 0;
      return {
        id: line?.id ?? idx + 1,
        name: line?.product_name ?? line?.product?.name ?? line?.product ?? 'Товар',
        unit: line?.unit ?? line?.quantity_unit_label ?? WAYBILL_DEFAULT_UNIT,
        quantity,
        unitPrice,
        sum: Number((quantity * unitPrice).toFixed(2)),
      };
    })
    .filter((line) => line.quantity > 0 || line.unitPrice > 0 || line.name);
};

const WaybillCopy = ({ sale }) => {
  const lines = useMemo(() => normalizeLines(sale), [sale]);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.sum, 0),
    [lines],
  );
  const number = sale?.invoice_number || sale?.sale_number || sale?.id || '—';
  const buyer = sale?.client_name || sale?.client?.name || '—';

  return (
    <section className="waybill-copy">
      <h2 className="waybill-copy__title">Расходная накладная № {number}</h2>
      <div className="waybill-copy__meta">
        <p><strong>Дата:</strong> {toDate(sale?.sale_date || sale?.date || sale?.created_at)}</p>
        <p><strong>Поставщик:</strong> {WAYBILL_SUPPLIER.name}</p>
        <p><strong>Телефон:</strong> {WAYBILL_SUPPLIER.phone}</p>
        <p><strong>Покупатель:</strong> {buyer}</p>
      </div>

      <table className="waybill-copy__table">
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование товара</th>
            <th>Ед. изм.</th>
            <th>Количество</th>
            <th>Цена</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id}>
              <td>{idx + 1}</td>
              <td>{line.name}</td>
              <td>{line.unit}</td>
              <td>{toMoney(line.quantity)}</td>
              <td>{toMoney(line.unitPrice)}</td>
              <td>{toMoney(line.sum)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={6}>Нет строк для печати</td>
            </tr>
          )}
          <tr className="waybill-copy__total-row">
            <td colSpan={5}>Итого</td>
            <td>{toMoney(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="waybill-copy__signatures">
        <div className="waybill-copy__sign-item">
          <span>Отпустил</span>
          <span className="waybill-copy__sign-line" />
        </div>
        <div className="waybill-copy__sign-item">
          <span>Получил</span>
          <span className="waybill-copy__sign-line" />
        </div>
        <div className="waybill-copy__sign-item">
          <span>М.П.</span>
          <span className="waybill-copy__sign-line" />
        </div>
      </div>
    </section>
  );
};

const WaybillPreviewModal = ({ saleId, onClose }) => {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyDownload, setBusyDownload] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get(`sales/${saleId}/`);
        if (!alive) return;
        setSale(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить накладную'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [saleId]);

  const onPrint = () => {
    window.print();
  };

  const onDownload = async () => {
    if (!sale?.id) return;
    setBusyDownload(true);
    try {
      await downloadSaleWaybill(sale.id, sale);
    } finally {
      setBusyDownload(false);
    }
  };

  return (
    <div className="modal-overlay waybill-preview-modal" onClick={onClose}>
      <div className="modal waybill-preview-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head waybill-preview-modal__head">
          <h3>Предпросмотр накладной</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="waybill-preview-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && sale && (
            <div className="waybill-print-sheet">
              <WaybillCopy sale={sale} />
              <div className="waybill-print-sheet__divider" />
              <WaybillCopy sale={sale} />
            </div>
          )}
        </div>

        <div className="modal__actions waybill-preview-modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
          <button type="button" className="btn btn--secondary" onClick={onDownload} disabled={busyDownload || loading || !!error}>
            {busyDownload ? 'Скачивание...' : 'Скачать'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onPrint} disabled={loading || !!error}>Печать</button>
        </div>
      </div>
    </div>
  );
};

export default WaybillPreviewModal;

