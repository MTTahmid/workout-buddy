import mongoose from 'mongoose';

const buddyPairSchema = new mongoose.Schema({
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  allowedStakes: {
    type: [{ type: String, trim: true }],
    default: ['1 Dinner', '$10', '1 Chore', 'Romantic Favor 😉'],
  },
  memberScores: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    points: { type: Number, default: 0 },
    penalties: { type: Number, default: 0 },
    moneyEarned: { type: Number, default: 0 }, // in taka (100 points = 1 taka)
  }],
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'active' },
  combinedStreak: {
    current: { type: Number, default: 0 },
    lastWorkoutDate: { type: Date, default: null },
  },
  totalWorkoutsCompleted: { type: Number, default: 0 },
  monetaryEnabled: { type: Boolean, default: true }, // enable/disable money tracking
});

const BuddyPair = mongoose.model('BuddyPair', buddyPairSchema, 'buddyPair');

export default BuddyPair;