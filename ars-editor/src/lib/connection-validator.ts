import type { Project, Actor } from '@/types/domain';

/**
 * Validates whether a connection between two ports is type-compatible.
 * Port handles are formatted as "input-{portName}" / "output-{portName}"
 */
export function validateConnection(
  project: Project,
  scene: { actors: Record<string, Actor>; connections: { sourceActorId: string; targetActorId: string }[] },
  sourceActorId: string,
  sourceHandle: string | null,
  targetActorId: string,
  targetHandle: string | null,
): { valid: boolean; reason?: string } {
  // Don't allow self-connections
  if (sourceActorId === targetActorId) {
    return { valid: false, reason: 'Cannot connect an actor to itself' };
  }

  // Check duplicate connection
  const exists = scene.connections.some(
    (c) =>
      c.sourceActorId === sourceActorId &&
      c.targetActorId === targetActorId,
  );
  if (exists) {
    return { valid: false, reason: 'Connection already exists' };
  }

  // If no handle info, allow (default handles)
  if (!sourceHandle || !targetHandle) {
    return { valid: true };
  }

  // Extract port names
  const sourcePortName = sourceHandle.replace('output-', '');
  const targetPortName = targetHandle.replace('input-', '');

  // Find port types from components
  const sourceActor = scene.actors[sourceActorId];
  const targetActor = scene.actors[targetActorId];
  if (!sourceActor || !targetActor) return { valid: true };

  let sourcePortType: string | null = null;
  let targetPortType: string | null = null;

  for (const compId of sourceActor.components) {
    const comp = project.components[compId];
    if (!comp) continue;
    for (const task of comp.tasks) {
      const port = task.outputs.find((p) => p.name === sourcePortName);
      if (port) {
        sourcePortType = port.type;
        break;
      }
    }
    if (sourcePortType) break;
  }

  for (const compId of targetActor.components) {
    const comp = project.components[compId];
    if (!comp) continue;
    for (const task of comp.tasks) {
      const port = task.inputs.find((p) => p.name === targetPortName);
      if (port) {
        targetPortType = port.type;
        break;
      }
    }
    if (targetPortType) break;
  }

  // If both types are known, check compatibility
  if (sourcePortType && targetPortType) {
    if (sourcePortType === 'any' || targetPortType === 'any') {
      return { valid: true };
    }
    if (sourcePortType !== targetPortType) {
      return {
        valid: false,
        reason: `Type mismatch: ${sourcePortType} → ${targetPortType}`,
      };
    }
  }

  return { valid: true };
}
