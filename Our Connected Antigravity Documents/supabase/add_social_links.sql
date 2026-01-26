-- Add social media links to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instagram text,
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS linkedin text;

-- Optional: Add verification constraint to ensure they are URLs (simple check)
-- ALTER TABLE profiles ADD CONSTRAINT proper_instagram_url CHECK (instagram ~* '^https?://.*');
-- Keeping it simple for now without constraints to avoid issues.

-- Comment on columns
COMMENT ON COLUMN profiles.instagram IS 'URL to Instagram profile';
COMMENT ON COLUMN profiles.facebook IS 'URL to Facebook profile';
COMMENT ON COLUMN profiles.linkedin IS 'URL to LinkedIn profile';
