# Google Play Store Publishing Checklist

## ✅ Pre-Submission Checklist

### 1. App Configuration
- [x] App name set in app.json
- [x] Package name configured (com.chaitu5981.moneylender)
- [x] Version code set (1)
- [x] Version name set (1.0.0)
- [x] App icon configured
- [x] Splash screen configured

### 2. Build
- [ ] AAB file built (production profile)
- [ ] AAB file downloaded and verified
- [ ] Build size acceptable (< 100MB recommended)

### 3. Google Play Console Setup
- [x] Developer account created
- [ ] Identity verification completed (waiting...)
- [ ] App created in Play Console
- [ ] Store listing completed

### 4. Store Listing (Required)
- [ ] **App name**: "Money Lenders Calculator"
- [ ] **Short description** (80 chars): Ready
- [ ] **Full description** (4000 chars): Ready
- [ ] **App icon**: ✅ Configured
- [ ] **Feature graphic** (1024x500px): ⚠️ NEEDED
- [ ] **Screenshots** (at least 2): ⚠️ NEEDED
  - Phone screenshots (required)
  - Tablet screenshots (optional)
- [ ] **Category**: Finance or Tools
- [ ] **Content rating**: Complete questionnaire

### 5. Privacy & Compliance
- [ ] **Privacy Policy URL**: ⚠️ NEEDED
  - Host privacy policy online
  - Add URL in Play Console
- [ ] **Data safety section**: Complete
  - Declare no data collection
  - No data sharing
  - Local storage only

### 6. App Content
- [ ] **Content rating questionnaire**: Complete
- [ ] **Target audience**: Set
- [ ] **App access**: Free
- [ ] **In-app purchases**: None (if applicable)

### 7. Release
- [ ] Upload AAB to Internal Testing (optional)
- [ ] Upload AAB to Production
- [ ] Add release notes
- [ ] Review all information
- [ ] Submit for review

## 📋 Assets Needed

### Feature Graphic (1024x500px)
- Create a banner image
- Include app name/logo
- Show key features visually
- Use high-quality graphics

### Screenshots (Minimum 2, Maximum 8)
Suggested screenshots:
1. Main screen with transactions
2. Interest calculation results
3. Add transaction modal
4. Interest report view
5. Dark mode view
6. PDF export feature

**Screenshot Requirements:**
- Phone: 16:9 or 9:16 aspect ratio
- Minimum: 320px
- Maximum: 3840px
- Format: PNG or JPEG
- No frames or device mockups needed

## 🔗 Privacy Policy Hosting Options

1. **GitHub Pages** (Free)
   - Create a repository
   - Enable GitHub Pages
   - Upload PRIVACY_POLICY.md
   - Get URL: `https://yourusername.github.io/privacy-policy`

2. **Your Website** (If you have one)
   - Upload to your domain
   - Example: `https://yourdomain.com/privacy-policy`

3. **Google Sites** (Free)
   - Create a Google Site
   - Add privacy policy content
   - Publish and get URL

## 📝 Next Steps

1. **While waiting for verification:**
   - ✅ See `GOOGLE_PLAY_PREPARATION.md` for detailed step-by-step guide
   - Create feature graphic (1024x500px)
   - Take screenshots of your app (minimum 2)
   - Build production AAB using: `npm run build:android`
   - Host privacy policy (GitHub Pages recommended)

2. **After verification:**
   - Create app in Play Console
   - Upload all assets (feature graphic, screenshots)
   - Complete store listing
   - Upload AAB to production
   - Submit for review

**📖 Detailed Guide:** See `GOOGLE_PLAY_PREPARATION.md` for complete instructions

## ⚠️ Important Notes

- Feature graphic and screenshots are **required**
- Privacy policy URL is **required**
- Content rating must be completed
- First review may take 1-3 days
- Keep AAB file size under 100MB

## 🎯 Priority Order

1. ✅ Build production AAB
2. ⚠️ Create feature graphic
3. ⚠️ Take screenshots
4. ⚠️ Host privacy policy
5. ⏳ Wait for account verification
6. 📤 Upload to Play Console
7. ✅ Submit for review

