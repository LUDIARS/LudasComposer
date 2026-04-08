import { createContext, useContext } from 'react';

interface DomainDiagramContextValue {
  focusActorId: string | null;
  setFocusActorId: (id: string | null) => void;
}

export const DomainDiagramContext = createContext<DomainDiagramContextValue>({
  focusActorId: null,
  setFocusActorId: () => {},
});

export function useDomainDiagramContext() {
  return useContext(DomainDiagramContext);
}
