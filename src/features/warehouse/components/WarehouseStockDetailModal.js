import React from 'react';
import { Boxes } from 'lucide-react';
import { FormModal } from '../../../shared/ui';
import './WarehouseStockDetailModal.scss';

const WarehouseStockDetailModal = ({ item, onClose }) => (
  <FormModal icon={Boxes} eyebrow="По заготовкам" title={item?.productName} onClose={onClose} size="sheet">
    <div className="form-modal__form">
      <div className="form-modal__body">
        <div className="wsdm__lines">
          {(item?.breakdown ?? []).map((b) => (
            <div key={b.blankName} className="wsdm__line">
              <span className="wsdm__line-name">{b.blankName}</span>
              <span className="wsdm__line-pieces">{b.pieces.toLocaleString('ru-RU')} шт</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-modal__actions">
        <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  </FormModal>
);

export default WarehouseStockDetailModal;
