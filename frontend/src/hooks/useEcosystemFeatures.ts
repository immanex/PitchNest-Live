import { useEffect, useState } from "react";
import { fetchDiscoverFeatures, type EcosystemFeatures } from "../api/discover";

/** Server feature flags for ecosystem surfaces; everything off until loaded. */
export function useEcosystemFeatures(): EcosystemFeatures {
  const [features, setFeatures] = useState<EcosystemFeatures>({
    discoverEngagement: false,
    community: false,
    pitchArena: false,
  });
  useEffect(() => {
    let active = true;
    void fetchDiscoverFeatures().then((result) => {
      if (active) setFeatures(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return features;
}
