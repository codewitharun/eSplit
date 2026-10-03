// src/hooks/useAdminJoinRequests.ts
// Pending join requests across EVERY group the current user administers
// (not just the open one) - what the Notifications screen lists.
//
// Now a thin reader over useJoinRequestsStore, which <JoinRequestsSync />
// keeps live. "Admin" is the member entry's role === 'admin' (previously
// it was "created the group", which missed admins who didn't create it).
import {
  type PendingJoinRequest,
  usePendingRequestsList,
} from '../store/useJoinRequestsStore';

export type AdminJoinRequest = PendingJoinRequest;

export function useAdminJoinRequests(): AdminJoinRequest[] {
  return usePendingRequestsList();
}
