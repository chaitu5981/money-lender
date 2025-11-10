# Google Play Console Preparation Guide

## 🚀 Quick Start Checklist

### Step 1: Build Production AAB (Do This First!)

You need to build your production AAB file before submitting to Google Play.

#### Option A: Using EAS Build (Recommended)
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to your Expo account
eas login

# Build production AAB (or use the npm script below)
npm run build:android
# OR directly:
eas build --platform android --profile production
```

#### Option B: Using Local Build
```bash
# Build locally (requires Android SDK setup)
npx expo prebuild
cd android
./gradlew bundleRelease
```

**After build completes:**
- Download the AAB file from EAS dashboard or find it in `android/app/build/outputs/bundle/release/`
- Verify the file size is under 100MB
- Keep this file safe - you'll upload it to Play Console

---

### Step 2: Create Feature Graphic (1024x500px)

**Required:** Feature graphic banner for your Play Store listing.

**Options to create:**

1. **Using Canva (Free & Easy)**
   - Go to https://canva.com
   - Create custom size: 1024x500px
   - Include:
     - App name: "Money Lenders Calculator"
     - Key features: "Interest Calculation", "Transaction Tracking", "PDF Export"
     - Use your app's color scheme (from your app design)
   - Export as PNG

2. **Using Figma**
   - Create 1024x500px frame
   - Design banner with app branding
   - Export as PNG

3. **Using Online Tools**
   - https://www.figma.com
   - https://www.gimp.org (free desktop tool)

**Design Tips:**
- Keep text minimal and readable
- Use high contrast colors
- Include app icon or logo if available
- Make it visually appealing but professional

**Save as:** `assets/images/feature-graphic.png`

---

### Step 3: Take Screenshots

**Required:** Minimum 2 screenshots, maximum 8

**Screenshot Requirements:**
- Format: PNG or JPEG
- Aspect ratio: 16:9 or 9:16 (portrait)
- Minimum size: 320px (shortest side)
- Maximum size: 3840px (longest side)
- No device frames needed

**How to Take Screenshots:**

1. **On Android Device/Emulator:**
   ```bash
   # Run your app
   npx expo start
   # Press 'a' for Android
   
   # Take screenshots using:
   # - Device: Power + Volume Down
   # - Emulator: Click camera icon in toolbar
   ```

2. **Using Android Studio Emulator:**
   - Run app in emulator
   - Click camera icon in emulator toolbar
   - Save screenshots

3. **Recommended Screenshots:**
   - Main screen with transactions list
   - Interest calculation results screen
   - Add transaction modal/form
   - Interest report/detail view
   - Settings or configuration screen
   - Dark mode view (if applicable)

**Save screenshots to:** `assets/images/screenshots/`

**Organize as:**
```
assets/images/screenshots/
  ├── screenshot-1-main.png
  ├── screenshot-2-calculation.png
  ├── screenshot-3-transaction.png
  ├── screenshot-4-report.png
  └── ...
```

---

### Step 4: Host Privacy Policy

**Required:** Publicly accessible URL for your privacy policy

#### Option 1: GitHub Pages (Free & Recommended)

1. **Create a new repository:**
   ```bash
   # On GitHub, create a new public repository
   # Name it: privacy-policy or money-lender-privacy
   ```

2. **Upload privacy policy:**
   - Go to your repository on GitHub
   - Click "Add file" → "Create new file"
   - Name it: `index.md`
   - Copy content from `PRIVACY_POLICY.md`
   - Update the date: `**Last Updated:** December 2024`
   - Commit the file

3. **Enable GitHub Pages:**
   - Go to repository Settings
   - Scroll to "Pages" section
   - Source: Select "Deploy from a branch"
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
   - Click Save

4. **Get your URL:**
   - Your privacy policy will be available at:
   - `https://yourusername.github.io/privacy-policy/`
   - Or: `https://yourusername.github.io/repository-name/`

#### Option 2: Google Sites (Free)

1. Go to https://sites.google.com
2. Create a new site
3. Add your privacy policy content
4. Publish the site
5. Get the public URL

#### Option 3: Your Own Domain (If Available)

1. Upload `PRIVACY_POLICY.md` to your web server
2. Convert to HTML or serve as markdown
3. Get the public URL

**Important:** Update the email in `PRIVACY_POLICY.md` before hosting:
- Current: `[chaitu.raju@gmail.com]`
- Update to: `chaitu.raju@gmail.com` (remove brackets)

---

### Step 5: Prepare Store Listing Content

You already have this ready in `STORE_LISTING.md`! ✅

**What you need:**
- ✅ App name: "Money Lenders Calculator"
- ✅ Short description: Ready (80 chars)
- ✅ Full description: Ready (4000 chars)
- ⚠️ Feature graphic: Need to create (Step 2)
- ⚠️ Screenshots: Need to take (Step 3)

---

### Step 6: Create App in Google Play Console

**While waiting for verification, you can:**

1. **Access Play Console:**
   - Go to https://play.google.com/console
   - Sign in with your developer account

2. **Create New App:**
   - Click "Create app"
   - Fill in:
     - App name: "Money Lenders Calculator"
     - Default language: English (United States)
     - App or game: App
     - Free or paid: Free
     - Declare that your app follows all policies: Check the box
   - Click "Create app"

3. **Start Filling Store Listing:**
   - Go to "Store presence" → "Main store listing"
   - Add all the content from `STORE_LISTING.md`
   - Upload feature graphic (once created)
   - Upload screenshots (once taken)

4. **Complete App Content:**
   - Go to "Policy" → "App content"
   - Complete content rating questionnaire
   - Set target audience
   - Complete data safety section

5. **Add Privacy Policy:**
   - Go to "Policy" → "App content" → "Privacy policy"
   - Add your hosted privacy policy URL

---

### Step 7: Upload AAB and Submit

**After account verification is complete:**

1. **Go to "Production" in Play Console:**
   - Click "Create new release"

2. **Upload AAB:**
   - Click "Upload"
   - Select your production AAB file
   - Wait for upload to complete

3. **Add Release Notes:**
   - Version: 1.0.0
   - Release notes: "Initial release of Money Lenders Calculator"

4. **Review:**
   - Check all store listing information
   - Verify privacy policy URL works
   - Ensure all required fields are filled

5. **Submit for Review:**
   - Click "Review release"
   - Click "Start rollout to Production"
   - Your app will be submitted for review

**Review Time:** Usually 1-3 days for first submission

---

## 📋 Pre-Submission Checklist

Use this checklist before submitting:

- [ ] Production AAB built and downloaded
- [ ] Feature graphic created (1024x500px)
- [ ] At least 2 screenshots taken
- [ ] Privacy policy hosted and URL obtained
- [ ] Privacy policy email updated
- [ ] App created in Play Console
- [ ] Store listing completed
- [ ] Content rating questionnaire completed
- [ ] Data safety section completed
- [ ] Privacy policy URL added
- [ ] AAB uploaded to production
- [ ] Release notes added
- [ ] All information reviewed

---

## 🎯 Priority Order (Do While Waiting for Verification)

1. ✅ **Build production AAB** (30-60 minutes)
2. ⚠️ **Create feature graphic** (1-2 hours)
3. ⚠️ **Take screenshots** (30 minutes)
4. ⚠️ **Host privacy policy** (30 minutes)
5. ⏳ **Wait for account verification** (1-7 days)
6. 📤 **Create app in Play Console**
7. 📝 **Complete store listing**
8. 🚀 **Upload AAB and submit**

---

## 💡 Tips & Best Practices

### Feature Graphic Tips:
- Use your app's primary colors
- Keep text minimal (app name + 1-2 key features)
- Make it professional and eye-catching
- Test how it looks on mobile devices

### Screenshot Tips:
- Show your app's best features
- Use real data (not placeholder text)
- Show different screens to demonstrate functionality
- Ensure text is readable
- Use light mode for primary screenshots

### Privacy Policy Tips:
- Make sure the URL is publicly accessible
- Test the URL in incognito/private browsing
- Update the "Last Updated" date
- Ensure email contact is correct

### Build Tips:
- Test your AAB on a device before uploading
- Check app size (should be < 100MB)
- Verify all features work correctly
- Test on different Android versions if possible

---

## 🆘 Troubleshooting

### Build Issues:
- Make sure you're logged into EAS: `eas login`
- Check your `eas.json` configuration
- Verify `app.json` has correct package name

### Privacy Policy Not Accessible:
- Make sure GitHub Pages is enabled
- Check repository is public
- Wait a few minutes after enabling Pages

### Screenshot Issues:
- Use PNG format for best quality
- Ensure aspect ratio is correct
- Check file size (not too large)

---

## 📞 Need Help?

- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **Play Console Help:** https://support.google.com/googleplay/android-developer
- **Privacy Policy Generator:** https://www.freeprivacypolicy.com/ (optional)

---

**Good luck with your app submission! 🚀**

