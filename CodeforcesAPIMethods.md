# Codeforces API — Methods

> Source: https://codeforces.com/apiHelp/methods

---

## blogEntry.comments

Returns a list of comments to the specified blog entry.

| Parameter | Required | Description |
|---|---|---|
| `blogEntryId` | ✓ | Id of the blog entry (visible in blog entry URL, e.g. `/blog/entry/79`) |

**Returns:** List of `Comment` objects.

---

## blogEntry.view

Returns a blog entry.

| Parameter | Required | Description |
|---|---|---|
| `blogEntryId` | ✓ | Id of the blog entry (visible in blog entry URL, e.g. `/blog/entry/79`) |

**Returns:** `BlogEntry` object (full version).

---

## contest.hacks

Returns list of hacks in the specified contest. Full information is available only after contest end.

| Parameter | Required | Description |
|---|---|---|
| `contestId` | ✓ | Id of the contest (not the round number; visible in contest URL, e.g. `/contest/566/status`) |
| `asManager` | | Boolean. If `true`, returns information available to contest managers. |

**Returns:** List of `Hack` objects.

---

## contest.list

Returns information about all available contests.

| Parameter | Required | Description |
|---|---|---|
| `gym` | | Boolean. If `true`, gym contests are returned; otherwise regular contests. |
| `groupCode` | | Group code (e.g. `sfSJn5pz1a`) to filter contests. Requires read access to the group. |

**Returns:** List of `Contest` objects. When called with auth, includes mashups and private gyms accessible to the calling user.

---

## contest.ratingChanges

Returns rating changes after a contest.

| Parameter | Required | Description |
|---|---|---|
| `contestId` | ✓ | Id of the contest (not the round number; visible in contest URL) |

**Returns:** List of `RatingChange` objects.

---

## contest.standings

Returns the contest description and the requested part of the standings.

| Parameter | Required | Description |
|---|---|---|
| `contestId` | ✓ | Id of the contest (not the round number) |
| `asManager` | | Boolean. If `true`, returns manager-level information. |
| `from` | | 1-based index of the standings row to start from. |
| `count` | | Number of standing rows to return. |
| `handles` | | Semicolon-separated list of handles (max 10 000). If provided, shows standings only for these handles. |
| `room` | | If specified, only participants from this room are shown. |
| `showUnofficial` | | If `true`, includes virtual and out-of-competition participants. Otherwise only official contestants. |
| `participantTypes` | | Comma-separated participant types: `CONTESTANT`, `PRACTICE`, `VIRTUAL`, `MANAGER`, `OUT_OF_COMPETITION`. |

**Returns:** Object with three fields:
- `contest` — `Contest` object
- `problems` — list of `Problem` objects
- `rows` — list of `RanklistRow` objects

---

## contest.status

Returns submissions for a specified contest, optionally filtered by user handle.

| Parameter | Required | Description |
|---|---|---|
| `contestId` | ✓ | Id of the contest |
| `asManager` | | Boolean. If `true`, returns manager-level information. |
| `handle` | | Codeforces user handle to filter by. |
| `from` | | 1-based index of the first submission to return. |
| `count` | | Number of submissions to return. |
| `includeSources` | | Boolean. Include source code (only for managers). |

**Returns:** List of `Submission` objects, sorted in decreasing order of submission id.

---

## problemset.problems

Returns all problems from the problemset, optionally filtered by tags.

| Parameter | Required | Description |
|---|---|---|
| `tags` | | Semicolon-separated list of tags. |
| `problemsetName` | | Custom problemset short name (e.g. `acmsguru`). |

**Returns:** Two lists — `Problem` objects and `ProblemStatistics` objects.

---

## problemset.recentStatus

Returns recent submissions.

| Parameter | Required | Description |
|---|---|---|
| `count` | ✓ | Number of submissions to return (max 1000). |
| `problemsetName` | | Custom problemset short name. |

**Returns:** List of `Submission` objects, sorted in decreasing order of submission id.

---

## recentActions

Returns recent actions.

| Parameter | Required | Description |
|---|---|---|
| `maxCount` | ✓ | Number of recent actions to return (max 100). |

**Returns:** List of `RecentAction` objects.

---

## system.status

Checks API availability.

**Returns:** `"OK"` if API is available.

---

## user.blogEntries

Returns all blog entries by a user.

| Parameter | Required | Description |
|---|---|---|
| `handle` | ✓ | Codeforces user handle. |

**Returns:** List of `BlogEntry` objects (short form).

---

## user.friends

Returns the authorized user's friends. **Requires authentication.**

| Parameter | Required | Description |
|---|---|---|
| `onlyOnline` | | Boolean. If `true`, returns only online friends. |

**Returns:** List of strings (user handles).

---

## user.info

Returns information about one or several users.

| Parameter | Required | Description |
|---|---|---|
| `handles` | ✓ | Semicolon-separated list of handles (max 10 000). |
| `checkHistoricHandles` | | Boolean (default `true`). If `true`, searches handle change history. |

**Returns:** List of `User` objects.

---

## user.ratedList

Returns users who have participated in at least one rated contest.

| Parameter | Required | Description |
|---|---|---|
| `activeOnly` | | Boolean. If `true`, returns only users active in the last month. |
| `includeRetired` | | Boolean. If `true`, includes all rated users regardless of recent activity. |
| `contestId` | | Id of a specific contest. |

**Returns:** List of `User` objects sorted in decreasing order of rating.

---

## user.rating

Returns rating history for a user.

| Parameter | Required | Description |
|---|---|---|
| `handle` | ✓ | Codeforces user handle. |

**Returns:** List of `RatingChange` objects.

---

## user.status

Returns submissions of a specified user.

| Parameter | Required | Description |
|---|---|---|
| `handle` | ✓ | Codeforces user handle. |
| `from` | | 1-based index of the first submission to return. |
| `count` | | Number of submissions to return. |
| `includeSources` | | Boolean. Include source code (only for own account). |

**Returns:** List of `Submission` objects, sorted in decreasing order of submission id.
