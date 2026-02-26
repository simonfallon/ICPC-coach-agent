import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  T1, T2,
  SUBS_ONE_SIM, SUBS_TWO_SIMS,
  GYM_LIST, STANDINGS_105789, STANDINGS_106193,
} from './fixtures/cf-responses.js';

// Mock the CF module before importing agent.js
vi.mock('../src/codeforces.js');

import * as cf from '../src/codeforces.js';
import { getGymSimulations } from '../src/agent.js';

// Default happy-path mocks — tests can override per-case
beforeEach(() => {
  vi.resetAllMocks();
  cf.getUserSubmissions.mockResolvedValue(SUBS_ONE_SIM);
  cf.getContestList.mockResolvedValue(GYM_LIST);
  cf.getContestStandings.mockResolvedValue(STANDINGS_105789);
});

describe('getGymSimulations', () => {

  describe('basic result shape', () => {
    it('returns the handle and a gyms array', async () => {
      const result = await getGymSimulations('automac', 10);
      expect(result.handle).toBe('automac');
      expect(Array.isArray(result.gyms)).toBe(true);
    });

    it('returns correct contest name from gym list', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].name).toBe('The 2025 ICPC Latin America Championship');
    });

    it('returns correct standings link', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].link).toBe('https://codeforces.com/gym/105789/standings');
    });

    it('formats durationHours correctly (18000s = 5h)', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].durationHours).toBe(5);
    });

    it('formats simulatedAt as UTC string', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].simulatedAt).toBe('2026-02-22 22:06 UTC');
    });

    it('returns teamName', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].teamName).toBe('Que bendición');
    });

    it('returns members sorted alphabetically', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].members).toEqual(['automac', 'elpepe123', 'juancs']);
    });

    it('formats difficulty as star string', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].difficulty).toBe('★★★☆☆'); // difficulty: 3
    });
  });

  describe('standings — rank and solved', () => {
    it('returns correct rank (177, not 120)', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      // The bug: "Fast and Fourier" (rank 120) starts at same T1 second.
      // Must return rank 177 (our team) by combining startTimeSeconds + member match.
      expect(gyms[0].rank).toBe('177');
    });

    it('returns correct solved count (6/12)', async () => {
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].solved).toBe('6/12');
    });

    it('returns null rank/solved when standings call throws, without crashing', async () => {
      cf.getContestStandings.mockRejectedValue(new Error('CF API error'));
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].rank).toBeNull();
      expect(gyms[0].solved).toBeNull();
    });
  });

  describe('filtering', () => {
    it('deduplicates: two submissions from same session → 1 gym entry', async () => {
      // SUBS_ONE_SIM has 2 VIRTUAL subs for gym 105789 at same T1
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms.length).toBe(1);
    });

    it('excludes PRACTICE (upsolving) submissions', async () => {
      // SUBS_ONE_SIM contains a PRACTICE sub — must not appear in results
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms.every(g => g.simulatedAt !== 'upsolving')).toBe(true);
      expect(gyms.length).toBe(1); // only the VIRTUAL session
    });

    it('excludes regular CF contests (contestId < 100000)', async () => {
      // SUBS_ONE_SIM contains a VIRTUAL sub for contest 2172 (regular round)
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms.every(g => !g.link.includes('/contest/'))).toBe(true);
      expect(gyms.find(g => g.link.includes('2172'))).toBeUndefined();
    });

    it('returns empty gyms array when no gym submissions exist', async () => {
      cf.getUserSubmissions.mockResolvedValue([]);
      const result = await getGymSimulations('nobody', 10);
      expect(result.gyms).toEqual([]);
    });
  });

  describe('ordering and limit', () => {
    it('sorts newest-first when two sessions exist', async () => {
      cf.getUserSubmissions.mockResolvedValue(SUBS_TWO_SIMS);
      cf.getContestList.mockResolvedValue(GYM_LIST);
      cf.getContestStandings
        .mockResolvedValueOnce(STANDINGS_105789) // first call = gym 105789
        .mockResolvedValueOnce(STANDINGS_106193); // second call = gym 106193
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].link).toContain('105789'); // T1 (newer) first
      expect(gyms[1].link).toContain('106193'); // T2 (older) second
    });

    it('respects the limit parameter', async () => {
      cf.getUserSubmissions.mockResolvedValue(SUBS_TWO_SIMS);
      cf.getContestList.mockResolvedValue(GYM_LIST);
      cf.getContestStandings.mockResolvedValue(STANDINGS_105789);
      const { gyms } = await getGymSimulations('automac', 1);
      expect(gyms.length).toBe(1);
      expect(gyms[0].link).toContain('105789'); // newest only
    });
  });

  describe('gym metadata', () => {
    it('falls back to Gym #id name when contestId not in gym list', async () => {
      cf.getContestList.mockResolvedValue([]); // empty gym list
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].name).toBe('Gym #105789');
    });

    it('returns null difficulty when not set in gym list', async () => {
      cf.getContestList.mockResolvedValue([
        { id: 105789, name: 'Test Gym', durationSeconds: 18000 }, // no difficulty field
      ]);
      const { gyms } = await getGymSimulations('automac', 10);
      expect(gyms[0].difficulty).toBeNull();
    });

    it('uses handle as sole member when author.members is empty', async () => {
      cf.getUserSubmissions.mockResolvedValue([{
        contestId: 105789,
        creationTimeSeconds: T1,
        author: {
          participantType: 'VIRTUAL',
          startTimeSeconds: T1,
          teamName: null,
          members: [],
        },
      }]);
      const { gyms } = await getGymSimulations('solo_user', 10);
      expect(gyms[0].members).toEqual(['solo_user']);
    });
  });

});
