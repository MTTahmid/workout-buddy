import mongoose from 'mongoose';

const moderationActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['warn', 'restrict', 'suspend', 'ban', 'resolve', 'dismiss'],
      required: true,
    },
    note: { type: String, default: '' },
    previousStatus: { type: String, default: 'open' },
    nextStatus: { type: String, default: 'open' },
    durationDays: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const moderationReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetContentType: {
      type: String,
      enum: ['behavior', 'message', 'challenge', 'habit', 'workout', 'profile', 'other'],
      default: 'behavior',
    },
    targetContentId: { type: String, default: null },
    category: {
      type: String,
      enum: ['harassment', 'spam', 'hate', 'abuse', 'fraud', 'inappropriate', 'other'],
      default: 'other',
    },
    description: { type: String, required: true, trim: true },
    evidence: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    outcome: { type: String, default: null },
    actions: {
      type: [moderationActionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

moderationReportSchema.index({ targetUserId: 1, status: 1, createdAt: -1 });

const ModerationReport = mongoose.model('ModerationReport', moderationReportSchema, 'ModerationReports');

export default ModerationReport;
