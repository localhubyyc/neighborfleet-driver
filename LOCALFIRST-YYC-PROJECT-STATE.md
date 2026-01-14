# LocalFirst YYC Project State
## Last Updated: January 14, 2026
## Brand: LocalFirst YYC (Calgary) - City code changes per market

---

## 🏢 BUSINESS INFO

- **Company**: 2166613 Alberta LTD
- **Brand**: LocalFirst YYC (Calgary)
- **Future Markets**: LocalFirst YVR (Vancouver), LocalFirst YEG (Edmonton), etc.
- **Address**: 36 Sherwood Rise N.W, Calgary, Alberta T3R1P5
- **Phone**: +14038265529
- **Email**: localhubyyc@gmail.com
- **Tax ID**: 71657 7085

---

## 🔗 ACCOUNTS & ACCESS

| Service | URL/Details | Status |
|---------|-------------|--------|
| **GitHub** | github.com/localhubyyc/neighborfleet-driver | ✅ Public repo |
| **Vercel** | neighborfleet-driver.vercel.app | ✅ Live, 156 deployments |
| **Supabase** | htzozoordnftgkjyadsf.supabase.co | ✅ Active |
| **Meta/Facebook** | business.facebook.com | ⏳ BLOCKED - Device not trusted, can't enable 2FA |
| **Stripe** | — | ❌ NOT SET UP |

---

## 📊 DATABASE TABLES (Supabase - ALL EXIST)

### Restaurant & Menu
- `restaurants` - Store info
- `categories` - Menu categories
- `menu_items` - Food items
- `sizes` - Size options (S/M/L)
- `item_sizes` - Links items to sizes with prices
- `toppings` - Available toppings
- `topping_prices` - Topping pricing
- `combos` - Combo deals
- `combo_prices` - Combo pricing
- `crusts` - Pizza crust options
- `wing_flavors` - Wing flavor options

### Orders & Delivery
- `orders` - Customer orders
- `order_items` - Items in each order
- `deliveries` - Delivery assignments
- `drivers` - Driver profiles
- `driver_locations` - GPS tracking

### Users & Auth
- `app_users` - All user accounts
- `user_sessions` - Login sessions
- `login_attempts` - Security tracking
- `verification_codes` - Auth codes
- `api_keys` - API access

### WhatsApp (Schema Ready)
- `whatsapp_conversations` - Chat threads
- `whatsapp_messages` - Message history
- `whatsapp_templates` - Approved templates
- `whatsapp_webhook_logs` - Incoming webhooks

### Notifications
- `notifications` - System notifications
- `driver_notification_preferences` - Driver settings
- `driver_message_history` - Message log
- `driver_unread_counts` - Unread tracking

### Security
- `security_audit_log` - Audit trail

---

## 📁 GITHUB FILES (neighborfleet-driver repo)

```
neighborfleet-driver/
├── index.html              # Driver app main page
├── login.html              # Login page
├── admin.html              # Admin dashboard (2452 lines)
├── store-owner.html        # Restaurant dashboard (1731 lines)
├── analytics.html          # Analytics page
├── track.html              # Tracking page
├── user-management.html    # User management
├── privacy.html            # Privacy policy
├── terms.html              # Terms of service
├── app.js                  # Driver app logic
├── auth-guard.js           # Authentication
├── styles.css              # Styling
├── car-red.png             # Asset
├── whatsapp-notifications.ts  # WhatsApp client library
└── supabase/
    └── functions/
        ├── whatsapp-send/
        │   └── index.ts    # Send WhatsApp messages
        └── whatsapp-webhook/
            └── index.ts    # Receive WhatsApp webhooks
```

---

## ✅ WHAT'S FULLY BUILT

| Component | File | Status |
|-----------|------|--------|
| Driver mobile app | index.html, app.js | ✅ Complete |
| Admin dashboard | admin.html | ✅ Complete |
| Store owner dashboard | store-owner.html | ✅ Complete |
| Menu management | store-owner.html | ✅ Complete |
| Order management | admin.html, store-owner.html | ✅ Complete |
| Analytics | analytics.html | ✅ Complete |
| User authentication | auth-guard.js, login.html | ✅ Complete |
| Notifications system | Built into dashboards | ✅ Complete |
| WhatsApp send function | supabase/functions/whatsapp-send | ✅ Code ready |
| WhatsApp webhook | supabase/functions/whatsapp-webhook | ✅ Code ready |
| Database schema | All tables in Supabase | ✅ Complete |

---

## ❌ WHAT'S NOT BUILT

| Component | Description | Blocker |
|-----------|-------------|---------|
| WhatsApp customer ordering bot | Conversation flow for customers to order via WhatsApp | Need to build logic |
| Stripe integration | Payment processing | Need to create account |
| WhatsApp API connection | Live connection to Meta | Meta 2FA blocked |

---

## 🚫 CURRENT BLOCKER

**Meta Business Verification**
- Cannot enable 2FA because device flagged as "new"
- Need to wait 24-48 hours for device trust
- Once trusted: Enable 2FA → Verify Business → Get WhatsApp API credentials
- Email: karimkaba@gmail.com controls all Meta assets

---

## 💰 BUSINESS MODEL

| Item | Value |
|------|-------|
| Platform fee | 15% of order |
| Additional revenue | Ads in WhatsApp messages |
| Pilot restaurant | AB King Pizza (403) 568-9299 |
| Target | Local Calgary restaurants escaping Skip/DoorDash fees |

---

## 🔑 ENVIRONMENT VARIABLES NEEDED

### Supabase Edge Functions (when Meta unlocks):
- `WHATSAPP_VERIFY_TOKEN` - Custom string for webhook verification
- `WHATSAPP_ACCESS_TOKEN` - From Meta Developer Console
- `WHATSAPP_PHONE_NUMBER_ID` - From WhatsApp Manager

### Already Configured:
- `SUPABASE_URL`: https://htzozoordnftgkjyadsf.supabase.co
- `SUPABASE_ANON_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

---

## 📋 NEXT ACTIONS

1. **Set up Stripe account** (can do now)
2. **Build WhatsApp customer ordering conversation flow** (can do now)
3. **Wait for Meta device trust** (24-48 hrs)
4. **Enable 2FA → Verify Business → Get API credentials**
5. **Deploy Edge Functions with real credentials**
6. **Connect to AB King Pizza for pilot**

---

## 📝 SESSION NOTES

### January 14, 2026
- Confirmed all database tables exist
- Confirmed all dashboards built
- Only missing: WhatsApp ordering bot logic + Stripe + Meta API access
- Meta blocked due to device trust issue

---

## ⚠️ IMPORTANT REMINDERS

1. DO NOT suggest setting up Supabase, Vercel, or GitHub - already done
2. DO NOT suggest building dashboards - already built
3. The WhatsApp tables exist but the ordering LOGIC needs to be built
4. Stripe account does NOT exist yet
5. Meta/Facebook is BLOCKED until device is trusted

---

## 🔄 HOW TO USE THIS DOCUMENT

1. Upload this file at the START of every new Claude session
2. At the END of each session, ask Claude to update this document
3. Save the updated version
4. Repeat tomorrow

This prevents repeating the same discovery process every day.
