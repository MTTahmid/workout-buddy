import mongoose from 'mongoose';

const UserFitnessSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

        cardioEndurance:        { type: Number, min: 1, max: 10, default: 0 },
        cardioRecovery:         { type: Number, min: 1, max: 10, default: 0 },
        cardioConsistency:      { type: Number, min: 1, max: 10, default: 0 },
        cardioLevel:            { type: Number, min: 0, max: 10, default: 0 },
        cardioGoal:             { type: Number, min: 0, max: 10, default: 0 },
        cardioGoalUserAdjusted: { type: Boolean, default: false },


        strengthUpperBody:        { type: Number, min: 1, max: 10, default: 0 },
        strengthLowerBody:        { type: Number, min: 1, max: 10, default: 0 },
        strengthCore:             { type: Number, min: 1, max: 10, default: 0 },
        strengthLevel:            { type: Number, min: 0, max: 10, default: 0 },
        strengthGoal:             { type: Number, min: 0, max: 10, default: 0 },
        strengthGoalUserAdjusted: { type: Boolean, default: false },


        flexibilityUpperBody:        { type: Number, min: 1, max: 10, default: 0 },
        flexibilityLowerBody:        { type: Number, min: 1, max: 10, default: 0 },
        flexibilitySpinalMobility:   { type: Number, min: 1, max: 10, default: 0 },
        flexibilityLevel:            { type: Number, min: 0, max: 10, default: 0 },
        flexibilityGoal:             { type: Number, min: 0, max: 10, default: 0 },
        flexibilityGoalUserAdjusted: { type: Boolean, default: false },
    
        
        cardioWeight:      { type: Number, default: 0.34 },
        strengthWeight:    { type: Number, default: 0.33 },
        flexibilityWeight: { type: Number, default: 0.33 },
        overallLevel:      { type: Number, min: 0, max: 10, default: 0 },
        targetFitness:     { type: Number, min: 0, max: 10, default: 0 },
        targetUserAdjusted:{ type: Boolean, default: false },


        cardioGRValue:         { type: Number, default: 0 },
        cardioGRLastUpdated:   { type: Date,   default: null },
        cardioGRSampleSize:    { type: Number, default: 0 },

        strengthGRValue:       { type: Number, default: 0 },
        strengthGRLastUpdated: { type: Date,   default: null },
        strengthGRSampleSize:  { type: Number, default: 0 },

        flexibilityGRValue:       { type: Number, default: 0 },
        flexibilityGRLastUpdated: { type: Date,   default: null },
        flexibilityGRSampleSize:  { type: Number, default: 0 },

        overallGRValue:       { type: Number, default: 0 },
        overallGRLastUpdated: { type: Date,   default: null },
        overallGRSampleSize:  { type: Number, default: 0 },


        projectedCompletionDate: { type: Date,    default: null },
        lastProjectionUpdate:    { type: Date,    default: null },


        assessmentHistory:
        {
            type:
            [
                {
                    takenAt:          { type: Date,   default: Date.now },
                    cardioLevel:      { type: Number },
                    strengthLevel:    { type: Number },
                    flexibilityLevel: { type: Number },
                    overallLevel:     { type: Number },
                }
            ],
            default: [],
        },

        onboardingComplete: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

const UserFitness = mongoose.model('UserFitness', UserFitnessSchema, 'UserFitness');
export default UserFitness;