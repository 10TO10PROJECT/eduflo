# 10to10 — 구현 기능 목록

**노션 가져오기:** 노션 페이지 → ⋯ → 가져오기 → Markdown → 이 파일 선택 (복사·붙여넣기 X)

**문서 기준:** src/App.tsx, Supabase 스키마·Edge Functions

## 프로젝트 개요

학원·설명회·상담·커뮤니티를 묶는 교육 플랫폼입니다. 역할별로 URL prefix가 나뉩니다.

| 역할 | 경로 prefix | 설명 |
| --- | --- | --- |
| 학생 | /s | 시간표·학원 탐색 |
| 학부모 | /p | 자녀 연동·예약·QR 체크인 등 |
| 학원 관리자 | /admin, /academy | 학원 운영·상담·설명회·채팅 |
| 슈퍼 관리자 | /super, /admin/super | 플랫폼 전체 관리 |

## 1. 공통 / 인프라

- 스플래시 화면, 역할 선택 (학생 / 학부모 / 학원 관리자)
- 인증
  - 휴대폰 (Firebase SMS + reCAPTCHA, 배포 환경)
  - 이메일·비밀번호 (Supabase)
  - 역할별 로그인 후 홈 리다이렉트 (user_roles)
  - 비밀번호 변경 필수 플로우
  - redirect 쿼리로 로그인 후 원래 페이지 복귀
- 지역 필터 (RegionContext, 전역 지역 선택)
- 릴리스 공지 게이트 (ReleaseNoticeGate)
- 모바일 우선 UI (하단 탭 네비, max-width 레이아웃)
- 백엔드: Supabase (Postgres RLS, Storage, Edge Functions)

## 2. 학생·학부모 공통 기능

### 2.1 홈·탐색

- 홈: 모집 중 설명회 캐러셀, 학원 소식 피드, 오늘 일정, 공지 배너, 퀵 메뉴 (예약·공지·시간표·이벤트)
- 탐색: 학원 목록·지도, 설명회 탭, 과목·학년 필터, 검색, 북마크(찜)
- 학원 상세: 프로필·강사·수업·소식 탭, 상담 예약, 채팅 시작, 북마크

### 2.2 설명회

- 설명회 상세·신청 (커스텀 설문 필드)
- 비로그인(게스트) 설명회 신청
- 내 예약에서 설명회 신청 조회·취소

### 2.3 상담·예약

- 학원 방문 상담 예약 (시간 슬롯, 학원 설정 반영)
- 내 예약: 상담 예약 + 설명회 신청 통합 관리

### 2.4 채팅

- 학원과 1:1 채팅방 목록·메시지
- 채팅방 폴더 생성·관리·방 선택
- 읽지 않은 메시지 표시
- 학원 직원 선택 후 채팅 시작

### 2.5 커뮤니티

- 피드 (학원 공지·입시·설명회·이벤트, 학부모 게시: 육아·자유 등)
- 좋아요, 댓글·대댓글·댓글 좋아요
- 댓글 신고, 사용자 차단
- 게시글 상세·무한 스크롤·지역 필터
- 학부모 글 작성 다이얼로그

### 2.6 학습·일정

- 시간표: 수강 반 일정 + 수동 일정 추가·편집 (학부모는 자녀별)
- MY CLASS: 수강 클래스 목록
- 학습 스타일 테스트 → 결과 페이지
- 학원 선호도 테스트 → 결과 페이지

### 2.7 마이페이지·설정

- 프로필·닉네임
- 북마크한 학원
- 차단한 사용자 목록
- 설정·고객센터
- 공지사항 목록
- 이벤트 피드 (type=event)

### 2.8 학부모 전용

- 자녀 연결: 연결 코드, 가상 자녀 프로필, 다자녀·주 자녀
- QR 체크인 (/p/check-in): 카메라/수동 코드 스캔

### 2.9 학생 전용

- 학부모 연결 (ParentConnectionPage)

## 3. 학원 관리자 기능

### 3.1 온보딩·설정

- 학원 온보딩: 사업자 인증 후 참여 코드로 학원 가입 또는 학원 생성
- 학원 셋업·대시보드
- 사업자 인증 신청 (사업자번호·서류 업로드)
- 승인 전 일부 기능 제한

### 3.2 학원 홈·운영

- 관리자 홈: 미읽 채팅, 오늘 방문 상담, 다가오는 설명회 요약
- 학원 프로필 관리 (권한: edit_profile 등)
- 프로필 읽기 전용 뷰
- 강사·수업(클래스) CRUD, 과목·태그·정렬, 활성/비활성
- 상담 설정 (운영 시간, 슬롯, 휴무일 등)

### 3.3 상담·설명회·콘텐츠

- 상담 관리: 예약 확인·상태 변경·채팅 연동
- 예약 관리 목록
- 설명회 관리 CRUD, 신청자 목록
- 학원 게시물 (posts) 관리
- 피드 게시물 (feed_posts) 관리

### 3.4 멤버·채팅·커뮤니티

- 학원 멤버 관리: 원장/부원장/상담실장/강사, 승인·권한 (멤버 관리, 프로필 수정 등)
- 채팅 (관리자용 목록·방)
- 채팅 관리 (플랫폼 수준 메뉴)
- 커뮤니티 모더레이션 뷰

### 3.5 학원 계정 내 슈퍼 관리 (/admin/super/*)

- 학원·사용자·게시물·설명회·커뮤니티·시스템 설정
- 사업자 인증 심사

## 4. 슈퍼 관리자 전용 (/super)

- 슈퍼 홈·센터 (통계: 사용자·학원·상담·설명회)
- 탐색·커뮤니티 열람용 뷰
- 학원·설명회 상세 열람
- 학원 CRUD·수정
- 사용자·게시물·설명회·신청자 관리
- 사업자 인증 심사
- 고객센터·설정·프로필

💡 개발 모드에서는 ProtectedSuperAdminRoute 인증 우회 가능

## 5. 백엔드·알림 (Edge Functions)

| 함수 | 용도 |
| --- | --- |
| firebase-login / firebase-signup | Firebase ↔ Supabase 연동 |
| login-with-phone / auth-phone-verify | 휴대폰 인증 |
| send-verification-email | 이메일 인증 |
| notify-chat-message | 채팅 메시지 알림 |
| notify-seminar-event | 설명회 이벤트 알림 |
| send-seminar-reminders | 설명회 리마인더 |
| retry-notification | 알림 재시도 |
| admin-reset-user-password | 관리자 비밀번호 초기화 |
| clear-password-change-required | 비밀번호 변경 플래그 해제 |
| update-auth-settings | 인증 설정 |

- 카카오 알림톡(문자콕) 연동 및 notification_logs (pgnet 트리거 기반)

## 6. 데이터·도메인 모델 (주요 테이블)

| 테이블 | 설명 |
| --- | --- |
| academies | 학원 |
| academy_members | 학원 멤버·권한 |
| academy_settings | 상담 운영 설정 |
| teachers | 강사 |
| classes | 수업 |
| class_enrollments | 수강 등록 |
| manual_schedules | 수동 일정 |
| seminars | 설명회 |
| seminar_applications | 설명회 신청 |
| consultation_reservations | 상담 예약 |
| consultations | 상담 |
| chat_rooms / messages | 채팅 |
| feed_posts / posts | 피드·학원 게시물 |
| post_comments / post_likes / comment_likes | 댓글·좋아요 |
| bookmarks | 찜 |
| profiles / student_profiles | 프로필 |
| parent_child_relations / connection_codes | 자녀 연결 |
| business_verifications | 사업자 인증 |
| announcements / platform_settings | 공지·플랫폼 설정 |
| user_blocks / comment_reports | 차단·신고 |
| user_roles | 역할 |

## 7. 접근·인증 흐름

| 역할 | 진입 | 로그인 |
| --- | --- | --- |
| 학생 | 역할 선택 → /s/home | 일부 기능에서 LoginRequiredDialog |
| 학부모 | 역할 선택 → /p/home | 동일 |
| 학원 관리자 | 역할 선택 → /auth | 보호 라우트 필수 |

## 8. 주요 라우트

### 8.1 학부모 (/p)

| 경로 | 설명 |
| --- | --- |
| /p/home | 홈 |
| /p/explore | 탐색 |
| /p/community | 커뮤니티 |
| /p/community/post/:postId | 게시글 상세 |
| /p/my | 마이페이지 |
| /p/my/profile | 프로필 |
| /p/my/blocked-users | 차단 사용자 |
| /p/my/classes | MY CLASS |
| /p/my/bookmarks | 북마크 |
| /p/my/reservations | 내 예약 |
| /p/child-connection | 자녀 연결 |
| /p/settings | 설정 |
| /p/customer-service | 고객센터 |
| /p/chats | 채팅 목록 |
| /p/chats/folders | 채팅 폴더 |
| /p/chats/folders/create | 폴더 생성 |
| /p/chats/folders/create/select | 폴더에 방 선택 |
| /p/chats/:id | 채팅방 |
| /p/seminar/:id | 설명회 상세 |
| /p/academy/:id | 학원 상세 |
| /p/learning-style-test | 학습 스타일 테스트 |
| /p/learning-style-result | 학습 스타일 결과 |
| /p/preference-test | 선호도 테스트 |
| /p/preference-result | 선호도 결과 |
| /p/timetable | 시간표 |
| /p/events | 이벤트 |
| /p/announcements | 공지사항 |
| /p/check-in | QR 체크인 |

### 8.2 학생 (/s)

| 경로 | 설명 |
| --- | --- |
| /s/home | 홈 |
| /s/explore | 탐색 |
| /s/community | 커뮤니티 |
| /s/community/post/:postId | 게시글 상세 |
| /s/my | 마이페이지 |
| /s/my/profile | 프로필 |
| /s/my/blocked-users | 차단 사용자 |
| /s/my/classes | MY CLASS |
| /s/my/bookmarks | 북마크 |
| /s/my/reservations | 내 예약 |
| /s/parent-connection | 학부모 연결 |
| /s/settings | 설정 |
| /s/customer-service | 고객센터 |
| /s/chats | 채팅 목록 |
| /s/chats/folders | 채팅 폴더 |
| /s/chats/folders/create | 폴더 생성 |
| /s/chats/folders/create/select | 폴더에 방 선택 |
| /s/chats/:id | 채팅방 |
| /s/seminar/:id | 설명회 상세 |
| /s/academy/:id | 학원 상세 |
| /s/learning-style-test | 학습 스타일 테스트 |
| /s/learning-style-result | 학습 스타일 결과 |
| /s/preference-test | 선호도 테스트 |
| /s/preference-result | 선호도 결과 |
| /s/timetable | 시간표 |
| /s/events | 이벤트 |
| /s/announcements | 공지사항 |

### 8.3 학원 관리자

| 경로 | 설명 |
| --- | --- |
| /academy/onboarding | 학원 온보딩 |
| /academy/setup | 학원 셋업 |
| /academy/dashboard | 학원 대시보드 |
| /admin/home | 관리자 홈 |
| /admin/consultations | 상담 관리 |
| /admin/reservations | 예약 관리 |
| /admin/profile | 프로필 관리 |
| /admin/profileread | 프로필 읽기 전용 |
| /admin/seminars | 설명회 관리 |
| /admin/seminars/:seminarId/applicants | 설명회 신청자 |
| /admin/posts | 학원 게시물 관리 |
| /admin/feed-posts | 피드 게시물 관리 |
| /admin/chats | 채팅 목록 |
| /admin/chats/:id | 채팅방 |
| /admin/community | 커뮤니티 |
| /admin/community/post/:postId | 게시글 상세 |
| /admin/verification | 사업자 인증 신청 |
| /admin/verification-review | 사업자 인증 심사 |
| /admin/super | 슈퍼 관리 메인 |
| /admin/super/settings | 시스템 설정 |
| /admin/super/users | 사용자 관리 |
| /admin/super/posts | 피드 관리 |
| /admin/super/academies | 학원 관리 |
| /admin/super/academies/create | 학원 생성 |
| /admin/super/academies/:id/edit | 학원 수정 |
| /admin/super/community | 커뮤니티 관리 |
| /admin/super/seminars | 설명회 관리 |
| /admin/super/seminars/:seminarId/applicants | 설명회 신청자 |
| /admin/my | 마이페이지 |
| /admin/my/profile | 프로필 |
| /admin/my/blocked-users | 차단 사용자 |
| /admin/settings | 설정 |
| /admin/customer-service | 고객센터 |
| /admin/members | 멤버 관리 |
| /admin/chat-management | 채팅 관리 |

### 8.4 슈퍼 관리자 (/super)

| 경로 | 설명 |
| --- | --- |
| /super/home | 슈퍼 홈 |
| /super/center | 센터(통계) |
| /super/customer-service | 고객센터 |
| /super/explore | 탐색(열람) |
| /super/community | 커뮤니티(열람) |
| /super/my | 마이페이지 |
| /super/my/profile | 프로필 |
| /super/settings | 설정 |
| /super/academy/:id | 학원 상세 |
| /super/seminar/:id | 설명회 상세 |
| /super/verification-review | 사업자 인증 심사 |
| /super/users | 사용자 관리 |
| /super/posts/create | 게시물 작성 |
| /super/seminars/manage | 설명회 관리 |
| /super/seminars/:seminarId/applicants | 설명회 신청자 |
| /super/academies | 학원 목록 |
| /super/academies/create | 학원 생성 |
| /super/academies/:id/edit | 학원 수정 |
| /super/posts | 게시물 관리 |

### 8.5 공통·인증

| 경로 | 설명 |
| --- | --- |
| / | 역할 선택 |
| /role-selection | 역할 선택 |
| /auth | 로그인·회원가입 |
| /home | 홈 (레거시) |
