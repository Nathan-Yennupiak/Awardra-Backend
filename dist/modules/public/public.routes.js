"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const public_controller_1 = require("./public.controller");
const router = (0, express_1.Router)();
router.get('/awards', public_controller_1.getAwards);
router.get('/categories', public_controller_1.getAllCategories);
router.get('/awards/:slug', public_controller_1.getAwardBySlug);
router.get('/awards/:slug/categories', public_controller_1.getAwardCategories);
router.get('/awards/:slug/candidates', public_controller_1.getAwardCandidates);
router.get('/awards/:slug/candidates/:candidateSlug', public_controller_1.getCandidateProfile);
router.get('/awards/:slug/candidates/:candidateSlug/progress', public_controller_1.getNominationProgress);
// Note: Nominations, Payments, and Exchange Rates will be implemented in their own modules
exports.default = router;
