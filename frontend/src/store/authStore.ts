import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface Store {
  id: string;
  name: string;
  type?: string;
  businessType?: string;
  currency?: string;
  credits?: number;
  creditBalance?: number;
}

interface AuthState {
  user: User | null;
  stores: Store[];
  currentStore: Store | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (data: {
    user: User;
    stores: Store[];
    accessToken: string;
    refreshToken: string;
  }) => void;
  logout: () => void;
  setCurrentStore: (store: Store) => void;
  updateCredits: (credits: number) => void;
  updateAccessToken: (token: string) => void;
  addStore: (store: Store) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      stores: [],
      currentStore: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (data) => {
        set({
          user: data.user,
          stores: data.stores,
          currentStore: data.stores[0] || null,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          stores: [],
          currentStore: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      setCurrentStore: (store) => {
        set({ currentStore: store });
      },

      updateCredits: (credits) => {
        const currentStore = get().currentStore;
        if (currentStore) {
          const updatedStore = { ...currentStore, credits };
          const stores = get().stores.map((s) =>
            s.id === currentStore.id ? updatedStore : s
          );
          set({ currentStore: updatedStore, stores });
        }
      },

      updateAccessToken: (token) => {
        set({ accessToken: token });
      },

      addStore: (store) => {
        set((state) => ({
          stores: [...state.stores, store],
          currentStore: state.currentStore || store,
        }));
      },
    }),
    {
      name: 'growthpilot-auth',
      partialize: (state) => ({
        user: state.user,
        stores: state.stores,
        currentStore: state.currentStore,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
