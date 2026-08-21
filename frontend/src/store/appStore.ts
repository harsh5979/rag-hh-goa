import { create } from 'zustand';
import type { TabType } from '@/components/layout/TabBar';

interface AppState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'voice',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
