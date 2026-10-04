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

  // ─── getNotifications (Phase 4: userId first, businessId fallback) ──
  describe('getNotifications', () => {
    it('should return user + business + global notifications for an owner', async () => {
      const notifs = [
        { id: 'n1', userId: 'u1', businessId: null },
        { id: 'n2', userId: null, businessId: 'b1' },
        { id: 'n3', userId: null, businessId: null },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(notifs);
      const result = await service.getNotifications({ userId: 'u1', businessId: 'b1' });
      expect(result).toHaveLength(3);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { userId: 'u1' },
              { businessId: 'b1' },
              { userId: null, businessId: null },
            ],
          },
        }),
      );
    });

    it('should serve customers by userId when they have no businessId', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      await service.getNotifications({ userId: 'cust-1', businessId: null });
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { userId: 'cust-1' },
              { userId: null, businessId: null },
            ],
          },
        }),
      );
    });
  });

  // ─── markAllAsRead ─────────────────────────────
  describe('markAllAsRead', () => {
    it('should mark only the caller’s own rows as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllAsRead({ userId: 'u1', businessId: 'b1' });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: 'u1', read: false },
            { businessId: 'b1', read: false },
          ],
        },
        data: { read: true },
      });
    });

    it('should no-op without any identity', async () => {
      const result = await service.markAllAsRead({ userId: null, businessId: null });
      expect(result).toEqual({ count: 0 });
      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── deleteNotification ────────────────────────
  describe('deleteNotification', () => {
    it('should throw NotFoundException if notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteNotification({ userId: 'u1', businessId: 'b1' }, 'n-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if caller does not own the notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'other',
        businessId: 'b-other',
      });
      await expect(
        service.deleteNotification({ userId: 'u1', businessId: 'b1' }, 'n1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete a user-owned notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
        businessId: null,
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: 'n1' });
      const result = await service.deleteNotification({ userId: 'u1', businessId: null }, 'n1');
      expect(result.id).toBe('n1');
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });

    it('should delete a business-owned notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: null,
        businessId: 'b1',
      });
      mockPrisma.notification.delete.mockResolvedValue({ id: 'n1' });
      const result = await service.deleteNotification({ userId: 'u1', businessId: 'b1' }, 'n1');
      expect(result.id).toBe('n1');
    });

    it('should refuse global broadcasts for non-admin callers', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: null,
        businessId: null,
      });
      await expect(
        service.deleteNotification({ userId: 'u1', businessId: 'b1' }, 'n1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });
  });

  // ─── createNotification ────────────────────────
  describe('createNotification', () => {
    it('should create a new notification with optional userId', async () => {
      const created = { id: 'n-new', userId: 'u1', businessId: 'b1', type: 'payment', title: 'Test', message: 'Test msg' };
      mockPrisma.notification.create.mockResolvedValue(created);
      const result = await service.createNotification({
        userId: 'u1',
        businessId: 'b1',
        type: 'payment',
        title: 'Test',
        message: 'Test msg',
      });
      expect(result).toEqual(created);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: { userId: 'u1', businessId: 'b1', type: 'payment', title: 'Test', message: 'Test msg' },
      });
    });
  });
});
