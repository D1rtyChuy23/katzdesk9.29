import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
  handoff: "/handoff",
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
  children,
}: {
  entityType: string;
  id: number;
  className?: string;
  children: ReactNode;
}) {
  if (!isKind(entityType)) {
    return (
      <Link to="/" className={className}>
        {children}
      </Link>
    );
  }
  const to: AppPath = ROUTES[entityType];
  if (!id || entityType === "handoff") {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={to} search={{ open: id }} className={className}>
      {children}
    </Link>
  );
}

export function pathFor(entityType: string): AppPath | "/" {
  return isKind(entityType) ? ROUTES[entityType] : "/";
}
