# Ars プロジェクト コードレビュー報告書

**レビュー日**: 2026-03-20
**対象ブランチ**: main (2fc200c)
**レビュー範囲**: 全ソースコード（TypeScript / Rust / CI/CD / Docker / インフラ）

---

## 目次

1. [総合評価](#1-総合評価)
2. [CRITICAL — 即時対応推奨](#2-critical--即時対応推奨)
3. [HIGH — 早期対応推奨](#3-high--早期対応推奨)
4. [MEDIUM — 計画的に対応](#4-medium--計画的に対応)
5. [LOW — 改善提案](#5-low--改善提案)
6. [ファイル別修正ポイント一覧](#6-ファイル別修正ポイント一覧)
7. [推奨アクションプラン](#7-推奨アクションプラン)

---

## 1. 総合評価

| カテゴリ | スコア | 概要 |
|---------|--------|------|
| アーキテクチャ | 9/10 | Feature-based構成、DDD、明確な責務分離 |
| 型安全性 | 8.5/10 | Strict TS + Rust serde。一部型定義の重複・不整合あり |
| 状態管理 | 7/10 | Zustand構成は良好。メモリ効率・エラー処理に課題 |
| セキュリティ | 6.5/10 | CI/CDにセキュリティスキャン未導入。シークレット管理要改善 |
| パフォーマンス | 7/10 | 深いスプレッド演算、JSON直列化の多用 |
| CI/CD | 5.5/10 | テスト・lint・脆弱性スキャンがパイプラインに未統合 |
| ドキュメント | 9/10 | plan.md が優秀。AI最適化セクションあり |

---

## 2. CRITICAL — 即時対応推奨

### 2.1 親子関係の循環参照未検出

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/projectStore.ts` (L260-292) |
| **問題** | `setActorParent` で循環依存のチェックがない |
| **影響** | ツリー走査の無限ループ、レンダリング停止、データ破損 |
| **再現** | Actor A → B → C の階層で C の親を A に設定 |

**修正案**:
```typescript
function hasCircularDependency(
  actors: Record<string, Actor>,
  actorId: string,
  newParentId: string
): boolean {
  let current = newParentId;
  while (current) {
    if (current === actorId) return true;
    current = actors[current]?.parentId ?? '';
  }
  return false;
}
```

---

### 2.2 Actor 削除時の孤立参照

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/projectStore.ts` (L182-210) |
| **問題** | `removeActor` で子 Actor の `parentId` が更新されない |
| **影響** | 削除済み親 Actor を参照する子が残り、操作時にエラー |

**修正案**:
```typescript
// removeActor 内で子の parentId をクリア
for (const childId of actor.children) {
  if (updatedActors[childId]) {
    updatedActors[childId] = {
      ...updatedActors[childId],
      parentId: null,
    };
  }
}
```

---

### 2.3 MCP Server の未キャッチ例外

| 項目 | 内容 |
|------|------|
| **ファイル** | `mcp-server/src/index.ts` (L109, 158-161, 181) |
| **問題** | `addActor`, `attachComponent`, `addConnection` が例外を throw するが、ツールハンドラに try-catch なし |
| **影響** | 無効な ID 指定でサーバークラッシュ |

**修正案**:
```typescript
// 全ツールハンドラを try-catch で囲む
server.tool('add_actor', '...', schema, async (params) => {
  try {
    const result = pm.addActor(project, params.scene_id, ...);
    // ...
  } catch (e) {
    return {
      content: [{ type: 'text', text: `エラー: ${e.message}` }],
      isError: true,
    };
  }
});
```

---

### 2.4 Web Server の unwrap() クラッシュ

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src-tauri/src/web_server.rs` (L38-39) |
| **問題** | `TcpListener::bind().await.unwrap()` — ポート競合でパニック |
| **影響** | サーバープロセスが即座にクラッシュ |

**修正案**:
```rust
let listener = tokio::net::TcpListener::bind(addr)
    .await
    .map_err(|e| format!("バインド失敗 {}: {}", addr, e))?;
```

---

## 3. HIGH — 早期対応推奨

### 3.1 Memento パターンのメモリ浪費

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/memento.ts` (L8-20) |
| **問題** | `ProjectMemento` が Project 全体を JSON.stringify で保存。MAX_HISTORY=50 で巨大メモリ消費 |
| **試算** | Actor 1000個 ≈ 100KB/snapshot × 50 = **約5MB** がメモリに常駐 |

**修正案**: 差分ベースの履歴管理（JSON Patch や Immer patches の導入）

---

### 3.2 authStore のサイレントエラー

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/authStore.ts` (L40-41, 49, 60, 70, 78) |
| **問題** | 全 catch ブロックがエラーを握り潰す。`error` state フィールドも存在しない |
| **影響** | API 失敗時にユーザーへのフィードバックがゼロ |

**修正案**:
```typescript
interface AuthState {
  // 追加
  error: string | null;
}

// catch 内
catch (e) {
  set({ error: e instanceof Error ? e.message : '不明なエラー', loading: false });
}
```

---

### 3.3 型定義の重複と不整合

| 項目 | 内容 |
|------|------|
| **ファイル群** | `src/types/domain.ts`, `ars-editor/src/types/domain.ts`, `mcp-server/src/types.ts`, `ars-codegen/src/types.ts` |
| **問題** | 同一ドメインモデルが4箇所に重複定義。Editor版は拡張フィールド（`sequences`, `subSceneId`, `prefabId`）を含む |

**不整合の詳細**:

| フィールド | src/types | ars-editor | mcp-server | ars-codegen |
|-----------|-----------|-----------|------------|-------------|
| `Actor.sequences` | ✗ | ✓ | ✗ | ✗ |
| `Actor.subSceneId` | ✗ | ✓ | ✗ | ✗ |
| `Actor.prefabId` | ✗ | ✓ | ✗ | ✗ |
| `Task.testCases` | ✗ | ✓ | ✗ | ✗ |
| `Component.sourceModuleId` | ✓ | ✗ | ✓ | ✓ |

**修正案**: `src/types/domain.ts` を Single Source of Truth とし、他パッケージは re-export。Editor固有の拡張は `extends` で明示的に定義。

---

### 3.4 CI/CD にテスト・Lint・セキュリティスキャンが未統合

| 項目 | 内容 |
|------|------|
| **ファイル** | `.github/workflows/*.yml` |
| **問題** | パイプラインに `npm test`, `cargo test`, ESLint, `npm audit`, `cargo audit`, コンテナスキャンが一切ない |
| **影響** | 品質ゲートなしで本番デプロイ可能 |

**修正案**: CI ワークフローに以下を追加
```yaml
jobs:
  quality:
    steps:
      - run: npm ci && npm run lint && npm run type-check
      - run: npm audit --audit-level=high
      - run: cargo test --all
      - run: cargo audit
```

---

### 3.5 historyMiddleware の再入ガード不備

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/historyMiddleware.ts` (L32-37, 45-50) |
| **問題** | `isRestoring` が boolean。ネストした undo/redo 呼び出しで正しくガードされない |
| **影響** | 履歴データの破損 |

**修正案**: boolean → カウンターに変更
```typescript
private restoringCount = 0;
isRestoring(): boolean { return this.restoringCount > 0; }
beginRestore() { this.restoringCount++; }
endRestore() { this.restoringCount--; }
```

---

### 3.6 プロジェクト切り替え時の履歴クリア漏れ

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/historyMiddleware.ts` |
| **問題** | `loadProject` 時に `clearHistory()` が呼ばれない |
| **影響** | 前プロジェクトの状態にUndoで戻ってしまう |

---

### 3.7 git_clone.rs のメモリリーク

| 項目 | 内容 |
|------|------|
| **ファイル** | `src-tauri/src/services/git_clone.rs` (L55) |
| **問題** | `.leak()` による意図的メモリリーク |
| **影響** | 長期間稼働でメモリ消費が増加し続ける |

**修正案**: `String` を保持するか `Cow<'static, str>` を使用

---

## 4. MEDIUM — 計画的に対応

### 4.1 projectStore の非効率なスプレッド演算

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/projectStore.ts` (全体) |
| **問題** | Actor 1つの position 更新で Project → scenes → scene → actors → actor を5階層再作成 |
| **影響** | 100 Actor の一括移動で100回のフルオブジェクト再構築 |

**修正案**: Zustand の Immer middleware 導入
```typescript
import { immer } from 'zustand/middleware/immer';

const useProjectStore = create(immer((set) => ({
  updateActorPosition: (sceneId, actorId, pos) => {
    set((state) => {
      state.project.scenes[sceneId].actors[actorId].position = pos;
    });
  },
})));
```

---

### 4.2 JSON.stringify の三重実行

| 項目 | 内容 |
|------|------|
| **ファイル** | `useUndoRedo.ts` + `memento.ts` |
| **問題** | 変更検知で stringify → Memento 作成で stringify → pushHistory で再度アクセス |
| **影響** | 変更毎に大規模オブジェクトの JSON 直列化が3回走る |

---

### 4.3 コンポーネントの memo 化不足

| ファイル | コンポーネント | 影響 |
|---------|-------------|------|
| `BehaviorEditor.tsx` | `ActiveStateEditor`, `KeyBindingRow` | 親の state 変更で全行再レンダー |
| `ScenePreview.tsx` | `ActorPreviewNode` | 再帰コンポーネントがツリー全体を再レンダー |
| `PrefabList.tsx` | Prefab行 | リスト全体が再レンダー |
| `SequenceEditor.tsx` | ソート済み配列 | 毎レンダーで `[...sequences].sort()` |

---

### 4.4 配列インデックスを key に使用

| ファイル | 箇所 |
|---------|------|
| `ComponentEditor.tsx` (PortList) | `key={i}` — リスト並び替え時に不正な再利用 |
| `ComponentList.tsx` (L145, 160) | 変数・タスク表示で `key={i}` |
| `VariableEditor.tsx` (L39) | `key={index}` |
| `TestCaseEditor.tsx` (L34) | `key={i}` |

**修正案**: `key={`${parentId}-${itemId || index}`}` のような安定した識別子を使用

---

### 4.5 editorStore のパネル状態管理

| 項目 | 内容 |
|------|------|
| **ファイル** | `ars-editor/src/stores/editorStore.ts` (L88-97) |
| **問題** | `openComponentEditor` が全パネルの visibility をリセット。他パネルが強制的に閉じる |
| **影響** | ユーザーが開いていたパネルが意図せず閉じる |

---

### 4.6 Docker のセキュリティ強化

| 問題 | ファイル | 修正案 |
|------|---------|--------|
| HEALTHCHECK 未定義 | 全 Dockerfile | `HEALTHCHECK CMD curl -f http://localhost:PORT/health` |
| セキュリティコンテキスト未設定 | `docker-compose.yaml` | `security_opt`, `cap_drop`, リソース制限追加 |
| シークレットが docker inspect で可視 | `docker-compose.yaml` | Docker Secrets または外部シークレット管理 |
| npm install フォールバック | `Dockerfile` (L14) | `npm ci` のみに統一 |

---

### 4.7 MCP Server のポート存在チェック欠如

| 項目 | 内容 |
|------|------|
| **ファイル** | `mcp-server/src/index.ts` (`add_connection` ツール) |
| **問題** | `source_port`, `target_port` の存在確認・型互換チェックなし |
| **影響** | 存在しないポートへの接続が作成される |

---

### 4.8 Regex の再コンパイル

| 項目 | 内容 |
|------|------|
| **ファイル** | `src-tauri/src/services/module_parser.rs` (L41) |
| **問題** | ループ内で `Regex::new()` を毎回呼び出し |
| **修正案** | `lazy_static!` または `once_cell::sync::Lazy` でキャッシュ |

---

### 4.9 IAM ポリシーの過剰権限

| 項目 | 内容 |
|------|------|
| **ファイル** | `infra/build-instance/setup-iam.sh` (L268-272) |
| **問題** | SSM `RunCommand` / `GetCommandInvocation` の `Resource: "*"` |
| **修正案** | タグベースの条件で対象インスタンスを限定 |

---

## 5. LOW — 改善提案

### 5.1 命名の一貫性

| 箇所 | 現状 | 提案 |
|------|------|------|
| projectStore メソッド | `createScene` / `addActor` / `addConnection` | `create` or `add` に統一 |
| authStore フラグ | `cloudProjectsLoading` / `gitReposLoading` / `gitProjectsLoading` | `isLoading{X}` に統一 |
| editorStore | `mobileSceneMenuOpen` / `mobileBottomSheetOpen` | `isMobile{X}Open` に統一 |

### 5.2 tsconfig の strictness 強化

```jsonc
// 全 tsconfig.json に追加推奨
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true
  }
}
```

### 5.3 Error Boundary の導入

ReactFlow キャンバス、ResourceDepot、DataOrganizer など外部データ依存のコンポーネントに Error Boundary を設置。

### 5.4 ResourceDepot の検索デバウンス

`ResourceDepotPage.tsx` で検索テキスト変更のたびに API 呼び出し。`useDebouncedCallback` 等でリクエスト頻度を制限。

### 5.5 DataOrganizerPage の循環依存リスク

`loadSchemas` の dependency array に `selectedSchema` を含めており、state 変更で再実行される可能性がある。

### 5.6 NodeCanvas の useCallback 漏れ

`onSelectionChange` ハンドラが毎レンダーで新規関数を生成（L103-105）。`useCallback` で囲む。

### 5.7 Cargo MSRV の統一

`ars-editor/src-tauri` のみ `rust-version = "1.77.2"` を宣言。他クレートにも追加推奨。

---

## 6. ファイル別修正ポイント一覧

| ファイル | 重要度 | 修正内容 |
|---------|--------|---------|
| `stores/projectStore.ts` | CRITICAL | 循環参照検出、孤立Actor修正、Immer導入 |
| `stores/memento.ts` | HIGH | 差分ベース履歴、JSON直列化エラーハンドリング |
| `stores/historyMiddleware.ts` | HIGH | 再入ガードをカウンター化、プロジェクト切替時クリア |
| `stores/authStore.ts` | HIGH | error state追加、サイレントcatch修正 |
| `stores/editorStore.ts` | MEDIUM | パネル状態管理改善、AbortController クリーンアップ |
| `mcp-server/src/index.ts` | CRITICAL | 全ツールハンドラにtry-catch追加 |
| `mcp-server/src/module-parser.ts` | MEDIUM | 入力サイズ制限、型文字列のバリデーション |
| `src/types/domain.ts` | HIGH | Single Source of Truth化、重複排除 |
| `src/types/app-components.ts` | MEDIUM | Task.testCases の整合性確保 |
| `ars-editor/src-tauri/src/web_server.rs` | CRITICAL | unwrap() → Result 伝播 |
| `src-tauri/src/services/git_clone.rs` | HIGH | .leak() 除去 |
| `src-tauri/src/services/module_parser.rs` | MEDIUM | Regex キャッシュ化 |
| `.github/workflows/*.yml` | HIGH | テスト・lint・audit ステップ追加 |
| `Dockerfile` (全4ファイル) | MEDIUM | HEALTHCHECK追加、セキュリティ強化 |
| `docker-compose.yaml` | MEDIUM | シークレット管理、リソース制限 |
| `infra/build-instance/setup-iam.sh` | MEDIUM | SSM Resource スコープ限定 |
| `features/node-editor/components/NodeCanvas.tsx` | LOW | useCallback 追加 |
| `features/behavior-editor/components/BehaviorEditor.tsx` | MEDIUM | サブコンポーネントの memo 化 |
| `features/preview/components/ScenePreview.tsx` | MEDIUM | ActorPreviewNode の memo 化 |
| `features/component-editor/*.tsx` | MEDIUM | 配列 key 修正 |

---

## 7. 推奨アクションプラン

### Phase 1: 即時対応（1-2日）

1. `projectStore.ts` に循環参照チェックと孤立Actor修正を追加
2. `mcp-server/index.ts` の全ツールハンドラに try-catch 追加
3. `web_server.rs` の unwrap() を Result 伝播に変更
4. `git_clone.rs` の `.leak()` を除去

### Phase 2: 短期改善（1週間）

5. `authStore.ts` に error state 追加
6. `historyMiddleware.ts` の再入ガードをカウンター化 + プロジェクト切替時クリア
7. 型定義の Single Source of Truth 化（4ファイル → 1ファイル + re-export）
8. CI ワークフローにテスト・lint・audit を追加

### Phase 3: 中期改善（2-4週間）

9. Zustand に Immer middleware 導入（projectStore の大規模リファクタ）
10. Memento を差分ベースに変更
11. Docker セキュリティ強化（HEALTHCHECK, security_opt, Secrets）
12. コンポーネントの memo 化、配列 key 修正

### Phase 4: 継続的改善

13. tsconfig strictness 強化
14. Error Boundary 導入
15. 命名規則の統一
16. IAM ポリシーのスコープ限定

---

*本レポートは Ars プロジェクトの main ブランチ (2fc200c) を対象にした包括的コードレビューの結果です。*
