import { useState } from 'react';

interface GettingStartedGuideProps {
  onClose: () => void;
}

interface Step {
  number: number;
  title: string;
  titleJa: string;
  description: string;
  details: string[];
  tips: string[];
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Define Scenes',
    titleJa: 'シーンの定義',
    description:
      'シーンはゲームの各画面やレベルに相当します。まずシーンを作成して、ゲーム全体の構造を設計しましょう。',
    details: [
      '左サイドバーの「Scenes」パネルでシーン名を入力し「+」ボタンをクリック',
      'タイトル画面、メインゲーム、リザルト画面などのシーンを作成',
      'シーンをクリックして選択し、編集対象を切り替え',
    ],
    tips: [
      'シーン名はわかりやすい名前をつけましょう（例：TitleScreen, GameMain, Result）',
      'ダブルクリックで後からシーン名を変更できます',
    ],
  },
  {
    number: 2,
    title: 'Define Actors',
    titleJa: 'アクターの定義',
    description:
      'アクターはゲーム内のオブジェクト（プレイヤー、敵、UI要素など）です。Node Canvas 上でビジュアルに配置します。',
    details: [
      'Node Canvas 上で右クリック → 「Add Actor」を選択',
      'アクターの名前とロール（Actor / Scene / Sequence）を設定',
      'アクター間をドラッグしてデータフロー接続を作成',
      'アクターをグループ化して親子関係を構築',
    ],
    tips: [
      'Ctrl+D でアクターを素早く複製できます',
      '右クリックメニューから「Save as Prefab」で再利用可能なテンプレートに保存',
    ],
  },
  {
    number: 3,
    title: 'Select & Define Modules',
    titleJa: 'モジュールの選択と定義',
    description:
      'コンポーネント（モジュール）をアクターにアタッチして、機能を定義します。',
    details: [
      'アクターノードをクリック → 「Components」ボタンで Component Picker を開く',
      '必要なコンポーネント（UI / Logic / System / GameObject）を選択してアタッチ',
      '「+ New Component」で新しいコンポーネントを作成',
      'Component Editor で変数・タスク・依存関係を詳細に定義',
    ],
    tips: [
      'コンポーネントは Category と Domain で整理されています',
      'タスクの入出力ポートがノード間の接続ポイントになります',
      '依存関係を設定すると、Component Picker で警告が表示されます',
    ],
  },
  {
    number: 4,
    title: 'Implement Code',
    titleJa: 'コードの実装',
    description:
      'ビジュアルデザインが完成したら、ars-codegen CLI を使用してコードを自動生成します。',
    details: [
      'プロジェクトを保存（Ctrl+S）',
      'ars-codegen CLI でプロジェクトファイルを読み込み',
      'AI が設計情報をもとにコードを自動生成',
      '生成されたコードをカスタマイズ・調整',
    ],
    tips: [
      'MCP Server を使えば Claude Code から直接プロジェクトにアクセス可能',
      'Preview パネルでシーン構造を確認してからコード生成すると効率的',
    ],
  },
  {
    number: 5,
    title: 'Run & Test',
    titleJa: '実行とテスト',
    description:
      '生成されたコードをビルド・実行し、テストを行います。',
    details: [
      'Component Editor の TestCase セクションでテストケースを定義',
      '生成コードをビルドして動作確認',
      '問題があれば Ars Editor に戻って設計を修正',
      '修正後は再度コード生成→テストのサイクルを繰り返す',
    ],
    tips: [
      'Preview パネルの「Copy Scene JSON」でシーンデータをエクスポート可能',
      'Prefab を活用すると、テスト済みパーツの再利用が容易になります',
    ],
  },
];

export function GettingStartedGuide({ onClose }: GettingStartedGuideProps) {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-bold text-white">Getting Started</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              サンプルゲームを作るための5つのステップ
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Step Navigation */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s.number}
              onClick={() => setActiveStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                i === activeStep
                  ? 'bg-blue-600 text-white'
                  : i < activeStep
                    ? 'bg-green-900/40 text-green-400 border border-green-800'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  i === activeStep
                    ? 'bg-white text-blue-600'
                    : i < activeStep
                      ? 'bg-green-400 text-green-900'
                      : 'bg-zinc-600 text-zinc-300'
                }`}
              >
                {i < activeStep ? '✓' : s.number}
              </span>
              <span className="hidden sm:inline">{s.titleJa}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step Title */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                {step.number}
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {step.titleJa}
                </h3>
                <p className="text-xs text-zinc-500">{step.title}</p>
              </div>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Details */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              手順
            </h4>
            <ol className="space-y-2">
              {step.details.map((detail, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-zinc-300"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {detail}
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              Tips
            </h4>
            <ul className="space-y-1.5">
              {step.tips.map((tip, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-400 flex items-start gap-2"
                >
                  <span className="text-amber-400 mt-0.5 shrink-0">*</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-700">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="text-sm px-4 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            {activeStep + 1} / {STEPS.length}
          </span>
          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="text-sm px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm px-4 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
            >
              Start!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
