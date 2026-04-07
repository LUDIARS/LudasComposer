import { create } from 'zustand';
import type { Project, Actor, Connection, Component, Scene, SequenceStep, KeyBinding } from '@/types/domain';

import { createSceneAction, deleteSceneAction, renameSceneAction } from './sceneActions';
import {
  addActorAction, removeActorAction, updateActorPositionAction,
  setActorComponentsAction, setActorParentAction, renameActorAction, duplicateActorAction,
} from './actorActions';
import {
  setActorSequencesAction, addSequenceStepAction, removeSequenceStepAction,
  updateSequenceStepAction, setActorSubSceneAction,
} from './sequenceActions';
import { createPrefabAction, deletePrefabAction, renamePrefabAction, instantiatePrefabAction } from './prefabActions';
import { addConnectionAction, removeConnectionAction, upsertComponentAction, deleteComponentAction } from './connectionActions';
import {
  addSceneStateAction, removeSceneStateAction, renameSceneStateAction,
  setActiveStateAction, addKeyBindingAction, updateKeyBindingAction, removeKeyBindingAction,
} from './sceneStateActions';

interface ProjectActions {
  // Scene actions
  createScene: (name: string) => void;
  deleteScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  setActiveScene: (id: string | null) => void;

  // Actor actions
  addActor: (sceneId: string, actor: Omit<Actor, 'id'> & { id?: string }) => string;
  removeActor: (sceneId: string, actorId: string) => void;
  updateActorPosition: (sceneId: string, actorId: string, pos: { x: number; y: number }) => void;
  setActorComponents: (sceneId: string, actorId: string, componentIds: string[]) => void;
  setActorParent: (sceneId: string, actorId: string, parentId: string | null) => void;
  renameActor: (sceneId: string, actorId: string, name: string) => void;
  duplicateActor: (sceneId: string, actorId: string, offset?: { x: number; y: number }) => string | null;

  // Sequence actions
  setActorSequences: (sceneId: string, actorId: string, sequences: SequenceStep[]) => void;
  addSequenceStep: (sceneId: string, actorId: string, step: Omit<SequenceStep, 'id'>) => void;
  removeSequenceStep: (sceneId: string, actorId: string, stepId: string) => void;
  updateSequenceStep: (sceneId: string, actorId: string, stepId: string, updates: Partial<SequenceStep>) => void;

  // SubScene actions
  setActorSubScene: (sceneId: string, actorId: string, subSceneId: string | null) => void;

  // Prefab actions
  createPrefab: (name: string, sceneId: string, actorId: string) => string | null;
  deletePrefab: (id: string) => void;
  renamePrefab: (id: string, name: string) => void;
  instantiatePrefab: (prefabId: string, sceneId: string, position: { x: number; y: number }) => string | null;

  // Connection actions
  addConnection: (sceneId: string, connection: Omit<Connection, 'id'>) => void;
  removeConnection: (sceneId: string, connectionId: string) => void;

  // Component actions
  upsertComponent: (component: Component) => void;
  deleteComponent: (id: string) => void;

  // Scene State actions
  addSceneState: (sceneId: string, name: string) => string;
  removeSceneState: (sceneId: string, stateId: string) => void;
  renameSceneState: (sceneId: string, stateId: string, name: string) => void;
  setActiveState: (sceneId: string, stateId: string | null) => void;

  // KeyBinding actions
  addKeyBinding: (sceneId: string, stateId: string, binding: Omit<KeyBinding, 'id'>) => string;
  updateKeyBinding: (sceneId: string, stateId: string, bindingId: string, updates: Partial<KeyBinding>) => void;
  removeKeyBinding: (sceneId: string, stateId: string, bindingId: string) => void;

  // Project actions
  loadProject: (project: Project) => void;
  getActiveScene: () => Scene | null;
}

interface ProjectState {
  project: Project;
}

const initialProject: Project = {
  name: 'Untitled Project',
  scenes: {},
  components: {},
  prefabs: {},
  activeSceneId: null,
};

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  project: initialProject,

  // Scene
  createScene: (name) => set((state) => createSceneAction(state.project, name)),
  deleteScene: (id) => set((state) => deleteSceneAction(state.project, id)),
  renameScene: (id, name) => set((state) => ({ project: renameSceneAction(state.project, id, name) })),
  setActiveScene: (id) => set((state) => ({ project: { ...state.project, activeSceneId: id } })),

  // Actor
  addActor: (sceneId, actorData) => {
    const result = addActorAction(get().project, sceneId, actorData);
    set({ project: result.project });
    return result.id;
  },
  removeActor: (sceneId, actorId) => set((state) => ({ project: removeActorAction(state.project, sceneId, actorId) })),
  updateActorPosition: (sceneId, actorId, pos) => set((state) => ({ project: updateActorPositionAction(state.project, sceneId, actorId, pos) })),
  setActorComponents: (sceneId, actorId, componentIds) => set((state) => ({ project: setActorComponentsAction(state.project, sceneId, actorId, componentIds) })),
  setActorParent: (sceneId, actorId, parentId) => set((state) => ({ project: setActorParentAction(state.project, sceneId, actorId, parentId) })),
  renameActor: (sceneId, actorId, name) => set((state) => ({ project: renameActorAction(state.project, sceneId, actorId, name) })),
  duplicateActor: (sceneId, actorId, offset) => {
    const result = duplicateActorAction(get().project, sceneId, actorId, offset);
    set({ project: result.project });
    return result.newId;
  },

  // Sequence
  setActorSequences: (sceneId, actorId, sequences) => set((state) => ({ project: setActorSequencesAction(state.project, sceneId, actorId, sequences) })),
  addSequenceStep: (sceneId, actorId, stepData) => set((state) => ({ project: addSequenceStepAction(state.project, sceneId, actorId, stepData) })),
  removeSequenceStep: (sceneId, actorId, stepId) => set((state) => ({ project: removeSequenceStepAction(state.project, sceneId, actorId, stepId) })),
  updateSequenceStep: (sceneId, actorId, stepId, updates) => set((state) => ({ project: updateSequenceStepAction(state.project, sceneId, actorId, stepId, updates) })),

  // SubScene
  setActorSubScene: (sceneId, actorId, subSceneId) => set((state) => ({ project: setActorSubSceneAction(state.project, sceneId, actorId, subSceneId) })),

  // Prefab
  createPrefab: (name, sceneId, actorId) => {
    const result = createPrefabAction(get().project, name, sceneId, actorId);
    set({ project: result.project });
    return result.prefabId;
  },
  deletePrefab: (id) => set((state) => ({ project: deletePrefabAction(state.project, id) })),
  renamePrefab: (id, name) => set((state) => ({ project: renamePrefabAction(state.project, id, name) })),
  instantiatePrefab: (prefabId, sceneId, position) => {
    const result = instantiatePrefabAction(get().project, prefabId, sceneId, position);
    set({ project: result.project });
    return result.newId;
  },

  // Connection
  addConnection: (sceneId, connectionData) => set((state) => ({ project: addConnectionAction(state.project, sceneId, connectionData) })),
  removeConnection: (sceneId, connectionId) => set((state) => ({ project: removeConnectionAction(state.project, sceneId, connectionId) })),

  // Component
  upsertComponent: (component) => set((state) => ({ project: upsertComponentAction(state.project, component) })),
  deleteComponent: (id) => set((state) => ({ project: deleteComponentAction(state.project, id) })),

  // Scene State
  addSceneState: (sceneId, name) => {
    const result = addSceneStateAction(get().project, sceneId, name);
    set({ project: result.project });
    return result.stateId;
  },
  removeSceneState: (sceneId, stateId) => set((state) => ({ project: removeSceneStateAction(state.project, sceneId, stateId) })),
  renameSceneState: (sceneId, stateId, name) => set((state) => ({ project: renameSceneStateAction(state.project, sceneId, stateId, name) })),
  setActiveState: (sceneId, stateId) => set((state) => ({ project: setActiveStateAction(state.project, sceneId, stateId) })),

  // KeyBinding
  addKeyBinding: (sceneId, stateId, bindingData) => {
    const result = addKeyBindingAction(get().project, sceneId, stateId, bindingData);
    set({ project: result.project });
    return result.bindingId;
  },
  updateKeyBinding: (sceneId, stateId, bindingId, updates) => set((state) => ({ project: updateKeyBindingAction(state.project, sceneId, stateId, bindingId, updates) })),
  removeKeyBinding: (sceneId, stateId, bindingId) => set((state) => ({ project: removeKeyBindingAction(state.project, sceneId, stateId, bindingId) })),

  // Project
  loadProject: (project) => set({
    project: {
      ...project,
      prefabs: project.prefabs ?? {},
      scenes: Object.fromEntries(
        Object.entries(project.scenes).map(([k, scene]) => [
          k,
          {
            ...scene,
            states: scene.states ?? [],
            activeStateId: scene.activeStateId ?? null,
            actors: Object.fromEntries(
              Object.entries(scene.actors).map(([ak, actor]) => [
                ak,
                {
                  ...actor,
                  sequences: actor.sequences ?? [],
                  subSceneId: actor.subSceneId ?? null,
                  prefabId: actor.prefabId ?? null,
                },
              ]),
            ),
          },
        ]),
      ),
    },
  }),

  getActiveScene: () => {
    const { project } = get();
    if (!project.activeSceneId) return null;
    return project.scenes[project.activeSceneId] ?? null;
  },
}));
