import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarX2, Download, Phone, UserX } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { fetchMyTrainerReport } from './api';
import { Select, Spinner, ErrorState, EmptyState } from '../../shared/ui';
import { STATS_YEARS } from '../../shared/constants/common';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import TrainerMonthReportBlock from '../clients/components/TrainerMonthReportBlock';
import { buildTrainerReportRow, sortTrainerReportRows } from '../clients/lib/trainerMonthReport';
import { exportTrainerMonthReport } from '../clients/lib/trainerMonthReportExport';
import './TrainerReportPage.scss';

const YEAR_OPTIONS = STATS_YEARS.map((y) => ({ value: y, label: y }));
const MONTH_OPTIONS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
].map((m, i) => ({ value: String(i + 1), label: m }));

const NOW = new Date();
const CURRENT_YEAR_STR = String(NOW.getFullYear());
const DEFAULT_YEAR = STATS_YEARS.includes(CURRENT_YEAR_STR) ? CURRENT_YEAR_STR : STATS_YEARS[STATS_YEARS.length - 1];
const DEFAULT_MONTH = String(NOW.getMonth() + 1);

/**
 * Кабинет тренера — «Мой отчёт».
 *
 * Свои ученики за месяц: кто оплатил, кто нет, и кого тренер потерял (не
 * продлил после этого месяца). Тренер не выбирает себя из списка — год и
 * месяц выбираются, а личность определяет сам вход на сайт.
 *
 * Верстка ученической таблицы — тот же блок, что уже показывает отчёт по
 * тренеру администратору в «Отчётах» (TrainerMonthReportBlock): те же цифры
 * должны выглядеть одинаково, кто бы их ни смотрел.
 */
const TrainerReportPage = () => {
  const { user } = useAuth();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [month, setMonth] = useState(DEFAULT_MONTH);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const { signal } = controllerRef.current;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyTrainerReport({ year, month }, signal);
      if (requestSeq.current !== seq) return;
      setReport(data);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (requestSeq.current !== seq) return;
      setError(getApiErrorMessage(err));
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(
    () => sortTrainerReportRows((report?.items ?? []).map(buildTrainerReportRow)),
    [report],
  );
  const lostRows = useMemo(
    () => (report?.lost?.items ?? []).map(buildTrainerReportRow),
    [report],
  );

  const periods = useMemo(
    () => [{ period: { year: Number(year), month: Number(month) }, rows }],
    [year, month, rows],
  );

  const handleExport = () => {
    exportTrainerMonthReport({ trainerName: user?.fio, periods });
  };

  return (
    <div className="trainer-report-page">
      <header className="trainer-report-page__head">
        <div>
          <h1 className="trainer-report-page__title">Мой отчёт</h1>
          <p className="trainer-report-page__hint">Ваши ученики за выбранный месяц</p>
        </div>

        <div className="trainer-report-page__filters">
          <Select
            value={String(year)}
            onChange={setYear}
            options={YEAR_OPTIONS}
            className="trainer-report-page__select"
          />
          <Select
            value={String(month)}
            onChange={setMonth}
            options={MONTH_OPTIONS}
            className="trainer-report-page__select"
          />
          {!loading && !error && rows.length > 0 && (
            <button type="button" className="trainer-report-page__export-btn" onClick={handleExport}>
              <Download size={14} /> Скачать в Excel
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="trainer-report-page__state">
          <Spinner label="Собираем ваш отчёт…" />
        </div>
      ) : error ? (
        <ErrorState compact message={error} onRetry={load} />
      ) : (
        <>
          <TrainerMonthReportBlock
            periods={periods}
            trainerName={user?.fio}
          />

          {/* «Ушедшие»: те, кто занимался в выбранном месяце и не продлил
              подписку после него — тот же критерий, что у отчёта «не
              продлили» в администраторских «Отчётах». */}
          <section className="trainer-report-page__lost">
            <h2 className="trainer-report-page__lost-title">
              <UserX size={16} /> Не продлили после этого месяца
              {lostRows.length > 0 && <span className="trainer-report-page__lost-count">{lostRows.length}</span>}
            </h2>

            {lostRows.length === 0 ? (
              <EmptyState
                compact
                message="Все, кто занимался в этом месяце, пока продолжают — потерянных учеников нет"
              />
            ) : (
              <ul className="trainer-report-page__lost-list">
                {lostRows.map((row) => (
                  <li key={row.id} className="trainer-report-page__lost-row">
                    <span className="trainer-report-page__lost-name">{row.fio}</span>
                    <span className="trainer-report-page__lost-meta">
                      {row.phone && (<><Phone size={11} aria-hidden />{row.phone}</>)}
                      {row.sportName && <span className="trainer-report-page__dot" />}
                      {row.sportName}
                    </span>
                    <span className="trainer-report-page__lost-date">
                      {/* buildTrainerReportRow уже форматирует dateStart в ДД.ММ.ГГГГ */}
                      <CalendarX2 size={12} aria-hidden /> занимался с {row.dateStart || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default TrainerReportPage;
