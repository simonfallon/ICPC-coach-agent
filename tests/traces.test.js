// Tool selection trace tests — calls the real Anthropic API.
// Mocks Codeforces so tools return instantly; asserts which tool Claude picks.
// Skipped entirely when ANTHROPIC_API_KEY is not set.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import 'dotenv/config';

const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

vi.mock('../src/codeforces.js');

import * as cf from '../src/codeforces.js';
import { streamAgent } from '../src/agent.js';

// Minimal CF stubs — tools return fast empty data so Claude gets a result and finishes
beforeEach(() => {
  vi.resetAllMocks();
  cf.getUserInfo.mockResolvedValue([{ handle: 'tourist', rating: 3979, rank: 'legendary grandmaster' }]);
  cf.getUserRating.mockResolvedValue([{ contestId: 1, newRating: 3000, oldRating: 2900, rank: 5 }]);
  cf.getUserSubmissions.mockResolvedValue([]);
  cf.getContestList.mockResolvedValue([]);
  cf.getContestStandings.mockResolvedValue({ rows: [], problems: [] });
  cf.getProblems.mockResolvedValue({ problems: [], problemStatistics: [] });
  cf.getRecentActions.mockResolvedValue([]);
  cf.getRatedList.mockResolvedValue([]);
});

// Helper: run streamAgent and collect all SSE events
async function runQuery(query) {
  const events = [];
  const res = {
    write: (chunk) => {
      try {
        const json = JSON.parse(chunk.replace(/^data: /, ''));
        events.push(json);
      } catch { /* ignore malformed chunks */ }
    },
  };
  await streamAgent([{ role: 'user', content: query }], res);
  return events;
}

// Extract tool_call event names from the event stream
function toolsUsed(events) {
  return events.filter(e => e.type === 'tool_call').map(e => e.name);
}

describe('Tool selection traces', { timeout: 30000 }, () => {

  beforeAll(() => {
    if (!HAS_API_KEY) {
      console.warn('⚠ Skipping trace tests: ANTHROPIC_API_KEY not set');
    }
  });

  it('gym simulation query uses get_gym_simulations', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery('Show me the last 5 gyms that automac has simulated');
    expect(toolsUsed(events)).toContain('get_gym_simulations');
  });

  it('gym history phrasing also uses get_gym_simulations (not get_user_submissions)', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery("What's automac's gym simulation history?");
    const tools = toolsUsed(events);
    expect(tools).toContain('get_gym_simulations');
    expect(tools).not.toContain('get_user_submissions');
  });

  it('user rating query uses get_user_info or get_user_rating', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery("What is tourist's current rating?");
    const tools = toolsUsed(events);
    expect(tools.some(t => t === 'get_user_info' || t === 'get_user_rating')).toBe(true);
  });

  it('problem search query uses get_problems', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery('Find DP problems rated between 1800 and 2200');
    expect(toolsUsed(events)).toContain('get_problems');
  });

  it('standings query uses get_contest_standings', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery('Who are the top 10 in contest 2035?');
    expect(toolsUsed(events)).toContain('get_contest_standings');
  });

  it('stream ends with a done event', async () => {
    if (!HAS_API_KEY) return;
    const events = await runQuery("What is tourist's current rating?");
    expect(events.at(-1)?.type).toBe('done');
  });

});
