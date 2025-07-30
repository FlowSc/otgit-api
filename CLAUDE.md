# OTGIT API - Claude Development Context

## Project Overview
OTGIT API는 위치 기반 데이팅 앱의 백엔드 API입니다. 사용자들이 여행 사진의 위치를 기반으로 매칭되는 소셜 데이팅 플랫폼입니다.

## Tech Stack
- **Framework**: NestJS (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (이미지 파일)
- **Push Notifications**: Firebase Admin SDK
- **Real-time**: Socket.IO (WebSocket)
- **Authentication**: JWT + Supabase Auth
- **Rate Limiting**: Throttler

## Architecture Overview
### Core Modules
- **AuthModule**: 사용자 인증, 회원가입, 소셜 로그인, 전화번호 인증
- **PhotosModule**: 프로필/여행 사진 업로드 및 관리
- **LikesModule**: 좋아요 시스템 및 매칭 로직
- **ChatModule**: 실시간 채팅 시스템 (WebSocket)
- **NotificationsModule**: Firebase 푸시 알림
- **FirebaseModule**: Firebase Admin SDK 설정

### Storage Structure
- **profile-photos**: 프로필 사진 (최대 5MB, JPEG/PNG/WebP)
- **travel-photos**: 여행 사진 (최대 10MB, JPEG/PNG/GIF/WebP)

## Development Commands

### 서버 실행
```bash
npm run start:dev    # 개발 모드 (watch)
npm run start        # 프로덕션 모드
npm run start:debug  # 디버그 모드
```

### 코드 품질
```bash
npm run lint         # ESLint 검사 및 자동 수정
npm run format       # Prettier 포맷팅
npm run test         # 단위 테스트
npm run test:e2e     # E2E 테스트
npm run test:cov     # 테스트 커버리지
```

### 빌드
```bash
npm run build        # 프로덕션 빌드
```

## Environment Variables
프로젝트 실행 전 `.env` 파일에 다음 환경변수들을 설정해야 합니다:

```env
# Application
PORT=3000
API_URL=http://localhost:3000
CLIENT_URL=otgit://

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/your-firebase-adminsdk.json
# OR
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# NCP SMS Configuration
NCP_ACCESS_KEY=your_ncp_access_key
NCP_SECRET_KEY=your_ncp_secret_key
NCP_SMS_SERVICE_ID=ncp:sms:kr:357155432756:otgit
NCP_SMS_FROM_NUMBER=01012345678
```

## Key Features

### 1. Location-Based Matching
- 사용자의 여행 사진 위치를 기반으로 근처 사용자 검색
- Haversine 공식으로 정확한 거리 계산
- 성별/나이 필터링
- 중복 검색 방지 (seen_users 테이블)

### 2. Multi-Tier Like System
- Like → Accept → Match → Chat 플로우
- 상호 좋아요 시 자동 매칭 생성
- 좋아요 승락 시 채팅방 자동 생성

### 3. Real-time Chat
- Socket.IO 기반 실시간 메시징
- 메시지 읽음 처리
- 안읽은 메시지 수 표시

### 4. Push Notifications
- Firebase Admin SDK 연동
- 매칭/메시지 알림
- 사용자별 타겟팅

### 5. Security Features
- Rate limiting (Throttler)
- JWT 토큰 인증
- 파일 업로드 검증
- 권한 기반 접근 제어

## Database Schema Key Tables
- `users`: 사용자 정보, 위치 데이터
- `profile_photos`: 프로필 사진
- `travel_photos`: 여행 사진 (위경도 포함)
- `likes`: 좋아요 관계
- `matches`: 매칭 정보
- `chat_rooms`: 채팅방
- `messages`: 메시지
- `seen_users`: 검색된 사용자 기록

## Testing Utilities
- `test-socket-client.js`: Socket.IO 클라이언트 테스트
- `generate-test-token.js`: JWT 토큰 생성 유틸리티

## Common Development Tasks

### 1. 새로운 API 엔드포인트 추가
1. 해당 모듈의 controller에 엔드포인트 추가
2. service에 비즈니스 로직 구현
3. DTO 클래스로 요청/응답 검증
4. 필요시 데이터베이스 스키마 업데이트

### 2. 데이터베이스 쿼리 디버깅
- Supabase 대시보드에서 SQL 직접 실행 가능
- `src/database/schema.sql` 참조

### 3. Socket.IO 테스트
```bash
node test-socket-client.js
```

### 4. JWT 토큰 생성 (테스트용)
```bash
node generate-test-token.js
```

### 5. NCP SMS 테스트
```bash
# 환경변수 설정 후
export NCP_ACCESS_KEY="your_access_key"
export NCP_SECRET_KEY="your_secret_key"  
export NCP_SMS_FROM_NUMBER="01012345678"

# SMS 전송 테스트
node test-ncp-sms.js
```

## Troubleshooting

### 1. 포트 3000 사용 중 오류
```bash
lsof -ti:3000 | xargs kill -9
```

### 2. Supabase 연결 오류
- `.env` 파일의 SUPABASE_URL, SUPABASE_ANON_KEY 확인
- Supabase 프로젝트 상태 확인

### 3. Firebase 설정 오류
- Firebase 서비스 계정 키 파일 경로 확인
- Firebase 프로젝트 설정 확인

### 4. 파일 업로드 오류
- Supabase Storage 버킷 권한 확인
- 파일 크기/형식 제한 확인

### 5. NCP SMS 전송 오류
- NCP_ACCESS_KEY, NCP_SECRET_KEY 확인
- SMS 서비스 활성화 및 발신번호 등록 확인
- 서비스 ID 형식 확인: ncp:sms:kr:357155432756:otgit

## Code Style Guidelines
- ESLint + Prettier 설정 준수
- NestJS 데코레이터 패턴 활용
- DTO 클래스로 데이터 검증
- 에러 핸들링은 HttpException 사용
- async/await 패턴 사용

## Performance Considerations
- 데이터베이스 쿼리 최적화 (인덱싱)
- 이미지 파일 압축/최적화
- Rate limiting으로 API 남용 방지
- 페이지네이션 구현

## Security Checklist
- JWT 토큰 만료 시간 설정
- 파일 업로드 검증 (크기, 형식)
- SQL Injection 방지 (parameterized queries)
- CORS 설정
- Rate limiting 활성화