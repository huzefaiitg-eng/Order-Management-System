const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file provided' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'oms-products', transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }] },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ success: true, data: { url: result.secure_url } });
  } catch (error) {
    console.error('Error uploading image:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
