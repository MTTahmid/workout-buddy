import mongoose from 'mongoose';

const CalorieIntakeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    foodName: { type: String, required: true, trim: true },
    productId: { type: String, default: null },
    grams: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    kcalPer100g: { type: Number, required: true, min: 0 },
    intakeCalories: { type: Number, required: true, min: 0 },
    source: { type: String, default: 'openfoodfacts' },
    date: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const CalorieIntake = mongoose.model('CalorieIntake', CalorieIntakeSchema, 'CalorieIntake');

export default CalorieIntake;
