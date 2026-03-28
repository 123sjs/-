import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BotPage from "@/pages/BotPage";
import LaunchPipelinePage from "@/pages/LaunchPipelinePage";
import NotFound from "@/pages/not-found";
import { LangProvider } from "@/i18n/useLang";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={BotPage} />
      <Route path="/dashboard" component={BotPage} />
      <Route path="/launch-pipeline" component={LaunchPipelinePage} />
      <Route component={BotPage} />
    </Switch>
  );
}

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <LangProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LangProvider>
  );
}

export default App;
