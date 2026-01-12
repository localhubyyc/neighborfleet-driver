// ============================================
// AUTH GUARD - Protect Dashboard Pages
// Include this script on ALL protected pages
// <script src="auth-guard.js"></script>
// ============================================

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        loginPage: 'login.html',
        sessionCheckInterval: 60000, // Check session every 60 seconds
        inactivityTimeout: 30 * 60 * 1000, // 30 minutes
        supabaseUrl: 'https://htzozoordnftgkjyadsf.supabase.co',
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0em96b29yZG5mdGdranlhZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNzk0NTMsImV4cCI6MjA2Mjg1NTQ1M30.tpST3XqeBWsjLmn-HQdSfYVThn_7mR5LzNxxVKOVvic'
    };

    // Page access control
    const PAGE_PERMISSIONS = {
        'admin.html': ['admin'],
        'analytics.html': ['admin', 'store_owner'],
        'store-owner.html': ['admin', 'store_owner'],
        'index.html': ['admin', 'store_owner', 'driver'],
        'track.html': ['admin', 'store_owner', 'driver'] // Public tracking page
    };

    // Initialize Supabase
    let supabase = null;

    // ============================================
    // MAIN AUTH CHECK
    // ============================================
    async function initAuthGuard() {
        // Wait for Supabase to load
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase not loaded. Include Supabase JS before auth-guard.js');
            return;
        }

        supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

        // Check authentication
        const isAuthenticated = await checkAuth();
        
        if (!isAuthenticated) {
            redirectToLogin('Session expired or invalid');
            return;
        }

        // Check page permissions
        const hasPermission = checkPagePermission();
        if (!hasPermission) {
            showAccessDenied();
            return;
        }

        // Setup activity monitoring
        setupActivityMonitor();

        // Setup periodic session check
        setInterval(checkSessionValidity, CONFIG.sessionCheckInterval);

        // Setup logout handler
        setupLogoutHandler();

        // Add security headers info to page
        addSecurityIndicator();
    }

    // ============================================
    // AUTHENTICATION CHECK
    // ============================================
    async function checkAuth() {
        const sessionToken = getSessionToken();
        
        if (!sessionToken) {
            console.log('No session token found');
            return false;
        }

        try {
            const tokenHash = await hashString(sessionToken);
            
            const { data, error } = await supabase
                .from('user_sessions')
                .select('*, app_users(*)')
                .eq('token_hash', tokenHash)
                .eq('is_valid', true)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (error || !data) {
                console.log('Invalid session:', error?.message);
                clearSession();
                return false;
            }

            // Update last active time
            await supabase
                .from('user_sessions')
                .update({ last_active_at: new Date().toISOString() })
                .eq('id', data.id);

            // Store user info for page use
            window.currentUser = {
                id: data.app_users.id,
                email: data.app_users.email,
                name: data.app_users.full_name,
                role: data.app_users.role,
                restaurantId: data.app_users.restaurant_id,
                driverId: data.app_users.driver_id,
                sessionId: data.id
            };

            return true;

        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    // ============================================
    // PERMISSION CHECK
    // ============================================
    function checkPagePermission() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const allowedRoles = PAGE_PERMISSIONS[currentPage];

        // If page not in permissions list, allow access (might be public)
        if (!allowedRoles) {
            return true;
        }

        // Check if user's role is allowed
        if (window.currentUser && allowedRoles.includes(window.currentUser.role)) {
            return true;
        }

        return false;
    }

    // ============================================
    // SESSION VALIDITY CHECK
    // ============================================
    async function checkSessionValidity() {
        const sessionToken = getSessionToken();
        if (!sessionToken) {
            redirectToLogin('Session not found');
            return;
        }

        try {
            const tokenHash = await hashString(sessionToken);
            
            const { data, error } = await supabase
                .from('user_sessions')
                .select('id, expires_at, is_valid')
                .eq('token_hash', tokenHash)
                .single();

            if (error || !data || !data.is_valid || new Date(data.expires_at) < new Date()) {
                redirectToLogin('Session expired');
            }

        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    // ============================================
    // ACTIVITY MONITORING (Auto-logout on inactivity)
    // ============================================
    function setupActivityMonitor() {
        let lastActivity = Date.now();
        let warningShown = false;

        const resetActivity = () => {
            lastActivity = Date.now();
            warningShown = false;
            hideInactivityWarning();
        };

        // Track user activity
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
            document.addEventListener(event, resetActivity, { passive: true });
        });

        // Check for inactivity
        setInterval(() => {
            const inactiveTime = Date.now() - lastActivity;
            
            // Show warning 5 minutes before logout
            if (inactiveTime > CONFIG.inactivityTimeout - 300000 && !warningShown) {
                showInactivityWarning();
                warningShown = true;
            }

            // Logout after timeout
            if (inactiveTime > CONFIG.inactivityTimeout) {
                logout('Logged out due to inactivity');
            }
        }, 30000); // Check every 30 seconds
    }

    function showInactivityWarning() {
        const warning = document.createElement('div');
        warning.id = 'inactivity-warning';
        warning.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #f97316; color: white; padding: 12px 20px; z-index: 10000; display: flex; justify-content: space-between; align-items: center;">
                <span>⚠️ You will be logged out in 5 minutes due to inactivity</span>
                <button onclick="document.getElementById('inactivity-warning').remove()" style="background: white; color: #f97316; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Stay Logged In</button>
            </div>
        `;
        document.body.appendChild(warning);
    }

    function hideInactivityWarning() {
        const warning = document.getElementById('inactivity-warning');
        if (warning) warning.remove();
    }

    // ============================================
    // LOGOUT HANDLER
    // ============================================
    function setupLogoutHandler() {
        // Add global logout function
        window.logout = logout;

        // Look for logout buttons and attach handler
        document.querySelectorAll('[data-logout], .logout-btn, #logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                logout('User logged out');
            });
        });
    }

    async function logout(reason = 'User logged out') {
        const sessionToken = getSessionToken();
        
        if (sessionToken && supabase) {
            try {
                const tokenHash = await hashString(sessionToken);
                
                // Invalidate session in database
                await supabase
                    .from('user_sessions')
                    .update({ 
                        is_valid: false, 
                        revoked_at: new Date().toISOString(),
                        revoked_reason: reason 
                    })
                    .eq('token_hash', tokenHash);

                // Log the logout
                if (window.currentUser) {
                    await supabase
                        .from('security_audit_log')
                        .insert({
                            user_id: window.currentUser.id,
                            event_type: 'logout',
                            event_description: reason,
                            ip_address: 'client',
                            user_agent: navigator.userAgent
                        });
                }

            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        clearSession();
        redirectToLogin(reason);
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    function getSessionToken() {
        return localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken');
    }

    function clearSession() {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('user');
        window.currentUser = null;
    }

    function redirectToLogin(reason) {
        // Store redirect URL
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        sessionStorage.setItem('loginMessage', reason);
        
        // Redirect to login
        window.location.href = CONFIG.loginPage;
    }

    // ============================================
    // ACCESS DENIED PAGE
    // ============================================
    function showAccessDenied() {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: white; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
                    <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">Access Denied</h1>
                    <p style="color: #a0a0a0; margin-bottom: 2rem;">You don't have permission to access this page.</p>
                    <p style="color: #606060; font-size: 0.85rem; margin-bottom: 1rem;">
                        Your role: <strong>${window.currentUser?.role || 'Unknown'}</strong>
                    </p>
                    <a href="${CONFIG.loginPage}" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: black; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Login</a>
                </div>
            </div>
        `;
    }

    // ============================================
    // SECURITY INDICATOR
    // ============================================
    function addSecurityIndicator() {
        if (!window.currentUser) return;

        const indicator = document.createElement('div');
        indicator.id = 'auth-indicator';
        indicator.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 12px 16px; z-index: 9999; font-family: -apple-system, sans-serif; font-size: 13px; color: #a0a0a0; display: flex; align-items: center; gap: 10px;">
                <span style="color: #22c55e;">🔒</span>
                <span>${window.currentUser.name}</span>
                <span style="color: #606060;">|</span>
                <span style="text-transform: capitalize;">${window.currentUser.role.replace('_', ' ')}</span>
                <button onclick="logout()" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 8px;" title="Logout">🚪</button>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    async function hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ============================================
    // CSRF PROTECTION
    // ============================================
    function getCSRFToken() {
        let token = sessionStorage.getItem('csrfToken');
        if (!token) {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
            sessionStorage.setItem('csrfToken', token);
        }
        return token;
    }

    // Add CSRF token to all fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (options.method && options.method !== 'GET') {
            options.headers = options.headers || {};
            options.headers['X-CSRF-Token'] = getCSRFToken();
        }
        return originalFetch.call(this, url, options);
    };

    // ============================================
    // EXPORT FOR MANUAL USE
    // ============================================
    window.AuthGuard = {
        checkAuth,
        logout,
        getCurrentUser: () => window.currentUser,
        getSessionToken,
        isAuthenticated: () => !!getSessionToken()
    };

    // ============================================
    // INITIALIZE ON PAGE LOAD
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuthGuard);
    } else {
        initAuthGuard();
    }

})();
