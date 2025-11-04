import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
  Modal,
  Image,
  ImageBackground,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import TcpSocket from 'react-native-tcp-socket';
import { encryptCaesar, decryptCaesar, isValidKey, parseKey } from './src/utils/caesarCipher';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isSmallScreen = SCREEN_HEIGHT < 700;
const isNarrowScreen = SCREEN_WIDTH < 360;
const scale = (size: number) => (SCREEN_WIDTH / 375) * size;
const verticalScale = (size: number) => (SCREEN_HEIGHT / 667) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const responsiveFontSize = (size: number) => {
  const scaledSize = moderateScale(size, 0.3);
  return Math.max(Math.min(scaledSize, size * 1.2), size * 0.85);
};

interface Message {
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  encrypted?: boolean;
}

const PORT = 8888;

function App(): React.JSX.Element {
  const [myIp, setMyIp] = useState<string>('Đang lấy IP...');
  const [targetIp, setTargetIp] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<string>('3');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(true);
  
  const serverRef = useRef<any>(null);
  const clientRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const encryptionKeyRef = useRef(encryptionKey);
  const isEncryptionEnabledRef = useRef(isEncryptionEnabled);
  
  useEffect(() => {
    encryptionKeyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    isEncryptionEnabledRef.current = isEncryptionEnabled;
  }, [isEncryptionEnabled]);

  const fetchIpAddress = () => {
    setMyIp('Đang lấy IP...');
    NetInfo.fetch().then(state => {
      if (state.details && 'ipAddress' in state.details) {
        const ip = (state.details as any).ipAddress;
        setMyIp(ip || 'Không tìm thấy IP');
      } else {
        setMyIp('Không tìm thấy IP');
      }
    });
  };

  useEffect(() => {
    fetchIpAddress();
  }, []);

  useEffect(() => {
    if (!isServerRunning) {
      startServer();
    }

    return () => {
      if (serverRef.current) {
        serverRef.current.close();
      }
      if (clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, []);

  const startServer = () => {
    try {
      const server = TcpSocket.createServer((socket: any) => {
        socket.on('data', (data: any) => {
          const receivedMessage = data.toString('utf8');
          const isEncryptionOn = isEncryptionEnabledRef.current;
          const currentKey = encryptionKeyRef.current;
          let displayMessage = receivedMessage;
          
          if (isEncryptionOn && isValidKey(currentKey)) {
            displayMessage = decryptCaesar(receivedMessage, parseKey(currentKey));
          }
          
          setMessages(prev => [
            ...prev,
            {
              text: displayMessage,
              sender: 'other',
              timestamp: new Date(),
              encrypted: isEncryptionOn,
            },
          ]);
        });

        socket.on('error', (error: any) => {
        });

        socket.on('close', () => {
        });
      });

      server.listen({ port: PORT, host: '0.0.0.0' }, () => {
        setIsServerRunning(true);
      });

      server.on('error', (error: any) => {
        Alert.alert('Lỗi', 'Không thể khởi động server: ' + error.message);
      });

      serverRef.current = server;
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể khởi động server: ' + error.message);
    }
  };

  const sendMessage = () => {
    if (!message.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tin nhắn');
      return;
    }

    if (!targetIp.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập IP đối phương trong Settings');
      return;
    }

    if (isEncryptionEnabled && !isValidKey(encryptionKey)) {
      Alert.alert('Lỗi mã hóa', 'Key phải là số từ 1-25');
      return;
    }

    const messageToSend = message.trim();
    const encryptedMessage = isEncryptionEnabled 
      ? encryptCaesar(messageToSend, parseKey(encryptionKey))
      : messageToSend;
    
    setMessage('');

    try {
      let connectionTimeout: any;
      let isConnected = false;

      const client = TcpSocket.createConnection(
        {
          port: PORT,
          host: targetIp,
        },
        () => {
          isConnected = true;
          clearTimeout(connectionTimeout);

          client.write(encryptedMessage, 'utf8', (error) => {
            if (error) {
              Alert.alert('Lỗi', 'Không thể gửi tin nhắn: ' + error.message);
            } else {
              setMessages(prev => [
                ...prev,
                {
                  text: messageToSend,
                  sender: 'me',
                  timestamp: new Date(),
                  encrypted: isEncryptionEnabled,
                },
              ]);
            }

            setTimeout(() => {
              client.destroy();
            }, 100);
          });
        }
      );

      connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          client.destroy();
          Alert.alert(
            'Lỗi kết nối', 
            `Không thể kết nối đến ${targetIp}\n\nKiểm tra:\n• IP có đúng không?\n• Thiết bị có cùng WiFi không?\n• Ứng dụng đã mở ở thiết bị kia chưa?`
          );
        }
      }, 5000);

      client.on('error', (error: any) => {
        clearTimeout(connectionTimeout);
        
        let errorMessage = 'Không thể kết nối đến ' + targetIp;
        const errMsg = error?.message || '';
        
        if (errMsg.includes('ECONNREFUSED')) {
          errorMessage += '\n\n❌ Kết nối bị từ chối!\nỨng dụng chưa được mở ở thiết bị đích.';
        } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout')) {
          errorMessage += '\n\n⏱️ Hết thời gian chờ!\nKiểm tra kết nối mạng và IP.';
        } else if (errMsg.includes('ENETUNREACH') || errMsg.includes('EHOSTUNREACH')) {
          errorMessage += '\n\n🌐 Không thể truy cập mạng!\nKiểm tra cả 2 thiết bị có cùng WiFi.';
        } else if (errMsg) {
          errorMessage += '\n\n' + errMsg;
        }
        
        Alert.alert('Lỗi kết nối', errorMessage);
      });

      client.on('close', () => {
        clearTimeout(connectionTimeout);
      });

      clientRef.current = client;
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn: ' + error.message);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0084ff" />
      <ImageBackground
        source={require('./assets/Logo.jpg')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>💬 ChatNET</Text>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.7}
            >
              <Image 
                source={require('./assets/setting.png')} 
                style={styles.settingsIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >

            {/* Settings Modal */}
            <Modal
              visible={showSettingsModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowSettingsModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>⚙️ Cài đặt</Text>
                    <TouchableOpacity 
                      onPress={() => setShowSettingsModal(false)}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalBody}>
                    {/* My IP */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>📱 Địa chỉ IP của bạn</Text>
                      <View style={styles.ipDisplayRow}>
                        <Text style={styles.ipDisplayText}>{myIp}</Text>
                        <TouchableOpacity 
                          style={styles.reloadButton} 
                          onPress={fetchIpAddress}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.reloadIcon}>↻</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Target IP */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>🌐 IP người nhận</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={targetIp}
                        onChangeText={setTargetIp}
                        placeholder="Nhập IP (ví dụ: 192.168.1.100)"
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Encryption Toggle */}
                    <View style={styles.modalSection}>
                      <View style={styles.toggleRow}>
                        <View style={styles.toggleLabelContainer}>
                          <Text style={styles.modalLabel}>🔐 Chế độ mã hóa</Text>
                          <Text style={styles.toggleSubLabel}>
                            {isEncryptionEnabled ? 'Đang bật' : 'Đang tắt'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.toggleButton,
                            isEncryptionEnabled ? styles.toggleButtonOn : styles.toggleButtonOff
                          ]}
                          onPress={() => setIsEncryptionEnabled(!isEncryptionEnabled)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.toggleCircle,
                            isEncryptionEnabled ? styles.toggleCircleOn : styles.toggleCircleOff
                          ]} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Encryption Key - Only show when encryption is enabled */}
                    {isEncryptionEnabled && (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalLabel}>🔑 Key mã hóa (1-25)</Text>
                        <TextInput
                          style={styles.modalInput}
                          value={encryptionKey}
                          onChangeText={setEncryptionKey}
                          placeholder="3"
                          placeholderTextColor="#aaa"
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                        <View style={styles.infoBox}>
                          <Text style={styles.infoIcon}>ℹ️</Text>
                          <Text style={styles.infoText}>
                            Cả 2 người phải dùng cùng key để chat được với nhau.
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={() => setShowSettingsModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.saveButtonText}>✓ Lưu cài đặt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Messages Area */}
            <View style={styles.chatArea}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Vui lòng cài đặt trước khi trò chuyện</Text>
                  </View>
                ) : (
                  messages.map((msg, index) => (
                    <View
                      key={index}
                      style={[
                        styles.messageRow,
                        msg.sender === 'me' ? styles.myMessageRow : styles.otherMessageRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          msg.sender === 'me' ? styles.myMessage : styles.otherMessage,
                        ]}
                      >
                        <Text style={[
                          styles.messageText,
                          msg.sender === 'me' ? styles.myMessageText : styles.otherMessageText,
                        ]}>
                          {msg.text}
                        </Text>
                        <Text style={[
                          styles.timestamp,
                          msg.sender === 'me' ? styles.myTimestamp : styles.otherTimestamp,
                        ]}>
                          {msg.timestamp.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Message Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#999"
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]} 
                onPress={sendMessage}
                activeOpacity={0.7}
                disabled={!message.trim()}
              >
                <Image 
                  source={require('./assets/send-message.png')} 
                  style={styles.sendIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 0.50,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0084ff',
    paddingHorizontal: scale(15),
    paddingTop: Platform.OS === 'ios' ? verticalScale(20) : verticalScale(45),
    paddingBottom: verticalScale(16),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize(24),
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  settingsButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsIcon: {
    width: moderateScale(26),
    height: moderateScale(26),
    tintColor: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(20),
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: responsiveFontSize(20),
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: scale(5),
  },
  closeButtonText: {
    fontSize: responsiveFontSize(24),
    color: '#666',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: moderateScale(20),
  },
  modalSection: {
    marginBottom: verticalScale(20),
  },
  modalLabel: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: verticalScale(8),
  },
  ipDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: moderateScale(12),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ipDisplayText: {
    flex: 1,
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
    color: '#0084ff',
  },
  reloadButton: {
    backgroundColor: '#0084ff',
    borderRadius: moderateScale(17),
    width: moderateScale(34),
    height: moderateScale(34),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(10),
  },
  reloadIcon: {
    fontSize: responsiveFontSize(20),
    color: '#fff',
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#d0d0d0',
    borderRadius: moderateScale(10),
    padding: moderateScale(14),
    fontSize: responsiveFontSize(15),
    color: '#333',
    backgroundColor: '#fafafa',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: moderateScale(12),
    borderRadius: moderateScale(8),
    marginTop: verticalScale(8),
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  infoIcon: {
    fontSize: responsiveFontSize(18),
    marginRight: scale(8),
  },
  infoText: {
    flex: 1,
    fontSize: responsiveFontSize(12),
    color: '#1565C0',
    lineHeight: responsiveFontSize(18),
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: moderateScale(16),
    margin: moderateScale(20),
    marginTop: 0,
    borderRadius: moderateScale(12),
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: responsiveFontSize(16),
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabelContainer: {
    flex: 1,
  },
  toggleSubLabel: {
    fontSize: responsiveFontSize(12),
    color: '#666',
    marginTop: verticalScale(2),
  },
  toggleButton: {
    width: moderateScale(56),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    padding: scale(2),
    justifyContent: 'center',
  },
  toggleButtonOn: {
    backgroundColor: '#4CAF50',
    alignItems: 'flex-end',
  },
  toggleButtonOff: {
    backgroundColor: '#ccc',
    alignItems: 'flex-start',
  },
  toggleCircle: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  toggleCircleOn: {
  },
  toggleCircleOff: {
  },
  chatArea: {
    flex: 1,
    backgroundColor: 'rgba(240, 242, 245, 0.85)',
    marginBottom: 0,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: moderateScale(14),
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(50),
    paddingHorizontal: scale(20),
  },
  emptyText: {
    fontSize: responsiveFontSize(15),
    color: '#888',
    textAlign: 'center',
    lineHeight: responsiveFontSize(20),
  },
  messageRow: {
    marginVertical: verticalScale(4),
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  myMessage: {
    backgroundColor: '#0084ff',
    borderBottomRightRadius: moderateScale(4),
  },
  otherMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: moderateScale(4),
  },
  messageText: {
    fontSize: responsiveFontSize(15),
    marginBottom: verticalScale(3),
    lineHeight: responsiveFontSize(20),
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  timestamp: {
    fontSize: responsiveFontSize(11),
    alignSelf: 'flex-end',
    marginTop: verticalScale(2),
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherTimestamp: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: moderateScale(14),
    paddingBottom: verticalScale(24),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 0,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#d0d0d0',
    borderRadius: moderateScale(25),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    fontSize: responsiveFontSize(15),
    maxHeight: verticalScale(100),
    color: '#333',
    marginRight: scale(10),
    backgroundColor: '#fafafa',
  },
  sendButton: {
    backgroundColor: 'transparent',
    width: moderateScale(25),
    height: moderateScale(25),
    borderRadius: moderateScale(13),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    width: moderateScale(25),
    height: moderateScale(25),
  },
});

export default App;
