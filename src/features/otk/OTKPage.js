import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, History, ClipboardCheck } from 'lucide-react';
import { fetchOtkPool, fetchOtkHistory, postOtkAccount } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, PrimaryTabs, Fab } from '../../shared/ui';
import { OtkPoolList, OtkHistoryList, OtkAccountModal, OtkHistoryDetailModal } from './components';
import './OTKPage.scss';

const TAB_POOL = 'pool';
const TAB_HISTORY = 'history';

const TABS = [
  { id: TAB_POOL, label: 'Очередь', icon: ClipboardList },
  { id: TAB_HISTORY, label: 'История', icon: History },
];

const OTKPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(TAB_POOL);

  // ── Очередь (небольшой каталог заготовок — грузим целиком) ──
  const [pool, setPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState(null);

  const loadPool = useCallback(() => {
    setPoolLoading(true);
    setPoolError(null);
    fetchOtkPool(null)
      .then((data) => setPool(data?.items ?? []))
      .catch((err) => setPoolError(getApiErrorMessage(err)))
      .finally(() => setPoolLoading(false));
  }, []);

  useEffect(() => { loadPool(); }, [loadPool]);

  // ── История (журнал растёт без остановки — серверная пагинация) ──
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    fetchOtkHistory({ page: historyPage, pageSize: 20 }, null)
      .then((data) => setHistory(data))
      .catch((err) => setHistoryError(getApiErrorMessage(err)))
      .finally(() => setHistoryLoading(false));
  }, [historyPage]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) loadHistory();
  }, [activeTab, loadHistory]);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountError, setAccountError] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [detailsSession, setDetailsSession] = useState(null);

  const handleAccount = async (body) => {
    setAccountError(null);
    setAccountSaving(true);
    try {
      await postOtkAccount(body, null);
      setShowAccountModal(false);
      loadPool();
      if (activeTab === TAB_HISTORY) loadHistory();
      toast.success('Учёт сохранён — товар на складе');
    } catch (err) {
      setAccountError(getApiErrorMessage(err));
    } finally {
      setAccountSaving(false);
    }
  };

  const canAccount = pool.some((p) => p.can_account);

  return (
    <div className="otk-page">
      <PrimaryTabs
        items={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        action={activeTab === TAB_POOL && (
          <button
            type="button"
            className="otk-page__add"
            onClick={() => setShowAccountModal(true)}
            disabled={!canAccount}
            title={!canAccount ? 'Нет заготовок, ожидающих учёта' : undefined}
          >
            <ClipboardCheck size={16} /> Учесть
          </button>
        )}
      />

      {activeTab === TAB_POOL && (
        <OtkPoolList items={pool} loading={poolLoading} error={poolError} onRetry={loadPool} />
      )}

      {activeTab === TAB_HISTORY && (
        <>
          <OtkHistoryList
            items={history?.items}
            loading={historyLoading}
            error={historyError}
            onRetry={loadHistory}
            onDetails={setDetailsSession}
          />
          <Pagination
            meta={history?.meta}
            currentPage={historyPage}
            onPage={setHistoryPage}
            loading={historyLoading}
            entityLabel="учётов"
          />
        </>
      )}

      {showAccountModal && (
        <OtkAccountModal
          pool={pool}
          onSave={handleAccount}
          onClose={() => { setShowAccountModal(false); setAccountError(null); }}
          error={accountError}
          saving={accountSaving}
        />
      )}

      {detailsSession && (
        <OtkHistoryDetailModal item={detailsSession} onClose={() => setDetailsSession(null)} />
      )}

      {activeTab === TAB_POOL && (
        <Fab
          onClick={() => setShowAccountModal(true)}
          label="Учесть"
          icon={ClipboardCheck}
          disabled={!canAccount}
          title={!canAccount ? 'Нет заготовок, ожидающих учёта' : undefined}
        />
      )}
    </div>
  );
};

export default OTKPage;
