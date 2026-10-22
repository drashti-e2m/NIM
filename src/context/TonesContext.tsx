import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultToneExtras, tones as seedTones } from "../data/tones";
import type { ToneOfVoice } from "../types";
import { readToneOverrides, writeToneOverrides } from "../services/storage";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";

interface TonesApi {
  tones: ToneOfVoice[];
  getTone: (id: string) => ToneOfVoice | undefined;
  updateTone: (id: string, patch: Partial<Omit<ToneOfVoice, "id">>) => void;
  addTone: (input: Omit<ToneOfVoice, "id">) => ToneOfVoice;
  deleteTone: (id: string) => void;
  resetTones: () => void;
}

const TonesContext = createContext<TonesApi | null>(null);

function normalizeTone(
  tone: ToneOfVoice,
  options?: { fillEmptyLists?: boolean },
): ToneOfVoice {
  const fillEmpty = options?.fillEmptyLists ?? false;
  const seed = seedTones.find((item) => item.id === tone.id);
  const extras = seed
    ? {
        status: seed.status,
        clientLabel: seed.clientLabel,
        icon: seed.icon,
        writingRules: seed.writingRules,
        preferredPhrases: seed.preferredPhrases,
        avoidedPhrases: seed.avoidedPhrases,
        sampleCopy: seed.sampleCopy,
        bestFor: seed.bestFor,
      }
    : defaultToneExtras(tone);
  return {
    ...extras,
    ...tone,
    status:
      tone.status === "approved" || tone.status === "draft"
        ? tone.status
        : extras.status,
    clientLabel: tone.clientLabel?.trim() || extras.clientLabel,
    icon: tone.icon || extras.icon,
    writingRules: pickList(tone.writingRules, extras.writingRules, fillEmpty),
    preferredPhrases: pickList(
      tone.preferredPhrases,
      extras.preferredPhrases,
      fillEmpty,
    ),
    avoidedPhrases: pickList(
      tone.avoidedPhrases,
      extras.avoidedPhrases,
      fillEmpty,
    ),
    sampleCopy: tone.sampleCopy?.trim() || extras.sampleCopy || tone.sample,
    bestFor: tone.bestFor?.trim() || extras.bestFor,
  };
}

function pickList(
  saved: string[] | undefined,
  fallback: string[] | undefined,
  fillEmpty: boolean,
): string[] {
  if (!Array.isArray(saved)) return fallback ?? [];
  const cleaned = saved.filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  return fillEmpty ? fallback ?? [] : [];
}

function loadTones(): ToneOfVoice[] {
  const raw = readToneOverrides();
  const saved = Array.isArray(raw) ? raw.filter(isTone) : [];
  const savedById = new Map(saved.map((tone) => [tone.id, tone]));
  const seedIds = new Set(seedTones.map((tone) => tone.id));

  // Prefer persisted edits for library tones; fall back to seed defaults.
  const library = seedTones.map((seed) => {
    const override = savedById.get(seed.id);
    if (!override) {
      return normalizeTone({ ...seed }, { fillEmptyLists: true });
    }
    return normalizeTone(
      {
        ...seed,
        ...override,
        // Keep explicit arrays from the saved edit (including empties).
        writingRules: override.writingRules,
        preferredPhrases: override.preferredPhrases,
        avoidedPhrases: override.avoidedPhrases,
      },
      { fillEmptyLists: false },
    );
  });

  const custom = saved
    .filter((tone) => !seedIds.has(tone.id))
    .map((tone) => normalizeTone(tone, { fillEmptyLists: true }));

  return [...library, ...custom];
}

function isTone(value: unknown): value is ToneOfVoice {
  if (!value || typeof value !== "object") return false;
  const tone = value as Partial<ToneOfVoice>;
  return (
    typeof tone.id === "string" &&
    typeof tone.name === "string" &&
    typeof tone.summary === "string" &&
    Array.isArray(tone.traits) &&
    typeof tone.sample === "string"
  );
}

export function TonesProvider({ children }: { children: ReactNode }) {
  const [tones, setTones] = useState<ToneOfVoice[]>(() => loadTones());

  useEffect(() => {
    writeToneOverrides(tones);
  }, [tones]);

  useEffect(() => {
    const onSync = () => setTones(loadTones());
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  const api = useMemo<TonesApi>(
    () => ({
      tones,
      getTone(id) {
        return tones.find((tone) => tone.id === id);
      },
      updateTone(id, patch) {
        setTones((current) =>
          current.map((tone) =>
            tone.id === id ? normalizeTone({ ...tone, ...patch }) : tone,
          ),
        );
      },
      addTone(input) {
        const tone = normalizeTone({
          ...input,
          id: `tone-${crypto.randomUUID().slice(0, 8)}`,
        });
        setTones((current) => [...current, tone]);
        return tone;
      },
      deleteTone(id) {
        setTones((current) => {
          if (current.length <= 1) return current;
          return current.filter((tone) => tone.id !== id);
        });
      },
      resetTones() {
        setTones(seedTones.map((tone) => normalizeTone({ ...tone })));
      },
    }),
    [tones],
  );

  return <TonesContext.Provider value={api}>{children}</TonesContext.Provider>;
}

export function useTones(): TonesApi {
  const value = useContext(TonesContext);
  if (!value) throw new Error("useTones must be used within TonesProvider");
  return value;
}
