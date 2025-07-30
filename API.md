# Otgit API Documentation

## General Endpoints

### 0. 서버 상태 확인 (Health Check)
```
GET /
```

**Response:**
```
Hello World!
```

**특징:**
- 서버 동작 상태 확인용 기본 엔드포인트
- 헬스체크나 간단한 연결 테스트에 사용

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
# 회원가입 전 전화번호 인증
# 1. 인증코드 전송
curl -X POST http://localhost:3000/auth/send-presignup-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"010-1234-5678"}'

# 2. 인증코드 검증
curl -X POST http://localhost:3000/auth/verify-presignup-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"010-1234-5678","code":"123456"}'

# 3. 회원가입 (인증 완료 후)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","phone":"010-1234-5678","gender":"male","age":25}'

# 이메일 중복 검증
curl -X POST http://localhost:3000/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 닉네임 중복 검증
curl -X POST http://localhost:3000/auth/check-name \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User"}'

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

### 17. 사용자 위치 업데이트
```
POST /auth/update-location
```

**Request Body:**
```json
{
  "user_id": "current-user-uuid",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "location_name": "서울특별시 종로구"
}
```

**Response:**
```json
{
  "latitude": 37.5665,
  "longitude": 126.9780,
  "location_name": "서울특별시 종로구",
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

### 18. 사용자 위치 조회
```
GET /auth/location/:userId
```

**Response:**
```json
{
  "latitude": 37.5665,
  "longitude": 126.9780,
  "location_name": "서울특별시 종로구", 
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

위치 정보가 없는 경우 `null` 반환

### 11. 이메일 중복 검증
```
POST /auth/check-email
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "is_duplicate": false,
  "available": true,
  "message": "Email is available"
}
```

**특징:**
- 회원가입 전 이메일 사용 가능 여부 확인
- 중복된 이메일이면 `is_duplicate: true`, `available: false`
- Rate limiting: 1초에 3번, 1분에 10번
- 유효한 이메일 형식 검증 포함

### 12. 닉네임(이름) 중복 검증
```
POST /auth/check-name
```

**Request Body:**
```json
{
  "name": "사용자"
}
```

**Response:**
```json
{
  "name": "사용자",
  "is_duplicate": true,
  "available": false,
  "message": "Name is already in use"
}
```

**특징:**
- 회원가입 전 닉네임 사용 가능 여부 확인
- 중복된 닉네임이면 `is_duplicate: true`, `available: false`
- Rate limiting: 1초에 3번, 1분에 10번
- 빈 문자열 및 null 값 방지

## 사용 플로우

### 새로운 회원가입 플로우 (전화번호 인증 선행):
1. `POST /auth/check-email` - 이메일 중복 검증 (선택적)
2. `POST /auth/check-name` - 닉네임 중복 검증 (선택적)
3. `POST /auth/send-presignup-verification-code` - 회원가입 전 전화번호 인증 코드 전송
4. `POST /auth/verify-presignup-phone` - 회원가입 전 전화번호 인증 완료
5. `POST /auth/register` - 회원가입 (인증된 번호만 가능)
6. `POST /auth/login` - 로그인
7. `POST /auth/update-location` - 현재 위치 업데이트

### 기존 사용자 전화번호 인증 플로우 (회원가입 후):
1. `POST /auth/send-verification-code` - 전화번호 인증 코드 전송
2. `POST /auth/verify-phone` - 전화번호 인증 완료

### 소셜 로그인 플로우:
1. `POST /auth/social-login` - 소셜 로그인 URL 받기
2. 사용자가 소셜 로그인 완료
3. `GET /auth/callback` - OAuth 콜백 처리 (자동)
4. 클라이언트 앱으로 리다이렉트
5. `POST /auth/update-location` - 현재 위치 업데이트

## Photo Upload Endpoints

**📦 Storage Structure:**
- **프로필 사진**: `profile-photos` 버킷 (최대 5MB, JPEG/PNG/WebP)
- **여행 사진**: `travel-photos` 버킷 (최대 10MB, JPEG/PNG/GIF/WebP)

각 버킷은 독립적인 정책과 최적화를 가지고 있어 보안성과 성능을 향상시킵니다.

### 7. 프로필 사진 업로드
```
POST /photos/profile
```

**Request:**
- Content-Type: `multipart/form-data`
- `file`: 이미지 파일 (JPEG, PNG, WebP - 최대 5MB)
- `user_id`: 사용자 ID (임시, 나중에 JWT로 대체)

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "file_url": "https://your-project.supabase.co/storage/v1/object/public/profile-photos/user-id/timestamp-filename",
  "file_name": "profile.jpg",
  "file_size": 524288,
  "mime_type": "image/jpeg",
  "storage_path": "user-id/timestamp-filename",
  "is_active": true,
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

### 8. 프로필 사진 조회
```
GET /photos/profile/:userId
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "file_url": "https://...",
  "file_name": "profile.jpg",
  "file_size": 524288,
  "mime_type": "image/jpeg",
  "is_active": true,
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

### 9. 프로필 사진 삭제
```
DELETE /photos/profile/:userId
```

**Response:**
```json
{
  "message": "Profile photo deleted successfully"
}
```

### 10. 여행 사진 업로드
```
POST /photos/travel
```

**Request:**
- Content-Type: `multipart/form-data`
- `file`: 이미지 파일 (JPEG, PNG, GIF, WebP - 최대 10MB)
- `user_id`: 사용자 ID (임시, 나중에 JWT로 대체)
- `latitude`: 위도 (-90 ~ 90) **필수**
- `longitude`: 경도 (-180 ~ 180) **필수**
- `title`: 제목 (선택)
- `description`: 설명 (선택)
- `location_name`: 장소명 (선택)
- `taken_at`: 촬영 시간 (ISO 8601 형식, 선택)
- `is_public`: 공개 여부 (기본값: true)

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "file_url": "https://your-project.supabase.co/storage/v1/object/public/travel-photos/user-id/timestamp-filename",
  "file_name": "travel.jpg",
  "file_size": 1048576,
  "mime_type": "image/jpeg",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "title": "서울 여행",
  "description": "경복궁에서 찍은 사진",
  "location_name": "경복궁",
  "taken_at": "2025-07-30T12:00:00.000Z",
  "is_public": true,
  "is_deleted": false,
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

### 11. 여행 사진 목록 조회
```
GET /photos/travel
```

**Query Parameters:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20, 최대: 100)
- `user_id`: 특정 사용자의 사진만 조회
- `is_public`: 공개 사진만 조회 (true/false)
- `min_latitude`, `max_latitude`, `min_longitude`, `max_longitude`: 바운딩 박스 검색
- `center_latitude`, `center_longitude`, `radius_km`: 반경 검색

**Response:**
```json
{
  "photos": [
    {
      "id": "uuid",
      "user_id": "user-uuid",
      "file_url": "https://...",
      "latitude": 37.5665,
      "longitude": 126.9780,
      "title": "서울 여행",
      "description": "경복궁에서 찍은 사진",
      "location_name": "경복궁",
      "is_public": true,
      "created_at": "2025-07-30T12:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20
}
```

### 12. 여행 사진 상세 조회
```
GET /photos/travel/:photoId
```

### 13. 여행 사진 수정
```
PUT /photos/travel/:photoId
```

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "title": "수정된 제목",
  "description": "수정된 설명",
  "location_name": "수정된 장소명",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "is_public": false
}
```

### 14. 여행 사진 삭제 (소프트 삭제)
```
DELETE /photos/travel/:photoId
```

**Request Body:**
```json
{
  "user_id": "user-uuid"
}
```

### 15. 근처 여행 사진 검색
```
GET /photos/travel/search/nearby?latitude=37.5665&longitude=126.9780&radius_km=10&limit=20&is_public=true
```

**Response:**
```json
{
  "photos": [...],
  "total": 15
}
```

### 사용 예시

#### 프로필 사진 업로드:
```bash
curl -X POST http://localhost:3000/photos/profile \
  -F "file=@profile.jpg" \
  -F "user_id=user-uuid-here"
```

#### 여행 사진 업로드:
```bash
curl -X POST http://localhost:3000/photos/travel \
  -F "file=@travel.jpg" \
  -F "user_id=user-uuid-here" \
  -F "latitude=37.5665" \
  -F "longitude=126.9780" \
  -F "title=서울 여행" \
  -F "description=경복궁에서 찍은 사진" \
  -F "location_name=경복궁" \
  -F "is_public=true"
```

## Matching Endpoints

### 16. 내 사진 위치 기반 다른 성별 사용자 검색
```
POST /photos/find-nearby-users
```

이 API는 현재 사용자가 업로드한 여행 사진들의 위치를 기준으로, 반경 내에 사진을 가지고 있는 다른 성별의 사용자들을 찾습니다.

**Request Body:**
```json
{
  "user_id": "current-user-uuid",
  "radius_km": 10,
  "min_age": 20,
  "max_age": 35,
  "page": 1,
  "limit": 20,
  "include_profile_photo": true,
  "include_travel_photos": true,
  "include_direct_distance": true,
  "include_last_location": false
}
```

**Parameters:**
- `user_id`: 검색 기준 사용자 ID **필수**
- `radius_km`: 검색 반경 (km, 기본값: 10, 최대: 100)
- `min_age`: 최소 나이 (18~100, 선택)
- `max_age`: 최대 나이 (18~100, 선택)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20, 최대: 50)
- `include_profile_photo`: 프로필 사진 포함 여부 (기본값: true)
- `include_travel_photos`: 여행 사진 포함 여부 (기본값: true)
- `include_direct_distance`: 사용자 간 직접 거리 포함 여부 (기본값: true)
- `include_last_location`: 상대방 마지막 위치 정보 포함 여부 (기본값: false)

**Response:**
```json
{
  "users": [
    {
      "id": "other-user-uuid",
      "name": "김민지",
      "age": 26,
      "gender": "female",
      "profile_photo": {
        "id": "profile-photo-uuid",
        "file_url": "https://...",
        "file_name": "profile.jpg",
        "created_at": "2025-07-30T12:00:00.000Z"
      },
      "travel_photos": [
        {
          "id": "travel-photo-uuid",
          "file_url": "https://...",
          "file_name": "travel.jpg",
          "latitude": 37.5665,
          "longitude": 126.9780,
          "title": "서울 여행",
          "description": "경복궁에서",
          "location_name": "경복궁",
          "taken_at": "2025-07-29T10:00:00.000Z",
          "created_at": "2025-07-30T12:00:00.000Z"
        }
      ],
      "common_locations_count": 3,
      "closest_distance_km": 2.54,
      "direct_distance_km": 5.32,
      "last_location": {
        "latitude": 37.5500,
        "longitude": 126.9900,
        "location_name": "서울특별시 중구",
        "updated_at": "2025-07-30T11:30:00.000Z"
      }
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "user_photos_count": 5,
  "search_radius_km": 10,
  "age_filter": {
    "min_age": 20,
    "max_age": 35
  }
}
```

**Response Fields:**
- `users`: 매칭된 사용자 목록 (가까운 거리 순 정렬)
- `common_locations_count`: 반경 내 공통 위치 사진 개수
- `closest_distance_km`: 가장 가까운 사진과의 거리 (km)
- `direct_distance_km`: 사용자 간 직접 거리 (km, 양쪽 위치 정보가 있을 때만)
- `last_location`: 상대방의 마지막 위치 정보 (include_last_location=true일 때만)
- `user_photos_count`: 검색 기준 사용자의 공개 여행 사진 개수
- `search_radius_km`: 검색에 사용된 반경
- `age_filter`: 적용된 나이 필터 정보 (설정된 경우만 표시)

**특징:**
- **성별 필터링**: 검색 사용자와 다른 성별만 결과에 포함
- **나이 필터링**: 원하는 나이대 사용자만 검색 가능
- **거리 기반 정렬**: 가장 가까운 거리 순으로 정렬
- **정확한 거리 계산**: Haversine 공식 사용하여 정확한 거리 계산
- **사용자 간 직접 거리**: 현재 위치 기반 실시간 거리 계산
- **위치 캐싱**: 마지막 위치 정보를 데이터베이스에 저장
- **효율적인 검색**: 사용자의 모든 사진 위치를 고려하여 매칭
- **프라이버시 보호**: 공개 설정된 사진만 검색 대상

### 사용 예시

#### 사용자 위치 업데이트:
```bash
curl -X POST http://localhost:3000/auth/update-location \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "current-user-uuid",
    "latitude": 37.5665,
    "longitude": 126.9780,
    "location_name": "서울특별시 종로구"
  }'
```

#### 근처 사용자 검색 (직접 거리 포함):
```bash
curl -X POST http://localhost:3000/photos/find-nearby-users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "current-user-uuid",
    "radius_km": 15,
    "min_age": 22,
    "max_age": 32,
    "page": 1,
    "limit": 10,
    "include_profile_photo": true,
    "include_travel_photos": true,
    "include_direct_distance": true,
    "include_last_location": false
  }'
```

#### 나이 필터 없이 검색:
```bash
curl -X POST http://localhost:3000/photos/find-nearby-users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "current-user-uuid",
    "radius_km": 10
  }'
```

#### 최소 나이만 설정:
```bash
curl -X POST http://localhost:3000/photos/find-nearby-users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "current-user-uuid",
    "radius_km": 20,
    "min_age": 25
  }'
```

**매칭 로직:**
1. 현재 사용자의 모든 공개 여행 사진 위치 수집
2. 이미 검색된 사용자들 제외 (seen_users 테이블 확인)
3. 다른 성별 사용자들의 공개 여행 사진 조회 (나이 필터 적용)
4. 각 사진 간 거리 계산 (Haversine 공식)
5. 반경 내 사진을 가진 사용자들 필터링
6. 검색된 사용자들을 seen_users 테이블에 기록
7. 가장 가까운 거리 순으로 정렬하여 반환

## Likes & Matching Endpoints

### 19. 좋아요 보내기
```
POST /likes
```

**Request Body:**
```json
{
  "sender_id": "current-user-uuid",
  "receiver_id": "target-user-uuid"
}
```

**Response:**
```json
{
  "id": "like-uuid",
  "sender_id": "current-user-uuid",
  "receiver_id": "target-user-uuid",
  "created_at": "2025-07-30T12:00:00.000Z",
  "is_match": true
}
```

**특징:**
- 중복 좋아요 방지 (409 Conflict 반환)
- 자기 자신에게 좋아요 방지
- 좋아요 상태: `pending` (대기), `accepted` (승락), `rejected` (거절)
- 상호 좋아요 시 자동 매칭 생성
- `is_match: true`일 때 매칭 성사

### 20. 좋아요 목록 조회
```
GET /likes?user_id=uuid&type=received&page=1&limit=20
```

**Query Parameters:**
- `user_id`: 사용자 ID **필수**
- `type`: 조회 타입 (`sent` | `received`, 기본값: `received`)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20)

**Response:**
```json
{
  "likes": [
    {
      "id": "like-uuid",
      "sender_id": "sender-uuid",
      "receiver_id": "receiver-uuid",
      "created_at": "2025-07-30T12:00:00.000Z",
      "status": "pending",
      "responded_at": null,
      "user": {
        "id": "other-user-uuid",
        "name": "김민지",
        "age": 26,
        "gender": "female",
        "profile_photo": {
          "id": "photo-uuid",
          "file_url": "https://...",
          "file_name": "profile.jpg"
        }
      },
      "is_match": true
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "type": "received"
}
```

### 21. 매칭 목록 조회
```
GET /likes/matches?user_id=uuid&active_only=true&page=1&limit=20
```

**Query Parameters:**
- `user_id`: 사용자 ID **필수**
- `active_only`: 활성 매칭만 조회 (기본값: true)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20)

**Response:**
```json
{
  "matches": [
    {
      "id": "match-uuid",
      "user1_id": "user1-uuid",
      "user2_id": "user2-uuid",
      "matched_at": "2025-07-30T12:00:00.000Z",
      "is_active": true,
      "other_user": {
        "id": "other-user-uuid",
        "name": "김민지",
        "age": 26,
        "gender": "female",
        "profile_photo": {
          "id": "photo-uuid",
          "file_url": "https://...",
          "file_name": "profile.jpg"
        }
      }
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

### 사용 예시

#### 좋아요 보내기:
```bash
curl -X POST http://localhost:3000/likes \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "current-user-uuid",
    "receiver_id": "target-user-uuid"
  }'
```

#### 받은 좋아요 조회:
```bash
curl -X GET "http://localhost:3000/likes?user_id=current-user-uuid&type=received&page=1&limit=10"
```

#### 보낸 좋아요 조회:
```bash
curl -X GET "http://localhost:3000/likes?user_id=current-user-uuid&type=sent&page=1&limit=10"
```

#### 매칭 목록 조회:
```bash
curl -X GET "http://localhost:3000/likes/matches?user_id=current-user-uuid&active_only=true&page=1&limit=10"
```

### 22. 좋아요 승락 (채팅방 생성)
```
POST /likes/accept
```

**Request Body:**
```json
{
  "like_id": "like-uuid",
  "user_id": "receiver-user-uuid"
}
```

**Response:**
```json
{
  "like": {
    "id": "like-uuid",
    "sender_id": "sender-uuid",
    "receiver_id": "receiver-uuid",
    "created_at": "2025-07-30T12:00:00.000Z",
    "status": "accepted",
    "responded_at": "2025-07-30T12:05:00.000Z"
  },
  "chat_room": {
    "id": "chatroom-uuid",
    "user1_id": "user1-uuid",
    "user2_id": "user2-uuid",
    "created_at": "2025-07-30T12:05:00.000Z"
  },
  "message": "Like accepted successfully! Chat room created."
}
```

**특징:**
- 받은 좋아요만 승락 가능
- 승락 시 자동으로 채팅방 생성
- 매칭 테이블에도 자동 등록
- 이미 응답한 좋아요는 승락 불가

## Chat System Endpoints

### 23. 채팅방 생성
```
POST /chat/rooms
```

**Request Body:**
```json
{
  "user1_id": "user1-uuid",
  "user2_id": "user2-uuid"
}
```

**Response:**
```json
{
  "id": "chatroom-uuid",
  "user1_id": "user1-uuid",
  "user2_id": "user2-uuid",
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T12:00:00.000Z",
  "is_active": true
}
```

**특징:**
- 수동으로 채팅방 생성 가능
- 중복 채팅방 생성 방지
- 좋아요 승락 시 자동 생성되는 경우가 대부분

### 24. 채팅방 목록 조회
```
GET /chat/rooms?user_id=uuid&page=1&limit=20
```

**Query Parameters:**
- `user_id`: 사용자 ID **필수**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20)

**Response:**
```json
{
  "rooms": [
    {
      "id": "chatroom-uuid",
      "user1_id": "user1-uuid",
      "user2_id": "user2-uuid",
      "created_at": "2025-07-30T12:00:00.000Z",
      "updated_at": "2025-07-30T12:30:00.000Z",
      "is_active": true,
      "other_user": {
        "id": "other-user-uuid",
        "name": "김민지",
        "age": 26,
        "gender": "female",
        "profile_photo": {
          "id": "photo-uuid",
          "file_url": "https://...",
          "file_name": "profile.jpg"
        }
      },
      "last_message": {
        "id": "message-uuid",
        "message_text": "안녕하세요!",
        "sender_id": "sender-uuid",
        "created_at": "2025-07-30T12:30:00.000Z",
        "message_type": "text"
      },
      "unread_count": 3
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

### 25. 메시지 전송
```
POST /chat/messages
```

**Request Body:**
```json
{
  "chat_room_id": "chatroom-uuid",
  "sender_id": "sender-uuid",
  "message_text": "안녕하세요!",
  "message_type": "text"
}
```

**Response:**
```json
{
  "id": "message-uuid",
  "chat_room_id": "chatroom-uuid",
  "sender_id": "sender-uuid",
  "message_text": "안녕하세요!",
  "message_type": "text",
  "is_read": false,
  "created_at": "2025-07-30T12:30:00.000Z",
  "updated_at": "2025-07-30T12:30:00.000Z",
  "sender": {
    "id": "sender-uuid",
    "name": "홍길동",
    "profile_photo": {
      "id": "photo-uuid",
      "file_url": "https://...",
      "file_name": "profile.jpg"
    }
  }
}
```

### 26. 메시지 목록 조회
```
GET /chat/messages?chat_room_id=uuid&user_id=uuid&page=1&limit=50
```

**Query Parameters:**
- `chat_room_id`: 채팅방 ID **필수**
- `user_id`: 사용자 ID (권한 확인용) **필수**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 50)

### 27. 메시지 읽음 처리
```
POST /chat/mark-read
```

**Request Body:**
```json
{
  "chat_room_id": "chatroom-uuid",
  "user_id": "user-uuid",
  "message_id": "message-uuid"
}
```

**Response:**
```json
{
  "message": "Messages marked as read successfully"
}
```

### 28. 온라인 사용자 목록 조회
```
GET /chat/online-users
```

**Response:**
```json
{
  "success": true,
  "online_users": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
  "count": 3
}
```

**특징:**
- WebSocket에 연결된 사용자들의 ID 목록 반환
- 실시간으로 업데이트되는 온라인 상태 확인 가능

### 29. 특정 사용자 온라인 상태 확인
```
GET /chat/user/:userId/online
```

**Response:**
```json
{
  "success": true,
  "user_id": "user-uuid",
  "is_online": true
}
```

**특징:**
- 특정 사용자의 현재 온라인 상태 확인
- 채팅 UI에서 상대방 온라인 표시에 활용

### 사용 예시

#### 채팅방 생성:
```bash
curl -X POST http://localhost:3000/chat/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "user1_id": "user1-uuid",
    "user2_id": "user2-uuid"
  }'
```

#### 좋아요 승락:
```bash
curl -X POST http://localhost:3000/likes/accept \
  -H "Content-Type: application/json" \
  -d '{
    "like_id": "like-uuid",
    "user_id": "receiver-user-uuid"
  }'
```

#### 채팅방 목록 조회:
```bash
curl -X GET "http://localhost:3000/chat/rooms?user_id=current-user-uuid&page=1&limit=10"
```

#### 메시지 전송:
```bash
curl -X POST http://localhost:3000/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "chat_room_id": "chatroom-uuid",
    "sender_id": "sender-uuid",
    "message_text": "안녕하세요!",
    "message_type": "text"
  }'
```

#### 온라인 사용자 확인:
```bash
curl -X GET "http://localhost:3000/chat/online-users"
```

#### 특정 사용자 온라인 상태:
```bash
curl -X GET "http://localhost:3000/chat/user/user-uuid/online"
```

## 전체 사용 플로우

### 데이팅 앱 전체 플로우:
1. **회원가입 & 인증**
   - `POST /auth/check-email` - 이메일 중복 검증 (선택적)
   - `POST /auth/check-name` - 닉네임 중복 검증 (선택적)
   - `POST /auth/send-presignup-verification-code` - 회원가입 전 전화번호 인증 코드 전송
   - `POST /auth/verify-presignup-phone` - 회원가입 전 전화번호 인증 완료
   - `POST /auth/register` - 회원가입 (인증된 번호만 가능)

2. **로그인 & 위치 설정**
   - `POST /auth/login` - 로그인 (JWT 토큰 발급)
   - `POST /auth/update-location` - 현재 위치 업데이트

3. **프로필 설정**
   - `POST /photos/profile` - 프로필 사진 업로드

4. **여행 사진 업로드**
   - `POST /photos/travel` - 여행 사진 업로드 (위경도 포함)

5. **매칭 & 좋아요**
   - `POST /photos/find-nearby-users` - 근처 사용자 검색
   - `POST /likes` - 마음에 드는 사용자에게 좋아요 전송
   - `GET /likes?type=received` - 받은 좋아요 확인
   - `POST /likes/accept` - 받은 좋아요 승락 (채팅방 자동 생성)
   - `GET /likes/matches` - 매칭된 사용자 목록 확인

6. **채팅**
   - `GET /chat/rooms` - 채팅방 목록 조회
   - `POST /chat/messages` - 메시지 전송
   - `GET /chat/messages` - 메시지 목록 조회
   - `POST /chat/mark-read` - 메시지 읽음 처리

### 핵심 특징:
- **중복 방지**: 한번 검색된 사용자는 다시 검색되지 않음
- **좋아요 승락 시스템**: 좋아요 승락 시 자동 채팅방 생성
- **실시간 채팅**: 메시지 전송, 읽음 처리, 안읽은 메시지 수 표시
- **자동 매칭**: 상호 좋아요 시 자동으로 매칭 생성
- **위치 기반**: 여행 사진 위치와 현재 위치 모두 고려
- **프라이버시**: 공개 설정된 사진만 매칭에 사용

## Push Notifications Endpoints

### 30. FCM 토큰 등록
```
POST /notifications/register-token
```

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "token": "FCM-token-string",
  "device_type": "ios", // "ios" | "android" | "web"
  "device_id": "device-unique-id", // Optional
  "app_version": "1.0.0" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token registered successfully"
}
```

**특징:**
- 사용자 디바이스의 FCM 토큰을 서버에 등록
- 디바이스 타입별로 관리 (iOS, Android, Web)
- 동일 디바이스의 토큰 중복 등록 방지
- Rate limiting: 1초에 2번만 허용

### 31. FCM 토큰 비활성화
```
POST /notifications/deactivate-token
```

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "token": "FCM-token-string", // Optional
  "device_id": "device-unique-id" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token deactivated successfully"
}
```

**특징:**
- 로그아웃 시 푸시 알림 비활성화
- 토큰 또는 디바이스 ID로 비활성화 가능
- Rate limiting: 1초에 3번만 허용

### 32. 푸시 알림 전송 (테스트용)
```
POST /notifications/send
```

**Request Body:**
```json
{
  "user_id": "receiver-user-uuid",
  "title": "새로운 메시지",
  "body": "김민지님이 메시지를 보냈습니다",
  "data": {
    "type": "chat",
    "chat_room_id": "chatroom-uuid"
  },
  "type": "new_message" // "new_message" | "new_match" | "new_like" | "chat_message" | "system"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

**특징:**
- 특정 사용자에게 푸시 알림 전송
- 알림 타입별 구분 가능
- 추가 데이터 전달 가능 (딥링크 등)
- Rate limiting: 1분에 10번만 허용

### 33. 알림 설정 조회
```
GET /notifications/settings/:userId
```

**Response:**
```json
{
  "user_id": "user-uuid",
  "new_messages": true,
  "new_matches": true,
  "new_likes": true,
  "chat_messages": true,
  "marketing": false,
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T12:00:00.000Z"
}
```

**특징:**
- 사용자별 알림 설정 조회
- 설정이 없으면 기본값으로 자동 생성
- 알림 카테고리별 설정 가능

### 34. 알림 설정 업데이트
```
POST /notifications/settings
```

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "new_messages": true, // Optional
  "new_matches": true, // Optional
  "new_likes": false, // Optional
  "chat_messages": true, // Optional
  "marketing": false // Optional
}
```

**Response:**
```json
{
  "user_id": "user-uuid",
  "new_messages": true,
  "new_matches": true,
  "new_likes": false,
  "chat_messages": true,
  "marketing": false,
  "created_at": "2025-07-30T12:00:00.000Z",
  "updated_at": "2025-07-30T13:00:00.000Z"
}
```

**특징:**
- 부분 업데이트 가능 (원하는 설정만)
- upsert 방식으로 처리 (없으면 생성, 있으면 업데이트)
- Rate limiting: 1초에 5번만 허용

### 35. 사용자 등록 토큰 목록 조회
```
GET /notifications/tokens/:userId
```

**Response:**
```json
[
  {
    "id": "token-uuid",
    "user_id": "user-uuid",
    "token": "FCM-token-string",
    "device_type": "ios",
    "device_id": "device-unique-id",
    "app_version": "1.0.0",
    "is_active": true,
    "created_at": "2025-07-30T12:00:00.000Z",
    "updated_at": "2025-07-30T12:00:00.000Z"
  }
]
```

**특징:**
- 사용자의 활성화된 모든 토큰 조회
- 멀티 디바이스 지원
- 최신 등록 순으로 정렬

### 36. 알림 히스토리 조회
```
GET /notifications/history/:userId?page=1&limit=20
```

**Query Parameters:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notification-uuid",
      "user_id": "user-uuid",
      "title": "새로운 매칭!",
      "body": "김민지님과 매칭되었습니다",
      "data": {
        "type": "match",
        "match_id": "match-uuid"
      },
      "notification_type": "new_match",
      "is_sent": true,
      "sent_at": "2025-07-30T12:00:00.000Z",
      "error_message": null,
      "created_at": "2025-07-30T12:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**특징:**
- 전송된 알림 이력 확인
- 성공/실패 여부 및 에러 메시지 포함
- 페이지네이션 지원

### 37. 특정 토큰 삭제
```
DELETE /notifications/tokens/:tokenId
```

**Response:**
```json
{
  "success": true,
  "message": "Token deleted successfully"
}
```

**특징:**
- 특정 토큰을 비활성화 (소프트 삭제)
- 디바이스 변경이나 앱 재설치 시 사용

### 38. 알림 서비스 상태 확인
```
GET /notifications/status
```

**Response:**
```json
{
  "firebase_initialized": true,
  "service_status": "running",
  "timestamp": "2025-07-30T12:00:00.000Z"
}
```

**특징:**
- Firebase 초기화 상태 확인
- 알림 서비스 정상 작동 여부 확인
- 서버 헬스체크용

### 사용 예시

#### FCM 토큰 등록:
```bash
curl -X POST http://localhost:3000/notifications/register-token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "token": "FCM-token-string",
    "device_type": "ios",
    "device_id": "iPhone-12345",
    "app_version": "1.0.0"
  }'
```

#### 알림 설정 업데이트:
```bash
curl -X POST http://localhost:3000/notifications/settings \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "new_likes": false,
    "marketing": true
  }'
```

#### 테스트 알림 전송:
```bash
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "receiver-uuid",
    "title": "새로운 좋아요!",
    "body": "누군가 당신을 좋아합니다",
    "type": "new_like",
    "data": {
      "sender_id": "sender-uuid"
    }
  }'
```

## 에러 코드
- `400 Bad Request`: 잘못된 요청 데이터, 잘못된 인증 코드, 파일 형식 오류, 자기 자신에게 좋아요
- `401 Unauthorized`: 인증 실패
- `404 Not Found`: 사진을 찾을 수 없음, 사용자를 찾을 수 없음
- `409 Conflict`: 이미 존재하는 이메일/전화번호, 중복 좋아요
- `500 Internal Server Error`: 서버 내부 오류