/**
 * Security Rules Specification Verification Harness (Phase 0 TDD)
 * Validates the 12 adversarial "Dirty Dozen" payloads against Firestore security invariants.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenPayloads: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Write',
    collectionPath: 'media/vid_01',
    operation: 'create',
    payload: { authorId: 'user_unverified', email_verified: false, title: 'Test' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Media',
    collectionPath: 'media/vid_02',
    operation: 'create',
    payload: { id: 'vid_02', authorId: 'victim_uid', title: 'Spoofed' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Ghost Field Shadow Injection',
    collectionPath: 'media/vid_03',
    operation: 'create',
    payload: { id: 'vid_03', authorId: 'u1', isFeaturedAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Counter Manipulation on Create',
    collectionPath: 'media/vid_04',
    operation: 'create',
    payload: { id: 'vid_04', authorId: 'u1', likesCount: 99999 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Non-Atomic Like Desync',
    collectionPath: 'media/vid_01/likes/u1',
    operation: 'create',
    payload: { userId: 'u1', mediaId: 'vid_01' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unauthorized Metadata Edit',
    collectionPath: 'media/vid_01',
    operation: 'update',
    payload: { title: 'Hijacked Title' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery',
    collectionPath: 'comments/c_01',
    operation: 'create',
    payload: { id: 'c_01', authorId: 'u1', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-User Profile Read',
    collectionPath: 'users/victim_uid',
    operation: 'get',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Blanket Subscription List Query',
    collectionPath: 'subscriptions',
    operation: 'list',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning Attack',
    collectionPath: `media/${'a'.repeat(200)}`,
    operation: 'create',
    payload: { title: 'Long ID' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized Array Exhaustion',
    collectionPath: 'users/u1',
    operation: 'update',
    payload: { preferredCategories: Array.from({ length: 25 }, (_, i) => `cat_${i}`) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-User Comment Deletion',
    collectionPath: 'comments/c_01',
    operation: 'delete',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
