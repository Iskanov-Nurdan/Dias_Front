import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState } from '../../../../shared/ui';
import './PlasticProfilesPage.scss';

const profileRowLabel = (p) => (p.code ? `${p.name} (${p.code})` : p.name || `#${p.id}`);

const PlasticProfilesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);
  const { items, loading, error, refetch } = useServerQuery('plastic-profiles/', query, { enabled: true });

  const filtered = useMemo(() => {
    const list = items || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const blob = [p.name, p.code, p.id].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  const goCreateRecipe = useCallback(
    (profileId) => {
      navigate(`/recipes?profile_id=${profileId}&open=recipe`);
    },
    [navigate],
  );

  return (
    <div className="page page--plastic-profiles">
      <h1 className="page__title">Профили</h1>
      <p className="plastic-profiles__lede">
        Пластиковые профили. Рецепт всегда привязан к одному профилю — удобнее создавать рецепт отсюда: профиль подставится автоматически.
      </p>

      <div className="plastic-profiles-card">
        <div className="plastic-profiles-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <input
              type="search"
              className="plastic-profiles-card__search"
              placeholder="Поиск по названию, коду…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="Нет профилей" />
        ) : !loading && !error ? (
          <div className="plastic-profiles-table-wrap">
            <div className="plastic-profiles-table">
              <div className="plastic-profiles-table__header">
                <span className="plastic-profiles-table__th">Профиль</span>
                <span className="plastic-profiles-table__th plastic-profiles-table__th--actions">Рецепт</span>
              </div>
              {filtered.map((p) => (
                <div key={p.id} className="plastic-profiles-table__row">
                  <span className="plastic-profiles-table__name">{profileRowLabel(p)}</span>
                  <div className="plastic-profiles-table__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => goCreateRecipe(p.id)}
                    >
                      Создать рецепт
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PlasticProfilesPage;
