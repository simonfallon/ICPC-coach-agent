import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/codeforces.js');

import * as cf from '../src/codeforces.js';
import { getGymRecommendations } from '../src/agent.js';

const mock = vi.mocked(cf);

// Timestamps
const NOW = Math.floor(Date.now() / 1000);
const OLD = Math.floor(new Date('2024-07-01').getTime() / 1000); // well outside 6-month window

// Gym IDs (must be > 100000 to qualify as gym contests)
const GYM_A = 200001; // simulated by both competitors
const GYM_B = 200002; // simulated by compB AND already done by my team → must be excluded
const GYM_C = 200003; // simulated by compB only, not done by my team

function makeSub(contestId: number, participantType: string, time = NOW) {
  return {
    contestId,
    creationTimeSeconds: time,
    author: {
      participantType,
      startTimeSeconds: time,
      members: [{ handle: 'someone' }],
    },
  };
}

const MY_SUBS = [makeSub(GYM_B, 'VIRTUAL')];          // my team has done GYM_B
const COMP_A_SUBS = [makeSub(GYM_A, 'VIRTUAL')];       // compA has done GYM_A
const COMP_B_SUBS = [
  makeSub(GYM_A, 'VIRTUAL'),                           // compB has also done GYM_A → count=2
  makeSub(GYM_B, 'VIRTUAL'),                           // compB has done GYM_B, but my team did too → excluded
  makeSub(GYM_C, 'VIRTUAL'),                           // compB has done GYM_C → count=1
];

const GYM_LIST_REC = [
  { id: GYM_A, name: 'Gym Alpha', durationSeconds: 18000, difficulty: 3 },
  { id: GYM_B, name: 'Gym Beta',  durationSeconds: 14400, difficulty: 2 },
  { id: GYM_C, name: 'Gym Gamma', durationSeconds: 18000, difficulty: undefined },
];

function setupStandardMocks() {
  mock.getUserSubmissions.mockImplementation(async (handle: string) => {
    if (handle === 'myuser') return MY_SUBS as any;
    if (handle === 'compA')  return COMP_A_SUBS as any;
    if (handle === 'compB')  return COMP_B_SUBS as any;
    return [] as any;
  });
  mock.getContestList.mockResolvedValue(GYM_LIST_REC as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUserSubmissions.mockResolvedValue([] as any);
  mock.getContestList.mockResolvedValue(GYM_LIST_REC as any);
});

describe('getGymRecommendations', () => {

  describe('basic shape', () => {
    it('returns a recommendations array', async () => {
      setupStandardMocks();
      const result = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('returns correct contest name from gym list', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const alpha = recommendations.find(r => r.link.includes(`${GYM_A}`));
      expect(alpha?.name).toBe('Gym Alpha');
    });

    it('returns correct link for the gym', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(recommendations[0].link).toBe(`https://codeforces.com/gym/${GYM_A}`);
    });

    it('formats difficulty as star string', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const alpha = recommendations.find(r => r.link.includes(`${GYM_A}`));
      expect(alpha?.difficulty).toBe('★★★☆☆'); // difficulty: 3
    });

    it('formats durationHours correctly (18000s = 5h)', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const alpha = recommendations.find(r => r.link.includes(`${GYM_A}`));
      expect(alpha?.durationHours).toBe(5);
    });

    it('includes totalCompetitorTeams equal to competitorHandles length', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(recommendations[0].totalCompetitorTeams).toBe(2);
    });

    it('falls back to Gym #id name when contest not in gym list', async () => {
      setupStandardMocks();
      mock.getContestList.mockResolvedValue([]);
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(recommendations.every(r => r.name.startsWith('Gym #'))).toBe(true);
    });

    it('returns null difficulty when not set in gym list', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const gamma = recommendations.find(r => r.link.includes(`${GYM_C}`));
      expect(gamma?.difficulty).toBeNull();
    });
  });

  describe('filtering', () => {
    it('excludes gyms already simulated by the target team', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(recommendations.find(r => r.link.includes(`${GYM_B}`))).toBeUndefined();
    });

    it('excludes PRACTICE (upsolving) submissions from competitors', async () => {
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'myuser') return [] as any;
        // compA only has a PRACTICE sub — should not count
        return [makeSub(GYM_A, 'PRACTICE')] as any;
      });
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA']);
      expect(recommendations.length).toBe(0);
    });

    it('excludes regular CF contests (contestId ≤ 100000) from competitors', async () => {
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'myuser') return [] as any;
        return [makeSub(99999, 'VIRTUAL')] as any; // not a gym (id ≤ 100000)
      });
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA']);
      expect(recommendations.length).toBe(0);
    });

    it('excludes submissions older than the default 6-month window', async () => {
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'myuser') return [] as any;
        return [makeSub(GYM_A, 'VIRTUAL', OLD)] as any; // OLD is outside window
      });
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA']);
      expect(recommendations.length).toBe(0);
    });

    it('includes submissions within a custom months window', async () => {
      // A submission 10 months ago — outside 6 months but inside 12 months
      const TEN_MONTHS_AGO = Math.floor(Date.now() / 1000) - 10 * 30 * 24 * 3600;
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'myuser') return [] as any;
        return [makeSub(GYM_A, 'VIRTUAL', TEN_MONTHS_AGO)] as any;
      });
      const defaultResult = await getGymRecommendations(['myuser'], ['compA'], 5, 6);
      const extendedResult = await getGymRecommendations(['myuser'], ['compA'], 5, 12);
      expect(defaultResult.recommendations.length).toBe(0);  // outside 6 months
      expect(extendedResult.recommendations.length).toBe(1); // inside 12 months
    });
  });

  describe('team counting', () => {
    it('counts correctly: gym seen by 2 competitors has teamsSimulated=2', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const alpha = recommendations.find(r => r.link.includes(`${GYM_A}`));
      expect(alpha?.teamsSimulated).toBe(2);
    });

    it('counts correctly: gym seen by only 1 competitor has teamsSimulated=1', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      const gamma = recommendations.find(r => r.link.includes(`${GYM_C}`));
      expect(gamma?.teamsSimulated).toBe(1);
    });

    it('treats each competitorHandle as a distinct team (no double-counting within one handle)', async () => {
      // compA has two VIRTUAL subs for the same gym — must still count as 1 team
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'myuser') return [] as any;
        return [makeSub(GYM_A, 'VIRTUAL'), makeSub(GYM_A, 'VIRTUAL')] as any;
      });
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA']);
      const alpha = recommendations.find(r => r.link.includes(`${GYM_A}`));
      expect(alpha?.teamsSimulated).toBe(1);
    });
  });

  describe('ordering and limit', () => {
    it('sorts by popularity descending — most simulated gym is first', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      // GYM_A (count=2) should come before GYM_C (count=1)
      expect(recommendations[0].link).toContain(`${GYM_A}`);
    });

    it('respects the limit parameter', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB'], 1);
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].link).toContain(`${GYM_A}`); // top result only
    });

    it('returns at most limit recommendations even when more are available', async () => {
      setupStandardMocks();
      const { recommendations } = await getGymRecommendations(['myuser'], ['compA', 'compB'], 1);
      expect(recommendations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('empty / edge cases', () => {
    it('returns empty recommendations when no competitor has any gym simulations', async () => {
      // All mocks return [] by default from beforeEach
      const result = await getGymRecommendations(['myuser'], ['compA', 'compB']);
      expect(result.recommendations).toEqual([]);
    });

    it('returns empty recommendations when all competitor gyms are already done by my team', async () => {
      mock.getUserSubmissions.mockResolvedValue([makeSub(GYM_A, 'VIRTUAL')] as any);
      // myuser has also done GYM_A, so nothing to recommend
      const result = await getGymRecommendations(['myuser'], ['compA']);
      expect(result.recommendations).toEqual([]);
    });

    it('handles empty myHandles gracefully (no exclusions)', async () => {
      mock.getUserSubmissions.mockImplementation(async (handle: string) => {
        if (handle === 'compA') return COMP_A_SUBS as any;
        return [] as any;
      });
      const { recommendations } = await getGymRecommendations([], ['compA']);
      expect(recommendations.find(r => r.link.includes(`${GYM_A}`))).toBeDefined();
    });
  });

});
