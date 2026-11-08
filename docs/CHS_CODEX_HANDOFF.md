# CHS Codex Handoff

**Snapshot:** 2026-10-29 (Africa/Lagos)  
**Repository:** `/home/davestack/Documents/McomSolutions`  
**Scope:** CHS / McomSolutions only

## Current Git snapshot (verified locally)

- Branch: `feat/access-options-onboarding`
- HEAD: `e77d115fbf088f0494fae00d09199ff8872354f2` — `feat(access): integrate Rewards passes in onboarding`
- The branch tracks `origin/feat/access-options-onboarding`; local ahead/behind count is `0/0`.
- The local `origin/dev` ref is `ad196be` (`Merge pull request #84 from Synergyfy/feat/access-options-onboarding`) and contains `e77d115`.
- These are local Git/remote-tracking facts. No fetch was performed, so this does not verify whether GitHub has advanced since the refs were last refreshed.
- Working tree before creating this handoff:

  ```text
   M apps/frontend/src/components/payment/VerificationPaymentModal.tsx
   M apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx
  ?? apps/frontend/src/components/payment/VerificationPaymentModal.css
  ?? apps/frontend/src/pages/getstarted/BusinessOnboardingAccess.css
  ?? docs/AI_CONTINUATION_HANDOFF.md
  ?? docs/PROJECT_HANDOFF.md
  ```

  Preserve these existing edits and untracked files. No backend files were modified in the current working tree. This handoff is an additional new file.

## What the work was trying to accomplish

The CHS Business Success Programme onboarding UI was being extended to offer Trial, Access Pass, and Membership paths. The Access Pass path was intended to show plans configured by MCOM Rewards and let a business continue through a supported pass purchase/entitlement flow. The frontend also has local edits to the verification payment and access-choice styling; keep them intact.

## `e77d115` backend changes (verified from commit)

The commit added a direct CHS-to-Rewards pass-catalogue connector and frontend endpoint:

- `apps/backend/src/service-connectors/connectors/mcom-rewards.connector.ts`: reads `MCOM_REWARDS_API_URL` and `MCOM_REWARDS_API_KEY`, and requests Rewards `/access-passes/plans`.
- `apps/backend/src/service-connectors/service-connectors.service.ts`: exposes the connector call.
- `apps/backend/src/access/access.controller.ts`: adds authenticated `GET /api/v1/access/rewards-passes`.
- `apps/backend/src/access/access.module.ts`: imports the connector module.
- `apps/backend/src/service-connectors/connectors/mcom-rewards.connector.spec.ts`: connector tests.
- `apps/backend/src/common/filters/all-exceptions.filter.ts`: adds internal exception logging.
- It also changes frontend onboarding and payment files: `apps/frontend/src/pages/getstarted/BusinessOnboarding.tsx`, `apps/frontend/src/services/access/hooks.ts`, `apps/frontend/src/services/access/index.ts`, `apps/frontend/src/components/payment/AccessPassPaymentModal.tsx`, and `apps/frontend/src/components/payment/MembershipPaymentModal.tsx`.

## Azeem/PM request and what has happened

**Conversation record:** Azeem/PM objected that Rewards passes must not be fetched through the direct integration, emphasized that the Console was designed for this integration, and asked for the change to be reverted. The user agreed not to make backend changes and expected Azeem to revert and push, after which the user would pull and align with the intended infrastructure.

**Current local Git evidence:** `e77d115` has not been reverted in the checked-out history. The feature branch and its local upstream ref both point to it, and the local `origin/dev` ref includes PR #84 merging this branch. Thus the earlier expectation that Azeem would revert and push is not reflected in the current local remote-tracking snapshot. Because no fetch was performed, the live GitHub state may differ.

**Next agreed steps:** Do not attempt a local revert, reset, new push, or additional integration. First ask Azeem/PM to clarify the discrepancy and confirm the authoritative branch/commit and intended revert/repair path. After the owner pushes the agreed correction, inspect and pull that change only under the user's direction, then implement through the approved Console design if a frontend task remains.

## Console design and why not to bypass it

The CHS Admin Console's application configuration includes an **Access Pass Plans Endpoint**, alongside service base URL, scopes, allowed callers, and audiences. The owner explicitly said this Console is the intended integration mechanism. A direct env-based Rewards connector bypasses that centrally managed endpoint and service-access policy. Do not add another direct integration or assume a new contract; have the Console/backend owner explain the authoritative flow.

## Restrictions and next safe action

- Work in CHS only. Do not inspect or modify `/home/davestack/Documents/McomReward` for this handoff.
- **No backend changes:** do not edit backend source, add endpoints, alter schemas or database records, run migrations, or bypass Console-managed integration.
- Preserve all existing modified/untracked files. Do not reset, clean, revert, commit, push, or open/update a PR unless the user explicitly authorizes that specific action.
- Do not expose environment secrets in chat, docs, commits, or GitHub messages.
- Safest next action: show Azeem/PM the verified local branch/ref discrepancy and ask which pushed commit should be treated as authoritative. Make no repository changes until clarified.

**All backend changes are prohibited going forward unless explicitly authorized by the user for a specific task.**
