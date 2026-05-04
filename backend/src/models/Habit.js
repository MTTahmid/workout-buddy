import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['good', 'bad'], required: true, index: true },
    source: { type: String, enum: ['predefined', 'custom'], default: 'custom' },
    goalType: { type: String, enum: ['do', 'avoid'], required: true },
    targetCount: { type: Number, default: 1, min: 0 },
    isActive: { type: Boolean, default: true },
    logs: [
      {
        loggedAt: { type: Date, default: Date.now },
        note: { type: String, default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

habitSchema.index({ userId: 1, category: 1, isActive: 1 });

const Habit = mongoose.model('Habit', habitSchema, 'habits');

export default Habit;