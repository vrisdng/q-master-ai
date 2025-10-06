import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface StudyModePlaceholderProps {
  icon: LucideIcon;
  modeName: string;
  blurb: string;
  helper?: string;
}

const StudyModePlaceholder = ({ icon: Icon, modeName, blurb, helper }: StudyModePlaceholderProps) => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();

  const goToSummaryMode = () => {
    if (documentId) {
      navigate(`/study/${documentId}`);
      return;
    }
    navigate("/profile");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <Button type="button" variant="ghost" className="w-fit" onClick={() => navigate("/profile")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to documents
      </Button>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-xl rounded-lg border border-dashed border-muted-foreground/30 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">{modeName}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{blurb}</p>
          {helper ? <p className="mt-2 text-xs text-muted-foreground">{helper}</p> : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={goToSummaryMode}>
              Try Summary Mode
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/profile")}>
              Close
            </Button>
          </div>
          {documentId ? (
            <p className="mt-4 text-xs text-muted-foreground">Document ID: {documentId}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StudyModePlaceholder;
