import { create } from 'zustand';
import type { Project, Actor, Connection, Component, Scene } from '@/types/domain';
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

  // Connection actions
  addConnection: (sceneId: string, connection: Omit<Connection, 'id'>) => void;
  removeConnection: (sceneId: string, connectionId: string) => void;

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
    };
    const scene: Scene = {
      id: sceneId,
      name,
      rootActorId,
      actors: { [rootActorId]: rootActor },
      connections: [],
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
    const actor: Actor = { ...actorData, id };
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
      const { [actorId]: _, ...remainingActors } = scene.actors;
      // Remove children references and connections involving this actor
      const updatedActors = Object.fromEntries(
        Object.entries(remainingActors).map(([k, a]) => [
          k,
          { ...a, children: a.children.filter((c) => c !== actorId) },
        ]),
      );
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
      // Remove from old parent's children
      const updatedActors = { ...scene.actors };
      for (const a of Object.values(updatedActors)) {
        if (a.children.includes(actorId)) {
          updatedActors[a.id] = {
            ...a,
            children: a.children.filter((c) => c !== actorId),
          };
        }
      }
      // Set new parent
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

  loadProject: (project) => set({ project }),

  getActiveScene: () => {
    const { project } = get();
    if (!project.activeSceneId) return null;
    return project.scenes[project.activeSceneId] ?? null;
  },
}));
