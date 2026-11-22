/**
 * Event name fanned out to apps that are bundled in a purchased membership.
 *
 * One event type covers the whole lifecycle; consumers branch on
 * `data.membership.status` (`active`, `inactive`, `expired`, `cancelled`).
 */
export const MEMBERSHIP_UPDATED_EVENT = 'membership.updated';
