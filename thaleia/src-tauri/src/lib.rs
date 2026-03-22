pub mod models;
pub mod services;

#[cfg(feature = "tauri-app")]
pub mod commands;

#[cfg(feature = "web-server")]
pub mod web_server;

#[cfg(feature = "tauri-app")]
pub fn run() {
    use commands::documents::ThaleiaState;
    use services::document_browser::DocumentBrowser;
    use std::sync::Mutex;

    let spec_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".ars")
        .join("spec");

    // Create spec directory if it doesn't exist
    let _ = std::fs::create_dir_all(&spec_dir);

    let browser = DocumentBrowser::new(spec_dir);

    tauri::Builder::default()
        .manage(ThaleiaState(Mutex::new(browser)))
        .invoke_handler(tauri::generate_handler![
            commands::documents::get_file_tree,
            commands::documents::read_document,
            commands::documents::render_document,
            commands::documents::render_markdown,
            commands::documents::get_categories,
            commands::documents::search_documents,
            commands::documents::find_doc_for_script,
        ])
        .run(tauri::generate_context!())
        .expect("error while running thaleia");
}
