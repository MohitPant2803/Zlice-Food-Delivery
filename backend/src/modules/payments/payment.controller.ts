import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { PaymentGateway } from './payment.interface.js';

export class PaymentController {
  /**
   * Initiate Payment session with Idempotency.
   */
  static async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { orderId, gateway, idempotencyKey } = req.body;
      const result = await PaymentService.initiatePayment({
        orderId,
        customerId: req.user.userId,
        gateway,
        idempotencyKey,
      });

      ApiResponse.created(res, 'Payment session initiated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Client-Side Payment Signature Verification.
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;
      const transaction = await PaymentService.verifyClientPayment({
        orderId,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
      });

      ApiResponse.success(res, 'Payment verified successfully', { transaction });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public Webhook Ingestion Endpoint.
   * Single Source of Truth for Financial Settlement.
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signatureHeader =
        (req.headers['x-razorpay-signature'] as string) ||
        (req.headers['stripe-signature'] as string) ||
        (req.headers['x-signature'] as string);

      if (!signatureHeader) {
        throw ApiError.unauthorized('Missing gateway signature header');
      }

      // Raw body as string for accurate HMAC calculation
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const gateway = (req.query.gateway as PaymentGateway) || PaymentGateway.RAZORPAY;

      const result = await PaymentService.handleWebhook(rawBody, signatureHeader, gateway);

      // Gateways expect 200 OK fast acknowledgement
      ApiResponse.success(res, 'Webhook processed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refund an Order.
   */
  static async refundOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const orderId = req.params.orderId as string;
      const { reason } = req.body;

      const transaction = await PaymentService.processRefund(orderId, reason, {
        userId: req.user.userId,
        role: req.user.role,
        canteenId: req.user.canteenId,
      });

      ApiResponse.success(res, 'Refund processed successfully', { transaction });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Customer Transaction History.
   */
  static async getMyTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const history = await PaymentService.getCustomerTransactions(req.user.userId, page, limit);
      ApiResponse.success(res, 'Payment transaction history retrieved', history);
    } catch (error) {
      next(error);
    }
  }
}
