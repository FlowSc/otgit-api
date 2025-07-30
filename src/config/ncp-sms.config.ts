import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto-js';

export interface NCPSMSRequest {
  type: 'SMS' | 'LMS' | 'MMS';
  contentType?: 'COMM' | 'AD';
  countryCode?: string;
  from: string;
  to: string[];
  subject?: string;
  content: string;
}

export interface NCPSMSResponse {
  requestId: string;
  requestTime: string;
  statusCode: string;
  statusName: string;
}

@Injectable()
export class NCPSMSService {
  private readonly baseUrl = 'https://sens.apigw.ntruss.com';
  private readonly uri = '/sms/v2/services';

  constructor(private configService: ConfigService) {}

  private makeSignature(
    method: string,
    url: string,
    timestamp: string,
    accessKey: string,
    secretKey: string,
  ): string {
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

  async sendSMS(
    phoneNumber: string,
    message: string,
    type: 'SMS' | 'LMS' = 'SMS',
  ): Promise<NCPSMSResponse> {
    try {
      const serviceId = this.configService.get<string>('NCP_SMS_SERVICE_ID');
      const accessKey = this.configService.get<string>('NCP_ACCESS_KEY');
      const secretKey = this.configService.get<string>('NCP_SECRET_KEY');
      const fromNumber = this.configService.get<string>('NCP_SMS_FROM_NUMBER');

      if (!serviceId || !accessKey || !secretKey || !fromNumber) {
        throw new Error('NCP SMS configuration is incomplete');
      }

      // 서비스 ID에서 실제 서비스 이름만 추출 (ncp:sms:kr:357155432756:otgit -> otgit)
      const serviceName = serviceId.split(':').pop();
      if (!serviceName) {
        throw new Error('Invalid NCP SMS Service ID format');
      }

      const timestamp = Date.now().toString();
      const method = 'POST';
      const url = `${this.uri}/${serviceName}/messages`;

      const signature = this.makeSignature(
        method,
        url,
        timestamp,
        accessKey,
        secretKey,
      );

      const requestBody = {
        type: type,
        contentType: 'COMM',
        countryCode: '82',
        from: fromNumber,
        content: message,
        messages: [
          {
            to: phoneNumber.replace(/^010/, '82010').replace(/-/g, ''), // 010-1234-5678 -> 8201012345678
          },
        ],
      };

      if (type === 'LMS' && message.length > 80) {
        requestBody.subject = '인증번호 안내';
      }

      const response = await axios.post(
        `${this.baseUrl}${url}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': accessKey,
            'x-ncp-apigw-signature-v2': signature,
          },
          timeout: 10000, // 10초 타임아웃
        },
      );

      return response.data as NCPSMSResponse;
    } catch (error) {
      console.error('NCP SMS send error:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.errorMessage || error.message;
        const statusCode = error.response?.status || 500;
        throw new Error(`NCP SMS API Error (${statusCode}): ${errorMessage}`);
      }
      
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<NCPSMSResponse> {
    const message = `[OTGIT] 인증번호는 ${code}입니다. 5분 내에 입력해주세요.`;
    return this.sendSMS(phoneNumber, message, 'SMS');
  }

  // 전화번호 형식 검증
  isValidPhoneNumber(phoneNumber: string): boolean {
    // 한국 휴대폰 번호 형식: 010-XXXX-XXXX 또는 01012345678
    const phoneRegex = /^010[-]?\d{4}[-]?\d{4}$/;
    return phoneRegex.test(phoneNumber);
  }

  // 전화번호 정규화 (010-1234-5678 형태로 변환)
  normalizePhoneNumber(phoneNumber: string): string {
    const numbers = phoneNumber.replace(/\D/g, ''); // 숫자만 추출
    if (numbers.length === 11 && numbers.startsWith('010')) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    return phoneNumber;
  }
}