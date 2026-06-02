// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
#[no_mangle]
pub unsafe extern "C" fn gexiv2_metadata_free(metadata: *mut std::ffi::c_void) {
    extern "C" {
        fn g_object_unref(object: *mut std::ffi::c_void);
    }
    g_object_unref(metadata);
}

fn main() {
    tauri_app_lib::run()
}
