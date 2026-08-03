import React from 'react';
import { FiBox, FiCloudSnow } from 'react-icons/fi';
import { PRODUCT_LINE } from '../../hooks/useProductLine';
import './ProductLineTabs.scss';

const OPTIONS = [
  { value: PRODUCT_LINE.PROFILE, label: 'Пластиковый профиль', Icon: FiBox },
  { value: PRODUCT_LINE.FOAM, label: 'Пенополистирол', Icon: FiCloudSnow },
];

/** Переключатель линии продукта — общий для Сырья, Заготовки, Цеха, Производства, ОТК, Склада. */
const ProductLineTabs = ({ value, onChange }) => (
  <div className="chemistry-tabs product-line-tabs" role="tablist" aria-label="Линия продукта">
    {OPTIONS.map(({ value: v, label, Icon }) => (
      <button
        key={v}
        type="button"
        role="tab"
        aria-selected={value === v}
        className={`chemistry-tabs__tab${value === v ? ' chemistry-tabs__tab--active' : ''}`}
        onClick={() => onChange(v)}
      >
        <Icon aria-hidden size={16} strokeWidth={2} />
        {label}
      </button>
    ))}
  </div>
);

export default ProductLineTabs;
