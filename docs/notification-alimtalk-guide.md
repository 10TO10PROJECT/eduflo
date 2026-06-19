# 10to10 알림톡(문자콕) 시스템 전체 명세서

> **최종 업데이트:** 2026-03-03
> **운영 도메인:** `https://eduflo.co.kr`
> **알림 채널:** 카카오 알림톡 (문자콕 중계)
> **SMS Fallback:** `fall_back_yn: true` (알림톡 실패 시 자동 문자 전환)

---

## 목차

1. [시스템 구조 개요](#1-시스템-구조-개요)
2. [환경변수 설정](#2-환경변수-설정)
3. [DB 스키마 (notification_logs)](#3-db-스키마)
4. [발송 정책 (Rate Limiting)](#4-발송-정책)
5. [10개 템플릿 전체 명세](#5-10개-템플릿-전체-명세)
6. [Edge Function 상세 분기 로직](#6-edge-function-상세-분기-로직)
7. [프론트엔드 연동 지점](#7-프론트엔드-연동-지점)
8. [재시도(Retry) 로직](#8-재시도-로직)
9. [카카오 템플릿 등록 가이드](#9-카카오-템플릿-등록-가이드)
10. [테스트 체크리스트](#10-테스트-체크리스트)

---

## 1. 시스템 구조 개요

```
┌──────────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (React)                            │
│                                                                      │
│  useChatMessages.ts ──→ fire-and-forget ──→ notify-chat-message     │
│  SeminarDetailPage  ──→ fire-and-forget ──→ notify-seminar-event    │
│  SeminarManagement  ──→ fire-and-forget ──→ notify-seminar-event    │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                            │
│                                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐                │
│  │ notify-chat-message │  │ notify-seminar-event   │                │
│  │ (JWT 인증)          │  │ (JWT 인증)             │                │
│  └────────┬────────────┘  └───────────┬────────────┘                │
│           │                           │                              │
│           ▼                           ▼                              │
│  ┌──────────────────────────────────────────────────┐               │
│  │           _shared/notification.ts                 │               │
│  │                                                   │               │
│  │  1. Rate Limit 확인 (DB 기반)                    │               │
│  │  2. buildMessage() - #{변수N} 치환               │               │
│  │  3. callMunjaKokApi() - 실제 API 호출            │               │
│  │  4. notification_logs 기록                        │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                      │
│  ┌─────────────────────────┐  ┌──────────────────────┐              │
│  │ send-seminar-reminders  │  │ retry-notification   │              │
│  │ (pg_cron, SERVICE_KEY)  │  │ (pg_cron, SERVICE_KEY)│              │
│  └─────────────────────────┘  └──────────────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      문자콕 API (중계사)                              │
│                                                                      │
│  POST {MUNJAKOK_API_URL}                                            │
│  ├── message_type: "AT" (알림톡)                                    │
│  ├── sender_key: 카카오 발신프로필 키                                │
│  ├── template_code: 검수 승인된 코드                                 │
│  ├── phone_number: 수신자 번호                                       │
│  ├── sender_no: SMS 발신번호                                         │
│  ├── message: 치환 완료된 전체 본문                                   │
│  ├── fall_back_yn: true                                              │
│  ├── fall_back_message: SMS 대체 내용                                │
│  └── buttons: [{type,name,url_mobile,url_pc}]                       │
│                                                                      │
│                       ▼                                              │
│               카카오 알림톡 발송 → 실패 시 SMS Fallback               │
└──────────────────────────────────────────────────────────────────────┘
```

### 파일 구조

```
supabase/
├── migrations/
│   └── 20260303120000_notification_system.sql     # notification_logs 테이블
├── functions/
│   ├── _shared/
│   │   └── notification.ts                        # 핵심 공유 모듈
│   ├── notify-chat-message/
│   │   └── index.ts                               # 채팅 알림
│   ├── notify-seminar-event/
│   │   └── index.ts                               # 설명회 신청/등록 알림
│   ├── send-seminar-reminders/
│   │   └── index.ts                               # 전일 리마인드 (크론)
│   └── retry-notification/
│       └── index.ts                               # 실패 재시도 (크론)

src/
├── hooks/
│   └── useChatMessages.ts                         # 채팅 → 알림 호출 (line 258)
├── pages/
│   ├── SeminarDetailPage.tsx                      # 신청 → 알림 호출 (line 239)
│   └── admin/
│       └── SeminarManagementPage.tsx              # 등록 → 알림 호출 (line 299)
```

---

## 2. 환경변수 설정

```bash
# 필수: 문자콕 API 연동
MUNJAKOK_API_KEY=<API 인증키>
MUNJAKOK_API_URL=<API 엔드포인트 URL>
MUNJAKOK_SENDER_KEY=<카카오 발신프로필 sender_key>
MUNJAKOK_SENDER_NO=<SMS 발신번호 예: 0212345678>

# 선택: 테스트 모드
MUNJAKOK_DRY_RUN=true    # true이면 API 호출 없이 로그만 기록
```

> **`MUNJAKOK_API_KEY` / `MUNJAKOK_API_URL`**: 문자콕 고객센터에서 발급받아야 합니다. 아직 미확보 상태라면 `MUNJAKOK_DRY_RUN=true`로 설정하여 API 호출 없이 로그만 기록하세요.

> **template_code**는 코드에 하드코딩되어 있음 (아래 10개 템플릿 참조).
> 카카오 검수 후 실제 코드가 다르면 `_shared/notification.ts`의 `TEMPLATES` 객체에서 `code` 값 수정.

---

## 3. DB 스키마

### notification_logs 테이블

```sql
CREATE TABLE public.notification_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code     text NOT NULL,           -- 'TPL_CHAT_TO_PARENT_V1' 등
  provider_template_id text,                 -- 문자콕에 전달한 template_code
  recipient_phone   text NOT NULL,           -- 수신자 전화번호 (01012345678)
  recipient_user_id uuid,                    -- 수신자 Supabase user id
  receiver_type     text NOT NULL,           -- 'user' | 'academy'
  variables         jsonb NOT NULL DEFAULT '{}',  -- 치환 변수 원본 (재시도용)
  button_urls       jsonb DEFAULT '[]',      -- [{name,url}] 버튼 정보
  chat_room_id      uuid,                    -- FK → chat_rooms (nullable)
  seminar_id        uuid,                    -- FK → seminars (nullable)
  academy_id        uuid,                    -- FK → academies (nullable)
  status            text NOT NULL DEFAULT 'pending',
  api_response      jsonb,                   -- 문자콕 API 응답 원본
  error_message     text,                    -- 에러 메시지
  provider_result_code text,                 -- 문자콕 result_code
  rate_limit_key    text,                    -- Rate limit 판별 키
  retry_count       int NOT NULL DEFAULT 0,  -- 재시도 횟수 (최대 2)
  sent_at           timestamptz NOT NULL DEFAULT now()
);
```

### status 값

| status | 의미 |
|--------|------|
| `pending` | 발송 대기 (현재 미사용, 향후 큐잉용) |
| `sent` | 발송 성공 (DRY_RUN 포함) |
| `failed` | 발송 실패 (재시도 대상) |
| `skipped` | Rate limit 초과로 발송 건너뜀 |

### 인덱스

```sql
idx_notif_logs_sent       -- (sent_at DESC) : 최근 발송 조회
idx_notif_logs_template   -- (template_code, sent_at DESC) : 템플릿별 조회
idx_notif_logs_recipient  -- (recipient_user_id, sent_at DESC) : 유저별 조회
idx_notif_logs_rate_limit -- (rate_limit_key, sent_at DESC) WHERE status IN ('sent','pending')
idx_notif_logs_status     -- (status) WHERE status = 'failed' : 재시도 후보 조회
```

---

## 4. 발송 정책

### Rate Limiting (DB 기반)

| 정책 | rate_limit_key 패턴 | 윈도우 | 최대 횟수 |
|------|---------------------|--------|-----------|
| 채팅방 쿨다운 | `chat:{chatRoomId}` | 1분 | 1회 |
| 유저 일일 수신 제한 | `daily:user:{userId}:{yyyyMMdd}` | 24시간 | 20회 |
| 학원 일일 발송 제한 | `daily:academy:{academyId}:{yyyyMMdd}` | 24시간 | 50회 |

**판별 로직:**
```
status IN ('sent', 'pending') AND rate_limit_key = ? AND sent_at >= (now - window)
→ count >= maxCount → status='skipped' 로그 기록, 발송 안 함
```

### 재시도 정책

| 조건 | 설명 |
|------|------|
| 대상 | `status='failed' AND retry_count < 2` |
| 1차 재시도 | 실패 후 **1분** 경과 시 |
| 2차 재시도 | 실패 후 **5분** 경과 시 |
| 재시도 제외 | `INVALID_PHONE`, `BLOCKED`, `UNSUBSCRIBED`, `OPTED_OUT` |

---

## 5. 10개 템플릿 전체 명세

> **중요:** `message` 필드에는 `#{변수N}`을 실제 값으로 **완전히 치환한 문자열**을 넣어야 합니다.
> 카카오에 등록된 템플릿 서식과 **1글자도 다르면 발송 실패**됩니다.

---

### TPL-001. 채팅 도착 — 학원 수신

**코드:** `TPL_CHAT_TO_ACADEMY_V1`
**수신자:** 학원 담당자 (staff_user_id 또는 owner_id)
**트리거:** 학부모/학생이 채팅 메시지 전송 시

#### 카카오에 등록할 템플릿 본문

```
안녕하세요, #{변수1} 담당자님.

10to10에서 #{변수2}님이 새 메시지를 보냈습니다.

- 문의주제: #{변수3}
- 도착시간: #{변수4}

아래 버튼을 눌러 바로 확인해 주세요.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수2}` | senderName | 발신자 이름 (profiles.user_name) | 김학부모 |
| `#{변수3}` | inquiryTopic | 메시지 첫 20자 + ... | 수학반 문의드립니다... |
| `#{변수4}` | receivedAt | 수신 시각 (YYYY-MM-DD HH:mm) | 2026-03-03 14:30 |

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 채팅 확인하기 | `https://eduflo.co.kr/admin/chats/{chatRoomId}` |

#### 치환 완료 예시 (API에 보내는 message)

```
안녕하세요, 에듀플로학원 담당자님.

10to10에서 김학부모님이 새 메시지를 보냈습니다.

- 문의주제: 수학반 문의드립니다...
- 도착시간: 2026-03-03 14:30

아래 버튼을 눌러 바로 확인해 주세요.
```

---

### TPL-002. 채팅 도착 — 학부모 수신

**코드:** `TPL_CHAT_TO_PARENT_V1`
**수신자:** 학부모
**트리거:** 학원 담당자가 채팅 메시지 전송 시 (수신자가 학부모인 경우)

#### 카카오에 등록할 템플릿 본문

```
#{변수1}에서 답장이 도착했어요

지금 확인하고 이어서 상담해 보세요.

- 도착시간: #{변수2}

아래 버튼을 누르면 바로 채팅으로 이동합니다.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수2}` | receivedAt | 수신 시각 | 2026-03-03 14:35 |

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 채팅 확인하기 | `https://eduflo.co.kr/p/chats/{chatRoomId}` |

#### 치환 완료 예시

```
에듀플로학원에서 답장이 도착했어요

지금 확인하고 이어서 상담해 보세요.

- 도착시간: 2026-03-03 14:35

아래 버튼을 누르면 바로 채팅으로 이동합니다.
```

---

### TPL-003. 채팅 도착 — 학생 수신

**코드:** `TPL_CHAT_TO_STUDENT_V1`
**수신자:** 학생
**트리거:** 학원 담당자가 채팅 메시지 전송 시 (수신자가 학생인 경우)

#### 카카오에 등록할 템플릿 본문

```
#{변수1}에서 답장이 도착했어요

지금 확인하고 이어서 상담해 보세요.

- 도착시간: #{변수2}

아래 버튼을 누르면 바로 채팅으로 이동합니다.
```

> 본문/변수는 TPL-002와 **동일**, URL prefix만 `/s`

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수2}` | receivedAt | 수신 시각 | 2026-03-03 14:35 |

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 채팅 확인하기 | `https://eduflo.co.kr/s/chats/{chatRoomId}` |

---

### TPL-004. 설명회 신청 완료 — 학부모 수신

**코드:** `TPL_SEMINAR_APPLY_DONE_PARENT_V1`
**수신자:** 설명회 신청한 학부모
**트리거:** 설명회 신청 성공 시

#### 카카오에 등록할 템플릿 본문

```
설명회 신청이 완료되었습니다

- 설명회: #{변수1}
- 주관: #{변수2}
- 일시: #{변수3}
- 장소: #{변수4}
- 신청자: #{변수5}

변경/취소 및 상세 안내는 아래에서 확인해 주세요.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | seminarTitle | 설명회 제목 | 2026 수학 심화반 설명회 |
| `#{변수2}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수3}` | seminarAt | 설명회 일시 | 2026-03-15 14:00 |
| `#{변수4}` | seminarPlace | 설명회 장소 | 에듀플로 본관 3층 |
| `#{변수5}` | applicantName | 신청자 이름 | 김학부모 |

#### 버튼 (항상 2개 — 카카오 고정 버튼 수)

| 순서 | 타입 | 버튼명 | URL | 비고 |
|------|------|--------|-----|------|
| 1 | WL | 신청내역 확인 | `https://eduflo.co.kr/p/seminar/{seminarId}` | 항상 포함 |
| 2 | WL | 길찾기 | 장소 있음: `https://map.naver.com/v5/search/{장소명}`<br/>장소 없음: `https://eduflo.co.kr/p/seminar/{seminarId}` (fallback) | **항상 포함** |

> **카카오 템플릿은 버튼 개수가 고정**이므로 항상 2개 버튼으로 등록합니다.
> 장소가 없거나 `"장소 미정"`이면, 길찾기 버튼의 URL은 설명회 상세 페이지로 fallback됩니다.
> (`mapUrlOrFallback()` 함수 참조)

#### 치환 완료 예시

```
설명회 신청이 완료되었습니다

- 설명회: 2026 수학 심화반 설명회
- 주관: 에듀플로학원
- 일시: 2026-03-15 14:00
- 장소: 에듀플로 본관 3층
- 신청자: 김학부모

변경/취소 및 상세 안내는 아래에서 확인해 주세요.
```

---

### TPL-005. 설명회 신청 완료 — 학생 수신

**코드:** `TPL_SEMINAR_APPLY_DONE_STUDENT_V1`
**수신자:** 설명회 신청한 학생
**트리거:** 설명회 신청 성공 시 (신청자가 학생인 경우)

> 본문/변수는 TPL-004와 **동일**, URL prefix만 `/s`

#### 버튼 (항상 2개)

| 순서 | 타입 | 버튼명 | URL | 비고 |
|------|------|--------|-----|------|
| 1 | WL | 신청내역 확인 | `https://eduflo.co.kr/s/seminar/{seminarId}` | 항상 포함 |
| 2 | WL | 길찾기 | 장소 있음: 네이버 지도 / 장소 없음: 상세 페이지 fallback | **항상 포함** |

---

### TPL-006. 설명회 신청 접수 — 학원 수신

**코드:** `TPL_SEMINAR_APPLY_RECEIVED_ACADEMY_V1`
**수신자:** 학원 원장 (academies.owner_id)
**트리거:** 누군가 해당 학원의 설명회에 신청 시

#### 카카오에 등록할 템플릿 본문

```
#{변수1} 담당자님,

#{변수2}에 새로운 신청이 접수되었습니다.

- 신청자: #{변수3}
- 신청일시: #{변수4}

아래 버튼에서 신청자를 확인해 주세요.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수2}` | seminarTitle | 설명회 제목 | 2026 수학 심화반 설명회 |
| `#{변수3}` | applicantName | 신청자 이름 | 김학부모 |
| `#{변수4}` | appliedAt | 신청 일시 | 2026-03-03 14:30 |

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 신청자 관리 | `https://eduflo.co.kr/admin/seminars/{seminarId}/applicants` |

#### 치환 완료 예시

```
에듀플로학원 담당자님,

2026 수학 심화반 설명회에 새로운 신청이 접수되었습니다.

- 신청자: 김학부모
- 신청일시: 2026-03-03 14:30

아래 버튼에서 신청자를 확인해 주세요.
```

---

### TPL-007. 신규 설명회 등록 — 학부모 수신

**코드:** `TPL_NEW_SEMINAR_PUBLISHED_PARENT_V1`
**수신자:** 해당 학원과 채팅방이 있는 학부모 전원 (최대 100명)
**트리거:** 학원 관리자가 새 설명회 등록 시

#### 카카오에 등록할 템플릿 본문

```
새로운 설명회가 등록되었습니다!

- 설명회: #{변수1}
- 학원: #{변수2}
- 일시: #{변수3}
- 대상: #{변수4}

자세한 내용은 아래에서 확인해 주세요.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | seminarTitle | 설명회 제목 | 2026 수학 심화반 설명회 |
| `#{변수2}` | academyName | 학원 이름 | 에듀플로학원 |
| `#{변수3}` | seminarAt | 설명회 일시 | 2026-03-15 14:00 |
| `#{변수4}` | targetGrade | 대상 학년 (없으면 "전체") | 중학생 |

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 상세보기 | `https://eduflo.co.kr/p/seminar/{seminarId}` |
| 2 | WL | 전체 설명회 보기 | `https://eduflo.co.kr/p/explore?tab=seminars` |

#### 치환 완료 예시

```
새로운 설명회가 등록되었습니다!

- 설명회: 2026 수학 심화반 설명회
- 학원: 에듀플로학원
- 일시: 2026-03-15 14:00
- 대상: 중학생

자세한 내용은 아래에서 확인해 주세요.
```

---

### TPL-008. 신규 설명회 등록 — 학생 수신

**코드:** `TPL_NEW_SEMINAR_PUBLISHED_STUDENT_V1`
**수신자:** 해당 학원과 채팅방이 있는 학생 전원
**트리거:** 학원 관리자가 새 설명회 등록 시

> 본문/변수는 TPL-007과 **동일**, URL prefix만 `/s`

#### 버튼

| 순서 | 타입 | 버튼명 | URL |
|------|------|--------|-----|
| 1 | WL | 상세보기 | `https://eduflo.co.kr/s/seminar/{seminarId}` |
| 2 | WL | 전체 설명회 보기 | `https://eduflo.co.kr/s/explore?tab=seminars` |

---

### TPL-009. 전일 리마인드 — 학부모 수신

**코드:** `TPL_SEMINAR_REMINDER_PARENT_V1`
**수신자:** 내일 설명회 신청자 (학부모)
**트리거:** pg_cron 매일 10:00 KST (01:00 UTC)

#### 카카오에 등록할 템플릿 본문

```
신청하신 설명회가 내일이에요!

- 설명회: #{변수1}
- 일시: #{변수2}
- 장소: #{변수3}

아래 버튼에서 상세/안내사항을 확인해 주세요.
```

#### 변수 매핑

| 플레이스홀더 | 변수키 | 설명 | 예시 |
|-------------|--------|------|------|
| `#{변수1}` | seminarTitle | 설명회 제목 | 2026 수학 심화반 설명회 |
| `#{변수2}` | seminarAt | 설명회 일시 | 2026-03-15 14:00 |
| `#{변수3}` | seminarPlace | 설명회 장소 | 에듀플로 본관 3층 |

#### 버튼 (항상 2개 — 카카오 고정 버튼 수)

| 순서 | 타입 | 버튼명 | URL | 비고 |
|------|------|--------|-----|------|
| 1 | WL | 상세 확인하기 | `https://eduflo.co.kr/p/seminar/{seminarId}` | 항상 포함 |
| 2 | WL | 길찾기 | 장소 있음: `https://map.naver.com/v5/search/{장소명}`<br/>장소 없음: `https://eduflo.co.kr/p/seminar/{seminarId}` (fallback) | **항상 포함** |

> 길찾기 버튼은 TPL-004와 동일하게 `mapUrlOrFallback()` 적용. 장소 없으면 상세 페이지로 fallback.

#### 치환 완료 예시

```
신청하신 설명회가 내일이에요!

- 설명회: 2026 수학 심화반 설명회
- 일시: 2026-03-15 14:00
- 장소: 에듀플로 본관 3층

아래 버튼에서 상세/안내사항을 확인해 주세요.
```

---

### TPL-010. 전일 리마인드 — 학생 수신

**코드:** `TPL_SEMINAR_REMINDER_STUDENT_V1`
**수신자:** 내일 설명회 신청자 (학생)
**트리거:** pg_cron 매일 10:00 KST (01:00 UTC)

> 본문/변수는 TPL-009와 **동일**, URL prefix만 `/s`

#### 버튼 (항상 2개)

| 순서 | 타입 | 버튼명 | URL | 비고 |
|------|------|--------|-----|------|
| 1 | WL | 상세 확인하기 | `https://eduflo.co.kr/s/seminar/{seminarId}` | 항상 포함 |
| 2 | WL | 길찾기 | 장소 있음: 네이버 지도 / 장소 없음: 상세 페이지 fallback | **항상 포함** |

---

## 6. Edge Function 상세 분기 로직

### 6-1. notify-chat-message

**입력:** `{ chatRoomId, messageContent }`
**인증:** JWT (프론트엔드 세션)

```
1. JWT에서 sender userId 추출
2. chat_rooms 조회 → academy 정보 + parent_id + staff_user_id 획득
3. 채팅방 쿨다운 확인: chat:{chatRoomId} → 1분 내 발송 이력?
   ├── 이력 있음 → 즉시 반환 (skipped)
   └── 이력 없음 → 계속

4. sender 역할 판별: getRoleFromUserId(userId)
   │
   ├── sender = "parent" 또는 "student"
   │   │
   │   │  수신자 결정:
   │   │  ├── staff_user_id 있으면 → staff에게 발송
   │   │  └── staff_user_id 없으면 → owner_id에게 fallback
   │   │
   │   │  수신자 phone 조회 (profiles 테이블)
   │   │  ├── phone 없음 → 반환 (발송 불가)
   │   │  └── phone 있음 → 계속
   │   │
   │   └── TPL_CHAT_TO_ACADEMY_V1 발송
   │       ├── variables: { academyName, senderName, inquiryTopic, receivedAt }
   │       ├── buttons: [{ name:"채팅 확인하기", url:"/admin/chats/{chatRoomId}" }]
   │       └── rateLimitKey: "chat:{chatRoomId}"
   │
   └── sender = "admin" (학원 멤버)
       │
       │  수신자 = chat_rooms.parent_id
       │  수신자 역할 판별: getRoleFromUserId(parent_id)
       │  ├── "student" → TPL_CHAT_TO_STUDENT_V1 + /s/ 경로
       │  └── 그 외   → TPL_CHAT_TO_PARENT_V1  + /p/ 경로
       │
       │  수신자 phone 조회
       │  ├── phone 없음 → 반환
       │  └── phone 있음 → 계속
       │
       └── 해당 템플릿 발송
           ├── variables: { academyName, receivedAt }
           ├── buttons: [{ name:"채팅 확인하기", url:"/{p|s}/chats/{chatRoomId}" }]
           └── rateLimitKey: "chat:{chatRoomId}"
```

**역할 판별 로직 (getRoleFromUserId) — 병렬 쿼리 최적화:**
```
Promise.all로 2개 쿼리 동시 실행:
  ├── user_roles 테이블에서 role='admin' 확인
  └── student_profiles 테이블에서 user_id 조회

결과 판별:
  1. user_roles.role = 'admin' → admin
  2. student_profiles에 데이터 있음 → student
  3. 위 둘 다 아니면 → parent
```

---

### 6-2. notify-seminar-event

**입력:** `{ eventType, seminarId, applicantUserId?, applicantName? }`
**인증:** JWT (프론트엔드 세션)

#### eventType = "seminar_application" (설명회 신청)

```
1. seminars 조회 → title, date, location, academy 정보
2. 장소 파싱: JSON.parse(location) → name, address
3. mapUrl 생성: 장소명으로 네이버 지도 URL (없으면 null)

── 알림 1: 신청자에게 신청 완료 알림 ──

4. 신청자 역할 판별: getRoleFromUserId(applicantUserId)
   ├── "student" → TPL_SEMINAR_APPLY_DONE_STUDENT_V1
   └── 그 외    → TPL_SEMINAR_APPLY_DONE_PARENT_V1

5. 신청자 phone 조회 (profiles)
   ├── phone 없음 → 이 알림 건너뜀
   └── phone 있음 → 발송

6. 버튼 구성 (항상 2개 — 카카오 고정):
   ├── 버튼1: { name:"신청내역 확인", url:"/{p|s}/seminar/{seminarId}" }
   └── 버튼2: { name:"길찾기", url:mapUrlOrFallback(seminarPlace, detailUrl) }
   *장소 없으면 detailUrl로 fallback*

7. variables: { seminarTitle, academyName, seminarAt, seminarPlace, applicantName }
8. rateLimitKey: "daily:user:{applicantUserId}:{yyyyMMdd}"

── 알림 2: 학원에게 신청 접수 알림 ──

9. academy.owner_id 확인
   ├── null → 이 알림 건너뜀
   └── 있음 → owner phone 조회

10. TPL_SEMINAR_APPLY_RECEIVED_ACADEMY_V1 발송
    ├── variables: { academyName, seminarTitle, applicantName, appliedAt }
    ├── buttons: [{ name:"신청자 관리", url:"/admin/seminars/{seminarId}/applicants" }]
    └── rateLimitKey: "daily:academy:{academyId}:{yyyyMMdd}"
```

#### eventType = "seminar_published" (신규 설명회 등록)

```
1. seminars 조회 → 설명회 정보
2. chat_rooms에서 해당 academy_id의 모든 parent_id 조회
3. 중복 제거 → 최대 100명으로 자름

4. sendBatch()로 10명씩 청크 병렬 발송 (Edge Function 60s 타임아웃 방지):
   │
   ├── 역할 판별: getRoleFromUserId(userId)
   │   ├── "student" → TPL_NEW_SEMINAR_PUBLISHED_STUDENT_V1
   │   └── 그 외    → TPL_NEW_SEMINAR_PUBLISHED_PARENT_V1
   │
   ├── phone 조회 → 없으면 skip
   │
   ├── variables: { seminarTitle, academyName, seminarAt, targetGrade }
   ├── buttons:
   │   ├── { name:"상세보기", url:"/{p|s}/seminar/{seminarId}" }
   │   └── { name:"전체 설명회 보기", url:"/{p|s}/explore?tab=seminars" }
   │
   └── rateLimitKey: "daily:user:{userId}:{yyyyMMdd}"

※ sendBatch(targets, fn, 10): 10명씩 Promise.allSettled로 병렬 처리,
  한 청크 완료 후 다음 청크 진행. 개별 실패가 전체를 중단시키지 않음.
```

---

### 6-3. send-seminar-reminders (크론)

**트리거:** pg_cron 매일 01:00 UTC (= 10:00 KST)
**인증:** `Authorization: Bearer {SERVICE_ROLE_KEY}`

```
1. 내일 날짜 범위 계산 (KST 기준):
   ├── tomorrowStart = 내일 00:00:00 KST → UTC 변환
   └── tomorrowEnd   = 내일 23:59:59 KST → UTC 변환

2. seminars 조회:
   WHERE status = 'recruiting'
   AND date >= tomorrowStartUTC
   AND date <= tomorrowEndUTC

3. 해당 설명회 없으면 → 종료

4. 각 설명회에 대해:
   │
   ├── seminar_applications 조회:
   │   WHERE status IN ('pending', 'confirmed')
   │
   ├── 장소 파싱 → mapUrl 생성
   │
   └── 각 신청자에 대해:
       │
       ├── 역할 판별: getRoleFromUserId(userId)
       │   ├── "student" → TPL_SEMINAR_REMINDER_STUDENT_V1
       │   └── 그 외    → TPL_SEMINAR_REMINDER_PARENT_V1
       │
       ├── phone 조회 → 없으면 skip
       │
       ├── variables: { seminarTitle, seminarAt, seminarPlace }
       ├── buttons (항상 2개 — 카카오 고정):
       │   ├── { name:"상세 확인하기", url:"/{p|s}/seminar/{seminarId}" }
       │   └── { name:"길찾기", url:mapUrlOrFallback(seminarPlace, detailUrl) }
       │   *장소 없으면 detailUrl로 fallback*
       │
       └── rateLimitKey: "daily:user:{userId}:{yyyyMMdd}"
```

---

### 6-4. retry-notification (크론)

**트리거:** pg_cron 2분마다 또는 수동 호출
**인증:** `Authorization: Bearer {SERVICE_ROLE_KEY}`

```
1. notification_logs 조회:
   WHERE status = 'failed'
   AND retry_count < 2
   ORDER BY sent_at ASC
   LIMIT 50

2. 각 로그에 대해:
   │
   ├── provider_result_code 확인:
   │   ├── INVALID_PHONE, BLOCKED, UNSUBSCRIBED, OPTED_OUT → skip (재시도 불가)
   │   └── 그 외 → 재시도 가능
   │
   ├── 재시도 간격 확인:
   │   ├── retry_count = 0 → sent_at + 1분 경과했는지?
   │   └── retry_count = 1 → sent_at + 5분 경과했는지?
   │   경과 안 했으면 → skip (아직 때가 안 됨)
   │
   ├── 메시지 재빌드: buildMessage(template, log.variables)
   │
   ├── 버튼 복원: log.button_urls (JSONB에 {name,url}[] 저장)
   │
   ├── callMunjaKokApi 호출
   │
   └── notification_logs 업데이트:
       ├── status = sent/failed
       ├── retry_count += 1
       └── sent_at = now()
```

---

## 7. 프론트엔드 연동 지점

모든 알림 호출은 **fire-and-forget** 패턴 (`.catch(() => {})`) — UI 플로우를 차단하지 않음.

### 7-1. 채팅 메시지 전송 후

**파일:** `src/hooks/useChatMessages.ts` (line 258)

```typescript
// 채팅방 timestamp 업데이트 성공 후
supabase.functions.invoke('notify-chat-message', {
  body: { chatRoomId, messageContent: validatedContent },
}).catch(() => {});
```

**호출 시점:** `sendMessage()` 함수 내, 메시지 insert + chat_room updated_at 업데이트 직후

### 7-2. 설명회 신청 후

**파일:** `src/pages/SeminarDetailPage.tsx` (line 239)

```typescript
// seminar_applications insert 성공 후
supabase.functions.invoke('notify-seminar-event', {
  body: {
    eventType: 'seminar_application',
    seminarId: id,
    applicantUserId: user.id,
    applicantName: parentName.trim(),
  },
}).catch(() => {});
```

**호출 시점:** `handleApply()` 함수 내, insert 성공 후 ~ UI 상태 업데이트 전

### 7-3. 신규 설명회 등록 후

**파일:** `src/pages/admin/SeminarManagementPage.tsx` (line 299)

```typescript
// seminars insert → select('id').single() 성공 후
const { data: newSeminar, error } = await supabase.from("seminars").insert({
  academy_id: academyId,
  ...seminarData,
  status: "recruiting",
}).select('id').single();

if (error) throw error;

if (newSeminar?.id) {
  supabase.functions.invoke('notify-seminar-event', {
    body: { eventType: 'seminar_published', seminarId: newSeminar.id },
  }).catch(() => {});
}
```

**호출 시점:** `handleSaveSeminar()` 함수 내, **신규 등록 시에만** (수정 시 호출 안 함)

---

## 8. 재시도 로직

### 플로우

```
발송 실패 (status='failed')
    │
    ├── retry-notification 크론 (2분마다)
    │
    ├── 1차 재시도 (retry_count: 0→1)
    │   └── 조건: sent_at + 1분 < now
    │   └── 결과: 성공→'sent' / 실패→'failed' (retry_count=1)
    │
    ├── 2차 재시도 (retry_count: 1→2)
    │   └── 조건: sent_at + 5분 < now
    │   └── 결과: 성공→'sent' / 실패→'failed' (retry_count=2, 더 이상 재시도 안 함)
    │
    └── retry_count >= 2 → 영구 실패 (수동 확인 필요)
```

### 재시도 제외 에러 코드

| result_code | 의미 | 재시도 |
|-------------|------|--------|
| `INVALID_PHONE` | 잘못된 전화번호 | X |
| `BLOCKED` | 차단된 번호 | X |
| `UNSUBSCRIBED` | 수신 거부 | X |
| `OPTED_OUT` | 수신 철회 | X |
| 그 외 | 일시적 오류 | O |

---

## 9. 카카오 템플릿 등록 가이드

### 사전 준비

1. **카카오 비즈니스 채널** 개설 및 프로필 인증
2. **문자콕** (또는 선택한 중계사) 가입 및 발신프로필 등록
3. `sender_key` 발급 확인

### 등록해야 하는 템플릿 총 10개

아래 표의 **"템플릿 본문"** 을 카카오 비즈메시지 관리자에서 정확히 그대로 등록해야 합니다.

| # | template_code | 카테고리 | 버튼 수 | 버튼 타입 |
|---|---------------|---------|---------|----------|
| 1 | `TPL_CHAT_TO_ACADEMY_V1` | 채팅 | 1 | 웹링크(WL) |
| 2 | `TPL_CHAT_TO_PARENT_V1` | 채팅 | 1 | 웹링크(WL) |
| 3 | `TPL_CHAT_TO_STUDENT_V1` | 채팅 | 1 | 웹링크(WL) |
| 4 | `TPL_SEMINAR_APPLY_DONE_PARENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |
| 5 | `TPL_SEMINAR_APPLY_DONE_STUDENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |
| 6 | `TPL_SEMINAR_APPLY_RECEIVED_ACADEMY_V1` | 설명회 | 1 | 웹링크(WL) |
| 7 | `TPL_NEW_SEMINAR_PUBLISHED_PARENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |
| 8 | `TPL_NEW_SEMINAR_PUBLISHED_STUDENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |
| 9 | `TPL_SEMINAR_REMINDER_PARENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |
| 10 | `TPL_SEMINAR_REMINDER_STUDENT_V1` | 설명회 | 2 | 웹링크(WL) x2 |

### 각 템플릿 등록 시 입력값

**카카오 비즈메시지에서 템플릿 등록 시 필요한 필드:**

| 필드 | 값 |
|------|-----|
| 템플릿 코드 | 위 표의 template_code |
| 카테고리 | 업종별 > 교육 |
| 메시지 유형 | 기본형 |
| 보안 템플릿 | 아니오 |
| 강조 유형 | 없음 |
| 템플릿 내용 | 아래 각 템플릿 본문 (정확히 복사) |
| 버튼 | 웹링크(WL), URL은 `https://eduflo.co.kr` 도메인 |

### 검수 시 주의사항

- 템플릿 본문에 **줄바꿈, 공백, 특수문자** 가 정확히 일치해야 함
- `#{변수N}` 형식의 변수는 카카오 검수 시 **치환 예시값** 을 함께 제출
- 버튼 URL의 **도메인** 은 카카오 채널에 등록된 도메인과 일치해야 함
- 검수 소요: 영업일 **1~2일**
- 검수 승인 후 코드에서 `template_code` 값이 다르면 `_shared/notification.ts`의 `TEMPLATES` 객체 수정

### pg_cron 설정 (Supabase Dashboard → SQL Editor)

#### 사전 준비: service_role_key를 DB 설정에 저장

`current_setting('app.settings.service_role_key')`을 사용하려면, 먼저 Supabase Dashboard에서 서비스 롤 키를 PostgreSQL 설정으로 등록해야 합니다.

**방법 1 — Supabase Dashboard:**
1. Settings → Database → Configuration → Custom PostgreSQL Settings
2. `app.settings.service_role_key` 항목 추가, 값으로 서비스 롤 키 입력

**방법 2 — SQL Editor에서 직접 실행:**
```sql
-- ⚠️ <YOUR_SERVICE_ROLE_KEY> 를 실제 키로 교체하세요
ALTER DATABASE postgres SET app.settings.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
```

> **주의:** service_role_key는 전체 DB 접근 권한이 있으므로 반드시 서버 사이드에서만 사용하고, 프론트엔드에 노출되지 않도록 주의하세요.

#### 크론 잡 등록

```sql
-- 전일 리마인드: 매일 01:00 UTC (= 10:00 KST)
SELECT cron.schedule(
  'send-seminar-reminders',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-seminar-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 실패 재시도: 2분마다
SELECT cron.schedule(
  'retry-notification',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/retry-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

> `<PROJECT_REF>`는 Supabase 프로젝트 Reference ID로 교체하세요 (Dashboard → Settings → General에서 확인).

---

## 10. 테스트 체크리스트

### Phase 1: DRY_RUN 모드 (`MUNJAKOK_DRY_RUN=true`)

API 실제 호출 없이 로그만 기록됩니다.

- [ ] **채팅 알림 — 학부모→학원**
  - 학부모 계정으로 채팅 메시지 전송
  - `notification_logs` 확인: `template_code='TPL_CHAT_TO_ACADEMY_V1'`, `status='sent'`, `provider_result_code='DRY_RUN'`
  - `variables` JSONB에 `academyName`, `senderName`, `inquiryTopic`, `receivedAt` 포함 확인

- [ ] **채팅 알림 — 학원→학부모**
  - 학원 계정으로 채팅 메시지 전송
  - `template_code='TPL_CHAT_TO_PARENT_V1'` 확인

- [ ] **채팅 알림 — 학원→학생**
  - 학생 계정의 채팅방에서 학원이 메시지 전송
  - `template_code='TPL_CHAT_TO_STUDENT_V1'` 확인

- [ ] **채팅 쿨다운**
  - 같은 채팅방에서 1분 내 2회 메시지 전송
  - 2번째: `status='skipped'` 또는 즉시 반환 확인

- [ ] **설명회 신청 — 학부모 + 학원**
  - 학부모로 설명회 신청
  - 로그 2건 확인:
    1. `TPL_SEMINAR_APPLY_DONE_PARENT_V1` (신청자에게)
    2. `TPL_SEMINAR_APPLY_RECEIVED_ACADEMY_V1` (학원에게)
  - 장소 있으면: `button_urls`에 길찾기 버튼 포함 확인

- [ ] **설명회 신청 — 학생**
  - 학생으로 설명회 신청
  - `TPL_SEMINAR_APPLY_DONE_STUDENT_V1` 확인

- [ ] **신규 설명회 등록**
  - 학원 관리자가 새 설명회 등록
  - 해당 학원과 채팅방이 있는 유저 수만큼 알림 로그 생성 확인
  - 학부모: `TPL_NEW_SEMINAR_PUBLISHED_PARENT_V1`
  - 학생: `TPL_NEW_SEMINAR_PUBLISHED_STUDENT_V1`

- [ ] **일일 Rate Limit**
  - 동일 유저에게 20회 초과 발송 시도
  - 21번째부터 `status='skipped'` 확인

### Phase 2: 실제 발송 (`MUNJAKOK_DRY_RUN=false`)

- [ ] 환경변수 확인: `MUNJAKOK_API_KEY`, `MUNJAKOK_API_URL`, `MUNJAKOK_SENDER_KEY`, `MUNJAKOK_SENDER_NO`
- [ ] 테스트 번호로 각 템플릿 발송 → 카카오톡 수신 확인
- [ ] 알림톡 실패 시 SMS fallback 수신 확인
- [ ] 각 버튼 URL 클릭 → 올바른 페이지 이동 확인:
  - `/admin/chats/{id}` — 학원 채팅방
  - `/p/chats/{id}` — 학부모 채팅방
  - `/s/chats/{id}` — 학생 채팅방
  - `/p/seminar/{id}` — 학부모 설명회 상세
  - `/s/seminar/{id}` — 학생 설명회 상세
  - `/admin/seminars/{id}/applicants` — 학원 신청자 관리
  - `/p/explore?tab=seminars` — 학부모 설명회 목록
  - `/s/explore?tab=seminars` — 학생 설명회 목록
- [ ] 리마인드 크론 수동 실행 → 내일 예정 설명회 신청자에게 발송 확인
- [ ] 의도적 실패 후 retry-notification 크론 실행 → 재시도 확인

### Phase 3: 모니터링 쿼리

```sql
-- 최근 발송 현황
SELECT template_code, status, count(*)
FROM notification_logs
WHERE sent_at > now() - interval '24 hours'
GROUP BY template_code, status
ORDER BY template_code;

-- 실패 목록
SELECT id, template_code, recipient_phone, error_message, provider_result_code, retry_count, sent_at
FROM notification_logs
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 20;

-- Rate limit으로 skipped된 건
SELECT rate_limit_key, count(*), max(sent_at)
FROM notification_logs
WHERE status = 'skipped'
AND sent_at > now() - interval '24 hours'
GROUP BY rate_limit_key
ORDER BY count(*) DESC;

-- 일별 발송 통계
SELECT
  date_trunc('day', sent_at) AS day,
  status,
  count(*)
FROM notification_logs
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```
