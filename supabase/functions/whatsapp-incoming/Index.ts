// =====================================================
// LocalFirst YYC - WhatsApp Incoming Webhook
// Handles customer messages and provides ordering flow
// =====================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'localfirst_verify_2024';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// =====================================================
// WhatsApp API Helper
// =====================================================
async function sendWhatsAppMessage(to: string, message: any) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        ...message,
      }),
    }
  );
  return response.json();
}

// Send text message
async function sendText(to: string, text: string) {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { body: text },
  });
}

// Send interactive buttons
async function sendButtons(to: string, body: string, buttons: Array<{id: string, title: string}>, header?: string) {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: header ? { type: 'text', text: header } : undefined,
      body: { text: body },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  });
}

// Send interactive list
async function sendList(to: string, body: string, buttonText: string, sections: any[]) {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections
      }
    }
  });
}

// =====================================================
// Customer Session Management
// =====================================================
async function getOrCreateCustomer(phone: string, name: string) {
  // Check if customer exists
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('customer_phone', phone)
    .single();

  if (existing) {
    // Update last activity
    await supabase
      .from('whatsapp_conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        customer_name: name || existing.customer_name 
      })
      .eq('customer_phone', phone);
    return existing;
  }

  // Create new customer conversation
  const { data: newCustomer } = await supabase
    .from('whatsapp_conversations')
    .insert({
      customer_phone: phone,
      customer_name: name,
      state: 'welcome',
      cart: [],
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  return newCustomer;
}

async function updateCustomerState(phone: string, state: string, data?: any) {
  const updateData: any = { state, last_message_at: new Date().toISOString() };
  if (data) {
    Object.assign(updateData, data);
  }
  
  await supabase
    .from('whatsapp_conversations')
    .update(updateData)
    .eq('customer_phone', phone);
}

// =====================================================
// Menu Data (would come from database in production)
// =====================================================
const MENU = {
  pizzas: [
    { id: 'pepperoni', name: 'Pepperoni Pizza', price: 18.99, emoji: '🍕' },
    { id: 'hawaiian', name: 'Hawaiian Pizza', price: 19.99, emoji: '🍕' },
    { id: 'veggie', name: 'Veggie Supreme', price: 20.99, emoji: '🥗' },
    { id: 'meat', name: 'Meat Lovers', price: 22.99, emoji: '🥓' },
  ],
  sides: [
    { id: 'wings', name: 'Chicken Wings (10pc)', price: 14.99, emoji: '🍗' },
    { id: 'breadsticks', name: 'Garlic Breadsticks', price: 6.99, emoji: '🥖' },
    { id: 'salad', name: 'Caesar Salad', price: 8.99, emoji: '🥗' },
  ],
  drinks: [
    { id: 'coke', name: 'Coca-Cola', price: 2.99, emoji: '🥤' },
    { id: 'sprite', name: 'Sprite', price: 2.99, emoji: '🥤' },
    { id: 'water', name: 'Bottled Water', price: 1.99, emoji: '💧' },
  ]
};

// =====================================================
// Conversation Flow Handlers
// =====================================================
async function handleWelcome(phone: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there';
  
  await sendButtons(
    phone,
    `Hey ${firstName}! 👋\n\nWelcome to *LocalFirst YYC* - Calgary's local food delivery!\n\n` +
    `🏠 85% stays with the restaurant owner\n` +
    `💚 Drivers keep 100% of tips\n` +
    `🇨🇦 Supporting local Calgary families\n\n` +
    `Ready to order?`,
    [
      { id: 'start_order', title: '🍕 Start Order' },
      { id: 'about_us', title: '💚 About Us' },
    ],
    '🍕 LocalFirst YYC'
  );
  
  await updateCustomerState(phone, 'menu_main');
}

async function handleMainMenu(phone: string) {
  await sendList(
    phone,
    `What are you craving today? 😋\n\nBrowse our menu below:`,
    'View Menu',
    [
      {
        title: '🍕 Pizzas',
        rows: MENU.pizzas.map(item => ({
          id: `add_${item.id}`,
          title: item.name,
          description: `$${item.price.toFixed(2)}`
        }))
      },
      {
        title: '🍗 Sides',
        rows: MENU.sides.map(item => ({
          id: `add_${item.id}`,
          title: item.name,
          description: `$${item.price.toFixed(2)}`
        }))
      },
      {
        title: '🥤 Drinks',
        rows: MENU.drinks.map(item => ({
          id: `add_${item.id}`,
          title: item.name,
          description: `$${item.price.toFixed(2)}`
        }))
      }
    ]
  );
}

async function handleAddToCart(phone: string, itemId: string) {
  // Find the item
  const allItems = [...MENU.pizzas, ...MENU.sides, ...MENU.drinks];
  const item = allItems.find(i => i.id === itemId);
  
  if (!item) {
    await sendText(phone, "Sorry, I couldn't find that item. Please try again.");
    return;
  }

  // Get current cart
  const { data: customer } = await supabase
    .from('whatsapp_conversations')
    .select('cart')
    .eq('customer_phone', phone)
    .single();

  const cart = customer?.cart || [];
  cart.push({ ...item, addedAt: new Date().toISOString() });

  // Update cart
  await updateCustomerState(phone, 'menu_main', { cart });

  const total = cart.reduce((sum: number, i: any) => sum + i.price, 0);

  await sendButtons(
    phone,
    `✅ Added *${item.name}* to your cart!\n\n` +
    `🛒 Cart: ${cart.length} item(s) - $${total.toFixed(2)}\n\n` +
    `What would you like to do next?`,
    [
      { id: 'view_menu', title: '➕ Add More' },
      { id: 'view_cart', title: '🛒 View Cart' },
      { id: 'checkout', title: '✅ Checkout' },
    ]
  );
}

async function handleViewCart(phone: string) {
  const { data: customer } = await supabase
    .from('whatsapp_conversations')
    .select('cart')
    .eq('customer_phone', phone)
    .single();

  const cart = customer?.cart || [];

  if (cart.length === 0) {
    await sendButtons(
      phone,
      `Your cart is empty! 🛒\n\nLet's add some delicious food.`,
      [{ id: 'view_menu', title: '🍕 View Menu' }]
    );
    return;
  }

  const total = cart.reduce((sum: number, i: any) => sum + i.price, 0);
  const itemList = cart.map((i: any) => `• ${i.name} - $${i.price.toFixed(2)}`).join('\n');

  await sendButtons(
    phone,
    `🛒 *Your Cart*\n\n${itemList}\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `*Total: $${total.toFixed(2)}*`,
    [
      { id: 'view_menu', title: '➕ Add More' },
      { id: 'clear_cart', title: '🗑️ Clear Cart' },
      { id: 'checkout', title: '✅ Checkout' },
    ]
  );
}

async function handleCheckout(phone: string) {
  const { data: customer } = await supabase
    .from('whatsapp_conversations')
    .select('cart, customer_name, delivery_address')
    .eq('customer_phone', phone)
    .single();

  const cart = customer?.cart || [];
  if (cart.length === 0) {
    await sendText(phone, "Your cart is empty! Add some items first.");
    return;
  }

  if (!customer?.delivery_address) {
    await sendText(phone, "📍 Please send your delivery address:\n\n(e.g., 123 Main St NW, Calgary)");
    await updateCustomerState(phone, 'awaiting_address');
    return;
  }

  // Show order summary with tip options
  const subtotal = cart.reduce((sum: number, i: any) => sum + i.price, 0);
  const deliveryFee = 4.99;
  const total = subtotal + deliveryFee;

  await sendButtons(
    phone,
    `📋 *Order Summary*\n\n` +
    `${cart.map((i: any) => `• ${i.name} - $${i.price.toFixed(2)}`).join('\n')}\n\n` +
    `Subtotal: $${subtotal.toFixed(2)}\n` +
    `Delivery: $${deliveryFee.toFixed(2)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `*Total: $${total.toFixed(2)}*\n\n` +
    `📍 ${customer.delivery_address}\n\n` +
    `💚 *Add a tip?*\nDrivers keep 100% of tips!`,
    [
      { id: 'tip_0', title: 'No Tip' },
      { id: 'tip_3', title: '$3 Tip' },
      { id: 'tip_5', title: '$5 Tip' },
    ]
  );
  
  await updateCustomerState(phone, 'selecting_tip');
}

async function handleTipSelection(phone: string, tipAmount: number) {
  const { data: customer } = await supabase
    .from('whatsapp_conversations')
    .select('cart, customer_name, delivery_address')
    .eq('customer_phone', phone)
    .single();

  const cart = customer?.cart || [];
  const subtotal = cart.reduce((sum: number, i: any) => sum + i.price, 0);
  const deliveryFee = 4.99;
  const total = subtotal + deliveryFee + tipAmount;

  // Create order in database
  const orderNumber = 'LF-' + Date.now().toString().slice(-6);
  
  const { data: order } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_phone: phone,
      customer_name: customer?.customer_name,
      delivery_address: customer?.delivery_address,
      items: cart,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      tip: tipAmount,
      total: total,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Clear cart and update state
  await updateCustomerState(phone, 'order_confirmed', { cart: [], current_order_id: order?.id });

  // Send confirmation
  await sendText(
    phone,
    `🎉 *Order Confirmed!*\n\n` +
    `Order #${orderNumber}\n\n` +
    `📍 Delivering to:\n${customer?.delivery_address}\n\n` +
    `💰 Total: $${total.toFixed(2)}` +
    (tipAmount > 0 ? `\n💚 Tip: $${tipAmount.toFixed(2)} (driver keeps 100%!)` : '') +
    `\n\n` +
    `🚗 *Ahmed* is being notified and will pick up your order soon!\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💚 *You just made a difference!*\n` +
    `85% of your order stays with the restaurant owner.\n` +
    `Thank you for supporting local! 🇨🇦`
  );

  // Send tracking link
  await sendButtons(
    phone,
    `Track your order in real-time:`,
    [{ id: 'track_order', title: '📍 Track Order' }]
  );
}

async function handleAddress(phone: string, address: string) {
  await updateCustomerState(phone, 'menu_main', { delivery_address: address });
  
  await sendText(phone, `✅ Address saved:\n📍 ${address}\n\nContinuing to checkout...`);
  
  // Continue to checkout
  setTimeout(() => handleCheckout(phone), 1000);
}

// =====================================================
// Main Message Router
// =====================================================
async function handleIncomingMessage(phone: string, name: string, message: string, buttonId?: string) {
  console.log(`📱 Message from ${phone} (${name}): ${message || buttonId}`);

  // Log message
  await supabase.from('whatsapp_messages').insert({
    customer_phone: phone,
    direction: 'incoming',
    message_type: buttonId ? 'button' : 'text',
    content: message || buttonId,
    created_at: new Date().toISOString(),
  });

  // Get or create customer
  const customer = await getOrCreateCustomer(phone, name);
  const state = customer?.state || 'welcome';

  // Handle button responses
  if (buttonId) {
    if (buttonId === 'start_order' || buttonId === 'view_menu') {
      await handleMainMenu(phone);
      return;
    }
    if (buttonId === 'about_us') {
      await sendText(phone, 
        `💚 *About LocalFirst YYC*\n\n` +
        `We're Calgary's local food delivery platform.\n\n` +
        `Unlike Skip & DoorDash (who take 30%+), we only take 15%.\n\n` +
        `• 🏠 Restaurant owners keep 85%\n` +
        `• 🚗 Drivers keep 100% of tips\n` +
        `• 🇨🇦 Supporting local families\n\n` +
        `Every order makes a difference!`
      );
      await handleMainMenu(phone);
      return;
    }
    if (buttonId.startsWith('add_')) {
      const itemId = buttonId.replace('add_', '');
      await handleAddToCart(phone, itemId);
      return;
    }
    if (buttonId === 'view_cart') {
      await handleViewCart(phone);
      return;
    }
    if (buttonId === 'checkout') {
      await handleCheckout(phone);
      return;
    }
    if (buttonId === 'clear_cart') {
      await updateCustomerState(phone, 'menu_main', { cart: [] });
      await sendText(phone, "🗑️ Cart cleared!");
      await handleMainMenu(phone);
      return;
    }
    if (buttonId.startsWith('tip_')) {
      const tip = parseInt(buttonId.replace('tip_', ''));
      await handleTipSelection(phone, tip);
      return;
    }
    if (buttonId === 'track_order') {
      await sendText(phone, `📍 Track your order here:\nhttps://localfirst-yyc.vercel.app/track.html`);
      return;
    }
  }

  // Handle text messages based on state
  if (state === 'awaiting_address') {
    await handleAddress(phone, message);
    return;
  }

  // Default: show welcome/menu
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('start') || lowerMessage.includes('menu')) {
    await handleWelcome(phone, name);
  } else if (lowerMessage.includes('cart')) {
    await handleViewCart(phone);
  } else if (lowerMessage.includes('order') || lowerMessage.includes('checkout')) {
    await handleCheckout(phone);
  } else {
    // Unknown message - show menu
    await handleWelcome(phone, name);
  }
}

// =====================================================
// Webhook Handler
// =====================================================
serve(async (req: Request) => {
  const url = new URL(req.url);

  // Webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming messages (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      // Log webhook
      await supabase.from('whatsapp_webhook_logs').insert({
        payload: body,
        created_at: new Date().toISOString(),
      });

      // Process messages
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        for (const msg of value.messages) {
          const phone = msg.from; // ← PHONE NUMBER AUTO-PROVIDED BY WHATSAPP!
          const contact = value.contacts?.find((c: any) => c.wa_id === phone);
          const name = contact?.profile?.name || ''; // ← NAME FROM WHATSAPP PROFILE!

          if (msg.type === 'text') {
            await handleIncomingMessage(phone, name, msg.text.body);
          } else if (msg.type === 'interactive') {
            const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
            await handleIncomingMessage(phone, name, '', buttonId);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response(JSON.stringify({ error: 'Processing failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
