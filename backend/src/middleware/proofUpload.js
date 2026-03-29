import multer from 'multer';

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    console.log('Multer fileFilter - file:', file?.mimetype);
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image uploads are allowed for weekly goal proof'));
      return;
    }

    callback(null, true);
  },
});

// Add error handler for multer
proofUpload.errorHandler = (err, _req, res, next) => {
  console.error('Multer error:', err.message);
  res.status(400).json({ message: `File upload error: ${err.message}` });
};

export default proofUpload;
