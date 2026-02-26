// Integration tests — hit the real Codeforces API.
// Uses stable, well-known data that changes rarely (tourist's profile, finished contests).
// Skips gracefully on network failure so CI doesn't break if CF is down.
import { describe, it, expect } from 'vitest';
import 'dotenv/config';
import {
  getUserInfo,
  getUserRating,
  getUserSubmissions,
  getContestList,
  getContestStandings,
  getProblems,
} from '../src/codeforces.js';

// Wrap calls so a network error skips the test rather than failing it
async function skipOnNetworkError(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.message?.includes('fetch') || err.code === 'ENOTFOUND' || err.message?.includes('network')) {
      return null; // caller will skip
    }
    throw err;
  }
}

describe('Codeforces API — integration', { timeout: 15000 }, () => {

  describe('getUserInfo', () => {
    it('returns tourist profile with expected fields', async () => {
      const result = await skipOnNetworkError(() => getUserInfo(['tourist']));
      if (!result) return; // skip on network failure
      expect(result).toHaveLength(1);
      const user = result[0];
      expect(user.handle).toBe('tourist');
      expect(user.rating).toBeGreaterThan(3000);
      expect(user.rank).toBeDefined();
      expect(user.maxRating).toBeGreaterThan(3000);
    });

    it('returns multiple users when given multiple handles', async () => {
      const result = await skipOnNetworkError(() => getUserInfo(['tourist', 'radewoosh']));
      if (!result) return;
      expect(result).toHaveLength(2);
      const handles = result.map(u => u.handle.toLowerCase());
      expect(handles).toContain('tourist');
      expect(handles).toContain('radewoosh');
    });
  });

  describe('getUserRating', () => {
    it('returns non-empty rating history with correct fields', async () => {
      const result = await skipOnNetworkError(() => getUserRating('tourist'));
      if (!result) return;
      expect(result.length).toBeGreaterThan(0);
      const entry = result[0];
      expect(entry.contestId).toBeDefined();
      expect(entry.newRating).toBeDefined();
      expect(entry.oldRating).toBeDefined();
      expect(entry.rank).toBeDefined();
    });
  });

  describe('getUserSubmissions', () => {
    it('returns the requested number of submissions', async () => {
      const result = await skipOnNetworkError(() => getUserSubmissions('tourist', 5, 1));
      if (!result) return;
      expect(result).toHaveLength(5);
    });

    it('each submission has required fields', async () => {
      const result = await skipOnNetworkError(() => getUserSubmissions('tourist', 3, 1));
      if (!result) return;
      for (const sub of result) {
        expect(sub.id).toBeDefined();
        expect(sub.verdict).toBeDefined();
        expect(sub.problem).toBeDefined();
        expect(sub.author).toBeDefined();
      }
    });
  });

  describe('getContestList', () => {
    it('returns a large list of regular contests with expected fields', async () => {
      const result = await skipOnNetworkError(() => getContestList(false));
      if (!result) return;
      expect(result.length).toBeGreaterThan(100);
      const contest = result[0];
      expect(contest.id).toBeDefined();
      expect(contest.name).toBeDefined();
      expect(contest.phase).toBeDefined();
    });

    it('gym=true returns only gym contests (all IDs > 100000)', async () => {
      const result = await skipOnNetworkError(() => getContestList(true));
      if (!result) return;
      expect(result.length).toBeGreaterThan(0);
      for (const gym of result) {
        expect(gym.id).toBeGreaterThan(100000);
      }
    });
  });

  describe('getContestStandings', () => {
    it('returns the requested number of rows with expected structure', async () => {
      const result = await skipOnNetworkError(() => getContestStandings(1, 1, 5));
      if (!result) return;
      expect(result.rows).toHaveLength(5);
      const row = result.rows[0];
      expect(row.rank).toBe(1);
      expect(row.party).toBeDefined();
      expect(row.problemResults).toBeDefined();
    });

    it('showUnofficial=true includes virtual participants for gym 105789', async () => {
      const result = await skipOnNetworkError(() => getContestStandings(105789, 1, 50, [], true));
      if (!result) return;
      // With showUnofficial, some rows should be virtual participants
      const hasVirtual = result.rows.some(r =>
        r.party?.participantType === 'VIRTUAL' || r.party?.startTimeSeconds !== undefined
      );
      expect(hasVirtual).toBe(true);
    });
  });

  describe('getProblems', () => {
    it('returns problems tagged dp with correct structure', async () => {
      const result = await skipOnNetworkError(() => getProblems(['dp']));
      if (!result) return;
      expect(result.problems.length).toBeGreaterThan(0);
      for (const p of result.problems.slice(0, 5)) {
        expect(p.tags).toContain('dp');
        expect(p.name).toBeDefined();
      }
    });
  });

  describe('rate limiting', () => {
    it('three back-to-back calls complete without error and take ≥ 1000ms', async () => {
      const start = Date.now();
      const r1 = await skipOnNetworkError(() => getUserInfo(['tourist']));
      if (!r1) return;
      await getUserInfo(['tourist']);
      await getUserInfo(['tourist']);
      const elapsed = Date.now() - start;
      // 3 calls with 500ms enforced between each = at least 1000ms total
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    }, 20000);
  });

});
