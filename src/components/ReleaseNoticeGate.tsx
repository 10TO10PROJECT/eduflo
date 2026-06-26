import { useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FormalReleaseBanner from "./FormalReleaseBanner";

/** 커뮤니티 일부 경로는 허용하고, 그 외 경로(및 일부 비공개 기능)에서 배너 표시 */
function shouldBlockCommunityPath(pathname: string): boolean {
  if (pathname === "/admin/community" || pathname === "/p/community") {
    return false;
  }
  if (
    pathname.startsWith("/p/community/post/") ||
    pathname.startsWith("/s/community/post/") ||
    pathname.startsWith("/admin/community/post/")
  ) {
    return false;
  }

  return pathname.includes("/community");
}

interface ReleaseNoticeGateProps {
  children: ReactNode;
}

/**
 * 로그인 후 정식 출시 안내 가림 배너를 표시합니다.
 */
const ReleaseNoticeGate = ({ children }: ReleaseNoticeGateProps) => {
  const { pathname } = useLocation();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const loggedIn = !!session;
      setHasSession(loggedIn);

      if (loggedIn && session) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("is_super_admin")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsSuperAdmin(!!roleData?.is_super_admin);
      } else {
        setIsSuperAdmin(false);
      }
    };

    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });
    return () => subscription.unsubscribe();
  }, []);

  const showBanner =
    hasSession === true &&
    !isSuperAdmin &&
    shouldBlockCommunityPath(pathname);

  return (
    <>
      {children}
      {showBanner && <FormalReleaseBanner />}
    </>
  );
};

export default ReleaseNoticeGate;