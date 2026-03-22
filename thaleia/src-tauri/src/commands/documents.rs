use crate::models::document::{Document, RenderedDocument};
use crate::models::file_tree::FileTreeNode;
use crate::services::document_browser::DocumentBrowser;
use crate::services::renderer::MarkdownRenderer;
use std::sync::Mutex;

pub struct ThaleiaState(pub Mutex<DocumentBrowser>);

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_file_tree(state: tauri::State<'_, ThaleiaState>) -> Result<FileTreeNode, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    Ok(browser.build_file_tree())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn read_document(
    state: tauri::State<'_, ThaleiaState>,
    path: String,
) -> Result<Document, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    browser
        .read_document(&path)
        .ok_or_else(|| format!("Document not found: {}", path))
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn render_document(
    state: tauri::State<'_, ThaleiaState>,
    path: String,
) -> Result<RenderedDocument, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    let doc = browser
        .read_document(&path)
        .ok_or_else(|| format!("Document not found: {}", path))?;
    Ok(MarkdownRenderer::render(
        &doc.content,
        &doc.path,
        doc.category.as_deref(),
    ))
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn render_markdown(markdown: String) -> Result<RenderedDocument, String> {
    Ok(MarkdownRenderer::render(&markdown, "inline", None))
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn get_categories(state: tauri::State<'_, ThaleiaState>) -> Result<Vec<String>, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    Ok(browser.get_categories())
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn search_documents(
    state: tauri::State<'_, ThaleiaState>,
    query: String,
) -> Result<Vec<Document>, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    Ok(browser.search_documents(&query))
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub fn find_doc_for_script(
    state: tauri::State<'_, ThaleiaState>,
    script_name: String,
) -> Result<Option<String>, String> {
    let browser = state.0.lock().map_err(|e| e.to_string())?;
    Ok(browser.find_doc_for_script(&script_name).map(|s| s.to_string()))
}
