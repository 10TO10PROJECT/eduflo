import { supabase } from "@/integrations/supabase/client";

export type BenefitType =
  | "first_month_discount"
  | "retake"
  | "textbook"
  | "consultation"
  | "custom";

export const BENEFIT_TYPE_OPTIONS: Array<{
  id: BenefitType;
  label: string;
  defaultDiscount: string;
}> = [
  { id: "first_month_discount", label: "첫달할인", defaultDiscount: "10%" },
  { id: "retake", label: "레테권", defaultDiscount: "1회" },
  { id: "textbook", label: "교재", defaultDiscount: "무료 제공" },
  { id: "consultation", label: "상담권", defaultDiscount: "1회" },
  { id: "custom", label: "직접입력", defaultDiscount: "" },
];

export type SessionTab = "active" | "upcoming" | "completed";

export interface AcademySessionRow {
  id: string;
  title: string;
  date: string;
  location: string | null;
  capacity: number | null;
  status: "recruiting" | "closed";
  check_in_code: string | null;
  coupon_benefit_type: string | null;
  coupon_benefit_label: string | null;
  coupon_discount_value: string | null;
  coupon_valid_days: number | null;
  coupon_usage_condition: string | null;
  issued_count?: number;
  used_count?: number;
  expired_count?: number;
}

export async function resolveAdminAcademyId(userId: string): Promise<string | null> {
  const { data: memberData } = await supabase
    .from("academy_members")
    .select("academy_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (memberData?.academy_id) return memberData.academy_id;

  const { data: ownerData } = await supabase
    .from("academies")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  return ownerData?.id ?? null;
}

export function generateCheckInCode() {
  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SEM-${ymd}-${rand}`;
}

export function getParentCheckInUrl(sessionId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/p/check-in/${sessionId}/verify`;
}

export function parseSessionLocation(location: string | null) {
  if (!location) return { name: "", address: "" };
  try {
    const parsed = JSON.parse(location);
    return {
      name: parsed.name || "",
      address: parsed.address || "",
    };
  } catch {
    return { name: location, address: "" };
  }
}

export function formatSessionDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function classifySessionTab(session: AcademySessionRow, now = new Date()): SessionTab {
  const sessionDate = new Date(session.date);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  if (session.status === "closed" || sessionDate < todayStart) {
    return "completed";
  }
  if (sessionDate >= todayEnd) {
    return "upcoming";
  }
  return "active";
}

export async function fetchAcademySessions(academyId: string): Promise<AcademySessionRow[]> {
  const { data, error } = await supabase
    .from("seminars")
    .select("*")
    .eq("academy_id", academyId)
    .order("date", { ascending: true });

  if (error) throw error;

  const seminars = (data ?? []) as AcademySessionRow[];
  if (seminars.length === 0) return [];

  const seminarIds = seminars.map((s) => s.id);
  const { data: coupons, error: couponError } = await supabase
    .from("digital_coupons")
    .select("seminar_id, status, valid_until")
    .in("seminar_id", seminarIds);

  if (couponError) throw couponError;

  const counts = new Map<string, { issued: number; used: number; expired: number }>();
  seminarIds.forEach((id) => counts.set(id, { issued: 0, used: 0, expired: 0 }));

  (coupons ?? []).forEach((coupon) => {
    const bucket = counts.get(coupon.seminar_id);
    if (!bucket) return;
    bucket.issued += 1;
    if (coupon.status === "used") {
      bucket.used += 1;
    } else if (
      coupon.status === "expired" ||
      new Date(coupon.valid_until).getTime() < Date.now()
    ) {
      bucket.expired += 1;
    }
  });

  return seminars.map((seminar) => {
    const stat = counts.get(seminar.id) ?? { issued: 0, used: 0, expired: 0 };
    return {
      ...seminar,
      issued_count: stat.issued,
      used_count: stat.used,
      expired_count: stat.expired,
    };
  });
}

export interface CreateAcademySessionInput {
  academyId: string;
  title: string;
  dateTime: string;
  locationName: string;
  locationAddress: string;
  capacity: number;
  benefitType: BenefitType;
  benefitLabel: string;
  discountValue: string;
  validDays: number;
  usageCondition: string;
}

export async function createAcademySession(input: CreateAcademySessionInput) {
  const checkInCode = generateCheckInCode();

  const { data, error } = await supabase
    .from("seminars")
    .insert({
      academy_id: input.academyId,
      title: input.title.trim(),
      date: input.dateTime,
      location: JSON.stringify({
        name: input.locationName.trim(),
        address: input.locationAddress.trim(),
      }),
      capacity: input.capacity,
      status: "recruiting",
      check_in_code: checkInCode,
      coupon_benefit_type: input.benefitType,
      coupon_benefit_label: input.benefitLabel.trim(),
      coupon_discount_value: input.discountValue.trim(),
      coupon_valid_days: input.validDays,
      coupon_usage_condition: input.usageCondition.trim() || null,
      description: null,
      confirmation_mode: "manual",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function fetchAcademySessionById(
  sessionId: string,
  academyId: string,
): Promise<AcademySessionRow | null> {
  const { data, error } = await supabase
    .from("seminars")
    .select("*")
    .eq("id", sessionId)
    .eq("academy_id", academyId)
    .maybeSingle();

  if (error) throw error;
  return (data as AcademySessionRow | null) ?? null;
}

export interface UpdateAcademySessionInput {
  sessionId: string;
  title: string;
  dateTime: string;
  locationName: string;
  locationAddress: string;
  capacity: number;
  benefitType: BenefitType;
  benefitLabel: string;
  discountValue: string;
  validDays: number;
  usageCondition: string;
}

export async function updateAcademySession(input: UpdateAcademySessionInput) {
  const { error } = await supabase
    .from("seminars")
    .update({
      title: input.title.trim(),
      date: input.dateTime,
      location: JSON.stringify({
        name: input.locationName.trim(),
        address: input.locationAddress.trim(),
      }),
      capacity: input.capacity,
      coupon_benefit_type: input.benefitType,
      coupon_benefit_label: input.benefitLabel.trim(),
      coupon_discount_value: input.discountValue.trim(),
      coupon_valid_days: input.validDays,
      coupon_usage_condition: input.usageCondition.trim() || null,
    })
    .eq("id", input.sessionId);

  if (error) throw error;
}

export async function deleteAcademySession(sessionId: string) {
  const { error } = await supabase.from("seminars").delete().eq("id", sessionId);
  if (error) throw error;
}

export interface CouponUsePreview {
  code: string;
  parent_name_masked: string;
  benefit_label: string;
  discount_value: string;
  valid_until: string;
}

export async function previewCouponUseCode(
  code: string,
  seminarId: string,
): Promise<CouponUsePreview> {
  const { data, error } = await supabase.rpc("preview_coupon_use_code", {
    _code: code,
    _seminar_id: seminarId,
  });

  if (error) throw error;
  return data as CouponUsePreview;
}

export async function redeemCouponUseCode(code: string, seminarId: string) {
  const { data, error } = await supabase.rpc("redeem_coupon_use_code", {
    _code: code,
    _seminar_id: seminarId,
  });

  if (error) throw error;
  return data;
}

export interface SessionReportSummary {
  issued: number;
  used: number;
  expired: number;
  enrolled: number;
  conversion_rate: number;
}

export interface SessionReportRow {
  coupon_id: string;
  parent_name_masked: string;
  phone_suffix: string;
  issued_at: string;
  status: string;
  used_at: string | null;
  enrolled_at: string | null;
  is_expired: boolean;
}

export interface SessionReport {
  seminar_title: string;
  seminar_date: string;
  summary: SessionReportSummary;
  rows: SessionReportRow[];
}

export async function fetchSessionReport(seminarId: string): Promise<SessionReport> {
  const { data, error } = await supabase.rpc("get_seminar_coupon_report", {
    _seminar_id: seminarId,
  });

  if (error) throw error;
  return data as SessionReport;
}

export async function markCouponEnrolled(couponId: string, seminarId: string) {
  const { data, error } = await supabase.rpc("mark_coupon_enrolled", {
    _coupon_id: couponId,
    _seminar_id: seminarId,
  });

  if (error) throw error;
  return data;
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadSessionReportCsv(report: SessionReport) {
  const headers = ["이름", "휴대폰뒷자리", "발급일", "사용여부", "사용일", "등록여부", "등록일"];
  const lines = report.rows.map((row) => {
    const issuedAt = new Date(row.issued_at).toLocaleString("ko-KR");
    const usedLabel = row.status === "used" ? "사용" : "미사용";
    const usedAt = row.used_at ? new Date(row.used_at).toLocaleString("ko-KR") : "";
    const enrolledLabel = row.enrolled_at ? "등록" : "미등록";
    const enrolledAt = row.enrolled_at ? new Date(row.enrolled_at).toLocaleString("ko-KR") : "";

    return [
      row.parent_name_masked,
      row.phone_suffix,
      issuedAt,
      usedLabel,
      usedAt,
      enrolledLabel,
      enrolledAt,
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  const csv = `\uFEFF${headers.join(",")}\n${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTitle = report.seminar_title.replace(/[/\\?%*:|"<>]/g, "-");
  anchor.href = url;
  anchor.download = `${safeTitle}_리포트.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
