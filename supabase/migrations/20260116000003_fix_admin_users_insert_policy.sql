-- Fix RLS policy for admin_users to allow super_admin to insert new admins
-- ================================================================

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Super admin can insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can create admin users" ON admin_users;

-- Create a proper insert policy for super_admin
CREATE POLICY "Super admin can insert admin users"
  ON admin_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
      AND admin_users.is_active = true
    )
  );

-- Also fix update policy for super_admin
DROP POLICY IF EXISTS "Super admin can update admin_users" ON admin_users;

CREATE POLICY "Super admin can update admin users"
  ON admin_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
      AND admin_users.is_active = true
    )
  );

-- Fix delete policy for super_admin
DROP POLICY IF EXISTS "Super admin can delete admin_users" ON admin_users;

CREATE POLICY "Super admin can delete admin users"
  ON admin_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
      AND admin_users.is_active = true
    )
  );
