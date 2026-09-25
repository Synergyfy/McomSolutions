import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessor } from './webhook.processor';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { getQueueToken } from '@nestjs/bullmq';
import { WEBHOOK_DISPATCH_DLQ } from '../queue/queue.constants';

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let dispatcher: jest.Mocked<Partial<WebhookDispatcherService>>;
  let dlqQueue: { add: jest.Mock };

  beforeEach(async () => {
    dispatcher = {
      dispatch: jest.fn(),
    };

    dlqQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessor,
        {
          provide: WebhookDispatcherService,
          useValue: dispatcher,
        },
        {
          provide: getQueueToken(WEBHOOK_DISPATCH_DLQ),
          useValue: dlqQueue,
        },
      ],
    }).compile();

    processor = module.get<WebhookProcessor>(WebhookProcessor);
  });

  it('should process job and dispatch with jobId and retryCount', async () => {
    (dispatcher.dispatch as jest.Mock).mockResolvedValue({
      dispatched: true,
      statusCode: 200,
    });

    const mockJob: any = {
      id: 'job-123',
      attemptsMade: 1,
      data: {
        platformIdentifier: 'links',
        event: 'package.created',
        data: { test: true },
      },
    };

    const result = await processor.process(mockJob);
    expect(result).toEqual({ dispatched: true, statusCode: 200 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'links',
      'package.created',
      { test: true },
      { jobId: 'job-123', retryCount: 1 },
    );
  });

  it('should throw error when dispatch fails', async () => {
    (dispatcher.dispatch as jest.Mock).mockResolvedValue({
      dispatched: false,
      statusCode: 500,
      error: 'HTTP 500 error',
    });

    const mockJob: any = {
      id: 'job-123',
      attemptsMade: 1,
      data: {
        platformIdentifier: 'links',
        event: 'package.created',
        data: {},
      },
    };

    await expect(processor.process(mockJob)).rejects.toThrow('HTTP 500 error');
  });

  it('should push to DLQ when job fails and attempts are exhausted', async () => {
    const mockJob: any = {
      id: 'job-999',
      attemptsMade: 5,
      opts: { attempts: 5 },
      data: {
        platformIdentifier: 'links',
        event: 'package.cancelled',
        data: {},
      },
    };

    const error = new Error('Permanent network timeout');
    await processor.onFailed(mockJob, error);

    expect(dlqQueue.add).toHaveBeenCalledWith(
      'dead-letter',
      expect.objectContaining({
        originalJobId: 'job-999',
        failedReason: 'Permanent network timeout',
        data: mockJob.data,
      }),
    );
  });
});
