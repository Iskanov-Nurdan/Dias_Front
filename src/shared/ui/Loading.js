import React from 'react';
import FeedbackVisual from './FeedbackVisual';
import './Loading.scss';

const Loading = () => (
  <div className="loading">
    <FeedbackVisual variant="loading" />
    <span className="loading__text">Загрузка...</span>
  </div>
);

export default Loading;
