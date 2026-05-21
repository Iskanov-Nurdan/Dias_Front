import { formatQuantityDisplay } from './numbers';

export const pickProfileName = (p) => {
  if (!p) return '';
  if (p.label != null) {
    const lab = String(p.label).trim();
    if (lab) return lab;
  }
  const n =
    (typeof p.name === 'string' && p.name.trim()) ||
    (typeof p.title === 'string' && p.title.trim()) ||
    (typeof p.code === 'string' && p.code.trim());
  if (n) return n;
  return '';
};

/** Строки заявки: order_lines с бэка или одна legacy-строка с корня заказа. */
export const extractOrderLines = (order) => {
  const source = order || {};
  const buckets = [
    source.order_lines,
    source.lines,
    source.items,
    source.request_lines,
    source.positions,
    source.products,
  ];
  const raw = buckets.find((x) => Array.isArray(x) && x.length) || [];
  if (raw.length) {
    return raw.map((ln, idx) => {
      const profileId = ln?.profile_id ?? ln?.profile?.id ?? ln?.profile ?? null;
      return {
        id: ln?.id ?? `line-${idx}`,
        profile_id: profileId,
        profile_name:
          String(ln?.profile_name ?? ln?.profile_display ?? '').trim()
          || pickProfileName(ln?.profile)
          || '',
        quantity: ln?.quantity ?? ln?.qty ?? ln?.required_quantity ?? '',
      };
    });
  }
  const hasRoot =
    source.profile_id != null
    || source.profile != null
    || String(source.profile_name ?? '').trim()
    || source.quantity != null;
  if (!hasRoot) return [];
  return [
    {
      id: 'root',
      profile_id: source.profile_id ?? (typeof source.profile === 'object' ? source.profile?.id : source.profile),
      profile_name: String(source.profile_name ?? '').trim() || pickProfileName(source.profile) || '',
      quantity: source.quantity,
    },
  ];
};

export const lineProfileLabel = (ln, profileList) => {
  if (ln?.profile_name) return ln.profile_name;
  if (ln?.profile_id != null && profileList?.length) {
    const row = profileList.find((p) => String(p.id) === String(ln.profile_id));
    if (row) return pickProfileName(row);
  }
  return '—';
};

export const lineQuantityLabel = (ln) => {
  const q = ln?.quantity;
  return q != null && q !== '' ? formatQuantityDisplay(q) : '—';
};

/** Числовой id строки заявки для API (order_line_id). */
export const orderLineApiId = (ln) => {
  const id = ln?.id;
  if (id == null || id === 'root' || String(id).startsWith('line-') || String(id).startsWith('order-line-')) {
    return null;
  }
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
};
