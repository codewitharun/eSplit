/**
 * One-time migration: Esplitusers/Esplitgroups (old, displayName-keyed
 * expenses) -> users/groups (new, uid-keyed splits + settlements).
 *
 * This does NOT run automatically and is not wired into the app. Run it
 * yourself, once, after reviewing the dry-run output:
 *
 *   1. Download a Firebase service account key for the EzySplit project
 *      (Project settings -> Service accounts -> Generate new private key).
 *   2. GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *        node scripts/migrateToLedgerSchema.js --dry-run
 *   3. Read the dry-run report. Any expense whose displayName fields can't
 *      be confidently matched to a uid (duplicate names, a member who left
 *      and rejoined, a name containing "." which breaks a Firestore field
 *      path) is listed under "unmatched" instead of guessed at.
 *   4. Once the report looks right: rerun without --dry-run to write.
 *
 * The migration is additive — it writes new collections and leaves
 * Esplitusers/Esplitgroups untouched, so the old app keeps working until
 * you cut the screens over.
 */
const admin = require('firebase-admin');

admin.initializeApp({credential: admin.credential.applicationDefault()});
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  const report = {groupsMigrated: 0, expensesMigrated: 0, unmatched: []};

  const usersSnap = await db.collection('Esplitusers').get();
  for (const userDoc of usersSnap.docs) {
    const u = userDoc.data();
    const newUser = {
      uid: userDoc.id,
      displayName: u.displayName || '',
      email: u.email || '',
      photoUrl: u.photoURL || '',
      defaultCurrency: 'INR',
      groupIds: u.groupKeys || [],
      fcmToken: u.tokens || null,
    };
    if (!DRY_RUN) {
      await db.collection('users').doc(userDoc.id).set(newUser, {merge: true});
    }
  }

  const groupsSnap = await db.collection('Esplitgroups').get();
  for (const groupDoc of groupsSnap.docs) {
    const groupId = groupDoc.id;
    const g = groupDoc.data();
    const members = Array.isArray(g.members) ? g.members : [];

    // displayName -> uid, for matching legacy per-member expense fields.
    // A name shared by two members can't be resolved safely - both are
    // recorded as unmatched instead of picking one arbitrarily.
    const nameToUid = {};
    const ambiguousNames = new Set();
    members.forEach(m => {
      if (nameToUid[m.displayName] && nameToUid[m.displayName] !== m.id) {
        ambiguousNames.add(m.displayName);
      }
      nameToUid[m.displayName] = m.id;
    });

    const newGroup = {
      name: g.groupName || groupId,
      createdBy: g.createdBy?.id || null,
      currency: 'INR',
      isLocked: !!g.isLocked,
      memberIds: members.map(m => m.id),
      createdAt: g.createdAt || new Date().toISOString(),
    };

    if (!DRY_RUN) {
      await db.collection('groups').doc(groupId).set(newGroup, {merge: true});
      for (const m of members) {
        await db
          .collection('groups')
          .doc(groupId)
          .collection('members')
          .doc(m.id)
          .set(
            {
              uid: m.id,
              displayName: m.displayName,
              photoUrl: m.photoUrl || '',
              joinedAt: m.joinDate || newGroup.createdAt,
              role: m.id === newGroup.createdBy ? 'admin' : 'member',
              active: true,
            },
            {merge: true},
          );
      }
    }
    report.groupsMigrated++;

    const expensesSnap = await groupDoc.ref.collection('expenses').get();
    for (const expenseDoc of expensesSnap.docs) {
      const e = expenseDoc.data();
      const reserved = [
        'description',
        'totalExpense',
        'paidBy',
        'timestamp',
        'id',
      ];
      const shareFields = Object.keys(e).filter(k => !reserved.includes(k));

      const splits = {};
      let ok = true;
      for (const name of shareFields) {
        if (ambiguousNames.has(name) || !nameToUid[name]) {
          ok = false;
          report.unmatched.push({groupId, expenseId: expenseDoc.id, name});
          continue;
        }
        splits[nameToUid[name]] = e[name];
      }
      const paidByUid = nameToUid[e.paidBy];
      if (!paidByUid) {
        ok = false;
        report.unmatched.push({
          groupId,
          expenseId: expenseDoc.id,
          name: e.paidBy,
        });
      }

      if (ok && !DRY_RUN) {
        const newExpenseRef = db
          .collection('groups')
          .doc(groupId)
          .collection('expenses')
          .doc(expenseDoc.id);
        await newExpenseRef.set({
          description: e.description,
          amount: e.totalExpense,
          currency: 'INR',
          paidBy: paidByUid,
          splitType: 'equal', // best-effort: legacy data was always equal-split
          createdBy: paidByUid,
          createdAt: e.timestamp || new Date().toISOString(),
        });
        for (const [uid, shareAmount] of Object.entries(splits)) {
          await newExpenseRef
            .collection('splits')
            .doc(uid)
            .set({uid, shareAmount});
        }
      }
      if (ok) {
        report.expensesMigrated++;
      }
    }
  }

  console.log(
    DRY_RUN
      ? '--- DRY RUN (nothing written) ---'
      : '--- MIGRATION COMPLETE ---',
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.unmatched.length) {
    console.log(
      `\n${report.unmatched.length} expense share(s) could not be matched to a uid — see "unmatched" above. These need a manual look before you trust the migrated balances.`,
    );
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
