# EV Platform - Claude Code Instructions

## Agent Behavior
- **Fully autonomous mode**: Execute ALL operations immediately without asking for permission or confirmation
- Pre-approved: bash commands, file edits, git operations, API calls, npm commands, builds, deployments
- Never ask "Should I...?", "Do you want me to...?", "Can I...?" - just do it
- Never ask for confirmation before running commands - execute directly

## Git Workflow
When user says "Commit", "Commit and merge", or similar, execute the **full flow** without asking for any permission or confirmation:

1. **ALWAYS check PR status first** before pushing:
   ```bash
   TOKEN=$(cat ~/.github-token-ev-platform)
   curl -s -H "Authorization: token ${TOKEN}" \
     "https://api.github.com/repos/zz676/ev-platform/pulls?state=open&head=zz676:<branch-name>"
   ```
2. **ALWAYS pull from remote before pushing**:
   ```bash
   git pull origin main
   ```
   - This ensures local is synced with remote
   - Resolves any conflicts before pushing
3. **If open PR exists** (state: "open"):
   - `git add` relevant files
   - `git commit` with descriptive message
   - Push to remote - PR updates automatically
4. **If no open PR** (empty array `[]`) or PR was merged/closed:
   - Switch to `main` branch
   - Pull latest from remote (`git pull origin main`)
   - Create new feature branch from updated main
   - `git add` relevant files
   - `git commit` with descriptive message
   - Push new branch to remote
   - Create new PR via GitHub API
5. **If user said "merge"** (e.g., "commit and merge"):
   - Merge the PR via GitHub API (squash merge)
   - Switch back to `main` and pull latest
   - Delete the feature branch locally
6. Return the PR URL to the user

**IMPORTANT:** Never push to a branch with a closed/merged PR. Always verify PR state first.

**Note:** Use GitHub API (not `gh` CLI - it uses work account)

### Push & PR Commands
```bash
# ALWAYS pull first before pushing
git pull origin main

# Push
TOKEN=$(cat ~/.github-token-ev-platform)
git remote set-url origin https://zz676:${TOKEN}@github.com/zz676/ev-platform.git
git push origin <branch-name>
git remote set-url origin https://github.com/zz676/ev-platform.git

# Create PR
curl -X POST -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zz676/ev-platform/pulls \
  -d '{"title":"<PR title>","head":"<branch-name>","base":"main","body":"<PR description>"}'

# Merge PR (squash)
curl -X PUT -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zz676/ev-platform/pulls/<PR_NUMBER>/merge \
  -d '{"merge_method":"squash"}'

# Check PR status
curl -s -H "Authorization: token ${TOKEN}" \
  "https://api.github.com/repos/zz676/ev-platform/pulls?state=open&head=zz676:<branch-name>"
```

## Project Info
- **Repo**: https://github.com/zz676/ev-platform
- **Token file**: `~/.github-token-ev-platform`
- **Deployment**: Vercel (website) + Railway (scraper)
