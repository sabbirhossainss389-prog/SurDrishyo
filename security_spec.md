# Security Specification — SurDrishyo Firestore Rules

## 1. Data Invariants
1. **Owner-Only Profile & Preferences (`users/{userId}`)**: A user profile can only be read, created, updated, or deleted by the authenticated owner whose `uid` matches `userId` and whose email is verified. `uid` and `createdAt` are immutable.
2. **Creator Attribution & Counter Integrity (`media/{mediaId}`)**: Uploaded media items must declare `authorId == request.auth.uid`, initialize counters (`viewsCount`, `likesCount`, `commentsCount`) to `0`, and use `request.time` for timestamps. Updates are partitioned into explicit actions (owner metadata edit, `+1` view increment, atomic `+1/-1` like sync, `+1` comment sync).
3. **Atomic Like Synchronization (`media/{mediaId}/likes/{userId}`)**: A like document can only be created or deleted if the parent `media/{mediaId}` document exists and its `likesCount` is atomically updated in the same batch (`getAfter` check).
4. **Verified Comment Authorship (`comments/{commentId}`)**: Comments require verified authentication, strict length limits (`<= 800` chars), and `authorId == request.auth.uid`. Only the comment author can delete their comment.
5. **Private Subscriptions & YouTube Favorites (`subscriptions/{subId}`, `yt_likes/{likeId}`)**: Users can only list, read, create, and delete their own subscription and YouTube like documents (`resource.data.userId == request.auth.uid`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Write**: Attempt `create` on `/media/m1` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Media**: Attempt `create` on `/media/m1` with `authorId: "other_user"` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Injection**: Attempt `create` on `/media/m1` with extra key `isFeaturedAdmin: true` -> `PERMISSION_DENIED`.
4. **Counter Manipulation on Create**: Attempt `create` on `/media/m1` with `likesCount: 99999` -> `PERMISSION_DENIED`.
5. **Non-Atomic Like Desync**: Attempt `create` on `/media/m1/likes/u1` without updating `media/m1.likesCount` in the same batch -> `PERMISSION_DENIED`.
6. **Unauthorized Metadata Edit**: Attempt `update` on `/media/m1` title by a non-owner user -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Attempt `create` on `/comments/c1` with a backdated `createdAt` instead of `request.serverTimestamp()` -> `PERMISSION_DENIED`.
8. **Cross-User PII/Preference Read**: Attempt `get` on `/users/victim_uid` as `attacker_uid` -> `PERMISSION_DENIED`.
9. **Blanket List Query Scraping**: Attempt `list` on `/subscriptions` without `where('userId', '==', auth.uid)` -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Attempt `create` on `/media/<1500-char-invalid-id>` -> `PERMISSION_DENIED`.
11. **Oversized Array Exhaustion**: Attempt `update` on `/users/u1` with `preferredCategories` having 25 items -> `PERMISSION_DENIED`.
12. **Comment Impersonation & Deletion**: Attempt `delete` on `/comments/c1` authored by another user -> `PERMISSION_DENIED`.
