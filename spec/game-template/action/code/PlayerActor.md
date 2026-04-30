# PlayerActor 設計

## 概要

プレイヤーキャラクターを表すアクター。 入力を受けて FSM を駆動し、 各フレームで Move / Attack / Damage 等のサブシステムにディスパッチする。

## 配置

- `crates/game-action/src/player/actor.rs`
- 関連: `crates/game-action/src/player/{fsm.rs,input.rs,stamina.rs,posture.rs}`

## 公開 API

```rust
pub struct PlayerActor {
    fsm: PlayerFSM,
    input: ergo_input_buffer::Buffer,
    health: ergo_health::Health,
    posture: Posture,
    stamina: StaminaPool,
    transform: Transform,
    facing: Facing,
}

impl PlayerActor {
    pub fn new(cfg: PlayerConfig) -> Self { ... }

    /// メインループから 1 frame ぶん駆動する
    pub fn tick(&mut self, dt: f32, ctx: &mut TickCtx);

    /// 外部 (戦闘解決) から HP を減らされる窓口
    pub fn apply_damage(&mut self, amount: i32, source: HitSource);

    /// 外部 (戦闘解決) から体幹を蓄積される窓口
    pub fn apply_posture(&mut self, amount: i32);

    /// 状態取得 (UI / カメラ向け)
    pub fn snapshot(&self) -> PlayerSnapshot;
}
```

## tick 処理フロー

```text
tick(dt):
  1. input.tick(dt)
  2. cmd = input.next_command()
  3. fsm.dispatch(cmd) -> 状態遷移
  4. fsm.tick(dt, ctx)  -> 状態固有のロジック (Move / Attack / Dodge / ...)
     - Move: transform 更新
     - Attack: hitbox 生成 (ctx.combat.spawn_hitbox)
     - Dodge: i-frame 開始 (ctx.combat.set_invincible)
     - Parry: パリィ受付窓開始
  5. posture.regen(dt)
  6. stamina.regen(dt)
  7. health.tick(dt)  // regen
```

## 内部状態

- `fsm.state ∈ {Idle, Walk, Run, Attack(Stage), Dodge, Parry, Hit, Dead}`
- `fsm.frame_in_state` — 状態内経過フレーム
- `posture.value : 0..max` — 体幹蓄積量
- `stamina.value : 0..max` — スタミナ残量

## 依存

- `ergo_input_buffer` — 入力バッファ
- `ergo_health` — HP
- `ergo_world_time` — ヒットストップ時の time-scale 受信側

## テスト

- 入力 → FSM 遷移の網羅 (各 cmd × 各 state で次状態が正しいか)
- スタミナ枯渇時の行動拒否
- パリィ窓内 / 外でのダメージ可否
- ヒット時に combo_count が増える
- HP 0 → state == Dead で他入力が無効
