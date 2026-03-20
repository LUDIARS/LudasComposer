import { create } from 'zustand';
import type { Project, Actor, Connection, Component, Scene, SequenceStep, Prefab, SceneState, KeyBinding } from '@/types/domain';
import { generateId } from '@/lib/utils';

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

  createScene: (name: string) => {
    const sceneId = generateId();
    const rootActorId = generateId();
    const rootActor: Actor = {
      id: rootActorId,
      name,
      role: 'scene',
      components: [],
      children: [],
      position: { x: 250, y: 50 },
      sequences: [],
      subSceneId: null,
      prefabId: null,
    };
    const defaultStateId = generateId();
    const defaultState: SceneState = {
      id: defaultStateId,
      name: 'Default',
      keyBindings: [],
    };
    const scene: Scene = {
      id: sceneId,
      name,
      rootActorId,
      actors: { [rootActorId]: rootActor },
      connections: [],
      states: [defaultState],
      activeStateId: defaultStateId,
    };
    set((state) => ({
      project: {
        ...state.project,
        scenes: { ...state.project.scenes, [sceneId]: scene },
        activeSceneId: sceneId,
      },
    }));
  },

  deleteScene: (id: string) => {
    set((state) => {
      const { [id]: _, ...remainingScenes } = state.project.scenes;
      const sceneIds = Object.keys(remainingScenes);
      return {
        project: {
          ...state.project,
          scenes: remainingScenes,
          activeSceneId:
            state.project.activeSceneId === id
              ? sceneIds.length > 0
                ? sceneIds[0]
                : null
              : state.project.activeSceneId,
        },
      };
    });
  },

  renameScene: (id: string, name: string) => {
    set((state) => {
      const scene = state.project.scenes[id];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [id]: { ...scene, name },
          },
        },
      };
    });
  },

  setActiveScene: (id: string | null) => {
    set((state) => ({
      project: { ...state.project, activeSceneId: id },
    }));
  },

  addActor: (sceneId: string, actorData) => {
    const id = actorData.id ?? generateId();
    const actor: Actor = {
      ...actorData,
      id,
      sequences: actorData.sequences ?? [],
      subSceneId: actorData.subSceneId ?? null,
      prefabId: actorData.prefabId ?? null,
    };
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: { ...scene.actors, [id]: actor },
            },
          },
        },
      };
    });
    return id;
  },

  removeActor: (sceneId: string, actorId: string) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const removedActor = scene.actors[actorId];
      const { [actorId]: _, ...remainingActors } = scene.actors;
      const updatedActors = Object.fromEntries(
        Object.entries(remainingActors).map(([k, a]) => [
          k,
          { ...a, children: a.children.filter((c) => c !== actorId) },
        ]),
      );
      // Clear parentId for orphaned children
      if (removedActor) {
        for (const childId of removedActor.children) {
          if (updatedActors[childId]) {
            updatedActors[childId] = { ...updatedActors[childId], parentId: null };
          }
        }
      }
      const updatedConnections = scene.connections.filter(
        (c) => c.sourceActorId !== actorId && c.targetActorId !== actorId,
      );
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: updatedActors,
              connections: updatedConnections,
            },
          },
        },
      };
    });
  },

  updateActorPosition: (sceneId, actorId, pos) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, position: pos },
              },
            },
          },
        },
      };
    });
  },

  setActorComponents: (sceneId, actorId, componentIds) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, components: componentIds },
              },
            },
          },
        },
      };
    });
  },

  setActorParent: (sceneId, actorId, parentId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      // Circular dependency check: walk up from parentId to ensure actorId is not an ancestor
      if (parentId) {
        let current: string | null | undefined = parentId;
        while (current) {
          if (current === actorId) return state; // Would create a cycle
          current = scene.actors[current]?.parentId;
        }
      }
      const updatedActors = { ...scene.actors };
      for (const a of Object.values(updatedActors)) {
        if (a.children.includes(actorId)) {
          updatedActors[a.id] = {
            ...a,
            children: a.children.filter((c) => c !== actorId),
          };
        }
      }
      updatedActors[actorId] = { ...actor, parentId };
      if (parentId && updatedActors[parentId]) {
        updatedActors[parentId] = {
          ...updatedActors[parentId],
          children: [...updatedActors[parentId].children, actorId],
        };
      }
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...scene, actors: updatedActors },
          },
        },
      };
    });
  },

  renameActor: (sceneId, actorId, name) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, name },
              },
            },
          },
        },
      };
    });
  },

  duplicateActor: (sceneId, actorId, offset = { x: 50, y: 50 }) => {
    const { project } = get();
    const scene = project.scenes[sceneId];
    if (!scene) return null;
    const actor = scene.actors[actorId];
    if (!actor) return null;

    const newId = generateId();
    const newActor: Actor = {
      ...JSON.parse(JSON.stringify(actor)),
      id: newId,
      name: `${actor.name} (Copy)`,
      position: {
        x: actor.position.x + offset.x,
        y: actor.position.y + offset.y,
      },
      parentId: null,
      children: [],
      prefabId: actor.prefabId,
    };

    set((state) => {
      const s = state.project.scenes[sceneId];
      if (!s) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...s,
              actors: { ...s.actors, [newId]: newActor },
            },
          },
        },
      };
    });
    return newId;
  },

  // Sequence actions
  setActorSequences: (sceneId, actorId, sequences) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, sequences },
              },
            },
          },
        },
      };
    });
  },

  addSequenceStep: (sceneId, actorId, stepData) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      const step: SequenceStep = { ...stepData, id: generateId() };
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, sequences: [...actor.sequences, step] },
              },
            },
          },
        },
      };
    });
  },

  removeSequenceStep: (sceneId, actorId, stepId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: {
                  ...actor,
                  sequences: actor.sequences.filter((s) => s.id !== stepId),
                },
              },
            },
          },
        },
      };
    });
  },

  updateSequenceStep: (sceneId, actorId, stepId, updates) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: {
                  ...actor,
                  sequences: actor.sequences.map((s) =>
                    s.id === stepId ? { ...s, ...updates } : s,
                  ),
                },
              },
            },
          },
        },
      };
    });
  },

  // SubScene actions
  setActorSubScene: (sceneId, actorId, subSceneId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const actor = scene.actors[actorId];
      if (!actor) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              actors: {
                ...scene.actors,
                [actorId]: { ...actor, subSceneId },
              },
            },
          },
        },
      };
    });
  },

  // Prefab actions
  createPrefab: (name, sceneId, actorId) => {
    const { project } = get();
    const scene = project.scenes[sceneId];
    if (!scene) return null;
    const actor = scene.actors[actorId];
    if (!actor) return null;

    const prefabId = generateId();
    const { id: _id, position: _pos, parentId: _pid, prefabId: _pfid, ...actorData } = actor;
    const prefab: Prefab = {
      id: prefabId,
      name,
      actor: JSON.parse(JSON.stringify(actorData)),
    };

    set((state) => ({
      project: {
        ...state.project,
        prefabs: { ...state.project.prefabs, [prefabId]: prefab },
      },
    }));
    return prefabId;
  },

  deletePrefab: (id) => {
    set((state) => {
      const { [id]: _, ...remaining } = state.project.prefabs;
      return {
        project: { ...state.project, prefabs: remaining },
      };
    });
  },

  renamePrefab: (id, name) => {
    set((state) => {
      const prefab = state.project.prefabs[id];
      if (!prefab) return state;
      return {
        project: {
          ...state.project,
          prefabs: {
            ...state.project.prefabs,
            [id]: { ...prefab, name },
          },
        },
      };
    });
  },

  instantiatePrefab: (prefabId, sceneId, position) => {
    const { project } = get();
    const prefab = project.prefabs[prefabId];
    if (!prefab) return null;
    const scene = project.scenes[sceneId];
    if (!scene) return null;

    const newId = generateId();
    const newActor: Actor = {
      ...JSON.parse(JSON.stringify(prefab.actor)),
      id: newId,
      position,
      parentId: null,
      prefabId,
    };

    set((state) => {
      const s = state.project.scenes[sceneId];
      if (!s) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...s,
              actors: { ...s.actors, [newId]: newActor },
            },
          },
        },
      };
    });
    return newId;
  },

  addConnection: (sceneId, connectionData) => {
    const connection: Connection = { ...connectionData, id: generateId() };
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              connections: [...scene.connections, connection],
            },
          },
        },
      };
    });
  },

  removeConnection: (sceneId, connectionId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              connections: scene.connections.filter((c) => c.id !== connectionId),
            },
          },
        },
      };
    });
  },

  upsertComponent: (component) => {
    set((state) => ({
      project: {
        ...state.project,
        components: {
          ...state.project.components,
          [component.id]: component,
        },
      },
    }));
  },

  deleteComponent: (id) => {
    set((state) => {
      const { [id]: _, ...remaining } = state.project.components;
      return {
        project: { ...state.project, components: remaining },
      };
    });
  },

  // Scene State actions
  addSceneState: (sceneId, name) => {
    const stateId = generateId();
    const newState: SceneState = { id: stateId, name, keyBindings: [] };
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              states: [...scene.states, newState],
              activeStateId: scene.activeStateId ?? stateId,
            },
          },
        },
      };
    });
    return stateId;
  },

  removeSceneState: (sceneId, stateId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const newStates = scene.states.filter((s) => s.id !== stateId);
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              states: newStates,
              activeStateId:
                scene.activeStateId === stateId
                  ? newStates.length > 0 ? newStates[0].id : null
                  : scene.activeStateId,
            },
          },
        },
      };
    });
  },

  renameSceneState: (sceneId, stateId, name) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              states: scene.states.map((s) =>
                s.id === stateId ? { ...s, name } : s,
              ),
            },
          },
        },
      };
    });
  },

  setActiveState: (sceneId, stateId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...scene, activeStateId: stateId },
          },
        },
      };
    });
  },

  // KeyBinding actions
  addKeyBinding: (sceneId, stateId, bindingData) => {
    const bindingId = generateId();
    const binding: KeyBinding = { ...bindingData, id: bindingId };
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      const newStates = scene.states.map((s) =>
        s.id === stateId
          ? { ...s, keyBindings: [...s.keyBindings, binding] }
          : s,
      );

      // Auto-connect: if targetActorId is specified, create a connection
      let newConnections = scene.connections;
      if (binding.targetActorId && scene.actors[binding.targetActorId]) {
        const alreadyConnected = scene.connections.some(
          (c) =>
            c.sourceActorId === scene.rootActorId &&
            c.targetActorId === binding.targetActorId &&
            c.sourcePort === `key:${binding.key}`,
        );
        if (!alreadyConnected) {
          newConnections = [
            ...scene.connections,
            {
              id: generateId(),
              sourceActorId: scene.rootActorId,
              sourcePort: `key:${binding.key}`,
              targetActorId: binding.targetActorId,
              targetPort: 'input',
            },
          ];
        }
      }

      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...scene, states: newStates, connections: newConnections },
          },
        },
      };
    });
    return bindingId;
  },

  updateKeyBinding: (sceneId, stateId, bindingId, updates) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      let updatedBinding: KeyBinding | null = null;
      const newStates = scene.states.map((s) =>
        s.id === stateId
          ? {
              ...s,
              keyBindings: s.keyBindings.map((b) => {
                if (b.id === bindingId) {
                  updatedBinding = { ...b, ...updates };
                  return updatedBinding;
                }
                return b;
              }),
            }
          : s,
      );

      // Auto-connect for updated targetActorId
      let newConnections = scene.connections;
      if (updatedBinding && (updatedBinding as KeyBinding).targetActorId) {
        const targetId = (updatedBinding as KeyBinding).targetActorId!;
        const key = (updatedBinding as KeyBinding).key;
        if (scene.actors[targetId]) {
          const alreadyConnected = scene.connections.some(
            (c) =>
              c.sourceActorId === scene.rootActorId &&
              c.targetActorId === targetId &&
              c.sourcePort === `key:${key}`,
          );
          if (!alreadyConnected) {
            newConnections = [
              ...scene.connections,
              {
                id: generateId(),
                sourceActorId: scene.rootActorId,
                sourcePort: `key:${key}`,
                targetActorId: targetId,
                targetPort: 'input',
              },
            ];
          }
        }
      }

      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: { ...scene, states: newStates, connections: newConnections },
          },
        },
      };
    });
  },

  removeKeyBinding: (sceneId, stateId, bindingId) => {
    set((state) => {
      const scene = state.project.scenes[sceneId];
      if (!scene) return state;
      return {
        project: {
          ...state.project,
          scenes: {
            ...state.project.scenes,
            [sceneId]: {
              ...scene,
              states: scene.states.map((s) =>
                s.id === stateId
                  ? { ...s, keyBindings: s.keyBindings.filter((b) => b.id !== bindingId) }
                  : s,
              ),
            },
          },
        },
      };
    });
  },

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
