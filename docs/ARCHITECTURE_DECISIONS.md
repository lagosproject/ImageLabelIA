# Architecture Decisions

This document lists the architectural decisions made for the **ImageLabelIA** project.

## Decision Map

| ID | Area | Decision | Impact | Status |
|----|------|----------|--------|--------|
| ADR-001 | Architecture | Tauri v2 Desktop Framework Selection | High | Accepted (inferred) |
| ADR-002 | Frontend | Angular v20 Frontend Framework Selection | Medium | Accepted (inferred) |
| ADR-003 | Data | Pure File Metadata Persistence (XMP/IPTC) | High | Accepted (inferred) |
| ADR-004 | Architecture | Multi-Model Tagging Architecture with ViT and DETR | Medium | Superseded |
| ADR-005 | Architecture | Consolidated Image Tagging via a Single ConvNeXt-Base Model | Medium | Accepted (inferred) |
| ADR-006 | Architecture | Local Inference using ONNX Runtime (ort) | High | Accepted (inferred) |
| ADR-007 | Data | Image Metadata Manipulation via rexiv2 | High | Accepted (inferred) |
| ADR-008 | Frontend | Dynamic Client-Side Concurrency Throttling for Thumbnail Generation | Medium | Accepted (inferred) |
| ADR-009 | Infrastructure | Dockerized Linux Build Environment for Cross-Compilation | Medium | Accepted (inferred) |
| ADR-010 | Architecture | Lazy Loading of ONNX Model Session | Low | Accepted (inferred) |
| ADR-011 | Security | Wildcard File Access Scope via Tauri Asset Protocol | High | Accepted (inferred) |
| ADR-012 | Testing | Postponed Automated Testing Implementation | High | Questioned |
| ADR-013 | API | Raw String IPC Error Transmission | Medium | Questioned |
| ADR-014 | Conventions | Unified Style Enforcement with Native Formatters and Linters | Low | Accepted (inferred) |

---

# ADR-001: Tauri v2 Desktop Framework Selection

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Architecture  

## Context and problem
The application requires a lightweight, cross-platform desktop UI runtime that can run on Windows, macOS, and Linux. It needs to perform CPU-intensive tasks locally (such as directory scanning, raw image decoding, metadata reading/writing, and ML model inference) while keeping system resource usage and installer file sizes as small as possible.

## Considered options
- **Tauri v2** ← selected
- Electron
- Native Rust UI libraries (e.g., iced, egui)

## Decision
**Tauri v2** was selected because:
- It uses the operating system's native Webview (via Wry) rather than bundling a full Chromium instance (like Electron), resulting in significantly smaller installer packages (~10-20MB) and lower runtime memory footprints.
- It provides a secure, typed IPC bridge between the web-based frontend and the native Rust backend, allowing performance-critical code (ONNX inference, GExiv2 metadata editing) to run in native threads.
- Tauri v2 introduces a refined plugin ecosystem and stable configuration structures (e.g., v2 capabilities configuration) which improve overall security and developer experience compared to v1.

## Consequences

**Positive:**
- Extremely lightweight distribution binaries and minimal RAM usage.
- High-performance backend execution in Rust.
- Seamless compatibility with web frontend frameworks and design styling.

**Negative / trade-offs:**
- Requires developers to maintain development environments and dependencies across both the Node.js frontend toolchain and the Rust backend compiler toolchain.
- Webview consistency depends on the host operating system's installed engine (e.g., WebKit on macOS/Linux, WebView2 on Windows), which can introduce rendering variations.

## Evidence in the codebase
- [package.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/package.json#L22-L23): Dependencies on `@tauri-apps/api` and `@tauri-apps/plugin-opener`.
- [src-tauri/tauri.conf.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/tauri.conf.json): Tauri system config.
- [src-tauri/Cargo.toml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/Cargo.toml#L22): Cargo dependency on `tauri`.

---

# ADR-002: Angular v20 Frontend Framework Selection

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Frontend  

## Context and problem
To build a clean, desktop-grade interface for browsing folders and managing image keywords, the developer needs a frontend framework that provides structured state management, reusable components, and high development speed.

## Considered options
- **Angular v20** ← selected
- React
- Vue / Svelte

## Decision
**Angular v20** was selected because:
- The developer is most comfortable with Angular, having used it extensively in recent projects, which maximizes productivity.
- Angular's built-in support for TypeScript, Dependency Injection, and reactive APIs provides a solid framework out-of-the-box, removing the need to configure multiple third-party libraries.
- The use of modern Angular features (like standalone components and Signals) makes the application state easier to manage and less boiler-plated.

## Consequences

**Positive:**
- Rapid development and high familiarity for the sole developer.
- Structured component design with modular architecture.
- Clean binding syntax and reactive state management (e.g., using `signal` for locale configuration).

**Negative / trade-offs:**
- Angular has a slightly larger initial bundle size and compilation overhead compared to Svelte or minimal React builds.
- Angular is less commonly documented in general Tauri starter templates, requiring custom dev/build command setups.

## Evidence in the codebase
- [package.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/package.json#L13-L18): Angular core dependencies versioned at `^20.1.4`.
- [angular.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/angular.json): Angular build configurations.
- [src/app/app.component.ts](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src/app/app.component.ts): Main standalone component bootstrapping the application.

---

# ADR-003: Pure File Metadata Persistence (XMP/IPTC)

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Data  

## Context and problem
The application needs to catalog images and persist user-written or AI-generated tag keywords. However, the files may be moved, renamed, or modified by external software (such as Lightroom or Photoshop) outside of this application. Maintaining a local database would introduce synchronicity issues (broken paths, stale tags) and add data synchronization complexity.

## Considered options
- **Direct file metadata writes (XMP/IPTC)** ← selected
- Local SQL Database (e.g., SQLite via Tauri SQL Plugin)
- Flat file cache (JSON/YAML) mapping file paths to tags

## Decision
**Direct file metadata writes (XMP/IPTC)** was chosen because:
- It ensures that the metadata is directly embedded within the image files, making the tags completely portable. If the images are moved, renamed, or loaded into other photo management tools, their tags persist automatically.
- It avoids the complexity of writing sync algorithms, managing database schemas, or dealing with database migration tracks.
- The image itself acts as the single source of truth.

## Consequences

**Positive:**
- Zero database synchronization bugs; files can be moved freely outside the app without losing data.
- The application remains lightweight and stateless.
- Universal compatibility with standard photography tagging ecosystems (Lightroom, Adobe Bridge, digiKam, etc.).

**Negative / trade-offs:**
- Performance penalty when executing folder-wide search or filters, as the app must read metadata header sectors of every image file from disk on-the-fly rather than running indexed queries.
- Cannot easily perform offline querying or maintain virtual tag collections that span unmounted drives.

## Evidence in the codebase
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L580-L610): `write_image_tags` writes keywords directly to the IPTC (`Iptc.Application2.Keywords`) and XMP (`Xmp.dc.subject`) fields using `rexiv2` and saves the file directly.

---

# ADR-004: Multi-Model Tagging Architecture with ViT and DETR

**Status**: Superseded (by ADR-005)  
**Estimated date**: 2026-05-30  
**Area**: Architecture  

## Context and problem
In the early prototyping phase, the system aimed to provide two distinct forms of image classification: generating a general category/tag for the image as a whole, and describing/locating specific physical objects within the image frame.

## Considered options
- **Multi-Model Pipeline (ViT for classification + DETR for object detection)** ← selected
- Single classification model
- Single object detection model

## Decision
**Multi-Model Pipeline** was selected initially. The developer exported Google's ViT (Vision Transformer) to predict general tags and Facebook's DETR (Detection Transformer) to extract object boundaries and labels, planning to load both models concurrently to provide detailed image analysis.

## Consequences

**Positive:**
- Allowed both general semantic categorization and localized object mapping.

**Negative / trade-offs:**
- Massive memory overhead from loading two separate deep learning models concurrently in a desktop application.
- Complex orchestration and post-processing logic required on the frontend to combine distinct outputs.
- High inference latency on consumer CPUs.

## Evidence in the codebase
- [scripts/export_onnx.py](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/scripts/export_onnx.py): Scripts to export ViT (`google/vit-base-patch16-224`) and DETR (`facebook/detr-resnet-50`) models to ONNX.
- [scripts/export_labels.py](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/scripts/export_labels.py): Label extraction script for ViT and DETR.

---

# ADR-005: Consolidated Image Tagging via a Single ConvNeXt-Base Model

**Status**: Accepted (inferred)  
**Estimated date**: 2026-06-29  
**Area**: Architecture  

## Context and problem
The multi-model setup (ADR-004) proved too heavy for client-side execution, and managing distinct tag sets was overly complex. The developer required a unified tagging model that could provide a wider library of descriptive tags (capturing both general contexts and specific objects) in a single model execution.

## Considered options
- **Consolidated ConvNeXt-Base Model (ImageNet-22k)** ← selected
- Retaining the ViT + DETR pipeline
- Switching to a smaller MobileNet/SqueezeNet classifier

## Decision
**Consolidated ConvNeXt-Base Model (ImageNet-22k)** was selected to supersede the multi-model architecture. By utilizing Meta's ConvNeXt-Base pre-trained on ImageNet-22k (which features over 21,800 classes), the application can detect thousands of fine-grained categories and physical objects in a single inference pass.

## Consequences

**Positive:**
- Dramatically simplified backend logic, as only one ONNX session needs to be loaded and executed.
- Hugely expanded tag vocabulary (21k+ classes vs 1k in typical ImageNet-1k models).
- Unified output structure simplifies frontend rendering.

**Negative / trade-offs:**
- The ConvNeXt-Base model file is large (~350MB), resulting in high initial download time and packaging weight.
- Memory consumption remains high during inference (~500MB+ for the ONNX Runtime session).

## Evidence in the codebase
- [scripts/download_model.py](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/scripts/download_model.py): Downloads `Xenova/convnext-base-224-22k` ONNX model and extracts its labels.
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L143-L171): Normalizes images and parses outputs specifically for the ConvNeXt layout.
- [src-tauri/tauri.conf.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/tauri.conf.json#L47-L48): Bundles `convnext.onnx` and `convnext_labels.json` as app resources.

---

# ADR-006: Local Inference using ONNX Runtime (ort)

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Architecture  

## Context and problem
The application must execute machine learning models locally on the user's desktop without calling external cloud APIs. This preserves privacy and ensures the app works offline. The execution framework must be highly performant and work consistently across Windows, macOS, and Linux platforms.

## Considered options
- **ONNX Runtime via `ort` Rust crate** ← selected
- `tract` (Pure Rust inference engine)
- PyTorch C++ (`libtorch` / `tch-rs` crate)

## Decision
**ONNX Runtime (`ort` crate)** was selected because:
- It supports standard ONNX format, making it easy to convert Hugging Face models using Python scripts.
- It provides native performance optimizations and can utilize GPU execution providers (CoreML on macOS, DirectML on Windows, CUDA on Linux).
- It is reliable and mature, capable of handling complex models like ConvNeXt.

## Consequences

**Positive:**
- Fast, local model inference.
- Cross-platform hardware acceleration support.
- Standardized model format (ONNX) enables easy upgrades of the underlying model.

**Negative / trade-offs:**
- Adds heavy native binary dependencies. ONNX Runtime dynamic libraries (`onnxruntime.dll`/`.so`/`.dylib`) must be downloaded or compiled during build, increasing CI compilation complexity.
- Pure Rust alternative `tract` was ruled out due to potential lack of operator support for modern ConvNeXt architectures.

## Evidence in the codebase
- [src-tauri/Cargo.toml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/Cargo.toml#L26): Dependency `ort = "2.0.0-rc.12"`.
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L378-L394): Setting up `ort::value::Tensor` and running inference on the ONNX session.

---

# ADR-007: Image Metadata Manipulation via rexiv2

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Data  

## Context and problem
Reading and writing metadata (EXIF details, IPTC keywords, XMP subjects) across various image formats (JPEG, PNG, TIFF, DNG raw files) requires a robust and full-featured parser. Many pure-Rust libraries are read-only or fail to support writing tags back to raw file types like DNG.

## Considered options
- **`rexiv2` (Rust wrapper for GExiv2/Exiv2)** ← selected
- `kamadak-exif` (pure Rust)
- Spawning external command-line utilities (like `exiftool`)

## Decision
**`rexiv2`** was selected because it provides mature, stable write support for both IPTC and XMP namespaces across a wide range of formats, including RAW camera files (DNG/TIFF).

## Consequences

**Positive:**
- Robust metadata writing capabilities that save changes directly back to image headers.
- Excellent file format support (JPEG, PNG, DNG, TIFF).

**Negative / trade-offs:**
- `rexiv2` is a wrapper around `gexiv2` (a GObject wrapper around the C++ `exiv2` library). It requires C libraries and development headers (`libgexiv2-dev`, `libglib2.0-dev`) to be installed on the host system.
- Greatly increases build complexity on Windows (requiring `vcpkg` to build `exiv2`) and macOS (requiring custom pkg-config overrides for Homebrew paths in GitHub Actions).

## Evidence in the codebase
- [src-tauri/Cargo.toml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/Cargo.toml#L28): Dependency `rexiv2 = "0.10.0"`.
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L342-L370): Reading keywords and EXIF data.
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L580-L610): Writing keywords to IPTC and XMP tags.
- [.github/workflows/publish.yml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/.github/workflows/publish.yml#L100-L108): vcpkg static compilation commands for Windows.
- [.github/workflows/publish.yml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/.github/workflows/publish.yml#L122-L162): Custom PKG_CONFIG overrides for macOS.

---

# ADR-008: Dynamic Client-Side Concurrency Throttling for Thumbnail Generation

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Frontend  

## Context and problem
When a user navigates to a folder containing dozens of RAW or non-browser-supported image files (like DNG/TIFF), the gallery view triggers simultaneous thumbnail decode requests. Decoding RAW images is resource-intensive. Running many concurrent decodes on the Rust backend would exhaust CPU threads, cause high memory spikes, and drop UI frame rates.

## Considered options
- **Client-side semaphore / queue in Angular** ← selected
- Rust-side thread pool or task queue
- Unthrottled parallel execution

## Decision
**Client-side semaphore / queue in Angular** was implemented. The frontend `TaggerService` limits concurrent active thumbnail requests to `4` using a queue array and active counter. The frontend controls this because it is the boundary that requests images depending on the viewport.

## Consequences

**Positive:**
- Prevents backend thread starvation and keeps memory usage stable.
- Keeps the UI responsive during rapid folder browsing.
- Leverages browser-side caching and avoids redundant IPC roundtrips.

**Negative / trade-offs:**
- Keeps concurrency throttling logic on the client rather than centralizing it as a backend resource constraint.

## Evidence in the codebase
- [src/app/services/tagger.service.ts](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src/app/services/tagger.service.ts#L15-L47): Implementation of `thumbActive`, `thumbMaxConcurrent`, `thumbQueue`, `acquireThumbSlot()`, and `releaseThumbSlot()`.

---

# ADR-009: Dockerized Linux Build Environment for Cross-Compilation

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Infrastructure  

## Context and problem
Building the Linux version of the Tauri application requires installing GTK, GLib, and GExiv2 developer dependencies. Setting these up on non-Linux host machines (like Windows or macOS) is extremely difficult, and developers on Linux might run different distributions, leading to build discrepancies.

## Considered options
- **Docker-based compilation container** ← selected
- Local environment installation scripts
- Relying solely on CI (GitHub Actions) for Linux builds

## Decision
**Docker-based compilation container** was chosen. The project provides `Dockerfile.build` which sets up Ubuntu 24.04, Node, pnpm, Rust, and all required library headers, and a `docker-build.sh` script to run the build with cached volumes.

## Consequences

**Positive:**
- Predictable, isolated, and repeatable builds.
- Developers on Windows and macOS can build the Linux production package locally.
- Leverages named Docker volumes to cache `node_modules` and Rust target files for speed.

**Negative / trade-offs:**
- Developers must have Docker installed.
- Building AppImages inside the container requires running Docker in `--privileged` mode to enable FUSE.

## Evidence in the codebase
- [Dockerfile.build](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/Dockerfile.build): Setup of build container.
- [docker-build.sh](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/docker-build.sh): Execution script that mounts workspace and caches.

---

# ADR-010: Lazy Loading of ONNX Model Session

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Architecture  

## Context and problem
The ConvNeXt ONNX model is large (~350MB). Initializing the ONNX Runtime session and parsing this file takes several seconds and allocates hundreds of megabytes of RAM. Performing this at application startup would make the window freeze or show a blank screen for a long time, leading to a poor user experience.

## Considered options
- **Lazy loading on first AI action** ← selected
- Blocking initialization on startup
- Asynchronous background initialization on startup

## Decision
**Lazy loading on first AI action** was implemented. The `TaggerState` is initialized with `None` session. When a user first clicks on an image to view details (triggering AI tag suggestions) or starts a batch tagging process, `load_model_if_needed` is called to parse and cache the ONNX session.

## Consequences

**Positive:**
- Instantaneous initial app loading.
- Users who only want to review existing metadata or browse folders do not incur model load latency or memory penalties.

**Negative / trade-offs:**
- The first time an image is selected or auto-tagging is run, there is a delay of 3–5 seconds while the model loads into memory.

## Evidence in the codebase
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L90-L141): `load_model_if_needed` loads model weights and labels on demand and stores them in a thread-safe mutex.

---

# ADR-011: Wildcard File Access Scope via Tauri Asset Protocol

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Security  

## Context and problem
The application is designed to scan arbitrary user-chosen folders and drives on the host machine to catalog photos. The Angular frontend needs to display full-size images or thumbnails from these external paths. By default, Tauri blocks frontends from loading arbitrary assets from the local disk for security reasons.

## Considered options
- **Wildcard scope allocation in asset protocol** ← selected
- Dynamically scoping path permissions on folder select
- Base64 encoding all images on the backend for frontend transfer

## Decision
**Wildcard scope allocation in asset protocol** was chosen. The `tauri.conf.json` configures the asset protocol with a scope of `["**/*"]`, allowing the frontend to load files from any location on the system using `convertFileSrc`.

## Consequences

**Positive:**
- Simple, high-performance local image loading via standard HTTP protocol bindings without IPC transfer overhead.
- Frontend can freely navigate any system folder.

**Negative / trade-offs:**
- Security trade-off: A vulnerability in the frontend (e.g. XSS) could allow malicious code to read any file on the user's filesystem.

## Evidence in the codebase
- [src-tauri/tauri.conf.json](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/tauri.conf.json#L20-L29): Configures `assetProtocol` with `allow: ["**/*"]`.

---

# ADR-012: Postponed Automated Testing Implementation

**Status**: Questioned  
**Estimated date**: 2026-06-29  
**Area**: Testing  

## Context and problem
Setting up testing frameworks for an app that interacts with heavy machine learning weights (~350MB) and links against native C dependencies (`gexiv2`) is complex. Mocking or loading these models in tests is labor-intensive, and testing during initial prototyping phases can slow down development.

## Considered options
- **Omit automated tests during initial phases** ← selected
- Build tests with mocked model inference and metadata headers
- Run tests using dummy ONNX weights in CI

## Decision
**Omit automated tests** was selected. The codebase currently contains no Rust `#[test]` modules and no Angular `.spec.ts` files. The CI pipeline runs compilation checks (`cargo clippy`, linting, syntax checking on python scripts) but does not verify runtime correctness via tests. Testing has been postponed for future development phases.

## Consequences

**Positive:**
- Fast setup and release iterations for the developer.

**Negative / trade-offs:**
- No automated validation of metadata updates (e.g., verifying XMP/IPTC writing logic is non-destructive).
- Increased risk of regressions during upgrades of Tauri, Angular, or the `ort` library.

## Evidence in the codebase
- [src-tauri/src](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src): Absence of tests or testing files.
- [src/app](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src/app): Absence of `*.spec.ts` files.
- [.github/workflows/ci.yml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/.github/workflows/ci.yml#L95-L96): `cargo test` is executed in CI, but it runs an empty suite.

---

# ADR-013: Raw String IPC Error Transmission

**Status**: Questioned  
**Estimated date**: 2026-06-29  
**Area**: API  

## Context and problem
To propagate errors from the native Rust backend to the Angular frontend (such as "folder not found", "corrupted image file", or "onnx runtime failed"), the bridge needs a contract. To keep development simple during prototyping, the commands return raw error strings.

## Considered options
- **String-based error propagation** ← selected
- Structured JSON error objects (e.g., with error codes, call-stacks, and translations)
- Standardized Rust enum errors mapped to TypeScript types

## Decision
**String-based error propagation** was chosen. Tauri commands return `Result<T, String>`, translating all errors via `map_err(|e| e.to_string())` or custom format macros, which are then shown directly in UI alerts.

## Consequences

**Positive:**
- Minimal boilerplate; very easy to write and return errors in backend commands.

**Negative / trade-offs:**
- The frontend cannot programmatically inspect error classes. It cannot differentiate a "missing file" from a "permission denied" error to show tailored advice.
- Translating errors is difficult because strings are generated directly in the Rust backend rather than using translation keys in the frontend's `I18nService`.

## Evidence in the codebase
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L72-L76): `map_err(|e| format!("Invalid path '{}': {}", path_str, e))`
- [src-tauri/src/tagger.rs](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/src-tauri/src/tagger.rs#L232-L236): Returns raw `String` errors.

---

# ADR-014: Unified Style Enforcement with Native Formatters and Linters

**Status**: Accepted (inferred)  
**Estimated date**: 2026-05-30  
**Area**: Conventions  

## Context and problem
The repository spans three distinct programming ecosystems: TypeScript/HTML/CSS for Angular, Rust for the Tauri backend, and Python for the model packaging tools. Maintaining clean and consistently formatted code across all three languages is necessary to prevent formatting diff-noise in pull requests.

## Considered options
- **Enforcing native linting/formatting tools via CI** ← selected
- Sticking to loose manual styling
- Using a single multi-language tool (like Prettier) for all files

## Decision
**Enforcing native linting/formatting tools via CI** was chosen. The project uses standard tools native to each ecosystem: `black` and `flake8` for Python code, `cargo fmt` and `clippy` for Rust, and TypeScript/Angular rules for the frontend, with automated enforcement in GitHub Actions quality checks.

## Consequences

**Positive:**
- Code retains standard styling conventions of its respective language community.
- Easy integration with IDE formatters.
- Automatically prevents formatting regressions.

**Negative / trade-offs:**
- Developers must have multiple formatters (black, cargo-fmt) configured locally.

## Evidence in the codebase
- [.github/workflows/ci.yml](file:///b:/Proyectos/GitHub/Inventory/ImageLabelIA/.github/workflows/ci.yml): Runs `cargo fmt --check`, `cargo clippy`, `black --check`, and `flake8` on every commit.
