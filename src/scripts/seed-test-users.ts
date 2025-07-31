import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 서울 주요 지역 좌표
const seoulLocations = [
  { name: '강남역', lat: 37.4979, lng: 127.0276 },
  { name: '홍대입구', lat: 37.5563, lng: 126.9222 },
  { name: '명동', lat: 37.5636, lng: 126.9869 },
  { name: '인사동', lat: 37.5732, lng: 126.9874 },
  { name: '이태원', lat: 37.5347, lng: 126.9945 },
  { name: '성수동', lat: 37.5447, lng: 127.0557 },
  { name: '북촌한옥마을', lat: 37.5826, lng: 126.9831 },
  { name: '남산타워', lat: 37.5512, lng: 126.9882 },
  { name: '한강공원', lat: 37.5283, lng: 126.9294 },
  { name: '경복궁', lat: 37.5796, lng: 126.977 },
];

// 테스트 사용자 데이터
const testUsers = [
  // 남성 사용자 5명
  {
    name: '김민준',
    email: 'minjun@test.com',
    phone: '010-1111-0001',
    gender: 'male',
    age: 28,
    mbti: 'ENTP',
    job: '개발자',
    personality: '유머러스하고 창의적인 성격',
    bio: '새로운 기술과 여행을 좋아하는 개발자입니다.',
  },
  {
    name: '이서준',
    email: 'seojun@test.com',
    phone: '010-1111-0002',
    gender: 'male',
    age: 32,
    mbti: 'INTJ',
    job: '마케터',
    personality: '분석적이고 목표지향적',
    bio: '데이터 기반의 마케팅을 추구하며, 주말엔 카페투어를 즐깁니다.',
  },
  {
    name: '박도윤',
    email: 'doyoon@test.com',
    phone: '010-1111-0003',
    gender: 'male',
    age: 26,
    mbti: 'ESFP',
    job: '디자이너',
    personality: '밝고 사교적인 성격',
    bio: 'UI/UX 디자이너로 일하며, 음악과 미술을 사랑합니다.',
  },
  {
    name: '정우진',
    email: 'woojin@test.com',
    phone: '010-1111-0004',
    gender: 'male',
    age: 30,
    mbti: 'ISFJ',
    job: '의사',
    personality: '따뜻하고 배려심 깊은',
    bio: '사람들의 건강을 돌보는 일에 보람을 느끼는 의사입니다.',
  },
  {
    name: '최준혁',
    email: 'junhyuk@test.com',
    phone: '010-1111-0005',
    gender: 'male',
    age: 29,
    mbti: 'ENFJ',
    job: '교사',
    personality: '리더십이 강하고 친화력 있는',
    bio: '학생들과 함께 성장하는 것을 좋아하는 교사입니다.',
  },

  // 여성 사용자 5명
  {
    name: '김서연',
    email: 'seoyeon@test.com',
    phone: '010-2222-0001',
    gender: 'female',
    age: 27,
    mbti: 'INFP',
    job: '작가',
    personality: '감성적이고 창의적인',
    bio: '일상의 소소한 이야기를 글로 담아내는 작가입니다.',
  },
  {
    name: '이지우',
    email: 'jiwoo@test.com',
    phone: '010-2222-0002',
    gender: 'female',
    age: 25,
    mbti: 'ESTJ',
    job: '회계사',
    personality: '체계적이고 책임감 강한',
    bio: '숫자와 친한 회계사, 주말엔 베이킹을 즐깁니다.',
  },
  {
    name: '박수아',
    email: 'sua@test.com',
    phone: '010-2222-0003',
    gender: 'female',
    age: 31,
    mbti: 'ENFP',
    job: '마케팅 매니저',
    personality: '열정적이고 긍정적인',
    bio: '브랜드 스토리텔링을 좋아하는 마케터입니다.',
  },
  {
    name: '정예은',
    email: 'yeeun@test.com',
    phone: '010-2222-0004',
    gender: 'female',
    age: 28,
    mbti: 'ISTP',
    job: '사진작가',
    personality: '독립적이고 관찰력이 뛰어난',
    bio: '순간의 아름다움을 포착하는 사진작가입니다.',
  },
  {
    name: '홍채원',
    email: 'chaewon@test.com',
    phone: '010-2222-0005',
    gender: 'female',
    age: 26,
    mbti: 'ESFJ',
    job: '간호사',
    personality: '친절하고 공감능력이 높은',
    bio: '환자들의 마음까지 돌보는 간호사입니다.',
  },
];

async function seedTestUsers() {
  console.log('🌱 Starting test data seeding...');

  try {
    // 비밀번호 해싱 (모든 테스트 계정 동일한 비밀번호)
    const password = 'Test1234!';
    const passwordHash = await bcrypt.hash(password, 10);

    for (const userData of testUsers) {
      console.log(`\n👤 Creating user: ${userData.name}`);

      // 1. 사용자 생성
      const userId = uuidv4();
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password_hash: passwordHash,
          gender: userData.gender,
          age: userData.age,
          phone_verified: true,
          login_type: 'email',
          mbti: userData.mbti,
          job: userData.job,
          personality: userData.personality,
          bio: userData.bio,
          // 서울 중심부 좌표 (시청)
          last_latitude: 37.5666,
          last_longitude: 126.9784,
          last_location_name: '서울특별시',
          last_location_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (userError) {
        console.error(`❌ Failed to create user ${userData.name}:`, userError);
        continue;
      }

      console.log(`✅ User created: ${userData.name} (${userId})`);

      // 2. 프로필 사진 추가 (5장)
      const profilePhotos: any[] = [];
      for (let i = 1; i <= 5; i++) {
        const isMain = i === 1;
        const profilePhoto = {
          id: uuidv4(),
          user_id: userId,
          photo_url: `https://placehold.co/400x600/FF6B6B/FFFFFF?text=${userData.name.charAt(0)}${i}`,
          thumbnail_url: `https://placehold.co/200x300/FF6B6B/FFFFFF?text=${userData.name.charAt(0)}${i}`,
          is_main: isMain,
          file_size: 50000,
          mime_type: 'image/jpeg',
        };
        profilePhotos.push(profilePhoto);
      }

      const { error: profilePhotoError } = await supabase
        .from('profile_photos')
        .insert(profilePhotos);

      if (profilePhotoError) {
        console.error(`❌ Failed to create profile photos:`, profilePhotoError);
      } else {
        console.log(`✅ Created ${profilePhotos.length} profile photos`);
      }

      // 3. 여행 사진 추가 (3장, 서울 각지)
      const travelPhotos: any[] = [];
      const shuffledLocations = [...seoulLocations].sort(
        () => 0.5 - Math.random(),
      );

      for (let i = 0; i < 3; i++) {
        const location = shuffledLocations[i];
        const travelPhoto = {
          id: uuidv4(),
          user_id: userId,
          photo_url: `https://placehold.co/600x800/4ECDC4/FFFFFF?text=${location.name}`,
          thumbnail_url: `https://placehold.co/300x400/4ECDC4/FFFFFF?text=${location.name}`,
          latitude: location.lat + (Math.random() - 0.5) * 0.01, // 약간의 랜덤성 추가
          longitude: location.lng + (Math.random() - 0.5) * 0.01,
          location_name: location.name,
          description: `${location.name}에서의 추억`,
          is_public: true,
          file_size: 100000,
          mime_type: 'image/jpeg',
        };
        travelPhotos.push(travelPhoto);
      }

      const { error: travelPhotoError } = await supabase
        .from('travel_photos')
        .insert(travelPhotos);

      if (travelPhotoError) {
        console.error(`❌ Failed to create travel photos:`, travelPhotoError);
      } else {
        console.log(`✅ Created ${travelPhotos.length} travel photos`);
      }

      // 4. 티켓 정보 초기화
      const { error: ticketError } = await supabase
        .from('user_tickets')
        .insert({
          user_id: userId,
          free_tickets: 3,
          paid_tickets: 0,
          total_purchased_tickets: 0,
          last_free_ticket_date: new Date().toISOString().split('T')[0],
        });

      if (ticketError) {
        console.error(`❌ Failed to create user tickets:`, ticketError);
      } else {
        console.log(`✅ Created user tickets (3 free tickets)`);
      }
    }

    console.log('\n✨ Test data seeding completed!');
    console.log('\n📋 Test Account Info:');
    console.log('- Email: [name]@test.com');
    console.log('- Password: Test1234!');
    console.log('- Total users: 10 (5 male, 5 female)');
    console.log('- Each user has:');
    console.log('  - 5 profile photos');
    console.log('  - 3 travel photos in Seoul');
    console.log('  - 3 free tickets');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
}

// 실행
seedTestUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
