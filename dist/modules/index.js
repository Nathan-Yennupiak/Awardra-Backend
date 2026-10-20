"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth/auth.routes"));
// No platformRoutes import needed
// import awardRoutes from './awards/awards.routes';
// import categoryRoutes from './categories/categories.routes';
// import candidateRoutes from './candidates/candidates.routes';
// import nominationRoutes from './nominations/nominations.routes';
// import paymentRoutes from './payments/payments.routes';
// import reportRoutes from './reports/reports.routes';
const public_routes_1 = __importDefault(require("./public/public.routes"));
const super_admin_routes_1 = __importDefault(require("./super-admin/super-admin.routes"));
const admin_routes_1 = __importDefault(require("./admin/admin.routes"));
const nominations_routes_1 = __importDefault(require("./nominations/nominations.routes"));
const payments_routes_1 = __importDefault(require("./payments/payments.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/super-admin', super_admin_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/nominations', nominations_routes_1.default);
router.use('/payments', payments_routes_1.default);
router.use('/', public_routes_1.default);
// router.use('/admin/awards', awardRoutes);
// etc
exports.default = router;
