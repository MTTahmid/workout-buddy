import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema({
  buddyPairId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuddyPair', default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  weeklyWorkoutGoal: { type: Number, required: true, min: 1 },
  stake: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'active' },
  // Daily streak tracking per participant
  dailyStreaks: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedDays: [{ type: String }], // ['2026-03-24', '2026-03-25', ...] - dates when proof was uploaded
  }],
  // Individual streak completion status for each participant
  streakStatus: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    streak: { type: Boolean, default: false }, // True if weeklyWorkoutGoal days are completed
  }],
  // Combined streak - True only if BOTH participants have streak = true
  combined_streak: { type: Boolean, default: false },
  // Proof uploads for weekly challenge
  proofs: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedDate: { type: Date, default: Date.now },
    uploadedDay: { type: String }, // Date string for matching with uploadedDays
    fileId: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'image' },
    size: { type: Number },
    bucket: { type: String, default: 'weekly_proofs' },
  }],
}, {
  timestamps: true,
});

const Challenge = mongoose.model('Challenge', challengeSchema, 'bets');

export default Challenge;