import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast, Select, RecordDetailsModal, DetailFields } from '../../../../shared/ui';
import { formatNumberForInput, matchesClientDateFilter, pickFirstIsoDate } from '../../../../shared/lib';
import { getOtkAccountHistory } from '../../../otk/api/otkWorkshopApi';
import { useOperationalRefetch, WS_OTK } from '../../../../shared/realtime';
import './OtkStaffReportTab.scss';

const formatDateTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dt);
  }
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const profilesSummary = (lines) => {
  if (!lines?.length) return '—';
  return lines.map((ln) => `${ln.profileName || 'Профиль'}: ${ln.pieces} шт`).join('; ');
};

const formatShiftPeriod = (v) => {
  if (v === 'night') return 'Ночь';
  if (v === 'day') return 'День';
  return '';
};

const staffInRow = (row) => {
  const packers = (row.packerNames?.length
    ? row.packerNames.map((name, i) => ({
      id: row.packerIds?.[i] ?? '',
      name,
      role: 'Упаковщик',
    }))
    : row.packerName
      ? [{ id: row.packerId, name: row.packerName, role: 'Упаковщик' }]
      : []);
  return [
    { id: row.operatorId, name: row.operatorName, role: 'Оператор' },
    { id: row.chemistId, name: row.chemistName, role: 'Химик' },
    ...packers,
  ].filter((s) => s.id || s.name);
};

const formatPackersCell = (row) => {
  if (row.packerNames?.length) return row.packerNames.join(', ');
  if (row.packerName) return row.packerName;
  return '—';
};

const OtkStaffReportTab = ({ users = [] }) => {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayDate());
  const [filterUser, setFilterUser] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOtkAccountHistory({
        page: 1,
        page_size: 500,
        ordering: '-created_at',
      });
      setRows(data);
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error('Не удалось загрузить учёты ОТК');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useOperationalRefetch(WS_OTK, load, true);

  const visible = useMemo(() => {
    let list = rows;
    if (filterDate) {
      list = list.filter((row) =>
        matchesClientDateFilter(filterDate, pickFirstIsoDate(row, ['createdAt'])),
      );
    }
    if (filterUser) {
      const uid = String(filterUser);
      list = list.filter(
        (row) =>
          String(row.operatorId) === uid
          || String(row.chemistId) === uid
          || String(row.packerId) === uid,
      );
    }
    return list;
  }, [rows, filterDate, filterUser]);

  const stats = useMemo(() => {
    const ids = new Set();
    visible.forEach((row) => {
      staffInRow(row).forEach((s) => {
        if (s.id) ids.add(String(s.id));
      });
    });
    return { accounts: visible.length, staff: ids.size };
  }, [visible]);

  return (
    <div className="otk-staff-report">
      <div className="ds-toolbar ds-toolbar--page-head otk-staff-report__toolbar">
        <div className="ds-toolbar__start">
          <button type="button" className="btn btn--secondary" onClick={load}>
            Обновить
          </button>
        </div>
      </div>

      <div className="otk-staff-report__stats">
        <div className="otk-staff-report__stat">
          <span className="otk-staff-report__stat-value">{stats.accounts}</span>
          <span className="otk-staff-report__stat-label">Учётов</span>
        </div>
        <div className="otk-staff-report__stat">
          <span className="otk-staff-report__stat-value">{stats.staff}</span>
          <span className="otk-staff-report__stat-label">Сотрудников в учётах</span>
        </div>
      </div>

      <div className="shifts-report__filters otk-staff-report__filters">
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Дата</label>
          <input
            type="date"
            className="shifts-report__filter-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Сотрудник</label>
          <Select
            className="shifts-report__filter-select"
            value={filterUser === '' || filterUser == null ? '' : String(filterUser)}
            onChange={setFilterUser}
            placeholder="Все"
            options={[
              { value: '', label: 'Все сотрудники' },
              ...users.map((u) => ({
                value: String(u.id),
                label: u.name || u.username || u.email || String(u.id),
              })),
            ]}
          />
        </div>
        <button
          type="button"
          className="btn btn--ghost shifts-report__filter-clear"
          onClick={() => {
            setFilterDate(todayDate());
            setFilterUser('');
          }}
        >
          Сбросить
        </button>
      </div>

      <p className="otk-staff-report__hint">
        Кто участвовал в учёте ОТК: оператор, химик, упаковщик — как при оформлении учёта в разделе ОТК.
      </p>

      <div className="shifts-report__table-wrap">
        {loading ? (
          <div className="shifts-report__loading">Загрузка...</div>
        ) : visible.length === 0 ? (
          <div className="shifts-report__empty">
            <span>Учётов не найдено</span>
            <p>Измените дату или сотрудника.</p>
          </div>
        ) : (
          <table className="data-table shifts-report__table otk-staff-report__table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Смена</th>
                <th>Заготовка</th>
                <th>Оператор</th>
                <th>Химик</th>
                <th>Упаковщики</th>
                <th>Профили</th>
                <th>Списано</th>
                <th>Брак</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{formatShiftPeriod(row.shiftPeriod) || '—'}</td>
                  <td>{row.blankName || '—'}</td>
                  <td>{row.operatorName || '—'}</td>
                  <td>{row.chemistName || '—'}</td>
                  <td>{formatPackersCell(row)}</td>
                  <td className="otk-staff-report__profiles">{profilesSummary(row.lines)}</td>
                  <td>{formatNumberForInput(row.consumedKg)} кг</td>
                  <td>{formatNumberForInput(row.defectKg)} кг</td>
                  <td className="shifts-report__table-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setDetail(row)}
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail ? (
        <RecordDetailsModal
          open
          onClose={() => setDetail(null)}
          title={`Учёт ОТК: ${detail.blankName || ''}`}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setDetail(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Дата и время', value: formatDateTime(detail.createdAt) },
              { label: 'Смена', value: formatShiftPeriod(detail.shiftPeriod) || '—' },
              { label: 'Заготовка', value: detail.blankName || '—' },
              { label: 'Оператор', value: detail.operatorName || '—' },
              { label: 'Химик', value: detail.chemistName || '—' },
              { label: 'Упаковщики', value: formatPackersCell(detail) },
              { label: 'Списано', value: `${formatNumberForInput(detail.consumedKg)} кг` },
              { label: 'Брак', value: `${formatNumberForInput(detail.defectKg)} кг` },
              { label: 'Остаток после', value: `${formatNumberForInput(detail.remainingAfterKg)} кг` },
              {
                label: 'Профили',
                value: (detail.lines || [])
                  .map((ln) => `${ln.profileName}: ${ln.pieces} шт (${formatNumberForInput(ln.kg)} кг)`)
                  .join('; ') || '—',
              },
              {
                label: 'На склад',
                value: detail.warehousePosted ? 'Да' : 'Нет',
              },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

export default OtkStaffReportTab;
