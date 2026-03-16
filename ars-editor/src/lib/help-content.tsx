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
        <li>テキスト入力欄にシーン名を入力し「+」ボタンで新しいシーンを作成</li>
        <li>シーン名をクリックして選択・編集対象を切り替え</li>
        <li>ダブルクリックでシーン名を変更</li>
        <li>各シーンの「✕」ボタンで削除</li>
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
        <li>右クリックでコンテキストメニューを開き、新しいアクターを追加</li>
        <li>ノード間をドラッグしてデータフローを接続</li>
        <li>マウスホイールでズーム、ドラッグでパン</li>
        <li>ノードを選択して Delete キーで削除</li>
        <li>Ctrl+C / Ctrl+V でコピー＆ペースト</li>
        <li>Ctrl+D で選択中のアクターを複製</li>
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
        <li><strong>Name</strong> - コンポーネントの名前を設定</li>
        <li><strong>Category</strong> - UI / Logic / System / GameObject から選択</li>
        <li><strong>Domain</strong> - 所属ドメイン（Physics, Rendering 等）</li>
        <li><strong>Variables</strong> - コンポーネントの状態変数を定義</li>
        <li><strong>Tasks</strong> - 入出力ポートを持つタスクを定義</li>
        <li><strong>Dependencies</strong> - 依存する他コンポーネントを選択</li>
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
        <li>検索バーで名前やドメインを絞り込み</li>
        <li>カテゴリボタンでフィルタリング</li>
        <li>項目をクリックで展開し、変数・タスク・依存関係を確認</li>
        <li>「Edit」で Component Editor を開いて編集</li>
        <li>「+ New Component」で新規作成</li>
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
        <li>Node Canvas でアクターを右クリック → 「Save as Prefab」で登録</li>
        <li>ダブルクリックでプレハブ名を変更</li>
        <li>「+」ボタンでアクティブシーンにインスタンスを配置</li>
        <li>「✕」でプレハブを削除</li>
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
        <li><strong>New</strong> - 新規プロジェクトを作成</li>
        <li><strong>Open</strong> - 既存プロジェクトを読み込み</li>
        <li><strong>Save</strong> - プロジェクトを保存 (Ctrl+S)</li>
        <li><strong>Undo / Redo</strong> - 操作の取消・やり直し (Ctrl+Z / Ctrl+Y)</li>
        <li><strong>Components / Prefabs / Preview</strong> - パネル表示の切替</li>
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
        <li>チェックボックスでコンポーネントを選択・解除</li>
        <li>依存関係の警告が表示される場合は必要なコンポーネントも追加</li>
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
        <li>ステップの追加・削除・並べ替え</li>
        <li>各ステップの実行順序を番号で管理</li>
      </ul>
    </div>
  ),
};
