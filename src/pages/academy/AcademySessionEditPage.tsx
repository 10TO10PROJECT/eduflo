import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import AddressSearch from "@/components/AddressSearch";
import SessionBenefitSelector from "@/components/academy/SessionBenefitSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  BENEFIT_TYPE_OPTIONS,
  createDefaultBenefit,
  fetchAcademySessionById,
  fetchSeminarBenefits,
  parseSessionLocation,
  resolveAdminAcademyId,
  updateAcademySession,
  validateSessionBenefits,
  type BenefitType,
  type SessionBenefitInput,
} from "@/lib/academySession";
import { logError } from "@/lib/errorLogger";

const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minuteOptions = ["00", "15", "30", "45"];

const isBenefitType = (value: string | null): value is BenefitType =>
  BENEFIT_TYPE_OPTIONS.some((option) => option.id === value);

const AcademySessionEditPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("14");
  const [minute, setMinute] = useState("00");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [checkInCode, setCheckInCode] = useState<string | null>(null);

  const [benefits, setBenefits] = useState<SessionBenefitInput[]>([
    createDefaultBenefit("first_month_discount"),
  ]);
  const [validDays, setValidDays] = useState("30");
  const [usageCondition, setUsageCondition] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionId) {
      navigate("/admin/sessions", { replace: true });
      return;
    }

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/auth?role=admin&mode=email", { replace: true });
          return;
        }

        const id = await resolveAdminAcademyId(session.user.id);
        if (!id) {
          toast.error("학원 정보를 찾을 수 없습니다.");
          navigate("/admin/home", { replace: true });
          return;
        }

        const existing = await fetchAcademySessionById(sessionId, id);
        if (!existing) {
          toast.error("설명회를 찾을 수 없습니다.");
          navigate("/admin/sessions", { replace: true });
          return;
        }

        setTitle(existing.title);
        setCapacity(String(existing.capacity ?? 30));
        setCheckInCode(existing.check_in_code);

        const sessionDate = new Date(existing.date);
        setDate(sessionDate.toISOString().slice(0, 10));
        setHour(String(sessionDate.getHours()).padStart(2, "0"));
        setMinute(String(sessionDate.getMinutes()).padStart(2, "0"));

        const location = parseSessionLocation(existing.location);
        setLocationName(location.name);
        setLocationAddress(location.address);
        setValidDays(String(existing.coupon_valid_days ?? 30));
        setUsageCondition(existing.coupon_usage_condition ?? "");

        const storedBenefits = await fetchSeminarBenefits(sessionId);
        if (storedBenefits.length > 0) {
          setBenefits(
            storedBenefits.map((benefit) => ({
              benefitType: benefit.benefitType,
              benefitLabel: benefit.benefitLabel,
              discountValue: benefit.discountValue,
            })),
          );
        } else {
          const type = isBenefitType(existing.coupon_benefit_type)
            ? existing.coupon_benefit_type
            : "custom";
          setBenefits([
            {
              benefitType: type,
              benefitLabel: existing.coupon_benefit_label ?? "",
              discountValue: existing.coupon_discount_value ?? "",
            },
          ]);
        }
      } catch (error) {
        logError("fetch-academy-session-edit", error);
        toast.error("설명회 정보를 불러올 수 없습니다.");
        navigate("/admin/sessions", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, sessionId]);

  const validate = () => {
    const nextErrors: Record<string, string> = {
      ...validateSessionBenefits(benefits),
    };
    if (!title.trim()) nextErrors.title = "제목을 입력해주세요.";
    if (!date) nextErrors.date = "일시를 선택해주세요.";
    if (!locationName.trim()) nextErrors.locationName = "장소를 입력해주세요.";

    const days = parseInt(validDays, 10);
    if (Number.isNaN(days) || days < 7 || days > 90) {
      nextErrors.validDays = "유효기간은 7~90일입니다.";
    }

    const attendees = parseInt(capacity, 10);
    if (Number.isNaN(attendees) || attendees < 1) {
      nextErrors.capacity = "예상 인원을 입력해주세요.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!sessionId || !validate()) return;

    const dateTime = new Date(`${date}T${hour}:${minute}`);
    if (dateTime.getTime() < Date.now()) {
      const proceed = window.confirm("과거 일시입니다. 그래도 저장하시겠습니까?");
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      await updateAcademySession({
        sessionId,
        title,
        dateTime: dateTime.toISOString(),
        locationName,
        locationAddress,
        capacity: parseInt(capacity, 10),
        benefits,
        validDays: parseInt(validDays, 10),
        usageCondition,
      });

      toast.success("설명회가 수정되었습니다.");
      navigate(`/admin/sessions/${sessionId}`, { replace: true });
    } catch (error) {
      logError("update-academy-session", error);
      toast.error("설명회 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/sessions/${sessionId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">설명회 수정</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {checkInCode && (
          <p className="text-xs text-muted-foreground text-center">세션 코드: {checkInCode}</p>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">세션 정보</h2>

          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label>일시</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-1" />
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
            </div>
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationName">장소</Label>
            <Input id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
            {errors.locationName && <p className="text-xs text-destructive">{errors.locationName}</p>}
          </div>

          <div className="space-y-2">
            <Label>주소</Label>
            <AddressSearch value={locationAddress} onChange={setLocationAddress} placeholder="주소 검색" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">예상 인원</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
          </div>
        </section>

        <SessionBenefitSelector
          benefits={benefits}
          onChange={setBenefits}
          validDays={validDays}
          onValidDaysChange={setValidDays}
          usageCondition={usageCondition}
          onUsageConditionChange={setUsageCondition}
          errors={errors}
        />
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50">
        <div className="max-w-lg mx-auto">
          <Button className="w-full h-14 text-base font-semibold" size="xl" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "저장 중..." : "저장하기"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AcademySessionEditPage;
