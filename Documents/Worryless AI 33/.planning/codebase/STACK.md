# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.8.3 - Full codebase
- TSX/JSX - React components

**Secondary:**
- JavaScript - Configuration files

## Runtime

**Environment:**
- Node.js (no specific version pinned in package.json, use nvm recommended)

**Package Manager:**
- npm 3.x (lockfileVersion 3)
- Lockfile: package-lock.json present (386KB+)
- Alternative: Bun supported (bun.lock, bun.lockb files present)

## Frameworks

**Core:**
- React 18.3.1 - UI framework
- Vite 5.4.19 - Build tool and dev server
- React Router DOM 6.30.1 - Client-side routing

**UI Components:**
- shadcn/ui - Component library (via Radix UI primitives)
- Radix UI - Unstyled accessible components (38 packages: dialog, dropdown, select, tabs, etc.)
- Tailwind CSS 3.4.17 - Utility-first CSS

**State & Data:**
- React Query 5.83.0 (@tanstack/react-query) - Server state management
- React Hook Form 7.61.1 - Form state management
- Zod 3.25.76 - Schema validation

**Editor Integration:**
- CodeMirror 6.x - Markdown editing support
- @codemirror/lang-markdown 6.5.0
- @codemirror/state, @codemirror/view, @codemirror/basic-setup

**Testing:**
- Vitest 4.1.0 - Unit/component testing
- Testing Library React 16.3.2 - Component testing utilities
- JSDOM 28.1.0 - DOM simulation environment

**Build/Dev:**
- Lovable Tagger 1.1.11 - Development component tagging
- @vitejs/plugin-react-swc 3.11.0 - React SWC compiler for Vite
- TypeScript ESLint 8.38.0 - Type-aware linting

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.86.0 - Backend/database client
- React Router DOM 6.30.1 - Core navigation
- React Hook Form 7.61.1 - Form handling
- Zod 3.25.76 - Runtime schema validation
- Tailwind CSS 3.4.17 - Styling system

**UI & UX:**
- Lucide React 0.462.0 - SVG icon library
- Sonner 1.7.4 - Toast notifications
- React Markdown 10.1.0 - Markdown rendering
- Date-fns 3.6.0 - Date utilities
- React Resizable Panels 2.1.9 - Resizable layout components
- Recharts 2.15.4 - React charting library
- Embla Carousel 8.6.0 - Carousel component
- Input OTP 1.4.2 - OTP input component
- Next Themes 0.3.0 - Theme management (dark/light mode)
- Vaul 0.9.9 - Drawer component

**Utilities:**
- Class Variance Authority 0.7.1 - CSS class variant management
- Tailwind Merge 2.6.0 - Merge Tailwind classes intelligently
- CLSX 2.1.1 - Conditional className utility
- cmdk 1.1.1 - Command palette component

**Validation:**
- @hookform/resolvers 3.10.0 - Bridge between React Hook Form and schema validators

## Configuration

**Environment:**
- Vite environment variables: `VITE_*` prefix
- .env file required (present but not committed)
- Key vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_VAPID_PUBLIC_KEY

**Build:**
- `vite.config.ts` - Vite configuration with React plugin, path aliases
- `tsconfig.json` - TypeScript configuration with path alias `@/*` → `./src/*`
- `tsconfig.app.json` - App-specific TypeScript config
- `tsconfig.node.json` - Build tool TypeScript config
- `tailwind.config.ts` - Tailwind theming and extensions
- `postcss.config.js` - PostCSS plugins (tailwindcss, autoprefixer)
- `eslint.config.js` - ESLint rules (flat config)
- `vitest.config.ts` - Vitest testing configuration

**ESLint Configuration:**
- Flat config system
- TypeScript ESLint recommended
- React Hooks plugin
- React Refresh plugin
- Browser globals
- Disabled: @typescript-eslint/no-unused-vars

**Styling:**
- Dark mode support: class-based (darkMode: ["class"])
- Font families: Montserrat (sans), Cormorant Garamond (serif), IBM Plex Mono (mono)
- CSS variables for theming (--primary, --secondary, --destructive, etc.)
- Custom animations: accordion-down, accordion-up, pulse-glow
- Custom shadow system with 2xs through 2xl variants

## Platform Requirements

**Development:**
- Node.js + npm
- Modern browser with ES2020+ support
- Git for version control
- Web Worker support (for service workers - push notifications)
- Notification API support (optional - graceful degradation for push)

**Production:**
- Browser: Modern browsers with React 18 support
- Deployment: Platform-agnostic (Lovable/Vercel recommended per README)
- HTTPS required (for service workers and push notifications)

## Scripts

```bash
npm run dev          # Start Vite dev server (localhost:8080)
npm run build        # Production build
npm run build:dev    # Development build (for testing)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Entry Points

- `src/main.tsx` - React DOM entry point
- `src/App.tsx` - Root React component
- `index.html` - HTML entry point
- Vite server on `localhost:8080` (configured in vite.config.ts)

---

*Stack analysis: 2026-03-18*
