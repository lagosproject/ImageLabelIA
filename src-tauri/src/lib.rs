mod tagger;

// gexiv2 0.16 (Homebrew) removed gexiv2_metadata_free; rexiv2 0.10 still calls it.
// This shim forwards to g_object_unref, which is the correct GObject cleanup path.
#[cfg(target_os = "macos")]
#[no_mangle]
pub unsafe extern "C" fn gexiv2_metadata_free(metadata: *mut std::ffi::c_void) {
    extern "C" {
        fn g_object_unref(object: *mut std::ffi::c_void);
    }
    g_object_unref(metadata);
}

use tagger::{
    get_folder_depth_analysis, get_image_ai_tags, get_image_data, get_image_metadata,
    get_images_in_folder, get_initial_folder, get_recursive_images, get_subfolders, get_thumbnail,
    save_last_folder, select_folder, write_image_tags, TaggerState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Manage the global state containing the loaded model session
        .manage(TaggerState::new())
        // Register commands to expose them to the Angular frontend
        .invoke_handler(tauri::generate_handler![
            get_subfolders,
            get_images_in_folder,
            get_thumbnail,
            get_image_data,
            get_image_metadata,
            get_image_ai_tags,
            write_image_tags,
            select_folder,
            get_folder_depth_analysis,
            get_recursive_images,
            get_initial_folder,
            save_last_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
