#!/bin/bash
# Auto Push Script for Linux/Mac
# This script automatically commits and pushes changes to GitHub
# Usage: ./auto-push.sh "Your commit message"

MESSAGE="${1:-Auto commit: Update code}"

echo "🔄 Checking for changes..."

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit."
    exit 0
fi

echo "📝 Changes found. Staging files..."
git add -A

echo "💾 Committing changes..."
git commit -m "$MESSAGE"

echo "🚀 Pushing to GitHub..."
git push origin HEAD:main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "📦 Render will auto-deploy if configured."
else
    echo "❌ Error pushing to GitHub!"
    exit 1
endif

