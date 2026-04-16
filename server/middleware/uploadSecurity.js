const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadsDir } = require('../config');

// Extensions autorisées — whitelist stricte
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIMETYPES  = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Magic bytes pour vérifier le vrai type du fichier (indépendamment du mimetype déclaré)
const MAGIC_BYTES = {
  jpg:  [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47],
  gif:  [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
};

const verifyMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  const b = buffer;
  return (
    (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) || // JPEG
    (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) || // PNG
    (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) || // GIF
    (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46)    // WEBP (RIFF)
  );
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    // Forcer une extension saine indépendamment du nom d'origine
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Double vérification : extension ET mimetype
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('Extension non autorisée'), false);
  }
  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error('Type MIME non autorisé'), false);
  }
  cb(null, true);
};

// Multer pour uploads généraux (messages)
const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

// Multer pour avatars (limite plus basse)
const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

// Middleware de vérification magic bytes (après multer)
const verifyImageIntegrity = (req, res, next) => {
  if (!req.file) return next();
  const fs = require('fs');
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    if (!verifyMagicBytes(buf)) {
      fs.unlinkSync(req.file.path); // Supprimer le fichier malveillant
      return res.status(400).json({ error: 'Fichier invalide ou corrompu' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur vérification fichier' });
  }
};

module.exports = { uploadImage, uploadAvatar, verifyImageIntegrity };
