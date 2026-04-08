import type { Variable, Task } from '@/types/domain';
import type { ComponentCategory } from '@/types/domain';

/** A module template to be injected into the project as a Component */
export interface ModuleTemplate {
  name: string;
  category: ComponentCategory;
  domain: string;
  variables: Variable[];
  tasks: Pick<Task, 'name' | 'description' | 'inputs' | 'outputs'>[];
}

/** A design pattern that injects specific modules (plugin injection) */
export interface DesignPattern {
  id: string;
  /** i18n key for the pattern name */
  nameKey: string;
  /** i18n key for the description */
  descKey: string;
  /** Modules injected when this pattern is selected */
  modules: ModuleTemplate[];
  /** Whether this pattern is recommended for the archetype */
  recommended: boolean;
}

/** A game archetype providing a starting set of modules and optional design patterns */
export interface GameArchetype {
  id: string;
  /** i18n key for the archetype name */
  nameKey: string;
  /** i18n key for the description */
  descKey: string;
  icon: string;
  color: string;
  /** Google search keyword for this archetype */
  searchKeyword: string;
  /** Core modules always injected with this archetype */
  coreModules: ModuleTemplate[];
  /** Optional design patterns the user can select */
  designPatterns: DesignPattern[];
}

/** Cached AI hearing response */
export interface AiHearingEntry {
  question: string;
  answer: string;
  timestamp: number;
}

export type WizardStep = 'archetype' | 'design' | 'modules';
