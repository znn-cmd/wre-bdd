import { create } from "zustand";

export type LeadsUiState = {
  search: string;
  country: string;
  partner: string;
  transferStatus: string;
  partnerStatus: string;
  dateFrom: string;
  dateTo: string;
  compact: boolean;
  setSearch: (v: string) => void;
  setCountry: (v: string) => void;
  setPartner: (v: string) => void;
  setTransferStatus: (v: string) => void;
  setPartnerStatus: (v: string) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setCompact: (v: boolean) => void;
  reset: () => void;
};

const initial = {
  search: "",
  country: "",
  partner: "",
  transferStatus: "",
  partnerStatus: "",
  dateFrom: "",
  dateTo: "",
  compact: true,
};

export const useLeadsUi = create<LeadsUiState>((set) => ({
  ...initial,
  setSearch: (search) => set({ search }),
  setCountry: (country) => set({ country }),
  setPartner: (partner) => set({ partner }),
  setTransferStatus: (transferStatus) => set({ transferStatus }),
  setPartnerStatus: (partnerStatus) => set({ partnerStatus }),
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  setCompact: (compact) => set({ compact }),
  reset: () => set(initial),
}));
