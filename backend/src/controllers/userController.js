import Users from '../models/Users.js';
import BuddyPair from '../models/BuddyPair.js';
import BuddyWorkout from '../models/BuddyWorkout.js';
import WeeklyGoal from '../models/WeeklyGoal.js';
import BuddyChallenge from '../models/BuddyChallenge.js';
import CalorieTracker from '../models/CalorieTracker.js';
import Workout from '../models/Workout.js';
import WorkoutModel from '../models/WorkoutModel.js';
import ActiveWorkoutModelSession from '../models/ActiveWorkoutModelSession.js';
import WMCompletionHistory from '../models/WMCompletionHistory.js';
import UserFitness from '../models/UserFitness.js';
import {
  getProofDownloadStream,
  uploadProofToGridFS,
  deleteProofFromGridFS,
} from '../config/gridfs.js';
import mongoose from 'mongoose';

const ALLOWED_STAKES = [
  '1 Dinner',
  '$10',
  '1 Chore',
  'Romantic Favor 😉',
];

const DEFAULT_WEEKLY_GOAL = 3;
const DEFAULT_WEEKLY_STAKE = '1 Dinner';

const ALLOWED_WORKOUTS = {
  pushup:  { met: 3.8 },
  pullup:  { met: 4.0 },
  running: { met: 7.0 },
  squats:  { met: 5.0 },
  bicycling: { met: 8.0 },
  walking: { met: 4.3 },
  swimming: { met: 10.0 },
  hiking: { met: 7.3},
  ropejumping: { met: 10.0 },
};

const PAIRING_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Convert points to taka (100 points = 1 taka, or 1000 points = 10 taka)
function pointsToTaka(points) {
  return points / 100;
}

function createRandomPairingCode() {
  let code = '';

  for (let index = 0; index < 5; index += 1) {
    const randomIndex = Math.floor(Math.random() * PAIRING_CODE_ALPHABET.length);
    code += PAIRING_CODE_ALPHABET[randomIndex];
  }

  return code;
}

async function generateUniquePairingCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createRandomPairingCode();
    const existingUser = await Users.exists({ pairingCode: code });

    if (!existingUser) {
      return code;
    }
  }

  throw new Error('Unable to generate unique pairing code');
}

function buildMemberScores(memberIds) {
  return memberIds.map((memberId) => ({
    userId: memberId,
    points: 0,
    penalties: 0,
    moneyEarned: 0,
  }));
}

function buildDefaultAllowedStakes() {
  return [...ALLOWED_STAKES];
}

function normalizeStakeLabel(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasStakeLabel(stakes, label) {
  const normalizedLabel = normalizeStakeLabel(label).toLowerCase();
  return stakes.some((entry) => normalizeStakeLabel(entry).toLowerCase() === normalizedLabel);
}

async function ensurePairAllowedStakes(buddyPair) {
  const hasValidAllowedStakes =
    Array.isArray(buddyPair.allowedStakes)
    && buddyPair.allowedStakes.some((entry) => normalizeStakeLabel(entry));

  if (!hasValidAllowedStakes) {
    buddyPair.allowedStakes = buildDefaultAllowedStakes();
    await buddyPair.save();
  }

  return buddyPair.allowedStakes
    .map((entry) => normalizeStakeLabel(entry))
    .filter(Boolean);
}

function buildWeeklyWindowStart(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildWeeklyWindowEnd(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 7);
  return end;
}

function padDayPart(value) {
  return String(value).padStart(2, '0');
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = padDayPart(date.getMonth() + 1);
  const day = padDayPart(date.getDate());
  return `${year}-${month}-${day}`;
}

function buildWeeklyDayStatuses(weeklyGoal, uploadedDays = [], now = new Date()) {
  const weekStart = buildWeeklyWindowStart(weeklyGoal.startDate || now);
  const today = buildWeeklyWindowStart(now);
  const uploadedDaySet = new Set(uploadedDays);

  const days = Array.from({ length: 7 }, (_, offset) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + offset);

    const dayKey = toDayKey(dayDate);
    let status = 'not_yet_open';

    if (uploadedDaySet.has(dayKey)) {
      status = 'done';
    } else if (dayDate.getTime() < today.getTime()) {
      status = 'false';
    } else if (dayDate.getTime() === today.getTime()) {
      status = 'can_be_done';
    }

    return {
      dayKey,
      dayName: dayDate.toLocaleDateString('en-US', { weekday: 'long' }),
      date: dayDate,
      status,
      isDone: status === 'done',
    };
  });

  const summary = {
    done: days.filter((entry) => entry.status === 'done').length,
    canBeDone: days.filter((entry) => entry.status === 'can_be_done').length,
    notYetOpen: days.filter((entry) => entry.status === 'not_yet_open').length,
    false: days.filter((entry) => entry.status === 'false').length,
  };

  return { days, summary };
}

function buildEmptyDailyStreaks(participants) {
  return participants.map((participantId) => ({
    userId: participantId,
    uploadedDays: [],
  }));
}

function buildEmptyStreakStatus(participants) {
  return participants.map((participantId) => ({
    userId: participantId,
    streak: false,
  }));
}

async function applyPersistentUserStreaks(weeklyGoal, weekEndDate) {
  const participants = Array.isArray(weeklyGoal.participants) ? weeklyGoal.participants : [];

  if (participants.length === 0) {
    return;
  }

  const users = await Users.find({ _id: { $in: participants } }).select('_id streak');
  const streakStatusByUserId = new Map(
    (weeklyGoal.streakStatus || []).map((entry) => [String(entry.userId), entry.streak === true])
  );

  for (const user of users) {
    const completedWeek = streakStatusByUserId.get(String(user._id)) === true;
    const currentValue = Number.isInteger(user.streak?.current) ? user.streak.current : 0;
    const nextValue = completedWeek ? currentValue + 1 : 0;

    user.streak = {
      ...(user.streak || {}),
      current: nextValue,
      lastWorkoutDate: completedWeek ? weekEndDate : user.streak?.lastWorkoutDate || null,
    };

    await user.save();
  }
}

async function ensureWeeklyGoalForPair(buddyPair) {
  let weeklyGoal = await WeeklyGoal.findOne({ buddyPairId: buddyPair._id });

  if (!weeklyGoal) {
    weeklyGoal = await WeeklyGoal.findOne({
      participants: { $all: buddyPair.members, $size: 2 },
    }).sort({ startDate: -1 });

    if (weeklyGoal) {
      weeklyGoal.buddyPairId = buddyPair._id;
      if (!Number.isInteger(weeklyGoal.weeklyWorkoutGoal) || weeklyGoal.weeklyWorkoutGoal < 1) {
        weeklyGoal.weeklyWorkoutGoal = DEFAULT_WEEKLY_GOAL;
      }
      if (!weeklyGoal.stake) {
        weeklyGoal.stake = DEFAULT_WEEKLY_STAKE;
      }
      if (!Array.isArray(weeklyGoal.dailyStreaks) || weeklyGoal.dailyStreaks.length === 0) {
        weeklyGoal.dailyStreaks = buildEmptyDailyStreaks(buddyPair.members);
      }
      if (!Array.isArray(weeklyGoal.streakStatus) || weeklyGoal.streakStatus.length === 0) {
        weeklyGoal.streakStatus = buildEmptyStreakStatus(buddyPair.members);
      }
      if (!Array.isArray(weeklyGoal.proofs)) {
        weeklyGoal.proofs = [];
      }
      await weeklyGoal.save();
    }
  }

  if (!weeklyGoal) {
    const startDate = buildWeeklyWindowStart();
    const endDate = buildWeeklyWindowEnd(startDate);

    weeklyGoal = await WeeklyGoal.create({
      buddyPairId: buddyPair._id,
      participants: buddyPair.members,
      weeklyWorkoutGoal: DEFAULT_WEEKLY_GOAL,
      stake: DEFAULT_WEEKLY_STAKE,
      startDate,
      endDate,
      status: 'active',
      dailyStreaks: buildEmptyDailyStreaks(buddyPair.members),
      streakStatus: buildEmptyStreakStatus(buddyPair.members),
      combined_streak: false,
      proofs: [],
    });
  }

  return weeklyGoal;
}

async function resetWeeklyGoalIfExpired(weeklyGoal, now = new Date()) {
  let updated = false;

  if (!(weeklyGoal.endDate instanceof Date) || Number.isNaN(weeklyGoal.endDate.getTime())) {
    const startDate = buildWeeklyWindowStart(now);
    weeklyGoal.startDate = startDate;
    weeklyGoal.endDate = buildWeeklyWindowEnd(startDate);
    weeklyGoal.dailyStreaks = buildEmptyDailyStreaks(weeklyGoal.participants);
    weeklyGoal.streakStatus = buildEmptyStreakStatus(weeklyGoal.participants);
    weeklyGoal.proofs = [];
    weeklyGoal.status = 'active';
    weeklyGoal.combined_streak = false;
    await weeklyGoal.save();
    return weeklyGoal;
  }

  while (now > weeklyGoal.endDate) {
    const previousWeekEndDate = weeklyGoal.endDate;
    const bothCompletedPreviousWeek =
      Array.isArray(weeklyGoal.streakStatus)
      && weeklyGoal.streakStatus.length === weeklyGoal.participants.length
      && weeklyGoal.streakStatus.every((entry) => entry.streak === true);

    await applyPersistentUserStreaks(weeklyGoal, previousWeekEndDate);

    // Keep combined streak true only if each completed the previous week.
    weeklyGoal.combined_streak = bothCompletedPreviousWeek;

    const nextStartDate = buildWeeklyWindowStart(weeklyGoal.endDate);
    weeklyGoal.startDate = nextStartDate;
    weeklyGoal.endDate = buildWeeklyWindowEnd(nextStartDate);
    weeklyGoal.dailyStreaks = buildEmptyDailyStreaks(weeklyGoal.participants);
    weeklyGoal.streakStatus = buildEmptyStreakStatus(weeklyGoal.participants);
    weeklyGoal.proofs = [];
    weeklyGoal.status = 'active';

    updated = true;
  }

  if (updated) {
    await weeklyGoal.save();
  }

  return weeklyGoal;
}

export async function getUsers(req, res) {
  try {
    const users = await Users.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
}


export async function fetchPairingCode(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.pairingCode = await generateUniquePairingCode();
    await user.save();

    return res.status(200).json({ pairingCode: user.pairingCode });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get pairing code' });
  }
}


export async function buddyUp(req, res) {
  try {
    const { id, pairingCode } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const normalizedCode = pairingCode?.trim().toUpperCase();

    if (!normalizedCode) {
      return res.status(400).json({ message: 'Pairing code is required' });
    }

    const [user, buddyUser] = await Promise.all([
      Users.findById(id),
      Users.findOne({ pairingCode: normalizedCode }),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!buddyUser) {
      return res.status(404).json({ message: 'Buddy not found for pairing code' });
    }

    if (String(user._id) === String(buddyUser._id)) {
      return res.status(400).json({ message: 'Cannot buddy up with yourself' });
    }

    await Users.updateOne(
      { _id: buddyUser._id },
      { $unset: { pairingCode: 1 } }
    );

    const existingPair = await BuddyPair.findOne({
      members: { $all: [user._id, buddyUser._id], $size: 2 },
    });

    if (existingPair) {
      if (!existingPair.memberScores || existingPair.memberScores.length === 0) {
        existingPair.memberScores = buildMemberScores(existingPair.members);
      }

      await ensurePairAllowedStakes(existingPair);
      await existingPair.save();

      await ensureWeeklyGoalForPair(existingPair);

      await BuddyWorkout.findOneAndUpdate(
        { buddyPairId: existingPair._id },
        {
          $setOnInsert: {
            workouts: [],
            weeklyHistory: [],
          },
        },
        { upsert: true, new: true }
      );

      return res.status(200).json(existingPair);
    }

    const buddyPair = await BuddyPair.create({
      members: [user._id, buddyUser._id],
      allowedStakes: buildDefaultAllowedStakes(),
      memberScores: buildMemberScores([user._id, buddyUser._id]),
      status: 'active',
      combinedStreak: {
        current: 0,
        lastWorkoutDate: null,
      },
      totalWorkoutsCompleted: 0,
    });

    await BuddyWorkout.create({
      buddyPairId: buddyPair._id,
      workouts: [],
      weeklyHistory: [],
    });

    await ensureWeeklyGoalForPair(buddyPair);

    return res.status(201).json(buddyPair);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to buddy up users' });
  }
}

export async function getBuddyInfo(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .select('_id members memberScores status createdAt');

    if (!buddyPair) {
      return res.status(404).json({ message: 'Active buddy pair not found' });
    }

    const buddyId = buddyPair.members.find(
      (memberId) => String(memberId) !== String(user._id)
    );

    if (!buddyId) {
      return res.status(404).json({ message: 'Buddy not found in pair' });
    }

    const buddy = await Users.findById(buddyId)
      .select('_id name profile goals performanceTier streak habits createdAt')
      .lean();

    if (!buddy) {
      return res.status(404).json({ message: 'Buddy user not found' });
    }

    const buddyScore = Array.isArray(buddyPair.memberScores)
      ? buddyPair.memberScores.find((entry) => String(entry.userId) === String(buddy._id))
      : null;

    const points = buddyScore?.points ?? 0;
    const moneyInTaka = pointsToTaka(points);

    return res.status(200).json({
      userId: id,
      buddyPair: {
        id: buddyPair._id,
        status: buddyPair.status,
        createdAt: buddyPair.createdAt,
        monetaryEnabled: buddyPair.monetaryEnabled,
      },
      buddy: {
        ...buddy,
        score: {
          points: points,
          penalties: buddyScore?.penalties ?? 0,
          money: {
            taka: moneyInTaka,
            formatted: `${moneyInTaka.toFixed(2)} টাকা`,
          },
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch buddy info' });
  }
}

export async function getBuddyMoneyInfo(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id name');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .select('_id members memberScores monetaryEnabled');

    if (!buddyPair) {
      return res.status(404).json({ message: 'Active buddy pair not found' });
    }

    // Get money info for both members
    const moneyInfo = buddyPair.members.map((memberId) => {
      const score = buddyPair.memberScores.find((entry) => String(entry.userId) === String(memberId));
      const points = score?.points ?? 0;
      const taka = pointsToTaka(points);

      return {
        userId: memberId,
        points: points,
        moneyEarned: {
          taka: taka,
          formatted: `${taka.toFixed(2)} টাকা`,
        },
      };
    });

    return res.status(200).json({
      buddyPairId: buddyPair._id,
      monetaryEnabled: buddyPair.monetaryEnabled,
      members: moneyInfo,
    });
  } catch (error) {
    console.error('getBuddyMoneyInfo error:', error);
    return res.status(500).json({ message: 'Failed to fetch buddy money info' });
  }
}

export async function toggleBuddyMonetary(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (!buddyPair) {
      return res.status(404).json({ message: 'Active buddy pair not found' });
    }

    buddyPair.monetaryEnabled = enabled;
    await buddyPair.save();

    return res.status(200).json({
      message: `Monetary tracking ${enabled ? 'enabled' : 'disabled'}`,
      buddyPairId: buddyPair._id,
      monetaryEnabled: buddyPair.monetaryEnabled,
    });
  } catch (error) {
    console.error('toggleBuddyMonetary error:', error);
    return res.status(500).json({ message: 'Failed to update buddy monetary setting' });
  }
}

export async function getWeeklyWorkoutRoutine(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPairs = await BuddyPair.find({
      members: user._id,
      status: 'active',
    }).select('_id members status createdAt');

    if (buddyPairs.length === 0) {
      return res.status(200).json({ userId: id, routine: [] });
    }

    const buddyPairIds = buddyPairs.map((pair) => pair._id);
    const workoutDocs = await BuddyWorkout.find({
      buddyPairId: { $in: buddyPairIds },
    }).select('buddyPairId workouts weeklyHistory');

    const workoutByPairId = new Map(
      workoutDocs.map((doc) => [String(doc.buddyPairId), doc])
    );

    const routine = buddyPairs.map((pair) => {
      const workoutDoc = workoutByPairId.get(String(pair._id));

      return {
        buddyPairId: pair._id,
        members: pair.members,
        status: pair.status,
        createdAt: pair.createdAt,
        workouts: workoutDoc?.workouts || [],
        weeklyHistory: workoutDoc?.weeklyHistory || [],
      };
    });

    return res.status(200).json({ userId: id, routine });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch weekly workout routine' });
  }
}

export async function getAllowedStakes(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(200).json({ allowedStakes: ALLOWED_STAKES });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    }).select('_id allowedStakes');

    if (!buddyPair) {
      return res.status(200).json({
        allowedStakes: ALLOWED_STAKES,
        source: 'default',
      });
    }

    const allowedStakes = await ensurePairAllowedStakes(buddyPair);

    return res.status(200).json({
      allowedStakes,
      source: 'pair',
      buddyPairId: buddyPair._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch allowed stakes' });
  }
}

export async function addWeeklyGoalStake(req, res) {
  try {
    const { id } = req.params;
    const { stake } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const normalizedStake = normalizeStakeLabel(stake);
    if (!normalizedStake) {
      return res.status(400).json({ message: 'Stake cannot be empty' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    }).select('_id members allowedStakes');

    if (!buddyPair) {
      return res.status(400).json({ message: 'User is not in an active buddy pair' });
    }

    const allowedStakes = await ensurePairAllowedStakes(buddyPair);

    if (hasStakeLabel(allowedStakes, normalizedStake)) {
      return res.status(200).json({
        message: 'Stake already exists in allowed stakes',
        added: false,
        allowedStakes,
        buddyPairId: buddyPair._id,
      });
    }

    buddyPair.allowedStakes.push(normalizedStake);
    await buddyPair.save();

    return res.status(201).json({
      message: 'Stake added to pair allowed stakes',
      added: true,
      allowedStakes: buddyPair.allowedStakes,
      buddyPairId: buddyPair._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add weekly goal stake' });
  }
}

export async function updateWeeklyGoal(req, res) {
  try {
    const { id } = req.params;
    const { buddyId, weeklyWorkoutGoal, stake, startDate, status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    }).select('_id members allowedStakes');

    if (!buddyPair) {
      return res.status(400).json({ message: 'User is not in an active buddy pair' });
    }

    if (buddyId && !buddyPair.members.some((memberId) => String(memberId) === String(buddyId))) {
      return res.status(400).json({ message: 'Provided buddyId is not in the active buddy pair' });
    }

    let parsedGoal = null;
    if (weeklyWorkoutGoal !== undefined) {
      parsedGoal = Number(weeklyWorkoutGoal);
      if (!Number.isInteger(parsedGoal) || parsedGoal < 1) {
        return res.status(400).json({ message: 'weeklyWorkoutGoal must be a positive integer' });
      }
    }

    let normalizedStake = null;
    if (stake !== undefined) {
      if (typeof stake !== 'string') {
        return res.status(400).json({ message: 'Stake must be a string' });
      }

      normalizedStake = stake.trim();
      if (!normalizedStake) {
        return res.status(400).json({ message: 'Stake cannot be empty' });
      }
    }

    let weeklyGoal = await ensureWeeklyGoalForPair(buddyPair);
    weeklyGoal = await resetWeeklyGoalIfExpired(weeklyGoal);
    const pairAllowedStakes = await ensurePairAllowedStakes(buddyPair);

    if (parsedGoal !== null) {
      weeklyGoal.weeklyWorkoutGoal = parsedGoal;
    }

    if (normalizedStake !== null) {
      if (!hasStakeLabel(pairAllowedStakes, normalizedStake)) {
        return res.status(400).json({
          message: 'Stake is not in your pair allowed stakes. Add it first.',
          allowedStakes: pairAllowedStakes,
        });
      }

      weeklyGoal.stake = normalizedStake;
    }

    if (startDate) {
      const normalizedStartDate = new Date(startDate);
      if (Number.isNaN(normalizedStartDate.getTime())) {
        return res.status(400).json({ message: 'Invalid startDate' });
      }

      const start = buildWeeklyWindowStart(normalizedStartDate);
      weeklyGoal.startDate = start;
      weeklyGoal.endDate = buildWeeklyWindowEnd(start);
    }

    if (status) {
      weeklyGoal.status = status;
    }

    await weeklyGoal.save();

    const isAllowedStake = hasStakeLabel(pairAllowedStakes, weeklyGoal.stake);

    return res.status(200).json({
      weeklyGoal,
      allowedStake: isAllowedStake,
      message: isAllowedStake
        ? 'Weekly goal updated'
        : 'Weekly goal updated with a stake outside defaults',
      allowedStakes: pairAllowedStakes,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update weekly goal' });
  }
}

export async function createBuddyChallenge(req, res) {
  try {
    const { id } = req.params;
    const { targetId, workoutType, points, deadline } = req.body;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: 'Invalid challenger id or target id' });
    }

    if (String(id) === String(targetId)) {
      return res.status(400).json({ message: 'Cannot challenge yourself' });
    }

    if (typeof workoutType !== 'string' || !workoutType.trim()) {
      return res.status(400).json({ message: 'workoutType is required' });
    }

    const parsedPoints = Number(points);
    if (!Number.isInteger(parsedPoints) || parsedPoints < 1) {
      return res.status(400).json({ message: 'points must be a positive integer' });
    }

    const parsedDeadline = deadline ? new Date(deadline) : null;
    if (!parsedDeadline || Number.isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ message: 'Valid deadline is required' });
    }

    const [challengerUser, targetUser] = await Promise.all([
      Users.findById(id).select('_id'),
      Users.findById(targetId).select('_id'),
    ]);

    if (!challengerUser || !targetUser) {
      return res.status(404).json({ message: 'Challenger or target user not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: { $all: [challengerUser._id, targetUser._id], $size: 2 },
      status: 'active',
    });

    if (!buddyPair) {
      return res.status(400).json({ message: 'Only active buddies can challenge each other' });
    }

    if (!buddyPair.memberScores || buddyPair.memberScores.length === 0) {
      buddyPair.memberScores = buildMemberScores(buddyPair.members);
      await buddyPair.save();
    }

    const challenge = await BuddyChallenge.create({
      buddyPairId: buddyPair._id,
      challenger: challengerUser._id,
      target: targetUser._id,
      workoutType: workoutType.trim(),
      points: parsedPoints,
      status: 'pending',
      createdAt: new Date(),
      deadline: parsedDeadline,
      proof: {
        fileId: null,
        filename: null,
        contentType: null,
        size: null,
        bucket: null,
        submittedAt: null,
        submittedBy: null,
        verifiedAt: null,
        verifiedBy: null,
        verificationNote: null,
      },
    });

    return res.status(201).json(challenge);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create challenge' });
  }
}

export async function getBuddyChallenges(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    await BuddyChallenge.updateMany(
      {
        $or: [{ challenger: user._id }, { target: user._id }],
        status: { $in: ['pending', 'submitted'] },
        deadline: { $lt: now },
      },
      {
        $set: {
          status: 'rejected',
          'proof.verifiedAt': now,
          'proof.verifiedBy': null,
          'proof.verificationNote': 'Auto-rejected: deadline passed',
        },
      }
    );

    const challenges = await BuddyChallenge.find({
      $or: [{ challenger: user._id }, { target: user._id }],
    })
      .sort({ createdAt: -1 })
      .select('challenger target workoutType points status deadline createdAt proof');

    return res.status(200).json({
      userId: id,
      count: challenges.length,
      challenges: challenges.map((challenge) => ({
        challengeId: challenge._id,
        workoutType: challenge.workoutType,
        points: challenge.points,
        status: challenge.status,
        deadline: challenge.deadline,
        createdAt: challenge.createdAt,
        submittedAt: challenge.proof?.submittedAt || null,
        hasProof: Boolean(challenge.proof?.fileId),
        challenger: challenge.challenger,
        target: challenge.target,
        proofUrl: challenge.proof?.fileId
          ? `/user/${id}/challenges/${challenge._id}/proof`
          : null,
      })),
    });
  } catch (error) {
    console.error('getBuddyChallenges error:', error);
    return res.status(500).json({ message: 'Failed to fetch challenges' });
  }
}

async function autoRejectExpiredChallenge(challenge, now = new Date()) {
  if (!challenge) {
    return challenge;
  }

  const isExpirableStatus = challenge.status === 'pending' || challenge.status === 'submitted';
  const hasDeadline = challenge.deadline instanceof Date && !Number.isNaN(challenge.deadline.getTime());

  if (isExpirableStatus && hasDeadline && now > challenge.deadline) {
    challenge.status = 'rejected';
    challenge.proof.verifiedAt = now;
    challenge.proof.verifiedBy = null;
    challenge.proof.verificationNote = 'Auto-rejected: deadline passed';
    await challenge.save();
  }

  return challenge;
}

export async function submitBuddyChallengeProof(req, res) {
  try {
    const { id, challengeId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ message: 'Invalid user id or challenge id' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Proof image is required' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const challenge = await BuddyChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    await autoRejectExpiredChallenge(challenge);

    if (String(challenge.target) !== String(user._id)) {
      return res.status(403).json({ message: 'Only challenged user can submit proof' });
    }

    if (challenge.status === 'rejected') {
      return res.status(400).json({ message: 'Challenge has expired and is rejected' });
    }

    if (challenge.status === 'approved') {
      return res.status(400).json({ message: 'Challenge already approved' });
    }

    const now = new Date();
    if (now > challenge.deadline) {
      await autoRejectExpiredChallenge(challenge, now);
      return res.status(400).json({ message: 'Challenge deadline has passed' });
    }

    const previousFileId = challenge.proof?.fileId;
    const uploadResult = await uploadProofToGridFS({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      metadata: {
        challengeId,
        userId: id,
        uploadedDate: now,
      },
    });

    challenge.proof = {
      fileId: uploadResult.fileId,
      filename: uploadResult.filename,
      contentType: uploadResult.contentType,
      size: uploadResult.size,
      bucket: uploadResult.bucket,
      submittedAt: now,
      submittedBy: user._id,
      verifiedAt: now,
      verifiedBy: null,
      verificationNote: 'Auto-approved on target submission',
    };

    const buddyPair = await BuddyPair.findById(challenge.buddyPairId)
      .select('_id members memberScores status');

    if (!buddyPair || buddyPair.status !== 'active') {
      return res.status(400).json({ message: 'Active buddy pair not found for challenge' });
    }

    if (!Array.isArray(buddyPair.memberScores) || buddyPair.memberScores.length === 0) {
      buddyPair.memberScores = buildMemberScores(buddyPair.members);
    }

    let targetScore = buddyPair.memberScores.find(
      (entry) => String(entry.userId) === String(challenge.target)
    );

    if (!targetScore) {
      buddyPair.memberScores.push({
        userId: challenge.target,
        points: 0,
        penalties: 0,
        moneyEarned: 0,
      });
      targetScore = buddyPair.memberScores[buddyPair.memberScores.length - 1];
    }

    targetScore.points += challenge.points;
    // Update money earned: 100 points = 1 taka
    targetScore.moneyEarned = pointsToTaka(targetScore.points);
    challenge.status = 'approved';

    await Promise.all([challenge.save(), buddyPair.save()]);

    if (previousFileId && previousFileId !== uploadResult.fileId) {
      await deleteProofFromGridFS(previousFileId).catch(() => null);
    }

    return res.status(200).json({
      message: 'Challenge proof submitted and auto-approved',
      challengeId: challenge._id,
      status: challenge.status,
      pointsAwarded: challenge.points,
      targetUserId: challenge.target,
      targetPoints: targetScore.points,
      submittedAt: challenge.proof.submittedAt,
      proofUrl: `/user/${id}/challenges/${challenge._id}/proof`,
    });
  } catch (error) {
    console.error('submitBuddyChallengeProof error:', error);
    return res.status(500).json({ message: 'Failed to submit challenge proof' });
  }
}

export async function getBuddyChallengeProof(req, res) {
  try {
    const { id, challengeId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ message: 'Invalid user id or challenge id' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const challenge = await BuddyChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    await autoRejectExpiredChallenge(challenge);

    const isParticipant =
      String(challenge.challenger) === String(user._id)
      || String(challenge.target) === String(user._id);

    if (!isParticipant) {
      return res.status(403).json({ message: 'User is not part of this challenge' });
    }

    if (!challenge.proof?.fileId) {
      return res.status(404).json({ message: 'No proof uploaded for this challenge' });
    }

    res.setHeader('Content-Type', challenge.proof.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${challenge.proof.filename || 'challenge-proof'}"`
    );

    const downloadStream = getProofDownloadStream(challenge.proof.fileId);
    downloadStream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Proof file not found' });
      } else {
        res.end();
      }
    });

    return downloadStream.pipe(res);
  } catch (error) {
    console.error('getBuddyChallengeProof error:', error);
    return res.status(500).json({ message: 'Failed to fetch challenge proof' });
  }
}

export async function getUserHistory(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id streak');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
    })
      .sort({ createdAt: -1 })
      .select('_id combinedStreak totalWorkoutsCompleted');

    if (!buddyPair) {
      return res.status(200).json({
        userId: id,
        streak: user.streak?.current || 0,
        totalWorkouts: 0,
        weeks: [],
      });
    }

    const buddyWorkout = await BuddyWorkout.findOne({
      buddyPairId: buddyPair._id,
    }).select('workouts weeklyHistory');

    const weeklyHistory = Array.isArray(buddyWorkout?.weeklyHistory)
      ? buddyWorkout.weeklyHistory
      : [];

    const weeks = weeklyHistory
      .map((entry) => ({
        weekStartDate: entry.date,
        workoutsCompleted: Array.isArray(entry.workouts) ? entry.workouts.length : 0,
      }))
      .sort((a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate));

    const fallbackTotalFromWorkoutDoc = Array.isArray(buddyWorkout?.workouts)
      ? buddyWorkout.workouts.length
      : 0;

    const totalWorkouts =
      Number.isInteger(buddyPair.totalWorkoutsCompleted) && buddyPair.totalWorkoutsCompleted >= 0
        ? buddyPair.totalWorkoutsCompleted
        : fallbackTotalFromWorkoutDoc;

    return res.status(200).json({
      userId: id,
      streak: user.streak?.current ?? buddyPair.combinedStreak?.current ?? 0,
      totalWorkouts,
      weeks,
    });
  } catch (error) {
    console.error('getUserHistory error:', error);
    return res.status(500).json({ message: 'Failed to fetch user history' });
  }
}

export async function getChallengePhotos(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    await BuddyChallenge.updateMany(
      {
        $or: [{ challenger: user._id }, { target: user._id }],
        status: { $in: ['pending', 'submitted'] },
        deadline: { $lt: now },
      },
      {
        $set: {
          status: 'rejected',
          'proof.verifiedAt': now,
          'proof.verifiedBy': null,
          'proof.verificationNote': 'Auto-rejected: deadline passed',
        },
      }
    );

    const challenges = await BuddyChallenge.find({
      $or: [{ challenger: user._id }, { target: user._id }],
      'proof.fileId': { $ne: null },
      'proof.submittedAt': { $ne: null },
    })
      .sort({ 'proof.submittedAt': -1 })
      .limit(limit)
      .select('challenger target workoutType status points deadline proof');

    const photos = challenges.map((challenge) => ({
      challengeId: challenge._id,
      submittedAt: challenge.proof.submittedAt,
      workoutType: challenge.workoutType,
      status: challenge.status,
      points: challenge.points,
      deadline: challenge.deadline,
      submittedBy: challenge.proof.submittedBy,
      file: {
        filename: challenge.proof.filename,
        contentType: challenge.proof.contentType,
        size: challenge.proof.size,
      },
      proofUrl: `/user/${id}/challenges/${challenge._id}/proof`,
      challenger: challenge.challenger,
      target: challenge.target,
    }));

    return res.status(200).json({
      userId: id,
      count: photos.length,
      photos,
    });
  } catch (error) {
    console.error('getChallengePhotos error:', error);
    return res.status(500).json({ message: 'Failed to fetch challenge photos' });
  }
}

export async function getCurrentStakes(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const buddyPair = await BuddyPair.findOne({
      members: user._id,
      status: 'active',
    }).select('_id memberScores members');

    if (!buddyPair) {
      return res.status(200).json({
        userId: id,
        hasCurrentStake: false,
        stake: null,
      });
    }

    let challenge = await ensureWeeklyGoalForPair(buddyPair);
    challenge = await resetWeeklyGoalIfExpired(challenge);

    const userScore = buddyPair?.memberScores?.find(
      (entry) => String(entry.userId) === String(user._id)
    );

    return res.status(200).json({
      userId: id,
      hasCurrentStake: true,
      stake: {
        weeklyGoalId: challenge._id,
        weeklyWorkoutGoal: challenge.weeklyWorkoutGoal,
        stake: challenge.stake,
        status: challenge.status,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      },
      score: {
        points: userScore?.points || 0,
        penalties: userScore?.penalties || 0,
      },
    });
  } catch (error) {
    console.error('getCurrentStakes error:', error);
    return res.status(500).json({ message: 'Failed to fetch current stakes' });
  }
}

// Helper function to calculate streak completion
async function updateWeeklyGoalStreaks(weeklyGoal) {
  try {
    const targetDays = Math.max(1, Number(weeklyGoal.weeklyWorkoutGoal) || 1);

    // Check each participant's streak
    for (const participant of weeklyGoal.participants) {
      const dailyStreak = weeklyGoal.dailyStreaks.find(
        (ds) => String(ds.userId) === String(participant)
      );

      if (dailyStreak) {
        // If weekly target days are met, mark streak as true
        const uniqueDays = new Set(dailyStreak.uploadedDays);
        const streakStatus = weeklyGoal.streakStatus.find(
          (ss) => String(ss.userId) === String(participant)
        );

        if (streakStatus) {
          streakStatus.streak = uniqueDays.size >= targetDays;
        }
      }
    }

    // Keep combined streak running during the week; flip true once both hit goal.
    const allStreaksTrue = weeklyGoal.streakStatus.every((ss) => ss.streak === true);
    if (allStreaksTrue && weeklyGoal.streakStatus.length === 2) {
      weeklyGoal.combined_streak = true;
    }

    await weeklyGoal.save();
    return weeklyGoal;
  } catch (error) {
    console.error('updateWeeklyGoalStreaks error:', error);
    throw error;
  }
}

// Submit weekly goal proof (image upload)
export async function submitWeeklyGoalProof(req, res) {
  try {
    const { id, weeklyGoalId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(weeklyGoalId)) {
      return res.status(400).json({ message: 'Invalid user id or weekly goal id' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Proof image file is required' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let weeklyGoal = await WeeklyGoal.findById(weeklyGoalId);
    if (!weeklyGoal) {
      return res.status(404).json({ message: 'Weekly goal not found' });
    }

    weeklyGoal = await resetWeeklyGoalIfExpired(weeklyGoal);

    // Check if user is a participant
    const isParticipant = weeklyGoal.participants.some((p) => String(p) === String(id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'User is not a participant in this weekly goal' });
    }

    // Check if challenge is still active
    const now = new Date();
    if (now > weeklyGoal.endDate) {
      return res.status(400).json({ message: 'Weekly goal deadline has passed' });
    }

    // Get today's date in local YYYY-MM-DD format
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayString = toDayKey(today);

    // Upload file to GridFS
    const uploadResult = await uploadProofToGridFS({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      metadata: {
        weeklyGoalId,
        userId: id,
        uploadedDate: now,
      },
    });

    // Add proof to weekly goal
    weeklyGoal.proofs.push({
      userId: id,
      uploadedDate: now,
      uploadedDay: todayString,
      fileId: uploadResult.fileId,
      filename: uploadResult.filename,
      contentType: uploadResult.contentType,
      size: uploadResult.size,
      bucket: uploadResult.bucket,
    });

    // Update daily streak for user
    const dailyStreak = weeklyGoal.dailyStreaks.find((ds) => String(ds.userId) === String(id));
    if (dailyStreak) {
      // Check if today's date is already in the list
      if (!dailyStreak.uploadedDays.includes(todayString)) {
        dailyStreak.uploadedDays.push(todayString);
      }
    }

    // Update streak status
    await updateWeeklyGoalStreaks(weeklyGoal);

    const weeklyGoalTarget = Math.max(1, Number(weeklyGoal.weeklyWorkoutGoal) || 1);
    const cappedDailyStreaks = weeklyGoal.dailyStreaks.map((entry) => {
      const uniqueDays = [...new Set(entry.uploadedDays || [])];
      const cappedCount = Math.min(uniqueDays.length, weeklyGoalTarget);
      const dayStatus = buildWeeklyDayStatuses(weeklyGoal, uniqueDays, now);

      return {
        userId: entry.userId,
        uploadedDays: uniqueDays.slice(0, weeklyGoalTarget),
        daysCompleted: cappedCount,
        goalDays: weeklyGoalTarget,
        dayStatus,
      };
    });

    return res.status(200).json({
      message: 'Weekly goal proof uploaded successfully',
      weeklyGoal: {
        _id: weeklyGoal._id,
        dailyStreaks: cappedDailyStreaks,
        streakStatus: weeklyGoal.streakStatus,
        combined_streak: weeklyGoal.combined_streak,
        proofCount: weeklyGoal.proofs.length,
      },
    });
  } catch (error) {
    console.error('submitWeeklyGoalProof error:', error);
    return res.status(500).json({ message: 'Failed to submit weekly goal proof' });
  }
}

export async function getWeeklyGoalProof(req, res) {
  try {
    const { id, weeklyGoalId, proofId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(weeklyGoalId)) {
      return res.status(400).json({ message: 'Invalid user id or weekly goal id' });
    }

    if (!mongoose.isValidObjectId(proofId)) {
      return res.status(400).json({ message: 'Invalid proof id' });
    }

    const user = await Users.findById(id).select('_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let weeklyGoal = await WeeklyGoal.findById(weeklyGoalId);
    if (!weeklyGoal) {
      return res.status(404).json({ message: 'Weekly goal not found' });
    }

    weeklyGoal = await resetWeeklyGoalIfExpired(weeklyGoal);

    const isParticipant = weeklyGoal.participants.some((participantId) => String(participantId) === String(id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'User is not a participant in this weekly goal' });
    }

    const proof = weeklyGoal.proofs.find((entry) => String(entry._id) === String(proofId));
    if (!proof || !proof.fileId) {
      return res.status(404).json({ message: 'Proof not found' });
    }

    res.setHeader('Content-Type', proof.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${proof.filename || 'weekly-goal-proof'}"`
    );

    const downloadStream = getProofDownloadStream(proof.fileId);
    downloadStream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Proof file not found' });
      } else {
        res.end();
      }
    });

    return downloadStream.pipe(res);
  } catch (error) {
    console.error('getWeeklyGoalProof error:', error);
    return res.status(500).json({ message: 'Failed to fetch weekly goal proof' });
  }
}

// Get weekly goal details with streak info
export async function getWeeklyGoalDetails(req, res) {
  try {
    const { id, weeklyGoalId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(weeklyGoalId)) {
      return res.status(400).json({ message: 'Invalid user id or weekly goal id' });
    }

    const user = await Users.findById(id).select('_id streak');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let weeklyGoal = await WeeklyGoal.findById(weeklyGoalId).populate('participants', '_id');
    if (!weeklyGoal) {
      return res.status(404).json({ message: 'Weekly goal not found' });
    }

    weeklyGoal = await resetWeeklyGoalIfExpired(weeklyGoal);

    const isParticipant = weeklyGoal.participants.some((p) => String(p?._id || p) === String(id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'User is not a participant in this weekly goal' });
    }

    // Get current user's streak info
    const userDailyStreak = weeklyGoal.dailyStreaks.find((ds) => String(ds.userId) === String(id));
    const userStreakStatus = weeklyGoal.streakStatus.find((ss) => String(ss.userId) === String(id));
    const userProofs = weeklyGoal.proofs.filter((p) => String(p.userId) === String(id));
    const weeklyGoalTarget = Math.max(1, Number(weeklyGoal.weeklyWorkoutGoal) || 1);
    const userUniqueDays = [...new Set(userDailyStreak?.uploadedDays || [])];
    const cappedUserDays = userUniqueDays.slice(0, weeklyGoalTarget);
    const now = new Date();
    const userDayStatus = buildWeeklyDayStatuses(weeklyGoal, userUniqueDays, now);
    const participantProgress = weeklyGoal.dailyStreaks.map((entry) => {
      const uniqueDays = [...new Set(entry.uploadedDays || [])];
      const daysCompleted = Math.min(uniqueDays.length, weeklyGoalTarget);
      const dayStatus = buildWeeklyDayStatuses(weeklyGoal, uniqueDays, now);

      return {
        userId: entry.userId,
        daysCompleted,
        goalDays: weeklyGoalTarget,
        dayStatus,
      };
    });

    return res.status(200).json({
      weeklyGoal: {
        _id: weeklyGoal._id,
        weeklyWorkoutGoal: weeklyGoal.weeklyWorkoutGoal,
        stake: weeklyGoal.stake,
        status: weeklyGoal.status,
        startDate: weeklyGoal.startDate,
        endDate: weeklyGoal.endDate,
        combined_streak: weeklyGoal.combined_streak,
      },
      userStreak: {
        uploadedDays: cappedUserDays,
        streak: userStreakStatus?.streak || false,
        persistentCurrent: user.streak?.current || 0,
        uploadCount: userProofs.length,
        daysCompleted: Math.min(userUniqueDays.length, weeklyGoalTarget),
        goalDays: weeklyGoalTarget,
        dayStatus: userDayStatus,
      },
      allStreakStatus: weeklyGoal.streakStatus,
      participantProgress,
    });
  } catch (error) {
    console.error('getWeeklyGoalDetails error:', error);
    return res.status(500).json({ message: 'Failed to fetch weekly goal details' });
  }
}

export async function CalorieLogger(req, res)
{
  try {
    const { id } = req.params;
    const { weight, goal, date, workout, duration } = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!weight || weight < 10)
    {
      return res.status(400).json({ message: 'invalid weight' });
    }

    if (!goal || goal < 1)
    {
      return res.status(400).json({ message: 'goal must be a positive number' });
    }

    if (typeof workout !== 'string' || !workout.trim()) {
      return res.status(400).json({ message: 'Workout must be a non-empty string' });
    }

    if (!duration || duration<=0)
    {
      return res.status(400).json({ message: 'duration must be a positive number' });
    }
    
    const normalizedWorkout = workout.trim().toLowerCase();

    const isAllowedWorkout = normalizedWorkout in ALLOWED_WORKOUTS;

    if (!isAllowedWorkout)
    {
      return res.status(400).json({ message: 'workout not allowed' });
    }
  
    const calories = calorieCalc(normalizedWorkout, duration, weight);
    const goalmet = calories >= goal;

    const entry = await CalorieTracker.create({
      userId: id,
      weight,
      goal,
      calories,
      workout: normalizedWorkout,
      duration,
      goalmet,
      date: date ? new Date(date) : new Date(),
    });

    return res.status(201).json(entry);

  }
  catch (error)
  {
    console.error('logCalories error:', error);
    return res.status(500).json({ message: 'Failed to log calories' });
  }
}
function calorieCalc(workout, duration, weight)
{
  const { met } = ALLOWED_WORKOUTS[workout];
  return Math.round(met*weight*(duration/60));
}
export async function GetCalorieHistory(req, res)
{
  try
  {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await Users.findById(id).select('_id');

    if (!user)
    {
      return res.status(404).json({ message: 'User not found' });
    }
    const filter = { userId: id };
    if (req.query.start || req.query.end)
    {
      filter.date = {};
      if (req.query.start)
        {
          filter.date.$gte = new Date(req.query.start);
        }
      if (req.query.end)
        {
          filter.date.$lte = new Date(req.query.end);
        }
    }

    const entries = await CalorieTracker.find(filter).sort({ date: -1 });

    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
    return res.status(200).json({
      userId: id,
      totalCalories,
      entries,
    });
  }
  catch (error)
  {
    console.error('CalorieTracker error:', error);
    return res.status(500).json({ message: 'Failed to fetch Calorie history' });
  }
}
export async function WorkoutGetter(req, res)
{
  try
  {
    const workouts = await Workout.find();
    if (!workouts.length)
    {
      return res.status(404).json({ message: 'No workouts found' });
    }

    return res.status(200).json(workouts);
  }
  catch (error)
  {
    console.error('WorkoutModelGetter error:', error);
    return res.status(500).json({ message: 'Failed to retrieve Workout Model' });
  }
}
export async function WorkoutModelGetter(req, res)
{
 try
 {
  const { id } = req.params;
  if (id)
  {
    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const models = await WorkoutModel.find({ userId: id }).populate('workouts.exercise', 'title -_id');

    if (!models.length)
    {
      return res.status(404).json({ message: 'No workout models found for this user' });
    }

    return res.status(200).json(models);
  }
  else
  {
    const models = await WorkoutModel.find().populate('workouts.exercise', 'title -_id');
    
    if (!models.length)
    {
      return res.status(404).json({ message: 'No workout models found' });
    }

    return res.status(200).json(models);
  }
 }
 catch (error)
 {
  console.error('WorkoutModelGetter error:', error);
  return res.status(500).json({ message: 'Failed to retrieve Workout Model' });
}
}
export async function WorkoutModelCreator(req, res)
{
  try
  {
    const { id } = req.params;
    const { category, title, workouts} = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (typeof category !== 'string' || !category.trim())
    {
      return res.status(400).json({ message: 'Category must be a non-empty string' });
    }

    if (typeof title !== 'string' || !title.trim())
    {
      return res.status(400).json({ message: 'Title must be a non-empty string' });
    }

    if (!Array.isArray(workouts) || workouts.length === 0)
    {
      return res.status(400).json({message: 'Workouts must be non-empty array'});
    }

    for (let i = 0; i < workouts.length; i++)
    {
      const entry = workouts[i];

      if (typeof entry != 'object' || entry === null)
      {
        return res.status(400).json({message: 'Entry must be an object'});
      }

      if (!mongoose.isValidObjectId(entry.exercise))
      {
        return res.status(400).json({message: 'Exercise must be a valid object'});
      }
      
      if (typeof entry.sets != 'number' || !Number.isInteger(entry.sets) || entry.sets < 1)
      {
        return res.status(400).json({message: 'Set must be a number >= 1'});
      }
      
      if (typeof entry.reps != 'number' || !Number.isInteger(entry.reps) || entry.reps < 1)
      {
        return res.status(400).json({message: 'Reps must be a number >= 1'});
      }
      
      if (typeof entry.rest != 'number' || !Number.isInteger(entry.rest) || entry.rest < 1)
      {
        return res.status(400).json({message: 'Rest must be a number >= 1'});
      }
    }
    const entry = await WorkoutModel.create({
      userId: id,
      category,
      title,
      workouts,
    });

    if (!entry)
    {
      return res.status(404).json({ message: 'Workout model not created' });
    }

    return res.status(201).json(entry);

  }
  catch (error)
  {
    console.error('WorkoutModelCreator error:', error);
    return res.status(500).json({ message: 'Failed to create Workout Model' });
  }
}
export async function WorkoutModelDeleter(req, res)
{
  try
  {
    const { id } = req.params;
    const { title } = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (typeof title !== 'string' || !title.trim())
    {
      return res.status(400).json({ message: 'Title must be a non-empty string' });
    }

    const deleted = await WorkoutModel.findOneAndDelete({userId: id, title});

    if (!deleted)
    {
      return res.status(404).json({ message: 'Workout model not found' });
    }

    return res.status(200).json({ message: 'Workout model deleted successfully' });
  }
  catch (error)
  {
    console.error('WorkoutModelDeleter error:', error);
    return res.status(500).json({ message: 'Failed to delete workout model' });
  }
}
export async function WorkoutModelEditor(req, res)
{
  try
  {
    const { id } = req.params;
    const { category, title, workouts} = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (typeof category !== 'string' || !category.trim())
    {
      return res.status(400).json({ message: 'Category must be a non-empty string' });
    }

    if (typeof title !== 'string' || !title.trim())
    {
      return res.status(400).json({ message: 'Title must be a non-empty string' });
    }

    if (!Array.isArray(workouts) || workouts.length === 0)
    {
      return res.status(400).json({message: 'Workouts must be non-empty array'});
    }

    for (let i = 0; i < workouts.length; i++)
    {
      const entry = workouts[i];

      if (typeof entry != 'object' || entry === null)
      {
        return res.status(400).json({message: 'Entry must be an object'});
      }

      if (!mongoose.isValidObjectId(entry.exercise))
      {
        return res.status(400).json({message: 'Exercise must be a valid object'});
      }
      
      if (typeof entry.sets != 'number' || !Number.isInteger(entry.sets) || entry.sets < 1)
      {
        return res.status(400).json({message: 'Set must be a number >= 1'});
      }
      
      if (typeof entry.reps != 'number' || !Number.isInteger(entry.reps) || entry.reps < 1)
      {
        return res.status(400).json({message: 'Reps must be a number >= 1'});
      }
      
      if (typeof entry.rest != 'number' || !Number.isInteger(entry.rest) || entry.rest < 1)
      {
        return res.status(400).json({message: 'Rest must be a number >= 1'});
      }
    }

    const edited = await WorkoutModel.findOneAndReplace(
      { userId: id, title },
      {
        userId: id,
        category,
        title,
        workouts,
      },
      { new: true} 
    );

    if (!edited)
    {
      return res.status(404).json({ message: 'Workout model not found' });
    }

    return res.status(200).json({ message: 'Workout model updated successfully' });
  }
  catch (error)
  {
    console.error('WorkoutModelEditor error:', error);
    return res.status(500).json({ message: 'Failed to edit workout model' });
  }
}
export async function WorkoutModelSessionStarter(req, res)
{
  try
  {
    const { id } = req.params;
    const { modelId } = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!mongoose.isValidObjectId(modelId))
    {
      return res.status(400).json({ message: 'Invalid model id' });
    }

    const existing = await ActiveWorkoutModelSession.findOne({ userId: id})
    if (existing)
    {
      return res.status(400).json({ message: 'User already has an active session' });
    }

    const model = await WorkoutModel.findOne({_id: modelId});
    if (!model)
    {
      return res.status(400).json({ message: 'Workout model not found' });
    }

    const session = await ActiveWorkoutModelSession.create(
      {
        userId: id,
        modelId,
        startTime: new Date(),
        progress: model.workouts.map(w => ({
        exercise: w.exercise,
        sets: w.sets,
        reps: w.reps,
        rest: w.rest,
        completed: false,
        timeTaken: null,
      }))
      }
    )
    return res.status(201).json(session);
  }
  catch (error)
  {
    console.error('WorkoutModelSessionStarter error:', error);
    return res.status(500).json({ message: 'Failed to start workout model session' });
  }
}
export async function WorkoutModelSessionTracker(req, res)
{
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const session = await ActiveWorkoutModelSession.findOne({ userId: id }).populate('modelId').populate('progress.exercise');

    if (!session)
    {
      return res.status(404).json({message: 'Session not found'});
    }

    const total = session.progress.length;
    const completed = session.progress.filter(p => p.completed).length;

    return res.status(200).json({session, summary: {completed, total, remaining: total-completed, percentageCompleted: Math.round((completed/total)*100)}});
  }
  catch (error)
  {
    console.error('WorkoutModelSessionTracker error:', error);
    return res.status(500).json({ message: 'Failed to get workout model session' });
  }
}
export async function WorkoutModelSessionUpdater(req, res)
{
  try
  {
    const { id } = req.params;
    const { exerciseId, timeTaken } = req.body;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (!mongoose.isValidObjectId(exerciseId))
    {
      return res.status(400).json({ message: 'Invalid exercise id' });
    }

    if (typeof timeTaken !== 'number' || !Number.isInteger(timeTaken) || timeTaken < 1) {
      return res.status(400).json({ message: 'timeTaken must be an integer >= 1' });
    }

    const session = await ActiveWorkoutModelSession.findOne({ userId: id });
    if (!session)
    {
      return res.status(404).json({message: 'Session not found'});
    }

    const update = session.progress.find(p => p.exercise.toString() === exerciseId);

    if (!update)
    {
      return res.status(404).json({message: 'exercise not found'});
    }

    if (update.completed)
    {
      return res.status(400).json({message: 'exercise already completed'});
    }

    update.completed = true;
    update.timeTaken = timeTaken;
    await session.save();

    return res.status(200).json({message: 'Exercise successfully completed'})
  }
  catch(error)
  {
    console.error('WorkoutModelSessionUpdater error', error);
    return res.status(500).json({ message: 'Failed to update workout model session' });
  }
}
export async function WorkoutModelSessionEnder(req, res)
{
  try
  {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const session = await ActiveWorkoutModelSession.findOne({ userId: id });
    if (!session)
    {
      return res.status(404).json({message: 'Session not found'});
    }

    const endTime = new Date();
    const totalTime = Math.round((endTime - session.startTime) / 1000);

    const completedWorkouts = session.progress.filter(p => p.completed);
    const allDone = completedWorkouts.length === session.progress.length;

    const record = await WMCompletionHistory.create(
      {
        userId: id,
        modelId: session.modelId,
        startTime: session.startTime,
        endTime,
        totalTime,
        workouts: completedWorkouts.map(p => 
        ({
          exercise: p.exercise,
          sets: p.sets,
          reps: p.reps,
          rest: p.rest,
          timeTaken: p.timeTaken,
        }))
      }
    )
    
    await ActiveWorkoutModelSession.findByIdAndDelete(session._id);

    return res.status(200).json({
      message: allDone ? 'Workout Model completed and saved to history' : 'Workout session ended early and saved to history',
      completed: allDone, exercisesCompleted: completedWorkouts.length,
      exercisesTotal: session.progress.length,
    });
  }
  catch (error)
  {
    console.error('WorkoutModelSessionEnder error', error);
    return res.status(500).json({ message: 'Failed to end workout model session' });
  }
}
export async function FitnessGetter(req, res)
{
  try
  {
    const { id } = req.params;
 
    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }
 
    const fitness = await UserFitness.findOne({ userId: id });
 
    if (!fitness)
    {
      return res.status(404).json({ message: 'No fitness records found for this user' });
    }
 
    return res.status(200).json(fitness);
  }
  catch(error)
  {
    console.error('Fitnessgetter error', error);
    return res.status(500).json({ message: 'Failed to get user fitness records' });
  }
}
 
export async function FitnessSetter(req, res)
{
  try
  {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }
 
    const existing = await UserFitness.findOne({ userId: id });
    if (existing)
    {
      return res.status(409).json({ message: 'Fitness record already exists for this user' });
    }
 
    const
    {
      cardioEndurance,
      cardioRecovery,
      cardioConsistency,
      cardioGoal,
      strengthUpperBody,
      strengthLowerBody,
      strengthCore,
      strengthGoal,
      flexibilityUpperBody,
      flexibilityLowerBody,
      flexibilitySpinalMobility,
      flexibilityGoal,
      targetFitness,
    } = req.body;
 
    const requiredFields =
    {
      cardioEndurance,
      cardioRecovery,
      cardioConsistency,
      strengthUpperBody,
      strengthLowerBody,
      strengthCore,
      flexibilityUpperBody,
      flexibilityLowerBody,
      flexibilitySpinalMobility,
    };
 
    const missingFields = Object.keys(requiredFields).filter(key => requiredFields[key] === undefined || requiredFields[key] === null);
 
    if (missingFields.length)
    {
      return res.status(400).json({ message: 'Missing required fields', fields: missingFields });
    }
 
    const outOfRangeFields = Object.keys(requiredFields).filter(key => !isValidScore(requiredFields[key]));
 
    if (outOfRangeFields.length)
    {
      return res.status(400).json({ message: 'Sub-scores must be numbers between 1 and 10', fields: outOfRangeFields });
    }
 
    const optionalGoals = { cardioGoal, strengthGoal, flexibilityGoal, targetFitness };
 
    const invalidGoals = Object.keys(optionalGoals).filter(key => optionalGoals[key] !== undefined && !isValidScore(optionalGoals[key]));
 
    if (invalidGoals.length)
    {
      return res.status(400).json({ message: 'Goals must be numbers between 1 and 10', fields: invalidGoals });
    }
 
    const cardioLevel      = calculateDefaultLevel(cardioEndurance, cardioRecovery, cardioConsistency);
    const strengthLevel    = calculateDefaultLevel(strengthUpperBody, strengthLowerBody, strengthCore);
    const flexibilityLevel = calculateDefaultLevel(flexibilityUpperBody, flexibilityLowerBody, flexibilitySpinalMobility);
    const overallLevel     = calculateDefaultLevel(cardioLevel, strengthLevel, flexibilityLevel);
 
    const finalCardioGoal      = cardioGoal      ?? generateDefaultGoal(cardioLevel);
    const finalStrengthGoal    = strengthGoal    ?? generateDefaultGoal(strengthLevel);
    const finalFlexibilityGoal = flexibilityGoal ?? generateDefaultGoal(flexibilityLevel);
    const finalTargetFitness   = targetFitness   ?? generateDefaultGoal(overallLevel);
 
    const projectedCompletionDate = new Date();
    projectedCompletionDate.setDate(projectedCompletionDate.getDate() + 14);
 
    const snapshot =
    {
      takenAt: new Date(),
      cardioLevel,
      strengthLevel,
      flexibilityLevel,
      overallLevel,
    };
 
    const fitness = await UserFitness.create(
      {
        userId: id,
        cardioEndurance,
        cardioRecovery,
        cardioConsistency,
        cardioLevel,
        cardioGoal: finalCardioGoal,
        cardioGoalUserAdjusted: !!cardioGoal,
 
        strengthUpperBody,
        strengthLowerBody,
        strengthCore,
        strengthLevel,
        strengthGoal: finalStrengthGoal,
        strengthGoalUserAdjusted: !!strengthGoal,
 
        flexibilityUpperBody,
        flexibilityLowerBody,
        flexibilitySpinalMobility,
        flexibilityLevel,
        flexibilityGoal: finalFlexibilityGoal,
        flexibilityGoalUserAdjusted: !!flexibilityGoal,
 
        overallLevel,
        targetFitness: finalTargetFitness,
        targetUserAdjusted: !!targetFitness,
 
        cardioGRLastUpdated:      new Date(),
        strengthGRLastUpdated:    new Date(),
        flexibilityGRLastUpdated: new Date(),
        overallGRLastUpdated:     new Date(),
 
        projectedCompletionDate,
        lastProjectionUpdate: new Date(),
 
        assessmentHistory: [snapshot],
 
        onboardingComplete: true,
      },
    );
 
    return res.status(201).json(fitness);
  }
  catch(error)
  {
    console.error('FitnessSetter error', error);
    return res.status(500).json({ message: 'Failed to set user fitness' });
  }
}
 
export async function FitnessUpdater(req, res)
{
  try
  {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
    {
      return res.status(400).json({ message: 'Invalid user id' });
    }
 
    const fitness = await UserFitness.findOne({ userId: id });
    if (!fitness)
    {
      return res.status(404).json({ message: 'Fitness record does not exist for this user' });
    }
 
    const
    {
      cardioEndurance,
      cardioRecovery,
      cardioConsistency,
      cardioGoal,
      strengthUpperBody,
      strengthLowerBody,
      strengthCore,
      strengthGoal,
      flexibilityUpperBody,
      flexibilityLowerBody,
      flexibilitySpinalMobility,
      flexibilityGoal,
      targetFitness,
      cardioWeight,
      strengthWeight,
      flexibilityWeight,
    } = req.body;
 
    const subScores =
    {
      cardioEndurance,
      cardioRecovery,
      cardioConsistency,
      strengthUpperBody,
      strengthLowerBody,
      strengthCore,
      flexibilityUpperBody,
      flexibilityLowerBody,
      flexibilitySpinalMobility,
    };
 
    const outOfRangeScores = Object.keys(subScores).filter(key => subScores[key] !== undefined && subScores[key] !== null && !isValidScore(subScores[key]));
 
    if (outOfRangeScores.length)
    {
      return res.status(400).json({ message: 'Sub-scores must be numbers between 1 and 10', fields: outOfRangeScores });
    }
 
    const goalToCurrentLevel =
    {
      cardioGoal:      fitness.cardioLevel,
      strengthGoal:    fitness.strengthLevel,
      flexibilityGoal: fitness.flexibilityLevel,
      targetFitness:   fitness.overallLevel,
    };
 
    const optionalGoals =
    {
      cardioGoal,
      strengthGoal,
      flexibilityGoal,
      targetFitness,
    };
 
    const invalidGoals = Object.keys(optionalGoals).filter(key =>
      optionalGoals[key] !== undefined &&
      optionalGoals[key] !== null &&
      (!isValidScore(optionalGoals[key]) || optionalGoals[key] <= goalToCurrentLevel[key])
    );
 
    if (invalidGoals.length)
    {
      return res.status(400).json({ message: 'Goals must be numbers between 1 and 10 and greater than current level', fields: invalidGoals });
    }
 
    const weights =
    {
      cardioWeight,
      strengthWeight,
      flexibilityWeight,
    };
 
    const weightSent = Object.keys(weights).filter(key => weights[key] !== undefined && weights[key] !== null);
    if (weightSent.length > 0)
    {
      if (cardioWeight === undefined || strengthWeight === undefined || flexibilityWeight === undefined)
      {
        return res.status(400).json({ message: 'All three weights must be provided together: cardioWeight, strengthWeight, flexibilityWeight' });
      }
 
      const outOfRangeWeights = Object.keys(weights).filter(key => typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 1);
 
      if (outOfRangeWeights.length)
      {
        return res.status(400).json({ message: 'Weights must be numbers between 0 and 1', fields: outOfRangeWeights });
      }
 
      const weightsSum = cardioWeight + strengthWeight + flexibilityWeight;
      if (Math.round(weightsSum * 100) / 100 !== 1)
      {
        return res.status(400).json({ message: 'Weights must add up to 1' });
      }
    }
 
    const newCardioEndurance           = cardioEndurance           ?? fitness.cardioEndurance;
    const newCardioRecovery            = cardioRecovery            ?? fitness.cardioRecovery;
    const newCardioConsistency         = cardioConsistency         ?? fitness.cardioConsistency;
    const newStrengthUpperBody         = strengthUpperBody         ?? fitness.strengthUpperBody;
    const newStrengthLowerBody         = strengthLowerBody         ?? fitness.strengthLowerBody;
    const newStrengthCore              = strengthCore              ?? fitness.strengthCore;
    const newFlexibilityUpperBody      = flexibilityUpperBody      ?? fitness.flexibilityUpperBody;
    const newFlexibilityLowerBody      = flexibilityLowerBody      ?? fitness.flexibilityLowerBody;
    const newFlexibilitySpinalMobility = flexibilitySpinalMobility ?? fitness.flexibilitySpinalMobility;
 
    const newCardioWeight      = cardioWeight      ?? fitness.cardioWeight;
    const newStrengthWeight    = strengthWeight    ?? fitness.strengthWeight;
    const newFlexibilityWeight = flexibilityWeight ?? fitness.flexibilityWeight;
 
    const newCardioLevel      = calculateDefaultLevel(newCardioEndurance, newCardioRecovery, newCardioConsistency);
    const newStrengthLevel    = calculateDefaultLevel(newStrengthUpperBody, newStrengthLowerBody, newStrengthCore);
    const newFlexibilityLevel = calculateDefaultLevel(newFlexibilityUpperBody, newFlexibilityLowerBody, newFlexibilitySpinalMobility);
    const newOverallLevel     = calculateLevel(newCardioLevel, newCardioWeight, newStrengthLevel, newStrengthWeight, newFlexibilityLevel, newFlexibilityWeight);
 
    const newCardioGR      = GRCalc(fitness.cardioLevel,      newCardioLevel,      fitness.cardioGRSampleSize,      fitness.cardioGRValue,      fitness.updatedAt);
    const newStrengthGR    = GRCalc(fitness.strengthLevel,    newStrengthLevel,    fitness.strengthGRSampleSize,    fitness.strengthGRValue,    fitness.updatedAt);
    const newFlexibilityGR = GRCalc(fitness.flexibilityLevel, newFlexibilityLevel, fitness.flexibilityGRSampleSize, fitness.flexibilityGRValue, fitness.updatedAt);
    const newOverallGR     = GRCalc(fitness.overallLevel,     newOverallLevel,     fitness.overallGRSampleSize,     fitness.overallGRValue,     fitness.updatedAt);
 
    const newCardioGoal      = cardioGoal      ?? generateGoal(newCardioLevel,   newCardioGR.value);
    const newStrengthGoal    = strengthGoal    ?? generateGoal(newStrengthLevel,  newStrengthGR.value);
    const newFlexibilityGoal = flexibilityGoal ?? generateGoal(newFlexibilityLevel, newFlexibilityGR.value);
    const newTargetFitness   = targetFitness   ?? generateGoal(newOverallLevel,  newOverallGR.value);
 
    const projectedCompletionDate = newCD(newOverallLevel, newTargetFitness, newOverallGR.value);
 
    const snapshot =
    {
      takenAt: new Date(),
      cardioLevel:      newCardioLevel,
      strengthLevel:    newStrengthLevel,
      flexibilityLevel: newFlexibilityLevel,
      overallLevel:     newOverallLevel,
    };
 
    const updatedFitness = await UserFitness.findOneAndUpdate(
      { userId: id },
      {
        $set:
        {
          cardioEndurance: newCardioEndurance,
          cardioRecovery: newCardioRecovery,
          cardioConsistency: newCardioConsistency,
          cardioLevel: newCardioLevel,
          cardioGoal: newCardioGoal,
          cardioGoalUserAdjusted: !!cardioGoal,
 
          strengthUpperBody: newStrengthUpperBody,
          strengthLowerBody: newStrengthLowerBody,
          strengthCore: newStrengthCore,
          strengthLevel: newStrengthLevel,
          strengthGoal: newStrengthGoal,
          strengthGoalUserAdjusted: !!strengthGoal,
 
          flexibilityUpperBody: newFlexibilityUpperBody,
          flexibilityLowerBody: newFlexibilityLowerBody,
          flexibilitySpinalMobility: newFlexibilitySpinalMobility,
          flexibilityLevel: newFlexibilityLevel,
          flexibilityGoal: newFlexibilityGoal,
          flexibilityGoalUserAdjusted: !!flexibilityGoal,
 
          cardioWeight: newCardioWeight,
          strengthWeight: newStrengthWeight,
          flexibilityWeight: newFlexibilityWeight,
 
          overallLevel: newOverallLevel,
          targetFitness: newTargetFitness,
          targetUserAdjusted: !!targetFitness,
 
          cardioGRValue:      newCardioGR.value,
          strengthGRValue:    newStrengthGR.value,
          flexibilityGRValue: newFlexibilityGR.value,
          overallGRValue:     newOverallGR.value,
 
          cardioGRSampleSize:      newCardioGR.sampleSize,
          strengthGRSampleSize:    newStrengthGR.sampleSize,
          flexibilityGRSampleSize: newFlexibilityGR.sampleSize,
          overallGRSampleSize:     newOverallGR.sampleSize,
 
          cardioGRLastUpdated:      new Date(),
          strengthGRLastUpdated:    new Date(),
          flexibilityGRLastUpdated: new Date(),
          overallGRLastUpdated:     new Date(),
 
          projectedCompletionDate,
          lastProjectionUpdate: new Date(),
 
          onboardingComplete: true,
        },
        $push: { assessmentHistory: snapshot },
      },
      { new: true },
    );
 
    return res.status(200).json(updatedFitness);
  }
  catch(error)
  {
    console.error('FitnessUpdater error', error);
    return res.status(500).json({ message: 'Failed to update user fitness' });
  }
}
export function isValidScore(val)
{
  if (typeof val === 'number' && val >= 1 && val <= 10)
  {
    return true;
  }
  else
  {
    return false;
  }
}
export function calculateDefaultLevel(x, y, z)
{
  return Math.round((x+y+z)/3);
}
export function calculateLevel(x, xw, y, yw, z, zw)
{
  return Math.round((x * xw + y * yw + z * zw) / (xw + yw + zw));
}
export function generateDefaultGoal(x)
{
  const goal = x+1;
  if (goal <= 10)
  {
    return goal;
  }
  else
  {
    return 10;
  }
}
export function generateGoal(x, y)
{
  let goal = Math.round(x + y);
  if (goal === x)
  {
    goal += 1;
  }
  if (goal <= 10)
  {
    return goal;
  }
  else
  {
    return 10;
  }
}
export function GRCalc(prevLevel, newLevel, prevSampleSize, prevAverageRate, lastUpdated)
{
  if (!lastUpdated)
  {
    return { value: 0, sampleSize: 1 };
  }

  const msPerWeek      = 1000 * 60 * 60 * 24 * 7;
  const weeksSinceLast = (Date.now() - new Date(lastUpdated).getTime()) / msPerWeek;

  if (weeksSinceLast === 0)
  {
    return { value: prevAverageRate, sampleSize: prevSampleSize };
  }

  const currentRate   = (newLevel - prevLevel) / weeksSinceLast;
  const newSampleSize = prevSampleSize + 1;
  const averagedRate  = parseFloat(((prevAverageRate * prevSampleSize + currentRate) / newSampleSize).toFixed(4));

  return { value: averagedRate, sampleSize: newSampleSize };
}
export function newCD(currentLevel, targetLevel, growthRatePerWeek)
{
  if (growthRatePerWeek <= 0 || currentLevel >= targetLevel)
  {
    return null;
  }

  const weeksNeeded   = (targetLevel - currentLevel) / growthRatePerWeek;
  const msNeeded      = weeksNeeded * 7 * 24 * 60 * 60 * 1000;
  const projectedDate = new Date(Date.now() + msNeeded);

  return projectedDate;
}