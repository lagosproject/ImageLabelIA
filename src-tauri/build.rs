const DLLS: &[&str] = &[
    "libgexiv2-2.dll",
    "libexiv2-28.dll",
    "libgcc_s_seh-1.dll",
    "libgobject-2.0-0.dll",
    "libglib-2.0-0.dll",
    "libwinpthread-1.dll",
    "libbrotlidec.dll",
    "libcurl-4.dll",
    "libgio-2.0-0.dll",
    "libiconv-2.dll",
    "libINIReader-0.dll",
    "libstdc++-6.dll",
    "libexpat-1.dll",
    "libintl-8.dll",
    "libbrotlicommon.dll",
    "libidn2-0.dll",
    "libnghttp2-14.dll",
    "libnghttp3-9.dll",
    "libngtcp2-16.dll",
    "libngtcp2_crypto_ossl-0.dll",
    "libpsl-5.dll",
    "libffi-8.dll",
    "libssh2-1.dll",
    "libzstd.dll",
    "libssl-3-x64.dll",
    "zlib1.dll",
    "libinih-0.dll",
    "libunistring-5.dll",
    "libgmodule-2.0-0.dll",
    "libpcre2-8-0.dll",
    "libcrypto-3-x64.dll",
];

fn find_exiv2_dll_dir() -> Option<std::path::PathBuf> {
    if let Ok(path_var) = std::env::var("PATH") {
        for path in std::env::split_paths(&path_var) {
            let dll_path = path.join("libexiv2-28.dll");
            if dll_path.is_file() {
                return Some(path);
            }
        }
    }
    // Fallback default
    let fallback = std::path::PathBuf::from(r"C:\msys64\ucrt64\bin");
    if fallback.join("libexiv2-28.dll").is_file() {
        return Some(fallback);
    }
    None
}

fn copy_dlls() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    if let Some(src_dir) = find_exiv2_dll_dir() {
        println!("cargo:warning=Found MSYS2 DLL source directory: {}", src_dir.display());
        
        // 1. Determine Cargo target profile directory (e.g. target/debug or target/release)
        let out_dir = std::env::var("OUT_DIR").unwrap();
        let mut target_dir = std::path::PathBuf::from(out_dir);
        // Pop: out -> package-name-hash -> build -> profile
        target_dir.pop();
        target_dir.pop();
        target_dir.pop();
        
        // 2. Create the target resources/dlls folder in the crate root
        let resources_dll_dir = std::path::PathBuf::from("resources/dlls");
        let _ = std::fs::create_dir_all(&resources_dll_dir);
        
        // 3. Copy each DLL
        for dll in DLLS {
            let src_file = src_dir.join(dll);
            if src_file.exists() {
                // Copy to profile target directory (for cargo run / tauri dev)
                let dest_profile = target_dir.join(dll);
                if let Err(e) = std::fs::copy(&src_file, &dest_profile) {
                    println!("cargo:warning=Failed to copy {} to target profile: {}", dll, e);
                }
                
                // Copy to resources/dlls (for tauri build packaging)
                let dest_resource = resources_dll_dir.join(dll);
                if let Err(e) = std::fs::copy(&src_file, &dest_resource) {
                    println!("cargo:warning=Failed to copy {} to resources: {}", dll, e);
                }
            } else {
                println!("cargo:warning=DLL not found in MSYS2 source directory: {}", dll);
            }
        }
    } else {
        println!("cargo:warning=Could not locate MSYS2 UCRT64 bin directory containing libexiv2-28.dll");
    }
}

fn main() {
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

    // Copy DLLs on Windows
    copy_dlls();

    tauri_build::build()
}
