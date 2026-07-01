// Barcha xatoliklarni yagona formatga keltiradi, ichki tafsilotlarni foydalanuvchiga chiqarmaydi
module.exports = function errorHandler(err, req, res, next) {
  console.error('❌ Xatolik:', err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Serverda kutilmagan xatolik yuz berdi';

  // Mongoose validation xatosi
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Bu ${field} allaqachon mavjud`;
  }

  // Mongoose noto'g'ri ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Noto\'g\'ri identifikator';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // production'da stack trace chiqmaydi
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
