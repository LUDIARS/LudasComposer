export interface Document {
  path: string;
  title: string;
  content: string;
  category: string | null;
}

export interface RenderedDocument {
  path: string;
  title: string;
  html: string;
  toc: TocEntry[];
  category: string | null;
}

export interface TocEntry {
  level: number;
  title: string;
  anchor: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  is_directory: boolean;
  children: FileTreeNode[];
}
