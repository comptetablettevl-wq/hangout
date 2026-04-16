const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map(d => d.message).join(', ');
    return res.status(400).json({ error: message });
  }
  next();
};

const schemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(2).max(32).required().messages({
      'string.alphanum': 'Le pseudo ne peut contenir que des lettres et chiffres',
      'string.min': 'Le pseudo doit faire au moins 2 caractères',
      'string.max': 'Le pseudo ne peut pas dépasser 32 caractères',
    }),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'Le mot de passe doit faire au moins 6 caractères',
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createGuild: Joi.object({
    name: Joi.string().min(2).max(64).required(),
  }),

  createChannel: Joi.object({
    name: Joi.string().min(1).max(32).required(),
    type: Joi.string().valid('text', 'voice').default('text'),
  }),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    reply_to: Joi.string().uuid().allow(null).optional(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('online', 'idle', 'dnd', 'offline').required(),
    custom_status: Joi.string().max(128).allow('').optional(),
  }),
};

module.exports = { validate, schemas };
