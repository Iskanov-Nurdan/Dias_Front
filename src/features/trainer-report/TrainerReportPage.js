import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarX2, Download, Phone, UserX, Users, CalendarRange, Wallet } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { fetchMyTrainerReport } from './api';
import { Select, Spinner, ErrorState, EmptyState } from '../../shared/ui';
import { STATS_YEARS } from '../../shared/constants/common';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import TrainerMonthReportBlock, { TrainerReportTotals } from '../clients/components/TrainerMonthReportBlock';
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

const TAB_STUDENTS = 'students';
const TAB_TOTALS = 'totals';
const TAB_LOST = 'lost';

const initials = (fio) =>
  String(fio || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

/**
 * Кабинет тренера — «Мой отчёт».
 *
 * Свои ученики за месяц: кто оплатил, кто нет, и кого тренер потерял (не
 * продлил после этого месяца). Тренер не выбирает себя из списка — год и
 * месяц выбираются, а личность определяет сам вход на сайт.
 *
 * Список учеников и «потерянные» показаны вкладками, а не друг под другом:
 * при активном списке из 15-20 учеников подряд второй блок раньше уходил
 * на второй-третий экран, и часть тренеров решала, что раздела вовсе нет.
 */
const TrainerReportPage = () => {
  const { user } = useAuth();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [tab, setTab] = useState(TAB_STUDENTS);

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
      {/* Заголовка страницы здесь нет намеренно: «Мой отчёт» уже выводит
          шапка приложения из общего реестра страниц — второй такой же
          заголовок был дублем и на телефоне съедал целый экран высоты. */}
      <header className="trainer-report-page__head">
        <div className="trainer-report-page__filters">
          <div className="trainer-report-page__period">
            <CalendarRange size={15} className="trainer-report-page__period-icon" aria-hidden />
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
              className="trainer-report-page__select trainer-report-page__select--month"
            />
          </div>
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
          {/* На телефоне этот же переключатель превращается в закреплённую
              нижнюю панель навигации (см. SCSS): разметка одна, меняется
              только раскладка — иконка со счётчиком над подписью. */}
          <div className="trainer-report-page__tabs" role="tablist" aria-label="Раздел отчёта">
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_STUDENTS}
              className={`trainer-report-page__tab${tab === TAB_STUDENTS ? ' trainer-report-page__tab--active' : ''}`}
              onClick={() => setTab(TAB_STUDENTS)}
            >
              <span className="trainer-report-page__tab-icon">
                <Users size={18} aria-hidden />
                <span className="trainer-report-page__tab-count">{rows.length}</span>
              </span>
              <span className="trainer-report-page__tab-label">Ученики</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_TOTALS}
              className={`trainer-report-page__tab${tab === TAB_TOTALS ? ' trainer-report-page__tab--active' : ''}`}
              onClick={() => setTab(TAB_TOTALS)}
            >
              <span className="trainer-report-page__tab-icon">
                <Wallet size={18} aria-hidden />
              </span>
              <span className="trainer-report-page__tab-label">Итоги</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_LOST}
              className={`trainer-report-page__tab${tab === TAB_LOST ? ' trainer-report-page__tab--active' : ''}`}
              onClick={() => setTab(TAB_LOST)}
            >
              <span className="trainer-report-page__tab-icon">
                <UserX size={18} aria-hidden />
                {lostRows.length > 0 && (
                  <span className="trainer-report-page__tab-count trainer-report-page__tab-count--danger">{lostRows.length}</span>
                )}
              </span>
              <span className="trainer-report-page__tab-label">Не продлили</span>
            </button>
          </div>

          {tab === TAB_STUDENTS ? (
            /* Итоги (кто, период, начислено/получено/долг) переехали на свою
               вкладку — над списком учеников они занимали экран высоты,
               из-за чего сам список на телефоне начинался ниже сгиба */
            <TrainerMonthReportBlock periods={periods} trainerName={user?.fio} showHeader={false} />
          ) : tab === TAB_TOTALS ? (
            <TrainerReportTotals periods={periods} trainerName={user?.fio} />
          ) : (
            /* «Ушедшие»: те, кто занимался в выбранном месяце и не продлил
               подписку после него — тот же критерий, что у отчёта «не
               продлили» в администраторских «Отчётах». */
            <section className="trainer-lost">
              {lostRows.length === 0 ? (
                <EmptyState
                  compact
                  message="Все, кто занимался в этом месяце, пока продолжают — потерянных учеников нет"
                />
              ) : (
                <ul className="trainer-lost__list">
                  {lostRows.map((row) => (
                    <li key={row.id} className="trainer-lost__row">
                      <span className="trainer-lost__avatar" aria-hidden>{initials(row.fio) || '—'}</span>
                      <span className="trainer-lost__info">
                        <span className="trainer-lost__name">{row.fio}</span>
                        <span className="trainer-lost__meta">
                          {row.phone && (<><Phone size={11} aria-hidden />{row.phone}</>)}
                          {row.phone && row.sportName && <span className="trainer-lost__dot" />}
                          {row.sportName}
                        </span>
                      </span>
                      <span className="trainer-lost__date">
                        {/* buildTrainerReportRow уже форматирует dateStart в ДД.ММ.ГГГГ */}
                        <CalendarX2 size={12} aria-hidden /> с {row.dateStart || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default TrainerReportPage;
