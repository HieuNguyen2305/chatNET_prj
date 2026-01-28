import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  StatusBar, Alert, Modal, Dimensions
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import TcpSocket from 'react-native-tcp-socket';
import CryptoJS from 'crypto-js';
import { 
  initSecurityContext, generateRandomSessionKey, encryptSessionKeyWithRSA,
  decryptSessionKeyWithRSA, encryptPacket, decryptPacket, generateSafetyNumber, SecurityContext 
} from './src/utils/SecureProtocol';

const PORT = 8888;

interface Message {
  id: string; text: string; sender: 'me' | 'other' | 'system';
  timestamp: Date; type: 'text' | 'voice' | 'image' | 'stego';
  isVerified?: boolean; expiresAt?: number; signature?: string;
}

function App(): React.JSX.Element {
  const [securityCtx, setSecurityCtx] = useState<SecurityContext | null>(null);
  const [partnerRSAPublicKey, setPartnerRSAPublicKey] = useState('');
  const [safetyNumber, setSafetyNumber] = useState<string>('---');
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState<'LOGIN' | 'CHAT' | 'TODO'>('LOGIN');
  const [loginPass, setLoginPass] = useState('');
  const [myIp, setMyIp] = useState('...');
  const [targetIp, setTargetIp] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);

  const socketRef = useRef<any>(null);
  const serverRef = useRef<any>(null);
  const securityCtxRef = useRef<SecurityContext | null>(null);
  const partnerRSARef = useRef('');

  useEffect(() => { securityCtxRef.current = securityCtx; }, [securityCtx]);
  useEffect(() => { partnerRSARef.current = partnerRSAPublicKey; }, [partnerRSAPublicKey]);

  useEffect(() => {
    NetInfo.fetch().then(s => setMyIp((s.details as any)?.ipAddress || 'Unknown'));
    initSecurityContext().then(ctx => setSecurityCtx(ctx));

    const server = TcpSocket.createServer((socket) => {
      socket.on('data', (d) => handleReceiveData(d, socket));
      socket.on('error', (e) => console.log('Server Err:', e));
    });
    server.listen({ port: PORT, host: '0.0.0.0' });
    serverRef.current = server;
    return () => {
      server.close();
      if (socketRef.current) socketRef.current.destroy();
    };
  }, []);

  const handleReceiveData = (data: any, socket: any) => {
    const rawString = data.toString('utf8');

    // 1. Nhận Public Key
    if (rawString.startsWith('PUBKEY::')) {
      const pubKey = rawString.replace('PUBKEY::', '');
      setPartnerRSAPublicKey(pubKey);
      if (securityCtxRef.current) {
        setSafetyNumber(generateSafetyNumber(securityCtxRef.current.myRSAPublicKey, pubKey));
      }
      addSystemMsg('🔗 Đã nhận Public Key đối phương.');
      return;
    }

    // 2. Nhận Key AES
    if (rawString.startsWith('SESSION::')) {
      const encryptedKey = rawString.replace('SESSION::', '');
      if (securityCtxRef.current) {
        const key = decryptSessionKeyWithRSA(encryptedKey, securityCtxRef.current.myRSAPrivateKey);
        if (key) {
          setSecurityCtx(prev => prev ? ({ ...prev, sessionKey: key }) : null);
          addSystemMsg('✅ RSA đã giải mã thành công Key AES! Bắt đầu Chat.');
        } else {
          addSystemMsg('❌ Lỗi giải mã Key AES.');
        }
      }
      return;
    }

    // 3. Nhận Tin nhắn
    if (securityCtxRef.current?.sessionKey && partnerRSARef.current) {
      const result = decryptPacket(rawString, securityCtxRef.current.sessionKey, partnerRSARef.current);
      if (result.status === 'success') {
        try {
          const msgObj = JSON.parse(result.text);
          const newMsg: Message = {
            id: Date.now().toString() + Math.random(),
            text: msgObj.content, type: msgObj.type || 'text', sender: 'other',
            timestamp: new Date(), isVerified: true, signature: result.signature,
            expiresAt: msgObj.ttl ? Date.now() + msgObj.ttl : undefined
          };
          setMessages(p => [...p, newMsg]);
        } catch { /* Fallback */ }
      } else {
        addSystemMsg(`⚠️ CẢNH BÁO: Chữ ký số không khớp! Có thể bị MITM.`);
      }
    }
  };

  const connectAndHandshake = () => {
    if (!targetIp) return alert('Nhập IP!');
    const client = TcpSocket.createConnection({ port: PORT, host: targetIp }, () => {
      setIsConnected(true);
      socketRef.current = client;
      if (securityCtx) client.write('PUBKEY::' + securityCtx.myRSAPublicKey);
    });
    client.on('data', (d) => handleReceiveData(d, client));
    client.on('error', (e) => addSystemMsg('Lỗi: ' + e.message));
  };

  const sendSecureKey = () => {
    if (!partnerRSAPublicKey || !socketRef.current) return alert("Chưa có kết nối!");
    const aesKey = generateRandomSessionKey();
    setSecurityCtx(prev => prev ? ({ ...prev, sessionKey: aesKey }) : null);
    
    const encryptedKey = encryptSessionKeyWithRSA(aesKey, partnerRSAPublicKey);
    if (encryptedKey) {
      socketRef.current.write('SESSION::' + encryptedKey);
      addSystemMsg('📤 Đã gửi Key AES (Được khóa bởi RSA).');
    } else {
      Alert.alert("Lỗi", "Không thể mã hóa Key AES!");
    }
  };

  const sendMessage = (content: string, type: 'text' | 'voice' | 'image' | 'stego' = 'text', ttl?: number) => {
    if (!socketRef.current || !securityCtx?.sessionKey) return alert('Chưa có Key bảo mật! Hãy bấm nút Gửi Key (Tím) trước.');
    
    const msgData = { content, type, timestamp: Date.now(), ttl };
    
    // Gọi hàm mã hóa mới
    const result = encryptPacket(JSON.stringify(msgData), securityCtx.sessionKey, securityCtx.myRSAPrivateKey);
    
    // Kiểm tra kết quả mã hóa
    if (result.encryptedData) {
      socketRef.current.write(result.encryptedData);
      setMessages(p => [...p, {
        id: Date.now().toString(), text: content, type, sender: 'me',
        timestamp: new Date(), isVerified: true, 
        signature: result.signature, // Lưu chữ ký để hiển thị cho mình
        expiresAt: ttl ? Date.now() + ttl : undefined
      }]);
    } else {
      Alert.alert("Lỗi Gửi", "Mã hóa thất bại!");
    }
  };

  const addSystemMsg = (txt: string) => {
    setMessages(p => [...p, { id: Date.now().toString(), text: txt, sender: 'system', timestamp: new Date(), type: 'text' }]);
  };

  useEffect(() => {
    const i = setInterval(() => setMessages(m => m.filter(msg => !msg.expiresAt || msg.expiresAt > Date.now())), 1000);
    return () => clearInterval(i);
  }, []);

  const handleLogin = () => {
    if (loginPass === '1234') setViewMode('CHAT');
    else if (loginPass === '0000') setViewMode('TODO');
    else alert('Sai mật khẩu (Hint: 1234)');
  };

  if (viewMode === 'LOGIN') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>🔐 SECURE LOGIN</Text>
        <TextInput style={styles.loginInput} placeholder="Passcode" secureTextEntry value={loginPass} onChangeText={setLoginPass} keyboardType="numeric"/>
        <TouchableOpacity style={styles.btn} onPress={handleLogin}><Text style={{color:'white'}}>UNLOCK</Text></TouchableOpacity>
        <Text style={{marginTop: 20, color:'#888'}}>Pass thật: 1234 | Pass giả: 0000</Text>
      </View>
    );
  }

  if (viewMode === 'TODO') {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, {color:'#333'}]}>📝 Danh sách việc cần làm</Text>
        <Text style={styles.todo}>▢ Mua rau muống</Text>
        <Text style={styles.todo}>▢ Học bài</Text>
        <TouchableOpacity onPress={() => setViewMode('LOGIN')} style={{marginTop:50}}><Text>Đăng xuất</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#121212'}}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={{color:'#fff', fontWeight:'bold'}}>IP Của Tôi: {myIp}</Text>
          <Text style={{color: safetyNumber !== '---' ? '#00ff00' : '#888', fontSize:11, fontWeight:'bold'}}>
             🛡️ MITM Safety: {safetyNumber}
          </Text>
          <Text style={{fontSize:10, color: partnerRSAPublicKey ? '#4CAF50' : '#FF5722'}}>
             🔑 RSA Key: {partnerRSAPublicKey ? 'ĐÃ NHẬN ✅' : 'CHƯA CÓ ❌'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { setMessages([]); setSecurityCtx(null); setViewMode('LOGIN'); }} style={styles.panicBtn}>
          <Text>🆘 PANIC</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.connBar}>
        {!isConnected ? (
          <>
            <TextInput style={styles.ipInput} placeholder="IP Đối phương" placeholderTextColor="#888" onChangeText={setTargetIp} />
            <TouchableOpacity onPress={connectAndHandshake} style={styles.connBtn}><Text style={{color:'#fff'}}>1. KẾT NỐI</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={sendSecureKey} style={[styles.connBtn, {backgroundColor:'purple', flex:1}]}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>2. GỬI KEY AES (RSA ENCRYPTED) 🚀</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView style={{flex:1, padding:10}}>
        <Text style={{color:'#666', fontSize:12, textAlign:'center', marginBottom:10}}>
          (Bấm vào tin nhắn bất kỳ để soi Bằng chứng thép)
        </Text>
        {messages.map((m) => (
          <TouchableOpacity 
            key={m.id} activeOpacity={0.8} onPress={() => setSelectedMsg(m)}
            style={[styles.msgBubble, m.sender==='me'?styles.me:m.sender==='system'?styles.sys:styles.other]}
          >
             {m.isVerified && <Text style={{fontSize:10, color:'#00ff00'}}>✓ Signed</Text>}
             <Text style={{color: m.sender==='system'?'#aaa':'#fff'}}>
               {m.type==='voice' ? '🎤 [Voice Encrypted]' : m.type==='stego' ? `🖼️ [Stego Image]: ${m.text}` : m.text}
             </Text>
             {m.expiresAt && <Text style={{fontSize:10, color:'red'}}>💣 {Math.round((m.expiresAt-Date.now())/1000)}s</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal visible={!!selectedMsg} transparent={true} animationType="fade" onRequestClose={() => setSelectedMsg(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🕵️ KÍNH LÚP BẢO MẬT</Text>
            <ScrollView>
              <View style={styles.section}>
                <Text style={styles.label}>Nội dung gốc:</Text>
                <Text style={styles.value}>{selectedMsg?.text}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.label}>Giá trị băm (SHA-256):</Text>
                <Text style={styles.code}>{selectedMsg ? CryptoJS.SHA256(selectedMsg.text).toString() : ''}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.label}>Chữ ký số (RSA Signature):</Text>
                <Text style={styles.code}>{selectedMsg?.signature || '(Không có signature)'}</Text>
              </View>
              <View style={{alignItems:'center', marginTop:15}}>
                 {selectedMsg?.isVerified ? (
                    <Text style={{color:'green', fontWeight:'bold', fontSize:18}}>✅ ĐÃ XÁC THỰC (VERIFIED)</Text>
                 ) : (
                    <Text style={{color:'#0084ff', fontStyle:'italic'}}>Tin nhắn tự gửi</Text>
                 )}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedMsg(null)}><Text style={{color:'#fff'}}>Đóng</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.inputArea}>
        <TextInput style={styles.input} value={inputText} onChangeText={setInputText} placeholder="Tin nhắn..." placeholderTextColor="#666"/>
        <TouchableOpacity onPress={()=>sendMessage(inputText)} style={styles.sendBtn}><Text>➤</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>sendMessage(inputText,'text',10000)} style={[styles.sendBtn, {backgroundColor:'red'}]}><Text>💣</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>sendMessage(inputText,'stego')} style={[styles.sendBtn, {backgroundColor:'green'}]}><Text>🖼️</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  loginInput: { width: 200, height: 50, borderWidth: 1, textAlign: 'center', fontSize: 20, borderRadius: 10, backgroundColor: '#fff', color: '#000', marginBottom: 10 },
  btn: { backgroundColor: '#333', padding: 15, borderRadius: 10, width: 200, alignItems: 'center' },
  todo: { fontSize: 18, marginVertical: 10, borderBottomWidth: 1, paddingBottom: 5, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#1e1e1e', alignItems: 'center', borderBottomWidth:1, borderColor:'#333' },
  panicBtn: { backgroundColor: 'red', padding: 10, borderRadius: 5 },
  connBar: { flexDirection: 'row', padding: 10, backgroundColor: '#252525' },
  ipInput: { flex: 1, backgroundColor: '#fff', borderRadius: 5, padding: 8, marginRight: 10, color: '#000' },
  connBtn: { backgroundColor: '#0084ff', justifyContent: 'center', padding: 10, borderRadius: 5, alignItems: 'center' },
  msgBubble: { padding: 12, borderRadius: 10, marginVertical: 5, maxWidth: '85%' },
  me: { alignSelf: 'flex-end', backgroundColor: '#0084ff' },
  other: { alignSelf: 'flex-start', backgroundColor: '#333' },
  sys: { alignSelf: 'center', backgroundColor: 'transparent', padding: 5 },
  inputArea: { flexDirection: 'row', padding: 10, backgroundColor: '#1e1e1e' },
  input: { flex: 1, backgroundColor: '#333', color: '#fff', borderRadius: 20, paddingHorizontal: 15, marginRight: 5 },
  sendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#0084ff', marginLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '70%', backgroundColor: '#fff', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0084ff', textAlign: 'center', marginBottom: 15 },
  section: { marginBottom: 15 },
  label: { fontWeight: 'bold', color: '#333', marginBottom: 5 },
  value: { fontSize: 16, color: '#000' },
  code: { fontFamily: 'monospace', fontSize: 11, backgroundColor: '#f0f0f0', padding: 8, borderRadius: 5, color: '#555' },
  closeBtn: { backgroundColor: '#0084ff', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 15 },
});

export default App;