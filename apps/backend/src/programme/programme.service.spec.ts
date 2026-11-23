import { Test, TestingModule } from '@nestjs/testing';
import { ProgrammeService } from './programme.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ProgrammeService', () => {
  let service: ProgrammeService;

  const mockPrisma = {
    programmePhase: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    readinessGate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supportAgent: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    businessProgramme: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userTaskAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    programmeTaskStatus: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
    $transaction: jest.fn((cb) => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgrammeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProgrammeService>(ProgrammeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPhases', () => {
    it('returns a success envelope with phases', async () => {
      const result = await service.getPhases();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockPrisma.programmePhase.findMany).toHaveBeenCalledWith({
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('createPhase', () => {
    it('creates a phase with missions as JSON', async () => {
      const dto = {
        name: 'Business Foundation',
        dayStart: 1,
        dayEnd: 7,
        description: 'Verify identity',
        missions: [{ id: 'm1', title: 'Mission 1' }],
      };
      mockPrisma.programmePhase.create.mockResolvedValue({ id: 'phase-1', ...dto });
      const result = await service.createPhase(dto as any);
      expect(result.success).toBe(true);
      expect(mockPrisma.programmePhase.create).toHaveBeenCalled();
    });
  });

  describe('getPhase', () => {
    it('throws NotFoundException when phase does not exist', async () => {
      mockPrisma.programmePhase.findUnique.mockResolvedValue(null);
      await expect(service.getPhase('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGates', () => {
    it('returns gates ordered by minProgressPercent desc', async () => {
      await service.getGates();
      expect(mockPrisma.readinessGate.findMany).toHaveBeenCalledWith({
        orderBy: { minProgressPercent: 'desc' },
      });
    });
  });

  describe('getBusinesses', () => {
    it('returns business programmes with phase relation', async () => {
      mockPrisma.businessProgramme.findMany.mockResolvedValue([{ id: 'b1' }]);
      const result = await service.getBusinesses();
      expect(result.data).toEqual([{ id: 'b1' }]);
      expect(mockPrisma.businessProgramme.findMany).toHaveBeenCalledWith({
        include: { phase: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('performAction', () => {
    it('throws NotFoundException when business does not exist', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue(null);
      await expect(service.performAction('nope', 'pause')).rejects.toThrow(NotFoundException);
    });
  });

  describe('performAction branches', () => {
    const base = { id: 'b1', status: 'active', currentDay: 4, extendedBy: 0, completedMissions: [] };

    it('pauses an active programme and records the pause timestamp', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue(base);
      mockPrisma.businessProgramme.update.mockResolvedValue({ ...base, status: 'paused' });
      const result = await service.performAction('b1', 'pause');
      expect(mockPrisma.businessProgramme.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: 'paused', pausedAt: expect.any(Date) },
      });
      expect(result.success).toBe(true);
    });

    it('treats pausing a paused programme as idempotent', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({ ...base, status: 'paused' });
      mockPrisma.businessProgramme.update.mockClear();
      const result = await service.performAction('b1', 'pause');
      expect(result.success).toBe(true);
      expect(mockPrisma.businessProgramme.update).not.toHaveBeenCalled();
    });

    it('rejects pausing a completed programme', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({ ...base, status: 'completed' });
      await expect(service.performAction('b1', 'pause')).rejects.toThrow(
        'Completed programmes cannot be paused',
      );
    });

    it('treats resuming a non-paused programme as idempotent', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({ ...base, status: 'active' });
      mockPrisma.businessProgramme.update.mockClear();
      const result = await service.performAction('b1', 'resume');
      expect(result.success).toBe(true);
      expect(mockPrisma.businessProgramme.update).not.toHaveBeenCalled();
    });

    it('extends and reactivates a completed programme', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({ ...base, status: 'completed' });
      mockPrisma.businessProgramme.update.mockResolvedValue(base);
      await service.performAction('b1', 'extend', 10);
      expect(mockPrisma.businessProgramme.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { extendedBy: 10, status: 'active' },
      });
    });

    it('rejects an unsupported action', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue(base);
      await expect(service.performAction('b1', 'unknown' as any)).rejects.toThrow('Unsupported action');
    });
  });

  describe('setTaskStatus', () => {
    it('creates a new task status and adds to completedMissions when completed', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({
        id: 'b1',
        completedMissions: [],
        status: 'active',
        currentDay: 1,
        extendedBy: 0,
      });
      mockPrisma.programmeTaskStatus.upsert.mockResolvedValue({ id: 't1', status: 'completed' });
      mockPrisma.businessProgramme.update.mockResolvedValue({});

      await service.setTaskStatus('b1', { missionId: 'm1', status: 'completed' });
      expect(mockPrisma.programmeTaskStatus.upsert).toHaveBeenCalledWith({
        where: {
          businessProgrammeId_missionId: {
            businessProgrammeId: 'b1',
            missionId: 'm1',
          },
        },
        update: { status: 'completed' },
        create: {
          businessProgrammeId: 'b1',
          missionId: 'm1',
          status: 'completed',
        },
      });
      expect(mockPrisma.businessProgramme.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { completedMissions: ['m1'] },
      });
    });

    it('updates an existing task status and removes mission when uncompleted', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({
        id: 'b1',
        completedMissions: ['m1', 'm2'],
        status: 'active',
        currentDay: 1,
        extendedBy: 0,
      });
      mockPrisma.programmeTaskStatus.upsert.mockResolvedValue({ id: 't1', status: 'in_progress' });

      await service.setTaskStatus('b1', { missionId: 'm1', status: 'in_progress' });
      expect(mockPrisma.programmeTaskStatus.upsert).toHaveBeenCalledWith({
        where: {
          businessProgrammeId_missionId: {
            businessProgrammeId: 'b1',
            missionId: 'm1',
          },
        },
        update: { status: 'in_progress' },
        create: {
          businessProgrammeId: 'b1',
          missionId: 'm1',
          status: 'in_progress',
        },
      });
      expect(mockPrisma.businessProgramme.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { completedMissions: ['m2'] },
      });
    });
  });

  describe('createAgent', () => {
    it('throws ConflictException on duplicate email', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      mockPrisma.supportAgent.create.mockRejectedValue(err);
      await expect(
        service.createAgent({ name: 'Sarah', role: 'agent', email: 'sarah@mcom.co.uk' }),
      ).rejects.toThrow('email already exists');
    });
  });

  describe('deletePhase / updateGate / deleteAgent / deleteBusiness', () => {
    it('throws NotFoundException when deleting a missing phase', async () => {
      mockPrisma.programmePhase.findUnique.mockResolvedValue(null);
      await expect(service.deletePhase('nope')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when updating a missing gate', async () => {
      mockPrisma.readinessGate.findUnique.mockResolvedValue(null);
      await expect(service.updateGate('nope', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting a missing agent', async () => {
      mockPrisma.supportAgent.findUnique.mockResolvedValue(null);
      await expect(service.deleteAgent('nope')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting a missing business', async () => {
      mockPrisma.businessProgramme.findUnique.mockResolvedValue(null);
      await expect(service.deleteBusiness('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('pause / resume clock', () => {
    const pausedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    const startedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const assignedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const deadlineAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    it('shifts every assignment deadline forward by the paused duration', async () => {
      mockPrisma.businessProgramme.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.businessProgramme.findUnique.mockResolvedValue({
        id: 'b1',
        businessId: 'biz-1',
        businessName: 'Acme',
        status: 'paused',
        pausedAt,
        pausedSeconds: 0,
        startedAt,
      });
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.userTaskAssignment.findMany.mockResolvedValue([
        { id: 'a1', assignedAt, deadlineAt },
        { id: 'a2', assignedAt, deadlineAt },
      ]);
      mockPrisma.businessProgramme.update.mockResolvedValue({ id: 'b1', status: 'active' });
      mockPrisma.userTaskAssignment.update.mockResolvedValue({});

      await service.resumeBusinessProgramme('biz-1');

      expect(mockPrisma.userTaskAssignment.update).toHaveBeenCalledTimes(2);
      const firstCall = mockPrisma.userTaskAssignment.update.mock.calls[0][0];
      expect(firstCall.data.deadlineAt.getTime()).toBeGreaterThan(deadlineAt.getTime());
      expect(firstCall.data.assignedAt.getTime()).toBeGreaterThan(assignedAt.getTime());
      expect(mockPrisma.businessProgramme.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            pausedAt: null,
            pausedSeconds: { increment: expect.any(Number) },
          }),
        }),
      );
    });

    it('blocks task work while paused', async () => {
      mockPrisma.businessProgramme.findFirst.mockResolvedValue({
        id: 'b1',
        status: 'paused',
        pausedAt,
        pausedSeconds: 0,
      });
      await expect(service.assertProgrammeActiveForBusiness('biz-1')).rejects.toThrow(
        'programme is paused',
      );
    });
  });
});
