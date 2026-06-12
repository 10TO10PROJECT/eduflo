import { supabase } from "@/integrations/supabase/client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractSessionId(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (UUID_REGEX.test(trimmed)) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const checkInMatch = url.pathname.match(/\/check-in\/([0-9a-f-]{36})(?:\/|$)/i);
      if (checkInMatch?.[1]) return checkInMatch[1];

      const seminarMatch = url.pathname.match(/\/seminar\/([0-9a-f-]{36})/i);
      if (seminarMatch?.[1]) return seminarMatch[1];

      const sessionParam = url.searchParams.get("session") || url.searchParams.get("code");
      if (sessionParam) return sessionParam.trim();
    } catch {
      return null;
    }
  }

  return null;
}

export async function resolveSessionFromInput(rawValue: string): Promise<string | null> {
  const extracted = extractSessionId(rawValue);
  if (extracted && UUID_REGEX.test(extracted)) return extracted;

  const code = rawValue.trim().toUpperCase();
  if (!code) return null;

  const { data, error } = await supabase
    .from("seminars")
    .select("id")
    .eq("check_in_code", code)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function validateSeminarSession(sessionId: string): Promise<{
  valid: boolean;
  message?: string;
}> {
  const { data, error } = await supabase
    .from("seminars")
    .select("id, status, date")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { valid: false, message: "존재하지 않는 설명회 세션입니다." };
  }
  if (data.status === "closed") {
    return { valid: false, message: "종료된 설명회 세션입니다." };
  }

  const seminarDate = new Date(data.date);
  if (seminarDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return { valid: false, message: "만료된 설명회 세션입니다." };
  }

  return { valid: true };
}

export function formatSeminarHeader(
  academyName: string | null | undefined,
  title: string,
  dateString: string,
) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const academy = academyName?.trim() || "학원";
  const theme = title.trim() || "설명회";
  return `${academy} ${month}/${day} ${theme}`;
}
