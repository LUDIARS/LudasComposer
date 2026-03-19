import type { ReactNode } from 'react';

export const helpContent: Record<string, ReactNode> = {
  // Scene List
  sceneList: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Scenes</p>
      <p>
        シーンはゲームの各画面やステージを管理する最上位の単位です。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>シーン名を入力 → 「+」</strong> → 新しいシーンを作成</li>
        <li><strong>シーン名をクリック</strong> → 選択・編集対象を切り替え</li>
        <li><strong>ダブルクリック</strong> → シーン名を変更</li>
        <li><strong>「✕」ボタン</strong> → シーンを削除</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        <span className="text-amber-400">Step 1</span> - サンプルゲーム作成の最初のステップです
      </p>
    </div>
  ),

  // Node Canvas
  nodeCanvas: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Node Canvas</p>
      <p>
        アクター（ゲームオブジェクト）をビジュアルに配置・接続するメインのエディタ領域です。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>右クリック</strong> → コンテキストメニューからアクターを追加</li>
        <li><strong>ノード間をドラッグ</strong> → データフローを接続</li>
        <li><strong>マウスホイール</strong> → ズーム、<strong>ドラッグ</strong> → パン</li>
        <li><strong>ノード選択 → Delete</strong> → ノードを削除</li>
        <li><strong>Ctrl+C / Ctrl+V</strong> → コピー＆ペースト</li>
        <li><strong>Ctrl+D</strong> → 選択中のアクターを複製</li>
        <li><strong>アクターをクリック</strong> → Component Picker を開く</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        <span className="text-amber-400">Step 2</span> - ここでアクターを定義・配置します
      </p>
    </div>
  ),

  // Component Editor
  componentEditor: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Component Editor</p>
      <p>
        コンポーネント（モジュール）の詳細を定義・編集するパネルです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Name 入力</strong> → コンポーネント名を設定</li>
        <li><strong>Category 選択</strong> → UI / Logic / System / GameObject を指定</li>
        <li><strong>Domain 入力</strong> → 所属ドメインを設定（Physics, Rendering 等）</li>
        <li><strong>「+ Variable」</strong> → 状態変数を追加（名前・型・初期値）</li>
        <li><strong>「+ Task」</strong> → タスクを追加（入出力ポートを定義）</li>
        <li><strong>Dependencies</strong> → 依存する他コンポーネントをチェック</li>
        <li><strong>Save</strong> → 変更を保存、<strong>Cancel</strong> → 変更を破棄</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        <span className="text-amber-400">Step 3</span> - モジュールの選択と定義を行います
      </p>
    </div>
  ),

  // Component List
  componentList: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Component List</p>
      <p>
        プロジェクト内の全コンポーネントを一覧・管理するパネルです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>検索バーに入力</strong> → 名前やドメインで絞り込み</li>
        <li><strong>カテゴリボタン</strong> → カテゴリ別にフィルタリング</li>
        <li><strong>項目をクリック</strong> → 展開して変数・タスク・依存関係を確認</li>
        <li><strong>「Edit」ボタン</strong> → Component Editor を開いて編集</li>
        <li><strong>「Duplicate」ボタン</strong> → コンポーネントを複製</li>
        <li><strong>「Delete」ボタン</strong> → コンポーネントを削除</li>
        <li><strong>「+ New Component」</strong> → 新しいコンポーネントを作成</li>
      </ul>
    </div>
  ),

  // Prefab List
  prefabList: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Prefabs</p>
      <p>
        再利用可能なアクターテンプレート（プレハブ）を管理するパネルです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Canvas でアクター右クリック → 「Save as Prefab」</strong> → プレハブを登録</li>
        <li><strong>ダブルクリック</strong> → プレハブ名を変更</li>
        <li><strong>「+」ボタン</strong> → アクティブシーンにインスタンスを配置</li>
        <li><strong>「✕」ボタン</strong> → プレハブを削除</li>
      </ul>
    </div>
  ),

  // Preview
  preview: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Preview</p>
      <p>
        現在のシーンのアクター階層と接続を確認できるプレビューパネルです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>アクターのツリー構造を可視化</li>
        <li>接続関係を一覧で確認</li>
      </ul>
    </div>
  ),

  // Toolbar
  toolbar: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Toolbar</p>
      <p>
        プロジェクトの操作とパネルの表示切替を行うメニューバーです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>New</strong> → 新規プロジェクトを作成（現在のプロジェクトは破棄）</li>
        <li><strong>Open</strong> → 保存済みプロジェクトを読み込み</li>
        <li><strong>Save (Ctrl+S)</strong> → プロジェクトを保存</li>
        <li><strong>Undo (Ctrl+Z)</strong> → 直前の操作を取消</li>
        <li><strong>Redo (Ctrl+Y)</strong> → 取り消した操作をやり直し</li>
        <li><strong>パネルトグル</strong> → Components / Prefabs / Behavior / Preview の表示切替</li>
        <li><strong>Push</strong> → GitHub リポジトリに変更をプッシュ</li>
      </ul>
    </div>
  ),

  // Component Picker (on actor node)
  componentPicker: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Component Picker</p>
      <p>
        アクターにアタッチするコンポーネントを選択するダイアログです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>チェックボックスをクリック</strong> → コンポーネントをアタッチ/解除</li>
        <li><strong>検索バーに入力</strong> → コンポーネントを名前・ドメインで絞り込み</li>
        <li><strong>カテゴリボタン</strong> → カテゴリ別にフィルタリング</li>
        <li><strong>⚠ 依存関係の警告</strong> → 必要なコンポーネントが不足している場合に表示</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        <span className="text-amber-400">Step 3</span> - アクターにモジュールを割り当てます
      </p>
    </div>
  ),

  // Sequence Editor
  sequenceEditor: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Sequence Editor</p>
      <p>
        シーケンスアクターのステップを順序付きで定義するエディタです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>ステップ名を入力</strong> → 「+ Add Step」でステップを追加</li>
        <li><strong>↑↓ ボタン</strong> → ステップの実行順序を並べ替え</li>
        <li><strong>ステップ名をクリック</strong> → 名前をインライン編集</li>
        <li><strong>Description 欄</strong> → ステップの説明を追加</li>
        <li><strong>✕ ボタン</strong> → ステップを削除</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        ステップは上から順に実行されます
      </p>
    </div>
  ),

  // Behavior Editor
  behaviorEditor: (
    <div className="space-y-2">
      <p className="font-semibold text-white">Behavior Editor</p>
      <p>
        シーンの状態（State）とキーバインディングを定義するエディタです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>New state 入力 → 「+」</strong> → 新しい状態を作成</li>
        <li><strong>状態タブをクリック</strong> → アクティブな状態を切り替え</li>
        <li><strong>Capture ボタン</strong> → キーボードのキーを直接入力して登録</li>
        <li><strong>List ボタン</strong> → よく使うキーの一覧から選択</li>
        <li><strong>Description 入力</strong> → キーを押したときの動作を自然言語で記述</li>
        <li><strong>Target Actor 選択</strong> → キー操作の対象アクターを指定</li>
        <li><strong>Delete State</strong> → 現在の状態を削除</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        各状態ごとに異なるキーバインドを設定できます
      </p>
    </div>
  ),

  // SubScene Picker
  subScenePicker: (
    <div className="space-y-2">
      <p className="font-semibold text-white">SubScene Picker</p>
      <p>
        シーンアクターにサブシーンを割り当てるダイアログです。
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>シーン名をクリック</strong> → そのシーンをサブシーンとして設定</li>
        <li><strong>(None) を選択</strong> → サブシーンの割り当てを解除</li>
      </ul>
      <p className="text-zinc-500 mt-1">
        サブシーンにより、シーンアクターが別のシーン定義を参照します
      </p>
    </div>
  ),
};
