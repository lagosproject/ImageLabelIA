# Contributing to Image Label IA

Thank you for your interest in contributing to **Image Label IA**! By participating, you help make local image categorization easier for photographers everywhere.

Please review the guidelines below to ensure a smooth contribution process.

---

## 🗺 Table of Contents
1. [Code of Conduct](#-code-of-conduct)
2. [How Can I Contribute?](#-how-can-i-contribute)
3. [Branching Strategy](#-branch-ing-strategy)
4. [Development Guidelines](#-development-guidelines)
5. [Submitting a Pull Request](#-submitting-a-pull-request)
6. [Coding Standards](#-coding-standards)

---

## 🤝 Code of Conduct

By participating in this project, you agree to abide by the terms of our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainers.

---

## 💡 How Can I Contribute?

- **Report Bugs**: If you find an issue, submit a detailed report using the bug template.
- **Request Features**: Propose ideas to enhance user experience or performance.
- **Submit Fixes/Enhancements**: Pick up open issues or submit improvements directly via Pull Requests.

---

## 🌿 Branching Strategy

We follow a structured Git branching workflow. Always branch off the `main` branch.

- **Feature branches**: `feature/short-description` (for new features or additions).
- **Bugfix branches**: `bugfix/short-description` (for fixing bugs).
- **Hotfix branches**: `hotfix/short-description` (for critical production patches).
- **Documentation branches**: `docs/short-description` (for README, guides, etc.).

### Step-by-Step Branch Setup
1. Fetch the latest changes from upstream:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create and switch to your branch:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```

---

## 🛠 Development Guidelines

### Running Tests Locally

#### Frontend (Angular)
Ensure typescript issues and unit tests are validated:
```bash
pnpm ng test --watch=false
```

#### Backend (Rust/Tauri)
Compile and run unit tests for the Rust code:
```bash
cd src-tauri
cargo test
```

#### Linting & Formatting
Ensure all files are styled correctly before committing.
- **Frontend (Angular)**:
  ```bash
  pnpm ng lint
  ```
- **Rust Backend**:
  ```bash
  cd src-tauri
  cargo fmt --all
  cargo clippy --all-targets -- -D warnings
  ```
- **Python Scripts**:
  ```bash
  black .
  ```

---

## 📥 Submitting a Pull Request

When you are ready to submit your work, please follow these steps:

1. **Verify Your Branch**: Make sure all local tests, formats, and lints pass.
2. **Commit Message Conventions**: Use clear, semantic commit messages (e.g., `feat: add DETR tag preview overlay`, `fix: handle rexiv2 file read error gracefully`).
3. **Push to Your Fork**: Push the local branch to GitHub.
4. **Create PR**: Open a PR pointing to the `main` branch of `lakescorp/ImageLabelIA`.
5. **Fill out the Template**: Complete the checklist in the PR template.
6. **Code Review**: At least one maintainer must review and approve your PR before it can be merged.

---

## 🎨 Coding Standards

### TypeScript / Angular
- Write clean, componentized code. Avoid large monolithic files.
- Prefer type safety; avoid using `any` whenever possible.

### Rust
- Follow idioms outlined in *The Rust Programming Language*.
- Keep `unsafe` code block usage to a minimum, justifying its necessity when used.
- Ensure proper error handling: handle errors gracefully using `Result` / `Option` rather than `unwrap()` or `expect()`.

### Python
- Adhere to **PEP 8** coding conventions.
- Provide type hints for function arguments and return types.
