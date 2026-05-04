import Users from '../models/Users.js';
import StepTracker from '../models/StepTracker.js';
import WeeklyGoal from '../models/WeeklyGoal.js';
import Habit from '../models/Habit.js';
import NotificationPreference from '../models/NotificationPreference.js';
import NotificationEvent from '../models/NotificationEvent.js';

const SWEEP_INTERVAL_MINUTES = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
  return { hour, minute };
}

function toMinutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return 0;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function isWithinQuietHours(now, quietHours = {}) {
  if (!quietHours.enabled) {
    return false;
  }

  const timezone = quietHours.timezone || 'UTC';
  const { hour, minute } = getTimeParts(now, timezone);
  const currentMinutes = (hour * 60) + minute;
  const start = toMinutes(quietHours.start || '22:00');
  const end = toMinutes(quietHours.end || '07:00');

  if (start === end) {
    return true;
  }

  if (start < end) {
    return currentMinutes >= start && currentMinutes < end;
  }

  return currentMinutes >= start || currentMinutes < end;
}

function daysSince(date, now = new Date()) {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((now.getTime() - new Date(date).getTime()) / DAY_IN_MS);
}

function buildTonePrefix(tone) {
  switch (tone) {
    case 'friendly':
      return 'Quick check-in:';
    case 'direct':
      return 'Reminder:';
    default:
      return 'Keep going:';
  }
}

function buildNotificationCandidates({ user, preference, stepTracker, weeklyGoal, habits, now }) {
  const candidates = [];
  const tonePrefix = buildTonePrefix(preference.tone);
  const inactivityDays = daysSince(user?.streak?.lastWorkoutDate || stepTracker?.lastActiveDate, now);
  const stepGoal = stepTracker?.dailyStepGoal || user?.goals?.stepGoal || 10000;
  const latestStepEntry = Array.isArray(stepTracker?.dailyHistory) && stepTracker.dailyHistory.length > 0
    ? stepTracker.dailyHistory[stepTracker.dailyHistory.length - 1]
    : null;
  const todaySteps = latestStepEntry?.steps || 0;
  const stepsGoalMet = todaySteps >= stepGoal;
  const activeWeeklyGoal = weeklyGoal?.status === 'active' ? weeklyGoal : null;
  const activeHabitCount = habits.length;

  if (preference.types.streak && inactivityDays >= Math.max(1, preference.inactivityDays || 2)) {
    candidates.push({
      type: 'streak',
      title: `${tonePrefix} get back to your streak`,
      body: inactivityDays === 1
        ? 'You missed a day. A short workout today keeps momentum alive.'
        : `It has been ${inactivityDays} days since your last workout. Start with a small session today.`,
      payload: { inactivityDays, currentStreak: user?.streak?.current || 0 },
    });
  }

  if (preference.types.steps && !stepsGoalMet) {
    const stepProgress = stepGoal > 0 ? Math.round((todaySteps / stepGoal) * 100) : 0;
    candidates.push({
      type: 'steps',
      title: `${tonePrefix} step goal is still open`,
      body: `You are at ${todaySteps.toLocaleString()} of ${stepGoal.toLocaleString()} steps (${stepProgress}%).`,
      payload: { steps: todaySteps, goal: stepGoal, percentage: stepProgress },
    });
  }

  if (preference.types.goals && activeWeeklyGoal) {
    candidates.push({
      type: 'goals',
      title: `${tonePrefix} weekly goal in progress`,
      body: `Your ${activeWeeklyGoal.weeklyWorkoutGoal}-workout goal is active. Stay consistent so you finish strong.`,
      payload: {
        weeklyGoalId: activeWeeklyGoal._id,
        weeklyWorkoutGoal: activeWeeklyGoal.weeklyWorkoutGoal,
        stake: activeWeeklyGoal.stake,
      },
    });
  }

  if (preference.types.habits && activeHabitCount > 0) {
    const goodHabits = habits.filter((habit) => habit.category === 'good').length;
    candidates.push({
      type: 'habits',
      title: `${tonePrefix} build a habit win`,
      body: `You have ${activeHabitCount} active habits and ${goodHabits} positive habits ready for today.`,
      payload: { totalHabits: activeHabitCount, goodHabits },
    });
  }

  return candidates;
}

export async function runNotificationSweep(io = null) {
  const now = new Date();
  const preferences = await NotificationPreference.find({ enabled: true }).lean();

  for (const preference of preferences) {
    if (isWithinQuietHours(now, preference.quietHours || {})) {
      continue;
    }

    if (preference.lastDeliveredAt) {
      const minutesSinceLastDelivery = (now.getTime() - new Date(preference.lastDeliveredAt).getTime()) / 60000;
      if (minutesSinceLastDelivery < Math.max(SWEEP_INTERVAL_MINUTES, preference.frequencyMinutes || 0)) {
        continue;
      }
    }

    const [user, stepTracker, weeklyGoal, habits] = await Promise.all([
      Users.findById(preference.userId).lean(),
      StepTracker.findOne({ userId: preference.userId }).lean(),
      WeeklyGoal.findOne({ participants: preference.userId }).sort({ startDate: -1 }).lean(),
      Habit.find({ userId: preference.userId, isActive: true }).lean(),
    ]);

    if (!user) {
      continue;
    }

    const candidates = buildNotificationCandidates({ user, preference, stepTracker, weeklyGoal, habits, now });
    if (candidates.length === 0) {
      continue;
    }

    const alreadyQueued = await NotificationEvent.find({
      userId: preference.userId,
      scheduledFor: {
        $gte: new Date(now.getTime() - (preference.frequencyMinutes || 0) * 60000),
      },
    }).lean();

    const recentTypes = new Set(alreadyQueued.map((entry) => entry.type));
    const candidate = candidates.find((entry) => !recentTypes.has(entry.type)) || candidates[0];

    const notification = await NotificationEvent.create({
      userId: preference.userId,
      preferenceId: preference._id,
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      payload: candidate.payload,
      source: 'sweep',
      scheduledFor: now,
      deliveredAt: now,
      status: 'delivered',
    });

    await NotificationPreference.updateOne(
      { _id: preference._id },
      { $set: { lastDeliveredAt: now } }
    );

    if (io) {
      io.to(`user:${preference.userId}`).emit('notification:new', notification);
    }
  }
}
