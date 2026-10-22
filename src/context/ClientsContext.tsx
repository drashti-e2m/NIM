import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { makeClientDraft, seedClients } from "../data/clients";
import type { Client } from "../types";
import {
  readClientOverrides,
  readCustomClients,
  readLastClientId,
  writeClientOverrides,
  writeCustomClients,
  writeLastClientId,
} from "../services/storage";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";

type ClientPatch = Partial<
  Pick<
    Client,
    "name" | "website" | "industry" | "city" | "summary" | "preferredToneId"
  >
>;

interface ClientsApi {
  clients: Client[];
  lastClientId: string | null;
  getClient: (id: string) => Client | undefined;
  addClient: (input: {
    name: string;
    website: string;
    industry?: string;
    city?: string;
    summary?: string;
  }) => Client;
  updateClient: (id: string, patch: ClientPatch) => Client | undefined;
  setLastClientId: (id: string) => void;
}

const ClientsContext = createContext<ClientsApi | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<Client[]>(() => readCustomClients());
  const [seedOverrides, setSeedOverrides] = useState<Record<string, Partial<Client>>>(
    () => readClientOverrides(),
  );
  const [lastClientId, setLastClientIdState] = useState<string | null>(() =>
    readLastClientId(),
  );

  useEffect(() => {
    writeCustomClients(custom);
  }, [custom]);

  useEffect(() => {
    writeClientOverrides(seedOverrides);
  }, [seedOverrides]);

  useEffect(() => {
    const onSync = () => {
      setCustom(readCustomClients());
      setSeedOverrides(readClientOverrides());
      setLastClientIdState(readLastClientId());
    };
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  const api = useMemo<ClientsApi>(() => {
    const clients = [
      ...seedClients.map((client) => ({ ...client, ...seedOverrides[client.id] })),
      ...custom,
    ];
    return {
      clients,
      lastClientId,
      getClient(id) {
        return clients.find((client) => client.id === id);
      },
      addClient(input) {
        const client = makeClientDraft(input);
        setCustom((current) => [client, ...current]);
        setLastClientIdState(client.id);
        writeLastClientId(client.id);
        return client;
      },
      updateClient(id, patch) {
        const seed = seedClients.find((client) => client.id === id);
        if (seed) {
          setSeedOverrides((current) => ({
            ...current,
            [id]: { ...current[id], ...patch },
          }));
          return { ...seed, ...seedOverrides[id], ...patch };
        }
        let updated: Client | undefined;
        setCustom((current) =>
          current.map((client) => {
            if (client.id !== id) return client;
            updated = { ...client, ...patch };
            return updated;
          }),
        );
        return updated;
      },
      setLastClientId(id) {
        setLastClientIdState(id);
        writeLastClientId(id);
      },
    };
  }, [custom, lastClientId, seedOverrides]);

  return (
    <ClientsContext.Provider value={api}>{children}</ClientsContext.Provider>
  );
}

export function useClients(): ClientsApi {
  const value = useContext(ClientsContext);
  if (!value) throw new Error("useClients must be used within ClientsProvider");
  return value;
}
