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
        inactivityTimeout: 30 * 60 * 1000 // 30 minutes
    };

    // Page access control
    const PAGE_PERMISSIONS = {
        'admin.html': ['admin'],
        'analytics.html': ['admin', 'store_owner'],
        'store-owner.html': ['admin', 'store_owner'],
        'user-management.html': ['admin'],
        'index.html': ['admin', 'store_owner', 'driver'],
        'track.html': ['admin', 'store_owner', 'driver', 'customer']
    };

    // ============================================
    // MAIN AUTH CHECK
    // ============================================
    function initAuthGuard() {
        // Check authentication
        const isAuthenticated = checkAuth();
        
        if (!isAuthenticated) {
            redirectToLogin('Please log in to continue');
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

        // Setup logout handler
        setupLogoutHandler();

        // Add security indicator
        addSecurityIndicator();

        console.log('Auth guard: User authenticated as', window.currentUser?.role);
    }

    // ============================================
    // AUTHENTICATION CHECK
    // ============================================
    function checkAuth() {
        const sessionToken = getSessionToken();
        const userJson = localStorage.getItem('user');
        
        if (!sessionToken || !userJson) {
            console.log('No session found');
            return false;
        }

        try {
            const user = JSON.parse(userJson);
            
            if (!user || !user.id || !user.role) {
                console.log('Invalid user data');
                clearSession();
                return false;
            }

            // Store user info for page use
            window.currentUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                restaurantId: user.restaurantId,
                driverId: user.driverId
            };

            return true;

        } catch (error) {
            console.error('Auth check error:', error);
            clearSession();
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
        }, 30000);
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
        window.logout = logout;

        document.querySelectorAll('[data-logout], .logout-btn, #logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                logout('User logged out');
            });
        });
    }

    function logout(reason = 'User logged out') {
        console.log('Logging out:', reason);
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
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        sessionStorage.setItem('loginMessage', reason);
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
                <span>${window.currentUser.name || window.currentUser.email}</span>
                <span style="color: #606060;">|</span>
                <span style="text-transform: capitalize;">${window.currentUser.role.replace('_', ' ')}</span>
                <button onclick="logout()" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 8px;" title="Logout">🚪</button>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    // ============================================
    // EXPORT FOR MANUAL USE
    // ============================================
    window.AuthGuard = {
        checkAuth,
        logout,
        getCurrentUser: () => window.currentUser,
        getSessionToken,
        isAuthenticated: () => !!getSessionToken() && !!localStorage.getItem('user')
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
