import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  classifySessionTab,
  fetchAcademySessions,
  formatSessionDateTime,
  parseSessionLocation,
  resolveAdminAcademyId,
  type AcademySessionRow,
  type SessionTab,
} from "@/lib/academySession";
import { logError } from "@/lib/errorLogger";

const AcademySessionListPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AcademySessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SessionTab>("active");

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/auth?role=admin&mode=email", { replace: true });
          return;
        }

        const academyId = await resolveAdminAcademyId(session.user.id);
        if (!academyId) {
          toast.error("학원 정보를 찾을 수 없습니다.");
          navigate("/admin/home", { replace: true });
          return;
        }

        setSessions(await fetchAcademySessions(academyId));
      } catch (error) {
        logError("fetch-academy-sessions", error);
        toast.error("설명회 목록을 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const filteredSessions = useMemo(
    () => sessions.filter((session) => classifySessionTab(session) === tab),
    [sessions, tab],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">설명회</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as SessionTab)}>
          <TabsList className="grid w-full grid-cols-3 mt-4">
            <TabsTrigger value="active">진행 중</TabsTrigger>
            <TabsTrigger value="upcoming">예정</TabsTrigger>
            <TabsTrigger value="completed">완료</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">첫 설명회를 만들어보세요</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {filteredSessions.map((session) => {
                  const location = parseSessionLocation(session.location);
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => navigate(`/admin/sessions/${session.id}`)}
                      className="w-full text-left bg-card border border-border rounded-2xl p-4 shadow-card hover:shadow-soft transition-all"
                    >
                      <p className="text-xs text-muted-foreground">{formatSessionDateTime(session.date)}</p>
                      <p className="font-semibold text-foreground mt-1">{session.title}</p>
                      {location.name && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{location.name}</p>
                      )}
                      <p className="text-xs text-primary font-medium mt-2">
                        발급 {session.issued_count ?? 0} · 사용 {session.used_count ?? 0}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <button
        type="button"
        aria-label="새 설명회 생성"
        onClick={() => navigate("/admin/sessions/create")}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full gradient-primary text-primary-foreground shadow-soft flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      <AdminBottomNavigation />
    </div>
  );
};

export default AcademySessionListPage;
