# action — レイヤ設計

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 4: Host (game-action-app / 各タイトル固有)                │
│   シーン構築 / 各章のスクリプト / 演出オーバーライド            │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Actor (game-action / アクター + FSM)                   │
│   PlayerActor / EnemyActor / Boss / Cinematic                  │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Subsystem (game-action / 戦闘 / カメラ / レベル)       │
│   HitResolver / CameraRig / LevelLoader / Checkpoint           │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Ergo modules (再利用 = ジャンル横断)                  │
│   ergo_health / ergo_input_buffer / ergo_world_time / ...      │
└──────────────────────────────────────────────────────────────┘
```

## 各レイヤの責務

### Layer 1 (Ergo)

- 純粋ロジックの土台。 ホットスワップ可能で他ジャンルからも参照される。
- 例: `ergo_health` は `health-system` を実装。 `ergo_world_time` はヒットストップに必要な time-scale を提供。

### Layer 2 (Subsystem)

- このジャンル特有のサブシステムだが、 個別アクターには依存しない。
- 例: `HitResolver` は Hitbox / Hurtbox を引数に受け取り、 結果 `HitOutcome` を返す純粋に近い処理。

### Layer 3 (Actor)

- ゲームの登場物 = アクター。 入力 / FSM / Subsystem の組合せ。
- 例: `PlayerActor` = `Buffer` + `Health` + `Posture` + `Stamina` + `FSM`

### Layer 4 (Host)

- タイトル固有の組み立て。 スクリプト演出やボス独自挙動はここ。
- どの章で誰を登場させるか、 演出のタイミング、 UI / ステージ表示など。

## 依存方向

- 上位レイヤ → 下位レイヤ のみ。 逆参照禁止。
- Layer 1 (Ergo) は他 Layer を知らない。 Layer 4 (Host) は他全レイヤを知る。

## クレート分割案

| クレート | 内容 | 主な依存 |
|---------|------|---------|
| `game-action-core` | Hitbox / Hurtbox / FrameData / HitEvent | (なし) |
| `game-action-actor` | PlayerActor / EnemyActor / FSM | game-action-core, ergo_* |
| `game-action-combat` | HitResolver / Posture / Hitstop | game-action-core, ergo_world_time |
| `game-action-camera` | Camera follow + Lockon + Shake | game-action-core |
| `game-action-level` | Checkpoint + Region + Spawner | game-action-core |
| `game-action-app` | バイナリ / シーン構成 | 上記すべて |

## イベントとデータフロー

`PlayerActor.tick` のサブシステム呼出パターン:

```text
PlayerActor.tick
  ├─ input_buffer.next_command()
  ├─ FSM.dispatch(cmd) → state 遷移
  ├─ FSM.tick(dt, ctx)
  │     ├─ Move:  transform 更新
  │     ├─ Attack: ctx.combat.spawn_hitbox(...)
  │     ├─ Dodge:  ctx.combat.set_invincible(...)
  │     └─ Parry:  ctx.combat.parry_window(...)
  ├─ stamina / posture regen
  └─ health.tick(dt)
```

`spawn_hitbox` 後は次フレームの broadphase で他アクターの hurtbox と交差判定 → `HitResolver::resolve` → 各 actor に結果を Pull で取りに行かせる。

```text
Frame N:
  All actors tick (writes hitboxes / hurtboxes / events)
Frame N: end
  Combat broadphase scan → list<HitEvent>
  for ev: HitResolver::resolve(ev, ...)
  for ev: actors.apply_outcome(ev)

Frame N+1:
  apply_outcome の結果を踏まえて各 actor が tick
```
