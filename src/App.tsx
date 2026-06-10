import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RegionProvider } from "@/contexts/RegionContext";
import SplashScreen from "./components/SplashScreen";
import RoleSelection from "./pages/RoleSelection";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import CommunityPage from "./pages/CommunityPage";
import PostDetailPage from "./pages/PostDetailPage";
import MyPage from "./pages/MyPage";
import MyClassesPage from "./pages/MyClassesPage";
import MyBookmarksPage from "./pages/MyBookmarksPage";
import MyReservationsPage from "./pages/MyReservationsPage";
import ChildConnectionPage from "./pages/ChildConnectionPage";
import ParentConnectionPage from "./pages/ParentConnectionPage";
import SettingsPage from "./pages/SettingsPage";
import CustomerServicePage from "./pages/CustomerServicePage";
import SeminarDetailPage from "./pages/SeminarDetailPage";
import AcademyDetailPage from "./pages/AcademyDetailPage";
import ChatListPage from "./pages/ChatListPage";
import ChatRoomPage from "./pages/ChatRoomPage";
import FolderManagementPage from "./pages/FolderManagementPage";
import CreateFolderPage from "./pages/CreateFolderPage";
import ChatRoomSelectPage from "./pages/ChatRoomSelectPage";
import LearningStyleTest from "./pages/LearningStyleTest";
import LearningStyleResult from "./pages/LearningStyleResult";
import PreferenceTest from "./pages/PreferenceTest";
import PreferenceResult from "./pages/PreferenceResult";
import TimetablePage from "./pages/TimetablePage";
import EventsPage from "./pages/EventsPage";
import ParentQrScannerPage from "./pages/parent/ParentQrScannerPage";
import ParentCheckInVerifyPage from "./pages/parent/ParentCheckInVerifyPage";
import ParentCheckInCompletePage from "./pages/parent/ParentCheckInCompletePage";
import ParentCouponsPage from "./pages/parent/ParentCouponsPage";
import ParentCouponDetailPage from "./pages/parent/ParentCouponDetailPage";
import ParentCouponUseCodePage from "./pages/parent/ParentCouponUseCodePage";
import ParentCouponUsedPage from "./pages/parent/ParentCouponUsedPage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import ConsultationManagementPage from "./pages/admin/ConsultationManagementPage";
import ReservationManagementPage from "./pages/admin/ReservationManagementPage";
import ProfileManagementPage from "./pages/admin/ProfileManagementPage";
import ProfileReadOnlyPage from "./pages/admin/ProfileReadOnlyPage";
import SeminarManagementPage from "./pages/admin/SeminarManagementPage";
import SeminarApplicantsPage from "./pages/admin/SeminarApplicantsPage";
import PostManagementPage from "./pages/admin/PostManagementPage";
import FeedPostManagementPage from "./pages/admin/FeedPostManagementPage";
import AdminChatListPage from "./pages/admin/AdminChatListPage";
import AdminChatRoomPage from "./pages/admin/AdminChatRoomPage";
import AdminCommunityPage from "./pages/admin/AdminCommunityPage";
import BusinessVerificationPage from "./pages/admin/BusinessVerificationPage";
import VerificationReviewPage from "./pages/admin/VerificationReviewPage";
import SuperAdminPage from "./pages/admin/SuperAdminPage";
import SuperAdminSettingsPage from "./pages/admin/SuperAdminSettingsPage";
import SuperAdminUsersPage from "./pages/admin/SuperAdminUsersPage";
import SuperAdminPostsPage from "./pages/admin/SuperAdminPostsPage";
import SuperAdminAcademiesPage from "./pages/admin/SuperAdminAcademiesPage";
import SuperAdminAcademyCreatePage from "./pages/admin/SuperAdminAcademyCreatePage";
import SuperAdminAcademyEditPage from "./pages/admin/SuperAdminAcademyEditPage";
import SuperAdminCommunityPage from "./pages/admin/SuperAdminCommunityPage";
import SuperAdminSeminarPage from "./pages/admin/SuperAdminSeminarPage";
import AdminMyPage from "./pages/admin/AdminMyPage";
import MemberManagementPage from "./pages/admin/MemberManagementPage";
import ChatManagementPage from "./pages/admin/ChatManagementPage";
import AcademySetupPage from "./pages/academy/AcademySetupPage";
import AcademyOnboardingPage from "./pages/academy/AcademyOnboardingPage";
import AcademyDashboardPage from "./pages/academy/AcademyDashboardPage";
import AcademySessionListPage from "./pages/academy/AcademySessionListPage";
import AcademySessionCreatePage from "./pages/academy/AcademySessionCreatePage";
import AcademySessionEditPage from "./pages/academy/AcademySessionEditPage";
import AcademySessionDetailPage from "./pages/academy/AcademySessionDetailPage";
import AcademySessionRedeemPage from "./pages/academy/AcademySessionRedeemPage";
import AcademySessionReportPage from "./pages/academy/AcademySessionReportPage";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedSuperAdminRoute from "./components/ProtectedSuperAdminRoute";
import NotFound from "./pages/NotFound";
import ReleaseNoticeGate from "./components/ReleaseNoticeGate";

// Student Pages
import StudentHomePage from "./pages/student/StudentHomePage";
import StudentMyPage from "./pages/student/StudentMyPage";

// Super Admin Pages
import SuperAdminHomePage from "./pages/super/SuperAdminHomePage";
import SuperAdminCenterPage from "./pages/super/SuperAdminCenterPage";
import SuperAdminCustomerServicePage from "./pages/super/SuperAdminCustomerServicePage";
import SuperAdminExplorePage from "./pages/super/SuperAdminExplorePage";
import SuperAdminCommunityViewPage from "./pages/super/SuperAdminCommunityViewPage";
import SuperAdminMyPage from "./pages/super/SuperAdminMyPage";

// Shared Pages
import AnnouncementsPage from "./pages/AnnouncementsPage";
import MyProfilePage from "./pages/MyProfilePage";
import BlockedUsersPage from "./pages/BlockedUsersPage";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  // Global unhandled rejection handler to prevent white screen crashes
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RegionProvider>
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
          <BrowserRouter>
            <ReleaseNoticeGate>
            <Routes>
              <Route path="/" element={<RoleSelection />} />
              <Route path="/role-selection" element={<RoleSelection />} />
              <Route path="/auth" element={<AuthPage />} />
              
              {/* Parent Routes (/p prefix) */}
              <Route path="/p/home" element={<HomePage />} />
              <Route path="/p/explore" element={<ExplorePage />} />
              <Route path="/p/community" element={<CommunityPage />} />
              <Route path="/p/community/post/:postId" element={<PostDetailPage />} />
              <Route path="/p/my" element={<MyPage />} />
              <Route path="/p/my/profile" element={<MyProfilePage />} />
              <Route path="/p/my/blocked-users" element={<BlockedUsersPage />} />
              <Route path="/p/my/classes" element={<MyClassesPage />} />
              <Route path="/p/my/bookmarks" element={<MyBookmarksPage />} />
              <Route path="/p/my/reservations" element={<MyReservationsPage />} />
              <Route path="/p/child-connection" element={<ChildConnectionPage />} />
              <Route path="/p/settings" element={<SettingsPage />} />
              <Route path="/p/customer-service" element={<CustomerServicePage />} />
              <Route path="/p/chats" element={<ChatListPage />} />
              <Route path="/p/chats/folders" element={<FolderManagementPage />} />
              <Route path="/p/chats/folders/create" element={<CreateFolderPage />} />
              <Route path="/p/chats/folders/create/select" element={<ChatRoomSelectPage />} />
              <Route path="/p/chats/:id" element={<ChatRoomPage />} />
              <Route path="/p/seminar/:id" element={<SeminarDetailPage />} />
              <Route path="/p/academy/:id" element={<AcademyDetailPage />} />
              <Route path="/p/learning-style-test" element={<LearningStyleTest />} />
              <Route path="/p/learning-style-result" element={<LearningStyleResult />} />
              <Route path="/p/preference-test" element={<PreferenceTest />} />
              <Route path="/p/preference-result" element={<PreferenceResult />} />
              <Route path="/p/timetable" element={<TimetablePage />} />
              <Route path="/p/events" element={<EventsPage />} />
              <Route path="/p/announcements" element={<AnnouncementsPage />} />
              <Route path="/p/check-in" element={<ParentQrScannerPage />} />
              <Route path="/p/check-in/:sessionId/verify" element={<ParentCheckInVerifyPage />} />
              <Route path="/p/check-in/:sessionId/complete" element={<ParentCheckInCompletePage />} />
              <Route path="/p/coupons" element={<ParentCouponsPage />} />
              <Route path="/p/coupons/:couponId" element={<ParentCouponDetailPage />} />
              <Route path="/p/coupons/:couponId/use" element={<ParentCouponUseCodePage />} />
              <Route path="/p/coupons/:couponId/complete" element={<ParentCouponUsedPage />} />
              
              {/* Student Routes (/s prefix) */}
              <Route path="/s/home" element={<StudentHomePage />} />
              <Route path="/s/explore" element={<ExplorePage />} />
              <Route path="/s/community" element={<CommunityPage />} />
              <Route path="/s/community/post/:postId" element={<PostDetailPage />} />
              <Route path="/s/my" element={<StudentMyPage />} />
              <Route path="/s/my/profile" element={<MyProfilePage />} />
              <Route path="/s/my/blocked-users" element={<BlockedUsersPage />} />
              <Route path="/s/my/classes" element={<MyClassesPage />} />
              <Route path="/s/my/bookmarks" element={<MyBookmarksPage />} />
              <Route path="/s/my/reservations" element={<MyReservationsPage />} />
              <Route path="/s/parent-connection" element={<ParentConnectionPage />} />
              <Route path="/s/settings" element={<SettingsPage />} />
              <Route path="/s/customer-service" element={<CustomerServicePage />} />
              <Route path="/s/chats" element={<ChatListPage />} />
              <Route path="/s/chats/folders" element={<FolderManagementPage />} />
              <Route path="/s/chats/folders/create" element={<CreateFolderPage />} />
              <Route path="/s/chats/folders/create/select" element={<ChatRoomSelectPage />} />
              <Route path="/s/chats/:id" element={<ChatRoomPage />} />
              <Route path="/s/seminar/:id" element={<SeminarDetailPage />} />
              <Route path="/s/academy/:id" element={<AcademyDetailPage />} />
              <Route path="/s/learning-style-test" element={<LearningStyleTest />} />
              <Route path="/s/learning-style-result" element={<LearningStyleResult />} />
              <Route path="/s/preference-test" element={<PreferenceTest />} />
              <Route path="/s/preference-result" element={<PreferenceResult />} />
              <Route path="/s/timetable" element={<TimetablePage />} />
              <Route path="/s/events" element={<EventsPage />} />
              <Route path="/s/announcements" element={<AnnouncementsPage />} />
              
              {/* Legacy routes - keep for backwards compatibility */}
              <Route path="/home" element={<HomePage />} />

              {/* Protected Admin Routes */}
              <Route path="/academy/onboarding" element={<ProtectedAdminRoute><AcademyOnboardingPage /></ProtectedAdminRoute>} />
              <Route path="/academy/setup" element={<ProtectedAdminRoute><AcademySetupPage /></ProtectedAdminRoute>} />
              <Route path="/academy/dashboard" element={<ProtectedAdminRoute><AcademyDashboardPage /></ProtectedAdminRoute>} />
              <Route path="/admin/home" element={<ProtectedAdminRoute><AdminHomePage /></ProtectedAdminRoute>} />
              <Route path="/admin/consultations" element={<ProtectedAdminRoute><ConsultationManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/reservations" element={<ProtectedAdminRoute><ReservationManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/profile" element={<ProtectedAdminRoute><ProfileManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/profileread" element={<ProtectedAdminRoute><ProfileReadOnlyPage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions" element={<ProtectedAdminRoute><AcademySessionListPage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions/create" element={<ProtectedAdminRoute><AcademySessionCreatePage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions/:sessionId/edit" element={<ProtectedAdminRoute><AcademySessionEditPage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions/:sessionId" element={<ProtectedAdminRoute><AcademySessionDetailPage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions/:sessionId/redeem" element={<ProtectedAdminRoute><AcademySessionRedeemPage /></ProtectedAdminRoute>} />
              <Route path="/admin/sessions/:sessionId/report" element={<ProtectedAdminRoute><AcademySessionReportPage /></ProtectedAdminRoute>} />
              <Route path="/admin/seminars" element={<ProtectedAdminRoute><SeminarManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/seminars/:seminarId/applicants" element={<ProtectedAdminRoute><SeminarApplicantsPage /></ProtectedAdminRoute>} />
              <Route path="/admin/posts" element={<ProtectedAdminRoute><PostManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/feed-posts" element={<ProtectedAdminRoute><FeedPostManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/chats" element={<ProtectedAdminRoute><AdminChatListPage /></ProtectedAdminRoute>} />
              <Route path="/admin/chats/:id" element={<ProtectedAdminRoute><AdminChatRoomPage /></ProtectedAdminRoute>} />
              <Route path="/admin/community" element={<ProtectedAdminRoute><AdminCommunityPage /></ProtectedAdminRoute>} />
              <Route path="/admin/community/post/:postId" element={<ProtectedAdminRoute><PostDetailPage /></ProtectedAdminRoute>} />
              <Route path="/admin/verification" element={<ProtectedAdminRoute><BusinessVerificationPage /></ProtectedAdminRoute>} />
              <Route path="/admin/verification-review" element={<ProtectedAdminRoute><VerificationReviewPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super" element={<ProtectedAdminRoute><SuperAdminPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/settings" element={<ProtectedAdminRoute><SuperAdminSettingsPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/users" element={<ProtectedAdminRoute><SuperAdminUsersPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/posts" element={<ProtectedAdminRoute><SuperAdminPostsPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/academies" element={<ProtectedAdminRoute><SuperAdminAcademiesPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/academies/create" element={<ProtectedAdminRoute><SuperAdminAcademyCreatePage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/academies/:id/edit" element={<ProtectedAdminRoute><SuperAdminAcademyEditPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/community" element={<ProtectedAdminRoute><SuperAdminCommunityPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/seminars" element={<ProtectedAdminRoute><SuperAdminSeminarPage /></ProtectedAdminRoute>} />
              <Route path="/admin/super/seminars/:seminarId/applicants" element={<ProtectedAdminRoute><SeminarApplicantsPage /></ProtectedAdminRoute>} />
              <Route path="/admin/my" element={<ProtectedAdminRoute><AdminMyPage /></ProtectedAdminRoute>} />
              <Route path="/admin/my/profile" element={<ProtectedAdminRoute><MyProfilePage /></ProtectedAdminRoute>} />
              <Route path="/admin/my/blocked-users" element={<ProtectedAdminRoute><BlockedUsersPage /></ProtectedAdminRoute>} />
              <Route path="/admin/settings" element={<ProtectedAdminRoute><SettingsPage /></ProtectedAdminRoute>} />
              <Route path="/admin/customer-service" element={<ProtectedAdminRoute><CustomerServicePage /></ProtectedAdminRoute>} />
              <Route path="/admin/members" element={<ProtectedAdminRoute><MemberManagementPage /></ProtectedAdminRoute>} />
              <Route path="/admin/chat-management" element={<ProtectedAdminRoute><ChatManagementPage /></ProtectedAdminRoute>} />
              
              {/* Super Admin Routes (/super prefix) */}
              <Route path="/super/home" element={<ProtectedSuperAdminRoute><SuperAdminHomePage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/center" element={<ProtectedSuperAdminRoute><SuperAdminCenterPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/customer-service" element={<ProtectedSuperAdminRoute><SuperAdminCustomerServicePage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/explore" element={<ProtectedSuperAdminRoute><SuperAdminExplorePage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/community" element={<ProtectedSuperAdminRoute><SuperAdminCommunityViewPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/my" element={<ProtectedSuperAdminRoute><SuperAdminMyPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/my/profile" element={<ProtectedSuperAdminRoute><MyProfilePage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/settings" element={<ProtectedSuperAdminRoute><SettingsPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/academy/:id" element={<ProtectedSuperAdminRoute><AcademyDetailPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/seminar/:id" element={<ProtectedSuperAdminRoute><SeminarDetailPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/verification-review" element={<ProtectedSuperAdminRoute><VerificationReviewPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/users" element={<ProtectedSuperAdminRoute><SuperAdminUsersPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/posts/create" element={<ProtectedSuperAdminRoute><SuperAdminCommunityPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/seminars/manage" element={<ProtectedSuperAdminRoute><SuperAdminSeminarPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/seminars/:seminarId/applicants" element={<ProtectedSuperAdminRoute><SeminarApplicantsPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/academies" element={<ProtectedSuperAdminRoute><SuperAdminAcademiesPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/academies/create" element={<ProtectedSuperAdminRoute><SuperAdminAcademyCreatePage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/academies/:id/edit" element={<ProtectedSuperAdminRoute><SuperAdminAcademyEditPage /></ProtectedSuperAdminRoute>} />
              <Route path="/super/posts" element={<ProtectedSuperAdminRoute><SuperAdminPostsPage /></ProtectedSuperAdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </ReleaseNoticeGate>
          </BrowserRouter>
        </RegionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
