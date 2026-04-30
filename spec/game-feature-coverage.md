# ゲーム機能カバレッジ表

`spec/game-template/` (17 ジャンル) と `spec/game-lexicon/` (Feature 単体辞書) を突き合わせ、 さらに **Ergo** が実装済 / 計画中の機能を一覧する。

## 0. サマリ (2026-05-01 時点)

| 集合 | 件数 |
|------|------|
| game-lexicon に定義済 Feature | **43** |
| game-template から参照される ID 総数 | **約 200** |
| そのうち lexicon に存在しないもの (要追加候補) | **約 160** |
| Ergo が直接実装している lexicon Feature | **4** (`health-system`, `score-system`, `combo-counter`, `timing-judge`) |
| Ergo が部分支援している lexicon Feature | **6** (`input-buffer`, `audio-sync`, `hitstop`, `save-load`, `bullet-pattern`, `stat-system`) |

→ Ergo の lexicon カバー率は **直接 9% / 部分含めて 23%**。 残りは「Game-specific or higher-level」 として、 個別ゲーム crate やプラグインで実装する想定。

## A. lexicon Feature × Ergo 対応表

凡例: ✅ 直接実装 / 🟡 部分支援 (依存 module を組合せて達成可) / ⬜ 未実装

| # | Feature ID | ジャンル | Ergo 状況 | 依存 / 備考 |
|---|------------|---------|----------|-----|
| 1 | `audio-sync` | rhythm | 🟡 | `ergo_audio` (低遅延再生) を起点に user_offset 計算は外側 |
| 2 | `auto-run` | runner | ⬜ | 純ロジック。 1 ファイルで実装可 |
| 3 | `bullet-pattern` | shooter | 🟡 | 描画は `ergo_gpu_particle`、 emitter DSL は要新規 |
| 4 | `camera-follow` | action | ⬜ | 平滑追従 + シェイクの軽量モジュール |
| 5 | `combo-counter` | rhythm | ✅ | `ergo_combo_counter` |
| 6 | `combo-system` | action / fighting | ⬜ | input-buffer + cancel windows の組合せ |
| 7 | `command-battle` | story-jrpg | ⬜ | ATB / Turn / CTB 切替 |
| 8 | `command-input` | fighting | ⬜ | モーションパターン解釈器 |
| 9 | `day-night-cycle` | open-world | 🟡 | `ergo_world_time` を時刻クロックに転用可 |
| 10 | `dialogue-system` | story-jrpg / open-world | ⬜ | テキスト + 選択肢 + 演出 |
| 11 | `dodge-roll` | action | ⬜ | i-frame + cooldown + stamina 消費 |
| 12 | `fast-travel` | open-world | ⬜ | discovered set + cost |
| 13 | `frame-data` | fighting | ⬜ | startup/active/recovery テーブル |
| 14 | `guard-throw` | fighting | ⬜ | 三すくみ + 投げ抜け |
| 15 | `health-system` | core | ✅ | `ergo_health` |
| 16 | `hero-skill` | moba / action | ⬜ | スロット + cooldown + 解放レベル |
| 17 | `hex-grid` | slg | ⬜ | hex / square 切替 grid |
| 18 | `hitbox-system` | core | ⬜ | AABB / sphere / OBB の交差検査 |
| 19 | `hitstop` | action / fighting | 🟡 | `ergo_world_time` の `set_scale` で時間停止可、 ms 制御は外側 |
| 20 | `input-buffer` | core | 🟡 | `ergo_input` を起点に「200ms 保持 + コマンド消化」 ラッパが要 |
| 21 | `inventory` | core | ⬜ | スロット + スタック + 重量 |
| 22 | `lane-system` | runner | ⬜ | lane index + 移動補間 |
| 23 | `leveling` | story-jrpg / moba | ⬜ | XP テーブル + Lv 上昇 |
| 24 | `minion-wave` | moba | ⬜ | 一定間隔ウェーブスポーン |
| 25 | `mount-system` | open-world | ⬜ | 騎乗 / 速度倍率 + スタミナ |
| 26 | `note-chart` | rhythm | ⬜ | 譜面ファイル loader |
| 27 | `pickup-system` | runner / open-world | ⬜ | 磁石半径 + スコア / アイテム |
| 28 | `procedural-track` | runner | ⬜ | チャンク前方生成 + 後方破棄 |
| 29 | `projectile-system` | shooter | ⬜ | プール + 寿命 + 速度 |
| 30 | `quest-system` | story-jrpg / open-world | ⬜ | クエスト + ステップ + フラグ |
| 31 | `recoil` | shooter / fps | ⬜ | 跳ねパターン + 自動戻り |
| 32 | `resource-economy` | slg | ⬜ | 多資源 + 生産 / 消費 |
| 33 | `rollback-netcode` | moba / fighting | ⬜ | スナップショット + reconcile |
| 34 | `round-system` | fighting | ⬜ | 先取数 + 時間切れ |
| 35 | `save-load` | core | 🟡 | `ergo_io` でファイル I/O は揃う、 スロット概念は外側 |
| 36 | `score-system` | core | ✅ | `ergo_score` |
| 37 | `stat-system` | story-jrpg / moba / slg | 🟡 | `ergo_blackboard` で派生実装可 |
| 38 | `tech-tree` | slg | ⬜ | 前提 DAG + tier |
| 39 | `timing-judge` | rhythm | ✅ | `ergo_timing_judge` |
| 40 | `tower-objective` | moba | ⬜ | 固定建造物 + 範囲攻撃 |
| 41 | `unit-action` | slg | ⬜ | 1 ターン行動 |
| 42 | `weapon-system` | shooter / fps | ⬜ | RPM + magazine + reload |
| 43 | `world-streaming` | open-world | ⬜ | タイル動的 load / unload |

## B. Ergo モジュール → lexicon Feature

Ergo 側から見た「自分は何の Feature の実装か」 表。 **インフラ系** と **ゲーム実装系** に分ける。

### B.1 ゲーム実装系 (ジャンル横断 Feature の実装)

| Ergo モジュール | 主要 lexicon Feature | 種別 |
|----------------|---------------------|------|
| `ergo_health` | `health-system` | ✅ 直接 |
| `ergo_score` | `score-system` | ✅ 直接 |
| `ergo_combo_counter` | `combo-counter` | ✅ 直接 |
| `ergo_timing_judge` | `timing-judge` | ✅ 直接 |

### B.2 インフラ / 描画 / I/O (Feature を成り立たせる土台)

| Ergo モジュール | 役割 | 関連 lexicon Feature |
|----------------|------|----------------------|
| `ergo_input` | キーボード / マウス / パッド / HID 統一入力 | `input-buffer` の土台 |
| `ergo_audio` | 低遅延音声 (FMOD or dummy) | `audio-sync` の土台 |
| `ergo_sound` | WAV decode + ミキサ + Quantizer | rhythm 系の音源再生に転用 |
| `ergo_world_time` | グローバル time-scale (hit-stop / hit-slow) | `hitstop` の機構提供 |
| `ergo_blackboard` | 名前付きプロパティレジストリ | `stat-system` 等の値ストア |
| `ergo_bind` | ホスト変数を WS 公開 | ライブチューニング |
| `ergo_frame` | 累計フレーム数 + FPS HUD | 全 Feature 共通 |
| `ergo_log` | 4-level ロガー | デバッグ |
| `ergo_io` | ファイル / パス I/O | `save-load` の土台 |
| `ergo_particle` / `ergo_gpu_particle` | パーティクル | `bullet-pattern` の描画側 |
| `ergo_actor` | アクター基盤 | 全 Feature の親 |
| `ergo_ui` | SVG ラスタ + 9-slice | UI 描画一般 |
| `ergo_custos` | 遠隔テストランナー HTTP ブリッジ | テスト |

> 「Ergo が **lexicon の 1 機能をまるごと提供する**」 と言えるのは現状 **B.1 の 4 つだけ**。 B.2 は土台で、 lexicon の Feature を完成させるには 「B.2 + 薄いラッパ」 が必要。

## C. game-template から参照されるが lexicon に未定義の ID

新規 Feature 候補。 ジャンル別に整理。 末尾の括弧は出現テンプレ。

### コア / 横断

- `crafting` — クラフト全般 (jrpg, hns, open_world)
- `currency` — 通貨 (puzzle, hns, jrpg, slg, deckbuilder)
- `equipment-slots` — 装備スロット (jrpg, hns)
- `meta-progression` — メタ進行 (vampsurv, deckbuilder, puzzle)
- `seeded-rng` — シード固定 RNG (roguelike, deckbuilder, shmup, fight)
- `replay` — 入力ログ再生 (fight, moba, fps, shmup)
- `loadout` — 装備プリセット (fps, moba)

### action / ARPG

- `lockon` — ターゲットロック
- `parry-system` — パリィ
- `posture-stagger` — 体幹ゲージ (SEKIRO 由来)
- `enemy-ai-states` — 敵 FSM
- `stamina-system` — スタミナ消費

### platformer / metroidvania

- `player-controller-2d`, `jump-physics`, `tile-collision`
- `stomp-detect`, `respawn-system`, `camera-2d-follow`, `parallax-bg`
- `level-loader`
- `ability-system`, `gate-trigger`, `interconnected-rooms`
- `minimap-system`, `save-room`, `secret-detect`, `item-pickup`, `lore-collectible`

### vampsurv

- `entity-pool`, `spatial-hash`, `xp-pickup`, `wave-spawner`
- `weapon-auto-fire`, `weapon-evolution`, `damage-numbers`

### slg / strategy

- `movement-range`, `attack-range`, `battle-forecast`, `class-system`
- `turn-manager`, `unit-ai`, `victory-defeat`, `map-loader`, `level-up-screen`
- `fog-of-war`, `city`, `unit-types`, `civic-tree`, `diplomacy`, `trade-route`
- `event-system`, `victory-condition`, `notification-queue`

### puzzle / casual

- `grid-puzzle`, `match-detect`, `cascade-resolve`, `booster-piece`
- `move-counter`, `goal-tracker`, `stage-loader`, `life-system`
- `booster-inventory`, `ads-iap`, `push-retention`, `analytics`

### roguelike (berlin)

- `turn-engine`, `procgen-dungeon`, `fov`, `grid-actor`, `hunger`
- `item-identify`, `combat-melee`, `magic-spells`, `monster-ai`
- `trap-system`, `stair-descent`, `permadeath`, `message-log`

### deckbuilder

- `card-pile`, `draw-shuffle`, `energy`, `card-effect`, `targeting`
- `turn-cycle`, `enemy-intent`, `block-armor`, `status-power`, `relic`
- `node-map`, `reward`, `shop`, `campfire`, `run-record`, `card-database`

### moba

- `neutral-camp`, `item-shop`, `item-database`, `client-prediction`
- `matchmaking`, `ban-pick`, `chat-ping`, `anti-cheat`

### hns / diablo-like

- `character-class`, `skill-tree`, `loot-table`, `item-mods`, `item-rarity`
- `stash`, `skill-bar`, `ground-loot`, `procgen-map`, `difficulty-tiers`
- `party-coop`, `seasons`

### fighting

- `super-meter`, `burst-defense`, `counter-hit`, `corner-detect`
- `character-roster`, `training-mode`

### rhythm

- `song-database`, `chart-loader`, `audio-engine`, `input-lowlatency`
- `note-renderer`, `note-types`, `bpm-changes`, `result-screen`
- `chart-editor`, `song-select-ui`

### jrpg

- `party-system`, `skill-learning`, `status-effect`, `elemental-affinity`
- `encounter`, `event-script`, `overworld`

### open world

- `ai-schedule`, `weather-system`, `climb-glide`, `poi-system`
- `reputation`, `chunked-asset-pipeline`

### shmup

- `player-ship`, `bullet-pool`, `graze-system`, `enemy-pattern`
- `scrolling-stage`, `powerup-system`, `bomb-system`, `life-extend`
- `boss-fight`, `continue-system`, `seed-replay`

### fps

- `fps-controller`, `mouse-aim`, `hitscan`, `map-loading`
- `sound-occlusion`, `footstep-system`, `killcam-replay`, `scoreboard`
- `chat-voice`, `ranking`, `server-authoritative`, `lag-compensation`

## D. Ergo 化ロードマップ案

「lexicon にあって Ergo 未実装」 のうち、 **「複数ジャンル横断」 + 「物理 / 描画依存が小さい」** ものを優先候補とする。

### Phase 1 (即着手可)

| 順 | Feature | 想定 Ergo モジュール | 理由 |
|----|---------|---------------------|------|
| 1 | `inventory` | `ergo_inventory` | core / 多くのジャンルで使う |
| 2 | `input-buffer` | `ergo_input_buffer` (or `ergo_input` 拡張) | core / action / fight / rhythm で必須 |
| 3 | `stat-system` | `ergo_stats` | jrpg / moba / hns / slg で必須 |
| 4 | `save-load` (slot) | `ergo_save_slot` | jrpg / open-world / slg |
| 5 | `leveling` | `ergo_leveling` | jrpg / moba / hns |

### Phase 2 (簡易版から)

| 順 | Feature | 想定 Ergo モジュール | 理由 |
|----|---------|---------------------|------|
| 6 | `dialogue-system` | `ergo_dialogue` | jrpg / open-world |
| 7 | `quest-system` | `ergo_quest` | jrpg / open-world |
| 8 | `pickup-system` | `ergo_pickup` | runner / open-world |
| 9 | `note-chart` + loader | `ergo_note_chart` | rhythm |
| 10 | `recoil` | `ergo_recoil` | shooter / fps |

### Phase 3 (依存重め / 物理/ネット領域)

`hitbox-system` / `projectile-system` / `weapon-system` は物理形状・空間検索が要 → Pictor / 専用物理 crate 連携が前提。 `rollback-netcode` はネット基盤 (Synergos 等) との結合点。

## E. game-template と lexicon の整合性タスク

1. C 節の **「最低限プリセットに必須」** Feature は lexicon に追加する (例: action なら `lockon` / `parry-system`、 platformer なら `jump-physics` / `tile-collision`、 fps なら `fps-controller` / `hitscan`)
2. 各テンプレが参照する ID を lexicon の `genres = [...]` に反映
3. 各ジャンルの `presets/*.toml` を、 テンプレで挙げた基本セットと整合させる

## 参照

- 仕様: [`spec/modules/game-lexicon.md`](modules/game-lexicon.md)
- データ: [`spec/game-lexicon/`](game-lexicon/)
- ジャンル別ガイド: [`spec/game-template/`](game-template/)
- Ergo モジュール一覧: <https://github.com/LUDIARS/Ergo/blob/main/module_list.md>
