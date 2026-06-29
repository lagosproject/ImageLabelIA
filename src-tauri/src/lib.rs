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

use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::Manager;

struct SimpleLogger {
    file_path: Mutex<Option<PathBuf>>,
}

impl log::Log for SimpleLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let timestamp = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
                Ok(d) => d.as_secs().to_string(),
                Err(_) => "0".to_string(),
            };
            let log_msg = format!(
                "[{}] [{}] {}\n",
                timestamp,
                record.level(),
                record.args()
            );

            // Print to stdout
            print!("{}", log_msg);

            // Print to file if configured
            if let Ok(guard) = self.file_path.lock() {
                if let Some(ref path) = *guard {
                    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                        let _ = file.write_all(log_msg.as_bytes());
                    }
                }
            }
        }
    }

    fn flush(&self) {}
}

static LOGGER: SimpleLogger = SimpleLogger {
    file_path: Mutex::new(None),
};

use tagger::{
    get_available_drives, get_folder_depth_analysis, get_image_ai_tags, get_image_data, get_image_metadata,
    get_images_in_folder, get_initial_folder, get_recursive_images, get_subfolders, get_thumbnail,
    save_last_folder, select_folder, write_image_tags, TaggerState,
};


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = log::set_logger(&LOGGER)
        .map(|()| log::set_max_level(log::LevelFilter::Info));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&app_data_dir);
                let log_file = app_data_dir.join("app.log");
                println!("Logs will be written to: {}", log_file.display());
                if let Ok(mut guard) = LOGGER.file_path.lock() {
                    *guard = Some(log_file);
                }
            }
            Ok(())
        })
        // Manage the global state containing the loaded model session
        .manage(TaggerState::new())
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
            save_last_folder,
            get_available_drives
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

