import crypto from 'crypto';
import type {
  CFUser, CFContest, CFSubmission, CFStandingsResponse,
  CFRatingChange, CFProblemsResponse, CFAction,
} from './types.js';

const CF_API_BASE = 'https://codeforces.com/api';
const API_KEY = process.env.CODEFORCES_API_KEY ?? '';
const API_SECRET = process.env.CODEFORCES_API_SECRET ?? '';

// Rate limiting: 1 request per 500ms
let lastRequestTime = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 500) {
    await new Promise(r => setTimeout(r, 500 - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Build an authenticated API URL with apiSig for methods that require auth.
 */
function buildAuthParams(method: string, params: Record<string, string> = {}): Record<string, string> {
  const rand = Math.floor(100000 + Math.random() * 900000).toString();
  const time = Math.floor(Date.now() / 1000).toString();
  const allParams: Record<string, string> = { ...params, apiKey: API_KEY, time };

  // Sort params lexicographically by key then by value
  const sortedKeys = Object.keys(allParams).sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    const va = allParams[a], vb = allParams[b];
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });

  const paramStr = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');
  const hashInput = `${rand}/${method}?${paramStr}#${API_SECRET}`;
  const apiSig = rand + crypto.createHash('sha512').update(hashInput).digest('hex');

  return { ...allParams, apiSig };
}

/**
 * Call a CF API method. useAuth=true for endpoints requiring authentication.
 */
async function cfCall<T>(method: string, params: Record<string, string> = {}, useAuth = false): Promise<T> {
  await rateLimit();

  const finalParams = useAuth ? buildAuthParams(method, params) : params;
  const qs = new URLSearchParams(finalParams).toString();
  const url = `${CF_API_BASE}/${method}?${qs}`;

  const res = await fetch(url);
  const data = await res.json() as { status: string; comment?: string; result: T };

  if (data.status !== 'OK') {
    throw new Error(`Codeforces API error: ${data.comment ?? 'Unknown error'}`);
  }
  return data.result;
}

// ── Public API methods ────────────────────────────────────────────────────────

export async function getUserInfo(handles: string | string[]): Promise<CFUser[]> {
  const handlesStr = Array.isArray(handles) ? handles.join(';') : handles;
  return cfCall<CFUser[]>('user.info', { handles: handlesStr });
}

export async function getUserRating(handle: string): Promise<CFRatingChange[]> {
  return cfCall<CFRatingChange[]>('user.rating', { handle });
}

export async function getUserSubmissions(handle: string, count = 20, from = 1): Promise<CFSubmission[]> {
  return cfCall<CFSubmission[]>('user.status', { handle, count: String(count), from: String(from) });
}

export async function getContestList(gym = false): Promise<CFContest[]> {
  return cfCall<CFContest[]>('contest.list', { gym: String(gym) });
}

export async function getContestStandings(
  contestId: number,
  from = 1,
  count = 10,
  handles: string[] = [],
  showUnofficial = false,
): Promise<CFStandingsResponse> {
  const params: Record<string, string> = {
    contestId: String(contestId),
    from: String(from),
    count: String(count),
    showUnofficial: String(showUnofficial),
  };
  if (handles.length > 0) params.handles = handles.join(';');
  return cfCall<CFStandingsResponse>('contest.standings', params);
}

export async function getContestStatus(contestId: number, handle = '', count = 20): Promise<CFSubmission[]> {
  const params: Record<string, string> = { contestId: String(contestId), count: String(count) };
  if (handle) params.handle = handle;
  return cfCall<CFSubmission[]>('contest.status', params);
}

export async function getContestRatingChanges(contestId: number): Promise<CFRatingChange[]> {
  return cfCall<CFRatingChange[]>('contest.ratingChanges', { contestId: String(contestId) });
}

export async function getProblems(tags: string[] = [], problemsetName = ''): Promise<CFProblemsResponse> {
  const params: Record<string, string> = {};
  if (tags.length > 0) params.tags = tags.join(';');
  if (problemsetName) params.problemsetName = problemsetName;
  return cfCall<CFProblemsResponse>('problemset.problems', params);
}

export async function getRecentActions(maxCount = 20): Promise<CFAction[]> {
  return cfCall<CFAction[]>('recentActions', { maxCount: String(Math.min(maxCount, 100)) });
}

export async function getUserFriends(onlyOnline = false): Promise<string[]> {
  return cfCall<string[]>('user.friends', { onlyOnline: String(onlyOnline) }, true);
}

export async function getRatedList(activeOnly = true): Promise<CFUser[]> {
  return cfCall<CFUser[]>('user.ratedList', { activeOnly: String(activeOnly) });
}
