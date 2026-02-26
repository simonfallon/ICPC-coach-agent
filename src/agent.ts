import Anthropic from '@anthropic-ai/sdk';
import * as cf from './codeforces.js';
import type {
  CFSubmission, CFContest, CFUser, CFProblemsResponse,
  SSEEvent, SSEWriter, ConversationMessage, GymSimulationsResult,
} from './types.js';

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

const TOOLS: Anthropic.Tool[] = [
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

function trimSubmissions(subs: CFSubmission[], max = 200) {
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

function trimContestList(contests: CFContest[], max = 300) {
  return contests.slice(0, max).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    phase: c.phase,
    startTimeSeconds: c.startTimeSeconds,
    durationSeconds: c.durationSeconds,
  }));
}

interface SimSession {
  contestId: number;
  startTimeSeconds: number;
  teamName: string | null;
  members: string[];
}

interface StandingsEntry {
  rank: number;
  total: number | null;
  solved: number;
  totalProblems: number;
}

// Server-side gym simulation lookup.
// A "simulation" is a VIRTUAL participation in a gym contest (contestId > 100000).
// Regular CF rounds done virtually are excluded — those are a different concept.
// Each unique (contestId, startTimeSeconds) pair = one simulation session.
export async function getGymSimulations(handle: string, limit = 10): Promise<GymSimulationsResult> {
  const sessions = new Map<string, SimSession>();
  let from = 1;
  const pageSize = 100;
  const maxPages = 20; // scan up to 2000 submissions

  for (let page = 0; page < maxPages; page++) {
    const subs = await cf.getUserSubmissions(handle, pageSize, from);
    if (!subs.length) break;

    for (const s of subs) {
      const isGym = (s.contestId ?? 0) > 100000;
      const isVirtual = s.author?.participantType === 'VIRTUAL';
      if (!isGym || !isVirtual) continue;

      const startTime = s.author?.startTimeSeconds ?? s.creationTimeSeconds;
      const key = `${s.contestId}_${startTime}`;
      if (!sessions.has(key)) {
        sessions.set(key, {
          contestId: s.contestId!,
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
  const gymMap: Record<number, CFContest> = {};
  for (const g of gymList) if (topIds.has(g.id)) gymMap[g.id] = g;

  // Fetch standings per simulation to get rank, total participants, and problems solved.
  // We fetch unfiltered (no handles) so we also get the total from the last row's rank.
  const CAP = 3000;
  const standingsCache = new Map<string, StandingsEntry>();
  for (const sim of top) {
    try {
      const data = await cf.getContestStandings(sim.contestId, 1, CAP, [], true);
      const rows = data.rows ?? [];
      // Locate the team's row by matching the virtual session start time AND a member handle.
      // startTimeSeconds alone is ambiguous — multiple teams can start at the same second,
      // and rows are sorted by rank, so without the member check we'd match the wrong team.
      const byMember = (r: typeof rows[0]) => r.party?.members?.some(m => sim.members.includes(m.handle));
      const teamRow =
        rows.find(r => r.party?.startTimeSeconds === sim.startTimeSeconds && byMember(r)) ??
        rows.find(byMember);
      if (teamRow) {
        const solved = (teamRow.problemResults ?? []).filter(p => (p.points ?? 0) > 0).length;
        const lastRank = rows.at(-1)?.rank ?? rows.length;
        const total = rows.length < CAP ? lastRank : null;
        standingsCache.set(`${sim.contestId}_${sim.startTimeSeconds}`, {
          rank: teamRow.rank,
          total,
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

function trimRatedList(users: CFUser[], max = 100) {
  return users.slice(0, max).map(u => ({
    handle: u.handle,
    rating: u.rating,
    maxRating: u.maxRating,
    rank: u.rank,
    country: u.country,
  }));
}

function trimProblems(data: CFProblemsResponse) {
  const { problems = [], problemStatistics = [] } = data;
  const statMap: Record<string, number> = {};
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

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_user_info':
      return cf.getUserInfo(input.handles as string[]);
    case 'get_user_rating':
      return cf.getUserRating(input.handle as string);
    case 'get_user_submissions':
      return trimSubmissions(
        await cf.getUserSubmissions(input.handle as string, (input.count as number) ?? 200, (input.from as number) ?? 1),
        200,
      );
    case 'get_contest_list':
      return trimContestList(await cf.getContestList((input.gym as boolean) ?? false));
    case 'get_contest_standings':
      return cf.getContestStandings(
        input.contestId as number,
        (input.from as number) ?? 1,
        (input.count as number) ?? 10,
        (input.handles as string[]) ?? [],
      );
    case 'get_contest_status':
      return cf.getContestStatus(input.contestId as number, (input.handle as string) ?? '', (input.count as number) ?? 20);
    case 'get_contest_rating_changes':
      return cf.getContestRatingChanges(input.contestId as number);
    case 'get_problems':
      return trimProblems(await cf.getProblems((input.tags as string[]) ?? [], (input.problemsetName as string) ?? ''));
    case 'get_recent_actions':
      return cf.getRecentActions((input.maxCount as number) ?? 20);
    case 'get_rated_list':
      return trimRatedList(await cf.getRatedList((input.activeOnly as boolean) ?? true));
    case 'get_gym_simulations':
      return getGymSimulations(input.handle as string, (input.limit as number) ?? 10);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── History trimming — keep last N user/assistant turns to limit input tokens ──
const MAX_HISTORY_TURNS = 4;

function trimHistory(msgs: ConversationMessage[]): ConversationMessage[] {
  const pairs: [ConversationMessage, ConversationMessage][] = [];
  for (let i = 0; i < msgs.length - 1; i += 2) {
    if (msgs[i].role === 'user' && msgs[i + 1]?.role === 'assistant') {
      pairs.push([msgs[i], msgs[i + 1]]);
    }
  }
  const lastMsg = msgs[msgs.length - 1];
  const recentPairs = pairs.slice(-MAX_HISTORY_TURNS);
  const trimmed = recentPairs.flat();
  if (!trimmed.length || trimmed[trimmed.length - 1] !== lastMsg) {
    trimmed.push(lastMsg);
  }
  return trimmed;
}

// ── Streaming agentic loop ────────────────────────────────────────────────────

export async function streamAgent(
  messages: ConversationMessage[],
  res: SSEWriter,
  model = 'claude-haiku-4-5-20251001',
): Promise<void> {
  const writeSSE = (event: SSEEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const anthropicMessages: Anthropic.MessageParam[] = trimHistory(messages).map(m => ({
    role: m.role,
    content: m.content,
  }));

  type StreamYield = { event: Anthropic.RawMessageStreamEvent; stream: ReturnType<typeof client.messages.stream> };

  async function* streamEventsWithRetry(
    params: Anthropic.MessageStreamParams,
    maxRetries = 3,
  ): AsyncGenerator<StreamYield> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = client.messages.stream(params);
        for await (const event of stream) {
          yield { event, stream };
        }
        return;
      } catch (err) {
        const e = err as { status?: number; message?: string };
        const is429 = e?.status === 429 || e?.message?.includes('rate_limit');
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
      const toolUseBlocks: { id: string; name: string; input: Record<string, unknown> }[] = [];
      let currentToolUse: { id: string; name: string; input: Record<string, unknown> } | null = null;
      let inputJsonBuffer = '';
      let stopReason: string | null = null;
      let lastStream: ReturnType<typeof client.messages.stream> | null = null;

      const params: Anthropic.MessageStreamParams = {
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
          stopReason = event.delta.stop_reason ?? null;
        }
      }

      const finalMessage = await lastStream!.finalMessage();
      anthropicMessages.push({ role: 'assistant', content: finalMessage.content });

      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const tool of toolUseBlocks) {
          try {
            const result = await executeTool(tool.name, tool.input);
            writeSSE({ type: 'tool_result', name: tool.name, success: true });
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) });
          } catch (err) {
            const e = err as Error;
            writeSSE({ type: 'tool_result', name: tool.name, success: false, error: e.message });
            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: `Error: ${e.message}`, is_error: true });
          }
        }
        anthropicMessages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    writeSSE({ type: 'done' });
  } catch (err) {
    const e = err as Error;
    console.error('Agent error:', e);
    writeSSE({ type: 'error', message: e.message });
    writeSSE({ type: 'done' });
  }
}
