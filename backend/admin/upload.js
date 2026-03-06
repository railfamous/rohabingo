const express = require('express');
const multer = require('multer');
const { adminAuth } = require('./auth');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'admin-content');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure multer for local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    const folder = req.body?.folder || 'admin-uploads';
    const fileName = `${folder}_${timestamp}_${randomString}${extension}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and PDFs
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/webm',
      'application/pdf'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed.'), false);
    }
  }
});

// Upload file to local storage (Admin version)
router.post('/', adminAuth, upload.single('file'), async (req, res) => {
  try {
    const adminId = req.admin?.id || 'admin';

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;

    // Build public URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/uploads/admin-content/${file.filename}`;

    // Log the upload for tracking
    console.log(`File uploaded successfully by admin: ${file.filename} by admin ${adminId}`);

    res.json({
      message: 'File uploaded successfully',
      url: publicUrl,
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    });

  } catch (error) {
    console.error('Upload error:', error);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ message: 'File upload error: ' + error.message });
    }

    res.status(500).json({ message: 'Server error during file upload' });
  }
});

// Delete uploaded file (admin version)
router.delete('/:fileName', adminAuth, async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Prevent path traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return res.status(400).json({ message: 'Invalid file name' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    fs.unlinkSync(filePath);

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error during file deletion' });
  }
});

module.exports = router;