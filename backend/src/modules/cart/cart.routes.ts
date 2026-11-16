import { Router } from 'express';
import { CartController } from './cart.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { UserRole } from '../../constants/roles.js';
import { addToCartSchema } from './cart.validation.js';

const router = Router();

router.use(authenticate, requireRole(UserRole.CUSTOMER));

router.get('/', CartController.getCart);
router.post('/items', validate(addToCartSchema), CartController.addItem);
router.delete('/', CartController.clearCart);

export const cartRouter = router;
