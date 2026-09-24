import React from 'react';
import {
  Wallet, Banknote, TrendingUp, ReceiptText, PiggyBank, Lock, ArrowUpRight, ArrowDownRight, ChevronRight,
  LineChart as LineIcon, Tags, Package, Users, Clock, Factory, Archive, UserCheck, Info,
} from 'lucide-react';
import { LineChart, BarChart, EmptyState } from '../../../shared/ui';
import { money, num, periodLabel, LINE_LABELS } from '../format';

const KPI_ICONS = {
  revenue: Wallet, cash_in: Banknote, gross_margin: TrendingUp, expenses: ReceiptText, net_profit: PiggyBank,
};
// Для расходов рост — плохо: стрелка вверх красная.
const INVERSE = new Set(['expenses']);

const Card = ({ icon: Icon, title, extra, children, className = '' }) => (
  <section className={`an-card ${className}`.trim()}>
    <header className="an-card__head">
      <h3 className="an-card__title"><span className="an-card__ico"><Icon size={14} /></span>{title}</h3>
      {extra}
    </header>
    {children}
  </section>
);

const Kpi = ({ kpi, idx, onOpen }) => {
  const Icon = KPI_ICONS[kpi.key] || Wallet;
  const delta = kpi.delta_pct != null ? Number(kpi.delta_pct) : null;
  const good = delta != null && (INVERSE.has(kpi.key) ? delta <= 0 : delta >= 0);
  const negative = kpi.value != null && Number(kpi.value) < 0;
  if (kpi.locked) {
    return (
      <div className="an-kpi an-kpi--locked" style={{ '--row-i': idx }}>
        <span className="an-kpi__label"><span className="an-kpi__ico"><Icon size={15} /></span>{kpi.label}</span>
        <span className="an-kpi__lock"><Lock size={14} /> Нет доступа к финансам</span>
      </div>
    );
  }
  return (
    <button type="button" className={`an-kpi an-kpi--${kpi.key}`} style={{ '--row-i': idx }} onClick={() => onOpen(kpi)} title={kpi.hint}>
      <span className="an-kpi__label"><span className="an-kpi__ico"><Icon size={15} /></span>{kpi.label}<ChevronRight size={14} className="an-kpi__go" /></span>
      <strong className={`an-kpi__value${negative ? ' an-kpi__value--neg' : ''}`}>{money(kpi.value)}</strong>
      <span className="an-kpi__foot">
        {delta != null ? (
          <span className={`an-kpi__delta an-kpi__delta--${good ? 'good' : 'bad'}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {delta > 0 ? '+' : ''}{num(delta, 1)}%
          </span>
        ) : <span className="an-kpi__delta an-kpi__delta--none">—</span>}
        <span className="an-kpi__prev">было {money(kpi.previous)}</span>
      </span>
    </button>
  );
};

const Table = ({ head, rows, empty = 'Нет данных' }) => (rows.length === 0 ? <EmptyState compact message={empty} /> : (
  <div className="an-mini-table">
    <table className="an-page__table">
      <thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? 'num' : ''}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key} style={{ '--row-i': Math.min(i, 12) }}>
            {r.cells.map((c, j) => <td key={`${r.key}-${head[j]}`} data-label={head[j]} className={j > 0 ? 'num' : ''}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

const lineTag = (l) => <span className={`an-line an-line--${l}`}>{LINE_LABELS[l]}</span>;

const Overview = ({ data, onOpenKpi, showLineTags }) => {
  const finance = data.finance_access;
  const trendLabels = data.trend.map((t) => t.period);
  const series = [
    { key: 'revenue', label: 'Выручка', color: 'var(--color-info)', values: data.trend.map((t) => Number(t.revenue)) },
  ];
  if (finance) {
    series.push(
      { key: 'gross', label: 'Валовая маржа', color: 'var(--color-success)', values: data.trend.map((t) => Number(t.gross_margin)) },
      { key: 'net', label: 'Чистая прибыль', color: 'var(--color-primary)', values: data.trend.map((t) => Number(t.net_profit)) },
    );
  }
  const hasTrend = data.trend.some((t) => Number(t.revenue) !== 0 || Number(t.net_profit || 0) !== 0);
  const { debts, production, warehouse } = data;
  const estimated = data.top_products.some((p) => p.cost_estimated && p.product_line === 'foam');

  return (
    <div className="an-overview">
      <div className="an-kpis">
        {data.kpis.map((k, i) => <Kpi key={k.key} kpi={k} idx={i} onOpen={onOpenKpi} />)}
      </div>

      <Card icon={LineIcon} title={finance ? 'Выручка и прибыль' : 'Выручка'} className="an-card--wide">
        {hasTrend ? (
          <LineChart
            labels={trendLabels}
            series={series}
            formatLabel={periodLabel}
            formatValue={(v) => money(v)}
            ariaLabel="Динамика выручки и прибыли"
          />
        ) : <EmptyState compact message="За период нет продаж" />}
      </Card>

      <div className="an-grid">
        {finance && (
          <Card icon={Tags} title="Расходы по категориям">
            {data.expenses_by_category.length ? (
              <BarChart
                color="var(--color-warning)"
                items={data.expenses_by_category.map((e) => ({ key: e.category, label: e.category, value: Number(e.amount), display: money(e.amount) }))}
              />
            ) : <EmptyState compact message="Принятых расходов нет" />}
          </Card>
        )}

        <Card icon={Package} title={finance ? 'Топ-10 товаров по марже' : 'Топ-10 товаров по выручке'}>
          {data.top_products.length ? (
            <>
              <BarChart
                color="var(--color-success)"
                items={data.top_products.map((p) => ({
                  key: p.key,
                  label: showLineTags ? `${p.name} · ${LINE_LABELS[p.product_line]}` : p.name,
                  value: Number(finance ? p.margin : p.revenue),
                  display: money(finance ? p.margin : p.revenue),
                  sub: finance
                    ? `Выручка ${money(p.revenue)} · маржа ${p.margin_pct != null ? `${num(p.margin_pct, 1)}%` : '—'} · ${num(p.quantity, 3)} шт`
                    : `${num(p.quantity, 3)} шт`,
                }))}
              />
              {finance && estimated && <p className="an-card__note"><Info size={13} /> Себестоимость пенопласта — оценка по средней цене сырья на единицу выпуска.</p>}
            </>
          ) : <EmptyState compact message="Продаж нет" />}
        </Card>

        <Card icon={Banknote} title="Деньги">
          <BarChart
            color="var(--color-info)"
            items={data.cash.in_by_method.map((m) => ({ key: m.method, label: m.label, value: Number(m.amount), display: money(m.amount) }))}
          />
          <dl className="an-dl">
            <div><dt>Возвраты денег клиентам</dt><dd>{money(data.cash.refunds)}</dd></div>
            {finance && <div><dt>Закупки сырья</dt><dd>{money(data.cash.purchases)}</dd></div>}
            {finance && data.people.payroll != null && <div><dt>Зарплата (из расходов)</dt><dd>{money(data.people.payroll)}</dd></div>}
            {finance && (
              <div className="an-dl__total">
                <dt>Движение денег <small>получено − закупки − расходы</small></dt>
                <dd className={Number(data.cash.cash_flow) < 0 ? 'neg' : ''}>{money(data.cash.cash_flow)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card icon={Clock} title="Долги клиентов" extra={<strong className="an-card__big">{money(debts.total)}</strong>}>
          <div className="an-aging">
            {debts.aging.map((a) => {
              const pct = Number(debts.total) > 0 ? (Number(a.amount) / Number(debts.total)) * 100 : 0;
              return (
                <div key={a.key} className={`an-aging__col an-aging__col--${a.key}`}>
                  <span className="an-aging__label">{a.label}</span>
                  <strong>{money(a.amount)}</strong>
                  <span className="an-aging__bar"><i style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
          </div>
          <Table
            head={['Должник', 'Долг', 'Дней']}
            empty="Долгов нет"
            rows={debts.top_debtors.map((d) => ({
              key: `${d.product_line}-${d.client}`,
              cells: [<>{d.client} {showLineTags && lineTag(d.product_line)}</>, money(d.debt), d.oldest_days],
            }))}
          />
          <p className="an-card__note"><Info size={13} /> {debts.note}</p>
        </Card>

        <Card icon={Users} title="Топ клиентов">
          <Table
            head={['Клиент', 'Выручка']}
            empty="Продаж нет"
            rows={data.top_clients.map((c) => ({ key: `${c.product_line}-${c.client}`, cells: [<>{c.client} {showLineTags && lineTag(c.product_line)}</>, money(c.revenue)] }))}
          />
        </Card>

        {data.people.cashiers.length > 0 && (
          <Card icon={UserCheck} title="Кассиры">
            <Table
              head={['Кассир', 'Продаж', 'Выручка', 'Ср. чек']}
              rows={data.people.cashiers.map((c) => ({ key: c.cashier, cells: [c.cashier, c.sales_count, money(c.revenue), money(c.avg_check)] }))}
            />
          </Card>
        )}

        <Card icon={Factory} title="Производство">
          <div className="an-stats">
            {production.profile && (
              <>
                <div><span>Партий профиля</span><strong>{production.profile.batches}</strong></div>
                <div><span>Штук / метров</span><strong>{num(production.profile.pieces, 0)} / {num(production.profile.meters)}</strong></div>
                <div><span>ОТК: принято / брак</span><strong>{num(production.profile.otk_accepted)} / {num(production.profile.otk_rejected)}</strong></div>
                <div className={Number(production.profile.defect_pct) > 5 ? 'warn' : ''}><span>Доля брака</span><strong>{production.profile.defect_pct != null ? `${num(production.profile.defect_pct, 1)}%` : '—'}</strong></div>
              </>
            )}
            {production.foam && (
              <>
                <div><span>Выпусков пенопласта</span><strong>{production.foam.runs}</strong></div>
                <div><span>Сырья в работу</span><strong>{num(production.foam.input_kg)} кг</strong></div>
                {production.foam.output_by_format.map((f) => (
                  <div key={f.format}><span>{f.label}</span><strong>{num(f.qty)}</strong></div>
                ))}
              </>
            )}
          </div>
        </Card>

        <Card icon={Archive} title="Склад" extra={warehouse.profile?.stock_value != null && <strong className="an-card__big">{money(warehouse.profile.stock_value)}</strong>}>
          {warehouse.profile && (
            <>
              <h4 className="an-card__sub">Заканчивается <small>продали за 30 дней не меньше остатка</small></h4>
              <Table
                head={['Товар', 'Остаток', 'Хватит, дн.']}
                empty="Всего хватает"
                rows={warehouse.profile.low_stock.map((r) => ({ key: r.name, cells: [r.name, num(r.quantity), r.days_left ?? '—'] }))}
              />
              <h4 className="an-card__sub">Залежалый <small>не продавался {warehouse.profile.dead_stock_days}+ дней</small></h4>
              <Table
                head={finance ? ['Партия', 'Остаток', 'Дней', 'Сумма'] : ['Партия', 'Остаток', 'Дней']}
                empty="Залежалого нет"
                rows={warehouse.profile.dead_stock.map((r) => ({
                  key: r.batch_id,
                  cells: finance ? [r.name, num(r.quantity), r.days, money(r.value)] : [r.name, num(r.quantity), r.days],
                }))}
              />
            </>
          )}
          {warehouse.foam && (
            <>
              <h4 className="an-card__sub">Пенопласт на складе <small>сырья {num(warehouse.foam.raw_kg)} кг</small></h4>
              <Table
                head={['Товар', 'Остаток']}
                empty="Пусто"
                rows={warehouse.foam.stock.map((s) => ({ key: s.name, cells: [s.name, num(s.quantity)] }))}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Overview;
