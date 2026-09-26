export const WEBHOOK_DISPATCH_QUEUE = 'webhook-dispatch';
export const WEBHOOK_DISPATCH_DLQ = 'webhook-dispatch-dlq';

export const TASK_EVENT_QUEUE = 'task-event';
export const TASK_REWARD_QUEUE = 'task-reward';

export interface WebhookJobData {
  platformIdentifier: string;
  event: string;
  data: Record<string, unknown>;
}

export interface TaskEventJobData {
  userId: string;
  userType: 'BUSINESS' | 'CUSTOMER';
  featureKey: string;
  meta?: Record<string, unknown>;
}

export interface TaskRewardJobData {
  assignmentId: string;
  userId: string;
  rewardPoints: number;
  taskTitle: string;
}
