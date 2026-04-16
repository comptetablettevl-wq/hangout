const router = require('express').Router();
const auth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadImage, verifyImageIntegrity } = require('../middleware/uploadSecurity');

// POST /api/upload
router.post('/',
  auth,
  uploadLimiter,
  uploadImage.single('file'),
  verifyImageIntegrity,
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    const url = `/uploads/${req.file.filename}`;
    res.json({
      url,
      name:      req.file.originalname.slice(0, 255),
      mime_type: req.file.mimetype,
      size:      req.file.size,
    });
  }
);

module.exports = router;
