import type { ModuleDefinition, ComponentCategory, PortDefinition } from './types.js';

/**
 * Arsモジュール定義のMarkdownをパースする
 * plan.md セクション8 / Rust側 module_parser.rs と同等のロジック
 */
export function parseModuleMarkdown(content: string, sourcePath?: string): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [];
  const sections = splitByModuleHeaders(content);

  for (const [name, sectionContent] of sections) {
    const module = parseSingleModule(name, sectionContent, sourcePath);
    if (module) modules.push(module);
  }

  return modules;
}

function splitByModuleHeaders(content: string): [string, string][] {
  const result: [string, string][] = [];
  const headerRegex = /^###\s+(.+?)(?:\s+モジュール定義)?$/gm;
  const matches: { name: string; index: number; end: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(content)) !== null) {
    matches.push({
      name: match[1].trim(),
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    result.push([matches[i].name, content.slice(start, end)]);
  }

  return result;
}

function parseSingleModule(name: string, content: string, sourcePath?: string): ModuleDefinition | null {
  const summary = extractSection(content, '概要') ?? '';
  const categoryStr = extractSection(content, 'カテゴリ') ?? '';
  const category = parseCategory(categoryStr);
  if (!category) return null;

  const domain = extractSection(content, '所属ドメイン') ?? '';
  const requiredData = extractListItems(content, '必要なデータ');
  const variables = parseVariables(content);
  const dependencies = extractListItems(content, '依存');
  const tasks = parseTasks(content);
  const tests = extractListItems(content, 'テスト').map(desc => ({ description: desc }));

  return {
    id: crypto.randomUUID(),
    name,
    summary,
    category,
    domain,
    required_data: requiredData,
    variables,
    dependencies,
    tasks,
    tests,
    source_path: sourcePath,
  };
}

function parseCategory(s: string): ComponentCategory | null {
  const trimmed = s.trim();
  if (['UI', 'Logic', 'System', 'GameObject'].includes(trimmed)) {
    return trimmed as ComponentCategory;
  }
  return null;
}

function extractSection(content: string, header: string): string | null {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^####\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n####|\\n###|$)`, 'm');
  const match = regex.exec(content);
  if (!match) return null;
  const text = match[1].trim();
  return text || null;
}

function extractListItems(content: string, header: string): string[] {
  const section = extractSection(content, header);
  if (!section) return [];

  return section
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => line.slice(2).trim());
}

function parseVariables(content: string): ModuleDefinition['variables'] {
  const items = extractListItems(content, '変数');
  return items.map(item => {
    const parts = item.split(':');
    if (parts.length >= 2) {
      const namePart = parts[0].trim();
      const desc = parts.slice(1).join(':').trim();
      const typeMatch = namePart.match(/^(.+?)\s*\((.+?)\)$/);
      if (typeMatch) {
        return { name: typeMatch[1].trim(), type: typeMatch[2].trim(), description: desc };
      }
      return { name: namePart, type: 'unknown', description: desc };
    }
    return { name: item, type: 'unknown' };
  });
}

function parseTasks(content: string): ModuleDefinition['tasks'] {
  const taskRegex = /^#####\s+タスク\s*\n([\s\S]*?)(?=\n####|\n###|\n#####|$)/m;
  const taskMatch = taskRegex.exec(content);
  if (!taskMatch) return [];

  const inputs = parsePortSection(content, '入力');
  const outputs = parsePortSection(content, '出力');

  return taskMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => {
      const text = line.slice(2).trim();
      const colonIdx = text.indexOf(':');
      if (colonIdx >= 0) {
        return {
          name: text.slice(0, colonIdx).trim(),
          description: text.slice(colonIdx + 1).trim(),
          inputs,
          outputs,
        };
      }
      return { name: text, description: '', inputs, outputs };
    });
}

function parsePortSection(content: string, header: string): PortDefinition[] {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^#####\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n#####|\\n####|\\n###|$)`, 'm');
  const match = regex.exec(content);
  if (!match) return [];

  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => ({
      name: line.slice(2).trim(),
      type: 'any',
    }));
}
