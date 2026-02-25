# ICPC Coach Agent — Architecture

## Overview

A web app that lets you ask natural-language questions about Codeforces data ("show me the last 5 gyms automac simulated"). A Node.js + Express backend uses Claude as an AI agent: it translates your question into one or more Codeforces API calls, receives the results, and streams a formatted Markdown answer back to the browser in real time.

```
Browser (index.html)
  │  POST /api/chat  { messages, model }
  │  ← SSE stream of text deltas + tool events
  ▼
server.js  (Express)
  │  streamAgent(messages, res, model)
  ▼
src/agent.js  (Claude agentic loop)
  │  tool calls
  ▼
src/codeforces.js  (CF REST API client)
  │  fetch()
  ▼
https://codeforces.com/api/*
```

---

## Files

| File | Role |
|------|------|
| `server.js` | Express app: serves `public/`, exposes `POST /api/chat` |
| `src/agent.js` | Claude agent: tool definitions, agentic loop, gym logic |
| `src/codeforces.js` | Codeforces API client: auth, rate limiting, all methods |
| `public/index.html` | Single-file frontend: HTML + CSS + JS |

---

## `src/codeforces.js` — CF API Client

Thin wrapper around the Codeforces REST API.

**Rate limiting** — CF enforces ~2 req/s. A simple timestamp gate enforces 500 ms between requests:

```js
if (Date.now() - lastRequestTime < 500) await sleep(remaining);
lastRequestTime = Date.now();
```

**Authentication** — Most endpoints are public. `user.friends` requires auth. The CF signature scheme:

```
rand(6 digits) / methodName ? sorted_params # API_SECRET
```
The SHA-512 hash of that string becomes the `apiSig` query parameter.

**Exported methods** — Each maps to one CF API endpoint:

| Function | CF Endpoint |
|---|---|
| `getUserInfo(handles[])` | `user.info` |
| `getUserRating(handle)` | `user.rating` |
| `getUserSubmissions(handle, count, from)` | `user.status` |
| `getContestList(gym)` | `contest.list` |
| `getContestStandings(id, from, count, handles, showUnofficial)` | `contest.standings` |
| `getContestStatus(id, handle, count)` | `contest.status` |
| `getContestRatingChanges(id)` | `contest.ratingChanges` |
| `getProblems(tags[], name)` | `problemset.problems` |
| `getRecentActions(maxCount)` | `recentActions` |
| `getUserFriends(onlyOnline)` | `user.friends` (auth) |
| `getRatedList(activeOnly)` | `user.ratedList` |

---

## `src/agent.js` — The Claude Agent

This is the core of the app. It does three things: defines tools, runs the agentic loop, and implements server-side logic for complex queries.

### 1. Tool Definitions

Each tool is a JSON schema that Claude uses to decide when and how to call it. There are 11 tools — 10 thin wrappers around CF API methods, and one custom server-side tool (`get_gym_simulations`).

```js
const TOOLS = [
  { name: 'get_user_info',    input_schema: { handles: string[] } },
  { name: 'get_user_rating',  input_schema: { handle: string } },
  // ... 8 more CF wrappers ...
  { name: 'get_gym_simulations', input_schema: { handle, limit } }, // custom
];
```

Claude reads the `description` field to decide which tool to call. The system prompt adds extra guidance for specific query patterns (e.g., always use `get_gym_simulations` for gym questions).

### 2. The Streaming Agentic Loop

The loop drives the Claude ↔ tool-use ↔ Claude cycle until Claude produces a final answer.

```
while continueLoop:
  1. Stream a Claude request (model + tools + message history)
  2. Forward text_delta events to the browser immediately (SSE)
  3. Collect tool_use blocks as they stream in
  4. On stop_reason = "tool_use":
       - Execute each tool call (CF API)
       - Append tool results to message history
       - Loop again (Claude sees the results and continues)
  5. On stop_reason = "end_turn":
       - Send SSE "done" event
       - Exit loop
```

**Why stream text before tool results?** Claude sometimes emits text *before* calling a tool (e.g., "Let me look that up…"). Streaming that immediately makes the UI feel responsive rather than frozen.

**SSE event types sent to the browser:**

| Event | When |
|---|---|
| `{ type: "text", content: "..." }` | Every text delta from Claude |
| `{ type: "tool_call", name: "..." }` | A tool is about to be called |
| `{ type: "tool_result", name: "...", success: bool }` | Tool call finished |
| `{ type: "retrying", waitSeconds: N }` | Hit a 429, waiting before retry |
| `{ type: "done" }` | Stream complete |
| `{ type: "error", message: "..." }` | Unrecoverable error |

### 3. Rate Limit Handling (429 Retry)

The Anthropic free tier has a 30K input-tokens/minute limit. Heavy queries (gym simulations involve many API calls + standings data) can trigger this. The retry wrapper:

```js
async function* streamEventsWithRetry(params, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // stream events...
      return;
    } catch (err) {
      if (is429 && attempt < maxRetries) {
        const wait = Math.min(60, 15 * (attempt + 1)); // 15s, 30s, 45s
        writeSSE({ type: 'retrying', waitSeconds: wait });
        await sleep(wait * 1000);
      } else throw err;
    }
  }
}
```

### 4. Context Budget Management

Two mechanisms keep input tokens under control:

**History trimming** — Only the last 4 user/assistant turn pairs are sent to Claude on each request. Older turns are dropped.

**Result trimming** — Large CF API responses are truncated before being included as tool results:

| Function | What it does |
|---|---|
| `trimSubmissions(max=200)` | Strips heavy fields, caps at 200 submissions |
| `trimContestList(max=300)` | Keeps only id/name/type/phase/times, caps at 300 |
| `trimRatedList(max=100)` | Keeps only handle/rating/rank/country |
| `trimProblems(max=300)` | Merges problem + statistics, caps at 300 |

### 5. `getGymSimulations` — Custom Server-Side Tool

The most complex piece. This tool exists because the naive approach — asking Claude to call `get_contest_list(gym=true)` then cross-reference it — sends thousands of gym entries to Claude per request, which immediately exhausts the token budget and triggers 429s.

Instead, the server does all the heavy lifting and returns a small, clean result (~10 rows) to Claude.

**Algorithm:**

```
1. Scan up to 2000 of the user's submissions (20 pages × 100)
   → Keep only: contestId > 100000 (gym) AND participantType = VIRTUAL
   → Excludes upsolving/practice (those use PRACTICE participantType)

2. Deduplicate by (contestId, startTimeSeconds)
   → Each unique pair = one simulation session
   → Captures: contestId, start time, team name, members (sorted alphabetically)

3. Sort newest-first, take top N

4. Fetch gym list → resolve contest names for the top N contest IDs

5. For each simulation, fetch full standings (count=3000, showUnofficial=true):
   → Find the team's row: match on (startTimeSeconds AND member handle)
      - startTimeSeconds alone is ambiguous — multiple teams can start at the
        same second, and rows are sorted by rank, so you'd match the wrong team
      - Combined check: same start time + at least one member in common = unique
   → Extract: rank, problems solved (points > 0), total problems

6. Return compact result per gym:
   { name, link, difficulty (★★☆☆☆), durationHours,
     simulatedAt, teamName, members[], rank, solved }
```

**Why `participantType = VIRTUAL` specifically?**
CF uses different participant types for the same gym contest:
- `VIRTUAL` — team ran the full simulation
- `PRACTICE` — someone solved individual problems after the fact (upsolving)

Without this filter, recent upsolving activity shows up as a "new simulation", giving the wrong date and wrong problems solved.

---

## `server.js` — Express Server

Minimal. Two responsibilities:

1. Serve `public/` as static files (`GET /`)
2. Handle `POST /api/chat`:
   - Extract `{ messages, model }` from request body
   - Set SSE headers (`Content-Type: text/event-stream`)
   - Delegate to `streamAgent(messages, res, model)`

The `model` field lets the frontend switch between `claude-haiku-4-5-20251001` (default, fast) and `claude-sonnet-4-6` (more capable, slower).

---

## `public/index.html` — Frontend

Single self-contained file (HTML + inline CSS + inline JS). No build step.

**Libraries (CDN):**
- `marked.js v9` — Markdown → HTML rendering
- `highlight.js 11.9.0` — Syntax highlighting inside code blocks

**Custom marked.js renderers:**
- `code` — runs highlight.js on fenced code blocks
- `link` — adds `target="_blank" rel="noopener noreferrer"` to all links
- `tablecell` — wraps cells containing ★/☆ in a `.stars` span for larger rendering

**SSE streaming:**
Uses `fetch()` + `ReadableStream` reader (not `EventSource`) because `EventSource` only supports GET requests, and the chat endpoint is a POST.

```js
const reader = res.body.getReader();
// read chunks, split on \n\n, parse JSON, dispatch by event.type
```

**State:**
- `messages[]` — full conversation history sent to `/api/chat` on every turn
- `sessions[]` — sidebar history snapshots (label = first 60 chars of user question)
- `selectedModel` — currently active model ID, sent in POST body

**Markdown rendering during streaming:**
Text deltas are accumulated into a string and the entire accumulated markdown is re-rendered on each delta. This means the table or list appears complete and correct once Claude finishes writing it, rather than showing broken intermediate states.
