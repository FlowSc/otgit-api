# Otgit API Documentation

## Authentication Endpoints

### 1. 회원가입 (Register)
```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "사용자 이름",
  "phone": "010-1234-5678", 
  "gender": "male", // "male" | "female"
  "age": 25
}
```

**Response:**
```json
{
  "message": "User registered successfully. Please verify your phone number.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "사용자 이름",
    "phone": "010-1234-5678",
    "gender": "male",
    "age": 25,
    "created_at": "2025-07-30T02:00:51.232417+00:00"
  }
}
```

### 2. 로그인 (Login)
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "사용자 이름",
    "phone": "010-1234-5678",
    "gender": "male",
    "age": 25
  },
  "access_token": "jwt_token",
  "refresh_token": "refresh_token"
}
```

### 3. 소셜 로그인 시작 (Social Login)
```
POST /auth/social-login
```

**Request Body:**
```json
{
  "provider": "google", // "google" | "apple"
  "redirectTo": "http://localhost:3000/auth/callback" // Optional
}
```

**Response:**
```json
{
  "url": "https://accounts.google.com/oauth/authorize?...",
  "provider": "google",
  "message": "Redirecting to google login..."
}
```

### 4. OAuth 콜백 (OAuth Callback)
```
GET /auth/callback?code=authorization_code&state=state_value
```

이 엔드포인트는 소셜 로그인 제공자가 호출하며, 성공 시 클라이언트 앱으로 리다이렉트합니다.

**Success Redirect:**
```
otgit://auth/success?access_token=jwt_token&refresh_token=refresh_token
```

**Error Redirect:**
```
otgit://auth/error?message=error_message
```

## 설정 방법

### 1. 환경 변수 설정
`.env` 파일에 다음 변수들을 설정하세요:

```env
PORT=3000
API_URL=http://localhost:3000
CLIENT_URL=otgit://

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase OAuth 설정

#### Google OAuth 설정:
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI에 `https://your-project.supabase.co/auth/v1/callback` 추가
4. Supabase 대시보드 > Authentication > Providers > Google에서 Client ID와 Client Secret 설정

#### Apple OAuth 설정:
1. [Apple Developer](https://developer.apple.com/)에서 App ID와 Service ID 생성
2. Sign in with Apple 구성
3. Supabase 대시보드 > Authentication > Providers > Apple에서 설정

### 3. 데이터베이스 스키마
사용자 테이블이 이미 생성되어 있으며, 소셜 로그인 사용자의 경우 `password_hash`가 빈 문자열로 저장됩니다.

## 사용 예시

### cURL로 테스트
```bash
# 회원가입
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","phone":"010-1234-5678","gender":"male","age":25}'

# 로그인  
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 구글 로그인 시작
curl -X POST http://localhost:3000/auth/social-login \
  -H "Content-Type: application/json" \
  -d '{"provider":"google"}'
```

### 5. 전화번호 인증 코드 전송
```
POST /auth/send-verification-code
```

**Request Body:**
```json
{
  "phone": "010-1234-5678"
}
```

**Response:**
```json
{
  "message": "Verification code sent successfully",
  "expires_in_minutes": 5
}
```

### 6. 전화번호 인증 코드 검증
```
POST /auth/verify-phone
```

**Request Body:**
```json
{
  "phone": "010-1234-5678",
  "code": "123456"
}
```

**Response:**
```json
{
  "message": "Phone number verified successfully",
  "verified": true
}
```

## 사용 플로우

### 일반 회원가입 플로우:
1. `POST /auth/register` - 회원가입
2. `POST /auth/send-verification-code` - 전화번호 인증 코드 전송
3. `POST /auth/verify-phone` - 전화번호 인증 완료
4. `POST /auth/login` - 로그인

### 소셜 로그인 플로우:
1. `POST /auth/social-login` - 소셜 로그인 URL 받기
2. 사용자가 소셜 로그인 완료
3. `GET /auth/callback` - OAuth 콜백 처리 (자동)
4. 클라이언트 앱으로 리다이렉트

## 에러 코드
- `400 Bad Request`: 잘못된 요청 데이터, 잘못된 인증 코드
- `401 Unauthorized`: 인증 실패
- `409 Conflict`: 이미 존재하는 이메일 또는 전화번호
- `500 Internal Server Error`: 서버 내부 오류