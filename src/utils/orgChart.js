// src/utils/orgChart.js
//
// Turns the reporting directory into a drawable tree: who manages whom, laid
// out top to bottom. Pure functions — the Org chart tab renders what these
// return.
//
// The directory is edited by people and synced from HR systems, so it is not
// guaranteed to be a clean tree. Every irregularity is kept visible rather
// than hidden, because each one changes where a report escalates:
//   · a manager reference to someone not in the directory (or inactive)
//   · a circular reporting line (A → B → A)
//   · a manager who is not more senior than their report
//   · a person with no level at all

export const PERSON_WIDTH = 232;
export const PERSON_HEIGHT = 92;
const H_GAP = 28;
const V_GAP = 64;
const TREE_GAP = 72;
const LOOSE_GAP = 20;

/** Directories larger than this open with only the top two tiers expanded. */
export const LARGE_DIRECTORY = 80;
const COLLAPSE_BELOW_DEPTH = 2;

export const LOOSE_GROUP_ID = '__loose';

/**
 * @param members active directory entries
 * @param levels  hierarchy levels (for rank and title)
 * @returns {{
 *   byId: Map, children: Map<string, string[]>, roots: string[], loose: string[],
 *   parent: Map<string, string>, depth: Map<string, number>, descendants: Map<string, number>,
 *   flags: Map<string, string[]>,
 * }}
 */
export const buildOrgTree = (members, levels) => {
  const byId = new Map(members.map((m) => [m.external_id, m]));
  const levelByCode = new Map(levels.map((l) => [l.code, l]));
  const rankOf = (member) => levelByCode.get(member?.level_code)?.rank;

  const flags = new Map(members.map((m) => [m.external_id, []]));
  const parent = new Map();
  members.forEach((m) => {
    const managerId = m.manager_external_id;
    if (!managerId) return;
    if (managerId === m.external_id || !byId.has(managerId)) {
      flags.get(m.external_id).push('manager_missing');
      return;
    }
    parent.set(m.external_id, managerId);
  });

  // A circular chain has no top, so nothing in it is reachable from a root.
  // Break each cycle at one member, which becomes a root of its own.
  const reachesTop = new Map();
  const walk = (id) => {
    const seen = new Set();
    let current = id;
    while (parent.has(current)) {
      if (reachesTop.has(current)) break;
      if (seen.has(current)) return current; // the cycle's entry point
      seen.add(current);
      current = parent.get(current);
    }
    seen.forEach((s) => reachesTop.set(s, true));
    reachesTop.set(current, true);
    return null;
  };
  members.forEach((m) => {
    const loopAt = walk(m.external_id);
    if (loopAt) {
      parent.delete(loopAt);
      flags.get(loopAt).push('cycle');
      walk(m.external_id);
    }
  });

  members.forEach((m) => {
    if (!m.level_code) flags.get(m.external_id).push('no_level');
    const managerId = parent.get(m.external_id);
    if (managerId) {
      const own = rankOf(m);
      const theirs = rankOf(byId.get(managerId));
      if (own != null && theirs != null && theirs <= own) flags.get(m.external_id).push('manager_not_senior');
    }
  });

  const children = new Map(members.map((m) => [m.external_id, []]));
  parent.forEach((managerId, id) => children.get(managerId).push(id));

  const bySeniority = (a, b) =>
    (rankOf(byId.get(b)) ?? -Infinity) - (rankOf(byId.get(a)) ?? -Infinity) ||
    byId.get(a).name.localeCompare(byId.get(b).name);
  children.forEach((list) => list.sort(bySeniority));

  const depth = new Map();
  const descendants = new Map();
  const measure = (id, d) => {
    depth.set(id, d);
    const total = children.get(id).reduce((n, child) => n + 1 + measure(child, d + 1), 0);
    descendants.set(id, total);
    return total;
  };

  const tops = members.map((m) => m.external_id).filter((id) => !parent.has(id));
  tops.forEach((id) => measure(id, 0));

  // People who neither have nor are a manager are gathered into one block,
  // instead of stretching the chart into a single very long row.
  const roots = tops
    .filter((id) => children.get(id).length > 0)
    .sort((a, b) => descendants.get(b) - descendants.get(a) || bySeniority(a, b));
  const loose = tops.filter((id) => children.get(id).length === 0).sort(bySeniority);

  return { byId, children, roots, loose, parent, depth, descendants, flags };
};

/** The ids to start collapsed: in a large directory, everyone below the top tiers who has reports. */
export const initialCollapsed = (tree) => {
  if (tree.byId.size <= LARGE_DIRECTORY) return new Set();
  return new Set(
    [...tree.depth.entries()]
      .filter(([id, d]) => d >= COLLAPSE_BELOW_DEPTH - 1 && tree.children.get(id).length > 0)
      .map(([id]) => id),
  );
};

/** Everyone above `id`, nearest first. */
export const ancestorsOf = (tree, id) => {
  const chain = [];
  let current = tree.parent.get(id);
  while (current) {
    chain.push(current);
    current = tree.parent.get(current);
  }
  return chain;
};

/** True when `candidate` sits somewhere under `id`. */
export const isUnder = (tree, candidate, id) => ancestorsOf(tree, candidate).includes(id);

/**
 * Positions for every visible person: each tree top to bottom, parents
 * centred over their reports, trees side by side, and the unconnected people
 * in a grid beneath.
 * @returns {{ positions: Map<string, {x, y}>, visible: string[], looseLabel: {x, y} | null }}
 */
export const layoutOrgTree = (tree, collapsed) => {
  const positions = new Map();
  const visible = [];
  let cursor = 0;
  let bottom = 0;

  const place = (id, d) => {
    visible.push(id);
    const kids = collapsed.has(id) ? [] : tree.children.get(id);
    let x;
    if (!kids.length) {
      x = cursor;
      cursor += PERSON_WIDTH + H_GAP;
    } else {
      const xs = kids.map((kid) => place(kid, d + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    const y = d * (PERSON_HEIGHT + V_GAP);
    bottom = Math.max(bottom, y + PERSON_HEIGHT);
    positions.set(id, { x, y });
    return x;
  };

  tree.roots.forEach((id) => {
    place(id, 0);
    cursor += TREE_GAP - H_GAP;
  });

  let looseLabel = null;
  if (tree.loose.length) {
    const width = Math.max(cursor - TREE_GAP, PERSON_WIDTH);
    const columns = Math.max(1, Math.min(tree.loose.length, Math.floor((width + LOOSE_GAP) / (PERSON_WIDTH + LOOSE_GAP)), 6));
    const top = tree.roots.length ? bottom + 120 : 36;
    looseLabel = { x: 0, y: top - 36 };
    tree.loose.forEach((id, i) => {
      visible.push(id);
      positions.set(id, {
        x: (i % columns) * (PERSON_WIDTH + LOOSE_GAP),
        y: top + Math.floor(i / columns) * (PERSON_HEIGHT + LOOSE_GAP),
      });
    });
  }

  return { positions, visible, looseLabel };
};

export const FLAG_INFO = {
  no_level: {
    label: 'No level',
    description: 'Has no level, so a report naming them cannot be escalated by rank.',
  },
  manager_missing: {
    label: 'Manager not on file',
    description: 'Their manager is not an active person in the directory.',
  },
  cycle: {
    label: 'Circular reporting line',
    description: 'Their chain of managers loops back on itself, so it never reaches the top.',
  },
  manager_not_senior: {
    label: 'Manager not more senior',
    description: 'Their manager sits at the same level or below them.',
  },
};
