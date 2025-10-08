#!/bin/bash

# 🚀 Public Codex - GitHub Deployment Setup Script
# This script helps you deploy your Public Codex to GitHub

echo "🖋️  Public Codex - GitHub Deployment Setup"
echo "=========================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check if remote origin exists
if git remote | grep -q "origin"; then
    echo "✅ Remote origin already configured"
    ORIGIN_URL=$(git remote get-url origin)
    echo "   Current origin: $ORIGIN_URL"
else
    echo ""
    echo "🔗 Setting up GitHub remote..."
    echo "Please create a repository on GitHub named 'public-codex'"
    echo "Repository URL should be: https://github.com/LooneyRichie/public-codex.git"
    echo ""
    read -p "Have you created the GitHub repository? (y/n): " created_repo
    
    if [ "$created_repo" = "y" ] || [ "$created_repo" = "Y" ]; then
        git remote add origin https://github.com/LooneyRichie/public-codex.git
        echo "✅ Remote origin added"
    else
        echo "⏸️  Please create the GitHub repository first, then run this script again"
        exit 1
    fi
fi

# Add all files and commit
echo ""
echo "📝 Adding files and creating initial commit..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit"
else
    git commit -m "Initial commit: Public Codex - A secure content publishing platform

Features:
- React frontend with modern UI
- Node.js backend with encrypted storage
- JWT authentication
- Content publishing with copyright protection
- Responsive design with Tailwind CSS
- GitHub Pages deployment ready"
    echo "✅ Initial commit created"
fi

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
git branch -M main

if git push -u origin main; then
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🌐 Next steps:"
    echo "1. Go to https://github.com/LooneyRichie/public-codex"
    echo "2. Go to Settings > Pages"
    echo "3. Set Source to 'GitHub Actions'"
    echo "4. Your site will be available at: https://looneyrichie.github.io/public-codex"
    echo ""
    echo "📖 For detailed deployment instructions, see DEPLOYMENT.md"
else
    echo "❌ Failed to push to GitHub. Please check your repository setup."
    exit 1
fi

echo ""
echo "🎉 Setup complete! Your Public Codex is ready for deployment!"