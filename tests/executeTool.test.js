import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/codeforces.js');

import * as cf from '../src/codeforces.js';
import { executeTool } from '../src/agent.js';

const FAKE_USER = [{ handle: 'tourist', rating: 3979, rank: 'legendary grandmaster' }];
const FAKE_RATING = [{ contestId: 1, newRating: 3000, oldRating: 2900, rank: 5 }];
const FAKE_SUBS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  contestId: 100 + i,
  creationTimeSeconds: 1700000000 + i,
  verdict: 'OK',
  programmingLanguage: 'C++20',
  problem: { contestId: 100 + i, index: 'A', name: `Problem ${i}`, rating: 1500 },
  author: { participantType: 'CONTESTANT' },
}));
const FAKE_CONTESTS = [{ id: 1, name: 'CF Round 1', type: 'CF', phase: 'FINISHED', startTimeSeconds: 1700000000 }];
const FAKE_STANDINGS = { rows: [{ rank: 1, party: { members: [{ handle: 'tourist' }] }, problemResults: [] }] };
const FAKE_STATUS = [{ id: 1, verdict: 'OK' }];
const FAKE_RATING_CHANGES = [{ handle: 'tourist', newRating: 3979, oldRating: 3900 }];
const FAKE_PROBLEMS = { problems: [{ contestId: 1, index: 'A', name: 'P1', rating: 1800, tags: ['dp'] }], problemStatistics: [] };
const FAKE_ACTIONS = [{ timeSeconds: 1700000000, blogEntry: { id: 1 } }];
const FAKE_RATED = Array.from({ length: 10 }, (_, i) => ({
  handle: `user${i}`, rating: 3000 - i * 10, maxRating: 3100, rank: 'grandmaster', country: 'Russia',
}));

beforeEach(() => {
  vi.resetAllMocks();
  // Default stubs — each test overrides what it needs
  cf.getUserInfo.mockResolvedValue(FAKE_USER);
  cf.getUserRating.mockResolvedValue(FAKE_RATING);
  cf.getUserSubmissions.mockResolvedValue(FAKE_SUBS);
  cf.getContestList.mockResolvedValue(FAKE_CONTESTS);
  cf.getContestStandings.mockResolvedValue(FAKE_STANDINGS);
  cf.getContestStatus.mockResolvedValue(FAKE_STATUS);
  cf.getContestRatingChanges.mockResolvedValue(FAKE_RATING_CHANGES);
  cf.getProblems.mockResolvedValue(FAKE_PROBLEMS);
  cf.getRecentActions.mockResolvedValue(FAKE_ACTIONS);
  cf.getRatedList.mockResolvedValue(FAKE_RATED);
});

describe('executeTool — dispatch', () => {

  it('get_user_info calls getUserInfo with handles array', async () => {
    await executeTool('get_user_info', { handles: ['tourist', 'radewoosh'] });
    expect(cf.getUserInfo).toHaveBeenCalledWith(['tourist', 'radewoosh']);
  });

  it('get_user_rating calls getUserRating with handle', async () => {
    await executeTool('get_user_rating', { handle: 'tourist' });
    expect(cf.getUserRating).toHaveBeenCalledWith('tourist');
  });

  it('get_user_submissions calls with defaults (count=200, from=1)', async () => {
    await executeTool('get_user_submissions', { handle: 'tourist' });
    expect(cf.getUserSubmissions).toHaveBeenCalledWith('tourist', 200, 1);
  });

  it('get_contest_list passes gym=true when specified', async () => {
    await executeTool('get_contest_list', { gym: true });
    expect(cf.getContestList).toHaveBeenCalledWith(true);
  });

  it('get_contest_list defaults to gym=false', async () => {
    await executeTool('get_contest_list', {});
    expect(cf.getContestList).toHaveBeenCalledWith(false);
  });

  it('get_contest_standings passes all params', async () => {
    await executeTool('get_contest_standings', { contestId: 42, from: 5, count: 20, handles: ['a', 'b'] });
    expect(cf.getContestStandings).toHaveBeenCalledWith(42, 5, 20, ['a', 'b']);
  });

  it('get_contest_standings uses defaults for optional params', async () => {
    await executeTool('get_contest_standings', { contestId: 42 });
    expect(cf.getContestStandings).toHaveBeenCalledWith(42, 1, 10, []);
  });

  it('get_contest_status passes contestId, handle, count', async () => {
    await executeTool('get_contest_status', { contestId: 1, handle: 'tourist', count: 5 });
    expect(cf.getContestStatus).toHaveBeenCalledWith(1, 'tourist', 5);
  });

  it('get_contest_rating_changes passes contestId', async () => {
    await executeTool('get_contest_rating_changes', { contestId: 1 });
    expect(cf.getContestRatingChanges).toHaveBeenCalledWith(1);
  });

  it('get_problems passes tags and name', async () => {
    await executeTool('get_problems', { tags: ['dp', 'graphs'], problemsetName: 'Codeforces' });
    expect(cf.getProblems).toHaveBeenCalledWith(['dp', 'graphs'], 'Codeforces');
  });

  it('get_problems uses empty defaults', async () => {
    await executeTool('get_problems', {});
    expect(cf.getProblems).toHaveBeenCalledWith([], '');
  });

  it('get_recent_actions passes maxCount', async () => {
    await executeTool('get_recent_actions', { maxCount: 50 });
    expect(cf.getRecentActions).toHaveBeenCalledWith(50);
  });

  it('get_rated_list passes activeOnly', async () => {
    await executeTool('get_rated_list', { activeOnly: false });
    expect(cf.getRatedList).toHaveBeenCalledWith(false);
  });

  it('get_gym_simulations routes to getGymSimulations (returns handle + gyms)', async () => {
    // CF mocks return empty data → fast path, no standings calls
    cf.getUserSubmissions.mockResolvedValue([]);
    const result = await executeTool('get_gym_simulations', { handle: 'automac', limit: 5 });
    expect(result.handle).toBe('automac');
    expect(Array.isArray(result.gyms)).toBe(true);
  });

  it('get_gym_simulations uses default limit of 10 when not specified', async () => {
    cf.getUserSubmissions.mockResolvedValue([]);
    // Just ensure no throw with missing limit
    const result = await executeTool('get_gym_simulations', { handle: 'someone' });
    expect(result.handle).toBe('someone');
  });

  it('unknown tool throws with descriptive message', async () => {
    await expect(executeTool('get_unicorns', {})).rejects.toThrow('Unknown tool: get_unicorns');
  });

});

describe('executeTool — result trimming', () => {

  it('get_user_submissions trims to ≤ 200 items even if CF returns more', async () => {
    const bigList = Array.from({ length: 500 }, (_, i) => ({
      id: i, contestId: 100, creationTimeSeconds: 1700000000, verdict: 'OK',
      programmingLanguage: 'C++', problem: { contestId: 100, index: 'A', name: 'P', rating: 1500 },
      author: { participantType: 'CONTESTANT' },
    }));
    cf.getUserSubmissions.mockResolvedValue(bigList);
    const result = await executeTool('get_user_submissions', { handle: 'tourist' });
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('get_contest_list trims to ≤ 300 items', async () => {
    const bigList = Array.from({ length: 500 }, (_, i) => ({
      id: i, name: `Contest ${i}`, type: 'CF', phase: 'FINISHED',
      startTimeSeconds: 1700000000, durationSeconds: 7200,
    }));
    cf.getContestList.mockResolvedValue(bigList);
    const result = await executeTool('get_contest_list', {});
    expect(result.length).toBeLessThanOrEqual(300);
  });

  it('get_rated_list trims to ≤ 100 items', async () => {
    const bigList = Array.from({ length: 300 }, (_, i) => ({
      handle: `user${i}`, rating: 3000 - i, maxRating: 3100, rank: 'gm', country: 'RU',
    }));
    cf.getRatedList.mockResolvedValue(bigList);
    const result = await executeTool('get_rated_list', {});
    expect(result.length).toBeLessThanOrEqual(100);
  });

});
