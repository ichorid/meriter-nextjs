# Schema Synchronization Guide

## Overview

This project uses **Zod schemas as the single source of truth** for all domain models and API DTOs. Mongoose schemas must be manually synchronized with Zod schemas to ensure consistency.

## Schema Location

- **Zod Schemas**: `libs/shared-types/src/schemas.ts`
- **Mongoose Schemas**: `api/apps/meriter/src/domain/models/*/`

## Synchronization Rules

### 1. Zod is Source of Truth

All type definitions and validation rules originate from Zod schemas:
- Entity schemas (User, Community, Publication, etc.)
- DTO schemas (CreatePublicationDto, UpdateCommunityDto, etc.)
- Query parameter schemas
- Response schemas

### 2. Mongoose Follows Zod

When updating a schema:
1. **Always update Zod first** in `libs/shared-types/src/schemas.ts`
2. **Then update Mongoose** in the corresponding `*.schema.ts` file
3. **Run schema alignment tests** to verify consistency

### 3. Field Naming

- Field names must match exactly between Zod and Mongoose
- Use camelCase for field names
- MongoDB automatically adds `_id`; Zod uses `id` (string)

### 4. Required vs Optional

- Zod `.optional()` → Mongoose `@Prop()` (no required)
- Zod required → Mongoose `@Prop({ required: true })`
- Zod `.default()` → Mongoose `@Prop({ default: ... })`

### 5. Types

Common type mappings:
- `z.string()` → `String`
- `z.number()` → `Number`
- `z.boolean()` → `Boolean`
- `z.array(z.string())` → `{ type: [String] }`
- `z.enum([...])` → `{ enum: [...] }`
- `z.string().url()` → `String` (validation handled by Zod)

### 6. Nested Objects

For nested objects:
```typescript
// Zod
profile: z.object({
  bio: z.string().optional(),
  isVerified: z.boolean().default(false),
})

// Mongoose
@Prop({
  type: {
    bio: String,
    isVerified: { type: Boolean, default: false },
  },
  default: {},
})
profile: { bio?: string; isVerified?: boolean };
```

### 7. Timestamps

- Zod includes `createdAt` and `updatedAt` as strings (ISO datetime)
- Mongoose uses `@Schema({ timestamps: true })` which adds Date fields
- Conversion happens in service layer (Date → ISO string)

### 8. Computed Fields

Fields computed at runtime (not stored in DB):
- Add to Zod schema with `.optional()`
- Do NOT add to Mongoose schema
- Examples: `isAdmin`, `needsSetup`

## Update Checklist

When adding or modifying a field:

- [ ] Update Zod schema in `libs/shared-types/src/schemas.ts`
- [ ] Update Mongoose schema in corresponding `*.schema.ts` file
- [ ] Run `pnpm run build` in `libs/shared-types` to rebuild
- [ ] Run `pnpm run build` in `api` to verify compilation
- [ ] Run schema alignment tests: `pnpm run test -- schema-alignment`
- [ ] Update any affected service methods
- [ ] Update API documentation if needed

## Examples

### Adding a New Field

**Step 1: Update Zod Schema**
```typescript
// libs/shared-types/src/schemas.ts
export const UserSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  // ... existing fields
  newField: z.string().optional(), // Add new field
});
```

**Step 2: Update Mongoose Schema**
```typescript
// api/apps/meriter/src/domain/models/user/user.schema.ts
@Schema({ collection: 'users', timestamps: true })
export class User {
  // ... existing fields
  
  @Prop()
  newField?: string; // Add matching field
}
```

**Step 3: Rebuild and Test**
```bash
cd libs/shared-types && pnpm run build
cd ../../api && pnpm run build
pnpm run test -- schema-alignment
```

### Removing a Field

**Step 1: Remove from Zod**
```typescript
// Remove field from schema
```

**Step 2: Remove from Mongoose**
```typescript
// Remove @Prop() decorator and field
```

**Step 3: Add Migration Script** (if field exists in database)
```typescript
// Remove field from existing documents
await db.collection('users').updateMany({}, { $unset: { oldField: '' } });
```

## Testing

Schema alignment tests ensure consistency:

```bash
pnpm run test -- schema-alignment
```

Tests verify:
- All Zod fields exist in Mongoose
- Required/optional status aligns
- Nested object structures match

## Common Issues

### Issue: Field exists in Zod but not Mongoose

**Solution**: Add the field to Mongoose schema with matching name and type.

### Issue: Field exists in Mongoose but not Zod

**Solution**: Determine if field should be:
1. Added to Zod (if it's part of the API contract)
2. Removed from Mongoose (if it's legacy/unused)
3. Kept in Mongoose only (if it's internal implementation detail)

### Issue: Type mismatch

**Solution**: Ensure types match:
- Zod `z.string()` → Mongoose `String`
- Zod `z.number()` → Mongoose `Number`
- Zod `z.boolean()` → Mongoose `Boolean`

## Best Practices

1. **Always update Zod first** - It's the source of truth
2. **Run tests after changes** - Catch misalignments early
3. **Document computed fields** - Mark them in Zod schema comments
4. **Use consistent naming** - Follow existing patterns
5. **Review changes** - Ensure both schemas are updated together

## Related Files

- Schema definitions: `libs/shared-types/src/schemas.ts`
- Schema tests: `api/apps/meriter/test/schemas/schema-alignment.spec.ts`
- Test utilities: `api/apps/meriter/test/schemas/schema-alignment.helper.ts`
- Validation pipe: `api/apps/meriter/src/common/pipes/zod-validation.pipe.ts`

