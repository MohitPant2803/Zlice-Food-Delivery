import { Router } from 'express';
import { TrackingController } from './tracking.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { ingestLocationSchema, getTrackingSchema } from './tracking.validation.js';

const router = Router();

router.use(authenticate);

// REST fallback for mobile GPS streams
router.post('/location', validate(ingestLocationSchema), TrackingController.updateLocation);

// Initial tracking view / poll fallback
router.get('/orders/:orderId', validate(getTrackingSchema), TrackingController.getOrderTracking);

export const trackingRouter = router;
