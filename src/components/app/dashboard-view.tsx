"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FolderClosed,
  Box,
  ArrowRightLeft,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { useOperatorGuard } from "@/hooks/use-operator-guard";
import { runSelfTest } from "@/lib/hash";
import { formatUTC, timeAgo } from "@/lib/time";
import { useVestigium } from "@/store/use-vestigium";
import {
  selectChainReport,
  selectEvidenceOfCase,
  selectIntegrityIncidents,
  selectStorageUsage,
  selectVerificationProgress,
} from "@/store/selectors";

const selfTest = runSelfTest(); // murni & murah — sekali per modul load (FR-M5-04)

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FolderClosed;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-sm border p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {value}
            {sub && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {sub}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { mounted, operator } = useOperatorGuard();
  // Dashboard read-only: berlangganan seluruh state agar selalu render ulang dari state (§6)
  const st = useVestigium();

  if (!mounted || !operator)
    return <div className="min-h-screen bg-background" />;

  const activeCases = st.cases.filter((c) => c.status === "active").length;
  const progress = selectVerificationProgress(st);
  const chain = selectChainReport(st);
  const incidents = selectIntegrityIncidents(st);
  const storage = selectStorageUsage(st);
  const docket = [...st.cases]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 5);
  const acts = [...st.audit].reverse().slice(0, 7); // audit tersimpan ascending seq; tampil terbaru dulu
  const healthy = chain.valid && selfTest.ok;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            01 / Ringkasan
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ringkasan Operasional
          </h1>
        </div>

        {/* Status integritas sistem — selalu terlihat (A7, FR-M5-04) */}
        <Alert className="mb-6">
          <ShieldCheck
            className={`size-4 ${healthy ? "text-primary" : "text-destructive"}`}
          />
          <AlertTitle className="text-sm">
            Rantai audit{" "}
            {chain.valid ? "VALID" : `PUTUS di seq ${chain.firstBrokenSeq}`} ·{" "}
            self-test hash {selfTest.ok ? "PASSED (FIPS)" : "GAGAL"}
          </AlertTitle>
          <AlertDescription className="font-mono text-[11px]">
            chain tip: {chain.tip.slice(0, 24)}… · {chain.total} entri
          </AlertDescription>
        </Alert>

        {/* S3 — incident tidak pernah disembunyikan (§4.8) */}
        {incidents.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <TriangleAlert className="size-4" />
            <AlertTitle className="text-sm">
              {incidents.length} integritas MISMATCH tercatat
            </AlertTitle>
            <AlertDescription className="text-xs">
              {incidents
                .map((x) => `${x.item.itemNo} — ${x.verification.recordedAt}`)
                .join(" · ")}
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={FolderClosed}
            label="Kasus aktif"
            value={String(activeCases)}
            sub={`/ ${st.cases.length}`}
          />
          <Stat
            icon={Box}
            label="Item evidence"
            value={String(st.evidence.length)}
            sub={`/ ${progress.withHash} ber-hash`}
          />
          <Stat
            icon={ArrowRightLeft}
            label="Event custody"
            value={String(st.custody.length)}
          />
          <Stat
            icon={ShieldCheck}
            label="Terverifikasi"
            value={`${progress.percent}%`}
            sub={`(${progress.verified}/${progress.withHash})`}
          />
        </div>
        <Progress value={progress.percent} className="mb-8 h-1" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-xs uppercase tracking-widest">
                Docket Kasus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {docket.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada kasus — buka melalui modul Kasus.
                </p>
              )}
              {docket.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-accent"
                >
                  <span className="font-mono text-xs text-primary">
                    {c.caseNo}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">
                    {c.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selectEvidenceOfCase(st, c.id).length} item
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] uppercase"
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Aktivitas terakhir — append-only, dari audit (INV-19) */}
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-xs uppercase tracking-widest">
                Aktivitas Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {acts.map((a) => (
                <div key={a.id} className="flex items-baseline gap-3 text-xs">
                  <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {timeAgo(a.at)}
                  </span>
                  <span className="w-28 shrink-0 truncate font-mono text-[10px] font-semibold text-primary">
                    {a.action}
                  </span>
                  <span className="w-20 shrink-0 truncate font-mono text-[10px] text-foreground">
                    {a.target}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {a.detail}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Dicatat {formatUTC(st.settings.recordedAt)} · penyimpanan lokal{" "}
          {storage.warn ? "MENDEKATI KUOTA" : "sehat"} · zero outbound
        </p>
      </div>
    </AppShell>
  );
}
