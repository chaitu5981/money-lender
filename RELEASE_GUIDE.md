# Release Guide - Version 1.0.2

## 📋 Pre-Release Checklist

Before building and releasing, ensure:

- [x] Version numbers updated (✅ Done: 1.0.2)
- [x] Android versionCode incremented (✅ Done: 3)
- [x] CHANGELOG.md created with release notes
- [ ] All features tested locally
- [ ] No console errors or warnings
- [ ] App works on both light and dark mode
- [ ] All transaction validations working correctly
- [ ] PDF export working properly
- [ ] Interest calculations verified

## 🚀 Build Production Release

### Step 1: Install EAS CLI (if not already installed)

```bash
pnpm install -g eas-cli
```

### Step 2: Login to Expo Account

```bash
eas login
```

### Step 3: Build Production AAB

```bash
# Build for Android (Production)
eas build --platform android --profile production

# OR if you want to build APK for testing first
eas build --platform android --profile apk
```

**Build Time:** Usually 15-30 minutes

**After Build Completes:**
- You'll receive a notification
- Download the AAB file from EAS dashboard: https://expo.dev/accounts/chaitu5981/projects/money-lenders-calculator/builds
- Or use the download link provided in terminal

### Step 4: Test the Build (Recommended)

1. Install the APK/AAB on a test device
2. Test all major features:
   - Add borrowals and repayments
   - Edit transactions
   - Delete transactions
   - Calculate interest
   - Export PDF
   - Verify validation rules work
   - Test same-day transaction handling

## 📤 Submit to Google Play Store

### Step 1: Access Google Play Console

1. Go to https://play.google.com/console
2. Navigate to your app: "Money Lenders Calculator"
3. Go to "Production" → "Releases"

### Step 2: Create New Release

1. Click "Create new release"
2. Upload the new AAB file (version 1.0.2)
3. Add release notes:

```
Version 1.0.2 - Bug Fixes & Improvements

• Fixed validation to ensure first transaction is always a borrowal
• Fixed transaction sorting for same-day transactions
• Fixed interest calculation for same-day transaction aggregation
• Improved input validation for amounts and interest rates
• Fixed interest calculation for rates >= 100%
• Fixed console errors and improved error handling
• Enhanced transaction validation with better error messages
```

4. Review the release
5. Click "Review release"
6. Click "Start rollout to Production"

### Step 3: Monitor Release

- Review status in Play Console
- Check for any issues or rejections
- Monitor user feedback after release

## 🔄 Version History

- **1.0.2** (Current) - Bug fixes and improvements
- **1.0.1** - Previous release
- **1.0.0** - Initial release

## 📝 Release Notes Template

When creating release notes for Play Store, use this format:

```
Version X.X.X - [Type: Bug Fixes / New Features / Improvements]

• [Brief description of change 1]
• [Brief description of change 2]
• [Brief description of change 3]
...
```

## ⚠️ Important Notes

1. **Version Code:** Always increment versionCode for each release (currently: 3)
2. **Version Name:** Follow semantic versioning (major.minor.patch)
3. **Testing:** Always test the production build before submitting
4. **Rollback:** Keep previous AAB files in case you need to rollback
5. **Release Notes:** Keep release notes user-friendly and concise

## 🆘 Troubleshooting

### Build Fails
- Check `eas.json` configuration
- Verify `app.json` has correct package name
- Ensure you're logged in: `eas login`
- Check EAS build logs for specific errors

### Upload Fails
- Verify AAB file size is under 100MB
- Check that versionCode is higher than previous release
- Ensure version name follows semantic versioning

### App Rejected
- Review rejection reason in Play Console
- Fix issues and resubmit
- Update version numbers before resubmitting

## 📞 Resources

- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **Play Console:** https://play.google.com/console
- **EAS Dashboard:** https://expo.dev/accounts/chaitu5981/projects/money-lenders-calculator

---

**Ready to release?** Follow the steps above and you'll have version 1.0.2 live! 🚀

