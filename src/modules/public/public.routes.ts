import { Router } from 'express';
import { 
  getAwards, 
  getAwardBySlug,
  getAwardCategories,
  getAwardCandidates,
  getCandidateProfile,
  getNominationProgress,
  getAllCategories
} from './public.controller';

const router = Router();

router.get('/awards', getAwards);
router.get('/categories', getAllCategories);
router.get('/awards/:slug', getAwardBySlug);
router.get('/awards/:slug/categories', getAwardCategories);
router.get('/awards/:slug/candidates', getAwardCandidates);
router.get('/awards/:slug/candidates/:candidateSlug', getCandidateProfile);
router.get('/awards/:slug/candidates/:candidateSlug/progress', getNominationProgress);

// Note: Nominations, Payments, and Exchange Rates will be implemented in their own modules

export default router;
