"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const super_admin_controller_1 = require("./super-admin.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.authorizeRole)('SUPER_ADMIN'));
router.get('/platforms', super_admin_controller_1.getPlatforms);
router.get('/transactions', super_admin_controller_1.getTransactions);
router.get('/reports/finances', super_admin_controller_1.getFinancialReports);
// Admin Account Management (Super Admin only)
router.get('/admins', super_admin_controller_1.getAdmins);
router.post('/admins', super_admin_controller_1.createAdmin);
router.put('/admins/:id', super_admin_controller_1.updateAdmin);
router.delete('/admins/:id', super_admin_controller_1.deleteAdmin);
router.put('/platforms/:id/settings', super_admin_controller_1.updatePlatformSettings);
exports.default = router;
