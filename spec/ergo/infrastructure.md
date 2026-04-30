# Ergo インフラ系モジュール

lexicon Feature を **直接** 提供しない 14 モジュールを網羅する。 これらは「Feature を成り立たせる土台」 として働く。

> 各モジュールの canonical な仕様は [LUDIARS/Ergo/spec/module/](https://github.com/LUDIARS/Ergo/tree/main/spec/module) を真とする。 本ドキュメントは **Ars / 各ジャンルから利用する観点** での要約。

## 1. 一覧と lexicon 寄与

| モジュール | カテゴリ | lexicon 寄与 | 直接実装の Feature 候補 |
|-----------|---------|-------------|------------------------|
| `ergo_actor` | システム | 全 Feature の親 | (基盤) |
| `ergo_input` | システム | `input-buffer` の土台 | (Phase 1: ergo_input_buffer の依存先) |
| `ergo_audio` | システム | `audio-sync` の土台 | rhythm 系の音源再生 |
| `ergo_sound` | システム | (波形処理 / WAV) | rhythm SE / アクション SE |
| `ergo_world_time` | システム | `hitstop` の機構 | action / fighting |
| `ergo_blackboard` | システム | `stat-system` の値ストア候補 | (Phase 1: ergo_stats の依存先) |
| `ergo_bind` | システム | ライブチューニング | デバッグ / 開発支援 |
| `ergo_frame` | システム | 全 Feature 共通 | フレーム / FPS 表示 |
| `ergo_log` | システム | デバッグ | デバッグ |
| `ergo_io` | システム | `save-load` の土台 | (Phase 1: ergo_save_slot の依存先) |
| `ergo_particle` | システム | `bullet-pattern` 描画候補 | shmup / action VFX |
| `ergo_gpu_particle` | システム | `bullet-pattern` 描画候補 | shmup (大量弾) |
| `ergo_ui` | UI | UI 描画一般 | HUD / メニュー / 9-slice |
| `ergo_custos` | システム | テスト | 遠隔テストランナー |
| `ergo_common` | shared | JSON codec | (横断ユーティリティ) |

## 2. ergo_actor

> [`include/ergo/actor/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/actor)

**役割**: アクター基盤 + tick ライフサイクル管理

```cpp
class Actor {
    virtual void on_attach(World&) {}
    virtual void on_detach(World&) {}
    virtual void tick(float dt, TickCtx&) = 0;
};
```

すべてのゲーム内オブジェクト (Player / Enemy / Pickup / etc) は `Actor` を継承して **同じライフサイクル** で動かす設計。 階層構造 (Actor 内に Actor を含む) も許容。

**典型的な使い方**: ゲームループの中で `world.tick_all(dt)` を呼ぶだけで、 全アクターが順次 tick。 詳細は [integration.md](integration.md) §"アクターレイヤ" 参照。

## 3. ergo_input

> [`include/ergo/input/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/input)

**役割**: マウス / キーボード / ゲームパッド / USB HID の **統一入力レイヤ** + **inject API でテスト可能**

主要 API:

```cpp
namespace ergo::input {
    bool  pressed(Button);
    bool  held(Button);
    bool  released(Button);
    float axis(Axis);          // -1.0 〜 +1.0

    // テスト用 inject
    void  inject_press(Button);
    void  inject_axis(Axis, float);
}
```

**lexicon `input-buffer` との関係**: 本モジュールは「現フレームの入力状態」 を提供。 「100-200ms 保持して次行動につなげる」 のは **Phase 1 で `ergo_input_buffer` を新設** する想定。 詳細は [roadmap.md §1](roadmap.md#1-ergo_input_buffer)。

## 4. ergo_audio

> [`include/ergo/audio/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/audio)

**役割**: 低遅延音声再生 (FMOD or dummy)

- backend: `auto / fmod / dummy` (CMake オプション `ERGO_AUDIO_BACKEND`)
- FMOD 未検出時は dummy で動作 (リンクは通る)
- ホスト側で `ergo_audio_stage_runtime(target)` を呼ぶと FMOD ランタイム DLL を target ファイルの隣に staging

**rhythm での使い方**:

```cpp
ergo::audio::Engine engine;
auto track = engine.load("song.ogg");
engine.play(track);

// 取得した audio clock を `now_for_judge()` の計算に使う
int64_t now_ms = engine.position_ms(track);
```

`audio-sync` Feature の **完成形** には user_offset / video_offset の管理 + キャリブレーションが要る。 これは現状ホスト側 (Ars / アプリ) が責務。

## 5. ergo_sound

> [`include/ergo/sound/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/sound)

**役割**: WAV decode + ストリーム + ミキサ + 波形処理 + Quantizer (外部 lib なし)

- `ergo_audio` と違いミドルウェア (FMOD) 無しで動く軽量 SE 用
- 圧縮フォーマットは現在 WAV のみ。 stb_vorbis vendor 化が将来予定

## 6. ergo_world_time

> [`include/ergo/world_time/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/world_time)

**役割**: グローバル time-scale 合成 (hit-stop / hit-slow)

```cpp
namespace ergo::world_time {
    void set_scale(float s);          // 0.0 = 完全停止
    float scale();
    float scaled(float dt);           // dt 経由で減衰
}
```

**hitstop 実装**:

```cpp
void on_hit(int hitstop_ms) {
    ergo::world_time::set_scale(0.0f);
    schedule_after(hitstop_ms, [] {
        ergo::world_time::set_scale(1.0f);
    });
}

// 全アクターは tick 内で
void Actor::tick(float dt, TickCtx&) {
    auto scaled_dt = ergo::world_time::scaled(dt);
    // animation / physics に scaled_dt を渡す
}
```

UI / BGM などは scale 影響を受けたくないので、 個別に `dt_raw` を使い分ける。

## 7. ergo_blackboard

> [`include/ergo/blackboard/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/blackboard)

**役割**: 名前付きプロパティの **グローバルレジストリ** (R3 `Property<T>` 風)

- ホストが `Property<int> hp_;` を持ち、 Engine に名前 ("player.hp") で登録
- 任意のコードから名前で購読可能 (RAII Subscription)
- カテゴリ単位で `release(category)` で一括解除 (シーン切替時など)

**`stat-system` 候補**: HP / MP / 攻 / 防 などを Blackboard に登録すれば、 UI / バフ / セーブ が値変化に反応できる。 **Phase 1 で `ergo_stats` を `ergo_blackboard` のラッパとして実装** が現実解。 詳細は [roadmap.md §3](roadmap.md#3-ergo_stats)。

## 8. ergo_bind

> [`include/ergo/bind/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/bind)

**役割**: ホスト変数を WS で外部エディタに公開 (`BIND_VAR`)

- `tools/ergo` の **variable プラグイン** とペアで使う
- 開発中の数値調整 / バランステストに有用
- リリースビルドではマクロを no-op にして除外

## 9. ergo_frame

> [`include/ergo/frame/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/frame)

**役割**: アプリ起動からの累計フレーム数 + rolling FPS + HUD 文字列

```cpp
auto fc = ergo::frame::counter();
fc.advance();                    // 毎 frame 呼ぶ
auto label = fc.hud_label();     // "Frame: 1234, FPS: 59.8"
```

## 10. ergo_log

> [`include/ergo/log/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/log)

**役割**: 4-level ロガー (Error / Warn / Info / Debug)、 行頭にフレーム番号埋め込み

```cpp
ergo::log::info("HP: {}", hp.hp());      // [F:1234] [INFO] HP: 75
```

スレッドセーフ (mutex 保護)。 出力先は差し替え可能 (stdout / file / network)。

## 11. ergo_io

> [`include/ergo/io/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/io)

**役割**: 最小ファイル / パス I/O (`<filesystem>` の薄ラッパ)

```cpp
auto bytes = ergo::io::read_all(path);
ergo::io::write_all(path, bytes);
ergo::io::create_dir_all(path);
```

`save-load` Feature の **slot 概念** (`save_1.dat` / `save_2.dat` ...) は `ergo_io` の上に **Phase 1 で `ergo_save_slot` ラッパ** を作る予定。 [roadmap.md §4](roadmap.md#4-ergo_save_slot)。

## 12. ergo_particle / ergo_gpu_particle

> [`include/ergo/particle/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/particle) / [`include/ergo/gpu_particle/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/gpu_particle)

| | `ergo_particle` (CPU) | `ergo_gpu_particle` (GPU compute) |
|---|---------------------|----------------------------------|
| 用途 | エフェクト数百個 | 数千-数万、 弾幕系 |
| Renderer | Pictor Vulkan ビルボード (任意) | IGpuBackend 抽象 (Vulkan / WebGPU) |
| Burst cycles / shape variants | 既存 | 一部 TODO |

**bullet-pattern (lexicon)** は描画側を `ergo_gpu_particle` に乗せる候補。 ロジック (emitter pattern) は別レイヤで実装する。

## 13. ergo_ui

> [`include/ergo/ui/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/ui)

**役割**: SVG ラスタ + 9-slice フレーム + グラデーション + Line glow (RGBA8、 Pictor / Vulkan 依存なし)

HUD / ボタン / 数値表示の **軽量 UI コンポーネント** 集。 アンチエイリアス済 RGBA8 を吐くので、 上に Pictor を載せても 任意 OS の描画 API で displayしてもよい。

## 14. ergo_custos

> [`include/ergo/custos/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/custos)

**役割**: Custos 遠隔テストランナーと話す in-process HTTP ブリッジ

- `/health` / `/screenshot` / `/key` のエンドポイントを公開
- 遠隔から Custos が叩いてゲームをテスト
- Pictor 連携で Vulkan swapchain readback を取れる (低レイテンシ画面キャプチャ)

> 関連: [`memory/project_custos.md`](https://github.com/LUDIARS/Custos)、 [`memory/project_ergo_custos.md`](https://github.com/LUDIARS/Ergo)

## 15. ergo_common

> [`include/ergo/common/`](https://github.com/LUDIARS/Ergo/tree/main/include/ergo/common)

**役割**: モジュール横断の小物ユーティリティ。 現状は `ergo::common::jsonm` (minimal JSON codec) のみ。 他モジュールから transitive に取り込まれる。

## 16. 統合の入り口

複数モジュールの組合せパターン (アクター / イベント / セーブ / 同期境界) は [integration.md](integration.md) を参照。
