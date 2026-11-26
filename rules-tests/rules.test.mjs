// Firestore rules tests: replays every EzySplit app flow against firestore.rules
// in the local emulator. Run: npm test   (needs Java for the emulator)
import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, test} from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

let env;
const db = uid => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ezysplit',
    firestore: {rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')},
  });
});
after(async () => env.cleanup());

// alice = admin of g1, bob = member of g1, carol = outsider, dave = joiner.
// g2 = locked group of alice.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    for (const uid of ['alice', 'bob', 'carol', 'dave']) {
      await setDoc(doc(f, 'users', uid), {name: uid, upiId: `${uid}@upi`, fcmToken: `t-${uid}`, groupIds: uid === 'alice' || uid === 'bob' ? ['g1'] : []});
    }
    await setDoc(doc(f, 'users', 'alice', 'notifications', 'n1'), {text: 'hi'});
    await setDoc(doc(f, 'groups', 'g1'), {name: 'Goa', createdBy: 'alice', memberIds: ['alice', 'bob'], joinCode: 'ABC123', isLocked: false, currency: 'INR', type: 'group'});
    await setDoc(doc(f, 'groups', 'g1', 'members', 'alice'), {uid: 'alice', role: 'admin', active: true});
    await setDoc(doc(f, 'groups', 'g1', 'members', 'bob'), {uid: 'bob', role: 'member', active: true});
    await setDoc(doc(f, 'groups', 'g1', 'expenses', 'e1'), {description: 'Dinner', amount: 400, createdBy: 'bob'});
    await setDoc(doc(f, 'groups', 'g1', 'expenses', 'e2'), {description: 'Cab', amount: 300, createdBy: 'alice'});
    await setDoc(doc(f, 'groups', 'g1', 'settlements', 's1'), {fromUid: 'bob', toUid: 'alice', amount: 100});
    await setDoc(doc(f, 'groups', 'g2'), {name: 'Locked', createdBy: 'alice', memberIds: ['alice'], joinCode: 'LOCK11', isLocked: true});
    await setDoc(doc(f, 'groups', 'g2', 'members', 'alice'), {uid: 'alice', role: 'admin', active: true});
    await setDoc(doc(f, 'appConfig', 'global'), {minVersion: 1});
    await setDoc(doc(f, 'aiAccess', 'alice'), {enabled: true});
  });
});

describe('signed out', () => {
  test('can read appConfig and announcements', async () => {
    await assertSucceeds(getDoc(doc(db(), 'appConfig', 'global')));
    await assertSucceeds(getDocs(query(collection(db(), 'announcements'), where('active', '==', true))));
  });
  test('cannot read groups, expenses or users', async () => {
    await assertFails(getDoc(doc(db(), 'groups', 'g1')));
    await assertFails(getDocs(collection(db(), 'groups', 'g1', 'expenses')));
    await assertFails(getDoc(doc(db(), 'users', 'alice')));
  });
  test('cannot write anything', async () => {
    await assertFails(setDoc(doc(db(), 'groups', 'g1', 'expenses', 'x'), {createdBy: 'x'}));
    await assertFails(deleteDoc(doc(db(), 'groups', 'g1')));
  });
});

describe('create group', () => {
  test('full createGroup flow works', async () => {
    const f = db('carol');
    await assertSucceeds(getDocs(query(collection(f, 'groups'), where('joinCode', '==', 'NEW999'), limit(1))));
    await assertSucceeds(setDoc(doc(f, 'groups', 'g3'), {name: 'Flat', createdBy: 'carol', memberIds: ['carol'], joinCode: 'NEW999', isLocked: false, type: 'group'}));
    await assertSucceeds(setDoc(doc(f, 'groups', 'g3', 'members', 'carol'), {uid: 'carol', role: 'admin', active: true}));
    await assertSucceeds(setDoc(doc(f, 'users', 'carol'), {groupIds: arrayUnion('g3')}, {merge: true}));
  });
  test('personal group works', async () => {
    await assertSucceeds(setDoc(doc(db('carol'), 'groups', 'p1'), {name: 'Me', createdBy: 'carol', memberIds: ['carol'], type: 'personal'}));
  });
  test('cannot create a group for someone else or with extra members', async () => {
    await assertFails(setDoc(doc(db('carol'), 'groups', 'g4'), {createdBy: 'alice', memberIds: ['alice']}));
    await assertFails(setDoc(doc(db('carol'), 'groups', 'g4'), {createdBy: 'carol', memberIds: ['carol', 'bob']}));
  });
  test('creator can roll back a half-created group', async () => {
    const f = db('carol');
    await setDoc(doc(f, 'groups', 'g3'), {createdBy: 'carol', memberIds: ['carol']});
    await assertSucceeds(deleteDoc(doc(f, 'groups', 'g3')));
  });
});

describe('outsiders', () => {
  test('can get a group by id (join screen) but not its data', async () => {
    const f = db('carol');
    await assertSucceeds(getDoc(doc(f, 'groups', 'g1')));
    await assertFails(getDocs(collection(f, 'groups', 'g1', 'expenses')));
    await assertFails(getDocs(collection(f, 'groups', 'g1', 'members')));
    await assertFails(getDocs(collection(f, 'groups', 'g1', 'settlements')));
  });
  test('cannot list groups without limit(1)', async () => {
    await assertFails(getDocs(collection(db('carol'), 'groups')));
    await assertSucceeds(getDocs(query(collection(db('carol'), 'groups'), where('joinCode', '==', 'ABC123'), limit(1))));
  });
  test('cannot write into a group', async () => {
    const f = db('carol');
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'expenses', 'x'), {createdBy: 'carol'}));
    await assertFails(updateDoc(doc(f, 'groups', 'g1'), {memberIds: arrayUnion('carol')}));
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'members', 'carol'), {role: 'admin'}));
    await assertFails(deleteDoc(doc(f, 'groups', 'g1')));
  });
  test('backend-only collections are closed', async () => {
    await assertFails(getDoc(doc(db('alice'), 'aiAccess', 'alice')));
    await assertFails(setDoc(doc(db('alice'), 'feedbacks', 'x'), {text: 'x'}));
  });
});

describe('join a group', () => {
  test('joiner flow: read group, request, find admins', async () => {
    const f = db('dave');
    await assertSucceeds(getDoc(doc(f, 'groups', 'g1')));
    await assertSucceeds(getDoc(doc(f, 'groups', 'g1', 'joinRequests', 'dave')));
    await assertSucceeds(setDoc(doc(f, 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending', displayName: 'Dave'}));
    await assertSucceeds(getDocs(collection(f, 'groups', 'g1', 'members')));
    await assertSucceeds(getDoc(doc(f, 'users', 'alice')));
  });
  test('a declined joiner can ask again', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'declined'}));
    await assertSucceeds(setDoc(doc(db('dave'), 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending'}));
  });
  test('cannot request to join a locked group', async () => {
    await assertFails(setDoc(doc(db('dave'), 'groups', 'g2', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending'}));
  });
  test('cannot approve yourself or skip the request', async () => {
    const f = db('dave');
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'approved'}));
    await assertFails(updateDoc(doc(f, 'groups', 'g1'), {memberIds: arrayUnion('dave')}));
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'joinRequests', 'carol'), {uid: 'carol', status: 'pending'}));
  });
  test('admin approves: memberIds, member doc, user groupIds, request', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending'}));
    const f = db('alice');
    await assertSucceeds(getDocs(query(collection(f, 'groups', 'g1', 'joinRequests'), where('status', '==', 'pending'))));
    await assertSucceeds(updateDoc(doc(f, 'groups', 'g1'), {memberIds: arrayUnion('dave')}));
    await assertSucceeds(setDoc(doc(f, 'groups', 'g1', 'members', 'dave'), {uid: 'dave', role: 'member', active: true}));
    await assertSucceeds(setDoc(doc(f, 'users', 'dave'), {groupIds: arrayUnion('g1')}, {merge: true}));
    await assertSucceeds(updateDoc(doc(f, 'groups', 'g1', 'joinRequests', 'dave'), {status: 'approved', respondedAt: 'now'}));
  });
  test('admin declines', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending'}));
    await assertSucceeds(updateDoc(doc(db('alice'), 'groups', 'g1', 'joinRequests', 'dave'), {status: 'declined'}));
  });
  test('a plain member cannot approve', async () => {
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'groups', 'g1', 'joinRequests', 'dave'), {uid: 'dave', status: 'pending'}));
    const f = db('bob');
    await assertFails(updateDoc(doc(f, 'groups', 'g1'), {memberIds: arrayUnion('dave')}));
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'members', 'dave'), {uid: 'dave', role: 'member'}));
    await assertFails(updateDoc(doc(f, 'groups', 'g1', 'joinRequests', 'dave'), {status: 'approved'}));
  });
});

describe('expenses', () => {
  test('members read expenses and settlements', async () => {
    await assertSucceeds(getDocs(collection(db('bob'), 'groups', 'g1', 'expenses')));
    await assertSucceeds(getDocs(collection(db('bob'), 'groups', 'g1', 'settlements')));
  });
  test('add only as yourself', async () => {
    await assertSucceeds(setDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e3'), {amount: 50, createdBy: 'bob'}));
    await assertFails(setDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e4'), {amount: 50, createdBy: 'alice'}));
  });
  test('edit only your own, and createdBy stays', async () => {
    await assertSucceeds(updateDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e1'), {amount: 450, editHistory: arrayUnion({at: 'now'})}));
    await assertFails(updateDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e2'), {amount: 1}));
    await assertFails(updateDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e1'), {createdBy: 'alice'}));
  });
  test('soft delete your own: log then delete', async () => {
    const f = db('bob');
    await assertSucceeds(setDoc(doc(f, 'groups', 'g1', 'deletedExpenses', 'e1'), {description: 'Dinner', deletedAt: 'now'}));
    await assertSucceeds(deleteDoc(doc(f, 'groups', 'g1', 'expenses', 'e1')));
  });
  test("cannot delete someone else's expense", async () => {
    await assertFails(deleteDoc(doc(db('bob'), 'groups', 'g1', 'expenses', 'e2')));
  });
  test('settlements are append-only', async () => {
    await assertSucceeds(setDoc(doc(db('bob'), 'groups', 'g1', 'settlements', 's2'), {fromUid: 'bob', toUid: 'alice', amount: 50}));
    await assertFails(updateDoc(doc(db('bob'), 'groups', 'g1', 'settlements', 's1'), {amount: 1}));
    await assertFails(deleteDoc(doc(db('bob'), 'groups', 'g1', 'settlements', 's1')));
  });
});

describe('group admin', () => {
  test('admin renames, locks, adds and removes guests', async () => {
    const f = db('alice');
    await assertSucceeds(updateDoc(doc(f, 'groups', 'g1'), {name: 'Goa 2026'}));
    await assertSucceeds(updateDoc(doc(f, 'groups', 'g1'), {isLocked: true}));
    await assertSucceeds(setDoc(doc(f, 'groups', 'g1', 'members', 'guest_x'), {uid: 'guest_x', isGuest: true, active: true}));
    await assertSucceeds(updateDoc(doc(f, 'groups', 'g1', 'members', 'guest_x'), {active: false}));
  });
  test('a plain member cannot rename, lock or add guests', async () => {
    const f = db('bob');
    await assertFails(updateDoc(doc(f, 'groups', 'g1'), {name: 'Hacked'}));
    await assertFails(updateDoc(doc(f, 'groups', 'g1'), {isLocked: true}));
    await assertFails(setDoc(doc(f, 'groups', 'g1', 'members', 'guest_y'), {uid: 'guest_y', isGuest: true}));
    await assertFails(updateDoc(doc(f, 'groups', 'g1', 'members', 'bob'), {role: 'admin'}));
  });
  test('admin deletes the whole group (deleteGroup order)', async () => {
    const f = db('alice');
    const b1 = writeBatch(f);
    for (const id of ['e1', 'e2']) b1.delete(doc(f, 'groups', 'g1', 'expenses', id));
    b1.delete(doc(f, 'groups', 'g1', 'settlements', 's1'));
    b1.delete(doc(f, 'groups', 'g1', 'members', 'alice'));
    b1.delete(doc(f, 'groups', 'g1', 'members', 'bob'));
    await assertSucceeds(b1.commit());
    const b2 = writeBatch(f);
    for (const uid of ['alice', 'bob']) b2.update(doc(f, 'users', uid), {groupIds: arrayRemove('g1')});
    await assertSucceeds(b2.commit());
    await assertSucceeds(deleteDoc(doc(f, 'groups', 'g1')));
  });
  test('a plain member cannot delete the group', async () => {
    await assertFails(deleteDoc(doc(db('bob'), 'groups', 'g1')));
  });
});

describe('leave group', () => {
  test('member leaves in one batch, then updates own groupIds', async () => {
    const f = db('bob');
    const b = writeBatch(f);
    b.update(doc(f, 'groups', 'g1'), {memberIds: arrayRemove('bob')});
    b.update(doc(f, 'groups', 'g1', 'members', 'bob'), {active: false, leftAt: 'now'});
    await assertSucceeds(b.commit());
    await assertSucceeds(updateDoc(doc(f, 'users', 'bob'), {groupIds: arrayRemove('g1')}));
  });
  test('a member cannot remove someone else', async () => {
    await assertFails(updateDoc(doc(db('bob'), 'groups', 'g1'), {memberIds: arrayRemove('alice')}));
  });
  test('after leaving, the group data is closed', async () => {
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'groups', 'g1'), {memberIds: ['alice']}));
    await assertFails(getDocs(collection(db('bob'), 'groups', 'g1', 'expenses')));
  });
});

describe('users', () => {
  test('signed-in users read a profile by id, never list all', async () => {
    await assertSucceeds(getDoc(doc(db('bob'), 'users', 'alice')));
    await assertFails(getDocs(collection(db('bob'), 'users')));
  });
  test('own profile: UPI id, delete account', async () => {
    await assertSucceeds(setDoc(doc(db('bob'), 'users', 'bob'), {upiId: 'new@upi'}, {merge: true}));
    await assertSucceeds(deleteDoc(doc(db('bob'), 'users', 'bob')));
  });
  test("cannot change someone else's UPI id or token", async () => {
    await assertFails(setDoc(doc(db('carol'), 'users', 'bob'), {upiId: 'evil@upi'}, {merge: true}));
    await assertFails(updateDoc(doc(db('carol'), 'users', 'bob'), {fcmToken: 'x'}));
    await assertFails(deleteDoc(doc(db('carol'), 'users', 'bob')));
  });
  test('notifications: read your own only, never write', async () => {
    await assertSucceeds(getDocs(collection(db('alice'), 'users', 'alice', 'notifications')));
    await assertFails(getDocs(collection(db('bob'), 'users', 'alice', 'notifications')));
    await assertFails(setDoc(doc(db('alice'), 'users', 'alice', 'notifications', 'n2'), {text: 'x'}));
  });
});
