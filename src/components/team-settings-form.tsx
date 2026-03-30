"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { TeamActionState } from "@/app/actions/team";
import { saveTeamLogoUrl, updateTeamDetails } from "@/app/actions/team";
import { createClient } from "@/utils/supabase/client";

type Props = {
  teamId: string;
  initialName: string;
  initialDescription: string | null;
  initialLogoUrl: string | null;
};

export function TeamSettingsForm({
  teamId,
  initialName,
  initialDescription,
  initialLogoUrl,
}: Props) {
  const [state, formAction, pending] = useActionState(updateTeamDetails, null as TeamActionState);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${teamId}/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("team-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploadError(
        upErr.message.includes("Bucket not found") || upErr.message.includes("not found")
          ? "Crie o bucket público team-logos no Supabase Storage."
          : upErr.message
      );
      setUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("team-logos").getPublicUrl(path);
    setLogoUrl(publicUrl);
    const res = await saveTeamLogoUrl(teamId, publicUrl);
    if ("error" in res && res.error) {
      setUploadError(res.error);
    }
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-tm-surface/80 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
        Editar time (capitão)
      </h3>
      <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-6">
        <label htmlFor="team-logo-file" className="relative cursor-pointer">
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-tm-cyan/40 bg-black/30">
            {logoUrl ? (
              <Image src={logoUrl} alt="" fill className="object-cover" sizes="96px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-tm-muted">
                Logo
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition hover:opacity-100">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
          <input
            id="team-logo-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onLogoChange}
            disabled={uploading}
          />
        </label>
        <p className="mt-2 max-w-xs text-xs text-tm-muted sm:mt-0">
          Envio para o bucket <code className="text-tm-cyan">team-logos</code>. O logo é salvo ao
          escolher o arquivo.
          {uploading ? " Enviando…" : null}
        </p>
      </div>
      {uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="team_id" value={teamId} />

        <div>
          <label className="text-xs text-tm-muted">Nome do time</label>
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={initialName}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="text-xs text-tm-muted">Descrição</label>
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={initialDescription ?? ""}
            placeholder="Opcional"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-3 py-2 text-sm text-white placeholder:text-tm-muted"
          />
        </div>

        {state?.error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        ) : null}
        {state?.success ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Nome e descrição salvos.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-tm-purple px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar nome e descrição"}
        </button>
      </form>
    </div>
  );
}
