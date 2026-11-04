/**
 * Resolve a human-readable sender name for chat notifications.
 *
 * REST sends pass the already-formatted message response (`senderName`),
 * while socket sends pass the Prisma message with a nested `sender`. Both
 * shapes must resolve to the same display name so cross-app notifications
 * never fall back to a generic "Someone".
 */
export function resolveChatSenderName(message: any): string {
  const sender = message?.sender;
  const fullName = [sender?.firstName, sender?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    message?.senderName ||
    sender?.businessProfile?.businessName ||
    fullName ||
    sender?.email?.split('@')[0] ||
    'Someone'
  );
}
