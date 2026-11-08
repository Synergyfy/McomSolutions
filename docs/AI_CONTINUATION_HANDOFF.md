# McomSolutions — AI Continuation Handoff

**Snapshot date:** 2026-10-21 (Africa/Lagos)  
**Repository:** `/home/davestack/Documents/McomSolutions`  
**Product:** Central Hub Solution (CHS) / McomSolutions  
**Purpose:** Give a fresh assistant the project boundaries, user decisions, implementation history, current uncommitted state, and the next checks without requiring the user to repeat the conversation.

> Start here when continuing this project. This handoff summarizes the current local checkout and relevant work discussed with the user. Verify Git and files before making changes; the worktree currently contains uncommitted edits.

## 1. Project boundary — do not mix repositories

The active project is **McomSolutions**, a CHS monorepo. The user temporarily worked in a separate product/repository called **McomReward** and then returned to this repository. Treat them as independent products with separate Git state, routes, design decisions, and backend contracts.

- Current repository: McomSolutions, `https://github.com/Synergyfy/McomSolutions.git`.
- Current local branch: `feat/customer-dashboard-design-default`.
- Separate repo McomReward: `/home/davestack/Documents/McomReward`; its signup/login work is not part of McomSolutions. At the last observed state, it was on `codex/mcomreward-signup-login-design`, based on its fetched `origin/dev`, with uncommitted UI edits and user-provided images. Do not copy its files into this repository.
- The user's current priority is CHS/McomSolutions. They may return to McomReward later.

## 2. User's working preferences and product decisions

- The user supplies visual references and expects the implementation to follow them closely. Be direct about what was changed and inspect the actual current project before proposing paths or behavior.
- **Mobile is the priority** for responsive work, but desktop layouts must also be handled where requested.
- The user does not want to be made responsible for routine UI cleanup. Make reasonable implementation choices, preserve product flows, and report material constraints clearly.
- Keep all CHS work separate from McomReward. Never import McomReward assumptions, API routes, or visuals into CHS unless the user explicitly requests it.
- Customer dashboard development design is the approved design source. The manually deployed customer dashboard on `centralhubsolution.com` was shown to differ; the user did not approve that live variant. Do not copy that live variant over the local development experience.
- Customer dashboard billing is unconfirmed and must not appear as a customer navigation item. A supplied Billing screenshot was from the business dashboard.
- Customer dashboard visuals may use demo fixtures for review, but clearly distinguish those from backend-backed behavior.
- Do not bypass real authentication in production. A local-only preview mechanism exists for the customer dashboard; it is not a fake logged-in customer or production auth solution.

## 3. Current Git and worktree state

Observed at snapshot:

```text
Branch: feat/customer-dashboard-design-default
HEAD:   53a618f feat(auth): unify customer and business sign-in flows
PR:     #77 against dev (was open at the previous snapshot; check its live status)
```

The branch was believed to track `origin/feat/customer-dashboard-design-default`; check `git status -sb` before assuming remote parity. `dev` was previously recorded as 19 commits behind its origin, so do not assume the local `dev` branch is current.

### Uncommitted work already present — preserve it

Do not discard, overwrite, or casually stage unrelated files. At the time of this snapshot:

```text
 M apps/frontend/src/hooks/useCategoryData.ts
 M apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx
?? apps/backend/scripts/bootstrap-local-admin.ts
?? apps/frontend/src/hooks/useCategoryData.test.ts
?? apps/frontend/src/pages/getstarted/BusinessCategorySelectors.test.tsx
?? apps/frontend/src/pages/getstarted/BusinessCategorySelectors.tsx
?? apps/frontend/src/pages/getstarted/businessOnboardingAuth.test.ts
?? apps/frontend/src/pages/getstarted/businessOnboardingAuth.ts
?? docs/PROJECT_HANDOFF.md
```

These edits existed in the shared worktree before this handoff request. They have not been committed by the current handoff task. `docs/PROJECT_HANDOFF.md` is an existing untracked note and was left untouched; this document is the expanded continuation handoff.

The untracked `bootstrap-local-admin.ts` script validates loopback host, expected database name, non-production `NODE_ENV`, prompts for credentials without echoing the password, and creates a local admin. It was not run. Inspect it and its usage requirements before execution; never use it against production or put credentials in docs.

## 4. Customer dashboard — what was built and what is mocked

There was no customer dashboard in CHS, so a customer workspace was built from scratch in `apps/frontend/src/pages/CustomerDashboard.tsx` using the user's supplied mockup references. It includes:

- Overview
- MCOM Ecosystem
- My Wallet
- Messages & Support
- Notifications
- Customer Profile
- Settings & Security

It has customer-specific navigation, header/profile dropdown, notification link from both sidebar and header, bottom-positioned sign out, responsive behavior, and the fixed desktop dashboard shell. No Billing link is included.

### Fixture/data distinction (important)

The customer workspace currently uses local demo data from:

- `apps/frontend/src/data/customerDashboardMock.ts`
- `apps/frontend/src/pages/CustomerDashboard.tsx`

The dashboard sets `customerPreview = true` and renders fixture-based identity, wallet balance, loyalty points, app catalog/highlights, transactions, notifications, and sample conversations/messages. This is for visual/UI review only; it is not real account information or evidence of a connected API.

`apps/frontend/src/components/auth/ProtectedCustomerRoute.tsx` allows a **development-only** UI preview when localStorage key `chs_customer_dashboard_preview` equals `true`. The condition is guarded by `import.meta.env.DEV`. It bypasses the route guard for preview only; it does not create an authenticated session or permit production access. Never replace this with hard-coded demo auth or widen it to production.

The original frontend-to-backend handoff is `docs/customer-dashboard-backend-handoff.md`. It lists required UI data, routes located in the checked-out backend, gaps to confirm, and the fixture boundary. Its claims are based on repository inspection; an endpoint in source is not proof it is deployed or reachable.

## 5. Backend developer response and API status

After the frontend handoff was sent, the backend developer supplied a separate 936-line report at:

```text
/home/davestack/Downloads/customer-dashboard-backend-handoff.md
```

This is the backend developer's response/implementation report, not the original frontend handoff. It references branch `feat/customer-backend-integration`, commit `548b3fb`, and API paths relative to `/api/v1`. Do not confuse it with the much shorter `docs/customer-dashboard-backend-handoff.md` in this repo.

At inspection, local remote-tracking ref `origin/feat/customer-backend-integration` existed and contained commit `548b3fb` plus a later frontend commit `a8d7c45` that wired the **overview only** to wallet, apps, and messages. Those commits were not present on the user's active design branch at that time. Re-fetch/check before relying on that status.

The developer's report says:

- Customer authentication remains the ordinary auth flow; protected routes need a valid `CUSTOMER` access token.
- New/extended backend work includes customer profile (`GET/PATCH /customer/profile`), notification filters/unread count, and PayPal wallet top-up support.
- Existing customer-usable routes include auth, wallet/transactions, chat, referrals, apps, and SSO.
- Some design features remain unavailable (for example true 2FA enrollment, SMS preferences, account deletion, statement export, and some tier/local-offer/SSO account functions).

Important: a pushed backend branch is not automatically running locally, and a report does not prove deployment, environment configuration, or successful end-to-end behavior. Verify with the backend developer which commit is merged/deployed, which API URL to use, and how to obtain a valid customer token. Current customer screens still use fixtures unless code is explicitly changed to consume API hooks.

## 6. Business onboarding Steps 6, 7, and 8 — avoid mislabeling them as mock records

The user specifically noted that a new assistant did not understand sample data versus onboarding work. Keep these separate:

### Step 6 — Category Selection

- In `apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx`, the visible step is identified as `currentQuest.id === 'category'` and titled `Category Selection`.
- In the current uncommitted work, sector/category/subcategory selections were extracted into `BusinessCategorySelectors.tsx` and are sourced from the existing catalog queries in `apps/frontend/src/hooks/useCategoryData.ts` (`/sectors`, `/categories?sectorId=…`, `/subcategories?categoryId=…`).
- The uncommitted change removes development-time fallback to static `SECTORS`, `CATEGORIES`, and `SUBCATEGORIES` for this step. It now displays loading/error/empty states and prevents proceeding unless selected IDs exist in the loaded catalog and have valid parent relationships.
- `apps/frontend/src/data/sectors.ts` still contains static catalog-shaped data, but the current dirty BusinessOnboarding edit no longer uses those arrays as Step 6 fallback. Do not call Step 6 sample data without checking the current version.

### Step 7 — Operating Hours

- The form presents choices: Standard Hours (Mon–Fri 09:00–17:00), Open 24/7, or Custom Setup with per-day open/close times.
- These are user-selectable form options/state, not seeded customer/business accounts or dashboard demo records. On final submission the UI serializes the selected schedule into the onboarding payload's `openingHours` value.
- The business may choose custom hours; the schedule isn't presented as an API catalogue of sample businesses.

### Step 8 — Delivery & Pickup / fulfilment

- For a product listing the form lets the user choose `pickup`, `local_delivery`, and/or `uk_shipping` (`Click & Collect`, `Local Delivery`, `National Shipping`).
- These are selectable onboarding form values, not mock transaction/customer data. Product listing submission places them in `productSellerProfile.sellingModes`, defaulting to `['pickup']` if none are selected.
- Other business-type branches have their own service settings (for example booking preferences/service zones), also collected as onboarding form state.

### Other onboarding work currently uncommitted

- `businessOnboardingAuth.ts` extracts signup email-availability checks, duplicate email detection, and API error message normalization.
- The current BusinessOnboarding edits now fail closed if email availability cannot be checked; duplicate registration errors no longer attempt to silently log in with the entered password. Errors use clearer fallbacks.
- These changes may affect signup behavior; review and preserve their intent. They are not part of the customer-dashboard fixtures.
- Test files were added for catalog queries, category selectors, and signup auth helpers. They are present but should not be assumed to have passed unless actually run.

## 7. Authentication, signup, and local dashboard access

- `/login` is intended to be the universal CHS sign-in route for customers, businesses, partners, and teams.
- `/signup` role selection and `/getstarted/business` routing belong to CHS signup/onboarding. Customer registration uses its customer registration route; business onboarding remains in `BusinessOnboarding.tsx`.
- The user's historical login error traced to backend environment validation at startup. The frontend cannot make a backend with invalid/missing DB/JWT/configuration accept login.
- The user previously requested a way to get past login for customer dashboard visual review. Use only the development-only preview flag described above; do not invent credentials or bypass production authentication.
- `bootstrap-local-admin.ts` is a separate untracked local-admin tool; it does not create a customer and does not implement an auth bypass.

## 8. Other CHS work and design history that matters

- Business dashboard visual redesign discussions were about making the dashboard easier to scan and keeping `Today's Tasks` and `Support` cards in two columns where requested. Business dashboard routing/layout lives separately from customer dashboard.
- The user asked which dashboards had been redesigned: Business and Customer. There is also an Admin dashboard in the broader app, but it was not the customer dashboard project and no admin redesign should be inferred.
- Customer design choices explicitly included: compact meaningful icons; avoid colored icon backgrounds when the icon itself conveys color; table presentation must work well on mobile; fixed desktop sidebar and header while the content scrolls; sign-out at the bottom of the customer sidebar; remove unconfirmed Billing.
- Responsive behavior and clickable pointer affordance were reviewed across customer routes. Do not claim a complete quality audit for new changes without actually reviewing them.
- Customer profile and notification pages were added from user references. Notifications should be reachable from both sidebar navigation and the header bell; selecting either goes to the same page.
- Customer settings controls were adjusted to look like proper toggles. Do not advertise nonfunctional preferences as backend-connected.
- A temporary green “live sync” pill in customer messages was removed per the user's instruction.
- Signup/login UI work in McomReward is separate and must not be attributed to CHS.

## 9. Source map

| Concern | Main files |
|---|---|
| Frontend route table and shells | `apps/frontend/src/App.tsx` |
| Customer workspace pages and mock interactions | `apps/frontend/src/pages/CustomerDashboard.tsx` |
| Customer dashboard demo fixtures | `apps/frontend/src/data/customerDashboardMock.ts` |
| Customer route guard / development preview | `apps/frontend/src/components/auth/ProtectedCustomerRoute.tsx` |
| Customer dashboard responsive styling | `apps/frontend/src/index.css` (search `.customer-dashboard-ui`) |
| Frontend-to-backend customer handoff | `docs/customer-dashboard-backend-handoff.md` |
| Backend developer response (downloaded, not same file) | `/home/davestack/Downloads/customer-dashboard-backend-handoff.md` |
| Business onboarding wizard | `apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx` |
| Catalog query hooks | `apps/frontend/src/hooks/useCategoryData.ts` |
| Category form selector (untracked current work) | `apps/frontend/src/pages/getstarted/BusinessCategorySelectors.tsx` |
| Category/catalog static type/data file | `apps/frontend/src/data/sectors.ts` |
| Signup error helpers (untracked current work) | `apps/frontend/src/pages/getstarted/businessOnboardingAuth.ts` |
| Customer auth/API contracts | `apps/frontend/src/services/auth`, `apps/frontend/src/services/wallet`, `apps/frontend/src/services/chat`, `apps/frontend/src/services/notification` |
| Local admin script (untracked; not run) | `apps/backend/scripts/bootstrap-local-admin.ts` |
| Previous project snapshot | `docs/PROJECT_HANDOFF.md` (currently untracked; preserve) |
| Backend remediation tracking | `REMEDIATION-PLAN.md` |

## 10. Running CHS locally

From repository root:

```bash
npm run dev:frontend
npm run dev:backend
# or both through the root script
npm run dev
```

- Frontend normally uses `http://localhost:3000`.
- Backend normally uses port `3010` with `/api/v1`.
- Backend startup depends on local env configuration (database, JWT and other required settings); check `.env.example` and `apps/backend` docs. Do not expose secrets in chat or handoff notes.
- The user does not own backend environment changes and has explicitly said backend configuration is outside their jurisdiction. Diagnose clearly and prepare questions for the backend developer rather than silently changing backend config.
- Customer dashboard visual preview can be entered through its local-only development preview flag if necessary. This is not equivalent to validating auth or APIs.

## 11. Known gaps and guardrails

- Do not assume dashboard APIs are integrated merely because the API report exists.
- Do not use fixture data as actual customer account content.
- Do not assume a customer endpoint exists just because a business endpoint exists.
- Do not imply settings such as SMS, real 2FA, connected SSO providers, account deletion, or statement export work until backend confirms and frontend implements them.
- Do not advertise a wallet gateway as functional until its initiation, return, confirmation, failure, and receipt lifecycle is verified.
- Do not let a developer-only preview mechanism reach a production build.
- Do not discard the uncommitted BusinessOnboarding/catalog work or local admin helper without asking/understanding the intent.
- Do not commit, push, open/merge a PR, run destructive DB actions, or alter environment secrets unless requested or already authorized in the active conversation.

## 12. Suggested next steps for the new chat

1. Read this file, then inspect `git status -sb` and preserve all listed uncommitted work.
2. Confirm with the user whether the immediate task is (a) review the uncommitted Steps 6–8/auth changes, (b) integrate customer dashboard APIs, or (c) continue another CHS task. Do not assume the McomReward project is active.
3. If reviewing the onboarding changes, trace wizard step IDs and payloads end-to-end. Specifically verify Step 6 catalog response shapes and the Step 7/8 submission fields; distinguish form choices from mock dashboard fixtures.
4. If integrating dashboard APIs, compare the backend developer's report with the latest branch/commit and running API. Confirm auth and response envelopes first; then replace fixtures incrementally while preserving the approved UI.
5. Check PR #77 and fetch relevant remotes before proposing branch synchronization or claiming a PR status.
6. Do not run tests/builds unless asked to verify, or unless the task explicitly requires a check under current instructions. Test files in the worktree are not proof they passed.

## 13. Handoff status

This file documents the project and current state; it does not mark the customer dashboard as backend-integrated or the onboarding wizard as fully reviewed. No files other than this handoff were changed for the handoff request. Existing tracked/untracked work remains as observed.
