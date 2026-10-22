import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EmailCampaign, EmailCampaignInput } from "../types";
import {
  readEmailCampaigns,
  writeEmailCampaigns,
} from "../services/storage";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";

interface EmailCampaignsApi {
  campaigns: EmailCampaign[];
  campaignsForClient: (clientId: string) => EmailCampaign[];
  getCampaign: (id: string) => EmailCampaign | undefined;
  addCampaign: (input: EmailCampaignInput) => EmailCampaign;
  updateCampaign: (
    id: string,
    patch: Partial<Omit<EmailCampaign, "id" | "createdAt">>,
  ) => EmailCampaign | undefined;
  deleteCampaign: (id: string) => boolean;
}

const EmailCampaignsContext = createContext<EmailCampaignsApi | null>(null);

export function EmailCampaignsProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>(() =>
    readEmailCampaigns(),
  );

  useEffect(() => {
    writeEmailCampaigns(campaigns);
  }, [campaigns]);

  useEffect(() => {
    const onSync = () => setCampaigns(readEmailCampaigns());
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  const api = useMemo<EmailCampaignsApi>(
    () => ({
      campaigns,
      campaignsForClient(clientId) {
        return campaigns
          .filter((campaign) => campaign.clientId === clientId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
      getCampaign(id) {
        return campaigns.find((campaign) => campaign.id === id);
      },
      addCampaign(input) {
        const now = new Date().toISOString();
        const campaign: EmailCampaign = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        setCampaigns((current) => [campaign, ...current]);
        return campaign;
      },
      updateCampaign(id, patch) {
        let updated: EmailCampaign | undefined;
        setCampaigns((current) =>
          current.map((campaign) => {
            if (campaign.id !== id) return campaign;
            updated = {
              ...campaign,
              ...patch,
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        );
        return updated;
      },
      deleteCampaign(id) {
        const exists = campaigns.some((campaign) => campaign.id === id);
        if (!exists) return false;
        setCampaigns((current) =>
          current.filter((campaign) => campaign.id !== id),
        );
        return true;
      },
    }),
    [campaigns],
  );

  return (
    <EmailCampaignsContext.Provider value={api}>
      {children}
    </EmailCampaignsContext.Provider>
  );
}

export function useEmailCampaigns(): EmailCampaignsApi {
  const value = useContext(EmailCampaignsContext);
  if (!value) {
    throw new Error("useEmailCampaigns must be used within EmailCampaignsProvider");
  }
  return value;
}
