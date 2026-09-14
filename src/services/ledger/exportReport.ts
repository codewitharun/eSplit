// src/services/ledger/exportReport.ts
// PDF + Excel export for a group's ledger, both driven by the ledger hook's
// data instead of re-deriving totals inline.
//
// PDF: a branded HTML report (matches the app's blue/green theme) with a
// summary, per-person balances, the full expense history, and a
// settlements history table.
//
// Excel: a genuine multi-sheet .xlsx workbook (via SheetJS `xlsx` — pure
// JS, no native module) with separate "Summary", "Expenses", "Balances"
// and "Settlements" sheets, so the file opens cleanly in Excel/Sheets
// with real columns instead of a flat CSV dump.

import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as XLSX from 'xlsx';
import {Expense, GroupMember, Settlement} from './types';
import {formatMoney} from './currency';

const BRAND = {
  blue: '#0082B0',
  blueStrong: '#00688D',
  green: '#3ECF8E',
  rose: '#F0819C',
  ink: '#1B2436',
  inkSoft: '#5B6B8C',
  border: '#E4E9F2',
  surface: '#F5F8FF',
};

function fileBaseName(groupName: string) {
  const date = new Date();
  const monthYear = `${date.toLocaleString('default', {
    month: 'long',
  })}-${date.getFullYear()}`;
  const slug = groupName.trim().toLowerCase().replace(/\s+/g, '-');
  return `ezysplit-${slug}-${monthYear}`;
}

function globalFmtMoney(n: number, currency?: string | null) {
  return formatMoney(Math.abs(n), currency);
}

function fmtDate(iso: string | number) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/* PDF export                                                          */
/* ------------------------------------------------------------------ */

export async function exportGroupPdf(
  groupName: string,
  members: GroupMember[],
  expenses: Expense[],
  netBalances: Record<string, number>,
  totalSpent: number,
  settlements: Settlement[] = [],
  currency: string = 'INR',
): Promise<string> {
  const fileName = fileBaseName(groupName);
  const perPerson = members.length ? totalSpent / members.length : 0;
  const name = (uid: string) =>
    members.find(m => m.uid === uid)?.displayName || 'Someone';
  // Shadows the module-level fmtMoney for the rest of this function so
  // every existing fmtMoney(x) call below picks up this report's actual
  // currency without needing to be rewritten one by one.
  const fmtMoney = (n: number) => globalFmtMoney(n, currency);

  const sortedExpenses = [...expenses].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const sortedSettlements = [...settlements].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  const categoryTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const balanceRows = Object.entries(netBalances)
    .sort(([, a], [, b]) => b - a)
    .map(([uid, bal]) => {
      const positive = bal >= 0.005;
      const settled = Math.abs(bal) < 0.005;
      const color = settled
        ? BRAND.inkSoft
        : positive
        ? BRAND.green
        : BRAND.rose;
      const label = settled ? 'Settled up' : positive ? 'is owed' : 'owes';
      return `<tr>
        <td>${name(uid)}</td>
        <td class="muted">${label}</td>
        <td class="amount" style="color:${color};">${
        settled ? '—' : fmtMoney(bal)
      }</td>
      </tr>`;
    })
    .join('');

  const expenseRows =
    sortedExpenses
      .map(
        e => `<tr>
        <td>${fmtDate(e.createdAt)}</td>
        <td>${e.description}<div class="tag">${e.category}</div></td>
        <td>${name(e.paidBy)}</td>
        <td class="amount">${fmtMoney(e.amount)}</td>
      </tr>`,
      )
      .join('') ||
    '<tr><td colspan="4" class="muted center">No expenses recorded yet.</td></tr>';

  const settlementRows =
    sortedSettlements
      .map(
        s => `<tr>
        <td>${fmtDate(s.createdAt)}</td>
        <td>${name(s.fromUid)} → ${name(s.toUid)}</td>
        <td class="muted">${(s.method || 'other').toUpperCase()}</td>
        <td class="amount" style="color:${BRAND.green};">${fmtMoney(
          s.amount,
        )}</td>
      </tr>`,
      )
      .join('') ||
    '<tr><td colspan="4" class="muted center">No settlements recorded yet.</td></tr>';

  const categoryChips =
    Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(
        ([cat, amt]) =>
          `<span class="chip">${cat} <strong>${fmtMoney(amt)}</strong></span>`,
      )
      .join('') || '<span class="muted">—</span>';

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, Helvetica, Arial, sans-serif;
          color: ${BRAND.ink};
          margin: 0;
          padding: 28px 32px 40px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid ${BRAND.blue};
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .brand { font-size: 22px; font-weight: 800; color: ${
          BRAND.blueStrong
        }; }
        .brand span { color: ${BRAND.green}; }
        .meta { text-align: right; font-size: 11px; color: ${BRAND.inkSoft}; }
        h1 { font-size: 19px; margin: 0 0 2px; }
        .subtitle { color: ${
          BRAND.inkSoft
        }; font-size: 12px; margin-bottom: 18px; }
        .summary-grid {
          display: flex;
          gap: 12px;
          margin-bottom: 22px;
        }
        .summary-card {
          flex: 1;
          background: ${BRAND.surface};
          border: 1px solid ${BRAND.border};
          border-radius: 10px;
          padding: 14px 16px;
        }
        .summary-card .label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: ${BRAND.inkSoft};
          margin-bottom: 4px;
        }
        .summary-card .value { font-size: 19px; font-weight: 800; }
        h2 {
          font-size: 13.5px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: ${BRAND.blueStrong};
          margin: 26px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid ${BRAND.border};
        }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th {
          text-align: left;
          background: ${BRAND.surface};
          color: ${BRAND.inkSoft};
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          padding: 8px 10px;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid ${BRAND.border};
          vertical-align: top;
        }
        .amount { text-align: right; font-weight: 700; white-space: nowrap; }
        th.amount { text-align: right; }
        .muted { color: ${BRAND.inkSoft}; }
        .center { text-align: center; }
        .tag {
          font-size: 9.5px;
          color: ${BRAND.inkSoft};
          text-transform: capitalize;
        }
        .chip {
          display: inline-block;
          background: ${BRAND.surface};
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          padding: 5px 12px;
          margin: 0 6px 6px 0;
          font-size: 11px;
          text-transform: capitalize;
          color: ${BRAND.inkSoft};
        }
        .chip strong { color: ${BRAND.ink}; }
        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid ${BRAND.border};
          text-align: center;
          color: ${BRAND.inkSoft};
          font-size: 10.5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">Ezy<span>Split</span></div>
        <div class="meta">Generated ${new Date().toLocaleString('en-IN')}</div>
      </div>

      <h1>${groupName}</h1>
      <div class="subtitle">Expense report · ${members.length} member${
    members.length === 1 ? '' : 's'
  } · ${expenses.length} expense${expenses.length === 1 ? '' : 's'}</div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Total spent</div>
          <div class="value">${fmtMoney(totalSpent)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Per person (avg)</div>
          <div class="value">${fmtMoney(perPerson)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Settlements recorded</div>
          <div class="value">${settlements.length}</div>
        </div>
      </div>

      <h2>By category</h2>
      <div>${categoryChips}</div>

      <h2>Balances</h2>
      <table>
        <tr><th>Name</th><th>Status</th><th class="amount">Amount</th></tr>
        ${balanceRows}
      </table>

      <h2>Expense history</h2>
      <table>
        <tr><th>Date</th><th>Description</th><th>Paid by</th><th class="amount">Amount</th></tr>
        ${expenseRows}
      </table>

      <h2>Settlement history</h2>
      <table>
        <tr><th>Date</th><th>Transfer</th><th>Method</th><th class="amount">Amount</th></tr>
        ${settlementRows}
      </table>

      <div class="footer">Created with ❤️ by Arun Kumar · EzySplit</div>
    </body>
  </html>
  `;

  const file = await RNHTMLtoPDF.convert({
    html,
    fileName,
    directory: 'Download',
  });
  const publicPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
  await RNFS.copyFile(file.filePath, publicPath);
  await RNFS.unlink(file.filePath);
  return publicPath;
}

/* ------------------------------------------------------------------ */
/* Excel export (.xlsx, multi-sheet)                                   */
/* ------------------------------------------------------------------ */

export async function exportGroupExcel(
  groupName: string,
  members: GroupMember[],
  expenses: Expense[],
  netBalances: Record<string, number>,
  totalSpent: number,
  settlements: Settlement[] = [],
  currency: string = 'INR',
): Promise<string> {
  const fileName = fileBaseName(groupName);
  const name = (uid: string) =>
    members.find(m => m.uid === uid)?.displayName || 'Someone';
  const memberIds = members.map(m => m.uid);
  const perPerson = members.length ? totalSpent / members.length : 0;

  const wb = XLSX.utils.book_new();

  // --- Summary sheet ---
  // Amounts on this sheet are kept as raw numbers (not "€45.00" strings)
  // so Excel/Sheets can still sum/chart the column - the currency is
  // called out once here instead, so the file is still self-describing
  // for a currency other than INR.
  const summaryRows: (string | number)[][] = [
    ['EzySplit — Expense Report'],
    ['Group', groupName],
    ['Currency', currency],
    ['Generated', new Date().toLocaleString('en-IN')],
    [],
    ['Total spent', Number(totalSpent.toFixed(2))],
    ['Members', members.length],
    ['Expenses', expenses.length],
    ['Per person (avg)', Number(perPerson.toFixed(2))],
    ['Settlements recorded', settlements.length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{wch: 22}, {wch: 26}];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // --- Expenses sheet ---
  const expenseHeader = [
    'Date',
    'Description',
    'Category',
    'Paid By',
    'Split Type',
    'Amount',
    ...members.map(m => m.displayName),
  ];
  const expenseRows = [...expenses]
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map(e => [
      new Date(e.createdAt).toISOString().slice(0, 10),
      e.description,
      e.category,
      name(e.paidBy),
      e.splitType,
      Number(e.amount.toFixed(2)),
      ...memberIds.map(uid =>
        e.shares[uid] != null ? Number(e.shares[uid].toFixed(2)) : '',
      ),
    ]);
  const expenseSheet = XLSX.utils.aoa_to_sheet([expenseHeader, ...expenseRows]);
  expenseSheet['!cols'] = [
    {wch: 12},
    {wch: 26},
    {wch: 12},
    {wch: 16},
    {wch: 11},
    {wch: 11},
    ...members.map(() => ({wch: 14})),
  ];
  XLSX.utils.book_append_sheet(wb, expenseSheet, 'Expenses');

  // --- Balances sheet ---
  const balanceHeader = ['Name', 'Net Balance', 'Status'];
  const balanceRows = Object.entries(netBalances)
    .sort(([, a], [, b]) => b - a)
    .map(([uid, bal]) => [
      name(uid),
      Number(bal.toFixed(2)),
      Math.abs(bal) < 0.005 ? 'Settled up' : bal > 0 ? 'Is owed' : 'Owes',
    ]);
  const balanceSheet = XLSX.utils.aoa_to_sheet([balanceHeader, ...balanceRows]);
  balanceSheet['!cols'] = [{wch: 18}, {wch: 14}, {wch: 14}];
  XLSX.utils.book_append_sheet(wb, balanceSheet, 'Balances');

  // --- Settlements sheet ---
  const settlementHeader = ['Date', 'From', 'To', 'Amount', 'Method', 'Note'];
  const settlementRows = [...settlements]
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map(s => [
      new Date(s.createdAt).toISOString().slice(0, 10),
      name(s.fromUid),
      name(s.toUid),
      Number(s.amount.toFixed(2)),
      s.method || 'other',
      s.note || '',
    ]);
  const settlementSheet = XLSX.utils.aoa_to_sheet([
    settlementHeader,
    ...settlementRows,
  ]);
  settlementSheet['!cols'] = [
    {wch: 12},
    {wch: 16},
    {wch: 16},
    {wch: 11},
    {wch: 10},
    {wch: 24},
  ];
  XLSX.utils.book_append_sheet(wb, settlementSheet, 'Settlements');

  const base64 = XLSX.write(wb, {type: 'base64', bookType: 'xlsx'});
  const publicPath = `${RNFS.DownloadDirectoryPath}/${fileName}.xlsx`;
  await RNFS.writeFile(publicPath, base64, 'base64');
  return publicPath;
}

/* ------------------------------------------------------------------ */
/* Plain CSV export (kept for a lightweight/legacy option)             */
/* ------------------------------------------------------------------ */

export async function exportGroupCsv(
  groupName: string,
  members: GroupMember[],
  expenses: Expense[],
): Promise<string> {
  const fileName = fileBaseName(groupName);
  const name = (uid: string) =>
    members.find(m => m.uid === uid)?.displayName || uid;
  const memberIds = members.map(m => m.uid);

  const header = [
    'Date',
    'Description',
    'Category',
    'Paid By',
    'Amount',
    ...memberIds.map(name),
  ];
  const rows = expenses.map(e => [
    new Date(e.createdAt).toISOString().slice(0, 10),
    e.description.replace(/,/g, ' '),
    e.category,
    name(e.paidBy),
    e.amount.toFixed(2),
    ...memberIds.map(uid =>
      e.shares[uid] != null ? e.shares[uid].toFixed(2) : '',
    ),
  ]);

  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const publicPath = `${RNFS.DownloadDirectoryPath}/${fileName}.csv`;
  await RNFS.writeFile(publicPath, csv, 'utf8');
  return publicPath;
}
