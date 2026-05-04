import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  pairingCode: { type: String, unique: true, sparse: true },
  passwordHash: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true,
  },
  moderationStatus: {
    status: {
      type: String,
      enum: ['active', 'restricted', 'suspended'],
      default: 'active',
      index: true,
    },
    reason: { type: String, default: null },
    restrictedUntil: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  profile: {
    age: Number,
    weight: Number,
    height: Number,
    fitnessLevel: String,
    equipment: [String],
    dietaryPreferences: [String]
  },
  goals: {
    calorieGoal: Number,
    stepGoal: Number,
    targetWeight: Number
  },
  performanceTier: {
    currentTier: String,
    points: Number
  },
  streak: {
    current: { type: Number, default: 0 },
    lastWorkoutDate: { type: Date, default: null }
  },
  buddies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  habits: [{ name: String, completedDates: [Date] }],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema, 'user');

export default User;