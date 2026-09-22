import React from 'react';
import { Box, CloudSnow } from 'lucide-react';
import { PRODUCT_LINE } from '../hooks/useProductLine';
import PrimaryTabs from './PrimaryTabs';

const ITEMS = [
  { id: PRODUCT_LINE.PROFILE, label: 'Пластиковый профиль', shortLabel: 'Профиль', icon: Box },
  { id: PRODUCT_LINE.FOAM, label: 'Пенополистирол', shortLabel: 'Пенопласт', icon: CloudSnow },
];

/**
 * Переключатель линии профиль/пенопласт — частный случай PrimaryTabs
 * (см. useProductLine для контекста, зачем он общий на 4+ страницах).
 * action — кнопка главного действия страницы в той же строке (см.
 * PrimaryTabs) — так кнопки вроде «Произвести»/«Продать» не уезжают
 * на отдельную строку под вкладками.
 */
const ProductLineTabs = ({ value, onChange, action }) => (
  <PrimaryTabs items={ITEMS} activeId={value} onChange={onChange} action={action} />
);

export default ProductLineTabs;
