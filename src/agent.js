import Anthropic from '@anthropic-ai/sdk';
import * as cf from './codeforces.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert Codeforces assistant. You help competitive programmers query and analyze data from the Codeforces platform.

When answering questions, you MUST:
- Use the available tools to fetch real data before answering
- Format ALL responses as clean, readable **Markdown**
- Use tables when presenting lists of contests, submissions, users, or ratings
- Use code blocks (\`\`\`) for handles, verdicts, and technical terms when appropriate
- Use bullet lists or numbered lists when appropriate
- Include relevant statistics and context when available
- Be concise but thorough

For gym simulation questions ("last N gyms a user practiced/simulated"), ALWAYS use the \`get_gym_simulations\` tool — it handles the cross-referencing server-side efficiently.
When presenting gym simulation results, format the contest name as a markdown link using the provided \`link\` field: e.g. \`[Contest Name](link)\`. Include the \`difficulty\` field as a column (e.g. ★★★☆☆) when present. Do NOT show a raw contestId column.

Always present data in a helpful, organized way. If a user asks for "last N" items, sort by most recent first.`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_user_info',
    description: 'Get profile information for one or more Codeforces users (rating, rank, country, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        handles: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of Codeforces user handles (up to 10000)',
        },
      },
      required: ['handles'],
    },
  },
  {
    name: 'get_user_rating',
    description: 'Get the full rating history of a Codeforces user — all contests they participated in with rating changes',
    input_schema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Codeforces user handle' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'get_user_submissions',
    description: 'Get recent submissions (solutions) from a Codeforces user. Includes gym and practice submissions. Use this to find which gyms a user has participated in.',
    input_schema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Codeforces user handle' },
        count: { type: 'number', description: 'Number of submissions to fetch (default 50, max 1000)' },
        from: { type: 'number', description: '1-based index of the first submission to return (default 1)' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'get_contest_list',
    description: 'Get a list of available contests or gyms on Codeforces',
    input_schema: {
      type: 'object',
      properties: {
        gym: { type: 'boolean', description: 'If true, returns gym contests. If false (default), returns regular contests.' },
      },
    },
  },
  {
    name: 'get_contest_standings',
    description: 'Get the standings (leaderboard) for a specific contest',
    input_schema: {
      type: 'object',
      properties: {
        contestId: { type: 'number', description: 'The contest ID' },
        from: { type: 'number', description: 'Start rank (1-based, default 1)' },
        count: { type: 'number', description: 'Number of rows to return (default 10)' },
        handles: {
          type: 'array',
          items: { type: 'string' },
          description: 'If provided, show standings only for these handles',
        },
      },
      required: ['contestId'],
    },
  },
  {
    name: 'get_contest_status',
    description: 'Get submissions for a specific contest, optionally filtered by user handle',
    input_schema: {
      type: 'object',
      properties: {
        contestId: { type: 'number', description: 'The contest ID' },
        handle: { type: 'string', description: 'Filter by this user handle (optional)' },
        count: { type: 'number', description: 'Number of submissions to return (default 20)' },
      },
      required: ['contestId'],
    },
  },
  {
    name: 'get_contest_rating_changes',
    description: 'Get rating changes for all participants after a contest ended',
    input_schema: {
      type: 'object',
      properties: {
        contestId: { type: 'number', description: 'The contest ID' },
      },
      required: ['contestId'],
    },
  },
  {
    name: 'get_problems',
    description: 'Get problems from the Codeforces problemset, optionally filtered by tags',
    input_schema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by problem tags (e.g., ["dp", "graphs", "greedy"])',
        },
        problemsetName: { type: 'string', description: 'Specific problemset name (optional)' },
      },
    },
  },
  {
    name: 'get_recent_actions',
    description: 'Get recent actions on the Codeforces platform (blog posts, comments, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        maxCount: { type: 'number', description: 'Maximum number of recent actions to return (max 100, default 20)' },
      },
    },
  },
  {
    name: 'get_rated_list',
    description: 'Get the list of rated Codeforces users sorted by rating',
    input_schema: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'If true (default), only return users active in the last 6 months' },
      },
    },
  },
  {
    name: 'get_gym_simulations',
    description: 'Get gym contests that a user has done as a full virtual simulation (participantType=VIRTUAL). Excludes upsolving/practice. Each result is a unique simulation session with start time, team info, and contest name.',
    input_schema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Codeforces user handle' },
        limit: { type: 'number', description: 'Number of gym simulations to return (default 10)' },
      },
      required: ['handle'],
    },
  },
];

// ── Result trimming — keeps responses within Claude's context budget ──────────

function trimSubmissions(subs, max = 200) {
  return subs.slice(0, max).map(s => ({
    id: s.id,
    contestId: s.contestId,
    creationTimeSeconds: s.creationTimeSeconds,
    verdict: s.verdict,
    programmingLanguage: s.programmingLanguage,
    problem: { contestId: s.problem?.contestId, index: s.problem?.index, name: s.problem?.name, rating: s.problem?.rating },
    author: { participantType: s.author?.participantType },
  }));
}

function trimContestList(contests, max = 300) {
  return contests.slice(0, max).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    phase: c.phase,
    startTimeSeconds: c.startTimeSeconds,
    durationSeconds: c.durationSeconds,
  }));
}

// Server-side gym simulation lookup.
// A "simulation" is a VIRTUAL participation in a gym contest (contestId > 100000).
// Regular CF rounds done virtually are excluded — those are a different concept.
// Each unique (contestId, startTimeSeconds) pair = one simulation session.
async function getGymSimulations(handle, limit = 10) {
  const sessions = new Map();
  let from = 1;
  const pageSize = 100;
  const maxPages = 20; // scan up to 2000 submissions

  for (let page = 0; page < maxPages; page++) {
    const subs = await cf.getUserSubmissions(handle, pageSize, from);
    if (!subs.length) break;

    for (const s of subs) {
      const isGym = s.contestId > 100000;
      const isVirtual = s.author?.participantType === 'VIRTUAL';
      if (!isGym || !isVirtual) continue;

      const startTime = s.author?.startTimeSeconds ?? s.creationTimeSeconds;
      const key = `${s.contestId}_${startTime}`;
      if (!sessions.has(key)) {
        sessions.set(key, {
          contestId: s.contestId,
          startTimeSeconds: startTime,
          teamName: s.author?.teamName ?? null,
          // sort alphabetically up-front
          members: (s.author?.members ?? []).map(m => m.handle).sort(),
        });
      }
    }

    from += pageSize;
    if (subs.length < pageSize) break;
    if (sessions.size >= limit * 3) break;
  }

  if (!sessions.size) return { handle, gyms: [] };

  // Sort newest-first, take top N
  const sorted = [...sessions.values()].sort((a, b) => b.startTimeSeconds - a.startTimeSeconds);
  const top = sorted.slice(0, limit);
  const topIds = new Set(top.map(s => s.contestId));

  // Resolve contest names from gym list
  const gymList = await cf.getContestList(true);
  const gymMap = {};
  for (const g of gymList) if (topIds.has(g.id)) gymMap[g.id] = g;

  // Fetch standings per simulation to get rank, total participants, and problems solved.
  // We fetch unfiltered (no handles) so we also get the total from the last row's rank.
  const CAP = 3000;
  const standingsCache = new Map();
  for (const sim of top) {
    try {
      const data = await cf.getContestStandings(
        sim.contestId, 1, CAP, [], /* showUnofficial= */ true,
      );
      const rows = data.rows ?? [];
      // Locate the team's row by matching the virtual session start time, then by members
      const byMember = (r) => r.party?.members?.some(m => sim.members.includes(m.handle));
      const teamRow =
        rows.find(r => r.party?.startTimeSeconds === sim.startTimeSeconds && byMember(r)) ??
        rows.find(byMember);
      if (teamRow) {
        const solved = (teamRow.problemResults ?? []).filter(p => (p.points ?? 0) > 0).length;
        const lastRank = rows.at(-1)?.rank ?? rows.length;
        // If we got fewer rows than the cap, lastRank is the true total; otherwise cap+
        const total = rows.length < CAP ? lastRank : null;
        standingsCache.set(`${sim.contestId}_${sim.startTimeSeconds}`, {
          rank: teamRow.rank,
          total,          // null means >${CAP}
          solved,
          totalProblems: (data.problems ?? []).length,
        });
      }
    } catch {
      // standings unavailable for this gym — skip silently
    }
  }

  return {
    handle,
    gyms: top.map(sim => {
      const st = standingsCache.get(`${sim.contestId}_${sim.startTimeSeconds}`);
      const rankStr = st ? `${st.rank}` : null;
      const gym = gymMap[sim.contestId];
      const diff = gym?.difficulty;
      return {
        name: gym?.name ?? `Gym #${sim.contestId}`,
        link: `https://codeforces.com/gym/${sim.contestId}/standings`,
        difficulty: diff ? '★'.repeat(diff) + '☆'.repeat(5 - diff) : null,
        durationHours: gym?.durationSeconds ? Math.round(gym.durationSeconds / 3600) : null,
        simulatedAt: new Date(sim.startTimeSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
        teamName: sim.teamName,
        members: sim.members.length ? sim.members : [handle],
        rank: rankStr,
        solved: st != null ? `${st.solved}/${st.totalProblems}` : null,
      };
    }),
  };
}

function trimRatedList(users, max = 100) {
  return users.slice(0, max).map(u => ({
    handle: u.handle,
    rating: u.rating,
    maxRating: u.maxRating,
    rank: u.rank,
    country: u.country,
  }));
}

function trimProblems(data) {
  const { problems = [], problemStatistics = [] } = data;
  const statMap = {};
  problemStatistics.forEach(s => { statMap[`${s.contestId}-${s.index}`] = s.solvedCount; });
  return problems.slice(0, 300).map(p => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags,
    solvedCount: statMap[`${p.contestId}-${p.index}`],
  }));
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name, input) {
  switch (name) {
    case 'get_user_info':
      return cf.getUserInfo(input.handles);
    case 'get_user_rating':
      return cf.getUserRating(input.handle);
    case 'get_user_submissions':
      return trimSubmissions(await cf.getUserSubmissions(input.handle, input.count ?? 200, input.from ?? 1), 200);
    case 'get_contest_list':
      return trimContestList(await cf.getContestList(input.gym ?? false));
    case 'get_contest_standings':
      return cf.getContestStandings(input.contestId, input.from ?? 1, input.count ?? 10, input.handles ?? []);
    case 'get_contest_status':
      return cf.getContestStatus(input.contestId, input.handle ?? '', input.count ?? 20);
    case 'get_contest_rating_changes':
      return cf.getContestRatingChanges(input.contestId);
    case 'get_problems':
      return trimProblems(await cf.getProblems(input.tags ?? [], input.problemsetName ?? ''));
    case 'get_recent_actions':
      return cf.getRecentActions(input.maxCount ?? 20);
    case 'get_rated_list':
      return trimRatedList(await cf.getRatedList(input.activeOnly ?? true));
    case 'get_gym_simulations':
      return getGymSimulations(input.handle, input.limit ?? 10);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── History trimming — keep last N user/assistant turns to limit input tokens ──
const MAX_HISTORY_TURNS = 4; // 4 turns = 8 messages (4 user + 4 assistant)

function trimHistory(msgs) {
  // Always keep all messages, but if too many, drop oldest pairs (keep latest N turns)
  const pairs = [];
  for (let i = 0; i < msgs.length - 1; i += 2) {
    if (msgs[i].role === 'user' && msgs[i + 1]?.role === 'assistant') {
      pairs.push([msgs[i], msgs[i + 1]]);
    }
  }
  // Always include the last message (current user turn)
  const lastMsg = msgs[msgs.length - 1];
  const recentPairs = pairs.slice(-MAX_HISTORY_TURNS);
  const trimmed = recentPairs.flat();
  // If the last message isn't already included, append it
  if (!trimmed.length || trimmed[trimmed.length - 1] !== lastMsg) {
    trimmed.push(lastMsg);
  }
  return trimmed;
}

// ── Streaming agentic loop ────────────────────────────────────────────────────

/**
 * Run the agent with streaming. Writes SSE events to `res`.
 * SSE event formats:
 *   data: {"type":"text","content":"..."}
 *   data: {"type":"tool_call","name":"...","input":{...}}
 *   data: {"type":"tool_result","name":"...","success":true}
 *   data: {"type":"retrying","waitSeconds":N}
 *   data: {"type":"done"}
 *   data: {"type":"error","message":"..."}
 */
export async function streamAgent(messages, res, model = 'claude-haiku-4-5-20251001') {
  const writeSSE = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // Trim history to cap input tokens, then convert to Anthropic format
  const anthropicMessages = trimHistory(messages).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Stream iteration with retry on 429
  async function* streamEventsWithRetry(params, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = client.messages.stream(params);
        for await (const event of stream) {
          yield { event, stream };
        }
        return; // success — exit loop
      } catch (err) {
        const is429 = err?.status === 429 || err?.message?.includes('rate_limit');
        if (is429 && attempt < maxRetries) {
          const waitSeconds = Math.min(60, 15 * (attempt + 1));
          writeSSE({ type: 'retrying', waitSeconds });
          await new Promise(r => setTimeout(r, waitSeconds * 1000));
        } else {
          throw err;
        }
      }
    }
  }

  try {
    let continueLoop = true;

    while (continueLoop) {
      const toolUseBlocks = [];
      let currentToolUse = null;
      let inputJsonBuffer = '';
      let stopReason = null;
      let lastStream = null;

      const params = {
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: anthropicMessages,
      };

      for await (const { event, stream } of streamEventsWithRetry(params)) {
        lastStream = stream;
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: {} };
            inputJsonBuffer = '';
            writeSSE({ type: 'tool_call', name: event.content_block.name });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            writeSSE({ type: 'text', content: event.delta.text });
          } else if (event.delta.type === 'input_json_delta') {
            inputJsonBuffer += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try { currentToolUse.input = inputJsonBuffer ? JSON.parse(inputJsonBuffer) : {}; } catch { currentToolUse.input = {}; }
            toolUseBlocks.push({ ...currentToolUse });
            currentToolUse = null;
            inputJsonBuffer = '';
          }
        } else if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason;
        }
      }

      const finalMessage = await lastStream.finalMessage();
      anthropicMessages.push({ role: 'assistant', content: finalMessage.content });

      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        const toolResults = [];
        for (const tool of toolUseBlocks) {
          try {
            const result = await executeTool(tool.name, tool.input);
            writeSSE({ type: 'tool_result', name: tool.name, success: true });
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) });
          } catch (err) {
            writeSSE({ type: 'tool_result', name: tool.name, success: false, error: err.message });
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: `Error: ${err.message}`, is_error: true });
          }
        }
        anthropicMessages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    writeSSE({ type: 'done' });
  } catch (err) {
    console.error('Agent error:', err);
    writeSSE({ type: 'error', message: err.message });
    writeSSE({ type: 'done' });
  }
}
