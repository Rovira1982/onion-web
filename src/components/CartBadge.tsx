"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function CartBadge({ className = "" }: { className?: string }) {
  const { count } = useCart();

  return (
    <Link
      href="/carrito"
      aria-label={`Carrito, ${count} unidad${count === 1 ? "" : "es"}`}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-ink transition-colors hover:border-brand hover:text-brand ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.6 4H17M9 21a1 1 0 100-2 1 1 0 000 2zM17 21a1 1 0 100-2 1 1 0 000 2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-display text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
