# Ars ノードエディタ 設計書 & 実装計画

## 1. プロジェクト概要

Arsアクターモデルに基づくコンテンツ構造を、ノードベースのビジュアルエディタで操作するデスクトップアプリケーション。

**技術スタック:**

| レイヤー | 技術 | バージョン | 理由 |
|---------|------|-----------|------|
| フレームワーク | Tauri v2 | 2.x | Rust製。Electronの1/10のバイナリサイズ、低メモリ消費 |
| フロントエンド | React 19 + TypeScript | 5.x | React Flow UIとの親和性最高 |
| ノードエディタ | @xyflow/react (React Flow) | 12.x | MIT、TypeScript完全対応、shadcn/ui連携、大量ノードの仮想化対応 |
| UIコンポーネント | shadcn/ui + Tailwind CSS 4 | latest | React Flow UIが公式で依存、コピーベースでカスタマイズ自在 |
| 状態管理 | Zustand | 5.x | 軽量、TypeScript相性良好、React Flow公式推奨パターン |
| ビルド | Vite | 6.x | HMR最速、Tauri公式テンプレート対応 |
| バックエンド | Rust (Tauri Commands) | — | ファイルI/O、プロジェクト保存/読込をネイティブ処理 |

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  Tauri (Rust Backend)                               │
│  ├─ プロジェクトファイル I/O (JSON/MessagePack)      │
│  ├─ シーンの永続化                                   │
│  └─ 将来: Ars実行エンジン連携                        │
├─────────────────────────────────────────────────────┤
│  React Frontend                                     │
│  ├─ App Shell (レイアウト / ルーティング)             │
│  ├─ SceneManager     … シーン一覧 & 選択             │
│  ├─ NodeEditor       … React Flow ベース             │
│  │   ├─ ActorNode    … アクターを表すカスタムノード   │
│  │   ├─ GroupNode    … アクター内包(子アクター)       │
│  │   └─ Edge         … 依存/接続を表現               │
│  ├─ ComponentPicker  … アクターへのコンポーネント選択  │
│  ├─ ComponentEditor  … コンポーネント定義エディタ      │
│  └─ Store (Zustand)  … 全アプリ状態                   │
└─────────────────────────────────────────────────────┘
```

---

## 3. ドメインモデル (TypeScript型定義)

```typescript
// === コアモデル ===

type ActorRole = 'actor' | 'scene' | 'sequence';

interface Component {
  id: string;
  name: string;
  category: 'UI' | 'Logic' | 'System' | 'GameObject';
  domain: string;
  variables: Variable[];
  tasks: Task[];
  dependencies: string[];     // 他コンポーネントIDへの参照
}

interface Variable {
  name: string;
  type: string;
  defaultValue?: unknown;
}

interface Task {
  name: string;
  description: string;       // 具体的な処理内容
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

interface PortDefinition {
  name: string;
  type: string;
}

interface Actor {
  id: string;
  name: string;
  role: ActorRole;
  components: string[];       // Component.id[]
  children: string[];         // 子Actor.id[] (アクター内包)
  position: { x: number; y: number };
}

interface Scene {
  id: string;
  name: string;
  rootActorId: string;        // トップレベルアクター = シーン自身
  actors: Record<string, Actor>;
  connections: Connection[];  // アクター間の接続
}

interface Connection {
  id: string;
  sourceActorId: string;
  sourcePort: string;
  targetActorId: string;
  targetPort: string;
}

interface Project {
  name: string;
  scenes: Record<string, Scene>;
  components: Record<string, Component>;  // プロジェクト全体で共有
  activeSceneId: string | null;
}
```

---

## 4. 機能一覧 (フェーズ1)

### 4.1 シーンマネージャー
| 機能 | 詳細 |
|------|------|
| シーン作成 | 名前を入力して新規シーンを生成。ルートアクター(role=scene)を自動配置 |
| シーン選択 | サイドバーからシーンをクリックで切替。ノードエディタの内容が連動 |
| シーン削除 | 確認ダイアログ付き |
| シーン名変更 | インライン編集 |

### 4.2 ノードエディタ (シーン内)
| 機能 | 詳細 |
|------|------|
| アクター追加 | 右クリックメニューまたはドラッグ&ドロップ。role選択(actor/sequence) |
| アクター削除 | Delete キーまたはコンテキストメニュー |
| アクター接続 | ハンドルのドラッグでEdge作成。ポート型の一致チェック |
| 子アクター内包 | アクターノードにドロップで親子関係を設定 (GroupNode) |
| ズーム/パン | React Flow標準。MiniMap + Controls |
| Undo/Redo | Zustand middleware で履歴管理 |

### 4.3 コンポーネントピッカー (アクターノード内)
| 機能 | 詳細 |
|------|------|
| コンポーネント一覧 | カテゴリ別にフィルタ (UI/Logic/System/GameObject) |
| 検索 | 名前・ドメインで絞り込み |
| アタッチ | チェックボックスでアクターに追加/削除 |
| 依存解決 | 選択時に依存コンポーネントを自動提案 |

### 4.4 コンポーネントエディタ
| 機能 | 詳細 |
|------|------|
| 新規作成 | module_template.md準拠のフォーム |
| 編集 | 変数・タスク・依存の追加/削除/変更 |
| カテゴリ制限 | UI/Logic/System/GameObjectのみ選択可 (独自カテゴリ禁止) |
| テスト定義 | 各タスクに対するテストケースの記述欄 |
| バリデーション | 必須フィールドのチェック |

---

## 5. React Flow カスタムノード設計

### ActorNode

```
┌──────────────────────────────────────┐
│  🎭 Player                   [actor] │  ← ヘッダー (名前 + role)
│──────────────────────────────────────│
│  Components:                         │
│  ├─ 🔧 Transform        [System]    │
│  ├─ 🎮 PlayerInput      [Logic]     │
│  └─ 🖼️ SpriteRenderer   [UI]        │
│                          [+ Add]     │  ← ComponentPicker起動
│──────────────────────────────────────│
│  ○ input_move  ←──→  output_pos ○   │  ← 入出力ポート
└──────────────────────────────────────┘
```

- **ヘッダー**: role に応じた色分け (Scene=青, Actor=緑, Sequence=橙)
- **ボディ**: アタッチ済みコンポーネント一覧
- **ポート**: コンポーネントのTask入出力から自動生成

### GroupNode (子アクター内包)
React Flowの `parentId` 機能でネスト表現。親ノードをリサイズ可能にし、子ノードを内部に配置。

---

## 6. ディレクトリ構成

```
ars-editor/
├── src-tauri/                    # Rust バックエンド
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/             # Tauri Commands
│   │   │   ├── project.rs        # プロジェクト保存/読込
│   │   │   └── mod.rs
│   │   └── models/               # Rust側データモデル (serde)
│   │       ├── scene.rs
│   │       ├── actor.rs
│   │       ├── component.rs
│   │       └── mod.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # React フロントエンド
│   ├── app/
│   │   ├── App.tsx               # ルートレイアウト
│   │   └── router.tsx            # (将来用)
│   ├── features/
│   │   ├── scene-manager/
│   │   │   ├── components/
│   │   │   │   ├── SceneList.tsx
│   │   │   │   └── SceneItem.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useSceneManager.ts
│   │   │   └── index.ts
│   │   ├── node-editor/
│   │   │   ├── components/
│   │   │   │   ├── NodeCanvas.tsx       # React Flow wrapper
│   │   │   │   ├── ActorNode.tsx        # カスタムノード
│   │   │   │   ├── GroupNode.tsx        # 内包ノード
│   │   │   │   ├── ActorEdge.tsx        # カスタムエッジ
│   │   │   │   └── ContextMenu.tsx      # 右クリックメニュー
│   │   │   ├── hooks/
│   │   │   │   ├── useNodeEditor.ts
│   │   │   │   └── useUndoRedo.ts
│   │   │   ├── types/
│   │   │   │   └── nodes.ts             # ノード型定義
│   │   │   └── index.ts
│   │   ├── component-picker/
│   │   │   ├── components/
│   │   │   │   ├── ComponentPicker.tsx
│   │   │   │   └── ComponentCard.tsx
│   │   │   └── index.ts
│   │   └── component-editor/
│   │       ├── components/
│   │       │   ├── ComponentEditor.tsx
│   │       │   ├── VariableEditor.tsx
│   │       │   ├── TaskEditor.tsx
│   │       │   └── TestCaseEditor.tsx
│   │       └── index.ts
│   ├── stores/
│   │   ├── projectStore.ts       # Zustand: プロジェクト全体
│   │   ├── editorStore.ts        # Zustand: UI状態 (選択, パネル開閉)
│   │   └── historyMiddleware.ts  # Undo/Redo
│   ├── types/
│   │   ├── domain.ts             # ドメインモデル型定義
│   │   └── index.ts
│   ├── components/               # 共通UIコンポーネント (shadcn/ui)
│   │   └── ui/
│   ├── lib/
│   │   └── utils.ts
│   ├── main.tsx
│   └── globals.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json               # shadcn/ui
└── tailwind.config.ts
```

---

## 7. 実装計画 (フェーズ分割)

### Phase 0: プロジェクトセットアップ (Day 1)
- [ ] `create-tauri-app` で React + TypeScript テンプレート生成
- [ ] Tailwind CSS 4 + shadcn/ui セットアップ
- [ ] `@xyflow/react` インストール & React Flow UI コンポーネント追加
- [ ] Zustand インストール & ストア雛形作成
- [ ] ディレクトリ構成の確立
- [ ] TypeScript型定義 (`types/domain.ts`)

### Phase 1: シーンマネージャー (Day 2)
- [ ] サイドバーUI (SceneList / SceneItem)
- [ ] シーン CRUD ロジック (Zustand store)
- [ ] アクティブシーン切替

### Phase 2: ノードエディタ基盤 (Day 3-4)
- [ ] NodeCanvas: React Flow + MiniMap + Controls + Background
- [ ] ActorNode: カスタムノードコンポーネント (role色分け、コンポーネント表示)
- [ ] ノード追加 (コンテキストメニュー)
- [ ] ノード削除
- [ ] エッジ接続 (ハンドル)
- [ ] Zustand ↔ React Flow の双方向同期

### Phase 3: コンポーネントピッカー (Day 5)
- [ ] ピッカーUI (カテゴリフィルタ + 検索)
- [ ] アクターノードからピッカー起動 → コンポーネントアタッチ
- [ ] 依存の自動解決表示

### Phase 4: コンポーネントエディタ (Day 6-7)
- [ ] module_template.md準拠のフォーム
- [ ] 変数エディタ (動的追加/削除)
- [ ] タスクエディタ (入力/出力/タスク定義)
- [ ] テストケースエディタ
- [ ] バリデーション

### Phase 5: 永続化 & 仕上げ (Day 8)
- [ ] Tauri Command: プロジェクトJSON保存/読込
- [ ] Undo/Redo (Zustand temporal middleware)
- [ ] GroupNode (子アクター内包)
- [ ] キーボードショートカット

---

## 8. モジュール定義書 (Luduフォーマット)

以下は、module_template.mdに準拠した各モジュールの定義書。

---

### 8.1 シーンマネージャー モジュール定義

#### 概要
プロジェクト内のシーンの作成・選択・削除・名前変更を管理する

#### カテゴリ
UI

#### 所属ドメイン
エディタ

#### 必要なデータ
- プロジェクト内のシーン一覧
- アクティブシーンID

#### 変数
- scenes: シーンオブジェクトのMap
- activeSceneId: 現在選択中のシーンID (null許容)

#### 依存
- ProjectStore

#### 作業
##### 入力
- ユーザーからのシーン名入力
- ユーザーからのシーン選択操作

##### 出力
- 更新されたシーン一覧の描画
- アクティブシーン変更イベント

##### タスク
- シーン作成: 名前を受け取り、新規Scene + ルートActor(role=scene)を生成しストアに追加
- シーン選択: IDを受け取り、activeSceneIdを更新
- シーン削除: IDを受け取り、確認後にシーンとその全アクターをストアから削除
- シーン名変更: IDと新名前を受け取り、シーン名を更新

#### テスト
- シーンを作成すると、一覧に新規シーンが追加され、ルートアクター(role=scene)が自動生成されること
- シーンを選択すると、activeSceneIdが更新され、ノードエディタの表示が切り替わること
- シーンを削除すると、一覧から消え、関連アクターも全削除されること
- 最後のシーンを削除すると、activeSceneIdがnullになること

---

### 8.2 ノードエディタ モジュール定義

#### 概要
アクティブシーン内のアクター構造をノードグラフとして表示・編集する

#### カテゴリ
UI

#### 所属ドメイン
エディタ

#### 必要なデータ
- アクティブシーンのアクター一覧
- アクター間の接続一覧
- コンポーネント定義 (ポート情報の表示用)

#### 変数
- nodes: React Flowノード配列 (Actor → Node変換済み)
- edges: React Flowエッジ配列 (Connection → Edge変換済み)
- selectedNodeIds: 選択中のノードID配列
- contextMenuPosition: 右クリックメニュー表示座標 (null許容)

#### 依存
- SceneManager (アクティブシーン)
- ProjectStore (アクター・接続データ)
- ComponentPicker (コンポーネント追加操作の委譲)

#### 作業
##### 入力
- ドメインデータ (Actor[], Connection[]) → React Flowノード/エッジへの変換
- ユーザーのマウス・キーボード操作

##### 出力
- React Flowキャンバス描画
- ストアへのアクター位置・接続変更の反映

##### タスク
- アクターノード追加: コンテキストメニューからroleを選択し、クリック位置にアクターを生成
- アクターノード削除: 選択ノードをDeleteキーまたはメニューで削除。関連エッジも連動削除
- アクター接続: ハンドルドラッグでエッジ作成。ポート型チェックを実行し、不一致なら接続拒否
- ノード位置更新: ドラッグ終了時にアクターのposition値をストアに同期
- 子アクター内包: ノードをGroupNodeにドロップした際にparentIdを設定

#### テスト
- アクター追加後、ノードキャンバスに新しいノードが表示されること
- アクター削除後、ノードと関連エッジが消えること
- ハンドルを接続すると、ストアのconnectionsに新規接続が追加されること
- ノードドラッグ後にシーンを切替→戻すと、位置が保持されていること
- 型が不一致のポートへの接続が拒否されること

---

### 8.3 コンポーネントピッカー モジュール定義

#### 概要
アクターに採用するコンポーネントを選択・解除するインターフェース

#### カテゴリ
UI

#### 所属ドメイン
エディタ

#### 必要なデータ
- プロジェクト内のコンポーネント定義一覧
- 対象アクターの現在のコンポーネントID配列

#### 変数
- searchQuery: 検索文字列
- categoryFilter: 選択中のカテゴリフィルタ (null=全表示)
- targetActorId: 操作対象のアクターID

#### 依存
- ProjectStore (コンポーネント一覧)
- ノードエディタ (対象アクター情報)

#### 作業
##### 入力
- 対象アクターID
- ユーザーの検索・フィルタ・チェック操作

##### 出力
- フィルタ済みコンポーネント一覧の描画
- アクターのcomponents配列の更新

##### タスク
- コンポーネント検索: searchQueryとcategoryFilterで一覧をフィルタ
- コンポーネントアタッチ: チェックON時にアクターのcomponents配列にIDを追加
- コンポーネントデタッチ: チェックOFF時にアクターのcomponents配列からIDを削除
- 依存提案: アタッチ時に、コンポーネントのdependenciesを確認し、未アタッチの依存を警告表示

#### テスト
- 検索文字列 "Physics" 入力で、名前にPhysicsを含むコンポーネントのみ表示されること
- カテゴリ "System" でフィルタすると、Systemカテゴリのみ表示されること
- コンポーネントをアタッチすると、アクターノードのコンポーネント欄に追加されること
- 依存が未解決のコンポーネントをアタッチすると、依存コンポーネントの追加提案が表示されること

---

### 8.4 コンポーネントエディタ モジュール定義

#### 概要
module_template.md準拠のコンポーネント定義を作成・編集する専用エディタ

#### カテゴリ
UI

#### 所属ドメイン
エディタ

#### 必要なデータ
- 編集対象のコンポーネント定義
- 既存コンポーネントの一覧 (依存選択用)

#### 変数
- editingComponent: 編集中のComponentオブジェクト (ドラフト)
- validationErrors: フィールドごとのエラーメッセージMap
- isDirty: 未保存の変更があるか

#### 依存
- ProjectStore (保存先)

#### 作業
##### 入力
- 編集対象のコンポーネントID (新規時はnull)
- ユーザーのフォーム入力操作

##### 出力
- コンポーネント定義フォームの描画
- 保存時にProjectStoreへ反映

##### タスク
- フォーム初期化: IDがあれば既存データをロード、nullなら空フォーム表示
- 変数追加/削除: editingComponent.variablesの動的編集
- タスク追加/削除: editingComponent.tasksの動的編集 (入出力ポート含む)
- 依存選択: 既存コンポーネント一覧からチェックボックスで選択
- テストケース編集: 各タスクに対するテストケースの自由記述
- バリデーション: 名前必須、カテゴリ必須(4種のみ)、ドメイン必須、タスク0件不可
- 保存: バリデーション通過後にProjectStoreへcommit、isDirtyをリセット

#### テスト
- 新規作成で空フォームが表示され、必須フィールドが空のまま保存するとエラーが出ること
- カテゴリに "UI/Logic/System/GameObject" 以外が選択できないこと
- 変数を3件追加→1件削除すると、editingComponent.variablesが2件になること
- 既存コンポーネント編集時に、保存済みデータが正しくフォームに反映されること
- 保存後にisDirtyがfalseに戻ること

---

## 9. 状態管理設計 (Zustand)

```typescript
// projectStore.ts
interface ProjectState {
  project: Project;

  // Scene actions
  createScene: (name: string) => void;
  deleteScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  setActiveScene: (id: string | null) => void;

  // Actor actions
  addActor: (sceneId: string, actor: Actor) => void;
  removeActor: (sceneId: string, actorId: string) => void;
  updateActorPosition: (sceneId: string, actorId: string, pos: {x:number, y:number}) => void;
  setActorComponents: (sceneId: string, actorId: string, componentIds: string[]) => void;
  setActorParent: (sceneId: string, actorId: string, parentId: string | null) => void;

  // Connection actions
  addConnection: (sceneId: string, connection: Connection) => void;
  removeConnection: (sceneId: string, connectionId: string) => void;

  // Component actions
  upsertComponent: (component: Component) => void;
  deleteComponent: (id: string) => void;
}

// editorStore.ts
interface EditorState {
  selectedNodeIds: string[];
  contextMenu: { x: number; y: number } | null;
  componentPickerTarget: string | null;    // actorId
  componentEditorTarget: string | null;    // componentId (null = new)
  panelVisibility: {
    sceneManager: boolean;
    componentEditor: boolean;
  };
}
```

---

## 10. AI効率化の観点

本設計で意識したAI (Claude等) によるコード生成効率の最大化ポイント：

1. **TypeScript厳密型定義**: ドメインモデルが型で明確に定義されているため、AIが正確な型推論でコード生成可能
2. **Feature-basedディレクトリ**: 各featureが独立しており、AIに1 feature単位でコード生成を依頼可能
3. **Zustand単一ストア**: 状態の所在が明確。AIが状態アクセスを迷わない
4. **React Flow公式パターン準拠**: @xyflow/reactのTypeScript型ガードパターンに準拠しているため、公式ドキュメントの知識がそのまま活用される
5. **module_template.md準拠**: コンポーネント定義のフォーマットが固定されており、AIによるフォーム自動生成と妥当性検証が容易
6. **shadcn/ui**: コンポーネントがプロジェクト内にコピーされるため、AIがUIを直接編集可能 (npmパッケージの中身を推測する必要がない)

---

## 11. モジュールレジストリ設計 (GitHub連携)

### 11.1 概要

GitHubリポジトリをソースとしてArsモジュール定義ファイル（Markdown）をクローン・パースし、
プロジェクトのコンポーネントとしてアクターにアタッチできる仕組み。

```
┌────────────────────────────────────────────────────┐
│  GitHub Repository (モジュール定義ソース)            │
│  ├── modules/scene-manager.md                      │
│  ├── modules/node-editor.md                        │
│  └── modules/component-picker.md                   │
└──────────────┬─────────────────────────────────────┘
               │ git clone / pull
               ▼
┌────────────────────────────────────────────────────┐
│  Rust Backend (Tauri Commands)                     │
│  ├── GitCloneService    … リポジトリのclone/pull   │
│  ├── ModuleParser       … Markdownの構造化パース    │
│  └── ModuleRegistry     … ソース・モジュール管理    │
├────────────────────────────────────────────────────┤
│  ローカルキャッシュ                                  │
│  ~/.ars/module-cache/                                │
│  ├── github.com/user/repo/  (クローン済みリポ)     │
│  └── registry.json          (レジストリ設定)       │
└──────────────┬─────────────────────────────────────┘
               │ Tauri invoke
               ▼
┌────────────────────────────────────────────────────┐
│  React Frontend                                    │
│  ├── moduleRegistryStore (Zustand)                 │
│  │   ├── sources[]        … 登録済みリポジトリ     │
│  │   ├── modules[]        … パース済みモジュール   │
│  │   ├── addSource()      … ソース追加             │
│  │   ├── syncSource()     … 同期実行               │
│  │   └── filteredModules()… 検索・フィルタ         │
│  ├── ModuleRegistryPanel  … ソース管理UI           │
│  └── ComponentPicker      … モジュール→アクター    │
│      └── moduleToComponent() でインポート          │
└────────────────────────────────────────────────────┘
```

### 11.2 Markdownパースフォーマット

plan.md セクション8のモジュール定義書フォーマットをそのまま解析対象とする:

```markdown
### {モジュール名} [モジュール定義]

#### 概要
{概要テキスト}

#### カテゴリ
{UI | Logic | System | GameObject}

#### 所属ドメイン
{ドメイン名}

#### 必要なデータ
- {データ項目1}
- {データ項目2}

#### 変数
- {変数名}: {説明}
- {変数名} ({型}): {説明}

#### 依存
- {依存先名1}
- {依存先名2}

#### 作業
##### 入力
- {入力ポート説明}

##### 出力
- {出力ポート説明}

##### タスク
- {タスク名}: {処理内容の説明}

#### テスト
- {テストケースの説明}
```

### 11.3 Tauri Commands (API)

| コマンド | パラメータ | 返り値 | 説明 |
|---------|-----------|--------|------|
| `add_registry_source` | name, repo_url, definition_glob? | ModuleRegistrySource | GitHubリポジトリをソース登録 |
| `remove_registry_source` | source_id | void | ソース削除 |
| `sync_registry_source` | source_id | ModuleDefinition[] | clone/pull + パース実行 |
| `sync_all_sources` | - | ModuleDefinition[] | 全ソース同期 |
| `get_all_modules` | - | ModuleDefinition[] | 全モジュール取得 |
| `get_modules_by_category` | category | ModuleDefinition[] | カテゴリフィルタ |
| `search_modules` | query | ModuleDefinition[] | 名前・概要・ドメイン検索 |
| `get_registry_sources` | - | ModuleRegistrySource[] | 全ソース取得 |
| `get_module_by_id` | module_id | ModuleDefinition | ID指定取得 |

### 11.4 アクターへのアタッチフロー

1. **ソース登録**: ユーザーがGitHubリポジトリURLを入力し、`addSource()` でレジストリに登録
2. **同期**: `syncSource()` でリポジトリをclone/pullし、Markdown定義ファイルをパース
3. **モジュール選択**: ComponentPickerにレジストリのモジュール一覧が表示される
4. **インポート**: 選択したモジュールを `moduleToComponent()` でComponentに変換
5. **アタッチ**: 変換されたComponentをアクターの `components[]` に追加

### 11.5 ファイル構成

```
src-tauri/src/
├── models/
│   ├── module_definition.rs   # ModuleDefinition, ModuleRegistry等
│   └── mod.rs
├── services/
│   ├── git_clone.rs           # GitCloneService (git2ベース)
│   ├── module_parser.rs       # Markdownパーサー (regexベース)
│   ├── module_registry.rs     # ModuleRegistryService (統合管理)
│   └── mod.rs
├── commands/
│   ├── module_registry.rs     # Tauriコマンド定義
│   └── mod.rs
├── lib.rs                     # Tauriアプリ起動・コマンド登録
└── main.rs

src/
├── types/
│   ├── domain.ts              # Actor, Component, moduleToComponent()
│   ├── module-registry.ts     # ModuleDefinition, ModuleRegistrySource
│   └── index.ts
├── services/
│   └── module-registry-api.ts # Tauri invoke ラッパー
└── stores/
    └── moduleRegistryStore.ts # Zustandストア
```

---

## 12. 次のアクション

この設計書の承認後、以下の順序で実装を進める：

1. **Phase 0**: `create-tauri-app` でプロジェクト雛形を生成し、依存パッケージをインストール
2. **types/domain.ts**: ドメインモデル型定義を最初に確定
3. **stores/**: Zustandストアを先行実装 (UIなしでテスト可能)
4. **モジュールレジストリ**: GitHubリポジトリからのモジュール定義読み込み機能（実装済み）
5. **Phase 1-4**: 各フェーズを順次実装
6. 各フェーズ完了時にモジュール定義書のテスト項目でセルフチェック
