const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    resultSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
    },
  },
  { timestamps: true }
);

// Har bir user uchun eng oxirgi qidiruvlarni tez olish
searchHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
