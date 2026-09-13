import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, CircleCheck, CircleX, Wallet, Clock, Phone, ChevronRight,
  ArrowRight, CalendarX2, TrendingUp, HandCoins, CircleAlert,
} from 'lucide-react';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import { MONTHS, formatMoney } from '../../../shared/constants/common';
import { summarizeTrainerReport } from '../lib/trainerMonthReport';
import { useTrainerPhotosByFio } from '../../employees/hooks/useTrainerPhotosByFio';
import './TrainerMonthReportBlock.scss';

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'debt', label: 'Долг' },
  { value: 'paid', label: 'Оплатили' },
];

const initials = (fio) =>
  String(fio || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Панель одного месяца: шапка со сводкой + таблица учеников.
 * Месяцы намеренно равноправны — выбранный и следующий показываются одинаково
 * полно, чтобы «кто уже продлил» читалось сравнением двух колонок, а не переключением.
 */
const MonthPanel = ({ period, rows, isNext, onOpenClient }) => {
  const [filter, setFilter] = useState('all');
  const summary = useMemo(() => summarizeTrainerReport(rows), [rows]);

  const visible = useMemo(() => {
    if (filter === 'debt') return rows.filter((r) => !r.paid || r.debt > 0);
    if (filter === 'paid') return rows.filter((r) => r.paid && r.debt === 0);
    return rows;
  }, [rows, filter]);

  const paidPct = summary.total > 0 ? Math.round((summary.paid / summary.total) * 100) : 0;

  return (
    <section className="trainer-report__panel">
      <header className="trainer-report__panel-head">
        <div className="trainer-report__panel-title">
          <span className="trainer-report__panel-month">{MONTHS[Number(period.month)]}</span>
          <span className="trainer-report__panel-year">{period.year}</span>
          <span className={`trainer-report__panel-tag${isNext ? ' trainer-report__panel-tag--next' : ''}`}>
            {isNext ? 'следующий' : 'выбранный'}
          </span>
        </div>
        <span className="trainer-report__panel-count">
          <Users size={14} aria-hidden /> {summary.total}
        </span>
      </header>

      {/* Полоса оплаты — одна цифра «сколько закрыто» вместо чтения всей таблицы */}
      <div className="trainer-report__meter" role="img" aria-label={`Оплатили ${paidPct}% учеников`}>
        <div className="trainer-report__meter-fill" style={{ width: `${paidPct}%` }} />
      </div>

      <div className={`trainer-report__kpis${summary.total === 0 ? ' trainer-report__kpis--empty' : ''}`}>
        <div className="trainer-report__kpi trainer-report__kpi--paid">
          <CircleCheck size={15} aria-hidden />
          <span className="trainer-report__kpi-value">{summary.paid}</span>
          <span className="trainer-report__kpi-label">оплатили</span>
        </div>
        <div className={`trainer-report__kpi${summary.unpaid > 0 ? ' trainer-report__kpi--unpaid' : ''}`}>
          <CircleX size={15} aria-hidden />
          <span className="trainer-report__kpi-value">{summary.unpaid}</span>
          <span className="trainer-report__kpi-label">не оплатили</span>
        </div>
        <div className={`trainer-report__kpi trainer-report__kpi--money${summary.debtTotal > 0 ? ' trainer-report__kpi--debt' : ''}`}>
          <Wallet size={15} aria-hidden />
          <span className="trainer-report__kpi-value">{summary.debtTotal.toLocaleString('ru-RU')}</span>
          <span className="trainer-report__kpi-label">долг, сом</span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="trainer-report__filters" role="tablist" aria-label="Фильтр списка">
          {FILTERS.map((f) => {
            const count = f.value === 'all'
              ? summary.total
              : f.value === 'debt'
                ? rows.filter((r) => !r.paid || r.debt > 0).length
                : rows.filter((r) => r.paid && r.debt === 0).length;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={`trainer-report__filter${filter === f.value ? ' trainer-report__filter--active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                <span className="trainer-report__filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="trainer-report__table-wrap">
        {!rows.length ? (
          /* Своё пустое состояние вместо общего EmptyState: его крупная иллюстрация
             раздувала панель на пол-экрана ради строчки «никого нет» и ломала
             выравнивание двух месяцев рядом. */
          <div className="trainer-report__empty">
            <span className="trainer-report__empty-icon"><CalendarX2 size={20} aria-hidden /></span>
            <span className="trainer-report__empty-title">
              {isNext ? 'Пока никто не продлил' : 'Нет учеников за этот месяц'}
            </span>
            <span className="trainer-report__empty-hint">
              {isNext
                ? `На ${MONTHS[Number(period.month)].toLowerCase()} записей ещё нет`
                : 'Проверьте выбранный период или тренера'}
            </span>
          </div>
        ) : !visible.length ? (
          <div className="trainer-report__empty">
            <span className="trainer-report__empty-icon"><CircleAlert size={20} aria-hidden /></span>
            <span className="trainer-report__empty-title">Под фильтр никто не подходит</span>
          </div>
        ) : (
          <table className="trainer-report__table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th className="trainer-report__col-slot">Занятие</th>
                <th className="trainer-report__col-num">Цена</th>
                <th className="trainer-report__col-num">Долг</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id ?? row.fio}
                  className={`trainer-report__row${row.paid && row.debt === 0 ? ' trainer-report__row--paid' : ' trainer-report__row--debt'}`}
                  onClick={() => onOpenClient?.(row.client)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenClient?.(row.client);
                    }
                  }}
                >
                  <td>
                    <div className="trainer-report__client">
                      <span className={`trainer-report__avatar${row.paid && row.debt === 0 ? ' trainer-report__avatar--paid' : ''}`}>
                        {initials(row.fio) || '—'}
                      </span>
                      <span className="trainer-report__client-info">
                        <span className="trainer-report__client-name">{row.fio}</span>
                        <span className="trainer-report__client-meta">
                          {row.phone && (<><Phone size={11} aria-hidden />{row.phone}</>)}
                          {row.phone && row.typeLabel && <span className="trainer-report__dot" />}
                          {row.typeLabel}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="trainer-report__col-slot">
                    {row.slotLabel ? (
                      <span className="trainer-report__slot"><Clock size={12} aria-hidden />{row.slotLabel}</span>
                    ) : (
                      <span className="trainer-report__muted">—</span>
                    )}
                  </td>
                  <td className="trainer-report__col-num">
                    <span className="trainer-report__price">{row.price.toLocaleString('ru-RU')}</span>
                  </td>
                  <td className="trainer-report__col-num">
                    {row.debt > 0 ? (
                      <span className="trainer-report__debt">{row.debt.toLocaleString('ru-RU')}</span>
                    ) : (
                      <span className="trainer-report__paid-mark"><CircleCheck size={13} aria-hidden /> закрыт</span>
                    )}
                    <ChevronRight size={14} className="trainer-report__row-chevron" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <footer className="trainer-report__panel-foot">
          <span>Начислено <strong>{formatMoney(summary.priceTotal)}</strong></span>
          <span>Получено <strong>{formatMoney(summary.collectedTotal)}</strong></span>
          <span className={summary.debtTotal > 0 ? 'trainer-report__foot-debt' : undefined}>
            Долг <strong>{formatMoney(summary.debtTotal)}</strong>
          </span>
        </footer>
      )}
    </section>
  );
};

/**
 * Шапка отчёта: кто, за какие месяцы и три главные денежные цифры за оба месяца сразу.
 * Раньше эти суммы жили только в подвалах панелей мелким серым текстом — самое важное
 * стояло в самом тихом месте, а общего итога за два месяца на экране не было вовсе.
 */
const ReportHeader = ({ trainerName, periods }) => {
  const totals = useMemo(
    () =>
      periods.reduce(
        (acc, p) => {
          const s = summarizeTrainerReport(p.rows);
          return {
            priceTotal: acc.priceTotal + s.priceTotal,
            collectedTotal: acc.collectedTotal + s.collectedTotal,
            debtTotal: acc.debtTotal + s.debtTotal,
          };
        },
        { priceTotal: 0, collectedTotal: 0, debtTotal: 0 },
      ),
    [periods],
  );

  // Фото — то же самое, что уже загружено в карточке тренера («Спорт и
  // тренеры») и в списке сотрудников; ищется по совпадению ФИО. Не нашли —
  // инициалы, как и раньше.
  const getPhoto = useTrainerPhotosByFio();
  const [photoBroken, setPhotoBroken] = useState(false);
  // Смена тренера (админ листает «Отчёты») не должна унаследовать «битую»
  // отметку от предыдущего — иначе валидное фото следующего тренера не
  // показалось бы после одной неудачной загрузки чужого.
  useEffect(() => { setPhotoBroken(false); }, [trainerName]);
  const photo = photoBroken ? null : getPhoto(trainerName);

  const secondPeriod = periods[1]?.period;
  // Второй месяц показываем только когда он реально другой: в кабинете
  // тренера период всегда один, и «Сентябрь 2026 → Сентябрь 2026» выглядело
  // как опечатка, а не как диапазон.
  const hasRange = secondPeriod
    && (secondPeriod.month !== periods[0].period.month || secondPeriod.year !== periods[0].period.year);

  return (
    <header className="trainer-report__header">
      <div className="trainer-report__identity">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="trainer-report__identity-avatar trainer-report__identity-avatar--photo"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          <span className="trainer-report__identity-avatar">{initials(trainerName) || '—'}</span>
        )}
        <span className="trainer-report__identity-text">
          <span className="trainer-report__identity-name">{trainerName || 'Тренер'}</span>
          <span className="trainer-report__identity-period">
            {MONTHS[Number(periods[0].period.month)]} {periods[0].period.year}
            {hasRange && (
              <>
                <ArrowRight size={12} aria-hidden />
                {MONTHS[Number(secondPeriod.month)]} {secondPeriod.year}
              </>
            )}
          </span>
        </span>
      </div>

      <div className="trainer-report__totals">
        <div className="trainer-report__total">
          <span className="trainer-report__total-icon"><TrendingUp size={14} aria-hidden /></span>
          <span className="trainer-report__total-body">
            <span className="trainer-report__total-label">Начислено</span>
            <span className="trainer-report__total-value">{formatMoney(totals.priceTotal)}</span>
          </span>
        </div>
        <div className="trainer-report__total trainer-report__total--ok">
          <span className="trainer-report__total-icon"><HandCoins size={14} aria-hidden /></span>
          <span className="trainer-report__total-body">
            <span className="trainer-report__total-label">Получено</span>
            <span className="trainer-report__total-value">{formatMoney(totals.collectedTotal)}</span>
          </span>
        </div>
        <div
          className={`trainer-report__total${totals.debtTotal > 0 ? ' trainer-report__total--debt' : ''}`}
          title="Долг — цена абонемента со скидкой минус фактически внесённые деньги"
        >
          <span className="trainer-report__total-icon"><Wallet size={14} aria-hidden /></span>
          <span className="trainer-report__total-body">
            <span className="trainer-report__total-label">
              Долг <CircleAlert size={11} className="trainer-report__total-hint" aria-hidden />
            </span>
            <span className="trainer-report__total-value">{formatMoney(totals.debtTotal)}</span>
          </span>
        </div>
      </div>
    </header>
  );
};

/**
 * @param {object} props
 * @param {Array<{ period: {year:number, month:number}, rows: Array<object> }>} props.periods
 */
const TrainerMonthReportBlock = ({ periods, loading, errorMessage, onRetry, onOpenClient, trainerName }) => {
  if (loading) {
    return (
      <div className="trainer-report__state">
        <Spinner label="Собираем список учеников за два месяца…" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState compact message={errorMessage} onRetry={onRetry} />;
  }

  if (!periods?.length) {
    return (
      <div className="trainer-report__state">
        <EmptyState
          compact
          message="Выберите год, месяц и тренера — покажем его учеников за выбранный и следующий месяц"
        />
      </div>
    );
  }

  return (
    <div className="trainer-report">
      <ReportHeader trainerName={trainerName} periods={periods} />
      <div className="trainer-report__grid">
        {periods.map((p, i) => (
          <MonthPanel
            key={`${p.period.year}-${p.period.month}`}
            period={p.period}
            rows={p.rows}
            isNext={i > 0}
            onOpenClient={onOpenClient}
          />
        ))}
      </div>
    </div>
  );
};

export default TrainerMonthReportBlock;
