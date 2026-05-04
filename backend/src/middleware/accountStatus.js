import mongoose from 'mongoose';
import Users from '../models/Users.js';

export default async function accountStatusGuard(req, res, next) {
  try {
    const userId = req.params?.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return next();
    }

    const user = await Users.findById(userId).select('moderationStatus');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const moderationStatus = user.moderationStatus || {};
    const now = new Date();
    let statusChanged = false;

    if (moderationStatus.status === 'restricted' && moderationStatus.restrictedUntil && new Date(moderationStatus.restrictedUntil) <= now) {
      moderationStatus.status = 'active';
      moderationStatus.reason = null;
      moderationStatus.restrictedUntil = null;
      statusChanged = true;
    }

    if (moderationStatus.status === 'suspended' && moderationStatus.suspendedUntil && new Date(moderationStatus.suspendedUntil) <= now) {
      moderationStatus.status = 'active';
      moderationStatus.reason = null;
      moderationStatus.suspendedUntil = null;
      statusChanged = true;
    }

    if (statusChanged) {
      moderationStatus.updatedAt = now;
      user.moderationStatus = moderationStatus;
      await user.save();
    }

    if (moderationStatus.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    if (moderationStatus.status === 'restricted' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ message: 'Account restricted' });
    }

    return next();
  } catch (error) {
    console.error('accountStatusGuard error:', error);
    return res.status(500).json({ message: 'Failed to validate account status' });
  }
}
