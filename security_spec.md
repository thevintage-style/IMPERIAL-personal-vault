# Security Specification - UPSC Personal Vault & Resource Hub

This document specifies the data invariants, security policies, and "Dirty Dozen" attack vectors with their payloads to guarantee a robust, zero-trust Firestore architecture.

## 1. Data Invariants

1. **Isolation of Private Data**: Any data stored inside `/users/{userId}/personal_resources/{resourceId}` must be readable, listable, and writable *only* by the owner (`userId == request.auth.uid`). No other authenticated or unauthenticated user may see or edit this content.
2. **Resource Hub Immutable Access**: Resource Hub items inside `/resource_hub/{resourceId}` can be read and listed by any authenticated user, but created, updated, or deleted *only* by verified administrators identified by `/admins/{adminId}`.
3. **Role Lock**: Regular users are strictly forbidden from modifying or defining their own `role` or creating an admin document in the `/admins` collection.
4. **Metadata Immutability**: Core transactional metadata such as `createdAt`, `createdBy`, `id`, and system identifiers must be immutable after the initial write.
5. **Strict Schema Constraints**: Strings must be strictly bounded in size to prevent "Denial of Wallet" exhaustion.
6. **Server-Generated Timestamps**: All creation and modification timestamps (`createdAt`, `updatedAt`) must bind precisely to `request.time`. Client-supplied offsets must be rejected.
7. **Document ID Sanitization**: Document path identifiers must adhere to strict alphanumeric boundaries, blocking SQL-like injection strings or oversized path strings.

---

## 2. The Dirty Dozen Attack Payloads

### Attack 1: Self-Privilege Escalation
* **Vector**: A user tries to create or update their user profile at `/users/{userId}` to turn their role from `"user"` to `"admin"`.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /users/attacker_uid
{
  "uid": "attacker_uid",
  "email": "attacker@gmail.com",
  "displayName": "Attacker",
  "photoURL": "",
  "role": "admin", // Malicious role setting
  "createdAt": "2026-05-22T08:22:20Z"
}
```

### Attack 2: Direct Admin Register Injection
* **Vector**: Regular user tries to write a whitelist entry containing their UID directly into `/admins/attacker_uid`.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /admins/attacker_uid
{
  "isAdmin": true
}
```

### Attack 3: Resource Hub Push by Regular User
* **Vector**: A standard user bypasses UI controls to write directly to `/resource_hub/stolen_document`.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /resource_hub/stolen_document
{
  "id": "stolen_document",
  "title": "Hacked Material",
  "type": "pdf",
  "url": "https://malicious.com/fake.pdf",
  "category": "GS1",
  "createdAt": "request.time",
  "createdBy": "attacker_uid",
  "createdByName": "Attacker"
}
```

### Attack 4: Personal Vault Private Sniping (Read)
* **Vector**: User `alice_uid` tries to get a document stored in Bob's Private Vault at `/users/bob_uid/personal_resources/bob_doc`.
* **Security Expectation**: `PERMISSION_DENIED`

### Attack 5: Personal Vault Private Tampering (Write)
* **Vector**: User `alice_uid` tries to write an item into bob's private collection `/users/bob_uid/personal_resources/bob_doc`.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /users/bob_uid/personal_resources/bob_doc
{
  "id": "bob_doc",
  "title": "Stolen Notes",
  "type": "link",
  "url": "https://alice-secret.com",
  "category": "GS2",
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```

### Attack 6: Deny of Wallet Payload (Oversized content)
* **Vector**: User attempts to store a 5MB text string in the `url` field inside `/users/attacker_uid/personal_resources/item_1`.
* **Security Expectation**: `PERMISSION_DENIED` due to character limit gate (e.g., `.size() <= 2000` on URLs).
```json
// Path: /users/attacker_uid/personal_resources/item_1
{
  "id": "item_1",
  "title": "Oversized URL",
  "type": "link",
  "url": "https://massive-domain.com/...[5,000,000 character buffer]...",
  "category": "GS3",
  "createdAt": "request.time",
  "updatedAt": "request.time"
}
```

### Attack 7: Time Poisoning (Backdating Creation)
* **Vector**: User tries to save a resource with `createdAt` set artificially to months in the past to alter order queues.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /users/attacker_uid/personal_resources/item_2
{
  "id": "item_2",
  "title": "Backdated Item",
  "type": "video",
  "url": "https://youtube.com/watch?v=123",
  "category": "GS4",
  "createdAt": "2020-01-01T00:00:00Z", // Spoofed time
  "updatedAt": "request.time"
}
```

### Attack 8: Time Poisoning (Modification Offset)
* **Vector**: User attempts to update a resource setting `updatedAt` to a future timestamp.
* **Security Expectation**: `PERMISSION_DENIED`
```json
// Path: /users/attacker_uid/personal_resources/item_1 (existing document updated with future time)
{
  "updatedAt": "2030-01-01T00:00:00Z"
}
```

### Attack 9: Path Poisoning & Exploit Strings
* **Vector**: User submits a document ID containing path traversal characters or extremely large payload.
* **Security Expectation**: `PERMISSION_DENIED`
* **Target Path**: `/users/attacker_uid/personal_resources/../../../etc/passwd`

### Attack 10: Admin Sibling Identity Overwrite
* **Vector**: A rogue admin attempts to update a `/resource_hub` item created by a head admin, changing the `createdBy` ID to another admin's UID.
* **Security Expectation**: `PERMISSION_DENIED` (cannot modify immutable identifier field `createdBy`).

### Attack 11: Cross-User List Query scraping
* **Vector**: Attacker tries to download all personal resources from all users via index queries without selecting their own path.
* **Security Expectation**: `PERMISSION_DENIED` because the rules require checking `userId == request.auth.uid`.

### Attack 12: Shadow Field Injection
* **Vector**: User registers their client resource sheet with unapproved shadow schema elements like `verified_by_moderator: true`.
* **Security Expectation**: `PERMISSION_DENIED` as strict size matching prevents shadows.

---

## 3. Test Coverage Strategy

All Dirty Dozen payloads are verified to raise `PERMISSION_DENIED` transactions. Development servers run tests automatically against `DRAFT_firestore.rules` prior to deployment.
