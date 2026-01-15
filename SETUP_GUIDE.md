# LocalFirst YYC - Complete Setup Guide

## Your Questions Answered

---

## 1️⃣ Where to Save Schema and Webhook

### Database Schema (`supabase-schema-v2.sql`)

**Save it in: Supabase SQL Editor**

```
1. Go to https://supabase.com/dashboard
2. Select your project (dvmqgnxxtaalkaxjhzjk)
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Paste entire contents of supabase-schema-v2.sql
6. Click "Run" (or Ctrl+Enter)
```

This creates:
- `customers` table (auto-filled from WhatsApp)
- `orders` table (with discount tracking)
- `drivers` table
- `get_or_create_customer()` function

---

### Webhook (`whatsapp-webhook.js`)

**Save it on: Your Server (Vercel, Railway, or Render)**

**Option A: Vercel (Recommended - Free)**
```bash
# 1. Create folder structure
my-webhook/
├── api/
│   └── webhook.js    # Copy whatsapp-webhook.js here
├── package.json
└── vercel.json

# 2. Deploy
vercel deploy
```

**Option B: Railway ($5/month)**
```bash
# 1. Push to GitHub
git add .
git commit -m "WhatsApp webhook"
git push

# 2. Connect Railway to your repo
# 3. Set environment variables in Railway dashboard
```

**Option C: Render (Free tier)**
```bash
# Similar to Railway - connect GitHub repo
```

**Environment Variables Needed:**
```
SUPABASE_SERVICE_KEY=your_service_key
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_id
VERIFY_TOKEN=your_custom_verify_token
```

---

## 2️⃣ Broadcast Messages - YES! 📢

Since you have customer phone numbers from WhatsApp, you CAN send broadcast messages!

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Your Database                                              │
│  ─────────────                                              │
│  customers table has:                                       │
│  - whatsapp_phone: "14035551234"                           │
│  - whatsapp_name: "Sarah Johnson"                          │
│  - last_order_at: "2025-01-10"                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Weekly Broadcast Script                                    │
│  ───────────────────────                                    │
│  1. Query customers who ordered in last 30 days             │
│  2. Send WhatsApp message to each                           │
│  3. Track delivery status                                   │
└─────────────────────────────────────────────────────────────┘
```

### Sample Broadcast Code

```javascript
// broadcast.js - Run weekly via cron job

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendWeeklyBroadcast() {
    // Get customers who ordered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: customers } = await supabase
        .from('customers')
        .select('whatsapp_phone, whatsapp_name')
        .gte('last_order_at', thirtyDaysAgo.toISOString());
    
    const message = `🍕 Hey {name}! This week's special:
    
20% OFF all pizzas at AB King Pizza!
Use code: PIZZA20

Order now on LocalFirst YYC 💚`;

    for (const customer of customers) {
        await sendWhatsAppMessage(
            customer.whatsapp_phone,
            message.replace('{name}', customer.whatsapp_name.split(' ')[0])
        );
        
        // Rate limit: 1 message per second
        await sleep(1000);
    }
    
    console.log(`✅ Sent to ${customers.length} customers`);
}
```

### WhatsApp Broadcast Rules

| Rule | Limit |
|------|-------|
| Business-initiated messages | 24-hour window OR use templates |
| Template messages | Unlimited (pre-approved) |
| Rate limit | ~80 messages/second |
| Opt-out | Must honor "STOP" requests |

**Pro tip:** Use WhatsApp Message Templates for broadcasts - they're pre-approved and can be sent anytime!

---

## 3️⃣ Store/Kitchen Receipt Printing

The kitchen needs to know when an order comes in!

### Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Customer   │      │   Supabase   │      │  Restaurant  │
│   Orders     │ ───► │   Database   │ ───► │   Printer    │
└──────────────┘      └──────────────┘      └──────────────┘
                            │
                     Realtime webhook
                            │
                            ▼
                    ┌──────────────┐
                    │   Print      │
                    │   Server     │
                    │   (at store) │
                    └──────────────┘
```

### Option A: Cloud Print (Recommended)

Use services like:
- **Star CloudPRNT** - Star TSP printers
- **Epson Connect** - Epson TM printers
- **PrintNode** - Any printer

```javascript
// When order is saved, trigger print
supabase
    .channel('new-orders')
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
    }, (payload) => {
        printKitchenReceipt(payload.new);
    })
    .subscribe();
```

### Option B: Local Print Server (at restaurant)

Small Raspberry Pi at each restaurant that:
1. Listens for new orders via Supabase realtime
2. Generates PDF receipt
3. Sends to thermal printer

---

## 4️⃣ & 5️⃣ Receipt PDFs with Stories

Created! See the attached PDFs:

### Customer Receipt (`customer_receipt.pdf`)
- Order details
- 💚 **THE STORY** - Restaurant owner's story
- 🚗 Driver's story
- Community impact message
- Beautiful LocalFirst branding

### Kitchen Receipt (`kitchen_receipt.pdf`)
- Large, clear order number
- Customer name (for calling out)
- All items in BIG text
- COD warning if cash payment
- Optimized for 80mm thermal printers

### Kitchen Receipt COD (`kitchen_receipt_cod.pdf`)
- Same as above but with COD warning highlighted

---

## 6️⃣ Delivery Module - Added to Demo!

The demo now includes:

### Driver Dashboard
```javascript
driverMode()  // Switch to driver view
```

Shows:
- Driver status (online/offline)
- Today's earnings & stats
- Available orders to accept
- Accept/decline buttons

### Delivery Simulation
```javascript
simulateDelivery()  // After placing an order
```

Simulates:
1. 🍳 Preparing (1 sec)
2. 🚗 Picked up (5 sec)
3. 📍 Arriving (10 sec)
4. ✅ Delivered (15 sec)

### Broadcast Composer
```javascript
showBroadcast()  // Open broadcast UI
```

- Select from templates
- Write custom messages
- See audience count
- Send to all customers

---

## All Demo Commands (Browser Console)

```javascript
// Customer Management
viewCustomer()          // See saved customer data
viewOrderHistory()      // See all orders
resetEverything()       // Fresh start

// COD Testing
simulateFailedCOD()     // Block COD
resetCODStatus()        // Reset COD

// Delivery Module
driverMode()            // Switch to driver view
customerMode()          // Back to customer view
simulateDelivery()      // Simulate delivery progress
showBroadcast()         // Open broadcast composer
```

---

## File Summary

| File | Purpose | Where to Use |
|------|---------|--------------|
| `whatsapp-preview.html` | Demo UI | Open in browser |
| `supabase-schema-v2.sql` | Database schema | Supabase SQL Editor |
| `whatsapp-webhook.js` | Server webhook | Vercel/Railway/Render |
| `receipt_generator.py` | PDF generator | Your server |
| `customer_receipt.pdf` | Sample receipt | Send to customers |
| `kitchen_receipt.pdf` | Sample kitchen ticket | Print at restaurant |

---

## Next Steps

1. ✅ Run schema in Supabase
2. ✅ Deploy webhook to Vercel
3. ✅ Apply for WhatsApp Business API
4. ✅ Set up cloud printing at restaurants
5. ✅ Configure weekly broadcast cron job
6. 🚀 Launch!

---

## Questions?

Contact: (403) 826-5529
WhatsApp: Same number 💚
