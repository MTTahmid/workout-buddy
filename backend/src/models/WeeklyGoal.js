import mongoose from 'mongoose';

const weeklyGoalSchema = new mongoose.Schema({
  buddyPairId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuddyPair', default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  weeklyWorkoutGoal: { type: Number, required: true, min: 1 },
  stake: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'active' },
  dailyStreaks: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedDays: [{ type: String }],
  }],
  streakStatus: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    streak: { type: Boolean, default: false },
  }],
  combined_streak: { type: Boolean, default: false },
  proofs: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedDate: { type: Date, default: Date.now },
    uploadedDay: { type: String },
    fileId: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'image' },
    size: { type: Number },
    bucket: { type: String, default: 'weekly_proofs' },
  }],
}, {
  timestamps: true,
});

const WeeklyGoal = mongoose.model('WeeklyGoal', weeklyGoalSchema, 'bets');

export default WeeklyGoal;
