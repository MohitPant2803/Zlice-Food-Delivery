import crypto from 'crypto';
import { Types } from 'mongoose';
import { PaymentTransaction, WebhookLog } from './payment.model.js';
import {
  PaymentGateway,
  PaymentStatus,
  IPaymentTransaction,
} from './payment.interface.js';
import { Order } from '../orders/order.model.js';
import { OrderStatus } from '../orders/order.interface.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { SocketGateway } from '../tracking/socket.gateway.js';

const MOCK_WEBHOOK_SECRET = 'zlice_webhook_secret_key_2026_super_secure';

export class PaymentService {
  /**
   * Generates HMAC-SHA256 signature for client verification and webhooks.
   */
  static generateHmacSignature(data: string, secret = MOCK_WEBHOOK_SECRET): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Timing-safe comparison to prevent timing attacks on signatures.
   */
  static timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Initiates payment for an order with strict Idempotency.
   */
  static async initiatePayment(params: {
    orderId: string;
    customerId: string;
    gateway: PaymentGateway;
    idempotencyKey: string;
  }): Promise<{ transaction: IPaymentTransaction; clientPayload: any }> {
    const { orderId, customerId, gateway, idempotencyKey } = params;

    // 1. Idempotency Check: Prevent duplicate payment sessions
    const existingTransaction = await PaymentTransaction.findOne({ idempotencyKey });
    if (existingTransaction) {
      logger.info(`Idempotent payment request matched for key [${idempotencyKey}]`);
      return {
        transaction: existingTransaction,
        clientPayload: {
          gatewayOrderId: existingTransaction.gatewayOrderId,
          amount: existingTransaction.amount,
          currency: existingTransaction.currency,
          key: 'rzp_test_zlice_key_123',
        },
      };
    }

    // 2. Validate Order State
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.customerId.toString() !== customerId) {
      throw ApiError.forbidden('You do not have permission to pay for this order');
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      throw ApiError.badRequest(`Cannot initiate payment for order in '${order.status}' state`);
    }

    // 3. Generate Gateway Order Identifier (Mocking Razorpay/Stripe Gateway Order Creation)
    const gatewayOrderId = `order_${gateway.slice(0, 3)}_${crypto.randomBytes(6).toString('hex')}`;

    // 4. Create Payment Transaction Record
    const transaction = await PaymentTransaction.create({
      orderId: order._id,
      customerId: new Types.ObjectId(customerId),
      canteenId: order.canteenId,
      amount: order.pricing.totalAmount,
      currency: 'INR',
      gateway,
      gatewayOrderId,
      status: PaymentStatus.INITIATED,
      idempotencyKey,
      metadata: {
        orderNumber: order.orderNumber,
        itemsCount: order.items.length,
      },
    });

    logger.info(`💳 Payment [${transaction._id}] INITIATED for Order [${order.orderNumber}] Amount: ₹${transaction.amount}`);

    return {
      transaction,
      clientPayload: {
        gatewayOrderId,
        amount: transaction.amount,
        currency: transaction.currency,
        key: 'rzp_test_zlice_key_123',
      },
    };
  }

  /**
   * Verifies client-side payment completion signature (Redirect / App Return).
   */
  static async verifyClientPayment(params: {
    orderId: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
  }): Promise<IPaymentTransaction> {
    const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = params;

    // 1. Re-calculate HMAC signature
    const signaturePayload = `${gatewayOrderId}|${gatewayPaymentId}`;
    const expectedSignature = this.generateHmacSignature(signaturePayload);

    const isValid = this.timingSafeCompare(expectedSignature, gatewaySignature);
    if (!isValid) {
      logger.warn(`🚨 INVALID PAYMENT SIGNATURE for Gateway Order [${gatewayOrderId}]`);
      throw ApiError.badRequest('Payment verification failed: Invalid cryptographic signature');
    }

    // 2. Update Payment Transaction to SUCCESS
    const transaction = await PaymentTransaction.findOneAndUpdate(
      { gatewayOrderId },
      {
        status: PaymentStatus.SUCCESS,
        gatewayPaymentId,
        gatewaySignature,
      },
      { new: true }
    );

    if (!transaction) {
      throw ApiError.notFound('Payment transaction record not found');
    }

    // 3. Advance Order State & Alert Kitchen
    const order = await Order.findById(orderId);
    if (order && order.status === OrderStatus.PLACED) {
      try {
        SocketGateway.broadcastOrderStatus(order._id.toString(), order.canteenId.toString(), order.status, {
          paymentSuccess: true,
          amountPaid: transaction.amount,
        });
      } catch {
        // Socket broadcast optional
      }
    }

    logger.info(`✅ Payment [${transaction.gatewayPaymentId}] VERIFIED for Order [${orderId}]`);

    return transaction;
  }

  /**
   * Ingest and process Gateway Webhooks (The Ultimate Single Source of Truth).
   * Defends against replay attacks and duplicate webhook deliveries.
   */
  static async handleWebhook(
    rawBody: string,
    signatureHeader: string,
    gateway: PaymentGateway
  ): Promise<{ processed: boolean; event: string }> {
    // 1. Verify Webhook HMAC Signature
    const expectedSignature = this.generateHmacSignature(rawBody);
    if (!this.timingSafeCompare(expectedSignature, signatureHeader)) {
      logger.error('🚨 SPOOFED WEBHOOK DETECTED: Invalid webhook HMAC signature!');
      throw ApiError.unauthorized('Webhook signature verification failed');
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id || payload.event_id || `evt_${crypto.randomBytes(8).toString('hex')}`;
    const eventType = payload.event || payload.type || 'payment.captured';

    // 2. Idempotency Guard: Avoid duplicate processing if webhook is re-sent by gateway
    const existingLog = await WebhookLog.findOne({ eventId, gateway });
    if (existingLog && existingLog.status === 'processed') {
      logger.warn(`🔁 Duplicate webhook event [${eventId}] received. Acknowledging without re-processing.`);
      return { processed: true, event: eventType };
    }

    // 3. Handle Event Types
    try {
      if (eventType === 'payment.captured' || eventType === 'charge.succeeded') {
        const gatewayOrderId = payload.payload?.payment?.entity?.order_id || payload.data?.object?.id;
        const gatewayPaymentId = payload.payload?.payment?.entity?.id || payload.data?.object?.payment_intent;

        if (gatewayOrderId) {
          const transaction = await PaymentTransaction.findOneAndUpdate(
            { gatewayOrderId },
            {
              status: PaymentStatus.SUCCESS,
              gatewayPaymentId,
            },
            { new: true }
          );

          if (transaction) {
            // Guarantee order is marked confirmed
            await Order.findByIdAndUpdate(transaction.orderId, {
              status: OrderStatus.PLACED,
            });
            logger.info(`🔔 Webhook confirmed payment for Order [${transaction.orderId}]`);
          }
        }
      } else if (eventType === 'payment.failed') {
        const gatewayOrderId = payload.payload?.payment?.entity?.order_id;
        const reason = payload.payload?.payment?.entity?.error_description || 'Payment failed';

        await PaymentTransaction.findOneAndUpdate(
          { gatewayOrderId },
          {
            status: PaymentStatus.FAILED,
            failureReason: reason,
          }
        );
        logger.warn(`❌ Webhook recorded payment failure for Gateway Order [${gatewayOrderId}]: ${reason}`);
      }

      // 4. Log Processed Webhook Event
      await WebhookLog.create({
        eventId,
        gateway,
        eventType,
        payload,
        status: 'processed',
        processedAt: new Date(),
      });

      return { processed: true, event: eventType };
    } catch (err: any) {
      await WebhookLog.create({
        eventId,
        gateway,
        eventType,
        payload,
        status: 'failed',
        processedAt: new Date(),
      });
      throw err;
    }
  }

  /**
   * Process refund on cancelled order.
   */
  static async processRefund(
    orderId: string,
    reason: string,
    userContext: { userId: string; role: string; canteenId?: string }
  ): Promise<IPaymentTransaction> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status !== OrderStatus.CANCELLED) {
      throw ApiError.badRequest('Refunds can only be processed for cancelled orders');
    }

    const transaction = await PaymentTransaction.findOne({
      orderId: order._id,
      status: PaymentStatus.SUCCESS,
    });

    if (!transaction) {
      throw ApiError.badRequest('No successful payment found to refund for this order');
    }

    if (transaction.status === PaymentStatus.REFUNDED) {
      throw ApiError.badRequest('This order payment has already been refunded');
    }

    // Mock Gateway Refund API Call
    const refundId = `rfnd_${crypto.randomBytes(6).toString('hex')}`;

    transaction.status = PaymentStatus.REFUNDED;
    transaction.refund = {
      refundId,
      amount: transaction.amount,
      reason,
      status: 'completed',
      refundedAt: new Date(),
    };

    await transaction.save();
    logger.info(`💸 REFUND [${refundId}] PROCESSED for Order [${order.orderNumber}] Amount: ₹${transaction.amount}`);

    return transaction;
  }

  /**
   * Customer Transaction History.
   */
  static async getCustomerTransactions(customerId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find({ customerId: new Types.ObjectId(customerId) })
        .populate('orderId', 'orderNumber status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentTransaction.countDocuments({ customerId: new Types.ObjectId(customerId) }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
