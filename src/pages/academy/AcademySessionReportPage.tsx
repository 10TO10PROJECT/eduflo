import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  downloadSessionReportCsv,
  fetchSessionReport,
  formatSessionDateTime,
  markCouponEnrolled,
  resolveAdminAcademyId,
  type SessionReport,
  type SessionReportRow,
} from "@/lib/academySession";
import { logError } from "@/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";

function formatReportDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

const AcademySessionReportPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!sessionId) return;

    try {
      const data = await fetchSessionReport(sessionId);
      setReport(data);
    } catch (error) {
      logError("fetch-session-report", error);
      toast.error("리포트를 불러올 수 없습니다.");
      navigate(`/admin/sessions/${sessionId}`, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      navigate("/admin/sessions", { replace: true });
      return;
    }

    const init = async () => {
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

      await loadReport();
    };

    init();
  }, [loadReport, navigate, sessionId]);

  const handleEnroll = async (row: SessionReportRow) => {
    if (!sessionId || row.enrolled_at) return;

    setEnrollingId(row.coupon_id);
    try {
      await markCouponEnrolled(row.coupon_id, sessionId);
      toast.success("등록 처리되었습니다.");
      await loadReport();
    } catch (error) {
      logError("mark-coupon-enrolled", error);
      toast.error("등록 처리에 실패했습니다.");
    } finally {
      setEnrollingId(null);
    }
  };

  const handleDownloadCsv = () => {
    if (!report) return;
    downloadSessionReportCsv(report);
    toast.success("CSV 파일을 다운로드했습니다.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!report) return null;

  const { summary } = report;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/sessions/${sessionId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground">사후 리포트</h1>
            <p className="text-xs text-muted-foreground truncate">
              {report.seminar_title} · {formatSessionDateTime(report.seminar_date)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-card">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">발급</p>
              <p className="text-xl font-bold text-foreground">{summary.issued}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">사용</p>
              <p className="text-xl font-bold text-primary">{summary.used}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">만료</p>
              <p className="text-xl font-bold text-muted-foreground">{summary.expired}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">등록 전환률</p>
              <p className="text-lg font-bold text-foreground">{summary.conversion_rate}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">등록</p>
              <p className="text-lg font-bold text-foreground">{summary.enrolled}명</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">학부모 목록</p>

          {report.rows.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">발급된 쿠폰이 없습니다.</p>
            </div>
          ) : (
            report.rows.map((row) => (
              <div
                key={row.coupon_id}
                className="bg-card border border-border rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.parent_name_masked}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ***-{row.phone_suffix} · {formatReportDate(row.issued_at)} 발급
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={
                        row.status === "used"
                          ? "text-xs font-medium text-primary"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {row.status === "used" ? "사용" : row.is_expired ? "만료" : "미사용"}
                    </span>
                    <span
                      className={
                        row.enrolled_at
                          ? "text-xs font-medium text-foreground"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {row.enrolled_at ? "등록됨" : "미등록"}
                    </span>
                  </div>
                </div>

                {!row.enrolled_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={enrollingId === row.coupon_id}
                    onClick={() => handleEnroll(row)}
                  >
                    {enrollingId === row.coupon_id ? "처리 중..." : "등록 처리"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full h-14 text-base font-semibold gap-2"
            size="xl"
            disabled={!report.rows.length}
            onClick={handleDownloadCsv}
          >
            <Download className="w-5 h-5" />
            CSV 다운로드
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AcademySessionReportPage;
