// Helper script to create .env file from template
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'env.template');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, envPath);
    console.log('✅ .env file created from template!');
    console.log('📝 Please update DATABASE_URL and other variables in server/.env');
  } else {
    console.log('❌ env.template file not found!');
  }
} else {
  console.log('⚠️  .env file already exists!');
}

