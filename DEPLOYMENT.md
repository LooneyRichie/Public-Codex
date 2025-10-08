# 🚀 GitHub Deployment Guide for Public Codex

This guide will help you deploy your Public Codex platform to GitHub Pages and other hosting services.

## 📋 Prerequisites

1. **GitHub Account**: Ensure you have a GitHub account (LooneyRichie)
2. **Git Installed**: Make sure Git is installed on your system
3. **Node.js**: Ensure you have Node.js installed

## 🌐 Option 1: GitHub Pages (Frontend Only)

GitHub Pages is perfect for hosting the React frontend as a static site.

### Step 1: Initialize Git Repository

```bash
cd /home/looney/Looney/JavaScript/Codex
git init
git add .
git commit -m "Initial commit: Public Codex platform"
```

### Step 2: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Repository name: `public-codex`
4. Description: "A secure platform for publishing and protecting creative content"
5. Make it Public
6. Don't initialize with README (we already have one)

### Step 3: Connect Local Repository to GitHub

```bash
git remote add origin https://github.com/LooneyRichie/public-codex.git
git branch -M main
git push -u origin main
```

### Step 4: Enable GitHub Pages

1. Go to your repository settings
2. Scroll to "Pages" section
3. Source: "GitHub Actions"
4. The workflow will automatically deploy on every push to main

### Step 5: Deploy Frontend

```bash
cd client
npm install gh-pages --save-dev
npm run deploy
```

Your frontend will be live at: `https://looneyrichie.github.io/public-codex`

## 🖥️ Option 2: Full Stack Deployment

For a complete deployment with backend, consider these options:

### A. Vercel (Recommended for Full Stack)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Configure Environment Variables** in Vercel dashboard:
   - `JWT_SECRET`: Your secure JWT secret
   - `NODE_ENV`: production

### B. Railway

1. Connect your GitHub repository to Railway
2. Set environment variables
3. Automatic deployment on git push

### C. Render

1. Connect repository to Render
2. Configure build and start commands
3. Set environment variables

## 🔧 Environment Configuration

For production deployment, create these environment variables:

```env
# Required for production
JWT_SECRET=your-super-secure-jwt-secret-here
NODE_ENV=production

# Optional: Database configuration
DATABASE_URL=your-database-url

# Optional: External services
REDIS_URL=your-redis-url
PINECONE_API_KEY=your-pinecone-key
QDRANT_URL=your-qdrant-url
```

## 📁 Project Structure for Deployment

```
public-codex/
├── client/                 # React frontend (GitHub Pages)
│   ├── build/             # Built frontend (auto-generated)
│   ├── public/
│   └── src/
├── server/                # Node.js backend
├── poets-codex-server.js  # Main server file
├── .github/
│   └── workflows/
│       └── deploy.yml     # Auto-deployment workflow
└── README.md
```

## 🔄 Automatic Deployment

The included GitHub Actions workflow automatically:

1. ✅ Runs on every push to main branch
2. ✅ Installs dependencies
3. ✅ Builds the React app
4. ✅ Deploys to GitHub Pages
5. ✅ Updates your live site

## 🌍 Custom Domain (Optional)

To use a custom domain like `publiccodex.com`:

1. **Buy a domain** from any registrar
2. **Add CNAME file** to client/public/:
   ```
   your-domain.com
   ```
3. **Configure DNS** to point to GitHub Pages
4. **Enable HTTPS** in repository settings

## 📊 Monitoring & Analytics

Add these to your deployed site:

- **Google Analytics**: Add tracking ID to index.html
- **Error Monitoring**: Sentry integration
- **Performance**: Web Vitals monitoring

## 🔒 Security Checklist

Before going live:

- ✅ JWT_SECRET is environment variable (not hardcoded)
- ✅ HTTPS enabled
- ✅ Environment variables secured
- ✅ Database credentials protected
- ✅ CORS configured for production domains

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails**: Check Node.js version compatibility
2. **Pages Not Loading**: Verify homepage URL in package.json
3. **API Errors**: Ensure backend is deployed and accessible
4. **Environment Variables**: Check all required vars are set

### Getting Help:

- Check GitHub Actions logs for deployment errors
- Review browser console for frontend issues
- Monitor server logs for backend problems

## 🎉 Go Live!

Once deployed, your Public Codex will be available at:

- **GitHub Pages**: https://looneyrichie.github.io/public-codex
- **Custom Domain**: https://your-domain.com (if configured)

Share your platform and start building your community of creators!

---

**Need help?** Open an issue in the repository or check the deployment logs.