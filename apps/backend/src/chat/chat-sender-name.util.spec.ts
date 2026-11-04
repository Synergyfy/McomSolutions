import { resolveChatSenderName } from './chat-sender-name.util';

describe('resolveChatSenderName', () => {
  it('prefers the formatted senderName used by REST sends', () => {
    expect(
      resolveChatSenderName({ senderName: 'E2E Business Ltd' }),
    ).toBe('E2E Business Ltd');
  });

  it('uses the business name from a Prisma sender (socket path)', () => {
    expect(
      resolveChatSenderName({
        sender: {
          email: 'am@example.com',
          firstName: 'E2E',
          lastName: 'Manager',
          businessProfile: { businessName: 'E2E Business Ltd' },
        },
      }),
    ).toBe('E2E Business Ltd');
  });

  it('falls back to the person name, then email local-part', () => {
    expect(
      resolveChatSenderName({
        sender: { email: 'am@example.com', firstName: 'E2E', lastName: 'Manager' },
      }),
    ).toBe('E2E Manager');

    expect(
      resolveChatSenderName({ sender: { email: 'am@example.com' } }),
    ).toBe('am');
  });

  it('only uses "Someone" when no identity is available', () => {
    expect(resolveChatSenderName({})).toBe('Someone');
  });
});
