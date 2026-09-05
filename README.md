# Feedback Backend

Express API for a parent feedback dashboard. Incoming feedback is validated, assigned a priority, and stored in Firestore.

## Prerequisites

- Node.js 22+
- A Firebase service account key at `serviceAccountKey.json` (not committed), or `FIREBASE_SERVICE_ACCOUNT_JSON` on Render

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Defaults to `8000`. Render sets this automatically. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Render | Full service-account JSON. Locally, `serviceAccountKey.json` is used instead. |
| `FEEDBACK_INGEST_SECRET` | yes | Shared secret for `POST /api/feedback`. Apps Script must send it as `X-Feedback-Secret`. |

Local `.env` example:

```bash
PORT=8000
FEEDBACK_INGEST_SECRET=replace-with-a-long-random-string
```

Do not commit `.env` or `serviceAccountKey.json`.

On Render, set `FIREBASE_SERVICE_ACCOUNT_JSON` and `FEEDBACK_INGEST_SECRET` as secret environment variables.

## Setup

```bash
npm install
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

The server listens on `process.env.PORT` or `8000`, bound to `0.0.0.0`.

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
feedback/helpers/access.js     Ingest secret and dashboard role checks
feedback/lib/model.js          Priority scoring and Firestore reads/writes
```

## Endpoints

### `GET /health`

No auth.

```json
{
  "status": "ok",
  "message": "Feedback backend is running"
}
```

### `POST /api/feedback`

Ingests feedback from Google Apps Script.

**Header**

```text
X-Feedback-Secret: <FEEDBACK_INGEST_SECRET>
```

Missing or wrong secret → HTTP 401.

**Request body**

| Field | Required | Notes |
| --- | --- | --- |
| `parent_name` | yes | |
| `student_name` | yes | |
| `class_label` | yes | |
| `rating` | yes | Integer 1–5 |
| `continuing` | no | `"Yes"`, `"No"`, or `"Not sure"` |
| `contact_request` | no | `true` / `false`, `1` / `0`, `"Yes"` / `"No"` |
| `comments` | no | |
| `submitted_at` | no | Ignored; `createdAt` is a Firestore server timestamp |
| `source_id` | no | Idempotency key. Retries with the same value return the existing document. |

Priority is calculated only on the server. Client-sent priority fields are ignored.

**Success (201)**

```json
{
  "status": "ok",
  "message": "Feedback created successfully",
  "id": "DOCUMENT_ID"
}
```

**Duplicate `source_id` (200)**

```json
{
  "status": "ok",
  "message": "Feedback already exists",
  "id": "DOCUMENT_ID"
}
```

### `GET /api/feedback`

Returns feedback newest first. Access is enforced on the server.

**Identity headers** (stand-in until Contour roster/auth is wired)

```text
X-User-Role: lead | coordinator | tutor
X-User-Uid: <uid>
X-User-Name: <display name>
X-User-Classes: <comma-separated class labels, required for tutors>
```

- `lead` / `coordinator` — all documents, including parent details
- `tutor` — only documents whose `classLabel` is in `X-User-Classes`; `parentName` and `comments` are stripped

Do not hardcode tutors, roles, or classes in this repo. Assigned classes will come from the roster API later.

### `PATCH /api/feedback/:id/handled`

Marks a document handled. `handledByUid`, `handledByName`, and `handledAt` come from the dashboard identity headers, not the request body.

Tutors can only handle feedback for their assigned classes.

## Priority rules

| Condition | Points |
| --- | --- |
| `contact_request` indicates a contact request | +4 |
| `rating <= 2` | +4 |
| `rating === 3` | +2 |
| `continuing` is `"No"` | +4 |
| `continuing` is `"Not sure"` | +1 |

| Score | Priority |
| --- | --- |
| 6+ | `urgent` |
| 4–5 | `high` |
| 2–3 | `medium` |
| 0–1 | `low` |

Stored documents also include `status`, `handledByUid`, `handledByName`, `handledAt`, and `sensitive`.

## Google Apps Script

Send the secret header and an optional `source_id` (for example spreadsheet id + row number):

```javascript
UrlFetchApp.fetch(ENDPOINT_URL, {
  method: "post",
  contentType: "application/json",
  headers: {
    "X-Feedback-Secret": PropertiesService.getScriptProperties().getProperty("FEEDBACK_INGEST_SECRET"),
  },
  payload: JSON.stringify(payload),
  muteHttpExceptions: true,
});
```

Store `FEEDBACK_INGEST_SECRET` in Apps Script **Project Settings → Script properties**, not in `Code.gs`.

## Notes

- `.env` and `serviceAccountKey.json` are gitignored.
- Roster API and Firebase Auth are not implemented yet. Dashboard routes trust identity headers that a future auth layer will set after verifying the user.
