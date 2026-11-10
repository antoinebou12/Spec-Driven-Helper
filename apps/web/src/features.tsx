import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import {
  defaultFeatures,
  effectiveFeatures,
  hiddenViews,
  type FeatureId,
  type FeatureState,
} from '../../../packages/shared/src/feature-flags';

/**
 * Workspace feature flags. Hiding a disabled feature is only a convenience: the API refuses its
 * routes. Until the flags load, defaults apply so nothing flickers away for most workspaces.
 */
type Features = {
  state: FeatureState;
  on: (id: FeatureId) => boolean;
  hidden: Set<string>;
  refresh: () => Promise<void>;
  replace: (state: Partial<FeatureState>) => void;
};

const FeaturesContext = createContext<Features>({
  state: defaultFeatures(),
  on: () => true,
  hidden: new Set(),
  refresh: async () => {},
  replace: () => {},
});

export function FeaturesProvider({
  initial,
  children,
}: {
  initial?: Partial<FeatureState>;
  children: ReactNode;
}) {
  const [state, setState] = useState<FeatureState>(() => effectiveFeatures(initial));
  const replace = useCallback(
    (next: Partial<FeatureState>) => setState(effectiveFeatures(next)),
    [],
  );
  const refresh = useCallback(
    async () => replace((await api<{ features: Partial<FeatureState> }>('/features')).features),
    [replace],
  );
  const value = useMemo(
    () => ({
      state,
      on: (id: FeatureId) => state[id],
      hidden: hiddenViews(state),
      refresh,
      replace,
    }),
    [state, refresh, replace],
  );
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export const useFeatures = () => useContext(FeaturesContext);
