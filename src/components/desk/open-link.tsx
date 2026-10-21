import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useFromHere } from "@/lib/ops/search-params";

const ROUTES = {
  service: "/service",
  tlc: "/tlc",
  pm: "/pms",
  install: "/installs",
  deal: "/pipeline",
  module: "/modules",
  asset: "/warehouse",
  location: "/locations",
  recipe: "/recipes",
  customer: "/customers",
  handoff: "/handoff",
  rebuild: "/rebuilds",
} as const;

type Kind = keyof typeof ROUTES;
type AppPath = (typeof ROUTES)[Kind];

function isKind(v: string): v is Kind {
  return v in ROUTES;
}

export function OpenLink({
  entityType,
  id,
  className,
  title,
  children,
}: {
  entityType: string;
  id: number;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  if (!isKind(entityType)) {
    return (
      <Link to="/" className={className} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <RecordLink
      to={ROUTES[entityType]}
      id={entityType === "handoff" ? 0 : id}
      className={className}
      title={title}
    >
      {children}
    </RecordLink>
  );
}

/** A link that opens record `id` on page `to`, remembering this page so closing the record comes back here. */
function RecordLink({
  to,
  id,
  className,
  title,
  children,
}: {
  to: AppPath;
  id: number;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const from = useFromHere(to);
  if (!id) {
    return (
      <Link to={to} className={className} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={to} search={{ open: id, from }} className={className} title={title}>
      {children}
    </Link>
  );
}

export function pathFor(entityType: string): AppPath | "/" {
  return isKind(entityType) ? ROUTES[entityType] : "/";
}
