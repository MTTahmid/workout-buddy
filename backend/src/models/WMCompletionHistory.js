import mongoose from 'mongoose';

const WMCompletionHistorySchema = new mongoose.Schema
(
    {
        userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
        modelId:   { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutModel', required: true },
        startTime: { type: Date, required: true },
        endTime:   { type: Date, required: true },
        totalTime: { type: Number, required: true },
        workouts:
        [
            {
                exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
                sets: { type: Number, required: true },
                reps: { type: Number, required: true },
                rest: { type: Number, required: true },
                timeTaken: { type: Number, required: true },
            }
        ]
    },
    {
        timestamps: true
    }
)

const WMCompletionHistory = mongoose.model('WMCompletionHistory', WMCompletionHistorySchema, 'WorkoutModelCompletionHistory')
export default WMCompletionHistory;