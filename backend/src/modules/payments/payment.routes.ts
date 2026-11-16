import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { UserRole } from '../../constants/roles.js';
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  refundSchema,
} from './payment.validation.js';

const router = Router();

// 1. PUBLIC Webhook Endpoint (No JWT authentication; secured strictly via HMAC-SHA256 signature!)
router.post('/webhook', PaymentController.handleWebhook);

// Protected routes below
router.use(authenticate);

// 2. Customer Initiates Payment
router.post(
  '/initiate',
  requireRole(UserRole.CUSTOMER),
  validate(initiatePaymentSchema),
  PaymentController.initiatePayment
);

// 3. Customer Client Verification Handshake
router.post(
  '/verify',
  validate(verifyPaymentSchema),
  PaymentController.verifyPayment
);

// 4. Refund on Order Cancellation
router.post(
  '/orders/:orderId/refund',
  validate(refundSchema),
  PaymentController.refundOrder
);

// 5. Customer Transaction History
router.get('/history', PaymentController.getMyTransactions);

export const paymentRouter = router;
