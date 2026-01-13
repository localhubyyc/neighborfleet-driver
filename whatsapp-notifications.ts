// =====================================================
// NeighborFleet WhatsApp Notification Utility
// Client-side helper for sending driver notifications
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface WhatsAppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  params?: string[];
  language?: string;
}

export interface SendTextOptions {
  to: string;
  message: string;
  previewUrl?: boolean;
}

export interface SendButtonOptions {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
  header?: string;
  footer?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =====================================================
// WhatsApp Notification Client
// =====================================================
export class WhatsAppNotifications {
  private supabase: SupabaseClient;
  private functionUrl: string;

  constructor(config: WhatsAppConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.functionUrl = `${config.supabaseUrl}/functions/v1/whatsapp-send`;
  }

  // -------------------------------------------------
  // Send Template Message
  // -------------------------------------------------
  async sendTemplate(options: SendTemplateOptions): Promise<NotificationResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke('whatsapp-send', {
        body: {
          type: 'template',
          to: options.to,
          templateName: options.templateName,
          templateParams: options.params || [],
          language: options.language || 'en',
        },
      });

      if (error) throw error;
      return { success: true, messageId: data.messageId };
    } catch (error: any) {
      console.error('Failed to send template:', error);
      return { success: false, error: error.message };
    }
  }

  // -------------------------------------------------
  // Send Text Message (within 24-hour window only)
  // -------------------------------------------------
  async sendText(options: SendTextOptions): Promise<NotificationResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke('whatsapp-send', {
        body: {
          type: 'text',
          to: options.to,
          message: options.message,
          previewUrl: options.previewUrl || false,
        },
      });

      if (error) throw error;
      return { success: true, messageId: data.messageId };
    } catch (error: any) {
      console.error('Failed to send text:', error);
      return { success: false, error: error.message };
    }
  }

  // -------------------------------------------------
  // Send Interactive Button Message
  // -------------------------------------------------
  async sendButtons(options: SendButtonOptions): Promise<NotificationResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke('whatsapp-send', {
        body: {
          type: 'interactive',
          to: options.to,
          interactiveType: 'button',
          body: options.body,
          header: options.header,
          footer: options.footer,
          buttons: options.buttons,
        },
      });

      if (error) throw error;
      return { success: true, messageId: data.messageId };
    } catch (error: any) {
      console.error('Failed to send buttons:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // Pre-built Notification Methods
  // =====================================================

  /**
   * Notify driver of a new delivery opportunity
   */
  async notifyNewDelivery(
    driverPhone: string,
    driverName: string,
    pickupAddress: string,
    dropoffAddress: string,
    earnings: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'new_delivery_assignment',
      params: [driverName, pickupAddress, dropoffAddress, earnings],
    });
  }

  /**
   * Send delivery reminder to driver
   */
  async sendDeliveryReminder(
    driverPhone: string,
    driverName: string,
    minutesUntilPickup: string,
    pickupAddress: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'delivery_reminder',
      params: [driverName, minutesUntilPickup, pickupAddress],
    });
  }

  /**
   * Confirm delivery completion
   */
  async confirmDeliveryComplete(
    driverPhone: string,
    driverName: string,
    deliveryId: string,
    earnings: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'delivery_confirmed',
      params: [driverName, deliveryId, earnings],
    });
  }

  /**
   * Notify driver of payment
   */
  async notifyPaymentSent(
    driverPhone: string,
    driverName: string,
    amount: string,
    payPeriod: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'payment_sent',
      params: [driverName, amount, payPeriod],
    });
  }

  /**
   * Notify driver of schedule update
   */
  async notifyScheduleUpdate(
    driverPhone: string,
    driverName: string,
    scheduleDetails: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'schedule_update',
      params: [driverName, scheduleDetails],
    });
  }

  /**
   * Send welcome message to new driver
   */
  async sendWelcome(
    driverPhone: string,
    driverName: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'welcome_driver',
      params: [driverName],
    });
  }

  /**
   * Notify driver of pickup confirmation
   */
  async notifyPickupConfirmed(
    driverPhone: string,
    driverName: string,
    deliveryId: string,
    dropoffAddress: string,
    eta: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'delivery_picked_up',
      params: [driverName, deliveryId, dropoffAddress, eta],
    });
  }

  /**
   * Send urgent delivery alert
   */
  async sendUrgentDeliveryAlert(
    driverPhone: string,
    driverName: string,
    pickupAddress: string,
    dropoffAddress: string,
    bonusAmount: string
  ): Promise<NotificationResult> {
    return this.sendTemplate({
      to: driverPhone,
      templateName: 'urgent_delivery',
      params: [driverName, pickupAddress, dropoffAddress, bonusAmount],
    });
  }
}

// =====================================================
// Singleton Instance
// =====================================================
let whatsappInstance: WhatsAppNotifications | null = null;

export function initWhatsApp(config: WhatsAppConfig): WhatsAppNotifications {
  whatsappInstance = new WhatsAppNotifications(config);
  return whatsappInstance;
}

export function getWhatsApp(): WhatsAppNotifications {
  if (!whatsappInstance) {
    throw new Error('WhatsApp notifications not initialized. Call initWhatsApp() first.');
  }
  return whatsappInstance;
}

// =====================================================
// Usage Example
// =====================================================
/*
import { initWhatsApp, getWhatsApp } from './whatsapp-notifications';

// Initialize once at app startup
initWhatsApp({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});

// Use anywhere in your app
const whatsapp = getWhatsApp();

// Send a new delivery notification
await whatsapp.notifyNewDelivery(
  '+14031234567',
  'John',
  '123 Main St, Calgary',
  '456 Oak Ave, Calgary',
  '15.50'
);

// Send payment notification
await whatsapp.notifyPaymentSent(
  '+14031234567',
  'John',
  '425.50',
  'Jan 6-12, 2026'
);
*/
