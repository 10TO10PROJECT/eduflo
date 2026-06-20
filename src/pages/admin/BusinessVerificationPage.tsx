import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessVerification } from "@/hooks/useBusinessVerification";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorLogger";
import Logo from "@/components/Logo";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FileCheck, 
  Upload, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Building2,
  FileText
} from "lucide-react";
import { 
  formatBusinessNumber, 
  validateBusinessNumber, 
  handleBusinessNumberInput 
} from "@/lib/businessNumber";

const BusinessVerificationPage = () => {
  const navigate = useNavigate();
  const { verification, loading, isVerified, isPending, isRejected, submitVerification } = useBusinessVerification();
  
  const [businessName, setBusinessName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [businessNumberError, setBusinessNumberError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleBusinessNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleBusinessNumberInput(e.target.value, (formatted) => {
      setBusinessNumber(formatted);
      // 10자리가 되었을 때만 검증
      if (formatted.replace(/[^0-9]/g, '').length === 10) {
        const validation = validateBusinessNumber(formatted);
        setBusinessNumberError(validation.isValid ? null : validation.error || null);
      } else {
        setBusinessNumberError(null);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("파일 크기는 10MB 이하여야 합니다");
        return;
      }
      setDocumentFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessName.trim()) {
      toast.error("상호명을 입력해주세요");
      return;
    }
    if (!businessNumber.trim()) {
      toast.error("사업자등록번호를 입력해주세요");
      return;
    }

    // 사업자등록번호 유효성 검증
    const validation = validateBusinessNumber(businessNumber);
    if (!validation.isValid) {
      toast.error(validation.error || "유효하지 않은 사업자등록번호입니다");
      return;
    }

    if (!documentFile) {
      toast.error("사업자등록증 파일을 업로드해주세요");
      return;
    }

    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("로그인이 필요합니다");
        return;
      }

      // Upload document
      const fileExt = documentFile.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(fileName, documentFile);

      if (uploadError) {
        logError('BusinessVerificationPage Upload', uploadError);
        toast.error("파일 업로드에 실패했습니다");
        return;
      }

      // Store file path instead of public URL for security
      // Signed URLs will be generated on-demand when viewing documents
      const result = await submitVerification(
        fileName,
        businessName.trim(),
        businessNumber.trim()
      );

      if (result.success) {
        toast.success("인증 요청이 제출되었습니다");
      } else {
        toast.error(result.error || "인증 요청에 실패했습니다");
      }
    } catch (error) {
      logError('BusinessVerificationPage Submit', error);
      toast.error("오류가 발생했습니다");
    } finally {
      setUploading(false);
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        {verification && (
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {isPending && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-warning" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">심사 대기 중</h3>
                      <p className="text-sm text-muted-foreground">
                        제출하신 서류를 검토 중입니다. 영업일 기준 1-2일 내 처리됩니다.
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-warning/10 text-warning">
                      대기중
                    </Badge>
                  </>
                )}
                {isVerified && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">인증 완료</h3>
                      <p className="text-sm text-muted-foreground">
                        사업자 인증이 완료되었습니다. 이제 학원 프로필을 등록할 수 있습니다.
                      </p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground">
                      승인됨
                    </Badge>
                  </>
                )}
                {isRejected && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">인증 거절</h3>
                      <p className="text-sm text-muted-foreground">
                        {verification.rejection_reason || "서류 검토 결과 인증이 거절되었습니다. 다시 제출해주세요."}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      거절됨
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Info */}
        {verification && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                제출 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground text-sm">상호명</Label>
                <p className="font-medium">{verification.business_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">사업자등록번호</Label>
                <p className="font-medium">{verification.business_number}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">제출일</Label>
                <p className="font-medium">
                  {new Date(verification.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons for Verified Users */}
        {isVerified && (
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate('/academy/setup')}
          >
            <Building2 className="w-5 h-5 mr-2" />
            학원 프로필 등록하기
          </Button>
        )}

        {/* Submission Form (only show if no verification or rejected) */}
        {(!verification || isRejected) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                {isRejected ? "인증 재신청" : "사업자 인증 신청"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">상호명 *</Label>
                  <Input
                    id="businessName"
                    placeholder="예: 10to10 수학학원"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessNumber">사업자등록번호 *</Label>
                  <Input
                    id="businessNumber"
                    placeholder="예: 123-45-67890"
                    value={businessNumber}
                    onChange={handleBusinessNumberChange}
                    maxLength={12}
                    className={businessNumberError ? "border-destructive" : ""}
                  />
                  {businessNumberError && (
                    <p className="text-xs text-destructive">{businessNumberError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>사업자등록증 *</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                      id="document-upload"
                    />
                    <label 
                      htmlFor="document-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {documentFile ? (
                        <>
                          <FileText className="w-10 h-10 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {documentFile.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            클릭하여 다른 파일 선택
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            PDF, JPG, PNG 파일 (최대 10MB)
                          </span>
                          <span className="text-xs text-primary font-medium">
                            클릭하여 업로드
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground text-sm mb-2">안내사항</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 사업자등록증 사본을 업로드해주세요</li>
                    <li>• 영업일 기준 1-2일 내 심사가 완료됩니다</li>
                    <li>• 인증 완료 후 학원 프로필 등록이 가능합니다</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                      제출 중...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 mr-2" />
                      인증 신청하기
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default BusinessVerificationPage;
