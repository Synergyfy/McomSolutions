import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;

  const mockPrisma = {
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ─── getNotifications ──────────────────────────
  describe('getNotifications', () => {
    it('should return notifications for a business including global ones', async () => {
      const notifs = [
        { id: 'n1', businessId: 'b1', type: 'membership', title: 'Test', read: false },
        { id: 'n2', businessId: null, type: 'announcement', title: 'Global', read: false },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(notifs);
      const result = await service.getNotifications('b1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { businessId: 'b1' },
              { businessId: null },
            ],
          },
        }),
      );
    });
  });

  // ─── markAllAsRead ─────────────────────────────
  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllAsRead('b1');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { businessId: 'b1', read: false },
        data: { read: true },
      });
    });
  });

  // ─── deleteNotification ────────────────────────
  describe('deleteNotification', () => {
    it('should throw NotFoundException if notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.deleteNotification('b1', 'n-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if business does not own notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        businessId: 'b-other',
      });
      await expect(service.deleteNotification('b1', 'n1')).rejects.toThrow(NotFoundException);
    });

    it('should delete notification if owned by business', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        businessId: 'b1',
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: 'n1' });
      const result = await service.deleteNotification('b1', 'n1');
      expect(result.id).toBe('n1');
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });

    it('should allow deletion of global notifications (businessId: null)', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        businessId: null,
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: 'n1' });
      const result = await service.deleteNotification('b1', 'n1');
      expect(result.id).toBe('n1');
    });
  });

  // ─── createNotification ────────────────────────
  describe('createNotification', () => {
    it('should create a new notification', async () => {
      const created = { id: 'n-new', businessId: 'b1', type: 'payment', title: 'Test', message: 'Test msg' };
      mockPrisma.notification.create.mockResolvedValue(created);
      const result = await service.createNotification({
        businessId: 'b1',
        type: 'payment',
        title: 'Test',
        message: 'Test msg',
      });
      expect(result).toEqual(created);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: { businessId: 'b1', type: 'payment', title: 'Test', message: 'Test msg' },
      });
    });
  });
});
