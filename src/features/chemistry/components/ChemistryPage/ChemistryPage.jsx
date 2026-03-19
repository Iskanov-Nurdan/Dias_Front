import React, { useState, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import {
  createChemicalElement,
  updateChemicalElement,
  deleteChemicalElement,
  createChemistryTask,
  updateChemistryTask,
  deleteChemistryTask,
  confirmChemistryTask,
} from '../../api/chemistryApi';
import { apiClient } from '../../../../shared/api';
import './ChemistryPage.scss';

const UNITS = [
  { value: 'кг', label: 'кг' },
  { value: 'л', label: 'л' },
  { value: 'г', label: 'г' },
  { value: 'мл', label: 'мл' },
];

const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

const apiError = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  if (data.code === 'INSUFFICIENT_STOCK') {
    const base = data.error || 'Недостаточно остатков сырья.';
    const missing = data.missing;
    if (Array.isArray(missing) && missing.length) {
      const rows = missing.map((m) =>
        typeof m === 'object'
          ? `${m.component || m.raw_material || m.name || '—'}: требуется ${m.required ?? '?'} ${m.unit || ''}, доступно ${m.available ?? 0}`
          : String(m)
      );
      return `${base} ${rows.join('; ')}`;
    }
    return base;
  }
  return data.error || 'Ошибка';
};

const ChemistryPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('elements');
  const [dirQuery, setDirQuery] = useState({ page: 1, page_size: 20, search: '' });
  const [taskQuery] = useState({ page: 1, page_size: 20 });
  const [dirModal, setDirModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items: elements, loading: dirLoading, error: dirError, refetch: refetchDir } = useServerQuery(
    'chemistry/elements/',
    activeTab === 'elements' ? dirQuery : { page_size: 500 },
    { enabled: activeTab === 'elements' || activeTab === 'tasks' }
  );

  const { items: tasks, loading: taskLoading, error: taskError, refetch: refetchTasks } = useServerQuery(
    'chemistry/tasks/',
    activeTab === 'tasks' ? taskQuery : activeTab === 'balances' ? { page_size: 500 } : { page_size: 1 },
    { enabled: activeTab === 'tasks' || activeTab === 'balances' }
  );

  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesSearch, setBalancesSearch] = useState('');

  useEffect(() => {
    if (activeTab !== 'balances') return;
    setBalancesLoading(true);
    apiClient.get('chemistry/balances/').then((res) => {
      const raw = res.data?.items ?? res.data ?? [];
      setBalances(Array.isArray(raw) ? raw : []);
    }).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, [activeTab]);

  const balancesFiltered = balancesSearch.trim()
    ? balances.filter((b) =>
        (b.element_name || '').toLowerCase().includes(balancesSearch.trim().toLowerCase())
      )
    : balances;

  const handleDirSubmit = async (data) => {
    setSubmitError('');
    try {
      if (dirModal?.id) {
        await updateChemicalElement(dirModal.id, data);
      } else {
        await createChemicalElement(data);
      }
      setDirModal(null);
      refetchDir();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(apiError(err));
    }
  };

  const handleTaskSubmit = async (data) => {
    setSubmitError('');
    try {
      if (taskModal?.id) {
        await updateChemistryTask(taskModal.id, data);
      } else {
        await createChemistryTask(data);
      }
      setTaskModal(null);
      refetchTasks();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(apiError(err));
    }
  };

  const handleConfirmTask = async () => {
    if (!confirmTarget) return;
    setSubmitError('');
    try {
      await confirmChemistryTask(confirmTarget.id);
      setConfirmTarget(null);
      refetchTasks();
      refetchDir();
      toast.show('Задача подтверждена');
    } catch (err) {
      setSubmitError(apiError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      if (deleteTarget.type === 'element') {
        await deleteChemicalElement(deleteTarget.id);
        refetchDir();
      } else {
        await deleteChemistryTask(deleteTarget.id);
        refetchTasks();
      }
      setDeleteTarget(null);
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(apiError(err));
    }
  };

  const taskStatusBadge = (t) => {
    const s = String(t.status || '').toLowerCase();
    if (s === 'done' || s === 'completed' || s === 'выполнено') return { label: 'ВЫПОЛНЕНО', cls: 'green' };
    if (s === 'in_progress') return { label: 'В РАБОТЕ', cls: 'orange' };
    return { label: 'ОЖИДАЕТ', cls: 'blue' };
  };

  return (
    <div className="page page--chemistry">
      <div className="chemistry-tabs">
        <button
          type="button"
          className={`chemistry-tabs__tab ${activeTab === 'elements' ? 'chemistry-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('elements')}
        >
          Элементы
        </button>
        <button
          type="button"
          className={`chemistry-tabs__tab ${activeTab === 'tasks' ? 'chemistry-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Задачи
        </button>
        <button
          type="button"
          className={`chemistry-tabs__tab ${activeTab === 'balances' ? 'chemistry-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Склад химии
        </button>
      </div>

      {activeTab === 'elements' && (
        <div className="chemistry-card">
          <div className="chemistry-card__head">
            <h2 className="chemistry-card__title">Элементы</h2>
            <div className="chemistry-card__actions">
              <input
                type="text"
                className="chemistry-card__search"
                placeholder="Поиск..."
                value={dirQuery.search || ''}
                onChange={(e) => setDirQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
              />
              <button type="button" className="btn btn--primary" onClick={() => setDirModal({})}>
                Добавить
              </button>
            </div>
          </div>
          {dirLoading && <Loading />}
          {dirError && <ErrorState error={dirError} onRetry={refetchDir} />}
          {!dirLoading && !dirError && (
            elements.length === 0 ? (
              <EmptyState title="Нет данных" />
            ) : (
              <div className="chemistry-table chemistry-table--elements">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">НАЗВАНИЕ</span>
                  <span className="chemistry-table__th">ЕД.</span>
                  <span className="chemistry-table__th">СОСТАВ</span>
                  <span className="chemistry-table__th chemistry-table__th--actions">ДЕЙСТВИЯ</span>
                </div>
                {elements.map((el) => (
                  <div key={el.id} className="chemistry-table__row">
                    <span className="chemistry-table__name">{el.name}</span>
                    <span className="chemistry-table__unit">{el.unit || 'кг'}</span>
                    <span className="chemistry-table__composition">
                      {(el.compositions || []).map((c) =>
                        `${c.raw_material_name || c.raw_material || '—'}: ${c.quantity_per_unit ?? ''}`
                      ).join(', ') || '—'}
                    </span>
                    <div className="chemistry-table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDirModal(el)}>
                        Редактировать
                      </button>
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ type: 'element', id: el.id, name: el.name })}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="chemistry-card">
          <div className="chemistry-banner">
            Подтвердите выполнение — элемент появится на складе химии.
          </div>
          <div className="chemistry-card__head">
            <h2 className="chemistry-card__title">Задачи</h2>
            <button type="button" className="btn btn--primary" onClick={() => setTaskModal({})}>
              Добавить
            </button>
          </div>
          {submitError && (
            <div className="chemistry-card__error">
              {submitError}
              <button type="button" className="chemistry-card__error-dismiss" onClick={() => setSubmitError('')} aria-label="Закрыть">×</button>
            </div>
          )}
          {taskLoading && <Loading />}
          {taskError && <ErrorState error={taskError} onRetry={refetchTasks} />}
          {!taskLoading && !taskError && (
            tasks.length === 0 ? (
              <EmptyState title="Нет задач" />
            ) : (
              <div className="chemistry-table chemistry-table--tasks">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">ЗАДАНИЕ</span>
                  <span className="chemistry-table__th">ЭЛЕМЕНТ</span>
                  <span className="chemistry-table__th">КОЛ-ВО</span>
                  <span className="chemistry-table__th">СРОК</span>
                  <span className="chemistry-table__th">СТАТУС</span>
                  <span className="chemistry-table__th chemistry-table__th--actions">ДЕЙСТВИЯ</span>
                </div>
                {tasks.map((t) => {
                  const st = taskStatusBadge(t);
                  const canConfirm = st.cls !== 'green';
                  return (
                    <div key={t.id} className="chemistry-table__row">
                      <span className="chemistry-table__name">{t.name || '—'}</span>
                      <span>{t.chemistry_name || t.chemistry || '—'}</span>
                      <span>{t.quantity} {t.unit || 'кг'}</span>
                      <span>{formatDate(t.deadline)}</span>
                      <span>
                        <span className={`chemistry-table__badge chemistry-table__badge--${st.cls}`}>{st.label}</span>
                      </span>
                      <div className="chemistry-table__actions">
                        {canConfirm && (
                          <button
                            type="button"
                            className="btn btn--success btn--sm"
                            onClick={() => setConfirmTarget(t)}
                          >
                            Подтвердить
                          </button>
                        )}
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTaskModal(t)}>Редактировать</button>
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ type: 'task', id: t.id, name: t.name })}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="chemistry-card">
          <div className="chemistry-card__head">
            <h2 className="chemistry-card__title">Склад химии</h2>
            <input
              type="text"
              className="chemistry-card__search"
              placeholder="Поиск..."
              value={balancesSearch}
              onChange={(e) => setBalancesSearch(e.target.value)}
            />
          </div>
          {balancesLoading && <Loading />}
          {!balancesLoading && (
            balancesFiltered.length === 0 ? (
              <EmptyState title="Нет остатков" />
            ) : (
              <div className="chemistry-table chemistry-table--balances">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">ЭЛЕМЕНТ</span>
                  <span className="chemistry-table__th">ЕД.</span>
                  <span className="chemistry-table__th">ОСТАТОК</span>
                  <span className="chemistry-table__th">ДАТА</span>
                  <span className="chemistry-table__th">ЗАДАЧА</span>
                </div>
                {balancesFiltered.map((b, i) => (
                  <div key={b.element_name || i} className="chemistry-table__row">
                    <span className="chemistry-table__name">{b.element_name || '—'}</span>
                    <span className="chemistry-table__unit">{b.unit || 'кг'}</span>
                    <span>{b.balance ?? 0}</span>
                    <span>{formatDate(b.date)}</span>
                    <span>{b.task_name || '—'}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {dirModal !== null && (
        <ElementModal
          item={dirModal?.id ? dirModal : null}
          onSubmit={handleDirSubmit}
          onClose={() => { setDirModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {taskModal !== null && (
        <TaskModal
          item={taskModal?.id ? taskModal : null}
          elements={elements}
          onSubmit={handleTaskSubmit}
          onClose={() => { setTaskModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!confirmTarget}
        title="Подтвердить выполнение?"
        message={confirmTarget ? `Сырьё будет списано, остаток химии пополнится. Задача «${confirmTarget.name}» будет отмечена выполненной.` : ''}
        confirmText="Подтвердить"
        onConfirm={handleConfirmTask}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

const ElementModal = ({ item, onSubmit, onClose, error }) => {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'кг');
  const [compositions, setCompositions] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((r) => setRawMaterials(r.data?.items || []))
      .catch(() => setRawMaterials([]));
  }, []);

  useEffect(() => {
    const comp = item?.compositions || [];
    const arr = Array.isArray(comp) ? comp.map((c) => ({
      raw_material_id: c.raw_material ?? c.raw_material_id ?? '',
      quantity_per_unit: c.quantity_per_unit ?? '',
    })) : [];
    setCompositions(arr.length ? arr : [{ raw_material_id: '', quantity_per_unit: '' }]);
  }, [item?.id, item?.compositions]);

  const addRow = () => {
    setCompositions((prev) => [...prev, { raw_material_id: '', quantity_per_unit: '' }]);
  };

  const updateRow = (idx, field, value) => {
    setCompositions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeRow = (idx) => {
    setCompositions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const valid = compositions
      .map((c) => ({
        raw_material_id: Number(c.raw_material_id),
        quantity_per_unit: Number(c.quantity_per_unit),
      }))
      .filter((c) => c.raw_material_id && c.quantity_per_unit > 0);
    onSubmit({ name, unit, compositions: valid });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{item ? 'Редактировать элемент' : 'Добавить элемент'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Ед. *</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <label>Состав (сырьё → кол-во на ед.) *</label>
          {compositions.map((c, i) => (
            <div key={c.raw_material_id ? `comp-${c.raw_material_id}-${i}` : `comp-empty-${i}`} className="element-modal__row">
              <select
                value={c.raw_material_id || ''}
                onChange={(e) => updateRow(i, 'raw_material_id', e.target.value)}
                required
              >
                <option value="">—</option>
                {rawMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Кол-во на ед."
                value={c.quantity_per_unit ?? ''}
                onChange={(e) => updateRow(i, 'quantity_per_unit', e.target.value)}
                required
              />
              <button type="button" className="btn btn--sm btn--danger" onClick={() => removeRow(i)}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn--secondary btn--sm" onClick={addRow}>+ Добавить компонент</button>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaskModal = ({ item, elements, onSubmit, onClose, error }) => {
  const [name, setName] = useState(item?.name ?? '');
  const [chemistry, setChemistry] = useState(item?.chemistry != null ? String(item.chemistry) : '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [deadline, setDeadline] = useState(item?.deadline ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (qty <= 0) return;
    onSubmit({
      name,
      chemistry: Number(chemistry),
      quantity: qty,
      deadline: deadline || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{item ? 'Редактировать задачу' : 'Добавить задачу'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Элемент химии *</label>
          <select value={chemistry} onChange={(e) => setChemistry(e.target.value)} required>
            <option value="">—</option>
            {elements.map((el) => (
              <option key={el.id} value={el.id}>{el.name} ({el.unit || 'кг'})</option>
            ))}
          </select>
          <label>Количество *</label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <label>Срок</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChemistryPage;
