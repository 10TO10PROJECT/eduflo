# BETA — 설명회 참석 인증 & 디지털 쿠폰

> **버전:** BETA v0.2  
> **스택:** React + Supabase  
> **대상:** 학부모(P) · 학원 Admin(A)  
> **명세 기준:** BETA 화면명세서 — 설명회 참석 인증 & 디지털 쿠폰 (UX Lv.1)

---

## 1. 개요

설명회 현장에서 학부모가 QR 스캔 → 휴대폰 인증 → 디지털 쿠폰 자동 발급까지 한 번에 처리하고, 학원은 쿠폰 사용·사후 리포트까지 모바일에서 관리하는 BETA 기능입니다.

| 역할 | 화면 수 | 진입 |
|------|---------|------|
| 학부모 | P-01 ~ P-07 (7개) | `/p/check-in`, 마이페이지「쿠폰함」 |
| 학원 Admin | A-01 ~ A-05 (5개) | Admin 홈「설명회 · 쿠폰」→ `/admin/sessions` |

기존 `/admin/seminars`(레거시 설명회 관리)와 **별도 플로우**입니다. BETA는 1세션 1혜택·디지털 쿠폰 중심으로 단순화되어 있습니다.

---

## 2. UX 원칙 (5대)

1. **화면당 액션 1개** — 부 액션은 하단 텍스트 링크
2. **분기 숨김** — 회원/비회원 UI 없음, 휴대폰 번호가 식별자
3. **진입 = 즉시 작업** — 랜딩·안내 화면 없음
4. **모바일 단일** — PC 전용 UI 없음 (BETA 한정)
5. **텍스트 최소** — 동사 중심, 설명 1줄 이내

---

## 3. 전체 플로우

```
[학원] A-02 세션 생성 → A-03 QR 노출
         ↓
[학부모] P-01 QR 스캔 → P-02 인증 → P-03 쿠폰 발급 → P-04 쿠폰함
         ↓
[학부모] P-05 상세 → P-06 6자리 코드 (5분 TTL)
         ↓
[학원]   A-04 코드 입력·사용 처리
         ↓
[학부모] P-07 사용 완료 (Realtime 또는 폴링)
         ↓
[학원]   A-05 사후 리포트 · CSV · 등록 전환 추적
```

**QR URL 형식**

```
{origin}/p/check-in/{seminarId}/verify
```

세션 코드 직접 입력 시 `SEM-YYYYMMDD-XXXX` 형식(`seminars.check_in_code`)도 지원합니다.

---

## 4. 학부모 화면 (P-01 ~ P-07)

### P-01 · QR 스캐너

| 항목 | 내용 |
|------|------|
| 경로 | `/p/check-in` |
| 파일 | `src/pages/parent/ParentQrScannerPage.tsx` |
| 핵심 동작 | 카메라 QR 자동 인식 → 세션 검증 → P-02 이동 |
| 폴백 | 카메라 거부·미지원 브라우저 →「세션 코드 직접 입력」시트 |
| 라이브러리 | `src/lib/parentCheckIn.ts` |

- `BarcodeDetector` API로 QR 인식 (Safari 등 미지원 시 수동 입력)
- UUID, URL, `check_in_code` 모두 `resolveSessionFromInput`으로 세션 ID 해석

---

### P-02 · 본인 확인 (휴대폰 + OTP)

| 항목 | 내용 |
|------|------|
| 경로 | `/p/check-in/:sessionId/verify` |
| 파일 | `src/pages/parent/ParentCheckInVerifyPage.tsx` |
| 인증 | Firebase Phone Auth → `sendIdTokenToBackend` → Supabase `verifyOtp` |
| 자동 가입 | 신규 번호 → `학부모{뒷4자리}` 이름으로 자동 가입 |
| 예외 | OTP 3회 오류 → 1분 잠금 / 이미 발급된 세션 → P-04(쿠폰함) |

> **주의:** Firebase 허용 도메인에 배포 URL이 등록되어 있어야 하며, **localhost에서는 휴대폰 OTP 불가**.

---

### P-03 · 인증 완료 = 쿠폰 발급

| 항목 | 내용 |
|------|------|
| 경로 | `/p/check-in/:sessionId/complete` |
| 파일 | `src/pages/parent/ParentCheckInCompletePage.tsx` |
| RPC | `issue_seminar_coupon(_seminar_id)` |
| UI | 쿠폰 카드(학원·혜택·할인값·D-day) +「내 쿠폰함으로」 |

1 학부모 · 1 설명회 · 1 쿠폰 (`UNIQUE (user_id, seminar_id)`).

---

### P-04 · 쿠폰함

| 항목 | 내용 |
|------|------|
| 경로 | `/p/coupons` |
| 파일 | `src/pages/parent/ParentCouponsPage.tsx` |
| UI | 탭「사용 가능 \| 만료」/ 카드 리스트 / 빈 상태 → QR 스캔 링크 |
| 진입 | 로그인 필수, 마이페이지「쿠폰함」메뉴 |

---

### P-05 · 쿠폰 상세

| 항목 | 내용 |
|------|------|
| 경로 | `/p/coupons/:couponId` |
| 파일 | `src/pages/parent/ParentCouponDetailPage.tsx` |
| UI | 혜택 카드, 사용 조건, 유효기간, 학원 전화(`tel:`) |
| 액션 |「사용하기」→ P-06 (만료·사용 완료 시 비활성) |

---

### P-06 · 사용 코드 (6자리 + 타이머)

| 항목 | 내용 |
|------|------|
| 경로 | `/p/coupons/:couponId/use` |
| 파일 | `src/pages/parent/ParentCouponUseCodePage.tsx` |
| RPC | `issue_coupon_use_code(_coupon_id, _force_new)` |
| UI | 6자리 영숫자 코드, 5:00 카운트다운, 화면 밝기 유지(`wakeLock`) |
| 만료 |「새로 발급」텍스트 링크로 재발급 |
| P-07 전환 | Supabase Realtime `digital_coupons` UPDATE 구독 + 10초 폴링 폴백 |

동일 학부모가 다른 쿠폰 코드를 새로 발급하면 기존 활성 코드는 서버에서 즉시 무효화됩니다.

---

### P-07 · 사용 완료

| 항목 | 내용 |
|------|------|
| 경로 | `/p/coupons/:couponId/complete` |
| 파일 | `src/pages/parent/ParentCouponUsedPage.tsx` |
| UI | 사용 완료 애니메이션, 학원명·사용 시각 |
| 액션 |「쿠폰함으로」→ P-04 |

---

## 5. 학원 Admin 화면 (A-01 ~ A-05)

### A-01 · 설명회 목록

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions` |
| 파일 | `src/pages/academy/AcademySessionListPage.tsx` |
| UI | 탭「진행 중 \| 예정 \| 완료」, 카드(일시·제목·발급/사용 수), FAB(+) |
| 진입 | Admin 홈 →「설명회 · 쿠폰」 |

---

### A-02 · 세션 생성

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions/create` |
| 파일 | `src/pages/academy/AcademySessionCreatePage.tsx` |
| 입력 | 세션 정보(제목·일시·장소·인원) + 혜택(유형·할인값·유효기간 7~90일) + 사용 조건 |
| 생성 | `seminars` + `coupon_*` 컬럼, `check_in_code` 자동 생성 |
| 완료 | A-03(QR 화면)으로 이동 |

혜택 유형 칩: 첫달할인 / 레테권 / 교재 / 상담권 / 직접입력

---

### A-03 · 세션 상세 (QR · 카운트)

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions/:sessionId` |
| 파일 | `src/pages/academy/AcademySessionDetailPage.tsx` |
| UI | QR 코드, 세션 코드, 발급/사용/만료 카운트, 혜택 요약 |
| 액션 |「쿠폰 사용 처리」→ A-04 /「리포트 보기」→ A-05 |
| ⋯ 메뉴 | 수정하기 → `/edit` / 리포트 보기 / 삭제하기(확인 다이얼로그) |

---

### A-03-Edit · 세션 수정

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions/:sessionId/edit` |
| 파일 | `src/pages/academy/AcademySessionEditPage.tsx` |
| 동작 | A-02와 동일 폼, 기존 값 로드 후 `updateAcademySession` |

---

### A-04 · 쿠폰 사용 처리

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions/:sessionId/redeem` |
| 파일 | `src/pages/academy/AcademySessionRedeemPage.tsx` |
| RPC | `preview_coupon_use_code`, `redeem_coupon_use_code` |
| UI | 6칸 OTP 입력 → 자동 미리보기(마스킹 이름·혜택·유효기간) →「사용 처리」 |
| 완료 | 토스트 +「다음 학부모 처리」 |

오류(잘못된 코드·만료·이미 사용) 시 인라인 메시지 + 코드 자동 클리어.

---

### A-05 · 사후 리포트

| 항목 | 내용 |
|------|------|
| 경로 | `/admin/sessions/:sessionId/report` |
| 파일 | `src/pages/academy/AcademySessionReportPage.tsx` |
| RPC | `get_seminar_coupon_report`, `mark_coupon_enrolled` |
| UI | 요약(발급/사용/만료/등록 전환률), 학부모 목록, 행별「등록 처리」 |
| 액션 |「CSV 다운로드」(UTF-8 BOM) |

**등록 전환률** = `등록 수 ÷ 발급 수 × 100`  
`digital_coupons.enrolled_at`이 등록 시각입니다.

---

## 6. 공통 라이브러리

| 파일 | 역할 |
|------|------|
| `src/lib/parentCheckIn.ts` | 세션 ID 파싱, `check_in_code` 조회, 세션 유효성 검증 |
| `src/lib/digitalCoupon.ts` | 쿠폰 CRUD, 사용 코드 발급, D-day·카운트다운 포맷 |
| `src/lib/academySession.ts` | 학원 ID 조회, 세션 CRUD, QR URL, 리포트·redeem RPC |
| `src/types/digitalCoupon.ts` | 쿠폰 타입 |
| `src/types/couponUseCode.ts` | 사용 코드 타입 |

---

## 7. 데이터베이스 & RPC

### 마이그레이션 (적용 순서)

| 파일 | 내용 |
|------|------|
| `20260605100000_digital_coupons.sql` | `digital_coupons` 테이블, `seminars.coupon_*`, `issue_seminar_coupon` |
| `20260605110000_coupon_use_codes.sql` | `coupon_use_codes`(6자리, TTL 5분), `issue/redeem_coupon_use_code` |
| `20260605120000_seminar_check_in_code.sql` | `seminars.check_in_code` |
| `20260605130000_coupon_preview_redeem.sql` | `preview_coupon_use_code`, 멤버 권한, `mask_parent_name` |
| `20260605140000_seminar_coupon_report.sql` | `enrolled_at`, 리포트·등록 처리 RPC |
| `20260605150000_coupon_member_rls_realtime.sql` | 멤버 RLS SELECT, Realtime publication |

적용:

```bash
supabase db push
```

### 주요 RPC

| RPC | 용도 |
|-----|------|
| `issue_seminar_coupon(_seminar_id)` | P-03 쿠폰 발급 |
| `issue_coupon_use_code(_coupon_id, _force_new)` | P-06 사용 코드 발급 |
| `preview_coupon_use_code(_code, _seminar_id)` | A-04 코드 미리보기 |
| `redeem_coupon_use_code(_code, _seminar_id)` | A-04 사용 처리 |
| `get_seminar_coupon_report(_seminar_id)` | A-05 리포트 조회 |
| `mark_coupon_enrolled(_coupon_id, _seminar_id)` | A-05 등록 처리 |

### 권한

- `can_admin_manage_academy_coupons`: 학원 owner + `approved` academy_members
- 쿠pon 조회 RLS: 본인 쿠폰 / 학원 owner / 승인 멤버(해당 학원 세미나)

---

## 8. 라우트 요약

### 학부모

```
/p/check-in
/p/check-in/:sessionId/verify
/p/check-in/:sessionId/complete
/p/coupons
/p/coupons/:couponId
/p/coupons/:couponId/use
/p/coupons/:couponId/complete
```

### 학원 Admin (`ProtectedAdminRoute`)

```
/admin/sessions
/admin/sessions/create
/admin/sessions/:sessionId
/admin/sessions/:sessionId/edit
/admin/sessions/:sessionId/redeem
/admin/sessions/:sessionId/report
```

---

## 9. E2E 테스트 시나리오

### 시나리오 A — 설명회 당일 참석

1. 학원: A-02로 세션 생성 → A-03 QR 확인
2. 학부모: P-01 QR 스캔 → P-02 OTP 인증 → P-03 쿠폰 확인
3. 학부모: P-04 쿠폰함에서 발급 쿠폰 확인

### 시나리오 B — 쿠폰 사용

1. 학부모: P-05「사용하기」→ P-06 6자리 코드 확인
2. 학원: A-04 코드 입력 → 미리보기 확인 →「사용 처리」
3. 학부모: P-07 사용 완료 화면 자동 전환 확인

### 시나리오 C — 사후 리포트

1. 학원: A-05 리포트 확인
2. 미등록 학부모「등록 처리」→ 전환률 갱신 확인
3. CSV 다운로드 후 컬럼(이름·뒷4자리·발급일·사용·등록) 확인

---

## 10. 제약 & 알려진 사항

| 항목 | 설명 |
|------|------|
| localhost OTP | Firebase Phone Auth 미동작 → 배포 URL에서 테스트 |
| P-01 Safari | `BarcodeDetector` 미지원 → 세션 코드 직접 입력 |
| P-06 → P-07 | Realtime 주 경로, 10초 폴링 폴백 |
| 레거시 설명회 | `/admin/seminars`는 BETA와 별도 (신청·알림톡 등 기존 기능) |
| 운영자(O) 도구 | BETA 범위 외 — Supabase 콘솔로 CS 대응 |

---

## 11. 화면 ID 인덱스

| ID | 화면명 | 경로 |
|----|--------|------|
| P-01 | QR 스캐너 | `/p/check-in` |
| P-02 | 본인 확인 | `/p/check-in/:sessionId/verify` |
| P-03 | 쿠폰 발급 완료 | `/p/check-in/:sessionId/complete` |
| P-04 | 쿠폰함 | `/p/coupons` |
| P-05 | 쿠폰 상세 | `/p/coupons/:couponId` |
| P-06 | 사용 코드 | `/p/coupons/:couponId/use` |
| P-07 | 사용 완료 | `/p/coupons/:couponId/complete` |
| A-01 | 설명회 목록 | `/admin/sessions` |
| A-02 | 세션 생성 | `/admin/sessions/create` |
| A-03 | 세션 상세 | `/admin/sessions/:sessionId` |
| A-04 | 쿠폰 사용 처리 | `/admin/sessions/:sessionId/redeem` |
| A-05 | 사후 리포트 | `/admin/sessions/:sessionId/report` |
