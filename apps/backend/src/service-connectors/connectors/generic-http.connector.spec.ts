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

  describe('error handling', () => {
    it('should throw HttpException(502) on network failure', async () => {
      const networkError = { isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' };
      mockInstance.get.mockRejectedValue(networkError);
      await expect(connector.getPlans()).rejects.toThrow(
        new HttpException('Mcom vCard API error', HttpStatus.BAD_GATEWAY),
      );
    });

    it('should throw HttpException with the upstream status on API error response', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Invalid plan' } },
      };
      mockInstance.post.mockRejectedValue(apiError);
      await expect(connector.createPlan({ name: 'x' } as any)).rejects.toThrow(
        new HttpException('Invalid plan', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw HttpException(502) for non-axios errors', async () => {
      mockInstance.get.mockRejectedValue(new Error('boom'));
      await expect(connector.getPlans()).rejects.toThrow(HttpException);
    });
  });
});