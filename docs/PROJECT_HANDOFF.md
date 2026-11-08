# MCOM Solutions project handoff

**Snapshot:** 2026-10-21  
**Purpose:** Give the next contributor a reliable starting point for this repository. The user is pausing this project while moving to another repo; this is a status snapshot, not a declaration that the product is complete.

## Product direction and source of truth

- The `dev` branch is the intended development experience and the source of truth for design approval. The customer dashboard design on this feature branch was approved as the design to develop.
- The manually deployed `centralhubsolution.com` customer dashboard was shown to differ from the local development design. The user did not approve that live variant. Do not use the live page as the design reference or copy it over the development UI.
- The customer dashboard was built in this repo because no customer dashboard previously existed. It is a frontend starter with explicit demo fixtures; it is not a claim that the backend integration is complete.
- Mobile-first responsive behavior matters across customer dashboard routes. Keep the UI readable on narrow screens, keep desktop dashboard navigation fixed while page content scrolls, and use clear pointer affordances on interactive controls. Avoid oversized decorative icon backgrounds; use compact icons or no icon where the color/background treatment adds noise.

## Current Git state

- Branch: `feat/customer-dashboard-design-default`
- Latest commit: `53a618f feat(auth): unify customer and business sign-in flows`
- Dashboard design commit in branch history: `f41bd17 feat(customer): make approved dashboard design canonical`
- Pull request: [#77](https://github.com/Synergyfy/McomSolutions/pull/77), open against `dev` as of this snapshot.
- The branch was clean after pushing PR #77. Do not assume the PR has merged; check GitHub before relying on a later status.

## Work completed in this branch

### Customer workspace

- Added the customer dashboard experience from scratch, based on the supplied customer workspace designs: Overview, MCOM Ecosystem, Wallet, Messages, Notifications, Profile, and Settings & Security.
- Added responsive layouts, customer sidebar/header navigation, profile dropdown, notification navigation, and sign-out placement. Billing was intentionally not added to the customer navigation because the supplied Billing screenshot belonged to the business dashboard and customer billing was not confirmed.
- Added local fixtures in `apps/frontend/src/data/customerDashboardMock.ts` for visual review. Fixture values are not real customer account, wallet, transaction, notification, or message data.
- The detailed backend data/API contract and current route findings are in [customer-dashboard-backend-handoff.md](customer-dashboard-backend-handoff.md). Treat “route exists in source” as code inspection only, not proof of deployment or runtime behavior.

### Authentication and signup changes in PR #77

- Redesigned `/login` as the universal CHS sign-in page for customers, businesses, partners, and teams, with responsive desktop/mobile layouts.
- The login page hides the welcome/headline/audience copy on mobile to keep the form focused. The “CHS account” pill was removed on all breakpoints.
- Customer signup no longer exposes the McomMall-specific sign-in mode/page. Its “Sign in” link points to the universal `/login` route while preserving safe SSO query parameters.
- Business onboarding’s initial Google business lookup page now includes “Already have an account? Sign in” to the same universal login route.
- These are frontend routing and presentation changes. They do not add backend authentication, Google OAuth configuration, demo credentials, or a local auth bypass.

## Important files

| Area | File | Notes |
|---|---|---|
| Route table and shared shells | `apps/frontend/src/App.tsx` | Check actual routing and navbar/footer behavior here. |
| Universal login | `apps/frontend/src/pages/LoginPage.tsx` | Shared sign-in page for supported account types. |
| Customer signup | `apps/frontend/src/pages/CustomerRegistration.tsx` | OTP and registration flow; sign-in goes to `/login`. |
| Business signup/onboarding | `apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx` | Large wizard; initial step now links to `/login`. |
| Customer dashboard fixtures | `apps/frontend/src/data/customerDashboardMock.ts` | Demo-only records used by customer screens. |
| Customer backend contract | `docs/customer-dashboard-backend-handoff.md` | API fields, existing routes, integration gaps, fixture boundary. |
| Backend remediation record | `REMEDIATION-PLAN.md` | Separate backend audit/remediation plan; verify each item against current source/status. |
| Private local context | `LOCAL_PROJECT_NOTES.md`, `claude.md` | Local-only notes; do not commit or send externally. |

## Backend handoff status

The customer dashboard handoff document is ready for backend review. Backend should confirm customer-role authorization and response schemas for identity/settings, wallet/top-ups/transactions, ecosystem catalog and launch, notifications, messages/support, profile/referrals, and account security. It also calls out frontend-visible items for which no confirmed backend contract was found.

Before integrating a displayed action, confirm the endpoint, role access, request/response schema, validation/error states, and whether it is deployed. In particular, do not represent fixture wallet balances, rewards, activity, unread counts, notifications, or conversation messages as real account data. Do not present payment gateways or security/profile actions as operational until their API lifecycle is confirmed.

## Local development

From the repository root:

```sh
npm run dev:frontend
npm run dev:backend
npm run dev
```

The frontend normally runs at `http://localhost:3000`; the backend API defaults to port `3010` with the `/api/v1` prefix. Backend startup needs valid local environment configuration, including database and JWT settings. Use `.env.example` as a template; never copy local secrets into docs or commits.

Useful build commands are `npm run build:frontend`, `npm run build:backend`, and `npm run build`. No tests or builds were run as part of this handoff snapshot.

## Before resuming this repository

1. Check the state of [PR #77](https://github.com/Synergyfy/McomSolutions/pull/77) and whether `dev` has moved since this snapshot.
2. If continuing customer dashboard integration, start with [customer-dashboard-backend-handoff.md](customer-dashboard-backend-handoff.md) and ask backend to confirm contracts before replacing fixtures.
3. If continuing auth work, review the current route table and backend auth/OAuth setup; the UI changes alone do not make sign-in functional when required backend configuration is missing.
4. Keep the customer dashboard development design as approved. Compare any deployed page against `dev` before attributing differences to the feature branch.
