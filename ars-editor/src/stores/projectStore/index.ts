import { create } from 'zustand';
import type { Project, Actor, Message, Component, Scene, Requirements, ActorState, Display } from '@/types/domain';

import { createSceneAction, deleteSceneAction, renameSceneAction } from './sceneActions';
import {
  addActorAction, removeActorAction, updateActorPositionAction,
  renameActorAction, duplicateActorAction,
  setActorTypeAction, setActorRequirementsAction,
  setActorStatesAction, addActorStateAction, removeActorStateAction, updateActorStateAction,
  setFlexibleContentAction, setActorSubSceneAction,
  addDisplayAction, removeDisplayAction, updateDisplayAction,
} from './actorActions';
import { createPrefabAction, deletePrefabAction, renamePrefabAction, instantiatePrefabAction } from './prefabActions';
import { addMessageAction, removeMessageAction, updateMessageAction, upsertComponentAction, deleteComponentAction } from './connectionActions';

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
  renameActor: (sceneId: string, actorId: string, name: string) => void;
  duplicateActor: (sceneId: string, actorId: string, offset?: { x: number; y: number }) => string | null;

  // Actor type & requirements
  setActorType: (sceneId: string, actorId: string, actorType: string) => void;
  setActorRequirements: (sceneId: string, actorId: string, requirements: Requirements) => void;

  // Actor state machine (for State type)
  setActorStates: (sceneId: string, actorId: string, actorStates: ActorState[]) => void;
  addActorState: (sceneId: string, actorId: string, name: string) => string;
  removeActorState: (sceneId: string, actorId: string, stateId: string) => void;
  updateActorState: (sceneId: string, actorId: string, stateId: string, updates: Partial<ActorState>) => void;

  // Flexible content
  setFlexibleContent: (sceneId: string, actorId: string, content: string) => void;

  // Display actions
  addDisplay: (sceneId: string, actorId: string, name: string) => string;
  removeDisplay: (sceneId: string, actorId: string, displayId: string) => void;
  updateDisplay: (sceneId: string, actorId: string, displayId: string, updates: Partial<Display>) => void;

  // SubScene actions
  setActorSubScene: (sceneId: string, actorId: string, subSceneId: string | null) => void;

  // Prefab actions
  createPrefab: (name: string, sceneId: string, actorId: string) => string | null;
  deletePrefab: (id: string) => void;
  renamePrefab: (id: string, name: string) => void;
  instantiatePrefab: (prefabId: string, sceneId: string, position: { x: number; y: number }) => string | null;

  // Message actions (domain-to-domain)
  addMessage: (sceneId: string, message: Omit<Message, 'id'>) => void;
  removeMessage: (sceneId: string, messageId: string) => void;
  updateMessage: (sceneId: string, messageId: string, updates: Partial<Message>) => void;

  // Component actions
  upsertComponent: (component: Component) => void;
  deleteComponent: (id: string) => void;

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
  renameActor: (sceneId, actorId, name) => set((state) => ({ project: renameActorAction(state.project, sceneId, actorId, name) })),
  duplicateActor: (sceneId, actorId, offset) => {
    const result = duplicateActorAction(get().project, sceneId, actorId, offset);
    set({ project: result.project });
    return result.newId;
  },

  // Actor type & requirements
  setActorType: (sceneId, actorId, actorType) => set((state) => ({ project: setActorTypeAction(state.project, sceneId, actorId, actorType) })),
  setActorRequirements: (sceneId, actorId, requirements) => set((state) => ({ project: setActorRequirementsAction(state.project, sceneId, actorId, requirements) })),

  // Actor state machine
  setActorStates: (sceneId, actorId, actorStates) => set((state) => ({ project: setActorStatesAction(state.project, sceneId, actorId, actorStates) })),
  addActorState: (sceneId, actorId, name) => {
    const result = addActorStateAction(get().project, sceneId, actorId, name);
    set({ project: result.project });
    return result.stateId;
  },
  removeActorState: (sceneId, actorId, stateId) => set((state) => ({ project: removeActorStateAction(state.project, sceneId, actorId, stateId) })),
  updateActorState: (sceneId, actorId, stateId, updates) => set((state) => ({ project: updateActorStateAction(state.project, sceneId, actorId, stateId, updates) })),

  // Flexible content
  setFlexibleContent: (sceneId, actorId, content) => set((state) => ({ project: setFlexibleContentAction(state.project, sceneId, actorId, content) })),

  // Display
  addDisplay: (sceneId, actorId, name) => {
    const { project, displayId } = addDisplayAction(get().project, sceneId, actorId, name);
    set({ project });
    return displayId;
  },
  removeDisplay: (sceneId, actorId, displayId) => set((state) => ({ project: removeDisplayAction(state.project, sceneId, actorId, displayId) })),
  updateDisplay: (sceneId, actorId, displayId, updates) => set((state) => ({ project: updateDisplayAction(state.project, sceneId, actorId, displayId, updates) })),

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

  // Message
  addMessage: (sceneId, messageData) => set((state) => ({ project: addMessageAction(state.project, sceneId, messageData) })),
  removeMessage: (sceneId, messageId) => set((state) => ({ project: removeMessageAction(state.project, sceneId, messageId) })),
  updateMessage: (sceneId, messageId, updates) => set((state) => ({ project: updateMessageAction(state.project, sceneId, messageId, updates) })),

  // Component
  upsertComponent: (component) => set((state) => ({ project: upsertComponentAction(state.project, component) })),
  deleteComponent: (id) => set((state) => ({ project: deleteComponentAction(state.project, id) })),

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
            messages: scene.messages ?? [],
            actors: Object.fromEntries(
              Object.entries(scene.actors).map(([ak, actor]) => [
                ak,
                {
                  ...actor,
                  actorType: actor.actorType ?? 'simple',
                  requirements: actor.requirements ?? { overview: [], goals: [], role: [], behavior: [] },
                  actorStates: actor.actorStates ?? [],
                  flexibleContent: actor.flexibleContent ?? '',
                  displays: actor.displays ?? [],
                  subSceneId: actor.subSceneId ?? null,
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
