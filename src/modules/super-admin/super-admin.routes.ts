import { Router } from 'express';
import { authenticate, authorizeRole } from '../../middleware/auth';
import { 
  getPlatforms, 
  getTransactions, 
  getFinancialReports, 
  getAdmins, 
  createAdmin, 
  updateAdmin, 
  deleteAdmin, 
  updatePlatformSettings 
} from './super-admin.controller';

const router = Router();

router.use(authenticate, authorizeRole('SUPER_ADMIN'));

router.get('/platforms', getPlatforms);
router.get('/transactions', getTransactions);
router.get('/reports/finances', getFinancialReports);

// Admin Account Management (Super Admin only)
router.get('/admins', getAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.delete('/admins/:id', deleteAdmin);

router.put('/platforms/:id/settings', updatePlatformSettings);

export default router;
