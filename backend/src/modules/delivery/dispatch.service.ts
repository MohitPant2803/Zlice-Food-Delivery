import { Types } from 'mongoose';
import { User } from '../users/user.model.js';
import { Order } from '../orders/order.model.js';
import { Canteen } from '../canteens/canteen.model.js';
import { DeliveryAssignment } from './assignment.model.js';
import { DeliveryAssignmentStatus, IDeliveryAssignment } from './assignment.interface.js';
import { OrderStatus } from '../orders/order.interface.js';
import { UserRole } from '../../constants/roles.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { IUser } from '../users/user.interface.js';

export const ASSIGNMENT_TIMEOUT_SECONDS = 30;
export const MAX_DISPATCH_ATTEMPTS = 5;

export interface ICandidateScored {
  partner: IUser;
  distanceMeters: number;
  score: number;
}

export class DispatchService {
  /**
   * Calculate distance between two coordinates in meters using the Haversine formula.
   */
  static calculateDistanceMeters(
    coord1: [number, number], // [lng, lat]
    coord2: [number, number]
  ): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371e3; // Earth's radius in meters

    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  /**
   * Multi-Factor Candidate Scoring Engine.
   * Balances proximity, vehicle speed, acceptance rate, and rating.
   */
  static scoreCandidate(partner: IUser, distanceMeters: number): number {
    // 1. Distance factor (0 to 1): decay with distance
    const distFactor = 1000 / (1000 + distanceMeters);

    // 2. Vehicle speed weight
    let vehicleFactor = 1.0;
    switch (partner.vehicleType) {
      case 'scooter':
      case 'ebike':
        vehicleFactor = 1.25;
        break;
      case 'bicycle':
        vehicleFactor = 1.0;
        break;
      case 'walking':
        vehicleFactor = 0.7;
        break;
    }

    // 3. Reliability & Rating factors
    const acceptanceFactor = (partner.acceptanceRate || 100) / 100;
    const ratingFactor = (partner.averageRating || 5.0) / 5.0;

    // Composite Weighted Score
    const compositeScore =
      0.5 * distFactor +
      0.2 * vehicleFactor +
      0.15 * acceptanceFactor +
      0.15 * ratingFactor;

    return Number(compositeScore.toFixed(4));
  }

  /**
   * Dispatches an order to the optimal nearby delivery partner.
   * Includes atomic reservation locking to prevent concurrent double-assignments.
   */
  static async dispatchOrder(orderId: string): Promise<IDeliveryAssignment | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      logger.warn(`Dispatch aborted: Order [${order.orderNumber}] is in state ${order.status}`);
      return null;
    }

    const canteen = await Canteen.findById(order.canteenId);
    if (!canteen) {
      throw ApiError.notFound('Canteen not found for order');
    }

    const canteenCoords: [number, number] = canteen.location.coordinates;

    // 1. Collect past failed/rejected attempts for this order
    const previousAssignments = await DeliveryAssignment.find({
      orderId: order._id,
    });

    const attemptNumber = previousAssignments.length + 1;
    if (attemptNumber > MAX_DISPATCH_ATTEMPTS) {
      logger.error(
        `🚨 DISPATCH ESCALATION: Order [${order.orderNumber}] reached maximum dispatch attempts (${MAX_DISPATCH_ATTEMPTS}). Escalating to campus admin.`
      );
      return null;
    }

    const rejectedPartnerIds = previousAssignments.map((a) => a.partnerId);

    // 2. Geospatial Candidate Query: Find online partners within 3km of canteen
    // Must be free from active deliveries and free from active in-flight assignment locks
    const eligiblePartners = await User.find({
      role: UserRole.DELIVERY_PARTNER,
      isOnline: true,
      activeOrderId: null,
      _id: { $nin: rejectedPartnerIds },
      $or: [
        { activeAssignmentId: null },
        { reservedUntil: { $lt: new Date() } }, // Expired lock recovery
      ],
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: canteenCoords,
          },
          $maxDistance: 3000, // 3 km campus search radius
        },
      },
    }).limit(10);

    if (eligiblePartners.length === 0) {
      logger.warn(
        `⚠️ No eligible delivery partners nearby for Order [${order.orderNumber}]. Will retry on next heartbeat.`
      );
      return null;
    }

    // 3. Multi-Factor Scoring & Ranking
    const scoredCandidates: ICandidateScored[] = eligiblePartners.map((partner) => {
      const partnerCoords = partner.currentLocation?.coordinates || [0, 0];
      const distanceMeters = this.calculateDistanceMeters(canteenCoords, partnerCoords);
      const score = this.scoreCandidate(partner, distanceMeters);
      return { partner, distanceMeters, score };
    });

    // Sort descending by highest composite score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. Atomic Reservation Lock (Concurrency Control)
    // Try candidates in rank order until atomic lock succeeds
    let selectedAssignment: IDeliveryAssignment | null = null;

    for (const candidate of scoredCandidates) {
      const assignmentId = new Types.ObjectId();
      const expiresAt = new Date(Date.now() + ASSIGNMENT_TIMEOUT_SECONDS * 1000);

      // ATOMIC CAS: Acquire lock strictly if partner is STILL unassigned and free!
      const lockedPartner = await User.findOneAndUpdate(
        {
          _id: candidate.partner._id,
          isOnline: true,
          activeOrderId: null,
          $or: [
            { activeAssignmentId: null },
            { reservedUntil: { $lt: new Date() } },
          ],
        },
        {
          $set: {
            activeAssignmentId: assignmentId,
            reservedUntil: expiresAt,
          },
        },
        { new: true }
      );

      // If lockedPartner is null, another worker claimed this partner simultaneously!
      if (!lockedPartner) {
        logger.warn(
          `⚡ Race condition intercepted: Partner [${candidate.partner.name}] claimed by concurrent worker. Falling back to next candidate.`
        );
        continue;
      }

      // Lock successfully acquired! Create assignment record
      selectedAssignment = await DeliveryAssignment.create({
        _id: assignmentId,
        orderId: order._id,
        canteenId: canteen._id,
        partnerId: lockedPartner._id,
        attemptNumber,
        rejectedPartnerIds,
        canteenLocation: canteen.location,
        dropLocation: order.deliveryDrop.location,
        distanceToCanteenMeters: candidate.distanceMeters,
        status: DeliveryAssignmentStatus.OFFERED,
        offeredAt: new Date(),
        expiresAt,
      });

      logger.info(
        `📦 Dispatch Offer [Attempt #${attemptNumber}] sent to Partner [${lockedPartner.name}] (Distance: ${candidate.distanceMeters}m, Score: ${candidate.score}) for Order [${order.orderNumber}]. 30s timeout active.`
      );

      break;
    }

    return selectedAssignment;
  }

  /**
   * Delivery Partner Accepts Offer.
   */
  static async acceptAssignment(assignmentId: string, partnerId: string) {
    const assignment = await DeliveryAssignment.findOne({
      _id: assignmentId,
      partnerId: new Types.ObjectId(partnerId),
      status: DeliveryAssignmentStatus.OFFERED,
      expiresAt: { $gt: new Date() }, // Must accept before 30s expiration
    });

    if (!assignment) {
      throw ApiError.badRequest(
        'Assignment offer has expired, was cancelled, or is no longer available.',
        'OFFER_EXPIRED'
      );
    }

    // 1. Transition Assignment to ACCEPTED
    assignment.status = DeliveryAssignmentStatus.ACCEPTED;
    assignment.respondedAt = new Date();
    await assignment.save();

    // 2. Bind Delivery Partner to Order
    const order = await Order.findById(assignment.orderId);
    if (!order) {
      throw ApiError.notFound('Associated order not found');
    }

    order.deliveryPartnerId = assignment.partnerId;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      updatedBy: assignment.partnerId,
      notes: `Delivery accepted by partner [${partnerId}]`,
    });
    await order.save();

    // 3. Mark partner busy with this active order and release assignment lock
    await User.findByIdAndUpdate(partnerId, {
      activeOrderId: order._id,
      activeAssignmentId: null,
      reservedUntil: null,
    });

    logger.info(`✅ Partner [${partnerId}] ACCEPTED Order [${order.orderNumber}]`);

    return { assignment, order };
  }

  /**
   * Delivery Partner Rejects Offer.
   * Releases partner lock immediately and triggers automatic reassignment.
   */
  static async rejectAssignment(assignmentId: string, partnerId: string, reason?: string) {
    const assignment = await DeliveryAssignment.findOne({
      _id: assignmentId,
      partnerId: new Types.ObjectId(partnerId),
      status: DeliveryAssignmentStatus.OFFERED,
    });

    if (!assignment) {
      throw ApiError.badRequest('Assignment offer not found or already concluded');
    }

    // 1. Transition to REJECTED
    assignment.status = DeliveryAssignmentStatus.REJECTED;
    assignment.respondedAt = new Date();
    assignment.cancellationReason = reason || 'Partner rejected offer';
    await assignment.save();

    // 2. Release Partner reservation lock
    await User.findByIdAndUpdate(partnerId, {
      activeAssignmentId: null,
      reservedUntil: null,
      $inc: { acceptanceRate: -1 }, // Slight penalty on rejection
    });

    logger.warn(`❌ Partner [${partnerId}] REJECTED Order [${assignment.orderId}]. Triggering immediate reassignment...`);

    // 3. Automatically trigger reassignment to next optimal partner
    const nextAssignment = await this.dispatchOrder(assignment.orderId.toString());

    return { previousAssignment: assignment, nextAssignment };
  }

  /**
   * Background Sweep Worker: Handles 30-second assignment timeouts.
   * Auto-releases timed-out partners and triggers reassignment.
   */
  static async processTimeouts(): Promise<number> {
    const timedOutAssignments = await DeliveryAssignment.find({
      status: DeliveryAssignmentStatus.OFFERED,
      expiresAt: { $lte: new Date() },
    });

    let processedCount = 0;

    for (const assignment of timedOutAssignments) {
      // 1. Mark TIMED_OUT
      assignment.status = DeliveryAssignmentStatus.TIMED_OUT;
      assignment.respondedAt = new Date();
      assignment.cancellationReason = 'Timeout: Partner did not respond within 30 seconds';
      await assignment.save();

      // 2. Release Partner Lock
      await User.findByIdAndUpdate(assignment.partnerId, {
        activeAssignmentId: null,
        reservedUntil: null,
      });

      logger.warn(
        `⏰ Assignment [${assignment._id}] TIMED OUT for Partner [${assignment.partnerId}]. Auto-reassigning Order [${assignment.orderId}]...`
      );

      // 3. Auto-reassign
      await this.dispatchOrder(assignment.orderId.toString());
      processedCount++;
    }

    return processedCount;
  }

  /**
   * Partner picks up food from canteen.
   */
  static async pickupOrder(orderId: string, partnerId: string) {
    const order = await Order.findOne({
      _id: orderId,
      deliveryPartnerId: new Types.ObjectId(partnerId),
    });

    if (!order) {
      throw ApiError.notFound('Order not found or not assigned to you');
    }

    order.status = OrderStatus.OUT_FOR_DELIVERY;
    order.statusHistory.push({
      status: OrderStatus.OUT_FOR_DELIVERY,
      timestamp: new Date(),
      updatedBy: new Types.ObjectId(partnerId),
      notes: 'Picked up from canteen by delivery partner',
    });

    await order.save();
    logger.info(`🛵 Order [${order.orderNumber}] is OUT_FOR_DELIVERY by Partner [${partnerId}]`);

    return order;
  }

  /**
   * Partner completes delivery with Customer OTP handshake verification.
   */
  static async deliverOrder(orderId: string, partnerId: string, deliveryOtp: string) {
    const order = await Order.findOne({
      _id: orderId,
      deliveryPartnerId: new Types.ObjectId(partnerId),
    });

    if (!order) {
      throw ApiError.notFound('Order not found or not assigned to you');
    }

    // Verify 6-digit OTP given by the customer at drop-off
    if (order.deliveryOtp !== deliveryOtp.trim()) {
      throw ApiError.badRequest('Invalid delivery OTP verification code. Please confirm with customer.');
    }

    order.status = OrderStatus.DELIVERED;
    order.statusHistory.push({
      status: OrderStatus.DELIVERED,
      timestamp: new Date(),
      updatedBy: new Types.ObjectId(partnerId),
      notes: 'Delivered successfully with OTP verification',
    });

    await order.save();

    // Release Partner from active order
    await User.findByIdAndUpdate(partnerId, {
      activeOrderId: null,
      $inc: { totalDeliveries: 1 },
    });

    logger.info(`🎉 Order [${order.orderNumber}] DELIVERED by Partner [${partnerId}]`);

    return order;
  }

  /**
   * Toggle delivery partner online/offline status.
   */
  static async toggleOnlineStatus(partnerId: string, isOnline: boolean) {
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== UserRole.DELIVERY_PARTNER) {
      throw ApiError.forbidden('Only delivery partners can update online status');
    }

    if (!isOnline && partner.activeOrderId) {
      throw ApiError.badRequest('Cannot go offline while you have an active delivery in progress.');
    }

    partner.isOnline = isOnline;
    await partner.save();

    return partner;
  }

  /**
   * Update delivery partner GPS coordinates.
   */
  static async updateLocation(partnerId: string, coordinates: [number, number]) {
    const partner = await User.findByIdAndUpdate(
      partnerId,
      {
        currentLocation: {
          type: 'Point',
          coordinates,
        },
      },
      { new: true }
    );

    return partner;
  }
}
