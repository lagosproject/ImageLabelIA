# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Boilerplate repository infrastructure (CI/CD templates, issues/PR templates, and security policies).
- Standard developer workflow documentation (`CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`).
- Environment configuration configuration (`.env.example` & custom `.gitignore`).

## [0.1.0] - 2026-05-30

### Added
- Initial project structure featuring Tauri v2 backend and Angular v20 frontend.
- Python scripts for ONNX model conversion and Hugging Face model fetching (`download_model.py`, `export_convnext.py`).
- Rust inference engine utilizing `ort` (ONNX Runtime) to classify local images.
- Native file dialogue system using `rfd` and directory traversal in Rust.
- Image IPTC metadata reading and writing via `rexiv2` integration.
- Responsive dark mode UI for image inspection and tagging.

[Unreleased]: https://github.com/lakescorp/ImageLabelIA/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lakescorp/ImageLabelIA/releases/tag/v0.1.0
