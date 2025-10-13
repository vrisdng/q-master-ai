import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MockExamTimerProps {
  enabled: boolean;
  suggestedMinutes: number;
  remainingMs?: number | null;
  totalMs?: number | null;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const MockExamTimer = ({
  enabled,
  suggestedMinutes,
  remainingMs,
  totalMs,
}: MockExamTimerProps) => {
  const showLiveCountdown = enabled && typeof remainingMs === "number" && remainingMs >= 0 && totalMs;
  const progress = showLiveCountdown && totalMs ? Math.min(1, Math.max(0, (totalMs - remainingMs) / totalMs)) : 0;

  return (
    <Card className="p-4 flex flex-col gap-4 border-dashed border-primary/40 bg-primary/5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Hourglass className={cn("h-6 w-6", showLiveCountdown ? "animate-spin" : "")} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Timer {enabled ? "On" : "Off"}</p>
          {showLiveCountdown ? (
            <p className="text-sm text-muted-foreground">
              Time remaining: <span className="font-semibold text-foreground">{formatDuration(remainingMs)}</span>
            </p>
          ) : enabled ? (
            <p className="text-sm text-muted-foreground">
              Suggested time limit: {suggestedMinutes} minute{suggestedMinutes === 1 ? "" : "s"}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Timer disabled. Pace yourself manually or enable the countdown in test settings.
            </p>
          )}
        </div>
      </div>

      {showLiveCountdown && (
        <div className="w-full md:max-w-xs">
          <div className="h-2 rounded-full bg-primary/10">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggested duration: {suggestedMinutes} minute{suggestedMinutes === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </Card>
  );
};

MockExamTimer.displayName = "MockExamTimer";
