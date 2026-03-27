import mongoose from 'mongoose';

const WorkoutModelSchema = new mongoose.Schema(
    {
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        category: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true, unique: true },
        workouts:
        [
            {
                exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
                sets: { type: Number, required: true, min: 1},
                reps: { type: Number, required: true, min: 1},
                rest: { type: Number, required: true, min: 1},
            }
        ],
    },
    {
        timestamps: true,
    }
);

const WorkoutModel = mongoose.model('WorkoutModel', WorkoutModelSchema, 'WorkoutModels');
export default WorkoutModel;