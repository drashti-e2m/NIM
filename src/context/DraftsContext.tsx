import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Draft, DraftInput } from "../types";
import { readDrafts, writeDrafts } from "../services/storage";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";

interface DraftsApi {
  drafts: Draft[];
  addDraft: (input: DraftInput) => Draft;
  updateDraft: (
    id: string,
    patch: Partial<Pick<Draft, "title" | "body" | "status" | "variant">>,
  ) => Draft | undefined;
  deleteDraft: (id: string) => boolean;
}

const DraftsContext = createContext<DraftsApi | null>(null);

export function DraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => readDrafts());

  useEffect(() => {
    writeDrafts(drafts);
  }, [drafts]);

  useEffect(() => {
    const onSync = () => setDrafts(readDrafts());
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  const api = useMemo<DraftsApi>(
    () => ({
      drafts,
      addDraft(input) {
        const now = new Date().toISOString();
        const draft: Draft = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        setDrafts((current) => [draft, ...current]);
        return draft;
      },
      updateDraft(id, patch) {
        let updated: Draft | undefined;
        setDrafts((current) =>
          current.map((draft) => {
            if (draft.id !== id) return draft;
            updated = {
              ...draft,
              ...patch,
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        );
        return updated;
      },
      deleteDraft(id) {
        const exists = drafts.some((draft) => draft.id === id);
        if (!exists) return false;
        setDrafts((current) => current.filter((draft) => draft.id !== id));
        return true;
      },
    }),
    [drafts],
  );

  return (
    <DraftsContext.Provider value={api}>{children}</DraftsContext.Provider>
  );
}

export function useDrafts(): DraftsApi {
  const value = useContext(DraftsContext);
  if (!value) {
    throw new Error("useDrafts must be used within DraftsProvider");
  }
  return value;
}
