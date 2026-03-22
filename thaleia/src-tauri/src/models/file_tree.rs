use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Vec<FileTreeNode>,
}

impl FileTreeNode {
    pub fn new_file(name: String, path: String) -> Self {
        Self {
            name,
            path,
            is_directory: false,
            children: Vec::new(),
        }
    }

    pub fn new_directory(name: String, path: String) -> Self {
        Self {
            name,
            path,
            is_directory: true,
            children: Vec::new(),
        }
    }

    pub fn add_child(&mut self, child: FileTreeNode) {
        self.children.push(child);
    }

    pub fn sort_children(&mut self) {
        self.children.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        for child in &mut self.children {
            child.sort_children();
        }
    }
}
