import mongoose from 'mongoose';

const ActiveWorkoutModelSessionSchema = new mongoose.Schema
(
    {
        userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        modelId:  { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutModel', required: true },
        startTime: { type: Date, default: Date.now },
        progress:
        [
            {
                exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
                sets: { type: Number, required: true },
                reps: { type: Number, required: true },
                rest: { type: Number, required: true },
                completed: { type: Boolean, default: false },
                timeTaken: { type: Number, default: null },
            }
        ]
    },
    {
        timestamps: true
    }
);

const ActiveWorkoutModelSession = mongoose.model('ActiveWorkoutModelSession', ActiveWorkoutModelSessionSchema, 'ActiveWorkoutModelSessions');
export default ActiveWorkoutModelSession;