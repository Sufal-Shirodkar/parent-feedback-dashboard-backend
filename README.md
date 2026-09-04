# Feedback Backend

Express API for a parent feedback dashboard. Incoming feedback is validated, assigned a priority, and stored in Firestore.

## Prerequisites

- Node.js 22+
- A Firebase service account key at `serviceAccountKey.json` (not committed)

## Setup

```bash
npm install
```

Create a `.env` file:

```bash
PORT=8000
```

Place your Firebase Admin service account file at:

```text
serviceAccountKey.json
```

## Scripts

```bash
npm start      # node server.js
npm run dev    # node --watch server.js
```

The server listens on `process.env.PORT` or `8000`.

Only one process can use that port. If you see `EADDRINUSE`, stop the other Node process and start again:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

## Project structure

```text
server.js                      App bootstrap and Firebase Admin init
router/router.js               Route table
feedback/bin/controller.js     HTTP handlers
feedback/lib/schema.js         Joi request schema
feedback/helpers/validator.js  Joi validation helper
feedback/lib/model.js          Priority scoring and Firestore writes
```

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "message": "Feedback backend is running"
}
```

### `POST /api/feedback`

Creates a feedback document in the Firestore `feedback` collection.

**Request body**

| Field | Required | Notes |
| --- | --- | --- |
| `parent_name` | yes | |
| `student_name` | yes | |
| `class_label` | yes | |
| `rating` | yes | Must be a number |
| `continuing` | no | Used for priority (`"No"`, `"Not sure"`) |
| `contact_request` | no | Treated as requested for `true`, `1`, `"yes"`, `"true"` |
| `comments` | no | |
| `submitted_at` | no | Ignored; `createdAt` is a Firestore server timestamp |

**Example**

```bash
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "parent_name": "Test Parent",
    "student_name": "Test Student",
    "class_label": "Mathematics",
    "rating": 2,
    "continuing": "No",
    "contact_request": "Yes",
    "comments": "Test feedback for API"
  }'
```

**Success (201)**

```json
{
  "status": "ok",
  "message": "Feedback created successfully",
  "id": "DOCUMENT_ID"
}
```

**Validation error (400)**

```json
{
  "status": "error",
  "message": "Missing required fields: parent_name, rating"
}
```

**Server error (500)**

```json
{
  "status": "error",
  "message": "Failed to create feedback"
}
```

## Priority rules

Score is calculated, then mapped to a label.

| Condition | Points |
| --- | --- |
| `contact_request` indicates a contact request | +3 |
| `rating <= 2` | +3 |
| `continuing` is `"No"` | +2 |
| `continuing` is `"Not sure"` | +1 |

| Score | Priority |
| --- | --- |
| 6+ | `urgent` |
| 4–5 | `high` |
| 2–3 | `medium` |
| 0–1 | `low` |

Stored documents also include `status: "open"` and `sensitive: false`.

## Notes

- `.env` and `serviceAccountKey.json` are gitignored.
- Gemini, roster, and authentication are not implemented yet.
