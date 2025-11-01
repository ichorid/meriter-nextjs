import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  APP_URL: Joi.string().default('https://meriter.pro'),
  PORT: Joi.number().default(8002),

  // JWT
  JWT_SECRET: Joi.string().required(),

  // Bot
  BOT_USERNAME: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('meriterbot'),
  }),
  BOT_TOKEN: Joi.string().allow('').empty('').default(''),

  // Database
  MONGO_URL: Joi.string().default('mongodb://127.0.0.1:27017/meriter'),
  MONGO_URL_SECONDARY: Joi.string().default('mongodb://127.0.0.1:27017/meriter_test'),

  // Other environment variables that might exist
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});

