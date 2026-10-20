import { Router } from 'express';
import authRoutes from './auth/auth.routes';
// No platformRoutes import needed
// import awardRoutes from './awards/awards.routes';
// import categoryRoutes from './categories/categories.routes';
// import candidateRoutes from './candidates/candidates.routes';
// import nominationRoutes from './nominations/nominations.routes';
// import paymentRoutes from './payments/payments.routes';
// import reportRoutes from './reports/reports.routes';

import publicRoutes from './public/public.routes';

import superAdminRoutes from './super-admin/super-admin.routes';
import adminRoutes from './admin/admin.routes';
import nominationRoutes from './nominations/nominations.routes';
import paymentRoutes from './payments/payments.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/admin', adminRoutes);
router.use('/nominations', nominationRoutes);
router.use('/payments', paymentRoutes);
router.use('/', publicRoutes);
// router.use('/admin/awards', awardRoutes);
// etc

export default router;
