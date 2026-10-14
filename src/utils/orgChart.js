// src/utils/orgChart.js
//
// Lays out the by-person org chart. Pure functions — the Org chart tab renders
// what these return.
//
// The chart is loaded the way it's read, one node at a time
// (GET /org-hierarchy/chart/people): the people at the top, then a manager's
// direct reports when their card is opened. So this lays out only what has
// been loaded and opened, never the whole directory — at a few thousand
// people that would never finish, and it's unreadable long before.
//
// The directory is edited by people and synced from HR systems, so it is not
// guaranteed to be a clean tree. What can be seen from the loaded part is
// kept visible, because each one changes where a report escalates:
//   · a manager reference to someone not in the directory
//   · a manager who is not more senior than their report
//   · a person with no level, or only a stale one from an old sync

export const PERSON_WIDTH = 232;
export const PERSON_HEIGHT = 92;
const H_GAP = 28;
const V_GAP = 64;
const TREE_GAP = 72;
const LOOSE_GAP = 20;
// A team of more than this many people with no reports of their own is
// stacked in a grid under their manager instead of one very long row.
const LEAF_ROW_MAX = 4;
const TEAM_COLUMNS_MAX = 4;
const TEAM_ROWS = 5;
const TEAM_PAD = 16;

/** The key of the list above the top: everyone with no manager on file. */
export const TOP = '__top';
export const LOOSE_GROUP_ID = '__loose';
/** The "Show more reports" card at the end of `key`'s loaded children. */
export const moreId = (key) => `__more:${key}`;
export const isMoreId = (id) => id.startsWith('__more:');
/** The frame around a team laid out as a grid. */
export const teamId = (key) => `__team:${key}`;

/**
 * Positions for every visible card: each tree top to bottom, parents centred
 * over their reports, trees side by side, and the people with neither a
 * manager nor reports in a grid beneath.
 *
 * @param roots      top-level ids that have reports
 * @param loose      top-level ids with no reports (a "more" id may end the list)
 * @param childrenOf (id) => the visible children of an opened card, in order
 * @returns {{
 *   positions: Map<string, {x, y}>, visible: string[], looseLabel: {x, y} | null,
 *   teams: { id, parent, x, y, width, height }[], inTeam: Map<string, string>,
 * }}
 */
export const layoutTree = ({ roots, loose, childrenOf }) => {
  const positions = new Map();
  const visible = [];
  const teams = [];
  const inTeam = new Map(); // child id → the team frame it's drawn in
  let cursor = 0;
  let bottom = 0;

  const placed = new Set();
  const place = (id, d) => {
    visible.push(id);
    placed.add(id);
    // A sync can name two people as each other's manager; draw each person once.
    const kids = childrenOf(id).filter((kid) => !placed.has(kid));
    kids.forEach((kid) => placed.add(kid));
    let x;
    const y = d * (PERSON_HEIGHT + V_GAP);
    if (kids.length > LEAF_ROW_MAX && kids.every((kid) => childrenOf(kid).length === 0)) {
      // A big team of individual contributors: a grid in a frame.
      const columns = Math.min(TEAM_COLUMNS_MAX, Math.ceil(kids.length / TEAM_ROWS));
      const rows = Math.ceil(kids.length / columns);
      const width = columns * (PERSON_WIDTH + LOOSE_GAP) - LOOSE_GAP + TEAM_PAD * 2;
      const height = rows * (PERSON_HEIGHT + LOOSE_GAP) - LOOSE_GAP + TEAM_PAD * 2;
      const top = y + PERSON_HEIGHT + V_GAP;
      const frame = { id: teamId(id), parent: id, x: cursor, y: top, width, height };
      teams.push(frame);
      kids.forEach((kid, i) => {
        visible.push(kid);
        inTeam.set(kid, frame.id);
        positions.set(kid, {
          x: cursor + TEAM_PAD + (i % columns) * (PERSON_WIDTH + LOOSE_GAP),
          y: top + TEAM_PAD + Math.floor(i / columns) * (PERSON_HEIGHT + LOOSE_GAP),
        });
      });
      x = cursor + width / 2 - PERSON_WIDTH / 2;
      cursor += width + H_GAP;
      bottom = Math.max(bottom, top + height);
    } else if (!kids.length) {
      x = cursor;
      cursor += PERSON_WIDTH + H_GAP;
    } else {
      const xs = kids.map((kid) => place(kid, d + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    bottom = Math.max(bottom, y + PERSON_HEIGHT);
    positions.set(id, { x, y });
    return x;
  };

  roots.forEach((id) => {
    if (placed.has(id)) return;
    place(id, 0);
    cursor += TREE_GAP - H_GAP;
  });

  let looseLabel = null;
  if (loose.length) {
    const width = Math.max(cursor - TREE_GAP, PERSON_WIDTH);
    const columns = Math.max(1, Math.min(loose.length, Math.floor((width + LOOSE_GAP) / (PERSON_WIDTH + LOOSE_GAP)), 6));
    const top = roots.length ? bottom + 120 : 36;
    looseLabel = { x: 0, y: top - 36 };
    loose.forEach((id, i) => {
      if (placed.has(id)) return;
      visible.push(id);
      positions.set(id, {
        x: (i % columns) * (PERSON_WIDTH + LOOSE_GAP),
        y: top + Math.floor(i / columns) * (PERSON_HEIGHT + LOOSE_GAP),
      });
    });
  }

  return { positions, visible, looseLabel, teams, inTeam };
};

/** Everyone above `id` that has been loaded, nearest first. */
export const ancestorsOf = (parentOf, id) => {
  const chain = [];
  const seen = new Set([id]);
  let current = parentOf.get(id);
  while (current && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = parentOf.get(current);
  }
  return chain;
};

/** True when `candidate` sits somewhere under `id`. */
export const isUnder = (parentOf, candidate, id) => ancestorsOf(parentOf, candidate).includes(id);

/**
 * What's wrong with one person's place, as far as the loaded chart can tell.
 * @param member     the person
 * @param manager    their loaded manager, if any
 * @param atTop      listed above the top (no manager on file, or a dangling one)
 * @param rankOf     (level_code) => rank
 */
export const flagsFor = ({ member, manager, atTop, rankOf }) => {
  const flags = [];
  if (!member.level_code) flags.push('no_level');
  else if (member.level_from === 'legacy') flags.push('legacy_level');
  if (atTop && member.manager_external_id) flags.push('manager_missing');
  if (manager) {
    const own = rankOf(member.level_code);
    const theirs = rankOf(manager.level_code);
    if (own != null && theirs != null && theirs <= own) flags.push('manager_not_senior');
  }
  return flags;
};

export const FLAG_INFO = {
  no_level: {
    label: 'Not placed',
    description: 'Has no role, or a role with no level, so a report naming them cannot be escalated by rank. Give them a role, or give their role a level.',
  },
  legacy_level: {
    label: 'Old level, needs a role',
    description: 'Has no role; the level shown is left over from an old sync, so escalation can’t place them reliably. Give them a role.',
  },
  manager_missing: {
    label: 'Manager not on file',
    description: 'Their manager is not in the directory — usually someone who was removed — so they sit at the top of the chart.',
  },
  manager_not_senior: {
    label: 'Manager not more senior',
    description: 'Their manager sits at the same level or below them.',
  },
};
