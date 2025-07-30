# OTGIT API 🌍

여행 사진을 통한 위치 기반 데이팅 앱의 백엔드 API입니다.

## 📋 프로젝트 소개

OTGIT는 사용자들이 업로드한 여행 사진의 위치 정보를 기반으로 매칭되는 혁신적인 데이팅 플랫폼입니다. 단순한 프로필 기반 매칭을 넘어서, **실제 방문했던 장소**를 공유하는 사람들끼리 연결해주는 서비스입니다.

### ✨ 핵심 기능

- 🗺️ **위치 기반 매칭**: 여행 사진의 GPS 정보로 공통 관심사를 가진 사용자 발견
- 📱 **실시간 채팅**: Socket.IO 기반 실시간 메시징 시스템  
- 💌 **단계적 매칭**: 좋아요 → 승락 → 매칭 → 채팅의 자연스러운 플로우
- 🔔 **푸시 알림**: Firebase 기반 실시간 알림 시스템
- 🔐 **안전한 인증**: JWT + 전화번호 인증 + 소셜 로그인
- 📸 **이미지 최적화**: 프로필/여행 사진 별도 저장소 관리

## 🏗️ 기술 스택

- **Backend**: NestJS (Node.js + TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Real-time**: Socket.IO
- **Push Notifications**: Firebase Admin SDK  
- **Authentication**: JWT + Supabase Auth
- **Rate Limiting**: NestJS Throttler

## 🚀 빠른 시작

### 1. 프로젝트 클론 및 의존성 설치
```bash
git clone https://github.com/FlowSc/otgit-api.git
cd otgit-api
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 작성하세요:

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

# JWT Configuration  
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
```

### 3. 개발 서버 실행
```bash
npm run start:dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 🎯 주요 API 엔드포인트

### 🔐 인증
- `POST /auth/register` - 회원가입
- `POST /auth/login` - 로그인  
- `POST /auth/social-login` - 소셜 로그인 (Google, Apple)
- `POST /auth/verify-phone` - 전화번호 인증

### 📸 사진 관리
- `POST /photos/profile` - 프로필 사진 업로드
- `POST /photos/travel` - 여행 사진 업로드 (GPS 포함)
- `GET /photos/travel` - 여행 사진 목록 조회

### 💝 매칭 시스템
- `POST /photos/find-nearby-users` - 위치 기반 사용자 검색
- `POST /likes` - 좋아요 보내기
- `POST /likes/accept` - 좋아요 승락 (채팅방 자동 생성)
- `GET /likes/matches` - 매칭 목록 조회

### 💬 채팅
- `GET /chat/rooms` - 채팅방 목록
- `POST /chat/messages` - 메시지 전송
- `POST /chat/mark-read` - 메시지 읽음 처리

### 🔔 알림
- `POST /notifications/send` - 푸시 알림 전송

> 📚 **상세한 API 문서는 [API.md](./API.md)를 참고하세요.**

## 🎮 사용 플로우

### 1️⃣ 사용자 온보딩
```
회원가입 → 전화번호 인증 → 로그인 → 위치 설정
```

### 2️⃣ 프로필 설정  
```
프로필 사진 업로드 → 여행 사진 업로드 (GPS 포함)
```

### 3️⃣ 매칭 과정
```
근처 사용자 검색 → 좋아요 전송 → 상대방 승락 → 채팅방 생성
```

### 4️⃣ 소통
```
실시간 채팅 → 푸시 알림 → 오프라인 만남
```

## 🏗️ 아키텍처

### 모듈 구조
```
src/
├── auth/           # 인증 모듈
├── photos/         # 사진 관리 모듈  
├── likes/          # 좋아요/매칭 모듈
├── chat/           # 채팅 모듈
├── notifications/  # 알림 모듈
├── config/         # 설정 파일들
└── database/       # 데이터베이스 스키마
```

### 데이터베이스 설계
- **users**: 사용자 정보 및 위치 데이터
- **profile_photos**: 프로필 사진
- **travel_photos**: 여행 사진 (GPS 좌표 포함)
- **likes**: 좋아요 관계  
- **matches**: 매칭 정보
- **chat_rooms**: 채팅방
- **messages**: 메시지

## 🛠️ 개발 명령어

```bash
# 개발 서버 실행
npm run start:dev

# 프로덕션 빌드
npm run build

# 테스트 실행
npm run test

# 코드 린팅
npm run lint

# 코드 포맷팅  
npm run format
```

## 🧪 테스트

### Socket.IO 클라이언트 테스트
```bash
node test-socket-client.js
```

### JWT 토큰 생성 (개발용)
```bash
node generate-test-token.js
```

## 🔒 보안 기능

- **Rate Limiting**: API 요청 속도 제한
- **JWT 인증**: 안전한 토큰 기반 인증
- **파일 검증**: 업로드 파일 크기/형식 검증
- **CORS 설정**: 허용된 도메인만 접근
- **전화번호 인증**: SMS 기반 본인 확인

## 📊 성능 최적화

- **이미지 저장소 분리**: 프로필/여행 사진 별도 버킷
- **데이터베이스 인덱싱**: 위치 검색 쿼리 최적화
- **페이지네이션**: 대용량 데이터 효율적 로딩
- **캐싱**: 자주 조회되는 데이터 캐시

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면:

- Issues: [GitHub Issues](https://github.com/FlowSc/otgit-api/issues)
- Email: support@otgit.com

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

---

**OTGIT** - 여행으로 시작되는 새로운 만남 🌟