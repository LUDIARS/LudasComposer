// Domain types — auto-generated from Rust (ars-core).
// Edit crates/ars-core/src/models/ and run ./scripts/generate-types.sh to update.

export type {
  Actor,
  ActorState,
  Component,
  Display,
  Message,
  PortDefinition,
  Position,
  Prefab,
  PrefabActor,
  Project,
  Requirements,
  RequirementRef,
  Scene,
  Task,
  Variable,
} from './generated';

// TS-only convenience types (not in Rust)
export type ActorRole = 'actor' | 'scene';
export type ActorType = 'simple' | 'state' | 'flexible';
export type ComponentCategory = 'UI' | 'Logic' | 'System' | 'GameObject';
