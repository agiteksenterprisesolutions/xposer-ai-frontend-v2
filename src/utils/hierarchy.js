// src/utils/hierarchy.js
//
// Helpers for the reporting hierarchy: level ranks, and turning a pasted
// spreadsheet into directory rows.

// Ranks are spaced so a tier can be slotted between two others later without
// renumbering. Higher = more senior.
export const RANK_STEP = 10;

/** A rank for a new level: one step above the current most senior. */
export const nextRank = (levels = []) =>
  levels.length ? Math.max(...levels.map((l) => Number(l.rank) || 0)) + RANK_STEP : RANK_STEP;

/**
 * Ranks after a reorder, rewritten in steps of 10 with the first (most
 * senior) highest. Returns only the levels whose rank changes: [{ level, rank }].
 */
export const reRank = (orderedLevels) =>
  orderedLevels
    .map((level, index) => ({ level, rank: (orderedLevels.length - index) * RANK_STEP }))
    .filter(({ level, rank }) => level.rank !== rank);

/** Most senior first; ties broken by title so the order is stable. */
export const sortLevels = (levels = []) =>
  [...levels].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || (a.title || '').localeCompare(b.title || ''));

// ─── Bulk paste ──────────────────────────────────────────────────────────

/**
 * The directory fields a pasted sheet can fill, with the header spellings we
 * recognise for each. Only `name` is required.
 */
export const BULK_FIELDS = [
  { field: 'name', label: 'Name', aliases: ['name', 'full name', 'employee name', 'display name'] },
  { field: 'external_id', label: 'Employee ID', aliases: ['external id', 'external_id', 'employee id', 'employee_id', 'id', 'emp id', 'staff id'] },
  { field: 'email', label: 'Email', aliases: ['email', 'e-mail', 'work email', 'email address'] },
  { field: 'designation', label: 'Job title', aliases: ['designation', 'job title', 'title', 'position', 'role'] },
  { field: 'department', label: 'Department', aliases: ['department', 'dept', 'function', 'division'] },
  { field: 'level_code', label: 'Level', aliases: ['level', 'level code', 'level_code', 'grade'] },
  {
    field: 'manager_external_id',
    label: 'Manager ID',
    aliases: ['manager', 'manager id', 'manager_id', 'manager external id', 'manager_external_id', 'reports to', 'line manager id'],
  },
];

/** The header row a user can paste into their sheet. */
export const BULK_TEMPLATE_HEADER = BULK_FIELDS.map((f) => f.label).join('\t');

const normalizeHeader = (text) => text.toLowerCase().replace(/[_\s]+/g, ' ').trim();

/** Header cells → field names (null for a column we don't recognise). */
export const mapHeaders = (headerCells) =>
  headerCells.map((cell) => {
    const key = normalizeHeader(cell);
    const match = BULK_FIELDS.find((f) => f.aliases.some((alias) => normalizeHeader(alias) === key));
    return match ? match.field : null;
  });

/**
 * Split pasted text into rows of cells. Spreadsheets paste as tab-separated;
 * a CSV file's contents work too. Handles quoted cells with embedded commas,
 * tabs, quotes ("") and newlines. Blank lines are dropped.
 */
export const parseTable = (text) => {
  const source = text.replace(/\r\n?/g, '\n');
  const firstLine = source.split('\n', 1)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
};

/**
 * Pasted text → { members, columns, unknownHeaders, error }. The first row
 * must be a header naming the columns, in any order.
 */
export const membersFromPaste = (text) => {
  const rows = parseTable(text);
  if (rows.length === 0) return { members: [], columns: [], unknownHeaders: [], error: null };

  const [header, ...body] = rows;
  const columns = mapHeaders(header);
  if (!columns.includes('name')) {
    return {
      members: [],
      columns,
      unknownHeaders: [],
      error: 'The first row must be a header with a "Name" column. Use "Copy header row" above and paste it into row 1 of your sheet.',
    };
  }

  const members = body.map((cells) => {
    const member = {};
    columns.forEach((field, index) => {
      const value = cells[index];
      if (field && value) member[field] = value;
    });
    return member;
  });

  const unknownHeaders = header.filter((_, index) => !columns[index]);
  return { members, columns, unknownHeaders, error: null };
};
