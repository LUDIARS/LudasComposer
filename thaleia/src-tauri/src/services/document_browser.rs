use crate::models::document::Document;
use crate::models::file_tree::FileTreeNode;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct DocumentBrowser {
    root_path: PathBuf,
    script_to_doc: HashMap<String, String>,
}

impl DocumentBrowser {
    pub fn new(root_path: PathBuf) -> Self {
        let mut browser = Self {
            root_path,
            script_to_doc: HashMap::new(),
        };
        browser.build_script_mapping();
        browser
    }

    pub fn build_file_tree(&self) -> FileTreeNode {
        let root_name = self
            .root_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("docs")
            .to_string();

        let mut root = FileTreeNode::new_directory(
            root_name,
            self.root_path.to_string_lossy().to_string(),
        );

        self.build_tree_recursive(&self.root_path, &mut root);
        root.sort_children();
        root
    }

    fn build_tree_recursive(&self, dir: &Path, parent: &mut FileTreeNode) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry
                .file_name()
                .to_string_lossy()
                .to_string();

            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                let mut node =
                    FileTreeNode::new_directory(name, path.to_string_lossy().to_string());
                self.build_tree_recursive(&path, &mut node);
                if !node.children.is_empty() {
                    parent.add_child(node);
                }
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                parent.add_child(FileTreeNode::new_file(
                    name,
                    path.to_string_lossy().to_string(),
                ));
            }
        }
    }

    pub fn read_document(&self, path: &str) -> Option<Document> {
        let content = std::fs::read_to_string(path).ok()?;

        let title = content
            .lines()
            .find(|line| line.starts_with("# "))
            .map(|line| line.trim_start_matches("# ").to_string())
            .unwrap_or_else(|| {
                Path::new(path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Untitled")
                    .to_string()
            });

        let category = Path::new(path)
            .parent()
            .and_then(|p| {
                p.strip_prefix(&self.root_path)
                    .ok()
                    .and_then(|rel| rel.components().next())
                    .and_then(|c| Some(c.as_os_str().to_string_lossy().to_string()))
            });

        Some(Document {
            path: path.to_string(),
            title,
            content,
            category,
        })
    }

    pub fn find_doc_for_script(&self, script_name: &str) -> Option<&str> {
        self.script_to_doc.get(script_name).map(|s| s.as_str())
    }

    pub fn get_categories(&self) -> Vec<String> {
        let mut categories = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.root_path) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.starts_with('.') {
                        categories.push(name);
                    }
                }
            }
        }
        categories.sort();
        categories
    }

    pub fn search_documents(&self, query: &str) -> Vec<Document> {
        let query_lower = query.to_lowercase();
        let mut results = Vec::new();

        for entry in WalkDir::new(&self.root_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            if let Some(doc) = self.read_document(&path.to_string_lossy()) {
                if doc.title.to_lowercase().contains(&query_lower)
                    || doc.content.to_lowercase().contains(&query_lower)
                {
                    results.push(doc);
                }
            }
        }

        results
    }

    fn build_script_mapping(&mut self) {
        for entry in WalkDir::new(&self.root_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            let doc_name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            if !doc_name.is_empty() {
                self.script_to_doc
                    .insert(doc_name, path.to_string_lossy().to_string());
            }
        }
    }
}
