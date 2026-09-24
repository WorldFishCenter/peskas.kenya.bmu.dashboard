# Contributing to Peskas Next

Thank you for your interest in contributing to Peskas Next! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Commit Messages](#commit-messages)
- [Release Process](#release-process)
- [Code Style](#code-style)
- [Testing](#testing)

## Development Setup

### Prerequisites

- Node.js 18.18 or later
- pnpm 9.1.4 (recommended)
- Turborepo (installed with the project; no global install needed)
- MongoDB connection string

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/WorldFishCenter/peskas.kenya.bmu.dashboard.git
   cd peskas.kenya.bmu.dashboard
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/isomorphic-i18n/.env.local.example apps/isomorphic-i18n/.env.local
   # Edit it, and add MONGODB_URI (plus EMAIL_SERVER and EMAIL_FROM for password-reset emails)
   ```

4. Start the development server:
   ```bash
   pnpm run i18n:dev  # Main i18n app (port 3001)
   ```

## Branching Strategy

- **`dev`**: Default branch. Branch from it and open pull requests against it; pushes to it create releases
- **`main`**: Old branch, no longer updated
- **Feature branches**: `feature/your-feature-name`
- **Bug fix branches**: `fix/bug-description`

### Workflow

1. Create a new branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them (see [Commit Messages](#commit-messages))

3. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a Pull Request to `dev` branch

## Commit Messages

We follow a descriptive commit message format. Your commit messages should:

- Start with a verb in present tense (e.g., "Add", "Fix", "Update", "Refactor")
- Be clear and concise
- Reference issue numbers when applicable

### Examples

Good commit messages:
```
Add user authentication tracking to analytics
Fix language switching bug in header component
Update Swahili translations for fisher metrics
Refactor BMU ranking component for better performance
```

## Release Process

Peskas Next uses an automated release workflow via GitHub Actions. Releases are created from the `dev` branch.

### Version Numbers

We follow [Semantic Versioning](https://semver.org/):

- **Major version (X.0.0)**: Breaking changes or major feature releases
- **Minor version (0.X.0)**: New features, backwards compatible
- **Patch version (0.0.X)**: Bug fixes and minor improvements

### Creating a Release

1. **Update NEWS.md**

   Add your changes to the top of `NEWS.md` following this format:

   ```markdown
   # peskas.kenya.bmu.dashboard X.Y.Z

   ## New features
   - Description of new features added
   - Each feature on a new line with a dash

   ## Enhancements
   - Description of improvements to existing features
   - Performance optimizations
   - UI/UX improvements

   ## Fixes
   - Bug fixes and issue resolutions
   - Each fix on a new line

   ## Documentation
   - Documentation updates (if applicable)

   ---
   ```

   **Important**: Always add new versions at the TOP of the file, before any existing versions.

2. **Categorize Your Changes**

   Use these categories:
   - **New features**: Brand new functionality
   - **Enhancements**: Improvements to existing features
   - **Fixes**: Bug fixes and corrections
   - **Documentation**: Documentation-only changes

3. **Commit and Push**

   ```bash
   git add NEWS.md
   git commit -m "Release version X.Y.Z"
   git push origin dev
   ```

4. **Automatic Release Creation**

   The GitHub Action will:
   - Extract the version number from the first line of NEWS.md
   - Extract the changelog for that version
   - Check if a git tag already exists
   - If the tag doesn't exist, create:
     - A git tag named `vX.Y.Z`
     - A GitHub Release with the extracted changelog

5. **Verify the Release**

   Go to https://github.com/WorldFishCenter/peskas.kenya.bmu.dashboard/releases to see your release.

### Example Release Workflow

Let's say you've added a new feature and want to release version 2.6.0:

1. Edit NEWS.md:
   ```markdown
   # peskas.kenya.bmu.dashboard 2.6.0

   ## New features
   - Added real-time fish catch notifications
   - Implemented export functionality for monthly reports

   ## Enhancements
   - Improved dashboard loading performance by 40%
   - Enhanced mobile responsiveness of charts

   ## Fixes
   - Fixed date range selector not updating correctly
   - Resolved translation issues in Swahili locale

   ---

   # peskas.kenya.bmu.dashboard 2.5.0
   ...
   ```

2. Commit:
   ```bash
   git add NEWS.md
   git commit -m "Release version 2.6.0"
   git push origin dev
   ```

3. The workflow runs automatically and creates the release!

### Troubleshooting Releases

**Problem**: Release wasn't created after pushing to dev

**Solutions**:
- Check that your NEWS.md version header follows the exact format: `# peskas.kenya.bmu.dashboard X.Y.Z`
- Verify the version number doesn't already have a tag (check: https://github.com/WorldFishCenter/peskas.kenya.bmu.dashboard/tags)
- Check the GitHub Actions tab for error messages

**Problem**: Wrong version was released

**Solution**:
- Delete the incorrect tag and release on GitHub
- Fix the NEWS.md file
- Commit and push again

## Code Style

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types for object definitions
- Use strict typing, avoid `any` when possible

### React Components

- Use functional components with hooks
- Follow the existing component structure in `apps/isomorphic-i18n/src/app/shared/`
- Keep components small and focused
- Extract reusable logic into custom hooks

### Internationalization

- All user-facing text must be translatable
- Add translations to both `locales/en/common.json` and `locales/sw/common.json`
- Use the `useTranslation` hook: `const { t } = useTranslation(lang, 'common')`

### File Organization

```
apps/isomorphic-i18n/src/
├── app/
│   ├── [lang]/           # i18n routes
│   ├── i18n/             # i18n configuration
│   └── shared/           # Shared components
│       ├── analytics/    # Analytics components
│       ├── file/         # File dashboard components
│       └── ...
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm run test

# Run tests for specific app
pnpm run i18n:test
```

### Before Submitting a PR

1. Run linting:
   ```bash
   pnpm run i18n:lint
   ```

2. Build the project:
   ```bash
   pnpm run i18n:build
   ```

3. Test your changes manually in the development environment

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Update documentation if needed
3. Add or update tests if applicable
4. Fill out the pull request template
5. Link related issues
6. Request review from maintainers

## Questions?

If you have questions or need help:
- Open an issue on GitHub
- Contact the maintainers
- Check the project documentation

Thank you for contributing to Peskas Next! 🎣
