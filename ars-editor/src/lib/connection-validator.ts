import type { Actor } from '@/types/domain';

/**
 * Validates whether a message between two domains is valid.
 */
export function validateConnection(
  _project: unknown,
  scene: { actors: Record<string, Actor>; messages: { sourceDomainId: string; targetDomainId: string }[] },
  sourceDomainId: string,
  _sourceHandle: string | null,
  targetDomainId: string,
  _targetHandle: string | null,
): { valid: boolean; reason?: string } {
  // Don't allow self-messages
  if (sourceDomainId === targetDomainId) {
    return { valid: false, reason: 'Cannot send a message to itself' };
  }

  // Check duplicate message
  const exists = scene.messages.some(
    (m) =>
      m.sourceDomainId === sourceDomainId &&
      m.targetDomainId === targetDomainId,
  );
  if (exists) {
    return { valid: false, reason: 'Message already exists' };
  }

  return { valid: true };
}
