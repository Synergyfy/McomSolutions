/* eslint-disable no-console */
/**
 * End-to-end smoke test for GROUP MESSAGING against the real database.
 *
 *   cd apps/backend
 *   npx dotenv -e .env -- npx ts-node scripts/chat-group-smoke.ts
 *
 * Exercises the whole group-admin surface:
 *   1. A user creates a group and becomes its owner/admin.
 *   2. Other members can chat in the group.
 *   3. The owner switches the group to admin-only (read-only for members).
 *   4. Members can no longer send; admins still can.
 *   5. A member cannot change group settings.
 *   6. Promoting a member to admin restores their ability to post.
 *   7. The owner cannot be demoted or removed.
 *   8. Ownership can be transferred.
 *
 * Every row it creates is deleted at the end.
 */
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PresenceService } from '../src/chat/services/presence.service';
import { PushNotificationService } from '../src/chat/services/push-notification.service';
import { ChatOutboxService } from '../src/chat/services/chat-outbox.service';
import { ChatService } from '../src/chat/services/chat.service';
import { RedisService } from '../src/redis/redis.service';

const stamp = Date.now();
const emails = {
  owner: `grp-owner-${stamp}@example.com`,
  member: `grp-member-${stamp}@example.com`,
  admin2: `grp-admin-${stamp}@example.com`,
};

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${label}`, detail !== undefined ? detail : '');
  }
}

async function expectReject(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, 'expected a rejection but the call succeeded');
  } catch (err: any) {
    const expected = err instanceof ForbiddenException || err instanceof NotFoundException;
    check(label, expected, `unexpected error: ${err?.message}`);
  }
}

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [
      PrismaService,
      RedisService,
      PresenceService,
      PushNotificationService,
      ChatOutboxService,
      ChatService,
    ],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  const chat = moduleRef.get(ChatService);
  await prisma.$connect();

  const createdUserIds: string[] = [];

  try {
    console.log('\n── Seeding users ───────────────────────────────────────────');
    for (const email of Object.values(emails)) {
      const user = await prisma.user.create({
        data: {
          email,
          password: 'x',
          firstName: 'Smoke',
          lastName: 'Test',
          role: 'BUSINESS',
        },
      });
      createdUserIds.push(user.id);
    }
    const [ownerId, memberId, admin2Id] = createdUserIds;
    console.log(`  created 3 users`);

    console.log('\n── 1. Group creation + ownership ───────────────────────────');
    const created = await chat.createGroupConversation(ownerId, {
      title: 'Smoke Test Group',
      participantIds: [memberId, admin2Id],
    });
    check('group is created', Boolean(created?.id), created);
    check('creator is an ADMIN', created.role === 'ADMIN', created.role);
    check('creator is the owner', created.isOwner === true, created.isOwner);
    check(
      'other members are MEMBERs',
      created.participants.filter((p) => p.userId !== ownerId).every((p) => p.role === 'MEMBER'),
      created.participants.map((p) => [p.userId, p.role]),
    );
    check(
      'owner is flagged on the participant list',
      created.participants.find((p) => p.userId === ownerId)?.isOwner === true,
    );
    const groupId = created.id;

    console.log('\n── 2. Members can chat ─────────────────────────────────────');
    const memberMsg = await chat.sendMessage(memberId, {
      conversationId: groupId,
      content: 'Hello from the member',
    });
    check('member message is accepted', Boolean(memberMsg?.id), memberMsg);

    console.log('\n── 3. Owner switches the group to admin-only ───────────────');
    const toggled = await chat.updateGroupSettings(ownerId, groupId, { isAdminOnly: true });
    check('isAdminOnly is now true', toggled.isAdminOnly === true, toggled.isAdminOnly);

    console.log('\n── 4. Admin-only enforcement ───────────────────────────────');
    await expectReject('member cannot post in an admin-only group', () =>
      chat.sendMessage(memberId, { conversationId: groupId, content: 'Should be blocked' }),
    );
    const adminMsg = await chat.sendMessage(ownerId, {
      conversationId: groupId,
      content: 'Admins can still post',
    });
    check('admin can still post', Boolean(adminMsg?.id), adminMsg);

    await expectReject('a member cannot change group settings', () =>
      chat.updateGroupSettings(memberId, groupId, { isAdminOnly: false }),
    );

    console.log('\n── 5. Promotion restores posting ───────────────────────────');
    await chat.setParticipantRole(ownerId, groupId, admin2Id, 'ADMIN');
    const promotedMsg = await chat.sendMessage(admin2Id, {
      conversationId: groupId,
      content: 'Promoted, so I can post',
    });
    check('promoted admin can post', Boolean(promotedMsg?.id), promotedMsg);

    console.log('\n── 6. Owner protections ────────────────────────────────────');
    await expectReject('the owner cannot be demoted', () =>
      chat.setParticipantRole(admin2Id, groupId, ownerId, 'MEMBER'),
    );
    await expectReject('the owner cannot be removed', () =>
      chat.removeParticipant(admin2Id, groupId, ownerId),
    );

    console.log('\n── 7. Ownership transfer ───────────────────────────────────');
    const transferred = await chat.transferOwnership(ownerId, groupId, admin2Id);
    // The response is the CALLER's view: the previous owner is no longer the
    // owner, which is exactly what should come back.
    check('previous owner is no longer the owner', transferred.isOwner === false, transferred.isOwner);
    check(
      'new owner participant row is an owner',
      transferred.participants.find((p) => p.userId === admin2Id)?.isOwner === true,
    );
    const newOwnerView = await chat.getConversation(admin2Id, groupId);
    check('new owner sees isOwner = true', newOwnerView.isOwner === true, newOwnerView.isOwner);
    await expectReject('the previous owner can no longer transfer ownership', () =>
      chat.transferOwnership(ownerId, groupId, memberId),
    );

    console.log('\n── 8. Re-opening the group to members ──────────────────────');
    const reopened = await chat.updateGroupSettings(admin2Id, groupId, { isAdminOnly: false });
    check('isAdminOnly is false again', reopened.isAdminOnly === false, reopened.isAdminOnly);
    const memberAgain = await chat.sendMessage(memberId, {
      conversationId: groupId,
      content: 'Back to normal',
    });
    check('member can post again', Boolean(memberAgain?.id), memberAgain);

    console.log('\n── 9. Direct conversations are unaffected ──────────────────');
    const direct = await chat.getOrCreateDirectConversation(ownerId, memberId);
    const directMsg = await chat.sendMessage(memberId, {
      conversationId: direct.id,
      content: 'Direct hello',
    });
    check('direct message is accepted', Boolean(directMsg?.id), directMsg);
  } finally {
    console.log('\n── Cleanup ─────────────────────────────────────────────────');
    await prisma.conversation.deleteMany({
      where: { participants: { some: { userId: { in: createdUserIds } } } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
    console.log('  removed test users and conversations');
  }

  console.log(
    failures === 0
      ? '\n🎉 ALL GROUP MESSAGING CHECKS PASSED\n'
      : `\n💥 ${failures} CHECK(S) FAILED\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
