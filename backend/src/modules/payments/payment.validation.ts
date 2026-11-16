import { z } from 'zod';
import { PaymentGateway } from './payment.interface.js';

export const initiatePaymentSchema = z.object({
  body: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
    gateway: z.nativeEnum(PaymentGateway).default(PaymentGateway.RAZORPAY),
    idempotencyKey: z.string().min(10, 'Idempotency key must be at least 10 characters'),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
    gatewayOrderId: z.string().min(5, 'Invalid gatewayOrderId'),
    gatewayPaymentId: z.string().min(5, 'Invalid gatewayPaymentId'),
    gatewaySignature: z.string().min(16, 'Invalid gatewaySignature'),
  }),
});

export const refundSchema = z.object({
  params: z.object({
    orderId: z.string().min(12, 'Invalid orderId'),
  }),
  body: z.object({
    reason: z.string().min(5, 'Refund reason required').max(300),
  }),
});
