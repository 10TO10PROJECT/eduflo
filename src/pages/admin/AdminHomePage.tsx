import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar, Users, User, CalendarCheck, FileText, CalendarDays, AlertCircle } from "lucide-react";

const AdminHomePage = () => {
  const navigate = useNavigate();
  const { memberships, loading: membershipLoading } = useAcademyMembership();
  const [unreadChats, setUnreadChats] = useState(0);
  const [todayVisitConsultations, setTodayVisitConsultations] = useState(0);
  const [upcomingSeminar, setUpcomingSeminar] = useState<{
    daysLeft: number;
    currentAttendees: number;
    capacity: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [hasEditProfilePermission, setHasEditProfilePermission] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const roleLabels: Record<string, string> = {
    owner: "원장",
    vice_owner: "부원장",
    admin: "상담실장",
    teacher: "강사"
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user name from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_name")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setUserName(profile?.user_name || null);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Check if user has approved academy membership
        const { data: memberData } = await supabase
          .from("academy_members")
          .select("academy_id, role, grade, status, permissions")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .maybeSingle();

        let academy = null;
        let canEditProfile = false;
        
        if (memberData) {
          academy = { id: memberData.academy_id };
          setUserRole(memberData.role);
          setUserGrade((memberData as any).grade ?? null);
          // Check edit permission: owner has all permissions, or check edit_profile permission
          const permissions = memberData.permissions as Record<string, boolean> | null;
          canEditProfile = memberData.role === 'owner' || (permissions?.edit_profile === true);
        } else {
          // Fallback: check if user is owner
          const { data: ownerData } = await supabase
            .from("academies")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();
          academy = ownerData;
          if (ownerData) {
            setUserRole('owner');
            setUserGrade(null);
            canEditProfile = true; // Owner always has edit permission
          }
        }

        setHasEditProfilePermission(canEditProfile);

        if (academy) {
          setAcademyId(academy.id);
          
          // Count unread chat messages (messages not read by admin)
          const { data: chatRooms } = await supabase
            .from("chat_rooms")
            .select("id")
            .eq("academy_id", academy.id);

          if (chatRooms && chatRooms.length > 0) {
            const roomIds = chatRooms.map(r => r.id);
            const { count: unreadCount } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("chat_room_id", roomIds)
              .neq("sender_id", user.id)
              .eq("is_read", false);
            
            setUnreadChats(unreadCount || 0);
          }

          // Count today's visit consultations
          const { count: visitCount } = await supabase
            .from("consultation_reservations")
            .select("*", { count: "exact", head: true })
            .eq("academy_id", academy.id)
            .eq("reservation_date", todayStr);

          setTodayVisitConsultations(visitCount || 0);

          // Get upcoming seminar (closest future seminar)
          const { data: seminars } = await supabase
            .from("seminars")
            .select("id, date, capacity")
            .eq("academy_id", academy.id)
            .gte("date", todayStr)
            .order("date", { ascending: true })
            .limit(1);

          if (seminars && seminars.length > 0) {
            const seminar = seminars[0];
            const seminarDate = new Date(seminar.date);
            const diffTime = seminarDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Count applications for this seminar
            const { count: applicationCount } = await supabase
              .from("seminar_applications")
              .select("*", { count: "exact", head: true })
              .eq("seminar_id", seminar.id);

            setUpcomingSeminar({
              daysLeft,
              currentAttendees: applicationCount || 0,
              capacity: seminar.capacity || 0
            });
          }
        } else {
          setAcademyId(null);
        }
      } catch (error) {
        // Error fetching stats - silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleQuickActionClick = (path: string, requiresEditPermission?: boolean) => {
    if (requiresEditPermission && !hasEditProfilePermission) {
      setShowPermissionDialog(true);
      return;
    }
    navigate(path);
  };

  const quickActions = [
    {
      icon: User,
      label: "학원 프로필 관리",
      path: "/admin/profile",
      requiresEditPermission: true
    },
    {
      icon: Users,
      label: "학원 멤버 관리",
      path: "/admin/members"
    },
    {
      icon: CalendarCheck,
      label: "상담 예약 관리",
      path: "/admin/consultations"
    },
    {
      icon: FileText,
      label: "게시물 관리",
      path: "/admin/feed-posts"
    },
    {
      icon: CalendarDays,
      label: "설명회 · 쿠폰",
      path: "/admin/sessions"
    },
    {
      icon: MessageSquare,
      label: "학원 채팅 관리",
      path: "/admin/chat-management"
    }
  ];

  const hasAcademy = academyId !== null;
  const isLoading = loading || membershipLoading;

  const getUserRoleLabel = (role: string | null, grade: string | null): string => {
    if (role === "owner") return "원장";
    switch (grade) {
      case "admin":
        return "원장";
      case "vice_owner":
        return "부원장";
      case "staff":
        return "상담실장";
      case "teacher":
        return "강사";
      default:
        return "상담실장";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
            관리자 모드
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className="gradient-primary rounded-2xl p-5 mb-6 shadow-soft">
          <h2 className="text-primary-foreground font-semibold text-lg mb-1">
            안녕하세요, {userName || "관리자"} {getUserRoleLabel(userRole, userGrade)}님 👋
          </h2>
          <p className="text-primary-foreground/80 text-sm">
            오늘도 10to10과 함께 학원을 운영해보세요
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !hasAcademy ? (
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">등록된 학원이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                학원을 등록하거나 참여 코드로 학원에 합류해주세요
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards - highlighted with different colors */}
            <div className={`grid gap-3 mb-6 ${upcomingSeminar ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {/* Unanswered Chats - blue accent */}
              <Card 
                className="shadow-card border-blue-200 bg-blue-50 cursor-pointer hover:shadow-soft transition-all"
                onClick={() => navigate("/admin/chats")}
              >
                <CardContent className="p-4 text-center">
                  <MessageSquare className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-700">
                    {loading ? "-" : unreadChats}
                  </div>
                  <p className="text-xs text-blue-600 mt-1">미응답 채팅</p>
                </CardContent>
              </Card>

              {/* Today's Visit Consultations - orange accent */}
              <Card 
                className="shadow-card border-orange-200 bg-orange-50 cursor-pointer hover:shadow-soft transition-all"
                onClick={() => navigate("/admin/consultations")}
              >
                <CardContent className="p-4 text-center">
                  <Calendar className="w-5 h-5 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-700">
                    {loading ? "-" : todayVisitConsultations}
                  </div>
                  <p className="text-xs text-orange-600 mt-1">오늘 방문상담</p>
                </CardContent>
              </Card>

              {/* Upcoming Seminar - only show if exists */}
              {upcomingSeminar && (
                <Card 
                  className="shadow-card border-green-200 bg-green-50 cursor-pointer hover:shadow-soft transition-all"
                  onClick={() => navigate("/admin/sessions")}
                >
                  <CardContent className="p-4 text-center">
                    <Users className="w-5 h-5 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-700">
                      D-{upcomingSeminar.daysLeft}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      설명회 {upcomingSeminar.currentAttendees}/{upcomingSeminar.capacity}명
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Quick Actions Section Title */}
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">학원 관리 탭</h3>
            
            {/* Quick Actions - 2x3 Grid */}
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Card
                  key={action.path}
                  className={`shadow-card border-border transition-all ${
                    'disabled' in action && action.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-soft'
                  }`}
                  onClick={() => !('disabled' in action && action.disabled) && handleQuickActionClick(action.path, action.requiresEditPermission)}
                >
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${
                      'disabled' in action && action.disabled ? 'bg-muted' : 'bg-secondary'
                    }`}>
                      <action.icon className={`w-7 h-7 ${'disabled' in action && action.disabled ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <span className={`font-medium text-sm ${'disabled' in action && action.disabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {action.label}
                    </span>
                    {'disabled' in action && action.disabled && (
                      <span className="text-xs text-muted-foreground mt-1">준비 중</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        
      </main>

      {/* Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle>권한이 없습니다</DialogTitle>
            </div>
            <DialogDescription>
              프로필 편집 권한이 없습니다. 학원 원장님에게 권한을 요청해주세요.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowPermissionDialog(false)} className="w-full">
            확인
          </Button>
        </DialogContent>
      </Dialog>

      <AdminBottomNavigation />
    </div>
  );
};

export default AdminHomePage;
