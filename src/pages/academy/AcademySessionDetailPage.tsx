import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAcademySession,
  fetchAcademySessions,
  formatSessionDateTime,
  getParentCheckInUrl,
  parseSessionLocation,
  resolveAdminAcademyId,
  type AcademySessionRow,
} from "@/lib/academySession";
import { logError } from "@/lib/errorLogger";

const AcademySessionDetailPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<AcademySessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate("/admin/sessions", { replace: true });
      return;
    }

    const load = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const user = authSession?.user;
        if (!user) {
          navigate("/auth?role=admin&mode=email", { replace: true });
          return;
        }

        const academyId = await resolveAdminAcademyId(user.id);
        if (!academyId) {
          toast.error("학원 정보를 찾을 수 없습니다.");
          navigate("/admin/home", { replace: true });
          return;
        }

        const sessions = await fetchAcademySessions(academyId);
        const found = sessions.find((item) => item.id === sessionId) ?? null;
        if (!found) {
          toast.error("설명회를 찾을 수 없습니다.");
          navigate("/admin/sessions", { replace: true });
          return;
        }

        setSession(found);
      } catch (error) {
        logError("fetch-academy-session-detail", error);
        toast.error("설명회 정보를 불러올 수 없습니다.");
        navigate("/admin/sessions", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, sessionId]);

  const checkInUrl = useMemo(
    () => (sessionId ? getParentCheckInUrl(sessionId) : ""),
    [sessionId],
  );

  const handleDelete = async () => {
    if (!sessionId) return;

    setDeleting(true);
    try {
      await deleteAcademySession(sessionId);
      toast.success("설명회가 삭제되었습니다.");
      navigate("/admin/sessions", { replace: true });
    } catch (error) {
      logError("delete-academy-session", error);
      toast.error("설명회 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;

  const location = parseSessionLocation(session.location);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/sessions")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{session.title}</h1>
            <p className="text-xs text-muted-foreground truncate">{formatSessionDateTime(session.date)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/sessions/${session.id}/edit`)}>
                수정하기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/admin/sessions/${session.id}/report`)}>
                리포트 보기
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                삭제하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {location.name && (
          <p className="text-sm text-muted-foreground">{location.name}</p>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-soft flex flex-col items-center">
          <QRCode value={checkInUrl} size={220} />
          {session.check_in_code && (
            <p className="text-xs text-muted-foreground mt-4">세션 코드: {session.check_in_code}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-card border border-border rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">발급</p>
            <p className="text-xl font-bold text-foreground">{session.issued_count ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">사용</p>
            <p className="text-xl font-bold text-primary">{session.used_count ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">만료</p>
            <p className="text-xl font-bold text-muted-foreground">{session.expired_count ?? 0}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 text-sm">
          <p className="font-medium text-foreground">{session.coupon_benefit_label ?? "혜택"}</p>
          <p className="text-primary font-bold mt-1">{session.coupon_discount_value}</p>
          {session.coupon_usage_condition && (
            <p className="text-muted-foreground mt-2">{session.coupon_usage_condition}</p>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            className="w-full h-14 text-base font-semibold"
            size="xl"
            onClick={() => navigate(`/admin/sessions/${session.id}/redeem`)}
          >
            쿠폰 사용 처리
          </Button>
          <button
            type="button"
            className="w-full text-sm text-primary hover:underline"
            onClick={() => navigate(`/admin/sessions/${session.id}/report`)}
          >
            리포트 보기
          </button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>설명회를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              발급된 쿠폰과 사용 기록도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "삭제 중..." : "삭제하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcademySessionDetailPage;
