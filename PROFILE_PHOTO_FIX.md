# Profile Photo Fix - Database Persistence

## Problem
Profile photos were not being saved to the database. When users uploaded a profile photo:
- ✅ Photo showed in profile section immediately
- ✅ Photo showed in navbar after refresh
- ❌ Photo disappeared after logout and login (not persisted to database)

## Root Cause
1. **Database**: `users` table didn't have `avatar_url` column
2. **Backend**: Profile update endpoint didn't accept/save `avatar_url`
3. **Backend**: Login and `/me` endpoints didn't return `avatar_url`
4. **Frontend**: Profile photo upload only updated local state, didn't call API to save

## Solution

### 1. Database Migration
- **File**: `server/migrations/add_avatar_url_to_users.sql`
- **Action**: Adds `avatar_url TEXT` column to `users` table
- **Run**: Migration will run automatically on next server start (if migrations are auto-run) or manually via migration script

### 2. Backend Updates

#### `server/routes/users.js` - PUT `/api/users/profile`
- ✅ Accepts `avatar_url` in request body
- ✅ Saves `avatar_url` to database when provided
- ✅ Returns `avatar_url` in response

#### `server/routes/auth.js` - POST `/api/auth/login`
- ✅ Fetches `avatar_url` from database
- ✅ Returns `avatar_url` in login response

#### `server/routes/auth.js` - GET `/api/auth/me`
- ✅ Fetches `avatar_url` from database
- ✅ Returns `avatar_url` in response

### 3. Frontend Updates

#### `client/src/components/profile/ProfilePage.jsx`
- ✅ `handleAvatarChange` now calls API to save avatar to database
- ✅ Shows success/error messages
- ✅ Validates file size (max 5MB) and file type
- ✅ Updates user context with saved avatar
- ✅ Properly initializes avatar preview from user data

## Testing Steps

1. **Run Migration** (if not auto-run):
   ```bash
   # Option 1: Via init endpoint
   POST http://localhost:4000/api/init
   
   # Option 2: Via migration script
   node server/scripts/run-migrations.js
   ```

2. **Test Profile Photo Upload**:
   - Login as any user (admin/super admin/customer)
   - Go to Profile section
   - Upload a profile photo
   - Verify photo shows in profile section
   - Verify photo shows in navbar
   - **Logout and login again**
   - ✅ Photo should still be visible in both places

3. **Verify Database**:
   ```sql
   SELECT id, full_name, avatar_url FROM users WHERE avatar_url IS NOT NULL;
   ```

## Files Changed

1. `server/migrations/add_avatar_url_to_users.sql` (NEW)
2. `server/routes/users.js` (MODIFIED)
3. `server/routes/auth.js` (MODIFIED)
4. `client/src/components/profile/ProfilePage.jsx` (MODIFIED)

## Notes

- Profile photos are stored as base64 encoded strings in the database
- Maximum file size: 5MB
- Supported formats: All image types (validated by `file.type.startsWith('image/')`)
- The `avatar_url` column is optional (nullable) - existing users without photos will have `NULL`

## Production Deployment

1. Commit and push changes
2. Deploy to production
3. Run migration on production database:
   ```sql
   -- Connect to production DB and run:
   ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
   ```
4. Test profile photo upload in production
