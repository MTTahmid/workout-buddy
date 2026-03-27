import mongoose from 'mongoose';

const workoutSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    met: {
      type: Number,
      required: true,
      min: 0,
    },
    muscleGroup: {
      type: String,
      required: true,
      enum: [
        'chest',
        'back',
        'shoulders',
        'biceps',
        'triceps',
        'forearms',
        'core',
        'glutes',
        'quadriceps',
        'hamstrings',
        'calves',
        'full body',
      ],
    },
    exerciseType: {
      type: String,
      required: true,
      enum: ['strength', 'cardio', 'flexibility', 'balance', 'plyometric', 'calisthenics'],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['beginner', 'intermediate', 'advanced'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Workout', workoutSchema);