import { TypingService } from './typing.service';

describe('TypingService', () => {
  let service: TypingService;

  beforeEach(() => {
    service = new TypingService();
  });

  it('should track typing users and clean up on stop', () => {
    const list1 = service.startTyping('conv-1', 'user-1', 'Alice');
    expect(list1).toHaveLength(1);
    expect(list1[0].userName).toBe('Alice');

    const list2 = service.startTyping('conv-1', 'user-2', 'Bob');
    expect(list2).toHaveLength(2);

    const list3 = service.stopTyping('conv-1', 'user-1');
    expect(list3).toHaveLength(1);
    expect(list3[0].userName).toBe('Bob');
  });

  it('should automatically prune expired typing states', () => {
    // start typing with negative ttl (already expired)
    service.startTyping('conv-1', 'user-1', 'Alice', -1);
    const active = service.getTypingUsers('conv-1');
    expect(active).toHaveLength(0);
  });
});
