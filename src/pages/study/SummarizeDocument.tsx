import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Lightbulb, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  fetchDocumentById,
  fetchExampleSummary,
  fetchSummaryKeyPoints,
  evaluateSummary,
  type DocumentDetail,
  type SummaryEvaluation,
  type SummaryExample,
  type SummaryKeyPoint,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from "sonner";

interface CoverageMeterProps {
  coverage: number;
  conciseness: number;
  originality: number;
}

const CoverageMeter = ({ coverage, conciseness, originality }: CoverageMeterProps) => {
  const items = [
    { label: "Coverage", value: coverage },
    { label: "Conciseness", value: conciseness },
    { label: "Originality", value: originality },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-muted-foreground/10 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{item.label}</span>
            <span>{Math.round(item.value * 100)}%</span>
          </div>
          <Progress value={Math.round(item.value * 100)} className="h-2" />
        </div>
      ))}
    </div>
  );
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildHighlightedHtml = (content: string, keyPoints: SummaryKeyPoint[]) => {
  if (!keyPoints.length) {
    return escapeHtml(content).replace(/\n/g, "<br />");
  }

  let working = content;
  const tokens: { start: string; end: string; id: string }[] = [];

  keyPoints.forEach((kp, index) => {
    const excerpt = kp.evidence?.trim();
    if (!excerpt) return;

    const safeExcerpt = excerpt.slice(0, 160);
    const regex = new RegExp(escapeRegExp(safeExcerpt), "i");

    if (!regex.test(working)) return;

    const startToken = `__KP_START_${index}__`;
    const endToken = `__KP_END_${index}__`;
    working = working.replace(regex, (match) => `${startToken}${match}${endToken}`);
    tokens.push({ start: startToken, end: endToken, id: kp.id });
  });

  let escaped = escapeHtml(working);

  tokens.forEach((token) => {
    const startHtml = `<mark data-kp-id="${token.id}" class="rounded px-1 py-0.5 bg-amber-200/60 text-foreground">`;
    const endHtml = "</mark>";
    escaped = escaped
      .replace(new RegExp(escapeRegExp(token.start), "g"), startHtml)
      .replace(new RegExp(escapeRegExp(token.end), "g"), endHtml);
  });

  return escaped.replace(/\n/g, "<br />");
};

const SummarizeDocumentPage = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);

  const [wordTarget, setWordTarget] = useState(150);
  const [keyPoints, setKeyPoints] = useState<SummaryKeyPoint[]>([]);
  const [isFetchingKeyPoints, setIsFetchingKeyPoints] = useState(false);

  const [exampleSummary, setExampleSummary] = useState<SummaryExample | null>(null);
  const [isFetchingExample, setIsFetchingExample] = useState(false);

  const [draftSummary, setDraftSummary] = useState("");

  const [evaluation, setEvaluation] = useState<SummaryEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      navigate("/profile");
      return;
    }

    let isActive = true;
    setIsLoadingDoc(true);
    setDocError(null);

    fetchDocumentById(documentId)
      .then((doc) => {
        if (!isActive) return;
        setDocument(doc);
        setLastUpdatedAt(new Date(doc.createdAt).toLocaleString());
      })
      .catch((error) => {
        console.error("Failed to load document", error);
        if (!isActive) return;
        setDocError(error instanceof Error ? error.message : "Failed to load document");
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingDoc(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [documentId, navigate]);

  const highlightedContent = useMemo(() => {
    if (!document) return "";
    return buildHighlightedHtml(document.content, keyPoints);
  }, [document, keyPoints]);

  const keyPointProgress = useMemo(() => {
    if (evaluation) {
      const total = evaluation.coverage.total || keyPoints.length || 1;
      const covered = Math.min(evaluation.coverage.covered, total);
      return {
        covered,
        total,
        percent: Math.round((covered / total) * 100),
      };
    }

    return {
      covered: 0,
      total: keyPoints.length,
      percent: keyPoints.length > 0 ? 0 : 0,
    };
  }, [evaluation, keyPoints.length]);

  const handleGenerateKeyPoints = useCallback(async () => {
    if (!documentId) return;
    setIsFetchingKeyPoints(true);
    try {
      const result = await fetchSummaryKeyPoints(documentId);
      setKeyPoints(result.keyPoints);
      setWordTarget(result.wordTarget ?? wordTarget);
      setEvaluation(null);
      toast.success("Key points ready");
    } catch (error) {
      console.error("Key point request failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate key points");
    } finally {
      setIsFetchingKeyPoints(false);
    }
  }, [documentId, wordTarget]);

  const handleExampleSummary = useCallback(async () => {
    if (!documentId) return;
    setIsFetchingExample(true);
    try {
      const result = await fetchExampleSummary(documentId);
      setExampleSummary(result);
      setWordTarget(result.wordTarget ?? wordTarget);
      toast.info("Example summary updated");
    } catch (error) {
      console.error("Example summary failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate example summary");
    } finally {
      setIsFetchingExample(false);
    }
  }, [documentId, wordTarget]);

  const handleEvaluate = useCallback(async () => {
    if (!documentId) return;
    if (!draftSummary.trim()) {
      toast.error("Write your summary before checking");
      return;
    }
    if (keyPoints.length === 0) {
      toast.error("Generate key points first to check your summary");
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await evaluateSummary(documentId, {
        summary: draftSummary,
        keyPoints,
      });
      setEvaluation(result);
      setWordTarget(result.wordTarget ?? wordTarget);
      toast.success("Feedback ready");
    } catch (error) {
      console.error("Evaluation failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to evaluate summary");
    } finally {
      setIsEvaluating(false);
    }
  }, [documentId, draftSummary, keyPoints, wordTarget]);

  const exampleLabel = exampleSummary ? "Regenerate Gold Summary" : "Show Example Summary";

  if (isLoadingDoc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Loading study mode…</p>
      </div>
    );
  }

  if (docError || !document) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-12">
        <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="text-lg font-medium text-destructive">Unable to open study mode</h1>
          <p className="mt-2 text-sm text-muted-foreground">{docError ?? "Document not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-muted-foreground/10 bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="font-medium text-foreground">{document.title}</span>
              </div>
              <Badge variant="outline" className="uppercase tracking-wide text-xs">
                {document.sourceType}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Aim for ≤{wordTarget} words
              </Badge>
            </div>
            {lastUpdatedAt && (
              <p className="text-xs text-muted-foreground">Uploaded {lastUpdatedAt}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Key ideas covered</span>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{keyPointProgress.covered}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{keyPointProgress.total || "–"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-80px)]">
          <ResizablePanel defaultSize={55} minSize={35} className="bg-muted/20">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-muted-foreground/10 px-4 py-3 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Material</h2>
                  <p className="text-xs text-muted-foreground">Highlight phrases are suggested once key points are generated.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateKeyPoints} disabled={isFetchingKeyPoints}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isFetchingKeyPoints ? "Generating…" : "Generate AI Key Points"}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <article className="px-4 py-6 sm:px-6">
                  <div
                    className="prose prose-sm max-w-none whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: highlightedContent }}
                  />
                </article>
              </ScrollArea>
              {keyPoints.length > 0 && (
                <div className="border-t border-muted-foreground/10 bg-background/80 px-4 py-4 sm:px-6">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">AI Key Points</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {keyPoints.map((kp) => (
                      <li key={kp.id} className="rounded-md border border-muted-foreground/10 bg-card/60 p-3">
                        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <span>{kp.label}</span>
                          <span>{Math.round(kp.importance * 100)}% signal</span>
                        </div>
                        <p className="mt-1 text-sm text-foreground">{kp.summary}</p>
                        {kp.evidence && (
                          <p className="mt-2 text-xs text-muted-foreground">Evidence: “{kp.evidence}”</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-transparent" />

          <ResizablePanel defaultSize={45} minSize={35}>
            <div className="flex h-full flex-col">
              <div className="flex flex-col gap-4 border-b border-muted-foreground/10 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExampleSummary}
                    disabled={isFetchingExample}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {isFetchingExample ? "Loading…" : exampleLabel}
                  </Button>
                  <Button onClick={handleEvaluate} disabled={isEvaluating}>
                    <Lightbulb className="mr-2 h-4 w-4" />
                    {isEvaluating ? "Checking…" : "Check My Summary"}
                  </Button>
                </div>
                <div className="rounded-md border border-muted-foreground/20 bg-card/70 p-4 shadow-sm">
                  <Textarea
                    value={draftSummary}
                    onChange={(event) => setDraftSummary(event.target.value)}
                    placeholder={`Write your summary in ≤${wordTarget} words…`}
                    className="min-h-[220px] resize-none text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {draftSummary.trim().length > 0
                        ? `${draftSummary.trim().split(/\s+/).filter(Boolean).length} words`
                        : "Start drafting your summary"}
                    </span>
                    {evaluation && (
                      <span className={cn(
                        "font-medium",
                        evaluation.coverage.covered === evaluation.coverage.total
                          ? "text-emerald-600"
                          : "text-amber-600",
                      )}>
                        Essential ideas covered: {evaluation.coverage.covered} / {evaluation.coverage.total}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-6 px-4 py-6 sm:px-6">
                  {exampleSummary && (
                    <div className="rounded-lg border border-muted-foreground/10 bg-muted/30 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                        <span>Gold summary</span>
                        <span>{exampleSummary.wordCount} words</span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{exampleSummary.summary}</p>
                    </div>
                  )}

                  {evaluation ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Strength meter</h3>
                        <CoverageMeter
                          coverage={evaluation.coverage.score}
                          conciseness={evaluation.conciseness.score}
                          originality={evaluation.originality.score}
                        />
                      </div>

                      {evaluation.strengths.length > 0 && (
                        <div className="rounded-lg border border-emerald-200/60 bg-emerald-50 p-4">
                          <h4 className="text-sm font-semibold text-emerald-700">What’s working</h4>
                          <ul className="mt-2 space-y-2 text-sm text-emerald-800">
                            {evaluation.strengths.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.improvements.length > 0 && (
                        <div className="rounded-lg border border-amber-200/80 bg-amber-50 p-4">
                          <h4 className="text-sm font-semibold text-amber-700">Improve your next draft</h4>
                          <ul className="mt-2 space-y-2 text-sm text-amber-800">
                            {evaluation.improvements.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.coverage.missed.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <h4 className="text-sm font-semibold text-slate-700">Mention these ideas</h4>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {evaluation.coverage.missed.map((item) => (
                              <li key={item.id} className="rounded border border-slate-200 bg-white/80 p-3">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</div>
                                <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.rewriteHints.length > 0 && (
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                          <h4 className="text-sm font-semibold text-sky-700">Rewrite hints</h4>
                          <ul className="mt-2 space-y-2 text-sm text-sky-800">
                            {evaluation.rewriteHints.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
                      Use “Check My Summary” to get AI feedback on coverage, conciseness, and originality.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
};

export default SummarizeDocumentPage;
