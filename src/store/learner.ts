import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getDB } from '../lib/db';

const BridgeMindStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await getDB();
    const data = await db.get('profiles', name);
    return data ? JSON.stringify(data.value) : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await getDB();
    await db.put('profiles', { id: name, value: JSON.parse(value) });
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await getDB();
    await db.delete('profiles', name);
  },
};

export interface LearnerProfile {
  language: string;
  languageCode: string;
  scriptDirection: 'ltr' | 'rtl';
  curriculum: string;
  curriculumRegion: string;
  region: string;
  country: string;
  onboarded: boolean;
  theme: 'dark' | 'light';
  comprehensionLevel?: number;
  learningStyle?: string;
  complexityPreference?: 'simple' | 'standard' | 'complex';
  vocabularyRange?: string;
}

interface LearnerState {
  profile: LearnerProfile | null;
  setProfile: (profile: LearnerProfile) => void;
  updateProfile: (updates: Partial<LearnerProfile>) => void;
  reset: () => void;
}

export const useLearnerStore = create<LearnerState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile: { ...profile, theme: profile.theme || 'dark' } }),
      updateProfile: (updates) => set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
      })),
      reset: () => set({ profile: null }),
    }),
    {
      name: 'bridgemind-learner-storage',
      storage: createJSONStorage(() => BridgeMindStorage),
    }
  )
);
