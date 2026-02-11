# Backend contract: Forgot password & Reset password

The frontend implements the full forgot-password and reset-password flow. Use this contract so the backend can implement the same API.

Base URL: same as `VITE_API_BASE_URL` (e.g. `http://localhost:8000`). All paths are under `/api/v1`.

---

## 1. Forgot password (request reset link)

**Purpose:** User enters email; backend sends a password-reset link to that email (if the account exists).

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/forgot-password` |
| **Headers** | `Content-Type: application/json` |
| **Request body** | `{ "email": "string" }` — trimmed, non-empty, valid email format (validated on frontend) |

**Success (200):**

- Body optional. Frontend treats any 2xx as success and shows: “If an account exists for this email, you will receive a password reset link.”
- Example: `{}` or `{ "message": "If an account exists, you will receive an email." }`

**Errors:**

- **400** – Bad request (e.g. invalid body). Response body: `{ "detail": "string" }` or `{ "message": "string" }`.
- **404** – Optional: “User not found.” Frontend still shows the same success message for security (no email enumeration).
- **500** – Server error. Frontend shows a generic error.

**Notes:**

- Frontend does not require a specific success body; backend can return empty `{}` or a message.
- For security, backend should not reveal whether the email exists; either send the email only if the user exists, or always return 200 and send email only when the user exists.

---

## 2. Reset password (set new password with token)

**Purpose:** User opens the link from the email; link contains a token in the query string. User submits a new password; backend verifies the token and updates the password.

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path** | `/api/v1/auth/reset-password` |
| **Headers** | `Content-Type: application/json` |
| **Request body** | `{ "token": "string", "newPassword": "string" }` |

**Token:**

- Frontend reads the token from the URL query. It supports any of: `?token=...`, `?reset_token=...`, `?key=...`. Backend can choose one (e.g. `token`) and send that in the reset link, e.g. `https://yourapp.com/reset-password?token=abc123`.

**newPassword:**

- Frontend enforces minimum length **6 characters**. Backend may enforce stronger rules (e.g. 8+ chars, complexity).

**Success (200):**

- Body optional. Example: `{}` or `{ "message": "Password has been reset." }`
- Frontend then shows “Password reset – you can now sign in” and a “Back to sign in” button.

**Errors:**

- **400** – Bad request (e.g. invalid or expired token, invalid password). Response: `{ "detail": "string" }` or `{ "message": "string" }`. For validation errors, `detail` can be an array of `{ "loc": ["body", "field"], "msg": "string" }`.
- **401** – Unauthorized (e.g. invalid/expired token). Response: `{ "detail": "string" }`.
- **422** – Validation error (e.g. password too short). Same `detail` shape as above.
- **500** – Server error.

**Notes:**

- Frontend parses `detail` (string or array) and `message` for error display.
- After success, user is redirected to sign-in; no automatic login.

---

## Summary table

| Endpoint | Method | Body | Success |
|----------|--------|------|---------|
| `/api/v1/auth/forgot-password` | POST | `{ "email": "string" }` | 200, body optional |
| `/api/v1/auth/reset-password` | POST | `{ "token": "string", "newPassword": "string" }` | 200, body optional |

Frontend code: `client/src/api/auth.ts` (types and `forgotPassword`, `resetPassword`), `client/src/pages/forgot-password.tsx`, `client/src/pages/reset-password.tsx`.
