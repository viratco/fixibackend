import { Router } from 'express';
import * as servicesController from '../controllers/servicesController';

const router = Router();

router.get('/', servicesController.getServices);
router.get('/:id', servicesController.getServiceById);

export default router;
