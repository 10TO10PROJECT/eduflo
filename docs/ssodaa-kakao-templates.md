# 쏘다(Ssodaa) 카카오 알림톡 템플릿 등록 가이드

## 1) 대행사 및 API 인증 정보

| 항목 | 값 |
|------|-----|
| 대행사 | 쏘다(Ssodaa) |
| Base URL (운영) | `https://apis.ssodaa.com` |
| 인증 방식 | `x-api-key` 헤더 + `token_key` body 필드 |
| token_key | 환경변수 `SSODAA_TOKEN_KEY` 참조 |
| api_key | 환경변수 `SSODAA_API_KEY` 참조 |

> 인증키는 Supabase secrets에만 저장합니다. 문서/코드에 직접 노출하지 마세요.

## 2) 카카오 채널 정보

| 항목 | 값 |
|------|-----|
| 카카오 채널명 | 링크어스(Link Earth) |
| pfId | *TO BE FILLED* |
| sender_key | *발신프로필 등록 후 발급* |
| 비즈니스 인증 | 완료 |

## 3) 발신번호

| 항목 | 값 |
|------|-----|
| 발신번호 | 010-8283-3973 |
| 번호 인증 | 완료 |

## 환경변수 설정 (Supabase Edge Functions)

```bash
supabase secrets set SSODAA_API_KEY=<발급받은_API_KEY>
supabase secrets set SSODAA_TOKEN_KEY=<발급받은_TOKEN_KEY>
supabase secrets set SSODAA_SENDER_KEY=<발신프로필_등록_후_발급된_키>
```

---

## 4) 등록 대상 템플릿 10개

학부모/학생 별도 템플릿으로 분리하여 카카오 검수 안정성을 확보합니다.
**템플릿 코드는 5~30자** (영문, 숫자, 하이픈, 언더바만 가능)

버튼 URL은 **고정 경로 방식** 사용 (검수 안정성 확보):

- 학부모: `https://eduflo.co.kr/p/...`
- 학생: `https://eduflo.co.kr/s/...`
- 학원: `https://eduflo.co.kr/admin/...`

> **지도 링크 참고**: `#{mapKeyword}` 변수는 백엔드에서 URL 인코딩된 값으로 전달합니다.
> 예: "에듀플로 본관 3층" → `%EC%97%90%EB%93%80%ED%94%8C%EB%A1%9C+%EB%B3%B8%EA%B4%80+3%EC%B8%B5`

---

### 1. TPL_CHAT_TO_ACADEMY_V1 (22자) — 채팅 도착 알림 (학부모/학생 → 학원)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 1개 (웹링크)

**템플릿 원문:**

```
안녕하세요, #{academyName} 담당자님.

10to10에서 #{senderName}님이 새 메시지를 보냈습니다.

- 문의주제: #{inquiryTopic}
- 도착시간: #{receivedAt}

아래 버튼을 눌러 바로 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{academyName} | 학원명 | 에듀플로학원 |
| #{senderName} | 메시지 보낸 사람 이름 | 홍길동 |
| #{inquiryTopic} | 문의 주제 | 수업 일정 문의 |
| #{receivedAt} | 메시지 수신 시각 | 2026-03-08 14:30 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{chatRoomId} | 채팅방 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 채팅 확인하기 | 웹링크 | `https://eduflo.co.kr/admin/chats/#{chatRoomId}` |

---

### 2. TPL_CHAT_TO_PARENT_V1 (21자) — 채팅 도착 알림 (학원 → 학부모)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 1개 (웹링크)

**템플릿 원문:**

```
#{academyName}에서 답장이 도착했습니다

지금 확인하고 이어서 상담해 보세요.

- 도착시간: #{receivedAt}

아래 버튼을 누르면 바로 채팅으로 이동합니다.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{academyName} | 학원명 | 에듀플로학원 |
| #{receivedAt} | 메시지 수신 시각 | 2026-03-08 14:30 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{chatRoomId} | 채팅방 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 답장하러 가기 | 웹링크 | `https://eduflo.co.kr/p/chats/#{chatRoomId}` |

---

### 3. TPL_CHAT_TO_STUDENT_V1 (22자) — 채팅 도착 알림 (학원 → 학생)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 1개 (웹링크)

**템플릿 원문:**

```
#{academyName}에서 답장이 도착했습니다

지금 확인하고 이어서 상담해 보세요.

- 도착시간: #{receivedAt}

아래 버튼을 누르면 바로 채팅으로 이동합니다.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{academyName} | 학원명 | 에듀플로학원 |
| #{receivedAt} | 메시지 수신 시각 | 2026-03-08 14:30 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{chatRoomId} | 채팅방 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 답장하러 가기 | 웹링크 | `https://eduflo.co.kr/s/chats/#{chatRoomId}` |

---

### 4. TPL_SEM_DONE_PARENT_V1 (22자) — 설명회 신청 완료 (학부모)

- **카테고리**: 예약/접수 확인
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
설명회 신청이 완료되었습니다

- 설명회: #{seminarTitle}
- 주관: #{academyName}
- 일시: #{seminarAt}
- 장소: #{seminarPlace}
- 신청자: #{applicantName}

변경/취소 및 상세 안내는 아래에서 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{academyName} | 주관 학원명 | 에듀플로학원 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{seminarPlace} | 설명회 장소 | 에듀플로 본관 3층 |
| #{applicantName} | 신청자명 | 홍길동 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |
| #{mapKeyword} | 지도 검색어 (URL 인코딩 필수) | %EC%97%90%EB%93%80%ED%94%8C%EB%A1%9C... |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 신청내역 확인 | 웹링크 | `https://eduflo.co.kr/p/seminar/#{seminarId}` |
| 길찾기 | 웹링크 | `https://map.naver.com/v5/search/#{mapKeyword}` |

---

### 5. TPL_SEM_DONE_STUDENT_V1 (23자) — 설명회 신청 완료 (학생)

- **카테고리**: 예약/접수 확인
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
설명회 신청이 완료되었습니다

- 설명회: #{seminarTitle}
- 주관: #{academyName}
- 일시: #{seminarAt}
- 장소: #{seminarPlace}
- 신청자: #{applicantName}

변경/취소 및 상세 안내는 아래에서 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{academyName} | 주관 학원명 | 에듀플로학원 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{seminarPlace} | 설명회 장소 | 에듀플로 본관 3층 |
| #{applicantName} | 신청자명 | 홍길동 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |
| #{mapKeyword} | 지도 검색어 (URL 인코딩 필수) | %EC%97%90%EB%93%80%ED%94%8C%EB%A1%9C... |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 신청내역 확인 | 웹링크 | `https://eduflo.co.kr/s/seminar/#{seminarId}` |
| 길찾기 | 웹링크 | `https://map.naver.com/v5/search/#{mapKeyword}` |

---

### 6. TPL_SEM_APPLIED_ACADEMY_V1 (26자) — 설명회 신청 접수 알림 (학원)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 1개 (웹링크)

**템플릿 원문:**

```
#{academyName} 설명회에 새 신청이 접수되었습니다

- 설명회: #{seminarTitle}
- 신청자: #{applicantName}
- 신청시간: #{appliedAt}

아래 버튼에서 신청자 리스트를 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{academyName} | 학원명 | 에듀플로학원 |
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{applicantName} | 신청자명 | 홍길동 |
| #{appliedAt} | 신청 시간 | 2026-03-08 14:30 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 신청자 확인하기 | 웹링크 | `https://eduflo.co.kr/admin/seminars/#{seminarId}/applicants` |

---

### 7. TPL_NEW_SEM_PARENT_V1 (21자) — 신규 설명회 등록 알림 (학부모)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
새로운 설명회가 등록되었습니다

- 설명회: #{seminarTitle}
- 주관: #{academyName}
- 일시: #{seminarAt}
- 대상: #{targetGrade}

아래에서 상세 확인 후 신청해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{academyName} | 주관 학원명 | 에듀플로학원 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{targetGrade} | 대상 학년 | 예비중3/예비고1 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 설명회 상세보기 | 웹링크 | `https://eduflo.co.kr/p/seminar/#{seminarId}` |
| 전체 설명회 보기 | 웹링크 | `https://eduflo.co.kr/p/explore?tab=seminars` |

---

### 8. TPL_NEW_SEM_STUDENT_V1 (22자) — 신규 설명회 등록 알림 (학생)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
새로운 설명회가 등록되었습니다

- 설명회: #{seminarTitle}
- 주관: #{academyName}
- 일시: #{seminarAt}
- 대상: #{targetGrade}

아래에서 상세 확인 후 신청해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{academyName} | 주관 학원명 | 에듀플로학원 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{targetGrade} | 대상 학년 | 예비중3/예비고1 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 설명회 상세보기 | 웹링크 | `https://eduflo.co.kr/s/seminar/#{seminarId}` |
| 전체 설명회 보기 | 웹링크 | `https://eduflo.co.kr/s/explore?tab=seminars` |

---

### 9. TPL_SEM_REMIND_PARENT_V1 (25자) — 설명회 전일 리마인드 (학부모)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
신청하신 설명회가 내일입니다

- 설명회: #{seminarTitle}
- 일시: #{seminarAt}
- 장소: #{seminarPlace}

아래 버튼에서 상세 안내사항을 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{seminarPlace} | 설명회 장소 | 에듀플로 본관 3층 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |
| #{mapKeyword} | 지도 검색어 (URL 인코딩 필수) | %EC%97%90%EB%93%80%ED%94%8C%EB%A1%9C... |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 안내사항 확인 | 웹링크 | `https://eduflo.co.kr/p/seminar/#{seminarId}` |
| 길찾기 | 웹링크 | `https://map.naver.com/v5/search/#{mapKeyword}` |

---

### 10. TPL_SEM_REMIND_STUDENT_V1 (25자) — 설명회 전일 리마인드 (학생)

- **카테고리**: 알림/공지
- **메시지 유형**: 기본형 (BA)
- **강조 유형**: 선택 안함 (NONE)
- **버튼**: 2개 (웹링크)

**템플릿 원문:**

```
신청하신 설명회가 내일입니다

- 설명회: #{seminarTitle}
- 일시: #{seminarAt}
- 장소: #{seminarPlace}

아래 버튼에서 상세 안내사항을 확인해 주세요.
```

**본문 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarTitle} | 설명회명 | 2026 입시전략 설명회 |
| #{seminarAt} | 설명회 일시 | 2026-03-15 14:00 |
| #{seminarPlace} | 설명회 장소 | 에듀플로 본관 3층 |

**버튼 URL 변수:**

| 변수 | 설명 | 예시 |
|------|------|------|
| #{seminarId} | 설명회 ID | 550e8400-e29b-41d4-a716-446655440000 |
| #{mapKeyword} | 지도 검색어 (URL 인코딩 필수) | %EC%97%90%EB%93%80%ED%94%8C%EB%A1%9C... |

**버튼:**

| 버튼명 | 버튼타입 | Mobile 링크 |
|--------|----------|-------------|
| 안내사항 확인 | 웹링크 | `https://eduflo.co.kr/s/seminar/#{seminarId}` |
| 길찾기 | 웹링크 | `https://map.naver.com/v5/search/#{mapKeyword}` |

---

## 5) 알림 유형별 발송 조건

### A. 채팅 알림 (1, 2, 3번)

- 발송 시점: 메시지 서버 저장 성공 시 즉시 1회
- 쿨다운: 동일 채팅방 마지막 알림 후 **1분 이내 추가 알림 차단**
- 일 최대: 사용자 기준 **20회/일**, 학원 기준 **50회/일**

### B. 설명회 신청 완료 (4, 5번)

- 발송 시점: 신청 CONFIRMED 확정 시 1회
- 중복 방지: 동일 신청건 1회만 (신청ID 기준)

### C. 설명회 신청 접수 (6번)

- 발송 시점: 신청 확정 시 학원에게 실시간 1회

### D. 신규 설명회 등록 (7, 8번)

- 발송 시점: 설명회 PUBLISHED 전환 시 1회
- 대상: region 일치 유저 + targetGrade 매칭 우선
- 일 최대: 동일 유저 **2건/일**

### E. 설명회 리마인드 (9, 10번)

- 발송 시점: pg_cron 매일 10:00 KST (전일)
- SMS fallback: 운영 결정에 따라 ON 가능

---

## 6) 실패 처리 정책

- 재시도: 최대 **2회** (1분 후 1차, 5분 후 2차)
- SMS fallback: 기본 OFF (설명회 리마인드만 예외 가능)
- Failover: 쏘다 API failover 설정 `use: "Y"` → LMS 대체발송 (최대 2,000자)
- 실패 로그: `notification_logs` 테이블에 전수 기록

---

## 7) 사전 준비 체크리스트

1. [ ] 카카오 비즈니스센터 채널 등록 완료 (링크어스)
2. [ ] 쏘다에서 발신프로필 등록 (`/kakao/profile/create`)
3. [ ] `sender_key` 확보
4. [ ] 템플릿 카테고리 코드 확인 (`/kakao/template/category/all`)
5. [ ] 10개 템플릿 등록 (`/kakao/template/add`)
6. [ ] 10개 템플릿 검수 요청 (`/kakao/template/request`)
7. [ ] 검수 승인 후 Supabase 환경변수 설정
8. [ ] `SSODAA_DRY_RUN=true`로 테스트 발송 확인
9. [ ] `SSODAA_DRY_RUN` 제거 후 실서비스 전환
10. [ ] 인증키 재발급 (대화 중 노출된 키 교체)

---

## 템플릿 요약 표

| # | 코드 (글자수) | 용도 | 수신자 | 본문 변수 | 버튼 URL 변수 | 버튼 |
|---|---------------|------|--------|-----------|---------------|------|
| 1 | TPL_CHAT_TO_ACADEMY_V1 (22) | 채팅 도착 알림 | 학원 | 4 | chatRoomId | 1 |
| 2 | TPL_CHAT_TO_PARENT_V1 (21) | 채팅 도착 알림 | 학부모 | 2 | chatRoomId | 1 |
| 3 | TPL_CHAT_TO_STUDENT_V1 (22) | 채팅 도착 알림 | 학생 | 2 | chatRoomId | 1 |
| 4 | TPL_SEM_DONE_PARENT_V1 (22) | 설명회 신청 완료 | 학부모 | 5 | seminarId, mapKeyword | 2 |
| 5 | TPL_SEM_DONE_STUDENT_V1 (23) | 설명회 신청 완료 | 학생 | 5 | seminarId, mapKeyword | 2 |
| 6 | TPL_SEM_APPLIED_ACADEMY_V1 (26) | 신청 접수 알림 | 학원 | 4 | seminarId | 1 |
| 7 | TPL_NEW_SEM_PARENT_V1 (21) | 신규 설명회 등록 | 학부모 | 4 | seminarId | 2 |
| 8 | TPL_NEW_SEM_STUDENT_V1 (22) | 신규 설명회 등록 | 학생 | 4 | seminarId | 2 |
| 9 | TPL_SEM_REMIND_PARENT_V1 (25) | 전일 리마인드 | 학부모 | 3 | seminarId, mapKeyword | 2 |
| 10 | TPL_SEM_REMIND_STUDENT_V1 (25) | 전일 리마인드 | 학생 | 3 | seminarId, mapKeyword | 2 |

> 모든 코드 30자 이내, 네이밍 패턴 통일 완료
