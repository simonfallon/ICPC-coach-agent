# Codeforces API — Return Objects

> Source: https://codeforces.com/apiHelp/objects

---

## User

Represents a Codeforces user.

| Field | Type | Description |
|---|---|---|
| `handle` | String | Codeforces user handle. |
| `email` | String | Shown only if user allowed contact info sharing. |
| `vkId` | String | VK social network user id. Shown only if user allowed contact info sharing. |
| `openId` | String | Shown only if user allowed contact info sharing. |
| `firstName` | String | Localized. Can be absent. |
| `lastName` | String | Localized. Can be absent. |
| `country` | String | Localized. Can be absent. |
| `city` | String | Localized. Can be absent. |
| `organization` | String | Localized. Can be absent. |
| `contribution` | Integer | User contribution score. |
| `rank` | String | Localized rank title. |
| `rating` | Integer | Current rating. |
| `maxRank` | String | Localized. |
| `maxRating` | Integer | Maximum rating ever achieved. |
| `lastOnlineTimeSeconds` | Integer | Unix timestamp of last online. |
| `registrationTimeSeconds` | Integer | Unix timestamp of registration. |
| `friendOfCount` | Integer | Number of users who have this user as a friend. |
| `avatar` | String | URL of user's avatar. |
| `titlePhoto` | String | URL of user's title photo. |

---

## BlogEntry

Represents a Codeforces blog entry. May be in short or full version.

| Field | Type | Description |
|---|---|---|
| `id` | Integer | |
| `originalLocale` | String | Original locale of the blog entry. |
| `creationTimeSeconds` | Integer | Unix timestamp of creation. |
| `authorHandle` | String | Author's user handle. |
| `title` | String | Localized. |
| `content` | String | Localized. **Not included in short version.** |
| `locale` | String | |
| `modificationTimeSeconds` | Integer | Unix timestamp of last update. |
| `allowViewHistory` | Boolean | If `true`, any specific revision can be viewed. |
| `tags` | String list | |
| `rating` | Integer | |

---

## Comment

Represents a comment.

| Field | Type | Description |
|---|---|---|
| `id` | Integer | |
| `creationTimeSeconds` | Integer | Unix timestamp of creation. |
| `commentatorHandle` | String | |
| `locale` | String | |
| `text` | String | |
| `parentCommentId` | Integer | Can be absent. |
| `rating` | Integer | |

---

## RecentAction

Represents a recent action on the platform.

| Field | Type | Description |
|---|---|---|
| `timeSeconds` | Integer | Unix timestamp of the action. |
| `blogEntry` | BlogEntry | Short form. Can be absent. |
| `comment` | Comment | Can be absent. |

---

## RatingChange

Represents a user's participation in a rated contest.

| Field | Type | Description |
|---|---|---|
| `contestId` | Integer | |
| `contestName` | String | Localized. |
| `handle` | String | Codeforces user handle. |
| `rank` | Integer | Place at the time of rating update. Not updated if rank changes later (e.g. disqualification). |
| `ratingUpdateTimeSeconds` | Integer | Unix timestamp of rating update. |
| `oldRating` | Integer | Rating before the contest. |
| `newRating` | Integer | Rating after the contest. |

---

## Contest

Represents a contest on Codeforces.

| Field | Type | Description |
|---|---|---|
| `id` | Integer | |
| `name` | String | Localized. |
| `type` | Enum | `CF`, `IOI`, `ICPC` — scoring system. |
| `phase` | Enum | `BEFORE`, `CODING`, `PENDING_SYSTEM_TEST`, `SYSTEM_TEST`, `FINISHED`. |
| `frozen` | Boolean | If `true`, ranklist is frozen. |
| `durationSeconds` | Integer | Duration of the contest. |
| `freezeDurationSeconds` | Integer | Ranklist freeze duration. Can be absent. |
| `startTimeSeconds` | Integer | Contest start time in unix format. Can be absent. |
| `relativeTimeSeconds` | Integer | Seconds elapsed since contest start (can be negative). Can be absent. |
| `preparedBy` | String | Handle of the creator. Can be absent. |
| `websiteUrl` | String | URL for contest-related website. Can be absent. |
| `description` | String | Localized. Can be absent. |
| `difficulty` | Integer | 1–5 (higher = harder). Can be absent. |
| `kind` | String | Human-readable category: `Official ICPC Contest`, `Official School Contest`, `Opencup Contest`, `School/University/City/Region Championship`, `Training Camp Contest`, `Official International Personal Contest`, `Training Contest`. Can be absent. |
| `icpcRegion` | String | Region name for official ICPC contests. Localized. Can be absent. |
| `country` | String | Localized. Can be absent. |
| `city` | String | Localized. Can be absent. |
| `season` | String | Can be absent. |

---

## Party

Represents a party (team or individual) participating in a contest.

| Field | Type | Description |
|---|---|---|
| `contestId` | Integer | Id of the contest. Can be absent. |
| `members` | List\<Member\> | Members of the party. |
| `participantType` | Enum | `CONTESTANT`, `PRACTICE`, `VIRTUAL`, `MANAGER`, `OUT_OF_COMPETITION`. |
| `teamId` | Integer | Unique team id. Present only for team parties. Can be absent. |
| `teamName` | String | Localized team name. Present only for teams and ghosts. Can be absent. |
| `ghost` | Boolean | If `true`, this party participated outside Codeforces (e.g. Petrozavodsk ghosts in gym). |
| `room` | Integer | Room number. Can be absent. |
| `startTimeSeconds` | Integer | Unix timestamp when this party started the contest. Can be absent. |

---

## Member

Represents a member of a party.

| Field | Type | Description |
|---|---|---|
| `handle` | String | Codeforces user handle. |
| `name` | String | User's display name if available. Can be absent. |

---

## Problem

Represents a problem.

| Field | Type | Description |
|---|---|---|
| `contestId` | Integer | Id of the contest containing the problem. Can be absent. |
| `problemsetName` | String | Short name of the problemset. Can be absent. |
| `index` | String | Problem index within the contest (e.g. `A`, `B1`). |
| `name` | String | Localized. |
| `type` | Enum | `PROGRAMMING`, `QUESTION`. |
| `points` | Float | Maximum points. Can be absent. |
| `rating` | Integer | Problem difficulty rating. Can be absent. |
| `tags` | String list | Problem tags. |

---

## ProblemStatistics

Represents statistics for a problem.

| Field | Type | Description |
|---|---|---|
| `contestId` | Integer | Id of the contest containing the problem. Can be absent. |
| `index` | String | Problem index within the contest. |
| `solvedCount` | Integer | Number of users who solved the problem. |

---

## Submission

Represents a submission.

| Field | Type | Description |
|---|---|---|
| `id` | Integer | |
| `contestId` | Integer | Can be absent. |
| `creationTimeSeconds` | Integer | Unix timestamp of submission. |
| `relativeTimeSeconds` | Integer | Seconds from contest start (or virtual start) to submission. |
| `problem` | Problem | |
| `author` | Party | |
| `programmingLanguage` | String | |
| `verdict` | Enum | `FAILED`, `OK`, `PARTIAL`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `IDLENESS_LIMIT_EXCEEDED`, `SECURITY_VIOLATED`, `CRASHED`, `INPUT_PREPARATION_CRASHED`, `CHALLENGED`, `SKIPPED`, `TESTING`, `REJECTED`, `SUBMITTED`. Can be absent. |
| `testset` | Enum | `SAMPLES`, `PRETESTS`, `TESTS`, `CHALLENGES`, `TESTS1`…`TESTS10`. Testset used for judging. |
| `passedTestCount` | Integer | Number of passed tests. |
| `timeConsumedMillis` | Integer | Max time consumed across all tests (ms). |
| `memoryConsumedBytes` | Integer | Max memory consumed across all tests (bytes). |
| `points` | Float | Points scored (IOI-style). Can be absent. |

---

## Hack

Represents a hack during a Codeforces Round.

| Field | Type | Description |
|---|---|---|
| `id` | Integer | |
| `creationTimeSeconds` | Integer | Unix timestamp. |
| `hacker` | Party | |
| `defender` | Party | |
| `verdict` | Enum | `HACK_SUCCESSFUL`, `HACK_UNSUCCESSFUL`, `INVALID_INPUT`, `GENERATOR_INCOMPILABLE`, `GENERATOR_CRASHED`, `IGNORED`, `TESTING`, `OTHER`. Can be absent. |
| `problem` | Problem | The hacked problem. |
| `test` | String | Can be absent. |
| `judgeProtocol` | Object | Fields: `manual` (`"true"`/`"false"`), `protocol` (description), `verdict`. Localized. Can be absent. |

---

## RanklistRow

Represents a row in the contest standings.

| Field | Type | Description |
|---|---|---|
| `party` | Party | Party that took this place. |
| `rank` | Integer | Party's place in the contest. |
| `points` | Float | Total points scored. |
| `penalty` | Integer | Total penalty (ICPC-style). |
| `successfulHackCount` | Integer | |
| `unsuccessfulHackCount` | Integer | |
| `problemResults` | List\<ProblemResult\> | Results per problem (same order as `problems` in the standings response). |
| `lastSubmissionTimeSeconds` | Integer | IOI only. Seconds from contest start to the last point-adding submission. Can be absent. |

---

## ProblemResult

Represents a party's result for a single problem.

| Field | Type | Description |
|---|---|---|
| `points` | Float | |
| `penalty` | Integer | ICPC-style penalty. Can be absent. |
| `rejectedAttemptCount` | Integer | Number of incorrect submissions. |
| `type` | Enum | `PRELIMINARY` (points may decrease after system test), `FINAL`. |
| `bestSubmissionTimeSeconds` | Integer | Seconds from contest start to the submission that scored the most points. Can be absent. |
