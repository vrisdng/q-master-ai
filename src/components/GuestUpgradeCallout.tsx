import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface GuestUpgradeCalloutProps {
  title?: string;
  description: string;
  ctaLabel?: string;
  className?: string;
}

export const GuestUpgradeCallout = ({
  title = "Unlock full study access",
  description,
  ctaLabel = "Create your free account",
  className,
}: GuestUpgradeCalloutProps) => {
  const navigate = useNavigate();

  return (
    <Card className={`border-dashed border-primary/40 bg-primary/5 p-5 sm:p-6 ${className ?? ""}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">Guest Mode</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          size="sm"
          className="w-fit"
          onClick={() => navigate('/auth')}
        >
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
};

export default GuestUpgradeCallout;
