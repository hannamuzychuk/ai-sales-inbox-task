# Submission

## Assumptions

- Client-sent `status` on `POST /api/leads` is ignored; the server always persists `NEW`.
- Empty `material` strings are normalized to `null`.
- Re-running Extract with AI only fills currently empty form fields, so manual edits are preserved.
- Invalid status transitions return `409`; unknown leads return `404`.

## AI usage

Cursor (Composer) for implementation, local verification, and tests.

## Verification

Verified the empty-field merge rule for Extract with AI: after manually changing Product, a second extract keeps that value and only fills blank fields.
