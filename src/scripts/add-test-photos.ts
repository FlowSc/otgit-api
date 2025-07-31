import { createClient } from '@supabase/supabase-js';
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

async function addTestPhotos() {
  console.log('📸 Adding photos to existing users...');

  try {
    // 기존 사용자 조회
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('email', [
        'minjun@test.com',
        'seojun@test.com',
        'doyoon@test.com',
        'woojin@test.com',
        'junhyuk@test.com',
        'seoyeon@test.com',
        'jiwoo@test.com',
        'sua@test.com',
        'yeeun@test.com',
        'chaewon@test.com',
      ]);

    if (userError || !users) {
      console.error('Failed to fetch users:', userError);
      return;
    }

    console.log(`Found ${users.length} users`);

    for (const user of users) {
      console.log(`\nAdding photos for ${user.name}...`);

      // 1. 프로필 사진이 있는지 확인
      const { data: existingPhotos } = await supabase
        .from('profile_photos')
        .select('id')
        .eq('user_id', user.id);

      if (!existingPhotos || existingPhotos.length === 0) {
        // 프로필 사진 추가
        const profilePhotos: any[] = [];
        for (let i = 1; i <= 5; i++) {
          const isMain = i === 1;
          const profilePhoto = {
            id: uuidv4(),
            user_id: user.id,
            file_url: `https://placehold.co/400x600/FF6B6B/FFFFFF?text=${user.name.charAt(0)}${i}`,
            file_name: `profile_${user.name}_${i}.jpg`,
            file_size: 50000,
            mime_type: 'image/jpeg',
            storage_path: `profile-photos/${user.id}/profile_${i}.jpg`,
            is_active: isMain, // 첫 번째 사진만 active
          };
          profilePhotos.push(profilePhoto);
        }

        const { error: profilePhotoError } = await supabase
          .from('profile_photos')
          .insert(profilePhotos);

        if (profilePhotoError) {
          console.error(
            `❌ Failed to create profile photos:`,
            profilePhotoError,
          );
        } else {
          console.log(`✅ Created ${profilePhotos.length} profile photos`);
        }
      } else {
        console.log(`↩️  Profile photos already exist`);
      }

      // 2. 여행 사진이 있는지 확인
      const { data: existingTravelPhotos } = await supabase
        .from('travel_photos')
        .select('id')
        .eq('user_id', user.id);

      if (!existingTravelPhotos || existingTravelPhotos.length === 0) {
        // 여행 사진 추가
        const travelPhotos: any[] = [];
        const shuffledLocations = [...seoulLocations].sort(
          () => 0.5 - Math.random(),
        );

        for (let i = 0; i < 3; i++) {
          const location = shuffledLocations[i];
          const travelPhoto = {
            id: uuidv4(),
            user_id: user.id,
            file_url: `https://placehold.co/600x800/4ECDC4/FFFFFF?text=${encodeURIComponent(location.name)}`,
            file_name: `travel_${location.name}_${i}.jpg`,
            file_size: 100000,
            mime_type: 'image/jpeg',
            storage_path: `travel-photos/${user.id}/travel_${i}.jpg`,
            latitude: location.lat + (Math.random() - 0.5) * 0.01,
            longitude: location.lng + (Math.random() - 0.5) * 0.01,
            location_name: location.name,
            description: `${location.name}에서의 추억`,
            is_public: true,
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
      } else {
        console.log(`↩️  Travel photos already exist`);
      }
    }

    console.log('\n✨ Photo addition completed!');

    // 통계 출력
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: profilePhotoCount } = await supabase
      .from('profile_photos')
      .select('*', { count: 'exact', head: true });

    const { count: travelPhotoCount } = await supabase
      .from('travel_photos')
      .select('*', { count: 'exact', head: true });

    console.log('\n📊 Database Statistics:');
    console.log(`- Total users: ${userCount}`);
    console.log(`- Total profile photos: ${profilePhotoCount}`);
    console.log(`- Total travel photos: ${travelPhotoCount}`);
  } catch (error) {
    console.error('❌ Photo addition failed:', error);
  }
}

// 실행
addTestPhotos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
