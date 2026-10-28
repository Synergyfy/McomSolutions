import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { McomRewardsConnector } from './mcom-rewards.connector';

jest.mock('axios');

const mockHttpClient = {
  get: jest.fn(),
};

describe('McomRewardsConnector access pass catalogue', () => {
  let connector: McomRewardsConnector;
  const config = {
    get: jest.fn((key: string) => ({
      MCOM_REWARDS_API_URL: 'https://rewards.example.test/',
      MCOM_REWARDS_API_KEY: 'server-side-key',
    })[key]),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockHttpClient);
    connector = new McomRewardsConnector(config);
  });

  it('uses the configured Rewards API base URL and existing server-side API key', async () => {
    mockHttpClient.get.mockResolvedValue({ data: [] });

    await connector.getAccessPassPlans();

    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://rewards.example.test/api/v1',
      headers: expect.objectContaining({
        'x-mcom-solution-api-key': 'server-side-key',
      }),
    }));
    expect(mockHttpClient.get).toHaveBeenCalledWith('/access-passes/plans');
  });

  it('accepts the public endpoint bare-array response', async () => {
    const plans = [{ id: 'pass-1', name: 'Starter Pass', isActive: true }];
    mockHttpClient.get.mockResolvedValue({ data: plans });

    await expect(connector.getAccessPassPlans()).resolves.toEqual(plans);
  });

  it('accepts a data-enveloped response', async () => {
    const plans = [{ id: 'pass-1', name: 'Starter Pass', isActive: true }];
    mockHttpClient.get.mockResolvedValue({ data: { success: true, data: plans } });

    await expect(connector.getAccessPassPlans()).resolves.toEqual(plans);
  });

  it('keeps the existing /system/plans endpoint working', async () => {
    const plans = [{ id: 'membership-1', name: 'Business' }];
    mockHttpClient.get.mockResolvedValue({ data: plans });

    await connector.getPlans();

    expect(mockHttpClient.get).toHaveBeenCalledWith('/system/plans');
  });

  it('rejects an invalid catalogue response', async () => {
    mockHttpClient.get.mockResolvedValue({ data: { success: true, data: null } });

    await expect(connector.getAccessPassPlans()).rejects.toMatchObject({
      status: 502,
      message: 'MCOM Rewards returned an invalid access pass catalogue',
    });
  });
});
