-- Add guest role to app_role enum so guests can be tracked in user_roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'guest';
