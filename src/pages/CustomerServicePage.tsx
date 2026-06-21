import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ArrowLeft, 
  HelpCircle, 
  MessageCircle, 
  Mail,
  Phone,
  Send
} from "lucide-react";
import { toast } from "sonner";

const faqData = [
  {
    id: "1",
    question: "학원 검색은 어떻게 하나요?",
    answer: "하단의 '탐색' 탭을 누르시면 지역별, 과목별로 학원을 검색하실 수 있습니다. 상단의 지역 선택 버튼을 통해 원하는 지역을 먼저 선택해주세요."
  },
  {
    id: "2",
    question: "상담 신청은 어떻게 하나요?",
    answer: "관심 있는 학원의 상세 페이지에서 '상담 신청' 버튼을 누르시면 됩니다. 학생 정보와 문의 내용을 입력하시면 학원에서 연락을 드립니다."
  },
  {
    id: "3",
    question: "찜한 학원은 어디서 확인하나요?",
    answer: "마이페이지의 '찜' 탭에서 찜한 학원 목록을 확인하실 수 있습니다."
  },
  {
    id: "4",
    question: "설명회 신청 후 취소가 가능한가요?",
    answer: "설명회 신청 취소는 해당 학원에 직접 문의해주셔야 합니다. 학원 상세 페이지에서 채팅 상담을 통해 취소 요청을 하실 수 있습니다."
  },
  {
    id: "5",
    question: "알림이 오지 않아요.",
    answer: "설정 > 알림 설정에서 푸시 알림이 활성화되어 있는지 확인해주세요. 또한 휴대폰 설정에서 10to10 앱의 알림 권한이 허용되어 있어야 합니다."
  }
];

const CustomerServicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [sending, setSending] = useState(false);

  // Determine which navigation to show based on current path
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isStudentRoute = location.pathname.startsWith("/s/");

  const handleSubmitInquiry = async () => {
    if (!inquirySubject.trim() || !inquiryContent.trim()) {
      toast.error("제목과 내용을 모두 입력해주세요");
      return;
    }

    setSending(true);
    // 실제로는 Supabase 또는 이메일 API로 문의 전송
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSending(false);
    
    toast.success("문의가 접수되었습니다. 빠른 시일 내 답변 드리겠습니다.");
    setInquirySubject("");
    setInquiryContent("");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">고객센터</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Contact Info */}
        <Card className="shadow-card bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">10to10 고객센터</h3>
                <p className="text-xs text-muted-foreground">평일 09:00 - 18:00</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>edumap365@gmail.com</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>010-8980-0282</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              자주 묻는 질문
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqData.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-sm text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Inquiry Form */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              1:1 문의하기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm">제목</Label>
              <Input
                id="subject"
                placeholder="문의 제목을 입력해주세요"
                value={inquirySubject}
                onChange={(e) => setInquirySubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm">내용</Label>
              <Textarea
                id="content"
                placeholder="문의 내용을 상세히 작성해주세요"
                rows={5}
                value={inquiryContent}
                onChange={(e) => setInquiryContent(e.target.value)}
              />
            </div>
            <Button 
              className="w-full gap-2"
              onClick={handleSubmitInquiry}
              disabled={sending}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  문의 보내기
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>

      {isAdminRoute ? (
        <AdminBottomNavigation />
      ) : isStudentRoute ? (
        <StudentBottomNavigation />
      ) : (
        <BottomNavigation />
      )}
    </div>
  );
};

export default CustomerServicePage;
