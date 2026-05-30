mod tagger;

use tagger::{
    TaggerState,
    get_subfolders,
    get_images_in_folder,
    get_thumbnail,
    get_image_data,
    write_image_tags,
    select_folder,
    get_folder_depth_analysis,
    get_recursive_images,
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
            write_image_tags,
            select_folder,
            get_folder_depth_analysis,
            get_recursive_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
