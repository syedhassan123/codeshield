import Link from "next/link";
import { Camera, Mic, ScanFace, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function InterviewLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative card-soft p-8 max-w-lg w-full shadow-elevated">
        <h1 className="font-display font-bold text-2xl">Interview Lobby</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Run final checks before joining the room
        </p>

        <div className="mt-6 aspect-video rounded-2xl bg-slate-900 text-white flex items-center justify-center relative">
          <div className="absolute top-3 left-3 text-[11px] font-semibold bg-black/50 px-2 py-1 rounded">
            Preview · 1280×720 · 30fps
          </div>
          <Camera className="w-10 h-10 text-white/50" />
        </div>

        <div className="mt-5 space-y-3">
          {[
            { icon: Camera, label: "Camera Check", value: "HD 720p detected" },
            { icon: Mic, label: "Microphone Check", value: "Checking…" },
            { icon: Wifi, label: "Internet Check", value: "Checking…" },
            { icon: ScanFace, label: "Face Verification", value: "Checking…" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border"
            >
              <item.icon className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/interviewer">Cancel</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href={`/interviewer/room/${id}`}>Join Interview</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
