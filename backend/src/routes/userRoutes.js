import express from 'express';
import {
  getUsers,
  fetchPairingCode,
  buddyUp,
  getBuddyInfo,
  getWeeklyWorkoutRoutine,
  getUserHistory,
  getChallengePhotos,
  getCurrentStakes,
  getAllowedStakes,
  updateWeeklyGoal,
  createBuddyChallenge,
  submitWeeklyGoalProof,
  getWeeklyGoalProof,
  getWeeklyGoalDetails,
  CalorieLogger,
  GetCalorieHistory,
  WorkoutModelGetter,
  WorkoutModelCreator,
  WorkoutModelDeleter,
  WorkoutModelEditor,
  WorkoutModelSessionStarter,
  WorkoutModelSessionTracker,
  WorkoutModelSessionUpdater,
  WorkoutModelSessionEnder,
  FitnessGetter,
  FitnessSetter,
  FitnessUpdater,
} from '../controllers/userController.js';
import proofUpload from '../middleware/proofUpload.js';

const router = express.Router();


/**
 * router.put('/weekly challenges)
 * router.put('/evidence)
 */
router.get('/users', getUsers);
router.get('/weekly-goals/allowed-stakes', getAllowedStakes);
router.get('/:id/pairing-code', fetchPairingCode);
router.put('/:id/buddy/:pairingCode', buddyUp);
router.get('/:id/buddy', getBuddyInfo);
router.get('/:id/weekly-workout-routine', getWeeklyWorkoutRoutine);
router.get('/:id/history', getUserHistory);
router.get('/:id/challenge-photos', getChallengePhotos);
router.get('/:id/current-stakes', getCurrentStakes);
router.post('/:id/weekly-goals', updateWeeklyGoal); //just added
router.post('/:id/challenges', createBuddyChallenge);
router.post('/:id/weekly-goals/:weeklyGoalId/proof', proofUpload.single('proof'), submitWeeklyGoalProof); //just added
router.get('/:id/weekly-goals/:weeklyGoalId/proof/:proofId', getWeeklyGoalProof); //just added
router.get('/:id/weekly-goals/:weeklyGoalId/details', getWeeklyGoalDetails); //just added
router.post('/:id/calories/log', CalorieLogger);
router.get('/:id/calories/history', GetCalorieHistory);
router.get('/workout-models/get', WorkoutModelGetter);
router.get('/:id/workout-models/get', WorkoutModelGetter);
router.post('/:id/workout-models/create', WorkoutModelCreator);
router.post('/:id/workout-models/delete', WorkoutModelDeleter);
router.post('/:id/workout-models/edit', WorkoutModelEditor);
router.post('/:id/active-workout-model-session/start', WorkoutModelSessionStarter);
router.get('/:id/active-workout-model-session/tracker', WorkoutModelSessionTracker);
router.post('/:id/active-workout-model-session/update', WorkoutModelSessionUpdater);
router.delete('/:id/active-workout-model-session/end', WorkoutModelSessionEnder);
router.get('/:id/user-fitness/stats', FitnessGetter);
router.post('/:id/user-fitness/survey', FitnessSetter);
router.post('/:id/user-fitness/update', FitnessUpdater);
/*
bet has to connection to the points yet
*/


export default router;