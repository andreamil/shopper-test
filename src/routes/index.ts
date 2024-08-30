import { Router } from 'express';
import { uploadMeasure, confirmMeasureValue, listCustomerMeasures } from '../controllers/measureController';

const router = Router();

router.post('/upload', uploadMeasure);
router.patch('/confirm', confirmMeasureValue);
router.get('/:customer_code/list', listCustomerMeasures);

export default router;