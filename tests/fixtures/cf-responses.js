// Shared fixture data for tests.
// Based on real automac data from The 2025 ICPC Latin America Championship.

// 2026-02-22T22:06:00Z
export const T1 = Math.floor(new Date('2026-02-22T22:06:00Z').getTime() / 1000);

// A second gym session, one week earlier
export const T2 = T1 - 7 * 24 * 3600;

// ── Submissions ───────────────────────────────────────────────────────────────

export const SUBS_ONE_SIM = [
  // First submission of the simulation
  {
    contestId: 105789,
    creationTimeSeconds: T1 + 100,
    author: {
      participantType: 'VIRTUAL',
      startTimeSeconds: T1,
      teamName: 'Que bendición',
      members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
    },
  },
  // Second submission — same session, must deduplicate to 1 entry
  {
    contestId: 105789,
    creationTimeSeconds: T1 + 200,
    author: {
      participantType: 'VIRTUAL',
      startTimeSeconds: T1,
      teamName: 'Que bendición',
      members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
    },
  },
  // Upsolving — PRACTICE — must be excluded
  {
    contestId: 105789,
    creationTimeSeconds: T1 + 9999,
    author: {
      participantType: 'PRACTICE',
      startTimeSeconds: T1 + 9999,
      members: [{ handle: 'automac' }],
    },
  },
  // Regular CF contest (id < 100000) — must be excluded even if VIRTUAL
  {
    contestId: 2172,
    creationTimeSeconds: T1 + 1000,
    author: {
      participantType: 'VIRTUAL',
      startTimeSeconds: T1 + 1000,
      members: [{ handle: 'automac' }],
    },
  },
];

export const SUBS_TWO_SIMS = [
  // Newer session — gym 105789
  {
    contestId: 105789,
    creationTimeSeconds: T1 + 100,
    author: {
      participantType: 'VIRTUAL',
      startTimeSeconds: T1,
      teamName: 'Que bendición',
      members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
    },
  },
  // Older session — gym 106193
  {
    contestId: 106193,
    creationTimeSeconds: T2 + 100,
    author: {
      participantType: 'VIRTUAL',
      startTimeSeconds: T2,
      teamName: 'Que bendición',
      members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
    },
  },
];

// ── Gym list ──────────────────────────────────────────────────────────────────

export const GYM_LIST = [
  {
    id: 105789,
    name: 'The 2025 ICPC Latin America Championship',
    durationSeconds: 18000, // 5 hours
    difficulty: 3,
  },
  {
    id: 106193,
    name: '2025-2026 ICPC NERC (NEERC), Northern Subregionals',
    durationSeconds: 18000,
    difficulty: 2,
  },
];

// ── Standings ─────────────────────────────────────────────────────────────────

// Key scenario: "Fast and Fourier" starts at the EXACT same second as our team.
// They have rank 120 (higher = appears first in sorted rows).
// The correct match is rank 177 (our team). The fix: match by startTimeSeconds AND member.
export const STANDINGS_105789 = {
  problems: Array.from({ length: 12 }, (_, i) => ({ index: String.fromCharCode(65 + i) })),
  rows: [
    {
      rank: 120,
      party: {
        startTimeSeconds: T1, // same second — the collision case
        members: [{ handle: 'user_x' }, { handle: 'user_y' }],
      },
      problemResults: Array.from({ length: 12 }, (_, i) => ({ points: i < 7 ? 1 : 0 })),
    },
    {
      rank: 177,
      party: {
        startTimeSeconds: T1,
        members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
      },
      problemResults: Array.from({ length: 12 }, (_, i) => ({ points: i < 6 ? 1 : 0 })),
    },
    {
      rank: 350,
      party: {
        startTimeSeconds: T1 - 999,
        members: [{ handle: 'last_team' }],
      },
      problemResults: [],
    },
  ],
};

export const STANDINGS_106193 = {
  problems: Array.from({ length: 12 }, (_, i) => ({ index: String.fromCharCode(65 + i) })),
  rows: [
    {
      rank: 183,
      party: {
        startTimeSeconds: T2,
        members: [{ handle: 'automac' }, { handle: 'elpepe123' }, { handle: 'juancs' }],
      },
      problemResults: Array.from({ length: 12 }, (_, i) => ({ points: i < 6 ? 1 : 0 })),
    },
    {
      rank: 400,
      party: { startTimeSeconds: T2 - 100, members: [{ handle: 'other' }] },
      problemResults: [],
    },
  ],
};
