import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    buddyPairId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BuddyPair',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    attachment: {
      fileId: { type: String, default: null },
      filename: { type: String, default: null },
      contentType: { type: String, default: null },
      size: { type: Number, default: null },
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema, 'chatMessage');

export default ChatMessage;
