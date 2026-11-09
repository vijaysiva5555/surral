"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client";
import { Pager } from "../pricing/PartsTab";

type A = { _id: string; at: string; userName: string; action: string; entity: string; summary: string };
const COLOR: Record<string, string> = { create: "bg-emerald-50 text-emerald-700", delete: "bg-red-50 text-red-700", status: "bg-amber-50 text-amber-700" };

export default function AuditClient() {
  const [page, setPage] = useState(1);
  const [d, setD] = useState<{ items: A[]; total: number; pages: number } | null>(null);
  useEffect(() => { api(`/api/audit?page=${page}`).then(setD); }, [page]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when" />
      <div className="card overflow-hidden">
        <div className="table-scroll">
        <table className="w-full">
          <thead><tr><th className="th w-44">When</th><th className="th w-36">User</th><th className="th w-28">Action</th><th className="th w-28">Area</th><th className="th">Details</th></tr></thead>
          <tbody>
            {d?.items.map((a) => (
              <tr key={a._id} className="hover:bg-slate-50">
                <td className="td whitespace-nowrap text-xs text-slate-500">{new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="td">{a.userName}</td>
                <td className="td"><span className={`badge capitalize ${COLOR[a.action] ?? "bg-slate-100 text-slate-700"}`}>{a.action}</span></td>
                <td className="td text-xs capitalize text-slate-500">{a.entity}</td>
                <td className="td">{a.summary}</td>
              </tr>
            ))}
            {d?.items.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-slate-400">No activity yet.</td></tr>}
          </tbody>
        </table>
        </div>
        {d && <Pager page={page} pages={d.pages} total={d.total} set={setPage} />}
      </div>
    </>
  );
}
