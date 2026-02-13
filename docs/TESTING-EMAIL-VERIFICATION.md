# Testing "Only Real Emails" / Email Verification Changes

This guide covers how to test the backend and frontend changes for email verification (admin-created users, CSV import, and frontend validation).

---

## Prerequisites

1. **RFP backend** (Python) running:
   ```bash
   cd /Volumes/japanpatel/Desktop/RFP
   source venv/bin/activate   # or your venv
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Or use `python scripts/run_server.py` if you have that script.

2. **rfp-ai frontend** running and pointing at the backend:
   ```bash
   cd /Users/arun/www/Manthan/rfp-ai
   # Ensure client/.env has VITE_API_BASE_URL=http://localhost:8000 (or your backend URL)
   npm run dev
   ```

3. **Email (SMTP)** optional for full flow: if the RFP backend has no SMTP configured, verification emails won’t be sent, but the backend will still create unverified users and return the “verification email sent” message. To test the actual link, configure SMTP in the RFP app (e.g. env vars used by `app.core.email`).

---

## 1. Backend: Admin-created user is unverified and gets verification email

**Goal:** Admin-created users are created with `is_active=False` and a verification email is triggered; they cannot log in until they verify.

- **Via API (no UI):**
  - Get an admin access token (e.g. log in as admin in the app and copy token from devtools / auth storage, or create first admin via bootstrap).
  - `POST /api/v1/users/register-by-admin` with body:
    ```json
    {
      "email": "newuser@example.com",
      "firstName": "New",
      "lastName": "User",
      "password": "password123",
      "confirmPassword": "password123",
      "role": "customer"
    }
    ```
  - **Expect:** `200`, response includes `message` like “User created. A verification email has been sent; they must verify before signing in.” and a `user` object.
  - **Then:** `POST /api/v1/auth/login` with `{"email": "newuser@example.com", "password": "password123"}`.
  - **Expect:** `403` with detail like “Account is deactivated” (user is unverified).
  - **Verify email:** Use the verification link from the email (or, in dev, get the token from backend logs if SMTP isn’t configured). `POST /api/v1/auth/verify-email` with `{"token": "<token_from_link>"}`.
  - **Then:** Login again with same credentials.
  - **Expect:** `200` and access/refresh tokens.

- **Via UI:**
  - Log in as admin → Users → Create New User. Fill valid email, name, password, role.
  - **Expect:** Success toast mentioning verification email; dialog description says a verification link will be sent.
  - Try to log in as that new user (e.g. in an incognito window) before verifying.
  - **Expect:** Login fails (account deactivated / not active). After completing verification (link in email), login should succeed.

---

## 2. Backend: CSV import – format validation and verification

**Goal:** CSV import rejects invalid email format and creates users as unverified, with verification email sent per user.

- **Invalid email format:**
  - As admin, use “Import CSV” (or equivalent) with a CSV that has an invalid email in one row (e.g. `no-at-sign`, `@nodomain`, `a@b`).
  - **Expect:** That row is reported in `errors` with reason like “Invalid email format”; no user created for that row.

- **Valid email:**
  - Import a CSV with valid emails (e.g. `Name, Email, Role, Company, password` and a row like `Test User, csvuser@example.com, customer, Acme, pass123`).
  - **Expect:** User created; they should be unverified (`is_active=False`) and a verification email sent (if SMTP is configured). Login for that user should fail with 403 until they verify.

---

## 3. Frontend: Admin Create User – validation and messaging

**Goal:** Invalid email is rejected in the UI; user sees that a verification link will be sent.

- Log in as admin → Users → Create New User.
  - **Description:** Dialog should say something like “A verification link will be sent to their email; they must verify before signing in.”
  - Enter an **invalid email** (e.g. `notanemail`, `a@`, `@b.com`) and fill other required fields → Create.
  - **Expect:** Toast “Please enter a valid email address.”; no API call or failed create.
  - Enter a **valid email** and create.
  - **Expect:** Success toast; message should mention that a verification email was sent (from backend or fallback text).

---

## 4. Frontend: Collaborator invite – email format hint and search

**Goal:** Search only runs for valid email format; invalid format shows a hint.

- As a customer (or admin), open the **Invite Collaborator** flow (e.g. Collaborator management or proposal team).
  - Type an **invalid** string (e.g. `ab` or `x@`) in the email search field.
  - **Expect:** Message like “Please enter a valid email address to search.”; no (or no meaningful) search results.
  - Type a **valid** email (e.g. `someone@example.com`).
  - **Expect:** Search runs (results or “No collaborator found”); no format hint.

---

## 5. Public registration (existing flow)

**Goal:** Unchanged: user registers → verification email sent → user verifies via link → can log in.

- Open `/register`, submit with valid email and password.
- **Expect:** Redirect to verify-email-pending and message to check email.
- Without verifying: login should fail (403).
- After verifying via link: login should succeed.

---

## 6. Optional: Run RFP backend tests

The RFP auth tests in `tests/test_auth.py` register a user and then log in. With verification required, **login after register will now return 403** until the user is verified. So:

- Either update tests to call `POST /api/v1/auth/verify-email` with the token (you’d need to capture it from the verification flow or mock email), or
- Run tests and expect the login-after-register test to fail until you add a verify step.

To run:

```bash
cd /Volumes/japanpatel/Desktop/RFP
source venv/bin/activate
pytest tests/test_auth.py -v
```

If you see failures on “login after register”, add a verification step in the test (e.g. extract token from email send mock or from DB) and then login.

---

## Quick checklist

| Test | Where | What to check |
|------|--------|----------------|
| Admin creates user | UI + API | Success message mentions verification; login fails until verify |
| Verify-email link | API / email | POST verify-email with token → 200; then login works |
| CSV import invalid email | API / UI | Row in errors with “Invalid email format” |
| CSV import valid email | API | User created unverified; verification email sent |
| Admin dialog invalid email | UI | Toast “Please enter a valid email address.” |
| Admin dialog description | UI | Text about verification link sent |
| Collaborator invite invalid email | UI | Hint “Please enter a valid email address to search.” |
| Collaborator invite valid email | UI | Search runs, results or “No collaborator found” |
