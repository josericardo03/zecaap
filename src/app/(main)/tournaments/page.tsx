import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { createTournament } from "@/app/actions/tournaments";
import { CreateTournamentForm } from "@/components/create-tournament-form";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const userId = session.user.id;

  const [created, participating] = await Promise.all([
    prisma.tournaments.findMany({
      where: { created_by: userId },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.tournaments.findMany({
      where: {
        tournament_players: { some: { user_id: userId } },
        NOT: { created_by: userId },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
  ]);

  const createdIds = new Set(created.map((t) => t.id));
  const participatingOnly = participating.filter((t) => !createdIds.has(t.id));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold text-white">Torneios</h1>
        <p className="mt-1 text-sm text-tm-muted">
          Crie um torneio ou entre com o código compartilhado pelo organizador.
        </p>
      </div>

      <CreateTournamentForm action={createTournament} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Criados por você
        </h2>
        {created.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-tm-surface/50 px-4 py-8 text-center text-sm text-tm-muted">
            Você ainda não criou nenhum torneio.
          </p>
        ) : (
          <ul className="space-y-3">
            {created.map((t) => (
              <TournamentRow key={t.id} t={t} badge="Organizador" />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Onde você joga
        </h2>
        {participatingOnly.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-tm-surface/50 px-4 py-8 text-center text-sm text-tm-muted">
            Você ainda não entrou em nenhum torneio pelo código. Use o formulário na página inicial.
          </p>
        ) : (
          <ul className="space-y-3">
            {participatingOnly.map((t) => (
              <TournamentRow key={t.id} t={t} badge="Jogador" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TournamentRow({
  t,
  badge,
}: {
  t: {
    id: string;
    name: string;
    invite_code: string;
    start_date: Date;
    status: string | null;
  };
  badge: string;
}) {
  return (
    <li className="rounded-2xl border border-white/5 bg-tm-surface/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/tournaments/${t.id}`} className="font-semibold text-white hover:underline">
          {t.name}
        </Link>
        <span className="rounded-full bg-tm-purple/25 px-2 py-0.5 text-xs text-tm-cyan">
          {badge}
        </span>
      </div>
      <p className="mt-1 text-xs text-tm-muted">
        Código:{" "}
        <code className="rounded bg-black/30 px-2 py-0.5 text-tm-cyan">{t.invite_code}</code>
      </p>
      <p className="mt-1 text-xs text-tm-muted">
        Início: {t.start_date.toLocaleDateString("pt-BR")} · {t.status}
      </p>
      <Link
        href={`/tournaments/${t.id}`}
        className="mt-3 inline-block text-sm font-medium text-tm-purple hover:underline"
      >
        Ver detalhes →
      </Link>
    </li>
  );
}
