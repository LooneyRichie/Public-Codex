# 🚀 Quick Start: Deploy Public Codex to GitHub

Get your Public Codex live on the web in just a few minutes!

## 🎯 Option 1: Automated Setup (Recommended)

Run this single command to set everything up:

```bash
npm run deploy:setup
```

This script will:
- ✅ Initialize Git repository
- ✅ Set up GitHub remote
- ✅ Create initial commit
- ✅ Push to GitHub
- ✅ Provide next steps

## 🎯 Option 2: Manual Setup

### Step 1: Create GitHub Repository
1. Go to [GitHub.com](https://github.com/LooneyRichie)
2. Click "New repository"
3. Name: `public-codex`
4. Description: "A secure platform for publishing and protecting creative content"
5. Make it **Public**
6. **Don't** initialize with README

### Step 2: Deploy to GitHub
```bash
# Initialize and connect to GitHub
git init
git remote add origin https://github.com/LooneyRichie/public-codex.git

# Add all files and commit
git add .
git commit -m "Initial commit: Public Codex platform"

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository: `https://github.com/LooneyRichie/public-codex`
2. Click **Settings** tab
3. Scroll to **Pages** section
4. Source: Select **"GitHub Actions"**
5. Save changes

### Step 4: Deploy Frontend
```bash
cd client
npm install
npm run deploy
```

## 🌐 Your Live Website

After setup, your Public Codex will be available at:

**https://looneyrichie.github.io/public-codex**

## 🔄 Future Updates

To update your live site:

```bash
# Make your changes, then:
git add .
git commit -m "Update: describe your changes"
git push

# For frontend-only updates:
npm run deploy:pages
```

## ⚡ Next Steps

1. **Customize**: Update colors, branding, and content
2. **Content**: Add your first posts and test the platform
3. **Share**: Share your live URL with others
4. **Custom Domain**: Add your own domain (optional)

## 🛠️ Need Full Backend?

For a complete deployment with backend features:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel, Railway, or Render options
- These platforms support the full Node.js backend with database

## 🎉 You're Live!

Congratulations! Your Public Codex is now live on the web. Start publishing and building your creative community!

---

**Questions?** Check the main [README.md](README.md) or [DEPLOYMENT.md](DEPLOYMENT.md) for detailed information.