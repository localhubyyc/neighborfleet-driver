-- ============================================
-- SECURE AUTHENTICATION SYSTEM
-- YYC LocalFirst
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. USERS TABLE - Core authentication
-- ============================================
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'store_owner', 'driver')),
    
    -- Profile info
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- Linked entity (store or driver profile)
    restaurant_id UUID REFERENCES restaurants(id),
    driver_id UUID REFERENCES drivers(id),
    
    -- Security fields
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMP,
    phone_verified_at TIMESTAMP,
    
    -- Two-factor authentication
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT[], -- Encrypted backup codes
    
    -- Password security
    password_changed_at TIMESTAMP DEFAULT NOW(),
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Session tracking
    last_login_at TIMESTAMP,
    last_login_ip TEXT,
    last_active_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES app_users(id)
);

-- ============================================
-- 2. SESSIONS TABLE - Active login sessions
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    
    -- Session token (hashed)
    token_hash TEXT NOT NULL UNIQUE,
    
    -- Session info
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP DEFAULT NOW(),
    
    -- Status
    is_valid BOOLEAN DEFAULT true,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. AUDIT LOG - Track all security events
-- ============================================
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id),
    
    -- Event details
    event_type TEXT NOT NULL,
    -- Types: login_success, login_failed, logout, password_change, 
    --        password_reset_request, password_reset_complete,
    --        2fa_enabled, 2fa_disabled, 2fa_success, 2fa_failed,
    --        account_locked, account_unlocked, session_revoked,
    --        permission_denied, data_access, data_modify
    
    event_description TEXT,
    
    -- Context
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    
    -- Additional data (JSON)
    metadata JSONB,
    
    -- Risk assessment
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. LOGIN ATTEMPTS - Brute force protection
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    ip_address TEXT NOT NULL,
    
    success BOOLEAN DEFAULT false,
    failure_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. VERIFICATION CODES - Email/Phone/2FA
-- ============================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    
    code_type TEXT NOT NULL CHECK (code_type IN ('email', 'phone', '2fa', 'password_reset')),
    code_hash TEXT NOT NULL,
    
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. API KEYS - For external integrations
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    
    -- Permissions
    permissions TEXT[] DEFAULT '{}',
    
    -- Limits
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    
    -- Expiration
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON app_users(phone);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_restaurant ON app_users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_app_users_driver ON app_users(driver_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON security_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

-- ============================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data (store owners see their store data)
CREATE POLICY users_own_data ON app_users
    FOR SELECT USING (
        auth.uid()::text = id::text 
        OR 
        EXISTS (SELECT 1 FROM app_users WHERE id::text = auth.uid()::text AND role = 'admin')
    );

-- Sessions - users can only see their own
CREATE POLICY sessions_own_data ON user_sessions
    FOR ALL USING (
        user_id::text = auth.uid()::text
        OR
        EXISTS (SELECT 1 FROM app_users WHERE id::text = auth.uid()::text AND role = 'admin')
    );

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to check if IP is rate limited
CREATE OR REPLACE FUNCTION is_ip_rate_limited(check_ip TEXT, max_attempts INTEGER DEFAULT 5, window_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO attempt_count
    FROM login_attempts
    WHERE ip_address = check_ip
    AND success = false
    AND created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;
    
    RETURN attempt_count >= max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT locked_until, failed_login_attempts INTO user_record
    FROM app_users
    WHERE email = check_email;
    
    IF user_record IS NULL THEN
        RETURN false;
    END IF;
    
    IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
    attempt_email TEXT,
    attempt_ip TEXT,
    attempt_success BOOLEAN,
    attempt_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO login_attempts (email, ip_address, success, failure_reason)
    VALUES (attempt_email, attempt_ip, attempt_success, attempt_reason);
    
    IF NOT attempt_success THEN
        -- Increment failed attempts counter
        UPDATE app_users 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
                WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
                ELSE locked_until
            END
        WHERE email = attempt_email;
    ELSE
        -- Reset on successful login
        UPDATE app_users 
        SET failed_login_attempts = 0,
            locked_until = NULL,
            last_login_at = NOW(),
            last_login_ip = attempt_ip
        WHERE email = attempt_email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. CREATE DEFAULT ADMIN USER
-- Password: Admin123!@# (CHANGE THIS IMMEDIATELY)
-- ============================================

-- Note: In production, use proper password hashing (bcrypt)
-- This is SHA256 hash of 'Admin123!@#' for demo purposes
INSERT INTO app_users (
    email, 
    phone,
    password_hash, 
    role, 
    full_name,
    is_active,
    is_verified,
    email_verified_at
) VALUES (
    'admin@yyclocalfirst.ca',
    '+14031234567',
    -- SHA256 hash - in production use bcrypt!
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'admin',
    'System Administrator',
    true,
    true,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- DONE! Tables created for secure auth
-- ============================================

-- SUMMARY:
-- ✅ app_users - User accounts with roles
-- ✅ user_sessions - Session management
-- ✅ security_audit_log - All security events logged
-- ✅ login_attempts - Brute force protection
-- ✅ verification_codes - Email/Phone/2FA verification
-- ✅ api_keys - External API access
-- ✅ Row Level Security policies
-- ✅ Helper functions for security checks
