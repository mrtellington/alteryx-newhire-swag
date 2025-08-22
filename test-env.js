// Test environment variables
// Run this with: node test-env.js

require('dotenv').config();

console.log('🔧 Environment Variables Test');
console.log('=============================');

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY'
];

console.log('\nChecking required variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log('\n📋 All environment variables:');
Object.keys(process.env)
  .filter(key => key.includes('SUPABASE') || key.includes('VITE_') || key.includes('REACT_APP_'))
  .forEach(key => {
    const value = process.env[key];
    console.log(`${key}: ${value ? value.substring(0, 50) + '...' : 'NOT SET'}`);
  });

console.log('\n�� Test complete!');
