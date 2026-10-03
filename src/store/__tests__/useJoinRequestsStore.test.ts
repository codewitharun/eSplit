import {
  countPending,
  flattenPending,
  useJoinRequestsStore,
  type PendingJoinRequest,
} from '../useJoinRequestsStore';

const req = (groupId: string, uid: string, requestedAt: string): PendingJoinRequest => ({
  uid,
  displayName: uid,
  status: 'pending',
  requestedAt,
  groupId,
  groupName: groupId,
});

describe('join requests store', () => {
  beforeEach(() => useJoinRequestsStore.getState().reset());

  it('counts per group and across groups, optionally excluding one', () => {
    const s = useJoinRequestsStore.getState();
    s.setGroup('g1', [req('g1', 'a', '2026-10-01'), req('g1', 'b', '2026-10-02')]);
    s.setGroup('g2', [req('g2', 'c', '2026-10-03')]);
    const {byGroup} = useJoinRequestsStore.getState();
    expect(byGroup.g1).toHaveLength(2);
    expect(countPending(byGroup)).toBe(3);
    expect(countPending(byGroup, 'g1')).toBe(1);
    expect(countPending(byGroup, 'nope')).toBe(3);
  });

  it('lists newest first and clears groups you no longer admin', () => {
    const s = useJoinRequestsStore.getState();
    s.setGroup('g1', [req('g1', 'old', '2026-09-01')]);
    s.setGroup('g2', [req('g2', 'new', '2026-10-05')]);
    expect(flattenPending(useJoinRequestsStore.getState().byGroup).map(r => r.uid)).toEqual([
      'new',
      'old',
    ]);
    s.clearGroup('g2');
    expect(countPending(useJoinRequestsStore.getState().byGroup)).toBe(1);
    s.clearGroup('missing'); // no-op
    s.reset();
    expect(useJoinRequestsStore.getState().byGroup).toEqual({});
  });
});
