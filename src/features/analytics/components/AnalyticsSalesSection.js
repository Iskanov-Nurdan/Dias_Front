import React from 'react';
import { formatMoney } from '../../../shared/constants/common';
import { EmptyState } from '../../../shared/ui';

const AnalyticsMarginTable = ({ marginTab, setMarginTab, salesMargin, marginByProduct, marginByCategory }) => (
  <section className="analytics-page__section analytics-page__section--table">
    <h3 className="analytics-page__section-title">Маржинальность продаж</h3>
    <div className="analytics-page__tabs">
      <button type="button" className={`analytics-page__tab ${marginTab === 'product' ? 'analytics-page__tab--active' : ''}`} onClick={() => setMarginTab('product')}>По товарам</button>
      <button type="button" className={`analytics-page__tab ${marginTab === 'category' ? 'analytics-page__tab--active' : ''}`} onClick={() => setMarginTab('category')}>По категориям</button>
    </div>
    {(salesMargin?.totalRevenue != null || salesMargin?.totalMargin != null) && (
      <p className="analytics-page__section-summary">
        Выручка: <strong>{formatMoney(salesMargin?.totalRevenue)}</strong> · Себестоимость: <strong>{formatMoney(salesMargin?.totalCost)}</strong> · Маржа: <strong>{formatMoney(salesMargin?.totalMargin)}</strong> ({salesMargin?.totalMarginPercent != null ? `${Number(salesMargin.totalMarginPercent).toFixed(1)}%` : '—'})
      </p>
    )}
    <div className="analytics-page__table-wrap">
      <table className="analytics-page__table">
        <thead>
          <tr>
            <th>{marginTab === 'product' ? 'Товар' : 'Категория'}</th>
            <th>Выручка</th>
            <th>Себестоимость</th>
            <th>Маржа (сом)</th>
            <th>Маржа %</th>
          </tr>
        </thead>
        <tbody>
          {(marginTab === 'product' ? marginByProduct : marginByCategory).map((x) => (
            <tr key={x.productId ?? x.categoryId ?? x.productName ?? x.categoryName}>
              <td>{marginTab === 'product' ? (x.productName ?? '—') : (x.categoryName ?? '—')}</td>
              <td>{formatMoney(x.revenue)}</td>
              <td>{formatMoney(x.cost)}</td>
              <td>{formatMoney(x.margin)}</td>
              <td>{x.marginPercent != null ? `${Number(x.marginPercent).toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(marginTab === 'product' ? marginByProduct : marginByCategory).length === 0 && (
        <EmptyState compact message="Нет данных за период" />
      )}
    </div>
  </section>
);

const AnalyticsSalesTable = ({ salesTab, setSalesTab, salesTotalRevenue, productItems, categoryItems }) => (
  <section className="analytics-page__section analytics-page__section--table">
    <h3 className="analytics-page__section-title">Продажи за период</h3>
    <div className="analytics-page__tabs">
      <button type="button" className={`analytics-page__tab ${salesTab === 'product' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('product')}>Товары</button>
      <button type="button" className={`analytics-page__tab ${salesTab === 'category' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('category')}>Категории</button>
    </div>
    <p className="analytics-page__section-summary">
      Всего продаж на сумму: <strong>{formatMoney(salesTotalRevenue)}</strong>
    </p>
    <div className="analytics-page__table-wrap">
      <table className="analytics-page__table">
        <thead>
          <tr>
            <th>{salesTab === 'product' ? 'Товар' : 'Категория'}</th>
            <th>Кол-во</th>
            <th>Выручка</th>
          </tr>
        </thead>
        <tbody>
          {(salesTab === 'product' ? productItems : categoryItems).map((x) => (
            <tr key={x.productId ?? x.categoryId ?? x.productName ?? x.categoryName}>
              <td>{salesTab === 'product' ? (x.productName ?? '—') : (x.categoryName ?? '—')}</td>
              <td>{x.quantitySold ?? 0}</td>
              <td>{formatMoney(x.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(salesTab === 'product' ? productItems : categoryItems).length === 0 && (
        <EmptyState compact message="Нет продаж за период" />
      )}
    </div>
  </section>
);

const AnalyticsSalesSection = (props) => (
  <div className="analytics-page__grid analytics-page__grid--two">
    <AnalyticsMarginTable {...props} />
    <AnalyticsSalesTable {...props} />
  </div>
);

export default AnalyticsSalesSection;
