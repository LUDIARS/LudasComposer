# rhythm — レイヤ設計

## 設計原則

**audio engine の再生位置 = 唯一のクロック**。 描画フレーム時刻ではなく audio clock を全コンポーネントが参照する。

```
┌──────────────────────────────┐
│ Host (game-rhythm-app)       │
│   タイトル / メニュー / ライブラリ│
├──────────────────────────────┤
│ Play / Edit                  │
│   game-rhythm-core (PlayState)│
│   game-rhythm-edit            │
├──────────────────────────────┤
│ Chart / Library              │
│   game-rhythm-chart           │
│   game-rhythm-data            │
├──────────────────────────────┤
│ Render / Audio / Input       │
│   game-rhythm-render          │
│   game-rhythm-audio           │
│   game-rhythm-input (低遅延)  │
├──────────────────────────────┤
│ Ergo modules                 │
│   ergo_timing_judge / _combo_counter / _score / _audio│
└──────────────────────────────┘
```

## 同期図

```
Audio device tick (= source of truth)
       │
       ▼
   AudioClock.now_ms_raw
       │
       ├─ + user_offset_ms → now_for_judge   (PlayState の判定)
       └─ + video_offset_ms → now_for_render (NoteRenderer の描画位置)

Input event (low-latency thread)
       │
       ▼
   PlayState::on_input(lane)
       │
       ├─ NoteScheduler::judge_window
       └─ ergo_timing_judge::judge → bump combo/score
```

## クレート分割

| クレート | 内容 |
|---------|------|
| `game-rhythm-core` | PlayState + NoteScheduler + Stats |
| `game-rhythm-audio` | AudioEngine wrapper (ASIO/WASAPI/CoreAudio bindings) |
| `game-rhythm-input` | OS 直接入力 hot path (kbd / touch / midi) |
| `game-rhythm-chart` | ChartDef + Loader (osu/bms/sm/独自 json) |
| `game-rhythm-data` | SongDatabase + プレビュー再生 |
| `game-rhythm-render` | Note 描画 (Pictor 連携) |
| `game-rhythm-edit` | エディタ (任意) |
| `game-rhythm-app` | バイナリ + UI |

## 低遅延入力の方針

- 描画 / sim と独立 thread
- Win: RawInput / Direct Input / MIDI directly。 ハイポーリングデバイスを推奨
- Mac: HID Manager / IOKit
- Web: PointerEvent / KeyboardEvent (これは fallback、 Web 版は妥協)

## 計測の鉄則

- **frame jitter** を計測する PR を必ず付ける
- リリースビルドで dropped frames > 1% なら不合格
- 描画と audio の time lag をテレメトリとして記録 (debug build)
