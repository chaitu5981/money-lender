# Development Client Setup

## How It Works

You no longer need to manually add/remove `expo-dev-client` from `package.json`!

### Automatic Handling

EAS Build automatically handles `expo-dev-client` based on your build profile:

- **`development` profile** (with `developmentClient: true`) → Includes expo-dev-client
- **`production` profile** (without `developmentClient`) → Excludes expo-dev-client automatically
- **`preview` profile** → Excludes expo-dev-client (regular build)

### Current Setup

1. **`expo-dev-client` is in `devDependencies`** ✅
   - Available for local development
   - Won't be included in production builds

2. **Build Profiles:**
   - `npm run build:android` → Production build (NO dev client)
   - `eas build --profile development` → Development build (WITH dev client)
   - `eas build --profile preview` → Preview build (NO dev client)

### Local Development

For local development with dev client:

```bash
# Install dependencies (includes expo-dev-client from devDependencies)
npm install

# Start with dev client
npx expo start --dev-client
```

### Production Builds

For production builds (Google Play Store):

```bash
# This will NOT include expo-dev-client
npm run build:android
# or
eas build --platform android --profile production
```

EAS Build automatically excludes `expo-dev-client` from production builds because:

- It's in `devDependencies` (not `dependencies`)
- The `production` profile doesn't have `developmentClient: true`

### No Manual Steps Needed! 🎉

You can now:

- ✅ Keep `expo-dev-client` in `devDependencies` permanently
- ✅ Build production AABs without removing it
- ✅ Use dev client for local development
- ✅ No manual package.json edits needed

---

## Troubleshooting

If you ever need to ensure dev client is excluded:

1. **Check your build profile** in `eas.json`:
   - Production should NOT have `developmentClient: true`

2. **Verify package location**:
   - `expo-dev-client` should be in `devDependencies`, not `dependencies`

3. **Check build logs**:
   - EAS Build will show if dev client is included or not
