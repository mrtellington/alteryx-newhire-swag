<<<<<<< HEAD
# Alteryx Swag Portal Clone (Private Order App)

A secure, single-product ordering portal for Alteryx employees, built with React, TypeScript, and Supabase.

## 🚀 Quick Start

1. **Clone and setup:**
   ```bash
   cd alteryx-swag-portal
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Run the database setup:**
   - Copy the contents of `database-setup.sql`
   - Run it in your Supabase SQL Editor

3. **Start development server:**
   ```bash
   npm start
   ```

4. **Visit:** `http://localhost:3000`

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://emnemfewmpjczkgwzrjv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA

# Email Configuration
VITE_FROM_EMAIL=admin@whitestonebranding.com

# Legacy support
REACT_APP_SUPABASE_URL=https://emnemfewmpjczkgwzrjv.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA
```

## 🏗️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, React Router
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Deployment:** Google Cloud Run, Firebase Hosting, Docker
- **Email:** Resend (via Supabase Edge Functions)

## 🔐 Authentication & Security

### Domain Restrictions
- Primary: `@alteryx.com` emails only
- Developer exceptions: `@whitestonebranding.com` emails
- Special case: `tod.ellington@gmail.com`

### Auth Flow
1. User enters email on login page
2. Domain validation occurs
3. Magic link sent via Supabase Auth
4. User clicks link and is authenticated
5. Profile fetched from `users` table
6. Access granted if `invited = true`

### Security Features
- Row Level Security (RLS) on all tables
- One-order-per-user enforcement
- Admin-only access to sensitive data
- Security event logging
- Domain validation at multiple levels

## 📊 Database Schema

### Tables

**users**
- `id` (UUID, Primary Key)
- `email` (TEXT, Unique)
- `invited` (BOOLEAN)
- `full_name` (TEXT)
- `shipping_address` (JSONB)
- `order_submitted` (BOOLEAN)
- `created_at` (TIMESTAMP)

**orders**
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `date_submitted` (TIMESTAMP)

**inventory**
- `product_id` (UUID, Primary Key)
- `sku` (TEXT, Unique)
- `name` (TEXT)
- `quantity_available` (INTEGER)

**security_events**
- `id` (UUID, Primary Key)
- `event_type` (TEXT)
- `user_id` (UUID, Foreign Key)
- `details` (JSONB)
- `created_at` (TIMESTAMP)

### Key Functions

- `create_user_from_webhook()` - Creates/updates users from Cognito Forms
- `place_order()` - Handles order placement with inventory management
- `log_security_event()` - Logs security events
- `is_system_admin()` - Checks if user is admin
- `is_current_user_admin()` - RLS helper for admin access

## 🔄 Cognito Forms Integration

### Webhook Setup
1. Configure Cognito Form with JSON webhook
2. Webhook URL: `https://your-domain.com/api/cognito-webhook`
3. Payload includes: email, full_name, address fields

### Webhook Handler
- Validates required fields
- Checks email domain
- Creates/updates user in database
- Sends welcome email
- Logs security event

## 👨‍💼 Admin Features

### Admin Access
- Hardcoded system admins in `is_system_admin()` function
- Admin emails: `admin@whitestonebranding.com`, `tod.ellington@whitestonebranding.com`, `dev@whitestonebranding.com`

### Admin Dashboard (`/admin`)
- View all users with status
- View all orders
- Export data to CSV
- Security event logs

## 🚀 Deployment

### Google Cloud Run
```bash
npm run deploy:gcp
```

### Firebase Hosting
```bash
npm run deploy:firebase
```

### Docker
```bash
npm run docker:build
npm run docker:run
```

## 🧪 Testing

### Acceptance Tests

**Auth Flow:**
- ✅ New pre-registered user receives magic link
- ✅ User lands on `/shop` and stays logged in
- ✅ Session persists through refresh and navigation
- ✅ Non-invited users are cleanly redirected
- ✅ Non-allowed domains are refused

**Order Flow:**
- ✅ First order succeeds (inventory decremented, order created)
- ✅ Second attempt prevented (frontend + backend)
- ✅ Confirmation email sent

**Admin Flow:**
- ✅ Admin can access `/admin`
- ✅ Admin can view users and orders
- ✅ Admin can export CSV data

## 🔧 Troubleshooting

### Common Issues

**"Verifying access..." stuck:**
- Check if user exists in `users` table
- Verify `invited = true`
- Check browser console for errors

**"Access denied":**
- User authenticated but not in `users` table
- User exists but `invited = false`

**Environment variables not loading:**
- Ensure `.env` file exists in project root
- Check variable names (VITE_ prefix for Vite)
- Restart development server

### Developer Setup

To add yourself as a developer user:

```sql
INSERT INTO users (
  id, 
  email, 
  full_name, 
  invited, 
  shipping_address, 
  created_at
) VALUES (
  '7c072e93-c879-49d2-9d0e-f7447b2d9ab8',
  'tod.ellington@whitestonebranding.com',
  'Tod Ellington',
  true,
  '{"address_line_1": "123 Developer Street", "city": "Test City", "state": "CA", "zip_code": "90210", "country": "USA"}',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  invited = true;
```

## 📝 Recent Fixes

### Auth Flow Improvements
- ✅ Fixed race conditions in session management
- ✅ Improved ProtectedRoute loading logic
- ✅ Added proper error handling and timeouts
- ✅ Enhanced RLS policies for auth flow
- ✅ Added security event logging

### Environment Configuration
- ✅ Updated to use VITE_ prefix for environment variables
- ✅ Added legacy REACT_APP_ support
- ✅ Improved Supabase client configuration

### Admin Features
- ✅ Added admin dashboard with user/order management
- ✅ Implemented CSV export functionality
- ✅ Added security event logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

Private project for Alteryx internal use.
=======
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/452af00b-2c87-4c45-be9d-37313a560147

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/452af00b-2c87-4c45-be9d-37313a560147) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/452af00b-2c87-4c45-be9d-37313a560147) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
>>>>>>> 7d324d8f57d227d6577278e13dfa5a1f23e5ffc9
