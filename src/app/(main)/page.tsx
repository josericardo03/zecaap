import { getPrisma } from "@/lib/prisma";
import { joinTournamentByCode } from "@/app/actions/tournaments";
import { JoinTournamentForm } from "@/components/join-tournament-form";
import { Zap, Trophy, Medal, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const teams = await getPrisma().teams.findMany({
    take: 8,
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-tm-cyan/20 bg-gradient-to-br from-tm-surface to-[#0b0e1b] p-6 shadow-[0_0_40px_-12px_rgba(45,226,226,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-tm-cyan">
          Pronto para o próximo nível?
        </p>
        <h2 className="mt-2 text-xl font-bold text-white">Entre com o código do torneio</h2>
        <div className="mt-4">
          <JoinTournamentForm action={joinTournamentByCode} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Times
        </h3>
        <ul className="space-y-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="rounded-xl border border-white/5 bg-tm-surface/80 px-4 py-3 text-sm"
            >
              <span className="font-medium text-white">{team.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Suas estatísticas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Trophy} label="Troféus" value="—" accent="text-tm-purple" />
          <StatCard icon={Medal} label="Win rate" value="—" accent="text-tm-cyan" />
          <StatCard icon={Zap} label="XP tático" value="—" accent="text-pink-400" />
          <StatCard icon={History} label="Partidas" value="—" accent="text-tm-muted" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-tm-surface/90 p-4">
      <Icon className={`h-6 w-6 ${accent}`} />
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-tm-muted">{label}</p>
    </div>
  );
}
