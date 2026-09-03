import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { encrypt } from '../console/crypto.util';
import axios from 'axios';
import * as crypto from 'crypto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;
  let prisma: any;
  const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const PLAIN_SECRET = 'wh_test_secret_1234567890abcdef';
  const ENCRYPTED_SECRET = encrypt(PLAIN_SECRET, ENCRYPTION_KEY);

  const mockClient = {
    id: 'client-uuid-1',
    clientId: 'mcom-links',
    platformSlug: 'links',
    webhookUrl: 'http://localhost:3002/api/v1/mcom/webhook',
    webhookSecret: ENCRYPTED_SECRET,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = {
      ssoClient: {
        findFirst: jest.fn().mockResolvedValue(mockClient),
        update: jest.fn().mockResolvedValue({}),
      },
      appWebhookLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-cuid-123' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'CONSOLE_ENCRYPTION_KEY') return ENCRYPTION_KEY;
        if (key === 'NODE_ENV') return 'test';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDispatcherService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<WebhookDispatcherService>(WebhookDispatcherService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return APP_NOT_FOUND when client does not exist', async () => {
    prisma.ssoClient.findFirst.mockResolvedValue(null);

    const result = await service.dispatch('unknown-app', 'test.event', { foo: 'bar' });
    expect(result).toEqual({ dispatched: false, reason: 'APP_NOT_FOUND' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should return NO_WEBHOOK_URL_CONFIGURED when client has no webhookUrl', async () => {
    prisma.ssoClient.findFirst.mockResolvedValue({ ...mockClient, webhookUrl: null });

    const result = await service.dispatch('links', 'test.event', { foo: 'bar' });
    expect(result).toEqual({ dispatched: false, reason: 'NO_WEBHOOK_URL_CONFIGURED' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should deliver webhook with valid HMAC signature and record delivery in AppWebhookLog', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { received: true },
    } as any);

    const payloadData = {
      packageId: 'pkg-1',
      mcomUserId: 'user-1',
      externalPlanId: 'plan-pro',
      packageName: 'Pro Plan',
    };

    const result = await service.dispatch('links', 'package.created', payloadData);

    expect(result.dispatched).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.logId).toBe('log-cuid-123');

    // Verify axios was called with the correct URL, headers, and signature
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [callUrl, callBody, callConfig] = mockedAxios.post.mock.calls[0];

    expect(callUrl).toBe('http://localhost:3002/api/v1/mcom/webhook');
    expect(callConfig?.headers?.['Content-Type']).toBe('application/json');

    const signature = callConfig?.headers?.['X-Mcom-Webhook-Signature'];
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);

    // Verify HMAC calculation
    const expectedHash = crypto
      .createHmac('sha256', PLAIN_SECRET)
      .update(callBody as string)
      .digest('hex');
    expect(signature).toBe(`sha256=${expectedHash}`);

    // Verify parsed body structure
    const parsed = JSON.parse(callBody as string);
    expect(parsed.event).toBe('package.created');
    expect(parsed.platform).toBe('links');
    expect(parsed.data).toEqual(payloadData);

    // Verify AppWebhookLog creation
    expect(prisma.appWebhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'mcom-links',
        event: 'package.created',
        statusCode: 200,
        failed: false,
      }),
    });

    // Verify SsoClient lastWebhookAt update
    expect(prisma.ssoClient.update).toHaveBeenCalledWith({
      where: { id: 'client-uuid-1' },
      data: expect.objectContaining({
        webhookFailCount: 0,
      }),
    });
  });

  it('should retry up to 3 times on failure and log the failure', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 500,
      data: 'Internal Server Error',
    } as any);

    const result = await service.dispatch('links', 'package.created', {});

    expect(result.dispatched).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(mockedAxios.post).toHaveBeenCalledTimes(3);

    expect(prisma.appWebhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'mcom-links',
        event: 'package.created',
        statusCode: 500,
        failed: true,
      }),
    });

    expect(prisma.ssoClient.update).toHaveBeenCalledWith({
      where: { id: 'client-uuid-1' },
      data: expect.objectContaining({
        webhookFailCount: { increment: 1 },
      }),
    });
  });

  it('should format dispatchPackageEvent and invoke dispatchAsync', async () => {
    const dispatchSpy = jest.spyOn(service, 'dispatch').mockResolvedValue({ dispatched: true });

    await service.dispatchPackageEvent('package.created', {
      platform: 'links',
      userId: 'usr-123',
      package: {
        id: 'pkg-456',
        externalPlanId: 'plan-xyz',
        packageName: 'Pro',
        planType: 'STANDARD',
        status: 'active',
        billingCycle: 'monthly',
        amount: 29.99,
        currency: 'GBP',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        limits: { maxLinks: 50 },
      },
    });

    // Wait for setImmediate
    await new Promise((resolve) => setImmediate(resolve));

    expect(dispatchSpy).toHaveBeenCalledWith(
      'links',
      'package.created',
      expect.objectContaining({
        packageId: 'pkg-456',
        mcomUserId: 'usr-123',
        externalPlanId: 'plan-xyz',
        packageName: 'Pro',
        planType: 'STANDARD',
        status: 'active',
        billingCycle: 'monthly',
        amount: 29.99,
        currency: 'GBP',
        expiresAt: '2026-10-01T00:00:00.000Z',
        limits: { maxLinks: 50 },
      }),
    );
  });
});
