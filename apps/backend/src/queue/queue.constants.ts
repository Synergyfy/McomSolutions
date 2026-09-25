export const WEBHOOK_DISPATCH_QUEUE = 'webhook-dispatch';
export const WEBHOOK_DISPATCH_DLQ = 'webhook-dispatch-dlq';

export interface WebhookJobData {
  platformIdentifier: string;
  event: string;
  data: Record<string, unknown>;
}
