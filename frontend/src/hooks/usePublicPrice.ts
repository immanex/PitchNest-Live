import { useEffect, useState } from "react";

/**
 * Public Pro price, for surfaces that render while logged out (landing page,
 * /pricing).
 *
 * Deliberately separate from BillingContext: that context is about the CURRENT
 * USER's plan and lives inside the authenticated providers. Pricing pages need
 * the number without a session, so this hits the unauthenticated
 * /api/billing/price endpoint and holds nothing user-specific.
 *
 * Falls back to nulls on failure — the pricing UI renders a neutral "See
 * pricing" rather than inventing an amount that might not match checkout.
 */
export interface CatalogItem {
  plan: "prep" | "pro";
  term: "monthly" | "annual";
  amount: number;
  currency: string;
  days: number;
}

export interface PublicPrice {
  amount: number | null;
  currency: string | null;
  days: number | null;
  /** Every purchasable (plan, term) SKU, from the server. Drives per-tier price display. */
  catalog: CatalogItem[];
  billingEnabled: boolean;
  /** Free months a first subscription gets; 0 when there is no offer. */
  freeMonths: number;
  loaded: boolean;
}

const EMPTY: PublicPrice = {
  amount: null,
  currency: null,
  days: null,
  catalog: [],
  billingEnabled: false,
  freeMonths: 0,
  loaded: false,
};

export function usePublicPrice(): PublicPrice {
  const [state, setState] = useState<PublicPrice>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/billing/price")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setState({
          amount: body?.price?.amount ?? null,
          currency: body?.price?.currency ?? null,
          days: body?.price?.days ?? null,
          catalog: Array.isArray(body?.catalog) ? body.catalog : [],
          billingEnabled: !!body?.billingEnabled,
          freeMonths: Number.isInteger(body?.offer?.freeMonths) && body.offer.freeMonths > 0 ? body.offer.freeMonths : 0,
          loaded: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ ...EMPTY, loaded: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
