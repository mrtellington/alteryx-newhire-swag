#!/bin/bash

echo "🚀 Setting up Alteryx Swag Portal..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Supabase Configuration
VITE_SUPABASE_URL=https://emnemfewmpjczkgwzrjv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA

# Email Configuration
VITE_FROM_EMAIL=admin@whitestonebranding.com

# Legacy support (for existing setups)
REACT_APP_SUPABASE_URL=https://emnemfewmpjczkgwzrjv.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA
EOF
    echo "✅ .env file created with Supabase configuration"
else
    echo "ℹ️  .env file already exists"
fi

echo "🎨 Setting up Tailwind CSS..."
npx tailwindcss init -p

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run the database setup SQL in your Supabase SQL Editor"
echo "2. Start the development server: npm start"
echo "3. Visit http://localhost:3000"
echo ""
echo "🔧 To add a developer user, run this SQL in Supabase:"
echo "INSERT INTO users (id, email, full_name, invited, shipping_address, created_at) VALUES ('7c072e93-c879-49d2-9d0e-f7447b2d9ab8', 'tod.ellington@whitestonebranding.com', 'Tod Ellington', true, '{\"address_line_1\": \"123 Developer Street\", \"city\": \"Test City\", \"state\": \"CA\", \"zip_code\": \"90210\", \"country\": \"USA\"}', NOW()) ON CONFLICT (id) DO UPDATE SET invited = true;"
