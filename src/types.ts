// ── Codeforces API types ──────────────────────────────────────────────────────
// Based on https://codeforces.com/apiHelp/objects

export interface CFMember {
  handle: string;
  name?: string; // User's name if available
}

export interface CFParty {
  contestId?: number;
  members: CFMember[];
  participantType: 'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
  teamId?: number;
  teamName?: string;
  ghost?: boolean;
  room?: number;
  startTimeSeconds?: number;
}

export interface CFUser {
  handle: string;
  email?: string;
  vkId?: string;
  openId?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution?: number;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  lastOnlineTimeSeconds?: number;
  registrationTimeSeconds?: number;
  friendOfCount?: number;
  avatar?: string;
  titlePhoto?: string;
}

export interface CFContest {
  id: number;
  name: string;
  type: 'CF' | 'IOI' | 'ICPC';
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED';
  frozen?: boolean;
  durationSeconds: number;
  freezeDurationSeconds?: number;
  startTimeSeconds?: number;
  relativeTimeSeconds?: number;
  preparedBy?: string;
  websiteUrl?: string;
  description?: string;
  difficulty?: number;
  kind?: string;
  icpcRegion?: string;
  country?: string;
  city?: string;
  season?: string;
}

export interface CFProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type?: 'PROGRAMMING' | 'QUESTION';
  points?: number;
  rating?: number;
  tags?: string[];
}

export interface CFProblemStatistics {
  contestId?: number;
  index: string;
  solvedCount: number;
}

export interface CFProblemResult {
  points: number;
  penalty?: number;
  rejectedAttemptCount: number;
  type: 'PRELIMINARY' | 'FINAL';
  bestSubmissionTimeSeconds?: number;
}

export interface CFRanklistRow {
  party: CFParty;
  rank: number;
  points: number;
  penalty: number;
  successfulHackCount: number;
  unsuccessfulHackCount: number;
  problemResults: CFProblemResult[];
  lastSubmissionTimeSeconds?: number;
}

export interface CFStandingsResponse {
  contest: CFContest;
  problems: CFProblem[];
  rows: CFRanklistRow[];
}

export type CFVerdict =
  | 'FAILED' | 'OK' | 'PARTIAL' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR'
  | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED'
  | 'IDLENESS_LIMIT_EXCEEDED' | 'SECURITY_VIOLATED' | 'CRASHED'
  | 'INPUT_PREPARATION_CRASHED' | 'CHALLENGED' | 'SKIPPED' | 'TESTING'
  | 'REJECTED' | 'SUBMITTED';

export type CFTestset =
  | 'SAMPLES' | 'PRETESTS' | 'TESTS' | 'CHALLENGES'
  | 'TESTS1' | 'TESTS2' | 'TESTS3' | 'TESTS4' | 'TESTS5'
  | 'TESTS6' | 'TESTS7' | 'TESTS8' | 'TESTS9' | 'TESTS10';

export interface CFSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds?: number;
  problem: CFProblem;
  author: CFParty;
  programmingLanguage: string;
  verdict?: CFVerdict;
  testset?: CFTestset;
  passedTestCount?: number;
  timeConsumedMillis?: number;
  memoryConsumedBytes?: number;
  points?: number;
}

export interface CFRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CFProblemsResponse {
  problems: CFProblem[];
  problemStatistics: CFProblemStatistics[];
}

export interface CFBlogEntry {
  id: number;
  originalLocale: string;
  creationTimeSeconds: number;
  authorHandle: string;
  title: string;
  content?: string; // Not included in short version
  locale: string;
  modificationTimeSeconds: number;
  allowViewHistory: boolean;
  tags: string[];
  rating: number;
}

export interface CFComment {
  id: number;
  creationTimeSeconds: number;
  commentatorHandle: string;
  locale: string;
  text: string;
  parentCommentId?: number;
  rating: number;
}

export interface CFAction {
  timeSeconds: number;
  blogEntry?: CFBlogEntry;
  comment?: CFComment;
}

// ── Agent / SSE types ─────────────────────────────────────────────────────────

/** All possible event types streamed from the agent to the browser. */
export type SSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string }
  | { type: 'tool_result'; name: string; success: boolean; error?: string }
  | { type: 'retrying'; waitSeconds: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** A single message in the conversation history. */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Minimal interface for SSE output — satisfied by Express Response and test fakes. */
export interface SSEWriter {
  write: (chunk: string) => void;
}

/** All registered tool names. Extending: add to this union and to executeTool's switch. */
export type ToolName =
  | 'get_user_info'
  | 'get_user_rating'
  | 'get_user_submissions'
  | 'get_contest_list'
  | 'get_contest_standings'
  | 'get_contest_status'
  | 'get_contest_rating_changes'
  | 'get_problems'
  | 'get_recent_actions'
  | 'get_rated_list'
  | 'get_gym_simulations';

// ── Gym simulation result ─────────────────────────────────────────────────────

export interface GymResult {
  name: string;
  link: string;
  difficulty: string | null;
  durationHours: number | null;
  simulatedAt: string;
  teamName: string | null;
  members: string[];
  rank: string | null;
  solved: string | null;
}

export interface GymSimulationsResult {
  handle: string;
  gyms: GymResult[];
}
