# UI Design Rules

## Vote and Withdraw Button Visibility Rules

**MAIN RULE: Vote and Withdraw are MUTUALLY EXCLUSIVE.**
It must be impossible for any user to have both the ability to vote AND the ability to withdraw from the same object (post or comment). This is enforced at the API level and reflected in the frontend design.

### Rule Summary Table

| Scenario | Author | Effective Beneficiary | Current User | Vote Button | Withdraw Button |
|----------|--------|----------------------|--------------|-------------|-----------------|
| Post/Comment by Alice (no beneficiary) | Alice | Alice (default) | Alice | **Hidden** | **Shown** (if balance > 0, else greyed out) |
| Post/Comment by Alice with Bob as beneficiary | Alice | Bob | Alice | **Shown** | **Hidden** |
| Post/Comment by Alice with Bob as beneficiary | Alice | Bob | Bob | **Hidden** | **Shown** (if balance > 0, else greyed out) |
| Post/Comment by Bob (no beneficiary) | Bob | Bob (default) | Alice | **Shown** | **Hidden** |
| Post/Comment by Bob with Carol as beneficiary | Bob | Carol | Alice | **Shown** | **Hidden** |
| Post/Comment by Bob with Alice as beneficiary | Bob | Alice | Alice | **Hidden** | **Shown** (if balance > 0, else greyed out) |

### Detailed Rules

#### Posts Created by Alice

**Post created by Alice (effective beneficiary Alice herself - by default):**
- **Vote Button**: Hidden (can't vote for herself)
- **Withdraw Button**: Shown (if other users voted up this post and there is positive balance of votes on this post - otherwise greyed out)

**Post created by Alice with Bob as beneficiary:**
- **Vote Button**: Shown (can vote as the beneficiary is not Alice)
- **Withdraw Button**: Hidden (can't withdraw from objects where beneficiary is other person)

**Post created by Alice with Alice herself as beneficiary:**
- **Vote Button**: Hidden (can't vote with self as beneficiary)
- **Withdraw Button**: Shown (greyed out if the balance is votes balance on the post is non-positive)

#### Comments Created by Alice

Comments follow the same rules as posts, with one important note: **Comments cannot have beneficiaries**. All comments have the author as the effective beneficiary.

**Comment created by Alice:**
- **Vote Button**: Hidden (can't vote for herself)
- **Withdraw Button**: Shown (if other users voted up this comment and there is positive balance of votes on this comment - otherwise greyed out)

#### Posts Created by Bob (viewed by Alice)

**Post created by Bob (effective beneficiary Bob):**
- **Vote Button**: Shown (Alice can vote for Bob's post)
- **Withdraw Button**: Hidden (Alice is not the beneficiary)

**Post created by Bob with beneficiary Carol:**
- **Vote Button**: Shown (when Alice votes, vote goes to Carol the beneficiary)
- **Withdraw Button**: Hidden (for Alice, as she is not the beneficiary)

**Post created by Bob with beneficiary Alice herself (the user):**
- **Vote Button**: Hidden (can't vote with self as beneficiary)
- **Withdraw Button**: Shown (greyed out if the balance of votes on the post is non-positive)

#### Comments Created by Bob

**Comment created by Bob:**
- **Vote Button**: Shown (Alice can vote for Bob's comment)
- **Withdraw Button**: Hidden (Alice is not the author, and comments don't have beneficiaries)

### Implementation Notes

1. **Effective Beneficiary**: The effective beneficiary is the `beneficiaryId` if it exists, otherwise it's the `authorId`. For comments, it's always the `authorId`.

2. **Balance Check**: The withdraw button should be greyed out (disabled) when the balance (sum of votes) is <= 0.

3. **Visual Feedback**: When a withdraw button is disabled due to zero balance, it should still be visible but clearly indicate it's disabled (greyed out state).

4. **API Enforcement**: The API will reject vote attempts when:
   - User is the author and there's no beneficiary
   - User is the beneficiary (even if not the author)

5. **API Enforcement**: The API will reject withdraw attempts when:
   - User is not the effective beneficiary
   - Balance is <= 0

6. **Comments**: Comments cannot have beneficiaries. All comments have the author as the effective beneficiary.

### Frontend Component Logic

```typescript
// Determine effective beneficiary
const effectiveBeneficiary = beneficiaryId || authorId;

// Check if current user is beneficiary
const isBeneficiary = effectiveBeneficiary === currentUserId;

// Check if current user is author
const isAuthor = authorId === currentUserId;

// Determine if vote button should be shown
const canVote = !isAuthor && !isBeneficiary;

// Determine if withdraw button should be shown
const canWithdraw = (isAuthor && !beneficiaryId) || (isBeneficiary && balance > 0);
const showWithdrawDisabled = (isAuthor && !beneficiaryId && balance <= 0) || (isBeneficiary && balance <= 0);
```

