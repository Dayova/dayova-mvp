# Own contact consent independently of authentication

Accepted for [DAY-550](https://linear.app/dayova/issue/DAY-550). Product rationale: [Notion decision record](https://app.notion.com/p/4002e87228bf81579c64efd6ed0af17f) (initially a private draft).

Convex owns explicit, versioned contact choices and their server-timestamped history. Neither a legacy phone number nor Clerk metadata is consent. Feedback invitations through WhatsApp plus feedback calls, and WhatsApp product news, are separate purposes with no default selection. The shared versioned wording lives in `src/lib/contact-preferences.ts`; keep historical wording when introducing a new version.

Onboarding stages the normalized choice in its encrypted, account-bound recovery outbox and imports it only when no contact decision exists. A retry cannot undo a later withdrawal. Settings use a revision check to reject stale grants; unconditional withdrawal serializes against grants. No purpose selected means no current contact number. Changing the number resets both choices in the UI. The full snapshot, its source and timestamp are recorded transactionally; account deletion removes the bounded history in the existing deletion worker.

Notion is an asynchronous operational projection, not the authorization source. Separate `App Contact …` properties preserve manual phone numbers and circle/beta classifications. A current text version, a granted purpose and its corresponding app contact number are all necessary for contact. Account cleanup clears these app-owned properties even though legacy CRM contact history is retained. There is no sender in this change; any future sender must check Convex immediately before sending rather than trust a cached Notion checkbox.

The existing identified-only analytics boundary remains. Onboarding version 4 records only `contact_choice` (`skipped`, `feedback`, `news`, `both`) after backend-confirmed completion. This describes completed registrations; it cannot measure anonymous pre-registration abandonment or prove that personal outreach causes retention.
