import mongoose from 'mongoose';

const StepTrackerSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    startingDate: { type: Date },
    allTimeSteps:        { type: Number, default: 0 },

    // --- Goals ---
    dailyStepGoal:   { type: Number, default: 10000 },
    weeklyStepGoal:  { type: Number, default: 70000 },

    // --- Streaks ---
    currentStreak:  { type: Number, default: 0 },  // consecutive days goal met
    longestStreak:  { type: Number, default: 0 },
    lastActiveDate: { type: Date },                 // to calculate streak continuity

    // --- Averages ---
    avgDailySteps:   { type: Number, default: 0 },
    avgWeeklySteps:  { type: Number, default: 0 },

    // --- Personal Bests ---
    bestDailySteps:  { type: Number, default: 0 },
    bestWeeklySteps: { type: Number, default: 0 },
    bestDailyDate:   { type: Date },

    // --- User Physical Info (for accurate calorie/distance calc) ---
    strideLength: { type: Number, default: 0.78 },  // in meters, avg adult
    weightKg:     { type: Number },

    // --- History ---
    dailyHistory: 
    [
        {
            date:         { type: Date, required: true },
            steps:        { type: Number, default: 0 },
            distance:     { type: Number, default: 0 },   // in meters
            caloriesBurned: { type: Number, default: 0 },
            activeMinutes:  { type: Number, default: 0 },
            goalMet:      { type: Boolean, default: false },
        }
    ],  // per-day breakdown

    // --- Goal Status ---
    weeklyGoalMet: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const StepTracker = mongoose.model('StepTracker', StepTrackerSchema, 'StepTracker');
export default StepTracker;