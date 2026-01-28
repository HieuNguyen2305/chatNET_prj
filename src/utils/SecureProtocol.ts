import forge from 'node-forge';
import CryptoJS from 'crypto-js';

// --- 1. CẤU TRÚC DỮ LIỆU ---
export interface SecurityContext {
  myRSAPublicKey: string;
  myRSAPrivateKey: string;
  sessionKey: string | null;
}

// Hàm hỗ trợ tạo chuỗi Hex ngẫu nhiên thủ công
// (Thay thế cho crypto-js random để tránh crash trên React Native)
const generateRandomHex = (length: number) => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
};

// --- 2. KHỞI TẠO RSA ---
export const initSecurityContext = async (): Promise<SecurityContext> => {
  return new Promise((resolve) => {
    forge.pki.rsa.generateKeyPair({ bits: 1024, workers: -1 }, (err, rsaKeyPair) => {
      if (err) {
        console.log('Lỗi Init RSA:', err);
        return;
      }
      resolve({
        myRSAPublicKey: forge.pki.publicKeyToPem(rsaKeyPair.publicKey),
        myRSAPrivateKey: forge.pki.privateKeyToPem(rsaKeyPair.privateKey),
        sessionKey: null,
      });
    });
  });
};

// --- 3. TRAO ĐỔI KHÓA ---

// A. Tạo Random Key Session (Dùng hàm thủ công ở trên)
export const generateRandomSessionKey = () => {
  // Tạo 32 byte = 64 ký tự hex
  return generateRandomHex(64);
};

// B. Mã hóa Key AES bằng RSA Public Key
export const encryptSessionKeyWithRSA = (sessionKey: string, otherRSAPublicKeyPem: string) => {
  try {
    const publicKey = forge.pki.publicKeyFromPem(otherRSAPublicKeyPem);
    const encryptedBytes = publicKey.encrypt(sessionKey, 'RSA-OAEP');
    return forge.util.encode64(encryptedBytes);
  } catch (e) {
    console.log("Lỗi Encrypt Key:", e);
    return null;
  }
};

// C. Giải mã Key AES
export const decryptSessionKeyWithRSA = (encryptedSessionKeyBase64: string, myRSAPrivateKeyPem: string) => {
  try {
    const privateKey = forge.pki.privateKeyFromPem(myRSAPrivateKeyPem);
    const encryptedBytes = forge.util.decode64(encryptedSessionKeyBase64);
    return privateKey.decrypt(encryptedBytes, 'RSA-OAEP');
  } catch (e) {
    console.log("Lỗi Decrypt Key:", e);
    return null;
  }
};

// --- 4. MÃ HÓA GÓI TIN CHAT (AES + HASH + SIGNATURE) ---
export const encryptPacket = (
  text: string, 
  sessionKey: string, 
  myRSAPrivateKeyPem: string
) => {
  try {
    // B1: TẠO CHỮ KÝ SỐ (SIGNATURE)
    const md = forge.md.sha256.create();
    md.update(text, 'utf8');
    const privateKey = forge.pki.privateKeyFromPem(myRSAPrivateKeyPem);
    const signature = forge.util.encode64(privateKey.sign(md));

    // B2: ĐÓNG GÓI PAYLOAD
    const payload = JSON.stringify({ text, signature });

    // B3: MÃ HÓA AES THỦ CÔNG (Tránh Crypto-js tự sinh Salt gây crash)
    // 1. Tạo IV ngẫu nhiên (16 byte = 32 hex)
    const ivHex = generateRandomHex(32);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = CryptoJS.enc.Hex.parse(sessionKey);

    // 2. Mã hóa với IV cụ thể
    const encrypted = CryptoJS.AES.encrypt(payload, key, { iv: iv }).toString();
    
    // 3. Ghép IV vào chuỗi mã hóa để bên kia biết đường giải mã (Format: IV:Ciphertext)
    const finalEncryptedData = ivHex + ':' + encrypted;

    return { encryptedData: finalEncryptedData, signature };

  } catch (e) {
    console.log("Lỗi Encrypt Packet:", e);
    return { encryptedData: "", signature: "" };
  }
};

export const decryptPacket = (
  cipherTextRaw: string, 
  sessionKey: string, 
  otherRSAPublicKeyPem: string
) => {
  try {
    // B1: TÁCH IV VÀ CIPHERTEXT
    const parts = cipherTextRaw.split(':');
    if (parts.length !== 2) return { status: 'fail', text: '', signature: '' };
    
    const ivHex = parts[0];
    const ciphertext = parts[1];

    // B2: GIẢI MÃ AES
    const key = CryptoJS.enc.Hex.parse(sessionKey);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key, { iv: iv });
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) return { status: 'fail', text: '', signature: '' };

    // B3: TÁCH NỘI DUNG VÀ CHỮ KÝ
    const { text, signature } = JSON.parse(decryptedString);

    // B4: XÁC THỰC CHỮ KÝ (VERIFY)
    const md = forge.md.sha256.create();
    md.update(text, 'utf8');
    const publicKey = forge.pki.publicKeyFromPem(otherRSAPublicKeyPem);
    const signatureBytes = forge.util.decode64(signature);
    const isVerified = publicKey.verify(md.digest().bytes(), signatureBytes);

    return { 
      status: isVerified ? 'success' : 'tampered', 
      text, 
      signature 
    };
  } catch (e) {
    console.log("Lỗi Decrypt Packet:", e);
    return { status: 'fail', text: '', signature: '' };
  }
};

// --- 5. SAFETY NUMBER ---
export const generateSafetyNumber = (myRSAPub: string, otherRSAPub: string) => {
  const combined = [myRSAPub, otherRSAPub].sort().join('');
  const hash = CryptoJS.SHA256(combined).toString();
  return `${hash.substring(0, 5)} - ${hash.substring(hash.length - 5)}`;
};