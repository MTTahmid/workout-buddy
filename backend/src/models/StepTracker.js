import mongoose from 'mongoose';

const StepTrackerSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    startingDate: { type: Date },
    allTimeSteps:        { type: Number, default: 0 },

    dailyStepGoal:   { type: Number, default: 10000 },
    weeklyStepGoal:  { type: Number, default: 70000 },

    currentStreak:  { type: Number, default: 0 },
    longestStreak:  { type: Number, default: 0 },
    lastActiveDate: { type: Date },

    avgDailySteps:   { type: Number, default: 0 },
    avgWeeklySteps:  { type: Number, default: 0 },

    bestDailySteps:  { type: Number, default: 0 },
    bestWeeklySteps: { type: Number, default: 0 },
    bestDailyDate:   { type: Date },

    strideLength: { type: Number, default: 0.78 },
    weightKg:     { type: Number },

    dailyHistory: 
    [
        {
            date:         { type: Date, required: true },
            steps:        { type: Number, default: 0 },
            distance:     { type: Number, default: 0 },
            caloriesBurned: { type: Number, default: 0 },
            activeMinutes:  { type: Number, default: 0 },
            goalMet:      { type: Boolean, default: false },
        }
    ],

    weeklyGoalMet: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const StepTracker = mongoose.model('StepTracker', StepTrackerSchema, 'StepTracker');
export default StepTracker;