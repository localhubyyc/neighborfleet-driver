// ============================================
// CONFIGURATION - Your Supabase credentials
// ============================================
const SUPABASE_URL = 'https://htzozoordnftgkjyadsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0em96b29yZG5mdGdranlhZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MzM3MDUsImV4cCI6MjA4MzQwOTcwNX0.zWDiVBwgeRDlnvb2FQxAnU-VDX6Yee4EiLmyWHRYYjM';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATE
// ============================================
let currentDriver = null;
let currentOrders = [];
let isOnline = false;
let locationWatchId = null;
let currentDeliveryId = null;
let capturedPhoto = null;

// ============================================
// DOM ELEMENTS
// ============================================
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const phoneInput = document.getElementById('phoneInput');
const loginBtn = document.getElementById('loginBtn');
const driverNameEl = document.getElementById('driverName');
const onlineBtn = document.getElementById('onlineBtn');
const offlineBtn = document.getElementById('offlineBtn');
const offlineBanner = document.getElementById('offlineBanner');
const ordersList = document.getElementById('ordersList');
const emptyState = document.getElementById('emptyState');
const orderCount = document.getElementById('orderCount');
const todayDeliveries = document.getElementById('todayDeliveries');
const todayEarnings = document.getElementById('todayEarnings');
const activeOrders = document.getElementById('activeOrders');
const photoModal = document.getElementById('photoModal');
const photoPreview = document.getElementById('photoPreview');
const photoInput = document.getElementById('photoInput');
const confirmDeliveryBtn = document.getElementById('confirmDeliveryBtn');
const toast = document.getElementById('toast');

// ============================================
// AUTHENTICATION
// ============================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim().replace(/\D/g, '');
    
    if (phone.length < 10) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="spinner"></div> Signing in...';

    try {
        let formattedPhone = '+1' + phone.slice(-10);
        console.log('Looking for phone:', formattedPhone);

        const { data: driver, error } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('phone', formattedPhone)
            .single();

        console.log('Query result:', driver, error);

        if (error || !driver) {
            showToast('Driver not found. Contact admin.', 'error');
            return;
        }

        currentDriver = driver;
        localStorage.setItem('driverId', driver.id);
        showApp();

    } catch (err) {
        console.error('Login error:', err);
        showToast('Login failed. Try again.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Sign In';
    }
});

async function checkExistingSession() {
    const driverId = localStorage.getItem('driverId');
    if (!driverId) return;

    try {
        const { data: driver, error } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .single();

        if (driver) {
            currentDriver = driver;
            showApp();
        }
    } catch (err) {
        localStorage.removeItem('driverId');
    }
}

function logout() {
    localStorage.removeItem('driverId');
    currentDriver = null;
    stopLocationTracking();
    loginScreen.style.display = 'flex';
    appContainer.classList.remove('active');
}

// ============================================
// APP INITIALIZATION
// ============================================
function showApp() {
    loginScreen.style.display = 'none';
    appContainer.classList.add('active');
    driverNameEl.textContent = currentDriver.name;
    
    isOnline = currentDriver.is_online;
    updateStatusUI();
    loadOrders();
    subscribeToOrders();
    
    if (isOnline) {
        startLocationTracking();
    }
}

// ============================================
// ONLINE/OFFLINE STATUS
// ============================================
async function setOnline(online) {
    isOnline = online;
    updateStatusUI();

    try {
        await supabaseClient
            .from('drivers')
            .update({ is_online: online })
            .eq('id', currentDriver.id);

        if (online) {
            startLocationTracking();
            showToast("You're online! Ready for orders.", 'success');
        } else {
            stopLocationTracking();
            showToast("You're offline. No new orders.", 'success');
        }
    } catch (err) {
        console.error('Status update error:', err);
    }
}

function updateStatusUI() {
    if (isOnline) {
        onlineBtn.classList.add('active');
        offlineBtn.classList.remove('active');
        offlineBanner.classList.remove('active');
    } else {
        onlineBtn.classList.remove('active');
        offlineBtn.classList.add('active');
        offlineBanner.classList.add('active');
    }
}

// ============================================
// LOCATION TRACKING (Smart 3-second updates)
// ============================================
let lastLat = null;
let lastLng = null;
let lastUpdateTime = 0;
let locationInterval = null;

function startLocationTracking() {
    if (!navigator.geolocation) {
        showToast('Location not supported', 'error');
        return;
    }

    // Use watchPosition for continuous tracking
    locationWatchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const now = Date.now();
            
            // Calculate if driver moved (more than 10 meters)
            const moved = hasMovedSignificantly(latitude, longitude);
            
            // Update every 3 seconds if moving, every 30 seconds if stopped
            const interval = moved ? 3000 : 30000;
            
            if (now - lastUpdateTime >= interval) {
                lastUpdateTime = now;
                lastLat = latitude;
                lastLng = longitude;
                
                // Update driver location in database
                await supabaseClient
                    .from('drivers')
                    .update({
                        current_lat: latitude,
                        current_lng: longitude,
                        last_location_update: new Date().toISOString()
                    })
                    .eq('id', currentDriver.id);

                // Only log to history every 30 seconds to save writes
                if (now % 30000 < 3000) {
                    await supabaseClient
                        .from('driver_locations')
                        .insert({
                            driver_id: currentDriver.id,
                            lat: latitude,
                            lng: longitude
                        });
                }
                
                console.log('📍 Location updated:', latitude.toFixed(5), longitude.toFixed(5), moved ? '(moving)' : '(stopped)');
            }
        },
        (error) => console.error('Location error:', error),
        { 
            enableHighAccuracy: true, 
            timeout: 5000, 
            maximumAge: 0  // Always get fresh location
        }
    );
}

function hasMovedSignificantly(lat, lng) {
    if (lastLat === null || lastLng === null) return true;
    
    // Calculate distance in meters (rough approximation)
    const latDiff = Math.abs(lat - lastLat) * 111000; // ~111km per degree
    const lngDiff = Math.abs(lng - lastLng) * 111000 * Math.cos(lat * Math.PI / 180);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    return distance > 10; // Moved more than 10 meters
}

function stopLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
}

// ============================================
// ORDERS
// ============================================
async function loadOrders() {
    try {
        const { data: orders, error } = await supabaseClient
            .from('deliveries')
            .select('*')
            .eq('driver_id', currentDriver.id)
            .in('status', ['assigned', 'picked_up', 'delivering'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        currentOrders = orders || [];
        renderOrders();
        updateStats();

    } catch (err) {
        console.error('Load orders error:', err);
    }
}

function subscribeToOrders() {
    supabaseClient
        .channel('deliveries-channel')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'deliveries',
                filter: `driver_id=eq.${currentDriver.id}`
            }, 
            (payload) => {
                console.log('Order update:', payload);
                loadOrders();
            }
        )
        .subscribe();
}

function renderOrders() {
    if (currentOrders.length === 0) {
        ordersList.innerHTML = '';
        emptyState.classList.remove('hidden');
        orderCount.textContent = '0';
        activeOrders.textContent = '0';
        return;
    }

    emptyState.classList.add('hidden');
    orderCount.textContent = currentOrders.length;
    activeOrders.textContent = currentOrders.length;

    ordersList.innerHTML = currentOrders.map(order => `
        <div class="order-card ${order.status === 'assigned' ? 'new' : ''}">
            <div class="order-header">
                <div>
                    <div class="order-id">#${order.order_id}</div>
                    <div class="restaurant-name">${order.restaurant_name}</div>
                </div>
                <span class="order-status ${order.status}">${formatStatus(order.status)}</span>
            </div>

            <div class="order-location">
                <div class="location-icon pickup">
                    <svg viewBox="0 0 24 24" fill="#ff6b35">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
                <div class="location-details">
                    <div class="location-label">Pickup</div>
                    <div class="location-address">${order.restaurant_address}</div>
                </div>
            </div>

            <div class="order-location">
                <div class="location-icon dropoff">
                    <svg viewBox="0 0 24 24" fill="#00d26a">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
                <div class="location-details">
                    <div class="location-label">Deliver to</div>
                    <div class="location-address">${order.customer_address}</div>
                    <div class="location-name">${order.customer_name}</div>
                </div>
            </div>

            <div class="order-items">${order.items_summary || 'No items listed'}</div>

            ${order.special_instructions ? `
                <div class="order-instructions">
                    <span>📝</span>
                    <span>${order.special_instructions}</span>
                </div>
            ` : ''}

            <div class="order-actions">
                ${getActionButtons(order)}
            </div>
        </div>
    `).join('');
}

function formatStatus(status) {
    const map = {
        'pending': 'New',
        'assigned': 'Assigned',
        'picked_up': 'Picked Up',
        'delivering': 'Delivering',
        'delivered': 'Delivered'
    };
    return map[status] || status;
}

function getActionButtons(order) {
    if (order.status === 'assigned') {
        return `
            <button class="btn btn-navigate" onclick="navigate('${order.restaurant_address}')">🧭 Navigate</button>
            <button class="btn btn-primary" onclick="markPickedUp('${order.id}')">✓ Picked Up</button>
        `;
    }
    if (order.status === 'picked_up' || order.status === 'delivering') {
        return `
            <button class="btn btn-navigate" onclick="navigate('${order.customer_address}')">🧭 Navigate</button>
            <button class="btn btn-primary" onclick="openPhotoModal('${order.id}')">📷 Complete</button>
        `;
    }
    return '';
}

// ============================================
// ORDER ACTIONS
// ============================================
function navigate(address) {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
}

async function markPickedUp(orderId) {
    try {
        await supabaseClient
            .from('deliveries')
            .update({ 
                status: 'picked_up',
                picked_up_at: new Date().toISOString()
            })
            .eq('id', orderId);

        showToast('Order picked up! Head to customer.', 'success');
        loadOrders();

    } catch (err) {
        console.error('Pickup error:', err);
        showToast('Error updating order', 'error');
    }
}

function openPhotoModal(orderId) {
    currentDeliveryId = orderId;
    capturedPhoto = null;
    photoPreview.innerHTML = '<span class="placeholder">No photo taken</span>';
    confirmDeliveryBtn.disabled = true;
    photoModal.classList.add('active');
}

function closePhotoModal() {
    photoModal.classList.remove('active');
    currentDeliveryId = null;
    capturedPhoto = null;
}

photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        capturedPhoto = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreview.innerHTML = `<img src="${e.target.result}" alt="Delivery photo">`;
            confirmDeliveryBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

async function confirmDelivery() {
    if (!currentDeliveryId) return;

    confirmDeliveryBtn.disabled = true;
    confirmDeliveryBtn.innerHTML = '<div class="spinner"></div> Completing...';

    try {
        let photoUrl = null;

        await supabaseClient
            .from('deliveries')
            .update({ 
                status: 'delivered',
                delivered_at: new Date().toISOString(),
                delivery_photo_url: photoUrl
            })
            .eq('id', currentDeliveryId);

        closePhotoModal();
        showToast('Delivery completed! 🎉', 'success');
        loadOrders();
        updateStats();

    } catch (err) {
        console.error('Delivery completion error:', err);
        showToast('Error completing delivery', 'error');
    } finally {
        confirmDeliveryBtn.disabled = false;
        confirmDeliveryBtn.innerHTML = 'Confirm Delivery';
    }
}

// ============================================
// STATS
// ============================================
async function updateStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: completed, error } = await supabaseClient
            .from('deliveries')
            .select('*')
            .eq('driver_id', currentDriver.id)
            .eq('status', 'delivered')
            .gte('delivered_at', today.toISOString());

        if (!error && completed) {
            todayDeliveries.textContent = completed.length;
            todayEarnings.textContent = '$' + (completed.length * 5);
        }

    } catch (err) {
        console.error('Stats error:', err);
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    setTimeout(() => toast.classList.remove('active'), 3000);
}

// ============================================
// INITIALIZE
// ============================================
checkExistingSession();
