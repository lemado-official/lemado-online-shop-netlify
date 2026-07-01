const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sayt nomi majburiy'],
      trim: true,
      maxlength: 60,
    },
    url: {
      type: String,
      required: [true, 'URL majburiy'],
      trim: true,
      // faqat http/https ruxsat, javascript: kabi protokollarni bloklaydi (XSS himoyasi)
      match: [/^https:\/\/.+/i, 'URL https:// bilan boshlanishi shart'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'Umumiy',
      maxlength: 40,
    },
    icon: {
      type: String, // emoji yoki ikon-url
      default: '🌐',
      maxlength: 300,
    },
    color: {
      type: String, // kartochka uchun aksent rang (ixtiyoriy)
      default: '#ff6b35',
      match: [/^#([0-9A-Fa-f]{3}){1,2}$/, 'Rang HEX formatida bo\'lishi kerak'],
    },
    allowIframe: {
      type: Boolean,
      default: true, // ba'zi saytlar iframe'ni bloklaydi (X-Frame-Options), admin false qo'yishi mumkin
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

siteSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Site', siteSchema);
