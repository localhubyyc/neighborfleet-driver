# WhatsApp Business API Setup Guide

## How It Works

When a customer messages your WhatsApp Business number, Meta (Facebook) automatically sends their **phone number** and **profile name** to your webhook. No manual input needed!

```
Customer sends "Hi" to your WhatsApp Business number
                    ↓
Meta sends to your webhook:
{
  "from": "14038265529",     ← Auto-provided!
  "profile": { "name": "Karim" }  ← From their WhatsApp!
}
                    ↓
Your bot responds with menus, takes order
```

## Step 1: Create Meta Developer Account

1. Go to https://developers.facebook.com/
2. Create a developer account (if you don't have one)
3. Create a new App → Select "Business" type
4. Add "WhatsApp" product to your app

## Step 2: Get WhatsApp Business API Credentials

In your Meta Developer Dashboard:

1. Go to WhatsApp → API Setup
2. Note down these values:
   - **Phone Number ID**: `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID**: `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - Generate a **Permanent Access Token**: `WHATSAPP_ACCESS_TOKEN`

## Step 3: Configure Webhook

1. In Meta Dashboard → WhatsApp → Configuration
2. Set Webhook URL to:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-incoming
   ```
3. Set Verify Token to:
   ```
   localfirst_verify_2024
   ```
4. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`

## Step 4: Set Environment Variables in Supabase

Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add these secrets:
```
WHATSAPP_ACCESS_TOKEN=your_permanent_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=localfirst_verify_2024
```

## Step 5: Deploy the Edge Function

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy whatsapp-incoming
```

## Step 6: Database Tables

Make sure you have these tables in Supabase:

```sql
-- WhatsApp conversations (customer sessions)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  state TEXT DEFAULT 'welcome',
  cart JSONB DEFAULT '[]',
  delivery_address TEXT,
  current_order_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp messages log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
  message_type TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Step 7: Test It!

1. Add your personal phone as a test number in Meta Dashboard
2. Send "Hi" to your WhatsApp Business number
3. You should receive the welcome message with menu buttons!

## Customer Flow

```
📱 Customer texts "Hi"
        ↓
🤖 Bot: "Hey Karim! 👋 Welcome to LocalFirst YYC..."
        [🍕 Start Order] [💚 About Us]
        ↓
📱 Customer taps "Start Order"
        ↓
🤖 Bot shows menu list with pizzas, sides, drinks
        ↓
📱 Customer selects items
        ↓
🤖 Bot: "✅ Added Pepperoni Pizza!"
        [➕ Add More] [🛒 View Cart] [✅ Checkout]
        ↓
📱 Customer taps "Checkout"
        ↓
🤖 Bot asks for delivery address
        ↓
📱 Customer sends: "123 Main St NW, Calgary"
        ↓
🤖 Bot shows order summary + tip options
        ↓
📱 Customer selects tip
        ↓
🎉 Order confirmed! Driver notified!
```

## Cost

WhatsApp Business API pricing (as of 2024):
- **First 1,000 conversations/month**: FREE
- **After that**: ~$0.05-0.15 per conversation (24-hour window)

A "conversation" is a 24-hour messaging window, not per-message.

## Support

Need help? Contact LocalFirst YYC
📞 (403) 826-5529
