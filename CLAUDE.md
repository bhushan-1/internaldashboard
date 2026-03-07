# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Datahub is an admin dashboard application for managing users, billing, permissions, and activity logs. Built with Vite, React, TypeScript, Supabase, and shadcn/ui components.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Build for development environment
npm run build:dev

# Preview production build
npm run preview

# Lint code
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

### Authentication & Authorization

The app uses a **three-layer authorization system**:

1. **Authentication** - Supabase Auth manages user sessions
2. **Role-based access** - Users have either "admin" or "user" role (stored in `user_roles` table)
3. **Component-level permissions** - Fine-grained access control per feature (stored in `user_permissions` table)

**Auth Flow:**
- `AuthProvider` (src/hooks/useAuth.tsx) wraps the entire app and provides auth context
- On auth state change, user role is fetched from `user_roles` table
- `ProtectedRoute` component guards routes using:
  - `requireAdmin` prop - requires admin role
  - `componentName` prop - requires specific component permission
- `usePermissions` hook checks component-level access via `has_component_access` database function

### Database Schema

**Main Tables:**
- `user_accounts` - User profiles, Stripe customer data, billing cycles, plans, credits, API keys
- `user_roles` - Role assignments (`admin` | `user` enum)
- `user_permissions` - Component access mapping (user_id, component_name, has_access)
- `activity_logs` - Audit trail (action, component_name, user info, IP address, details JSON)

**Database Functions:**
- `is_admin(_user_id)` - Check if user has admin role
- `has_role(_role, _user_id)` - Check if user has specific role
- `has_component_access(_component, _user_id)` - Check component permission
- `cleanup_old_activity_logs()` - Maintenance function for activity logs

### Component-Level Permissions

Routes can be restricted by `componentName`:
- `"dashboard"` - Main dashboard (/)
- `"users"` - User management (/users)
- `"activity"` - Activity logs (/activity)
- `"wilddeer"` - WildDeer integration (/wilddeer)
- `"stripe"` - Stripe management (/stripe)
- `"credits"` - Credits management (/credits)
- `"account-lookup"` - Account lookup (/account-lookup)

When adding new protected features:
1. Add route to App.tsx with `<ProtectedRoute componentName="new-feature">`
2. Ensure users have corresponding entry in `user_permissions` table
3. Log access attempts in `activity_logs` using `useActivityLog` hook

### Key Directories

```
src/
├── components/
│   ├── admin/          - Admin-only components (InviteUserDialog)
│   ├── auth/           - Auth components (ProtectedRoute, GoogleSignInButton)
│   ├── dashboard/      - Dashboard widgets (DataTable, MetricCard, etc.)
│   ├── layout/         - Layout components (AppSidebar, DashboardLayout)
│   └── ui/             - shadcn/ui components (DO NOT manually edit)
├── hooks/
│   ├── useAuth.tsx     - Authentication context and hooks
│   ├── usePermissions.tsx - Component permission checking
│   └── useActivityLog.tsx - Activity logging utility
├── integrations/
│   └── supabase/       - Supabase client and auto-generated types
├── pages/              - Route components
└── lib/
    └── utils.ts        - Utility functions (cn for className merging)

supabase/
├── config.toml         - Supabase project configuration
├── functions/          - Edge functions (mongodb, manage-users)
└── migrations/         - Database migration files
```

### State Management

- **TanStack Query** (React Query) - Server state management, data fetching, caching
- **React Context** - Auth state (AuthProvider), no global state library
- Use `@tanstack/react-query` for all Supabase queries:
  ```tsx
  const { data, isLoading } = useQuery({
    queryKey: ['key'],
    queryFn: async () => {
      const { data } = await supabase.from('table').select();
      return data;
    }
  });
  ```

### UI Components

- Built with **shadcn/ui** (Radix UI primitives + Tailwind)
- Components in `src/components/ui/` are **auto-generated** - do not manually edit
- To add new shadcn components: Use Lovable platform or manually install via npx
- Custom styling: Use Tailwind classes, theme configured in `tailwind.config.ts`
- Icons: `lucide-react` library

### Activity Logging

Use `useActivityLog` hook to log user actions:
```tsx
const { logActivity } = useActivityLog();

logActivity({
  action: 'user_updated',
  componentName: 'users',
  details: { userId: '123', changes: {...} }
});
```

Logs automatically capture user email, role, and IP address.

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

## Adding New Features

**New Protected Route:**
1. Create page component in `src/pages/`
2. Add route in `App.tsx` inside `<Routes>`
3. Wrap with `<ProtectedRoute componentName="feature-name">` or `requireAdmin` prop
4. Update database `user_permissions` table to grant access
5. Add navigation item to `AppSidebar.tsx`

**New Database Table:**
1. Create migration file in `supabase/migrations/`
2. Apply migration via Supabase dashboard or CLI
3. Regenerate types: Update `src/integrations/supabase/types.ts`

**Accessing User Context:**
```tsx
import { useAuth } from '@/hooks/useAuth';

const { user, isAdmin, userRole, signOut } = useAuth();
```

**Checking Permissions:**
```tsx
import { usePermissions } from '@/hooks/usePermissions';

const { hasAccess } = usePermissions();
if (hasAccess('users')) {
  // User can access users component
}
```

## Testing

- Uses **Vitest** with React Testing Library
- Test files: `src/test/` directory and `*.test.ts(x)` files
- Setup file: `src/test/setup.ts`

## Deployment

### Netlify (Recommended)

The project is configured for Netlify deployment via `netlify.toml`:

1. **Connect to Netlify:**
   - Go to https://app.netlify.com/
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select `rwtd/datahub`

2. **Build Settings** (auto-detected from netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

3. **Environment Variables:**
   Add these in Netlify dashboard (Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

4. **Deploy:**
   - Automatic deploys on push to `main` branch
   - Preview deploys for pull requests

### Vercel (Alternative)

Works with Vercel out of the box:
- Install Vercel GitHub app
- Environment variables needed (same as Netlify)
- Auto-detects Vite configuration

### GitHub Actions CI

The `.github/workflows/ci.yml` runs on every push:
- Linting → Testing → Building
- Add secrets to GitHub repo settings for build to succeed

## Important Notes

- This project was generated via **Lovable.dev** - changes can be made in IDE or via Lovable platform
- Supabase types (`src/integrations/supabase/types.ts`) are auto-generated from database schema
- Always use `@/` path alias for imports (configured in tsconfig)
- Activity logging is critical for audit trails - log all significant user actions
- The `/admin` route requires the admin role, not just component permissions
- Component permissions are checked via database function, not client-side only
