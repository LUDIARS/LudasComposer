import type { Document, RenderedDocument, FileTreeNode } from '../types';

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

export async function getFileTree(): Promise<FileTreeNode> {
  return invoke<FileTreeNode>('get_file_tree');
}

export async function readDocument(path: string): Promise<Document> {
  return invoke<Document>('read_document', { path });
}

export async function renderDocument(path: string): Promise<RenderedDocument> {
  return invoke<RenderedDocument>('render_document', { path });
}

export async function renderMarkdown(markdown: string): Promise<RenderedDocument> {
  return invoke<RenderedDocument>('render_markdown', { markdown });
}

export async function getCategories(): Promise<string[]> {
  return invoke<string[]>('get_categories');
}

export async function searchDocuments(query: string): Promise<Document[]> {
  return invoke<Document[]>('search_documents', { query });
}

export async function findDocForScript(scriptName: string): Promise<string | null> {
  return invoke<string | null>('find_doc_for_script', { scriptName });
}
