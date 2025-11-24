-- Migration: Change template alias uniqueness from global to per-project
-- This migration removes the global unique constraint on alias and replaces it 
-- with a composite unique constraint on (project_id, alias)

-- Step 1: Drop the existing global unique constraint on alias
ALTER TABLE templates 
DROP CONSTRAINT IF EXISTS templates_alias_unique;

-- Step 2: Add composite unique constraint on (project_id, alias)
-- This ensures alias uniqueness is scoped to each project
ALTER TABLE templates 
ADD CONSTRAINT templates_project_alias_unique 
UNIQUE (project_id, alias);

-- Step 3: Create an index on project_id for better query performance
-- This helps when filtering templates by project_id
CREATE INDEX IF NOT EXISTS idx_templates_project_id 
ON templates (project_id);

-- Step 4: Create a composite index on (project_id, alias) for efficient lookups
CREATE INDEX IF NOT EXISTS idx_templates_project_alias 
ON templates (project_id, alias);