import mongoose from 'mongoose';

const widgetConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    widgetsEnabled: [
      {
        type: {
          type: String,
          enum: ['streak', 'steps', 'calories', 'goals', 'habits'],
          required: true,
        },
        size: {
          type: String,
          enum: ['small', 'medium', 'large'],
          default: 'medium',
        },
        metrics: [String], // e.g., ['current', 'goal', 'percentage']
        enabled: { type: Boolean, default: true },
      },
    ],
    refreshInterval: {
      type: Number,
      default: 3600, // seconds (1 hour)
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
    },
  },
  { timestamps: true }
);

export default mongoose.model('WidgetConfig', widgetConfigSchema);
