import mongoose from 'mongoose';

const notificationEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    preferenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationPreference', default: null },
    type: {
      type: String,
      enum: ['streak', 'steps', 'goals', 'habits', 'general'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    payload: { type: Object, default: {} },
    source: { type: String, default: 'sweep' },
    scheduledFor: { type: Date, default: Date.now, index: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    status: { type: String, enum: ['queued', 'delivered', 'read'], default: 'queued', index: true },
  },
  { timestamps: true }
);

notificationEventSchema.index({ userId: 1, type: 1, scheduledFor: -1 });

const NotificationEvent = mongoose.model('NotificationEvent', notificationEventSchema, 'NotificationEvents');

export default NotificationEvent;
