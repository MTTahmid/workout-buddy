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
		"createdAt": "2026-03-27T12:00:00.000Z"
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
			"points": 20,
			"penalties": 1
		}
	}
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
- active or most recent weekly bet details
- user score snapshot from active buddy pair (`points`, `penalties`)

### Weekly Bets

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/user/weekly-bets/allowed-stakes` | Get preset allowed stake labels |
| POST | `/user/:id/weekly-bets` | Create a weekly bet between active buddies |

#### `POST /user/:id/weekly-bets`

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

### Buddy Challenges

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/user/:id/challenges` | Challenger creates challenge for a buddy |
| POST | `/user/:id/challenges/:challengeId/proof` | Target uploads proof image |
| GET | `/user/:id/challenges/:challengeId/proof` | Challenger/target streams proof image |
| PUT | `/user/:id/challenges/:challengeId/resolve` | Challenger accepts/rejects proof |

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

- `:id` must be the target id.
- Content type: `multipart/form-data`
- File field name: `proof`

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
- Images only, max size 5MB.
- Proof is stored in Mongo GridFS bucket: `challengeProofs`.

#### `PUT /user/:id/challenges/:challengeId/resolve`

Request body:

```json
{
	"accepted": true,
	"note": "Looks good"
}
```

Rules:

- `:id` must be the challenger id.
- Challenge must be in `proof_submitted` state.
- `accepted: true`
	- target gets challenge points in `buddyPair.memberScores`
	- challenge status becomes `accepted`
	- proof file and challenge record are retained
- `accepted: false`
	- target gets `+1` penalty in `buddyPair.memberScores`
	- challenge status becomes `rejected`
	- proof file and challenge record are retained

## Data Collections Used

- `user`
- `workouts`
- `buddyPair`
- `buddyWorkout`
- `bets`
- `challenges`
- `challengeProofs.files` and `challengeProofs.chunks` (GridFS)

## Notes

- Pairing codes are random uppercase alphanumeric, 5 characters, and single-use.
- Proof image access is restricted to challenge participants only.
- Route base path is `/user`, so endpoints are prefixed with `/user/...`.

