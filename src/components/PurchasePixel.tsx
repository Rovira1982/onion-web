"use client";

import { useEffect } from "react";
import { useMarketingConsent } from "@/lib/consent";

type Props = {
  orderId: string;
  value: number;
  currency?: string;
};

// Client-side twin of the server-side Purchase event fired from
// checkout/actions.ts (sendCapiEvent) — same eventID (the order id) so Meta
// deduplicates the two instead of double-counting the sale. Only one of the
// two may actually reach Meta for a given visitor (browser blocked, or the
// server call failed) — sending both is what makes the conversion reliable
// either way.
export default function PurchasePixel({ orderId, value, currency = "EUR" }: Props) {
  const hasConsent = useMarketingConsent();

  useEffect(() => {
    if (!hasConsent) return;

    let attempts = 0;
    const tryFire = () => {
      if (window.fbq) {
        window.fbq("track", "Purchase", { value, currency }, { eventID: orderId });
        return;
      }
      // MetaPixel's Script tag may not have run yet on a fresh page load —
      // fbq is defined synchronously by its bootstrap, but component mount
      // order isn't guaranteed, so retry briefly instead of silently
      // dropping the event.
      if (++attempts < 20) setTimeout(tryFire, 100);
    };
    tryFire();
  }, [hasConsent, orderId, value, currency]);

  return null;
}
