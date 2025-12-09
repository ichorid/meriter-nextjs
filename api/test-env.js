require('dotenv').config();
console.log('DOMAIN:', process.env.DOMAIN);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
