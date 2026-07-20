import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    getStats: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getBusinesses: jest.fn().mockResolvedValue({ success: true, data: [] }),
    getCustomers: jest.fn().mockResolvedValue({ success: true, data: [] }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('should return stats from service', async () => {
      const result = await controller.getStats();
      expect(result.success).toBe(true);
      expect(service.getStats).toHaveBeenCalled();
    });
  });
});
