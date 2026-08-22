import React from 'react';
import { AlertTriangle, ShieldOff, Loader2, SearchX, HelpCircle } from 'lucide-react';
import './FeedbackVisual.scss';

const VARIANT_ICON = {
  error: AlertTriangle,
  denied: ShieldOff,
  loading: Loader2,
  notfound: SearchX,
  confirm: HelpCircle,
};

/** Единый визуальный блок (иконка в мягком градиенте) для ошибки, доступа, загрузки, 404 — в духе empty state. */
const FeedbackVisual = ({ variant = 'error', label }) => {
  const Icon = VARIANT_ICON[variant] ?? AlertTriangle;
  const spin = variant === 'loading';
  return (
    <div
      className={`feedback-visual feedback-visual--${variant}`}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
    >
      <Icon
        size={40}
        strokeWidth={1.65}
        className={`feedback-visual__icon${spin ? ' feedback-visual__icon--spin' : ''}`}
      />
    </div>
  );
};

export default FeedbackVisual;
