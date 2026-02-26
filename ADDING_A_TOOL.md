# Adding a New Tool

> **API reference:** See [CodeforcesAPIMethods.md](CodeforcesAPIMethods.md) for all available endpoints and their parameters, and [CodeforcesAPIReturnObjects.md](CodeforcesAPIReturnObjects.md) for field definitions of every return type (`Contest`, `Submission`, `Party`, `RanklistRow`, etc.).

Two categories of tools exist:

- **Thin wrapper** — Claude calls it, gets raw CF API data back (e.g., `get_user_info`).
- **Server-side logic** — A custom function does multi-step CF work and returns a compact result (e.g., `get_gym_simulations`, `get_gym_recommendations`). Use this when raw CF responses are too large to pass to Claude, or when cross-referencing multiple endpoints is needed.

---

## Checklist

### 1. `src/types.ts` — types

Add result interfaces and extend the `ToolName` union.

```ts
// Result type(s)
export interface MyToolResult {
  field: string;
  count: number;
}

// Add to ToolName union
export type ToolName =
  | ...
  | 'get_my_tool';   // ← add here
```

### 2. `src/agent.ts` — tool definition

Add to the `TOOLS` array. Order doesn't matter; descriptions are the primary signal Claude uses to pick a tool, so make them precise.

```ts
{
  name: 'get_my_tool',
  description: 'One clear sentence on what it returns and when to use it. Mention key defaults.',
  input_schema: {
    type: 'object',
    properties: {
      handle:  { type: 'string', description: 'Codeforces user handle' },
      limit:   { type: 'number', description: 'Max results to return (default 10)' },
      days:    { type: 'number', description: 'Lookback window in days (default 180 = 6 months). Use 7 for 1 week, 30 for 1 month, 365 for 1 year.' },
    },
    required: ['handle'],
  },
},
```

**Description writing rules:**
- State what the tool returns, not what it does internally.
- Name key constraints (e.g., "only considers the last 6 months", "pass one handle per team").
- Mention defaults so Claude doesn't always pass them explicitly.

### 3. `src/agent.ts` — server-side function (if needed)

For server-side tools, export the function and place it after `getGymSimulations`. Import its return type at the top of the file.

```ts
// Top of file
import type { ..., MyToolResult } from './types.js';

// Function
export async function getMyTool(handle: string, limit = 10): Promise<MyToolResult> {
  // Pagination pattern — use 500 per page, stop early on date cutoff or empty page
  const PAGE_SIZE = 1000;
  let from = 1;
  while (true) {
    const subs = await cf.getUserSubmissions(handle, PAGE_SIZE, from);
    if (!subs.length) break;
    // ... process subs ...
    if (subs.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Resolve names from gym list if needed (one shared call at the end)
  const gymList = await cf.getContestList(true);
  const gymMap = Object.fromEntries(gymList.map(g => [g.id, g]));

  return { /* compact result */ };
}
```

**Pagination rules:**
- Always use `PAGE_SIZE = 1000` for `getUserSubmissions`.
- Break early on a timestamp cutoff (`creationTimeSeconds < cutoff`).
- Break when `subs.length < PAGE_SIZE` (last page).
- Gym IDs: `contestId > 100000`. Regular CF rounds: `contestId ≤ 100000`.
- VIRTUAL = full simulation. PRACTICE = upsolving. Always filter by the right type.

**Token budget rules:**
- Return only the fields Claude needs — never raw CF objects.
- Add a trim function (`trimXxx`) if the result can be large and is passed directly to Claude (thin wrapper tools).

### 4. `src/agent.ts` — `executeTool` switch

Add a case to `executeTool`. Cast inputs explicitly; all inputs arrive as `unknown`.

```ts
case 'get_my_tool':
  return getMyTool(
    input.handle as string,
    (input.limit as number | undefined) ?? 10,
  );
```

### 5. `src/agent.ts` — system prompt

Add a line at the end of `SYSTEM_PROMPT` telling Claude when and how to use the tool, and how to format the output.

```
For <query type> questions, use \`get_my_tool\`. Present results as a table with columns: Name (as markdown link), Field A, Field B.
```

---

## Tests

### `tests/myTool.test.ts` — unit tests for server-side logic

Follow the pattern in `tests/gymRecommendations.test.ts` or `tests/gymSimulations.test.ts`.

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('../src/codeforces.js');
import * as cf from '../src/codeforces.js';
import { getMyTool } from '../src/agent.js';

const mock = vi.mocked(cf);

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUserSubmissions.mockResolvedValue([] as any);
  mock.getContestList.mockResolvedValue([] as any);
});

describe('getMyTool', () => {
  describe('basic shape', () => { /* ... */ });
  describe('filtering', () => { /* ... */ });
  describe('ordering and limit', () => { /* ... */ });
  describe('empty / edge cases', () => { /* ... */ });
});
```

**Required test cases:**
- Returns correct shape (`Array.isArray`, field presence)
- Correct values for the happy path (use inline fixtures)
- Excludes what it should (PRACTICE, old submissions, wrong contestId range)
- Respects `limit` parameter
- Falls back gracefully when CF data is missing (empty lists, missing names)
- Empty input → empty result, no crash

**Fixture pattern** — use inline constants or add to `tests/fixtures/cf-responses.js` if reusable:

```ts
const RECENT = Math.floor(Date.now() / 1000);
const OLD    = Math.floor(new Date('2024-01-01').getTime() / 1000);

function makeSub(contestId: number, participantType: string, time = RECENT) {
  return {
    contestId,
    creationTimeSeconds: time,
    author: { participantType, startTimeSeconds: time, members: [] },
  };
}
```

### `tests/executeTool.test.ts` — dispatch tests

Add two tests to the existing `executeTool — dispatch` describe block:

```ts
it('get_my_tool routes to getMyTool (returns expected shape)', async () => {
  mock.getUserSubmissions.mockResolvedValue([]);
  mock.getContestList.mockResolvedValue([]);
  const result = await executeTool('get_my_tool', { handle: 'automac' }) as any;
  expect(Array.isArray(result.items)).toBe(true); // adjust to your shape
});

it('get_my_tool uses default limit when not specified', async () => {
  mock.getUserSubmissions.mockResolvedValue([]);
  mock.getContestList.mockResolvedValue([]);
  const result = await executeTool('get_my_tool', { handle: 'automac' }) as any;
  expect(result.items.length).toBeLessThanOrEqual(10);
});
```

### `tests/traces.test.ts` — tool selection (real Anthropic API)

Add one test to verify Claude picks the right tool for a natural-language query. Use a query phrasing that matches real user language.

```ts
it('my tool query uses get_my_tool', async () => {
  if (!HAS_API_KEY) return;
  const events = await runQuery('Natural language query that should trigger get_my_tool');
  expect(toolsUsed(events)).toContain('get_my_tool');
});
```

This test uses the real Anthropic API (Haiku, default model) and is skipped when `ANTHROPIC_API_KEY` is not set. It is the most important test for validating that the tool description and system prompt are effective.

---

## What to skip

- **No integration test for `getContestList(gym=true)`** — fetching the full gym list is too slow. Gym API access is already covered by the `getContestStandings(105789)` test.
- **No integration tests for new server-side functions** — unit tests with mocks are sufficient; end-to-end is covered by the traces test.
- **No result trimming for server-side tools** — they already return compact data. Only thin-wrapper tools that pass raw CF arrays to Claude need `trimXxx` functions.

---

## API call budget

Keep this in mind when designing a new tool:

| Operation | Cost |
|---|---|
| `getUserSubmissions(handle, 1000, from)` | 1 call, covers 1000 subs. Most active users fit in 1 call. |
| `getContestList(true)` | 1 call, slow (~10–15 s). Share it across all IDs at the end. |
| `getContestStandings(id, 1, 3000, [], true)` | 1 call per gym simulation. Expensive — avoid if not needed. |
| Rate limiter | 500 ms enforced between all CF calls via `codeforces.ts`. |

**Rule:** for tools that scan multiple handles, scan all in parallel (`Promise.all`) — the rate limiter in `codeforces.ts` serialises them anyway, but at least you avoid sequential `await` chains in your function.

---

## Verification

```bash
npm test          # all unit tests must pass
npm run dev       # start server
# then send a natural-language query in the browser and verify:
# 1. The correct tool_call event appears in the UI
# 2. The formatted table is correct
# 3. No 429 retries for a typical query
```
