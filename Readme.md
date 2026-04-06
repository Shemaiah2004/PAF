# Secure OAuth With Role-Based Authorization

This project now uses Spring Security session authentication instead of the insecure `X-Auth-User-Id` header.

## What changed

- `X-Auth-User-Id` was removed from protected API access.
- Local sign-in and Google sign-in now create a secure Spring Security session.
- Protected API calls from the React client now use `credentials: "include"`.
- The backend enforces authentication and admin-only access through Spring Security.
- The current user session is restored through `GET /api/auth/me`.
- Sign-out is handled through `POST /api/auth/signout`.
- Role request SSE updates now use the authenticated session instead of a client-supplied `userId`.
- User roles are refreshed from MongoDB on each request so role changes take effect without trusting stale client data.

## Protected access rules

- Public:
  - `GET /api/auth/config`
  - `POST /api/auth/signup`
  - `POST /api/auth/signin`
  - `POST /api/auth/google`
- Authenticated:
  - `GET /api/auth/me`
  - `POST /api/auth/signout`
  - My role request endpoints
  - Role request SSE stream
- Admin only:
  - `GET /api/users`
  - `PATCH /api/users/{id}/role`
  - Admin role request review endpoints

## Security details

- Spring Security session cookie:
  - HttpOnly
  - SameSite=Lax
  - 30 minute session timeout
- Session IDs are rotated on sign-in to reduce session fixation risk.
- API responses now return JSON `401` and `403` messages for unauthorized and forbidden access.

## Verification

- Backend tests: `server\\mvnw.cmd test`
- Frontend build: `npm run build` inside `client`
