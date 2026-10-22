import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { DraftsProvider } from "./context/DraftsContext";
import { ClientsProvider } from "./context/ClientsContext";
import { BlogsProvider } from "./context/BlogsContext";
import { TonesProvider } from "./context/TonesContext";
import { EmailCampaignsProvider } from "./context/EmailCampaignsContext";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ClientHubPage } from "./pages/ClientHubPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { LibraryPage } from "./pages/LibraryPage";
import { DraftPage } from "./pages/DraftPage";
import { TonesPage } from "./pages/TonesPage";
import { ActivityPage } from "./pages/ActivityPage";
import { CalendarPage } from "./pages/CalendarPage";
import { UsagePage } from "./pages/UsagePage";
import { BlogWizardPage } from "./pages/BlogWizardPage";
import { BlogReaderPage } from "./pages/BlogReaderPage";
import { BlogEditorPage } from "./pages/BlogEditorPage";
import { EmailWizardPage } from "./pages/EmailWizardPage";
import { EmptyState } from "./components/ui";

export function App() {
  return (
    <ClientsProvider>
      <TonesProvider>
        <DraftsProvider>
          <BlogsProvider>
            <EmailCampaignsProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="clients" element={<ClientHubPage />} />
                    <Route path="clients/:clientId" element={<WorkspacePage />} />
                    <Route
                      path="clients/:clientId/generate"
                      element={<BlogWizardPage />}
                    />
                    <Route
                      path="clients/:clientId/email"
                      element={<EmailWizardPage />}
                    />
                    <Route
                      path="clients/:clientId/blog/:blogId/edit"
                      element={<BlogEditorPage />}
                    />
                    <Route
                      path="clients/:clientId/blog/:blogId"
                      element={<BlogReaderPage />}
                    />
                    <Route path="library" element={<LibraryPage />} />
                    <Route path="library/:draftId" element={<DraftPage />} />
                    <Route path="tones" element={<TonesPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="activity" element={<ActivityPage />} />
                    <Route path="usage" element={<UsagePage />} />
                    <Route
                      path="*"
                      element={
                        <EmptyState
                          title="Page not found"
                          body="Use the sidebar to open Client Hub, tones, activity, or usage."
                          action={
                            <Link className="btn btn-primary" to="/">
                              Back to overview
                            </Link>
                          }
                        />
                      }
                    />
                  </Route>
                </Routes>
              </BrowserRouter>
            </EmailCampaignsProvider>
          </BlogsProvider>
        </DraftsProvider>
      </TonesProvider>
    </ClientsProvider>
  );
}
