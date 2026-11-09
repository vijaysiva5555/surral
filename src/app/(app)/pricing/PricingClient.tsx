"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import ListsTab from "./ListsTab";
import PartsTab from "./PartsTab";
import CompareTab from "./CompareTab";

const TABS = ["Price lists", "Parts", "Compare years"] as const;

export default function PricingClient({ role }: { role: "admin" | "sales" | "viewer" }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Price lists");
  return (
    <>
      <PageHeader title="Pricing master" subtitle="Graco India INR list prices, year by year" />
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t}</button>
        ))}
      </div>
      {tab === "Price lists" && <ListsTab admin={role === "admin"} />}
      {tab === "Parts" && <PartsTab />}
      {tab === "Compare years" && <CompareTab />}    </>
  );
}
