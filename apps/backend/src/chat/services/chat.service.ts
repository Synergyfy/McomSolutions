import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { PushNotificationService } from './push-notification.service';
import {
  SendMessageDto,
  CreateGroupConversationDto,
  SendMessageRequestDto,
  RespondMessageRequestDto,
  BlockUserDto,
} from '../dto/chat.dto';

export interface UserSummary {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  businessName?: string | null;
  isOnline: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly pushService: PushNotificationService,
  ) {}

  private formatUserName(user: { firstName?: string | null; lastName?: string | null; email: string }): string {
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return full || user.email.split('@')[0];
  }

  async getConversations(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        conversation: { deletedAt: null },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    businessProfile: { select: { businessName: true, logoUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          lastMessageAt: 'desc',
        },
      },
    });

    const results = await Promise.all(
      participants.map(async (cp) => {
        const conv = cp.conversation;
        const otherParticipants = conv.participants.filter((p) => p.userId !== userId);

        let title = conv.title;
        let avatarUrl = conv.avatarUrl;
        let isOnline = false;

        if (conv.type === 'DIRECT') {
          const other = otherParticipants[0]?.user;
          if (other) {
            title = other.businessProfile?.businessName || this.formatUserName(other);
            avatarUrl = other.businessProfile?.logoUrl || null;
            isOnline = this.presenceService.isUserOnline(other.id);
          } else {
            title = 'Direct Chat';
          }
        }

        // Fast O(1) check: if participant has read up to or after the last message, unreadCount is 0
        let unreadCount = 0;
        if (!cp.lastReadAt || conv.lastMessageAt > cp.lastReadAt) {
          unreadCount = await this.prisma.message.count({
            where: {
              conversationId: conv.id,
              deletedAt: null,
              senderId: { not: userId },
              ...(cp.lastReadAt ? { createdAt: { gt: cp.lastReadAt } } : {}),
            },
          });
        }

        return {
          id: conv.id,
          type: conv.type,
          title,
          avatarUrl,
          directKey: conv.directKey,
          isMuted: cp.isMuted,
          role: cp.role,
          lastMessageAt: conv.lastMessageAt,
          lastMessageText: conv.lastMessageText,
          lastMessageSenderId: conv.lastMessageSenderId,
          unreadCount,
          isOnline,
          participantsCount: conv.participants.length,
          participants: conv.participants.map((p) => ({
            userId: p.userId,
            role: p.role,
            displayName: p.user.businessProfile?.businessName || this.formatUserName(p.user),
            email: p.user.email,
            roleTitle: p.user.role,
            isOnline: this.presenceService.isUserOnline(p.userId),
            lastReadAt: p.lastReadAt,
          })),
        };
      }),
    );

    return results;
  }

  async getConversation(userId: string, conversationId: string) {
    const cp = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    businessProfile: { select: { businessName: true, logoUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cp || cp.conversation.deletedAt) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const conv = cp.conversation;
    const otherParticipants = conv.participants.filter((p) => p.userId !== userId);
    let title = conv.title;
    let avatarUrl = conv.avatarUrl;

    if (conv.type === 'DIRECT' && otherParticipants[0]?.user) {
      const other = otherParticipants[0].user;
      title = other.businessProfile?.businessName || this.formatUserName(other);
      avatarUrl = other.businessProfile?.logoUrl || null;
    }

    return {
      id: conv.id,
      type: conv.type,
      title,
      avatarUrl,
      directKey: conv.directKey,
      isMuted: cp.isMuted,
      role: cp.role,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      participants: conv.participants.map((p) => ({
        userId: p.userId,
        role: p.role,
        displayName: p.user.businessProfile?.businessName || this.formatUserName(p.user),
        email: p.user.email,
        roleTitle: p.user.role,
        isOnline: this.presenceService.isUserOnline(p.userId),
        lastReadAt: p.lastReadAt,
      })),
    };
  }

  async getOrCreateDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot start a direct conversation with yourself');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const caller = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    const isCallerAdmin = caller?.role === 'ADMIN';
    const isTargetAdmin = targetUser.role === 'ADMIN';

    if (!isCallerAdmin && !isTargetAdmin) {
      const isBlocked = await this.isUserBlocked(targetUserId, userId);
      if (isBlocked) {
        throw new ForbiddenException('You cannot message this user because you have been blocked');
      }
      const hasBlocked = await this.isUserBlocked(userId, targetUserId);
      if (hasBlocked) {
        throw new ForbiddenException('You have blocked this user. Unblock them to continue');
      }

      const req = await this.prisma.chatMessageRequest.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: userId },
          ],
        },
      });

      if (req && req.status === 'REJECTED' && req.senderId === userId) {
        throw new ForbiddenException('This user declined your message request');
      }
    }

    const directKey = [userId, targetUserId].sort().join(':');

    // 1. Check if conversation was soft-deleted; restore if found
    const softDeleted = await this.prisma.conversation.findFirst({
      where: {
        directKey,
        deletedAt: { not: null },
      },
    });

    if (softDeleted) {
      await this.prisma.conversation.update({
        where: { id: softDeleted.id },
        data: { deletedAt: null },
      });
      return this.getConversation(userId, softDeleted.id);
    }

    // 2. Fetch active existing conversation
    let conversation = await this.prisma.conversation.findUnique({
      where: { directKey },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                businessProfile: { select: { businessName: true, logoUrl: true } },
              },
            },
          },
        },
      },
    });

    // 3. Create if not found, catching concurrent race collisions (P2002)
    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({
          data: {
            type: 'DIRECT',
            directKey,
            createdById: userId,
            participants: {
              create: [
                { userId, role: 'ADMIN' },
                { userId: targetUserId, role: 'MEMBER' },
              ],
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    businessProfile: { select: { businessName: true, logoUrl: true } },
                  },
                },
              },
            },
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Concurrency race: another request won the insert race
          conversation = await this.prisma.conversation.findUnique({
            where: { directKey },
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      role: true,
                      businessProfile: { select: { businessName: true, logoUrl: true } },
                    },
                  },
                },
              },
            },
          });
        } else {
          throw err;
        }
      }
    }

    if (!conversation) {
      throw new BadRequestException('Could not create or find direct conversation');
    }

    return this.getConversation(userId, conversation.id);
  }

  async createGroupConversation(userId: string, dto: CreateGroupConversationDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const uniqueUids = Array.from(new Set([userId, ...dto.participantIds]));
    if (uniqueUids.length < 2) {
      throw new BadRequestException('A group conversation must have at least 2 participants');
    }

    // Verify all participants exist
    const count = await this.prisma.user.count({
      where: { id: { in: uniqueUids }, deletedAt: null },
    });
    if (count !== uniqueUids.length) {
      throw new BadRequestException('One or more participant IDs are invalid');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        title: dto.title.trim(),
        avatarUrl: dto.avatarUrl || null,
        createdById: userId,
        participants: {
          create: uniqueUids.map((uid) => ({
            userId: uid,
            role: uid === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
    });

    // Create system message
    const creatorName = this.formatUserName(user);
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        type: 'SYSTEM',
        content: `${creatorName} created group "${dto.title.trim()}"`,
      },
    });

    return this.getConversation(userId, conversation.id);
  }

  async addParticipant(callerId: string, conversationId: string, targetUserId: string) {
    const callerCp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: callerId } },
      include: { user: true, conversation: true },
    });

    if (!callerCp || callerCp.conversation.deletedAt) {
      throw new ForbiddenException('You are not in this conversation');
    }

    if (callerCp.conversation.type !== 'GROUP') {
      throw new BadRequestException('Cannot add participants to a direct conversation');
    }

    if (callerCp.role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can add participants');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException('Target user not found');

    const existing = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });
    if (existing) {
      throw new BadRequestException('User is already a participant');
    }

    await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId: targetUserId,
        role: 'MEMBER',
      },
    });

    const targetName = this.formatUserName(targetUser);
    const callerName = this.formatUserName(callerCp.user);
    await this.prisma.message.create({
      data: {
        conversationId,
        senderId: callerId,
        type: 'SYSTEM',
        content: `${callerName} added ${targetName} to the group`,
      },
    });

    return this.getConversation(callerId, conversationId);
  }

  async removeParticipant(callerId: string, conversationId: string, targetUserId: string) {
    const callerCp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: callerId } },
      include: { user: true, conversation: true },
    });

    if (!callerCp || callerCp.conversation.deletedAt) {
      throw new ForbiddenException('You are not in this conversation');
    }

    const isSelfLeaving = callerId === targetUserId;
    if (!isSelfLeaving && callerCp.role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can remove other participants');
    }

    const targetCp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      include: { user: true },
    });
    if (!targetCp) throw new NotFoundException('Participant not found');

    await this.prisma.conversationParticipant.delete({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });

    const targetName = this.formatUserName(targetCp.user);
    const callerName = this.formatUserName(callerCp.user);
    const content = isSelfLeaving
      ? `${targetName} left the group`
      : `${callerName} removed ${targetName} from the group`;

    await this.prisma.message.create({
      data: {
        conversationId,
        senderId: callerId,
        type: 'SYSTEM',
        content,
      },
    });

    return { success: true };
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const cp = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId: senderId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            businessProfile: { select: { businessName: true, logoUrl: true } },
          },
        },
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!cp || cp.conversation.deletedAt) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Direct conversation rules: blocking & rejection guards (Admin exempt)
    if (cp.conversation.type === 'DIRECT') {
      const otherParticipant = cp.conversation.participants.find((p) => p.userId !== senderId);
      if (otherParticipant) {
        const isSenderAdmin = cp.user.role === 'ADMIN';

        if (!isSenderAdmin) {
          // Check if other participant blocked sender
          const isBlocked = await this.isUserBlocked(otherParticipant.userId, senderId);
          if (isBlocked) {
            throw new ForbiddenException('You cannot message this user because you have been blocked');
          }

          // Check if sender blocked other participant
          const hasBlocked = await this.isUserBlocked(senderId, otherParticipant.userId);
          if (hasBlocked) {
            throw new ForbiddenException('You have blocked this user. Unblock them to send messages');
          }

          // Check if request was rejected
          const request = await this.prisma.chatMessageRequest.findUnique({
            where: {
              senderId_receiverId: {
                senderId,
                receiverId: otherParticipant.userId,
              },
            },
          });

          if (request && request.status === 'REJECTED') {
            throw new ForbiddenException('This user rejected your message request. You cannot send them messages');
          }
        }
      }
    }

    // Idempotency check: if client provided idempotencyKey, return existing if already committed
    if (dto.idempotencyKey) {
      const existing = await this.prisma.message.findFirst({
        where: {
          conversationId: dto.conversationId,
          idempotencyKey: dto.idempotencyKey,
          deletedAt: null,
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: { select: { businessName: true, logoUrl: true } },
            },
          },
          readReceipts: true,
        },
      });

      if (existing) {
        return this.formatMessageResponse(existing, senderId);
      }
    }

    const now = new Date();

    // Durable transaction: persist message, update conversation last message, advance sender read cursor
    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId,
          idempotencyKey: dto.idempotencyKey || null,
          type: dto.type || 'TEXT',
          content: dto.content.trim(),
          metadata: dto.metadata || null,
          createdAt: now,
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: { select: { businessName: true, logoUrl: true } },
            },
          },
        },
      });

      // Update conversation summary
      await tx.conversation.update({
        where: { id: dto.conversationId },
        data: {
          lastMessageAt: now,
          lastMessageText: dto.type === 'TEXT' ? dto.content.slice(0, 200) : `[${dto.type || 'Message'}]`,
          lastMessageSenderId: senderId,
        },
      });

      // Advance sender's read cursor
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: dto.conversationId,
            userId: senderId,
          },
        },
        data: {
          lastReadMessageId: msg.id,
          lastReadAt: now,
        },
      });

      // Insert sender read receipt
      await tx.messageReadReceipt.create({
        data: {
          messageId: msg.id,
          userId: senderId,
          readAt: now,
        },
      });

      // Create outbox event for async push & durable notification handling
      await tx.chatOutbox.create({
        data: {
          eventType: 'NEW_MESSAGE',
          payload: {
            messageId: msg.id,
            conversationId: dto.conversationId,
            senderId,
            senderName: cp.user.businessProfile?.businessName || this.formatUserName(cp.user),
            content: dto.content.slice(0, 100),
            createdAt: now.toISOString(),
          },
        },
      });

      return msg;
    });

    // Schedule background push notifications for offline/unmuted recipients
    this.dispatchBackgroundNotifications(cp.conversation, message, cp.user).catch((err) => {
      this.logger.error(`Error in dispatchBackgroundNotifications: ${err.message}`);
    });

    return this.formatMessageResponse(message, senderId);
  }

  private async dispatchBackgroundNotifications(
    conversation: { id: string; type: string; title: string | null; participants: { userId: string; isMuted: boolean }[] },
    message: { id: string; content: string; senderId: string },
    sender: { email: string; firstName?: string | null; lastName?: string | null; businessProfile?: { businessName?: string | null } | null },
  ) {
    const senderName = sender.businessProfile?.businessName || this.formatUserName(sender);
    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== message.senderId && !p.isMuted,
    );

    for (const participant of otherParticipants) {
      // Never notify if recipient has blocked the sender (silent blocking)
      const isBlocked = await this.isUserBlocked(participant.userId, message.senderId);
      if (isBlocked) {
        continue;
      }

      // Idempotency: check if in-app notification for this message already exists
      const existingNotif = await this.prisma.notification.findFirst({
        where: {
          userId: participant.userId,
          type: 'chat_message',
          data: {
            path: ['messageId'],
            equals: message.id,
          },
        },
      });

      if (!existingNotif) {
        await this.prisma.notification.create({
          data: {
            userId: participant.userId,
            type: 'chat_message',
            title: conversation.type === 'GROUP' ? `New message in ${conversation.title || 'Group'}` : `Message from ${senderName}`,
            message: `${senderName}: ${message.content.slice(0, 150)}`,
            data: {
              conversationId: conversation.id,
              messageId: message.id,
              senderId: message.senderId,
            },
          },
        }).catch(() => {});
      }

      // Dispatch Web Push notification if not actively viewing this conversation in a focused tab
      const isViewing = this.presenceService.isViewingConversation(participant.userId, conversation.id);
      if (!isViewing) {
        await this.pushService.sendPushToUser(participant.userId, {
          title: conversation.type === 'GROUP' ? `${conversation.title || 'Group'}: ${senderName}` : senderName,
          body: message.content.slice(0, 120),
          data: {
            conversationId: conversation.id,
            messageId: message.id,
            tag: `chat-msg-${message.id}`,
          },
        }).catch(() => {});
      }
    }
  }

  async getMessages(userId: string, conversationId: string, cursor?: string, limit = 50) {
    const cp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!cp) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const boundedLimit = Math.min(Math.max(limit, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      take: boundedLimit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            businessProfile: { select: { businessName: true, logoUrl: true } },
          },
        },
        readReceipts: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
    });

    const totalParticipants = await this.prisma.conversationParticipant.count({
      where: { conversationId },
    });

    // Reverse to chronological order (oldest to newest for chat feed)
    return messages.reverse().map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender.businessProfile?.businessName || this.formatUserName(msg.sender),
      senderRole: msg.sender.role,
      senderAvatar: msg.sender.businessProfile?.logoUrl || null,
      content: msg.content,
      type: msg.type,
      metadata: msg.metadata,
      idempotencyKey: msg.idempotencyKey,
      createdAt: msg.createdAt,
      isSender: msg.senderId === userId,
      readCount: msg.readReceipts.length,
      totalRecipients: Math.max(0, totalParticipants - 1),
      isReadByMe: msg.readReceipts.some((r) => r.userId === userId),
      readReceiptsPreview: msg.readReceipts.map((r) => r.userId),
    }));
  }

  async markAsRead(userId: string, conversationId: string, messageIds?: string[]) {
    const cp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!cp) throw new ForbiddenException('Not a participant');

    const now = new Date();

    // Fetch candidate messages to mark read
    const targetMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        senderId: { not: userId },
        ...(messageIds && messageIds.length > 0 ? { id: { in: messageIds } } : {}),
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (targetMessages.length > 0) {
      await this.prisma.messageReadReceipt.createMany({
        data: targetMessages.map((m) => ({
          messageId: m.id,
          userId,
          readAt: now,
        })),
        skipDuplicates: true,
      });

      // Advance participant cursor to newest read message
      const latest = targetMessages[0];
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: {
          lastReadMessageId: latest.id,
          lastReadAt: now,
        },
      });
    }

    return {
      success: true,
      markedCount: targetMessages.length,
      readMessageIds: targetMessages.map((m) => m.id),
      readerUserId: userId,
      readAt: now,
    };
  }

  async getMessageReceipts(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    businessProfile: { select: { businessName: true, logoUrl: true } },
                  },
                },
              },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                businessProfile: { select: { businessName: true, logoUrl: true } },
              },
            },
          },
          orderBy: { readAt: 'asc' },
        },
      },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }

    const isMember = message.conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const readers = message.readReceipts.map((r) => ({
      userId: r.userId,
      displayName: r.user.businessProfile?.businessName || this.formatUserName(r.user),
      role: r.user.role,
      avatarUrl: r.user.businessProfile?.logoUrl || null,
      readAt: r.readAt,
    }));

    const eligibleRecipients = message.conversation.participants
      .filter((p) => {
        if (p.userId === message.senderId) return false;
        if (p.joinedAt && p.joinedAt > message.createdAt) return false;
        if (p.leftAt && p.leftAt <= message.createdAt) return false;
        return true;
      })
      .map((p) => ({
        userId: p.userId,
        displayName: p.user.businessProfile?.businessName || this.formatUserName(p.user),
        role: p.user.role,
        avatarUrl: p.user.businessProfile?.logoUrl || null,
        hasRead: message.readReceipts.some((r) => r.userId === p.userId),
      }));

    return {
      messageId: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      readersCount: readers.length,
      totalRecipients: eligibleRecipients.length,
      readers,
      allRecipients: eligibleRecipients,
    };
  }

  async muteConversation(userId: string, conversationId: string, isMuted: boolean) {
    const cp = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!cp) throw new NotFoundException('Conversation not found');

    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted },
    });
  }

  async searchUsers(query: string, currentUserId: string): Promise<UserSummary[]> {
    const cleanQuery = (query || '').trim();
    const parts = cleanQuery.split(/\s+/).filter(Boolean);

    const orConditions: any[] = [];
    if (cleanQuery) {
      orConditions.push(
        { email: { contains: cleanQuery, mode: 'insensitive' } },
        { firstName: { contains: cleanQuery, mode: 'insensitive' } },
        { lastName: { contains: cleanQuery, mode: 'insensitive' } },
        {
          businessProfile: {
            OR: [
              { businessName: { contains: cleanQuery, mode: 'insensitive' } },
              { email: { contains: cleanQuery, mode: 'insensitive' } },
            ],
          },
        },
      );

      if (parts.length > 1) {
        orConditions.push({
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
          ],
        });
      }
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        deletedAt: null,
        ...(cleanQuery ? { OR: orConditions } : {}),
      },
      take: 25,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        businessProfile: { select: { businessName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      businessName: u.businessProfile?.businessName || null,
      isOnline: this.presenceService.isUserOnline(u.id),
    }));
  }

  private formatMessageResponse(msg: any, currentUserId: string) {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender?.businessProfile?.businessName || this.formatUserName(msg.sender || {}),
      senderRole: msg.sender?.role || 'USER',
      senderAvatar: msg.sender?.businessProfile?.logoUrl || null,
      content: msg.content,
      type: msg.type,
      metadata: msg.metadata,
      idempotencyKey: msg.idempotencyKey,
      createdAt: msg.createdAt,
      isSender: msg.senderId === currentUserId,
      readCount: msg.readReceipts ? msg.readReceipts.length : 1,
      isReadByMe: true,
    };
  }

  // ─── USER BLOCKING ──────────────────────────────────────────────────────────

  async blockUser(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Admin exemption: administrators cannot be blocked
    if (targetUser.role === 'ADMIN') {
      throw new BadRequestException('Administrators cannot be blocked');
    }

    await this.prisma.chatBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: targetUserId,
        },
      },
      create: {
        blockerId,
        blockedId: targetUserId,
      },
      update: {},
    });

    // Also mark any pending requests from the blocked user as REJECTED
    await this.prisma.chatMessageRequest.updateMany({
      where: {
        senderId: targetUserId,
        receiverId: blockerId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        rejectionCount: { increment: 1 },
        respondedAt: new Date(),
      },
    });

    return { success: true, isBlocked: true, targetUserId };
  }

  async unblockUser(blockerId: string, targetUserId: string) {
    await this.prisma.chatBlock.deleteMany({
      where: {
        blockerId,
        blockedId: targetUserId,
      },
    });

    return { success: true, isBlocked: false, targetUserId };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.prisma.chatBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            businessProfile: { select: { businessName: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      userId: b.blocked.id,
      email: b.blocked.email,
      displayName: b.blocked.businessProfile?.businessName || this.formatUserName(b.blocked),
      role: b.blocked.role,
      avatarUrl: b.blocked.businessProfile?.logoUrl || null,
      blockedAt: b.createdAt,
    }));
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.prisma.chatBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
    return !!block;
  }

  // ─── MESSAGE REQUESTS ───────────────────────────────────────────────────────

  async sendMessageRequest(senderId: string, dto: SendMessageRequestDto) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send a message request to yourself');
    }

    const [sender, receiver] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: senderId, deletedAt: null },
        select: {
          id: true,
          role: true,
          firstName: true,
          lastName: true,
          email: true,
          businessProfile: { select: { businessName: true } },
        },
      }),
      this.prisma.user.findFirst({
        where: { id: dto.receiverId, deletedAt: null },
        select: {
          id: true,
          role: true,
          firstName: true,
          lastName: true,
          email: true,
          businessProfile: { select: { businessName: true } },
        },
      }),
    ]);

    if (!sender) throw new NotFoundException('Sender not found');
    if (!receiver) throw new NotFoundException('Target user not found');

    const senderName = sender.businessProfile?.businessName || this.formatUserName(sender);
    const isSenderAdmin = sender.role === 'ADMIN';
    const isReceiverAdmin = receiver.role === 'ADMIN';

    // 1. Check if receiver has blocked sender (Admin bypasses blocking)
    if (!isSenderAdmin) {
      const isBlocked = await this.isUserBlocked(dto.receiverId, senderId);
      if (isBlocked) {
        throw new ForbiddenException('You cannot message this user');
      }
    }

    // 2. Admin exemption: If sender or receiver is ADMIN, direct chat is immediately ready without requests
    if (isSenderAdmin || isReceiverAdmin) {
      const conv = await this.getOrCreateDirectConversation(senderId, dto.receiverId);
      return {
        id: 'admin-auto-approved',
        status: 'ACCEPTED',
        conversationId: conv.id,
        rejectionCount: 0,
        canRetry: true,
      };
    }

    // 3. Check existing request record
    const existing = await this.prisma.chatMessageRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: dto.receiverId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        const conv = await this.getOrCreateDirectConversation(senderId, dto.receiverId);
        return {
          id: existing.id,
          status: 'ACCEPTED',
          conversationId: conv.id,
          rejectionCount: existing.rejectionCount,
          canRetry: true,
        };
      }

      if (existing.status === 'PENDING') {
        throw new BadRequestException('A message request to this user is already pending');
      }

      if (existing.status === 'REJECTED') {
        // Enforce 3-strikes rule: if rejected 3 or more times, sender cannot send request again
        if (existing.rejectionCount >= 3) {
          throw new ForbiddenException(
            'This user has declined your message request 3 times. You cannot send further requests until they change their mind from their end.',
          );
        }

        // Retry (attempt 2 or 3)
        const updated = await this.prisma.chatMessageRequest.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            message: dto.message?.trim() || null,
            updatedAt: new Date(),
          },
        });

        // Notify receiver
        await this.notifyMessageRequest(receiver.id, senderName, senderId, updated.id);

        return {
          id: updated.id,
          status: updated.status,
          rejectionCount: updated.rejectionCount,
          canRetry: updated.rejectionCount < 3,
        };
      }
    }

    // 4. Create fresh request
    const request = await this.prisma.chatMessageRequest.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        message: dto.message?.trim() || null,
        status: 'PENDING',
      },
    });

    // Notify receiver
    await this.notifyMessageRequest(receiver.id, senderName, senderId, request.id);

    return {
      id: request.id,
      status: request.status,
      rejectionCount: request.rejectionCount,
      canRetry: true,
      senderName,
    };
  }

  private async notifyMessageRequest(
    receiverId: string,
    senderName: string,
    senderId: string,
    requestId: string,
  ) {
    // Check if receiver blocked sender (never notify blocked sender interactions)
    const isBlocked = await this.isUserBlocked(receiverId, senderId);
    if (isBlocked) return;

    // Create durable in-app notification
    await this.prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'chat_message_request',
        title: 'New Message Request',
        message: `${senderName} would like to chat with you`,
        data: {
          requestId,
          senderId,
        },
      },
    }).catch(() => {});

    // Dispatch Web Push if not online
    const isOnline = this.presenceService.isUserOnline(receiverId);
    if (!isOnline) {
      await this.pushService.sendPushToUser(receiverId, {
        title: 'New Message Request',
        body: `${senderName} sent you a message request`,
        data: { requestId, senderId, type: 'chat_request' },
      }).catch(() => {});
    }
  }

  async respondMessageRequest(
    receiverId: string,
    requestId: string,
    dto: RespondMessageRequestDto,
  ) {
    const request = await this.prisma.chatMessageRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            businessProfile: { select: { businessName: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            businessProfile: { select: { businessName: true } },
          },
        },
      },
    });

    if (!request || request.receiverId !== receiverId) {
      throw new ForbiddenException('Message request not found or access denied');
    }

    const receiverName =
      request.receiver.businessProfile?.businessName || this.formatUserName(request.receiver);

    if (dto.action === 'ACCEPT') {
      await this.prisma.chatMessageRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      // Automatically create / restore the direct conversation
      const conversation = await this.getOrCreateDirectConversation(
        request.senderId,
        request.receiverId,
      );

      // Notify sender (unless sender blocked receiver)
      const isBlocked = await this.isUserBlocked(request.senderId, receiverId);
      if (!isBlocked) {
        await this.prisma.notification.create({
          data: {
            userId: request.senderId,
            type: 'chat_request_accepted',
            title: 'Message Request Accepted',
            message: `${receiverName} accepted your message request`,
            data: { conversationId: conversation.id, receiverId },
          },
        }).catch(() => {});

        if (!this.presenceService.isUserOnline(request.senderId)) {
          await this.pushService.sendPushToUser(request.senderId, {
            title: 'Message Request Accepted',
            body: `${receiverName} accepted your message request`,
            data: { conversationId: conversation.id, type: 'chat_request_accepted' },
          }).catch(() => {});
        }
      }

      return {
        success: true,
        status: 'ACCEPTED',
        conversationId: conversation.id,
        senderId: request.senderId,
        receiverName,
      };
    } else {
      // REJECT action: increments rejection count
      const newCount = request.rejectionCount + 1;
      await this.prisma.chatMessageRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionCount: newCount,
          respondedAt: new Date(),
        },
      });

      // Notify sender that it was declined (unless blocked)
      const isBlocked = await this.isUserBlocked(request.senderId, receiverId);
      if (!isBlocked) {
        await this.prisma.notification.create({
          data: {
            userId: request.senderId,
            type: 'chat_request_rejected',
            title: 'Message Request Declined',
            message: `${receiverName} declined your message request`,
            data: { receiverId, rejectionCount: newCount },
          },
        }).catch(() => {});
      }

      return {
        success: true,
        status: 'REJECTED',
        rejectionCount: newCount,
        canRetry: newCount < 3,
      };
    }
  }

  async getMessageRequests(userId: string) {
    const [incoming, outgoing, rejected] = await Promise.all([
      // Requests received awaiting decision
      this.prisma.chatMessageRequest.findMany({
        where: {
          receiverId: userId,
          status: 'PENDING',
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: { select: { businessName: true, logoUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Requests sent by this user
      this.prisma.chatMessageRequest.findMany({
        where: {
          senderId: userId,
        },
        include: {
          receiver: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: { select: { businessName: true, logoUrl: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      // Requests received by this user that were rejected (to change mind / reset)
      this.prisma.chatMessageRequest.findMany({
        where: {
          receiverId: userId,
          status: 'REJECTED',
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: { select: { businessName: true, logoUrl: true } },
            },
          },
        },
        orderBy: { respondedAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((req) => ({
        id: req.id,
        senderId: req.sender.id,
        displayName: req.sender.businessProfile?.businessName || this.formatUserName(req.sender),
        email: req.sender.email,
        role: req.sender.role,
        avatarUrl: req.sender.businessProfile?.logoUrl || null,
        message: req.message,
        createdAt: req.createdAt,
        rejectionCount: req.rejectionCount,
      })),
      outgoing: outgoing.map((req) => ({
        id: req.id,
        receiverId: req.receiver.id,
        displayName: req.receiver.businessProfile?.businessName || this.formatUserName(req.receiver),
        email: req.receiver.email,
        role: req.receiver.role,
        avatarUrl: req.receiver.businessProfile?.logoUrl || null,
        message: req.message,
        status: req.status,
        rejectionCount: req.rejectionCount,
        canRetry: req.rejectionCount < 3,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      })),
      rejected: rejected.map((req) => ({
        id: req.id,
        senderId: req.sender.id,
        displayName: req.sender.businessProfile?.businessName || this.formatUserName(req.sender),
        email: req.sender.email,
        role: req.sender.role,
        avatarUrl: req.sender.businessProfile?.logoUrl || null,
        rejectionCount: req.rejectionCount,
        respondedAt: req.respondedAt,
      })),
    };
  }

  async resetRejectedRequest(receiverId: string, senderId: string) {
    const existing = await this.prisma.chatMessageRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Request record not found');
    }

    // Reset rejection count so the sender may try again
    await this.prisma.chatMessageRequest.update({
      where: { id: existing.id },
      data: {
        rejectionCount: 0,
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    return { success: true, message: 'Rejection count reset; sender may now send requests' };
  }
}
