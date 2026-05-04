# Workout Buddy Backend API

Express + MongoDB backend for buddy pairing, workouts, bets, and challenge proof verification.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Multer (proof image upload)
- GridFS (proof image storage inside MongoDB)

## Project Structure

```
backend/
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   ├── db.js
    │   └── gridfs.js
    ├── controllers/
    │   └── userController.js
    ├── middleware/
    │   └── proofUpload.js
    ├── models/
    │   ├── Users.js
    │   ├── Workout.js
    │   ├── WorkoutModel.js
    │   ├── BuddyPair.js
    │   ├── BuddyWorkout.js
    │   ├── BuddyChallenge.js
	│   ├── Habit.js
    │   ├── CalorieTracker.js
    │   ├── Challenge.js
    │   ├── ActiveWorkoutModelSession.js
    │   └── WMCompletionHistory.js
    └── routes/
        └── userRoutes.js
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
MONGODB_URI=<your mongodb uri>
MONGODB_URI_FALLBACK=<optional fallback uri>
PORT=5000
```

3. Run development server:

```bash
npm run dev
```

The API is mounted at `/user`.

## Base URL

For local development:

```
http://localhost:5000/
```

## API Documentation

### Health

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/` | Basic app health message |

### Users & Pairing

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/users` | Get all users |
| GET | `/user/:id/pairing-code` | Generate and return a new random 5-char pairing code |
| PUT | `/user/:id/buddy/:pairingCode` | Pair user with buddy by pairing code (code is consumed/deleted) |
| GET | `/user/:id/buddy` | Get active buddy profile/details for this user (sanitized) |
| GET | `/user/:id/buddy/money` | Get detailed money earned info for both members of the buddy pair |
| PUT | `/user/:id/buddy/money/toggle` | Enable or disable monetary tracking for the buddy pair |

#### `GET /user/:id/pairing-code`

Response:

```json
{
	"pairingCode": "A1B2C"
}
```

#### `GET /user/:id/buddy`

Returns the active buddy pair metadata plus the buddy's profile information that the app typically needs.

Sensitive/internal fields are intentionally excluded (for example: `passwordHash`, `email`, `pairingCode`).

Response shape:

```json
{
	"userId": "<ObjectId>",
	"buddyPair": {
		"id": "<ObjectId>",
		"status": "active",
		"createdAt": "2026-03-27T12:00:00.000Z",
		"monetaryEnabled": true
	},
	"buddy": {
		"_id": "<ObjectId>",
		"name": "Alex",
		"profile": {
			"age": 27,
			"weight": 72,
			"height": 175,
			"fitnessLevel": "Intermediate",
			"equipment": ["Dumbbells", "Yoga Mat"],
			"dietaryPreferences": ["High Protein"]
		},
		"goals": {
			"calorieGoal": 2500,
			"stepGoal": 9000,
			"targetWeight": 70
		},
		"performanceTier": {
			"currentTier": "Silver",
			"points": 320
		},
		"streak": {
			"current": 4,
			"lastWorkoutDate": "2026-03-26T00:00:00.000Z"
		},
		"habits": [],
		"createdAt": "2026-01-10T00:00:00.000Z",
		"score": {
			"points": 1000,
			"penalties": 1,
			"money": {
				"taka": 10,
				"formatted": "10.00 টাকা"
			}
		}
	}
}
```

#### `GET /user/:id/buddy/money`

Returns detailed money conversion info for all members of the active buddy pair.

**Conversion Rate:** 100 points = 1 taka (or 1000 points = 10 taka)

Response shape:

```json
{
	"buddyPairId": "<ObjectId>",
	"monetaryEnabled": true,
	"members": [
		{
			"userId": "<ObjectId>",
			"points": 1500,
			"moneyEarned": {
				"taka": 15,
				"formatted": "15.00 টাকা"
			}
		},
		{
			"userId": "<ObjectId>",
			"points": 800,
			"moneyEarned": {
				"taka": 8,
				"formatted": "8.00 টাকা"
			}
		}
	]
}
```

#### `PUT /user/:id/buddy/money/toggle`

Enable or disable monetary tracking for the buddy pair.

Request body:

```json
{
	"enabled": true
}
```

Response:

```json
{
	"message": "Monetary tracking enabled",
	"buddyPairId": "<ObjectId>",
	"monetaryEnabled": true
}
```

### Weekly Workout Routine

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/:id/weekly-workout-routine` | Get routine data from active buddy pairs and buddy workouts |

### View Support Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/:id/history` | Get streak, total workouts, and weekly history summary for History view |
| GET | `/user/:id/challenge-photos` | Get recent challenge proof photo metadata for dashboard carousel |
| GET | `/user/:id/current-stakes` | Get current weekly stake details and user score snapshot |
| GET | `/user/:id/calendar` | Get a calendar view with day buckets and all date-based activity for the selected month |

#### `GET /user/:id/history`

Response shape:

```json
{
	"userId": "<ObjectId>",
	"streak": 3,
	"totalWorkouts": 18,
	"weeks": [
		{
			"weekStartDate": "2026-02-23T00:00:00.000Z",
			"workoutsCompleted": 4
		}
	]
}
```

`streak` is the persistent per-user streak. It carries across weekly goal resets and only breaks when the user misses a completed weekly target.

#### `GET /user/:id/challenge-photos`

Optional query params:

- `limit` (default `10`, max `50`)

Response includes:

- challenge metadata (`challengeId`, `workoutType`, `status`, `points`, `deadline`)
- uploaded proof file metadata (`filename`, `contentType`, `size`)
- `proofUrl` that can be used to stream image bytes

#### `GET /user/:id/current-stakes`

Response includes:

- `hasCurrentStake` flag
- active or most recent weekly goal details
- user score snapshot from active buddy pair (`points`, `penalties`)

### Chat

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/:id/chat/:buddyPairId/messages` | Fetch messages for a buddy pair (validates that `:id` is a member). Supports `limit`, `before`, `after` query params. |
| POST | `/user/:id/chat/:buddyPairId/messages` | Send a text message as `:id` to the buddy pair. Body: JSON `{ "text": "..." }`. |
| PATCH | `/user/:id/chat/:buddyPairId/messages/read` | Mark unread messages from other members as read for this user. |

**Realtime:** Server emits `chat:message` (Socket.IO) to the buddy pair room when a new message is created. The Socket.IO instance is exposed via `req.app.get('io')`.

### Habit Tracker

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/habits/library` | Get predefined good and bad habit suggestions |
| GET | `/user/:id/habits` | Get user's habits and the last 7 weeks of weekly progress tables |
| POST | `/user/:id/habits` | Create a habit and set its weekly goal mode |
| POST | `/user/:id/habits/:habitId/log` | Log a habit occurrence for the current week |
| PUT | `/user/:id/habits/:habitId/goal` | Update habit name, category, goal mode, or target count |
| DELETE | `/user/:id/habits/:habitId` | Delete a habit |

#### `GET /user/:id/habits`

- Returns `goodHabits` and `badHabits` tables.
- Each habit includes `weeklyProgress` for the last 7 weeks.
- Good habits are green when the week target is met.
- Bad habits are green when the habit is avoided for the week.

#### `POST /user/:id/habits`

Request body:

```json
{
	"name": "Drink 8 glasses of water",
	"category": "good",
	"goalType": "do",
	"targetCount": 1,
	"source": "custom"
}
```

#### `POST /user/:id/habits/:habitId/log`

- Adds one occurrence to the habit's log history.
- Use this when the good habit was completed or the bad habit happened.

#### `PUT /user/:id/habits/:habitId/goal`

- Updates the habit's label or weekly goal settings.
- If `goalType` is `avoid`, `targetCount` defaults to `0`.
- If `goalType` is `do`, `targetCount` defaults to `1`.

#### Manual verification

1. `GET /user/habits/library` to pick a predefined good or bad habit.
2. `POST /user/:id/habits` to create one good habit and one bad habit.
3. `POST /user/:id/habits/:habitId/log` to add habit activity for the current week.
4. `GET /user/:id/habits` to verify the last 7 weekly rows turn green for success and red for failure.

### Weekly Goals

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/weekly-goals/allowed-stakes` | Get preset allowed stake labels |
| GET | `/user/:id/weekly-goals/allowed-stakes` | Get personal allowed stakes for user's active pair |
| POST | `/user/:id/weekly-goals/allowed-stakes` | Add a custom stake to active pair allowed stakes |
| POST | `/user/:id/weekly-goals` | Update weekly goal settings for active buddy pair |
| POST | `/user/:id/weekly-goals/:weeklyGoalId/proof` | Upload weekly goal proof image |
| GET | `/user/:id/weekly-goals/:weeklyGoalId/proof/:proofId` | Stream a specific weekly goal proof image |
| GET | `/user/:id/weekly-goals/:weeklyGoalId/details` | Get weekly goal progress and streak details |

#### `POST /user/:id/weekly-goals`

Request body:

```json
{
	"buddyId": "<ObjectId>",
	"weeklyWorkoutGoal": 4,
	"stake": "1 Dinner",
	"startDate": "2026-03-01T00:00:00.000Z",
	"status": "active"
}
```

Rules:

- If `stake` is provided, it must exist in the active pair's personal `allowedStakes` list.

#### `GET /user/:id/weekly-goals/allowed-stakes`

- Returns the active pair-specific stake list.
- If user is not in an active pair, returns default preset stakes.

#### `POST /user/:id/weekly-goals/allowed-stakes`

Request body:

```json
{
	"stake": "Movie Night"
}
```

Rules:

- Adds the stake to the active pair's personal `allowedStakes` list.
- Duplicate stake labels (case-insensitive) are ignored.

#### `POST /user/:id/weekly-goals/:weeklyGoalId/proof`

- `:id` must be one of the weekly goal participants.
- Content type: `multipart/form-data`
- File field name: `proof`

Response includes updated streak data per participant:

- `weeklyGoal.dailyStreaks[].dayStatus.days[]` with per-day entries for the 7-day window.
- `weeklyGoal.dailyStreaks[].dayStatus.summary` with counts of `done`, `canBeDone`, `notYetOpen`, `false`.

Per-day status values:

- `done`: proof already submitted for that day.
- `can_be_done`: the day is today and can still be submitted.
- `not_yet_open`: future day in the current weekly window.
- `false`: day has passed without submission.

#### `GET /user/:id/weekly-goals/:weeklyGoalId/proof/:proofId`

- Streams proof image bytes from GridFS.
- `:id` must be one of the weekly goal participants.
- `:proofId` is the proof subdocument id from the weekly goal.

#### `GET /user/:id/weekly-goals/:weeklyGoalId/details`

- Returns weekly goal metadata, per-user progress, streak states, and participant progress.
- Adds day-based progress for both current user and all participants:
	- `userStreak.dayStatus.days[]`
	- `userStreak.dayStatus.summary`
	- `participantProgress[].dayStatus.days[]`
	- `participantProgress[].dayStatus.summary`
- `userStreak.persistentCurrent` returns the stored long-running user streak value.

Notes:

- Day keys are returned as local date strings in `YYYY-MM-DD` format.
- `daysCompleted` still represents unique completed days capped by weekly target.

### Buddy Challenges

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/:id/challenges` | List challenge feed for user (as challenger or target) |
| POST | `/user/:id/challenges` | Challenger creates challenge for a buddy |
| POST | `/user/:id/challenges/:challengeId/proof` | Challenged user uploads challenge proof image |
| GET | `/user/:id/challenges/:challengeId/proof` | Stream challenge proof image (participants only) |

#### `GET /user/:id/challenges`

- Returns challenges where `:id` is either challenger or target.
- Results are sorted by newest first (`createdAt` descending).
- Expired `pending` or `submitted` challenges are auto-marked `rejected` before response.

Response includes:

- `userId`, `count`
- `challenges[]` with: `challengeId`, `workoutType`, `points`, `status`, `deadline`, `createdAt`
- `submittedAt`, `hasProof`, `challenger`, `target`, `proofUrl` (nullable)

#### `POST /user/:id/challenges`

Request body:

```json
{
	"targetId": "<ObjectId>",
	"workoutType": "10 Pushups",
	"points": 50,
	"deadline": "2026-03-02T23:59:59.000Z"
}
```

Rules:

- `:id` is the challenger id.
- Only active buddies can challenge each other.
- Challenge starts with `status = "pending"`.

#### `POST /user/:id/challenges/:challengeId/proof`

- `:id` must be the challenge target user.
- Content type: `multipart/form-data`
- File field name: `proof`
- On success, challenge is auto-approved (`status = "approved"`) and challenge points are added to target user score.

#### `GET /user/:id/challenges/:challengeId/proof`

- `:id` must be either challenger or target.
- Streams image bytes from GridFS for the challenge proof.

Challenge timeout behavior:

- If deadline is passed while challenge is still `pending` or `submitted`, challenge is auto-marked `rejected`.
- Rejected challenges award no points.

### Calorie Tracking

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/user/:id/calories/log` | Log a new calorie entry |
| GET | `/user/:id/calories/history` | Get calorie history for user |

#### `POST /user/:id/calories/log`

Request body:

```json
{
	"weight": 75,
	"goal": 2500,
	"workout": "Running",
	"duration": 30,
	"calories": 350
}
```

#### `GET /user/:id/calories/history`

Returns array of calorie tracking entries with metrics like weight, goal, workout type, duration, calories burned, and whether goal was met.

### Workout Models

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/workout-models/get` | Get all available workout models |
| GET | `/user/:id/workout-models/get` | Get user's custom workout models |
| POST | `/user/:id/workout-models/create` | Create a new workout model |
| POST | `/user/:id/workout-models/edit` | Edit an existing workout model |
| POST | `/user/:id/workout-models/delete` | Delete a workout model |

### Active Workout Model Sessions

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/user/:id/active-workout-model-session/start` | Start a new workout session |
| GET | `/user/:id/active-workout-model-session/tracker` | Get current session tracking data |
| POST | `/user/:id/active-workout-model-session/update` | Update session progress |
| DELETE | `/user/:id/active-workout-model-session/end` | End current workout session |

### Home Screen Widgets

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/:id/widget-config` | Get user's widget configuration and preferences |
| POST | `/user/:id/widget-config` | Save/update user's widget display preferences |
| GET | `/user/:id/widget-data` | Get aggregated widget data (streak, steps, calories, goals, habits) |

#### `GET /user/:id/widget-config`

Returns widget configuration with enabled widgets, sizes, metrics, theme preference, and refresh interval.

Response:

```json
{
	"userId": "<ObjectId>",
	"widgetsEnabled": [
		{
			"type": "streak",
			"size": "small",
			"metrics": ["current"],
			"enabled": true
		},
		{
			"type": "steps",
			"size": "medium",
			"metrics": ["current", "goal", "percentage"],
			"enabled": true
		}
	],
	"refreshInterval": 3600,
	"theme": "auto",
	"createdAt": "2026-03-27T12:00:00.000Z",
	"updatedAt": "2026-03-27T12:00:00.000Z"
}
```

Widget types: `streak`, `steps`, `calories`, `goals`, `habits`
Sizes: `small`, `medium`, `large`
Themes: `light`, `dark`, `auto`

#### `POST /user/:id/widget-config`

Request body:

```json
{
	"widgetsEnabled": [
		{
			"type": "streak",
			"size": "small",
			"metrics": ["current"],
			"enabled": true
		}
	],
	"refreshInterval": 1800,
	"theme": "dark"
}
```

#### `GET /user/:id/widget-data`

Returns real-time aggregated data for all widget types.

Response:

```json
{
	"userId": "<ObjectId>",
	"timestamp": "2026-03-27T12:00:00.000Z",
	"metrics": {
		"streak": {
			"type": "streak",
			"current": 5,
			"lastWorkoutDate": "2026-03-27T00:00:00.000Z"
		},
		"steps": {
			"type": "steps",
			"current": 8750,
			"goal": 10000,
			"percentage": 87,
			"goalMet": false
		},
		"calories": {
			"type": "calories",
			"current": 1850,
			"goal": 2000,
			"percentage": 92,
			"goalMet": false
		},
		"goals": {
			"type": "goals",
			"active": 1,
			"completed": 0,
			"total": 1
		},
		"habits": {
			"type": "habits",
			"total": 5,
			"completed": 3,
			"goodHabits": 3,
			"badHabits": 2
		}
	}
}
```

## Data Collections Used

- `user`
- `workouts`
- `buddyPair`
- `buddyWorkout`
- `bets`
- `challenges`
- `challengeProofs.files` and `challengeProofs.chunks` (GridFS)
- `habits`

## Notes

- Pairing codes are random uppercase alphanumeric, 5 characters, and single-use.
- Proof image access is restricted to challenge participants only.
- Route base path is `/user`, so endpoints are prefixed with `/user/...`.

