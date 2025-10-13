import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Index = lazy(() => import("./pages/Index"));
const HomePage = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProfilePage = lazy(() => import("./pages/profile"));
const SummarizeDocument = lazy(() => import("./pages/study/SummarizeDocument"));
const ElaborationMode = lazy(() => import("./pages/study/ElaborationMode"));
const SelfExplanationMode = lazy(() => import("./pages/study/SelfExplanationMode"));
const FeynmanMode = lazy(() => import("./pages/study/FeynmanMode"));
const TestMode = lazy(() => import("./pages/study/TestMode"));

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<Toaster />
				<Sonner />
				<BrowserRouter>
					<Suspense
						fallback={
							<div className="min-h-screen flex items-center justify-center">
								<p className="text-sm text-muted-foreground">Loading…</p>
							</div>
						}
					>
						<Routes>
							<Route path="/" element={<HomePage />} />
							<Route path="/practice" element={<Index />} />
							<Route path="/auth" element={<Auth />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/tests" element={<TestMode />} />
                            <Route path="/study/:documentId" element={<SummarizeDocument />} />
                            <Route path="/study/:documentId/test" element={<TestMode />} />
							<Route path="/study/:documentId/elaboration" element={<ElaborationMode />} />
							<Route path="/study/:documentId/self-explanation" element={<SelfExplanationMode />} />
							<Route path="/study/:documentId/feynman" element={<FeynmanMode />} />
							{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
							<Route path="*" element={<NotFound />} />
						</Routes>
					</Suspense>
				</BrowserRouter>
			</TooltipProvider>
		</ThemeProvider>
	</QueryClientProvider>
);

export default App;
