fn main() {
    // The macOS `gexiv2_metadata_free` shim in lib.rs calls `g_object_unref`,
    // which lives in libgobject-2.0. gexiv2 lists gobject only under
    // Requires.private, so pkg-config omits it from the dynamic link line and
    // the symbol goes unresolved. Link gobject-2.0 explicitly on macOS.
    //
    // Gate on the *target* OS (CARGO_CFG_TARGET_OS) rather than a cfg! attribute:
    // a build script is compiled for the host, so #[cfg(target_os = ...)] here
    // would reflect the host, not what we are building for.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        match pkg_config::Config::new().probe("gobject-2.0") {
            Ok(lib) => {
                for path in lib.link_paths {
                    println!("cargo:rustc-link-search=native={}", path.display());
                }
            }
            Err(e) => {
                println!("cargo:warning=pkg-config could not locate gobject-2.0: {e}");
            }
        }
        println!("cargo:rustc-link-lib=dylib=gobject-2.0");
    }

    tauri_build::build()
}
