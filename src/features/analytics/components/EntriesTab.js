import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, Pencil, Trash2, Repeat, TrendingDown, TrendingUp, Clock, MoreVertical,
} from 'lucide-react';
import { ActionSheet, ConfirmModal, EmptyState, ErrorState, SkeletonTable } from '../../../shared/ui';
import { useIsMobile } from '../../../shared/hooks';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchEntries, acceptEntry, rejectEntry } from '../api';
import { money, dateRu, LINE_LABELS } from '../format';

const PAGE = 30;

/**
 * Реестр ручных расходов/доходов за период. Новая запись «ждёт проверки»
 * и в отчёт не входит, пока её не примут. Итоги сверху — они же фильтры
 * (нажал «Ждут проверки» — список сузился), без отдельной строки чипов.
 * Десктоп: таблица, клик по строке — правка. Телефон: карточки, «⋯» → шторка.
 */
const EntriesTab = ({ range, reloadKey, onEdit, onChanged, onVisibleChange }) => {
  const toast = useToast();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [busyId, setBusyId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback((signal) => {
    setError(null);
    return fetchEntries(range, signal)
      .then(setData)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); });
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => { setShown(PAGE); }, [filter, range]);

  const items = useMemo(() => data?.items || [], [data]);
  const visible = useMemo(() => items.filter((e) => {
    if (filter === 'pending') return e.status !== 'accepted';
    if (filter === 'expense' || filter === 'income') return e.kind === filter && e.status === 'accepted';
    return true;
  }), [items, filter]);

  useEffect(() => { onVisibleChange?.(visible); }, [visible, onVisibleChange]);

  const totals = useMemo(() => items.reduce((acc, e) => {
    const v = Number(e.amount) || 0;
    if (e.status !== 'accepted') acc.pending += 1;
    else if (e.kind === 'income') acc.income += v;
    else acc.expense += v;
    return acc;
  }, { expense: 0, income: 0, pending: 0 }), [items]);

  const act = async (fn, id, okMsg) => {
    setBusyId(id);
    try {
      await fn(id);
      toast.success(okMsg);
      await load(null);
      onChanged?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const fromMenu = (fn) => {
    const row = menu;
    setMenu(null);
    fn(row);
  };

  const toggle = (id) => setFilter((f) => (f === id ? 'all' : id));

  if (error) return <ErrorState message={error} onRetry={() => load(null)} />;

  const stats = [
    { id: 'expense', icon: TrendingDown, label: 'Расходы', value: money(totals.expense) },
    { id: 'income', icon: TrendingUp, label: 'Доходы', value: money(totals.income) },
    { id: 'pending', icon: Clock, label: 'Ждут проверки', value: totals.pending, warn: totals.pending > 0 },
  ];
  const page = visible.slice(0, shown);
  const emptyText = filter === 'all'
    ? `За период записей нет — нажмите ${isMobile ? '«+»' : '«Расход / доход»'}, чтобы добавить`
    : 'Под этот фильтр записей нет';

  const status = (e) => {
    const accepted = e.status === 'accepted';
    return (
      <span className={`an-page__status an-page__status--${accepted ? 'ok' : 'warn'}`}>
        <span className="an-page__status-dot" />{accepted ? 'Принят' : 'Ждёт'}
      </span>
    );
  };

  const nameBlock = (e) => (
    <span className="an-entries__name">
      <span className={`an-page__avatar an-page__avatar--${e.kind}`}>
        {e.kind === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      </span>
      <span className="an-entries__name-text">
        <strong>{e.name}{e.recurring_source_id && <Repeat size={12} className="an-entries__rep" aria-label="Регулярная" />}</strong>
        <small>{[e.category_name, LINE_LABELS[e.product_line], e.comment].filter(Boolean).join(' · ')}</small>
      </span>
    </span>
  );

  const amount = (e) => (
    <span className={`an-entries__amount an-entries__amount--${e.kind}`}>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</span>
  );

  return (
    <div className="an-entries">
      <div className="an-entries__summary" role="group" aria-label="Фильтр по итогам">
        {stats.map(({ id, icon: Icon, label, value, warn }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={`an-entries__stat an-entries__stat--${id}${warn ? ' an-entries__stat--warn' : ''}${filter === id ? ' an-entries__stat--active' : ''}`}
            onClick={() => toggle(id)}
          >
            <span><Icon size={14} /> {label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      {data?.templates?.length > 0 && (
        <div className="an-entries__templates">
          <span className="an-entries__templates-title"><Repeat size={14} /> Каждый месяц</span>
          {data.templates.map((t) => (
            <button key={t.id} type="button" className="an-entries__tpl" onClick={() => onEdit(t)} title="Изменить регулярную запись">
              {t.name} · {money(t.amount)}
            </button>
          ))}
        </div>
      )}

      {!data && <div className="an-page__panel"><SkeletonTable rows={5} cols={isMobile ? 2 : 5} /></div>}
      {data && visible.length === 0 && <EmptyState message={emptyText} compact />}

      {data && visible.length > 0 && !isMobile && (
        <div className="an-page__panel">
          <table className="an-page__table an-entries__table">
            <thead>
              <tr><th>Запись</th><th>Дата</th><th>Статус</th><th className="num">Сумма</th><th aria-label="Действия" /></tr>
            </thead>
            <tbody>
              {page.map((e, i) => (
                <tr key={e.id} style={{ '--row-i': Math.min(i, 20) }} className="an-entries__row" onClick={() => onEdit(e)}>
                  <td>{nameBlock(e)}</td>
                  <td className="an-entries__date">{dateRu(e.date)}</td>
                  <td>{status(e)}</td>
                  <td className="num">{amount(e)}</td>
                  <td className="an-entries__actions" onClick={(ev) => ev.stopPropagation()}>
                    {e.status !== 'accepted' && (
                      <button type="button" className="an-page__pill" disabled={busyId === e.id} onClick={() => act(acceptEntry, e.id, 'Принято — запись вошла в отчёт')}>
                        <Check size={14} /> Принять
                      </button>
                    )}
                    <button type="button" className="an-page__icon-btn an-page__icon-btn--danger" disabled={busyId === e.id} onClick={() => setConfirm(e)} aria-label="Удалить" title="Удалить">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && visible.length > 0 && isMobile && (
        <div className="an-entries__cards">
          {page.map((e, i) => (
            <article key={e.id} className="an-entries__card" style={{ '--row-i': Math.min(i, 20) }} onClick={() => onEdit(e)}>
              <div className="an-entries__card-main">
                {nameBlock(e)}
                <div className="an-entries__card-meta">
                  {status(e)}
                  <span className="an-entries__date">{dateRu(e.date)}</span>
                  {amount(e)}
                </div>
              </div>
              <button
                type="button"
                className="an-entries__menu-btn"
                aria-label="Действия"
                onClick={(ev) => { ev.stopPropagation(); setMenu(e); }}
              >
                <MoreVertical size={17} />
              </button>
            </article>
          ))}
        </div>
      )}

      {visible.length > shown && (
        <button type="button" className="an-page__more" onClick={() => setShown((s) => s + PAGE)}>
          Показать ещё {Math.min(PAGE, visible.length - shown)} из {visible.length - shown}
        </button>
      )}

      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && menu.status !== 'accepted' && (
          <button type="button" className="action-sheet__item" onClick={() => fromMenu((r) => act(acceptEntry, r.id, 'Принято — запись вошла в отчёт'))}>
            <Check size={18} /> Принять в отчёт
          </button>
        )}
        <button type="button" className="action-sheet__item" onClick={() => fromMenu(onEdit)}>
          <Pencil size={18} /> Изменить
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--divider action-sheet__item--danger" onClick={() => fromMenu(setConfirm)}>
          <Trash2 size={18} /> Удалить
        </button>
      </ActionSheet>

      {confirm && (
        <ConfirmModal
          title="Удалить запись?"
          message={`«${confirm.name}» на ${money(confirm.amount)} будет удалена${confirm.status === 'accepted' ? ' и уйдёт из отчёта' : ''}.`}
          confirmText="Удалить"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const { id } = confirm; setConfirm(null); act(rejectEntry, id, 'Запись удалена'); }}
        />
      )}
    </div>
  );
};

export default EntriesTab;
