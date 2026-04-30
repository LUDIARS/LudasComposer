# HitResolver 設計

## 概要

攻撃 (`Hitbox`) と被弾形状 (`Hurtbox`) の交差を解決し、 ダメージ / パリィ / スタガー / ヒットストップを生成する。 純粋関数寄り。

## 配置

- `crates/game-action/src/combat/resolver.rs`

## 公開 API

```rust
pub struct HitEvent {
    pub attacker: ActorId,
    pub defender: ActorId,
    pub at:       Vec3,
    pub frame:    u64,
    pub move_id:  MoveId,
    pub damage:   i32,
    pub posture:  i32,
    pub kind:     HitKind,    // Light / Heavy / Throw
}

pub enum HitOutcome {
    Damaged   { amount: i32, posture_added: i32 },
    Parried   { punish_frames: u32, attacker_staggered: bool },
    Blocked   { chip: i32, posture_added: i32 },
    Invincible,
}

pub fn resolve(
    event: &HitEvent,
    attacker: &mut Combatant,
    defender: &mut Combatant,
    world: &mut WorldFx,    // hitstop / vfx 出力先
) -> HitOutcome;
```

## 解決順序

```text
1. defender.is_invincible() == true → Invincible (ダメージ無効、 SE のみ)
2. defender.is_parrying(attacker, event.frame) → Parried
   - attacker.posture += event.move.parry_punish
   - attacker.fsm.go_to(Stagger)
   - VFX: parry spark
3. defender.is_blocking(event) → Blocked
   - chip = event.damage * BLOCK_CHIP_RATIO
   - defender.health.apply_damage(chip)
   - defender.posture.add(event.posture * BLOCK_POSTURE_RATIO)
4. それ以外 → Damaged
   - defender.health.apply_damage(event.damage)
   - defender.posture.add(event.posture)
   - defender.fsm.go_to(Hit)
   - hitstop(event.kind の table に従う)
```

## ヒットストップの掛け方

- `world.set_time_scale(0.0)` を `hitstop_ms` だけ持続 (`ergo_world_time`)
- 攻撃側 / 被弾側双方を停止させる (片側のみだと違和感)
- BG / UI は別レイヤーで動かす

## テスト

- 各 `HitOutcome` への分岐が正しい (パリィ → ブロック → ダメージ → 無敵 の優先順)
- パリィ punish が `attacker.posture` に蓄積される
- 無敵中は `defender.health` が変化しない
- ブロック削りが端数 (1 ダメージ) を最低保証する (0 にしない)
- 同じ `HitEvent` は重複解決しない (frame + move_id でハッシュ)
