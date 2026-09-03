import { HttpException, HttpStatus } from '@nestjs/common';
import { GenericHttpConnector } from './generic-http.connector';

jest.mock('axios');

import axios from 'axios';

const mockInstance = {
  post: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

const client = {
  name: 'Mcom vCard',
  apiKey: 'ak_test_123',
  billingApiUrl: 'https://api.vcard.mcom.com',
};

describe('GenericHttpConnector', () => {
  let connector: GenericHttpConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockInstance);
    (axios.isAxiosError as unknown as jest.Mock).mockImplementation(
      (e: any) => !!e?.isAxiosError,
    );
    connector = new GenericHttpConnector(client);
  });

  it('should expose the platform name', () => {
    expect(connector.platform).toBe('Mcom vCard');
  });

  describe('createPlan', () => {
    it('should POST /system/plans and return the plan', async () => {
      const plan = { id: 'p1', name: 'Starter' };
      mockInstance.post.mockResolvedValue({ data: plan });
      const result = await connector.createPlan({ name: 'Starter' } as any);
      expect(mockInstance.post).toHaveBeenCalledWith('/system/plans', { name: 'Starter' });
      expect(result).toEqual(plan);
    });

    it('should unwrap data.data if wrapped in an envelope', async () => {
      const plan = { id: 'p1', name: 'Starter' };
      mockInstance.post.mockResolvedValue({ data: { success: true, data: plan } });
      const result = await connector.createPlan({ name: 'Starter' } as any);
      expect(result).toEqual(plan);
    });
  });

  describe('getPlans', () => {
    it('should return the array directly when data is an array', async () => {
      const plans = [{ id: 'p1' }];
      mockInstance.get.mockResolvedValue({ data: plans });
      const result = await connector.getPlans();
      expect(result).toEqual(plans);
    });

    it('should unwrap data.data when the API wraps the list', async () => {
      mockInstance.get.mockResolvedValue({ data: { data: [{ id: 'p1' }] } });
      const result = await connector.getPlans();
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  describe('getPlanById', () => {
    it('should return bare plan directly', async () => {
      const plan = { id: 'p1', name: 'Pro Plan' };
      mockInstance.get.mockResolvedValue({ data: plan });
      const result = await connector.getPlanById('p1');
      expect(mockInstance.get).toHaveBeenCalledWith('/system/plans/p1');
      expect(result).toEqual(plan);
    });

    it('should unwrap data.data when the API wraps the plan object', async () => {
      const plan = { id: 'p1', name: 'Pro Plan' };
      mockInstance.get.mockResolvedValue({ data: { success: true, data: plan } });
      const result = await connector.getPlanById('p1');
      expect(result).toEqual(plan);
    });
  });

  describe('updatePlan', () => {
    it('should PATCH /system/plans/:id and return the plan', async () => {
      const plan = { id: 'p1', name: 'Updated Plan' };
      mockInstance.patch.mockResolvedValue({ data: plan });
      const result = await connector.updatePlan('p1', { name: 'Updated Plan' } as any);
      expect(mockInstance.patch).toHaveBeenCalledWith('/system/plans/p1', { name: 'Updated Plan' });
      expect(result).toEqual(plan);
    });

    it('should unwrap data.data when the API wraps the updated plan object', async () => {
      const plan = { id: 'p1', name: 'Updated Plan' };
      mockInstance.patch.mockResolvedValue({ data: { success: true, data: plan } });
      const result = await connector.updatePlan('p1', { name: 'Updated Plan' } as any);
      expect(result).toEqual(plan);
    });
  });

  describe('getPlanSchema', () => {
    it('should return the schema unwrapped from the envelope', async () => {
      const schema = {
        quotas: [{ key: 'maxVCards', label: 'Max VCards', type: 'number', unlimited: true }],
        featureFlags: [{ key: 'allowNfc', label: 'Allow NFC', type: 'boolean' }],
      };
      mockInstance.get.mockResolvedValue({ data: { data: schema, success: true } });
      const result = await connector.getPlanSchema();
      expect(mockInstance.get).toHaveBeenCalledWith('/system/plans/schema');
      expect(result).toEqual(schema);
    });

    it('should accept a bare schema body (no envelope)', async () => {
      const schema = {
        quotas: [{ key: 'maxVCards', label: 'Max VCards', type: 'number', unlimited: true }],
        featureFlags: [],
      };
      mockInstance.get.mockResolvedValue({ data: schema });
      const result = await connector.getPlanSchema();
      expect(result).toEqual(schema);
    });

    it('should return null when the service returns 404 (no schema endpoint)', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 404, data: { message: 'Not found' } },
      };
      mockInstance.get.mockRejectedValue(apiError);
      const result = await connector.getPlanSchema();
      expect(result).toBeNull();
    });

    it('should return null on network failure without throwing', async () => {
      const networkError = { isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' };
      mockInstance.get.mockRejectedValue(networkError);
      const result = await connector.getPlanSchema();
      expect(result).toBeNull();
    });

    it('should call the custom planSchemaEndpoint when provided', async () => {
      connector = new GenericHttpConnector({
        ...client,
        planSchemaEndpoint: 'https://schema.vcard.mcom.com/plans',
      });
      const schema = { quotas: [], featureFlags: [{ key: 'allowNfc', label: 'NFC', type: 'boolean' }] };
      (axios.get as jest.Mock).mockResolvedValue({ data: schema });
      const result = await connector.getPlanSchema();
      expect(axios.get).toHaveBeenCalledWith(
        'https://schema.vcard.mcom.com/plans',
        expect.objectContaining({ timeout: 8000 }),
      );
      expect(result).toEqual(schema);
    });
  });

  describe('error handling', () => {
    it('should throw HttpException(502) with informative message on network failure', async () => {
      const networkError = { isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' };
      mockInstance.get.mockRejectedValue(networkError);
      await expect(connector.getPlans()).rejects.toThrow(
        new HttpException(
          'Unable to reach Mcom vCard (service offline or unreachable).',
          HttpStatus.BAD_GATEWAY,
        ),
      );
    });

    it('should throw Gateway Timeout (504) on timeout', async () => {
      const timeoutError = { isAxiosError: true, code: 'ETIMEDOUT', message: 'timeout' };
      mockInstance.get.mockRejectedValue(timeoutError);
      await expect(connector.getPlans()).rejects.toThrow(
        new HttpException(
          'Request to Mcom vCard timed out. Please try again.',
          HttpStatus.GATEWAY_TIMEOUT,
        ),
      );
    });

    it('should throw HttpException with the upstream status on 4xx API error response', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Invalid plan' } },
      };
      mockInstance.post.mockRejectedValue(apiError);
      await expect(connector.createPlan({ name: 'x' } as any)).rejects.toThrow(
        new HttpException('Invalid plan', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw HttpException(502) on 5xx internal error from upstream', async () => {
      const serverError = {
        isAxiosError: true,
        response: { status: 500, data: { message: 'Database failure' } },
      };
      mockInstance.get.mockRejectedValue(serverError);
      await expect(connector.getPlans()).rejects.toThrow(
        new HttpException(
          'Mcom vCard returned an internal error. Please try again later.',
          HttpStatus.BAD_GATEWAY,
        ),
      );
    });

    it('should throw HttpException(502) for non-axios errors', async () => {
      mockInstance.get.mockRejectedValue(new Error('boom'));
      await expect(connector.getPlans()).rejects.toThrow(
        new HttpException('Failed to reach Mcom vCard', HttpStatus.BAD_GATEWAY),
      );
    });
  });

  describe('getSeasons', () => {
    it('should fetch and map seasons from /system/seasons', async () => {
      const rawSeasons = [
        { id: 's-1', name: 'Summer 2026', startDate: '2026-06-01', endDate: '2026-08-31', status: 'ACTIVE' },
        { id: 's-2', name: 'Winter 2026', startDate: '2026-11-01', endDate: '2026-12-31', status: 'INACTIVE' },
      ];
      mockInstance.get.mockResolvedValue({ data: rawSeasons });
      const seasons = await connector.getSeasons();
      expect(mockInstance.get).toHaveBeenCalledWith('/system/seasons');
      expect(seasons).toEqual([
        { id: 's-1', name: 'Summer 2026', startDate: '2026-06-01', endDate: '2026-08-31', isActive: true, status: 'ACTIVE' },
        { id: 's-2', name: 'Winter 2026', startDate: '2026-11-01', endDate: '2026-12-31', isActive: false, status: 'INACTIVE' },
      ]);
    });

    it('should return empty array when the endpoint is not implemented (404/405)', async () => {
      mockInstance.get.mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
      const seasons = await connector.getSeasons();
      expect(seasons).toEqual([]);
    });

    it('should throw HttpException(502) on real network failures (no silent degradation)', async () => {
      mockInstance.get.mockRejectedValue({ isAxiosError: true, code: 'ECONNREFUSED' });
      await expect(connector.getSeasons()).rejects.toThrow(
        new HttpException('Failed to fetch seasons from Mcom vCard', HttpStatus.BAD_GATEWAY),
      );
    });
  });
});