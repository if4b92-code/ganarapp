
import { Sticker, OwnerData } from '../types';
import { dbService } from './mockDb';

// Esta es una URL de marcador de posición. En producción, necesitarás una URL pública
// para tu backend. Puedes usar servicios como ngrok para probarlo localmente.
const NOTIFICATION_URL = 'https://<tu-dominio-publico>/api/pagos/notificacion';

interface PaymentPreferenceParams {
  sticker: Sticker;
  ownerData: OwnerData;
}

export const paymentService = {
  /**
   * Crea una preferencia de pago en Mercado Pago.
   */
  createPaymentPreference: async ({ sticker, ownerData }: PaymentPreferenceParams) => {
    try {
      const settings = await dbService.getSettings();
      const mpAccessToken = settings.mpAccessToken;

      if (!mpAccessToken) {
        throw new Error('Mercado Pago Access Token no está configurado.');
      }

      const preferenceData = {
        items: [
          {
            title: `Ticket de Rifa - Número ${sticker.numbers}`,
            description: 'Ticket para el sorteo de GanarApp',
            quantity: 1,
            currency_id: 'COP', // Moneda colombiana
            unit_price: settings.ticketPrice,
          },
        ],
        payer: {
          name: ownerData.fullName,
          email: ownerData.email,
          phone: {
            area_code: '57',
            number: ownerData.phone.replace(/\D/g, '').substring(2), // Asume que el teléfono viene con +57
          },
          identification: {
            type: 'CC',
            number: ownerData.documentId,
          },
        },
        back_urls: {
          success: `${window.location.origin}/wallet?status=success&sticker_id=${sticker.id}`,
          failure: `${window.location.origin}/wallet?status=failure&sticker_id=${sticker.id}`,
          pending: `${window.location.origin}/wallet?status=pending&sticker_id=${sticker.id}`,
        },
        auto_return: 'approved',
        notification_url: NOTIFICATION_URL,
        // Metadata es crucial para identificar el pago en el webhook
        metadata: {
          sticker_id: sticker.id,
          user_id: sticker.userId, // El número de WhatsApp
        },
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(preferenceData),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error creando preferencia de pago:', error);
        throw new Error('Error al conectar con Mercado Pago.');
      }

      const preference = await response.json();
      return { success: true, preferenceId: preference.id, initPoint: preference.init_point };

    } catch (error) {
      console.error(error);
      return { success: false, message: (error as Error).message };
    }
  },

  /**
   * Maneja la notificación de pago de Mercado Pago (Webhook).
   * Esta función se ejecutaría en un entorno de backend.
   */
  handlePaymentNotification: async (notification: any) => {
    // ESTA ES UNA IMPLEMENTACIÓN SIMULADA PARA EL FRONTEND
    // En un proyecto real, esto correría en tu servidor.
    console.log('Notificación de Mercado Pago recibida:', notification);

    if (notification.type === 'payment' && notification.data && notification.data.id) {
      const paymentId = notification.data.id;
      const settings = await dbService.getSettings();
      const mpAccessToken = settings.mpAccessToken;

      try {
        // 1. Consultar el pago real en Mercado Pago
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`,
          },
        });

        if (!paymentResponse.ok) {
          throw new Error('No se pudo obtener la información del pago.');
        }

        const paymentInfo = await paymentResponse.json();
        const metadata = paymentInfo.metadata;
        const stickerId = metadata.sticker_id;

        // 2. Verificar el estado del pago
        if (paymentInfo.status === 'approved') {
          // 3. Actualizar el estado del ticket en la base de datos
          const result = await dbService.confirmTicketPayment(stickerId);
          if (result.success) {
            console.log(`[Webhook] Ticket ${stickerId} pagado y activado exitosamente.`);
            
            // Opcional: Aquí podrías enviar una notificación por WhatsApp o email al usuario
            
            return { success: true };
          } else {
            console.error(`[Webhook] Error al activar el ticket ${stickerId}:`, result.message);
            return { success: false, message: result.message };
          }
        } else {
          console.log(`[Webhook] El pago ${paymentId} no fue aprobado. Estado: ${paymentInfo.status}`);
          return { success: true }; // Se procesó correctamente, aunque el pago no fue exitoso
        }
      } catch (error) {
        console.error('[Webhook] Error procesando la notificación:', error);
        return { success: false, message: (error as Error).message };
      }
    }
    return { success: true }; // Responde OK a notificaciones no relevantes
  },
};
