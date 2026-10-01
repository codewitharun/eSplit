import {AssistantData, runAssistantTool} from '../assistantTools';

const me = 'u_me';
const friend = 'u_friend';

const at = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).toISOString();

const data: AssistantData = {
  uid: me,
  groups: [
    {
      group: {
        id: 'g1',
        name: 'Goa Trip',
        currency: 'INR',
        createdBy: me,
        createdAt: at(2026, 8, 1),
        isLocked: false,
        joinCode: 'ABC123',
        memberIds: [me, friend],
      },
      members: [
        {
          uid: me,
          displayName: 'Arun',
          joinedAt: '',
          role: 'admin',
          active: true,
        },
        {
          uid: friend,
          displayName: 'Rahul',
          joinedAt: '',
          role: 'member',
          active: true,
        },
      ],
      expenses: [
        {
          id: 'e1',
          description: 'Dinner',
          amount: 1000,
          currency: 'INR',
          category: 'food',
          paidBy: me,
          splitType: 'equal',
          shares: {[me]: 500, [friend]: 500},
          createdBy: me,
          createdAt: at(2026, 9, 10),
        },
        {
          id: 'e2',
          description: 'Bread + 1 item',
          amount: 42,
          currency: 'INR',
          category: 'groceries',
          paidBy: friend,
          splitType: 'equal',
          shares: {[me]: 21, [friend]: 21},
          items: [
            {name: 'Bread', price: 12},
            {name: 'Milk', price: 30},
          ],
          createdBy: friend,
          createdAt: at(2026, 10, 1),
        },
        {
          id: 'e3',
          description: 'Cab (not mine)',
          amount: 300,
          currency: 'INR',
          category: 'travel',
          paidBy: friend,
          splitType: 'exact',
          shares: {[friend]: 300},
          createdBy: friend,
          createdAt: at(2026, 9, 12),
        },
      ],
      settlements: [],
    },
  ],
};

const now = new Date(2026, 9, 2, 12); // 2 Oct 2026

describe('runAssistantTool', () => {
  it('summarises only the user’s own share, by category', () => {
    const r = runAssistantTool('get_spending_summary', {}, data, now);
    expect(r.your_spending).toEqual({INR: '₹521.00'});
    expect(r.you_paid_out_of_pocket).toEqual({INR: '₹1000.00'});
    expect(r.expense_count).toBe(2);
    expect(r.by_category[0]).toEqual({name: 'Food', your_share: '₹500.00'});
  });

  it('filters by inclusive date range', () => {
    const r = runAssistantTool(
      'get_spending_summary',
      {start_date: '2026-10-01', end_date: '2026-10-31'},
      data,
      now,
    );
    expect(r.your_spending).toEqual({INR: '₹21.00'});
  });

  it('finds expenses by item name and shows the items', () => {
    const r = runAssistantTool('find_expenses', {search: 'milk'}, data, now);
    expect(r.total_matches).toBe(1);
    expect(r.expenses[0].items).toBe('Bread ₹12.00, Milk ₹30.00');
    expect(r.expenses[0].paid_by).toBe('Rahul');
  });

  it('sorts largest first', () => {
    const r = runAssistantTool('find_expenses', {sort: 'largest'}, data, now);
    expect(r.expenses[0].description).toBe('Dinner');
  });

  it('gives monthly totals ending with the current month', () => {
    const r = runAssistantTool('get_monthly_spending', {months: 2}, data, now);
    expect(r.months.map((m: any) => m.month)).toEqual([
      'Sep 2026',
      'Oct 2026 (current, in progress)',
    ]);
    expect(r.months[0].your_spending).toEqual({INR: '₹500.00'});
  });

  it('computes balances with names', () => {
    const r = runAssistantTool('get_balances', {}, data, now);
    // me: paid 1000, share 521 -> +479. friend owes me 479.
    expect(r.groups[0].status).toBe('you are owed ₹479.00 in total');
    expect(r.groups[0].details).toEqual(['Rahul owes you ₹479.00']);
  });

  it('matches groups by partial name and reports unknown ones', () => {
    expect(
      runAssistantTool('get_spending_summary', {group: 'goa'}, data, now)
        .your_spending,
    ).toEqual({INR: '₹521.00'});
    expect(
      runAssistantTool('get_spending_summary', {group: 'Manali'}, data, now)
        .error,
    ).toContain('Goa Trip');
  });

  it('answers unknown tools with an error instead of crashing', () => {
    expect(
      runAssistantTool('delete_everything', {}, data, now).error,
    ).toBeTruthy();
  });
});
