import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    types: {
      streak: { type: Boolean, default: true },
      steps: { type: Boolean, default: true },
      goals: { type: Boolean, default: true },
      habits: { type: Boolean, default: false },
    },
    frequencyMinutes: { type: Number, default: 720, min: 15 },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '07:00' },
      timezone: { type: String, default: 'UTC' },
    },
    inactivityDays: { type: Number, default: 2, min: 0 },
    tone: { type: String, enum: ['friendly', 'direct', 'encouraging'], default: 'encouraging' },
    deviceTokens: [{ type: String, trim: true }],
    lastDeliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationPreferenceSchema.index({ userId: 1, enabled: 1 });

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema, 'NotificationPreferences');

export default NotificationPreference;
