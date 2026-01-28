// src/utils/RSA.ts
import forge from 'node-forge';

// 1. Tạo cặp khóa (Public & Private)
export const generateKeys = async () => {
  return new Promise<{ publicKey: string; privateKey: string }>((resolve, reject) => {
    // Dùng 1024 bit cho nhanh (Mobile chạy 2048 sẽ hơi lag)
    forge.pki.rsa.generateKeyPair({ bits: 1024, workers: -1 }, (err, keypair) => {
      if (err) reject(err);
      else {
        resolve({
          publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
          privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
        });
      }
    });
  });
};

// 2. Mã hóa (Dùng Public Key của NGƯỜI NHẬN)
export const encryptRSA = (msg: string, publicKeyPem: string) => {
  try {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const encrypted = publicKey.encrypt(msg, 'RSA-OAEP');
    return forge.util.encode64(encrypted); // Chuyển sang base64 để gửi qua mạng
  } catch (e) {
    console.log('Lỗi mã hóa:', e);
    return msg; // Lỗi thì trả về tin nhắn gốc
  }
};

// 3. Giải mã (Dùng Private Key của MÌNH)
export const decryptRSA = (encryptedMsg: string, privateKeyPem: string) => {
  try {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const decoded = forge.util.decode64(encryptedMsg);
    return privateKey.decrypt(decoded, 'RSA-OAEP');
  } catch (e) {
    console.log('Lỗi giải mã:', e);
    return '*** Tin nhắn không thể giải mã ***';
  }
};