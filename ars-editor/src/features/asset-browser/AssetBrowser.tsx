import { useCallback, useEffect, useState } from 'react';
import {
  importAssets,
  listImportedAssets,
  isTauri,
  type ImportedAsset,
} from '@/lib/backend';
import { getDefaultProjectPath } from '@/lib/tauri-commands';

/**
 * 最小限のアセットブラウザ (P5)。
 *
 * - Tauri ウィンドウへのファイル D&D を listen し、ars_asset_importer 経由で
 *   `data/<id>/` に Tier 1 成果物を生成する
 * - インポート済みアセットを meta.toml から再構成して一覧表示する
 *
 * UI は最小限のリスト表示のみ。3D プレビュー / サムネ表示等は後続フェーズで
 * Pictor 連携と合わせて拡充する。
 */
export function AssetBrowser() {
  const [projectDir, setProjectDir] = useState<string>('');
  const [assets, setAssets] = useState<ImportedAsset[]>([]);
  const [importing, setImporting] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultProjectPath().then((dir) => {
      if (!cancelled) {
        setProjectDir(dir);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!projectDir) return;
    try {
      const list = await listImportedAssets(projectDir);
      setAssets(list);
    } catch (e) {
      setError(String(e));
    }
  }, [projectDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tauri webview drag-drop event は OS から受け取った絶対パスをそのまま渡せる。
  // ブラウザ版は File オブジェクト経由になるためパスが取れず、現状未対応 (P6 で multipart)。
  useEffect(() => {
    if (!isTauri() || !projectDir) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      const webview = getCurrentWebview();
      const handle = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setDropHover(true);
        } else if (event.payload.type === 'leave') {
          setDropHover(false);
        } else if (event.payload.type === 'drop') {
          setDropHover(false);
          const paths = event.payload.paths.filter(
            (p) => p.toLowerCase().endsWith('.glb') || p.toLowerCase().endsWith('.gltf'),
          );
          if (paths.length === 0) return;
          setImporting(true);
          setError(null);
          try {
            await importAssets(projectDir, paths);
            await refresh();
          } catch (e) {
            setError(String(e));
          } finally {
            setImporting(false);
          }
        }
      });
      unlisten = handle;
    })();
    return () => {
      unlisten?.();
    };
  }, [projectDir, refresh]);

  return (
    <div
      className="flex flex-col h-full p-4 gap-3"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        outline: dropHover ? '2px dashed var(--accent)' : 'none',
      }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assets</h2>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {projectDir ? `data/ in ${projectDir}` : '(no project dir)'}
        </div>
      </header>

      {!isTauri() && (
        <div
          className="text-sm rounded p-3"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          ファイル D&D は現在デスクトップ版のみ対応です (Web は P6 multipart 予定)。
        </div>
      )}

      {importing && (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Importing...
        </div>
      )}
      {error && (
        <div className="text-sm" style={{ color: 'var(--danger, #f87171)' }}>
          {error}
        </div>
      )}

      <ul className="flex-1 overflow-auto rounded" style={{ background: 'var(--surface)' }}>
        {assets.length === 0 ? (
          <li className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            まだアセットがありません。`.glb` / `.gltf` ファイルをウィンドウにドラッグしてください。
          </li>
        ) : (
          assets.map((a) => (
            <li
              key={a.id}
              className="px-3 py-2 border-b text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                {a.id}
              </div>
              <div className="font-medium">{a.sourceName || a.meta.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {a.meta.triangle_count} tri / {a.meta.vertex_count} v
                {typeof a.meta.proxy_triangle_count === 'number' &&
                  ` · proxy ${a.meta.proxy_triangle_count}`}
                {typeof a.meta.hull_triangle_count === 'number' &&
                  ` · hull ${a.meta.hull_vertex_count}v ${a.meta.hull_triangle_count}t`}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
