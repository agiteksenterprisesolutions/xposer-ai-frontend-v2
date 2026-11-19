// src/hooks/useRegionPacks.js
//
// The active jurisdiction packs in the tenant's region, and the regulators
// they name (ENTITIES.md). These are what an entity's jurisdiction pack,
// business calendar and regulators may be set to; anything else is refused
// (400 unknown_pack, pack_wrong_region, unknown_regulator).
//
//   const { packs, regulators, loading } = useRegionPacks(region);
//   packs:      [{ code, name, region, active_version }]
//   regulators: [{ code, name }] (deduplicated, sorted by code)
//
// `region` null (not set by the platform yet) means no region filter.
import { useEffect, useState } from 'react';
import { jurisdictionAPI } from '../api/jurisdiction';

export function useRegionPacks(region, { enabled = true } = {}) {
  const [state, setState] = useState({ packs: [], regulators: [], loading: enabled });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const list = await jurisdictionAPI.list();
        const packs = (list || []).filter((p) => p.active_version && (!region || p.region === region));
        // The pack list has no regulators; each pack's detail does.
        const details = await Promise.all(packs.map((p) => jurisdictionAPI.get(p.code).catch(() => null)));
        const byCode = new Map();
        details.forEach((d) => (d?.pack?.regulators || []).forEach((r) => r?.code && !byCode.has(r.code) && byCode.set(r.code, r)));
        const regulators = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
        if (!cancelled) setState({ packs, regulators, loading: false });
      } catch {
        if (!cancelled) setState({ packs: [], regulators: [], loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region, enabled]);

  return state;
}

export default useRegionPacks;
