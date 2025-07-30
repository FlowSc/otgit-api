const axios = require('axios');
const crypto = require('crypto-js');

// NCP SMS 테스트 스크립트
// 실제 환경변수 설정 후 사용하세요
const config = {
  serviceId: 'ncp:sms:kr:357155432756:otgit',
  accessKey: process.env.NCP_ACCESS_KEY || 'YOUR_ACCESS_KEY',
  secretKey: process.env.NCP_SECRET_KEY || 'YOUR_SECRET_KEY',
  fromNumber: process.env.NCP_SMS_FROM_NUMBER || '01012345678',
  testToNumber: '01012345678', // 테스트용 수신번호
};

function makeSignature(method, url, timestamp, accessKey, secretKey) {
  const space = ' ';
  const newLine = '\n';

  const hmac = crypto.algo.HMAC.create(crypto.algo.SHA256, secretKey);
  hmac.update(method);
  hmac.update(space);
  hmac.update(url);
  hmac.update(newLine);
  hmac.update(timestamp);
  hmac.update(newLine);
  hmac.update(accessKey);

  const hash = hmac.finalize();
  return hash.toString(crypto.enc.Base64);
}

async function testSMS() {
  try {
    console.log('🧪 NCP SMS API 테스트 시작...');
    console.log('서비스 ID:', config.serviceId);
    console.log('발신번호:', config.fromNumber);
    console.log('수신번호:', config.testToNumber);

    const baseUrl = 'https://sens.apigw.ntruss.com';
    
    // 다양한 URL 형식 시도
    const serviceName = config.serviceId.split(':').pop(); // otgit
    const fullServiceId = config.serviceId; // ncp:sms:kr:357155432756:otgit
    
    // 첫 번째 시도: 서비스 이름만 사용
    let uri = `/sms/v2/services/${serviceName}/messages`;
    console.log('🔗 시도할 URL:', `${baseUrl}${uri}`);
    const timestamp = Date.now().toString();
    const method = 'POST';

    const signature = makeSignature(
      method,
      uri,
      timestamp,
      config.accessKey,
      config.secretKey
    );

    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    const message = `[OTGIT] 테스트 인증번호는 ${testCode}입니다. 5분 내에 입력해주세요.`;

    const requestBody = {
      type: 'SMS',
      contentType: 'COMM',
      countryCode: '82',
      from: config.fromNumber,
      content: message,
      messages: [
        {
          to: config.testToNumber.replace(/^010/, '82010').replace(/-/g, ''),
        },
      ],
    };

    console.log('📤 요청 데이터:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(`${baseUrl}${uri}`, requestBody, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': config.accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      timeout: 10000,
    });

    console.log('✅ SMS 전송 성공!');
    console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
    console.log('생성된 인증번호:', testCode);

  } catch (error) {
    console.error('❌ SMS 전송 실패:', error.message);
    
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.log('\n🔑 인증 실패 - 다음을 확인하세요:');
      console.log('1. NCP_ACCESS_KEY가 올바른지 확인');
      console.log('2. NCP_SECRET_KEY가 올바른지 확인');
      console.log('3. API Gateway 서비스가 활성화되어 있는지 확인');
    }
    
    if (error.response?.status === 403) {
      console.log('\n🚫 권한 없음 - 다음을 확인하세요:');
      console.log('1. SMS 서비스가 활성화되어 있는지 확인');
      console.log('2. 서비스 ID가 올바른지 확인');
      console.log('3. 발신번호가 등록되어 있는지 확인');
    }
  }
}

// 환경변수 확인
console.log('🔧 환경변수 확인:');
console.log('NCP_ACCESS_KEY:', config.accessKey.substring(0, 8) + '...');
console.log('NCP_SECRET_KEY:', config.secretKey.substring(0, 8) + '...');
console.log('NCP_SMS_FROM_NUMBER:', config.fromNumber);
console.log('');

if (config.accessKey === 'YOUR_ACCESS_KEY' || config.secretKey === 'YOUR_SECRET_KEY') {
  console.log('❌ 환경변수를 먼저 설정해주세요:');
  console.log('export NCP_ACCESS_KEY="your_access_key"');
  console.log('export NCP_SECRET_KEY="your_secret_key"');
  console.log('export NCP_SMS_FROM_NUMBER="01012345678"');
  process.exit(1);
}

testSMS();