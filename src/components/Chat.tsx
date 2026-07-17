import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ChatMessage, User, UserRole, Ride } from '../types';
import { Send, Smile, Eye, CheckCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TelemetryService } from '../services/TelemetryService';

interface ChatProps {
  rideId: string;
  user: User;
  onClose?: () => void;
}

const EMOJI_PRESETS = ['👋', '👍', '👌', '🙏', '🚗', '📍', '🤝', '⏱️', '💵'];

export default function Chat({ rideId, user, onClose }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [typing, setTyping] = useState<boolean>(false);
  const [otherUserTyping, setOtherUserTyping] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [spamBlockTime, setSpamBlockTime] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  // Real-time listener for messages
  useEffect(() => {
    setLoading(true);
    const messagesRef = collection(db, 'rides', rideId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ChatMessage));
      
      setMessages(msgs);
      setLoading(false);

      // Mark unread messages as read automatically (if received from the other user)
      const batch = writeBatch(db);
      let hasUpdates = false;

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.senderId !== user.uid && !data.read) {
          const docRef = doc(db, 'rides', rideId, 'messages', docSnap.id);
          batch.update(docRef, { read: true });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        batch.commit().catch(err => console.error('[ZENITH-CHAT-ERROR] Failed to mark read:', err));
      }
    }, (error) => {
      console.error('[ZENITH-CHAT-ERROR] Failed to stream chat messages:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [rideId, user.uid]);

  // Real-time listener for "typing" status in the ride document
  useEffect(() => {
    const rideRef = doc(db, 'rides', rideId);
    const unsubscribe = onSnapshot(rideRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const typingState = data.typing || {};
        // Check if any other user is typing
        let otherTyping = false;
        Object.keys(typingState).forEach(uid => {
          if (uid !== user.uid && typingState[uid] === true) {
            otherTyping = true;
          }
        });
        setOtherUserTyping(otherTyping);
      }
    });

    return () => unsubscribe();
  }, [rideId, user.uid]);

  // Handle local typing event and remote sync with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing start
    if (!typing) {
      setTyping(true);
      updateTypingStatus(true);
    }

    // Debounce typing stop
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const updateTypingStatus = async (isTyping: boolean) => {
    try {
      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        [`typing.${user.uid}`]: isTyping
      });
    } catch (e) {
      console.warn('[ZENITH-CHAT-ERROR] Failed to set typing status:', e);
    }
  };

  // Send a message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    // Simple spam block (limit to 1 message per 0.8 seconds)
    const now = Date.now();
    if (now - spamBlockTime < 800) {
      console.warn('[ZENITH-CHAT] Anti-spam block triggered.');
      return;
    }
    setSpamBlockTime(now);

    setInputText('');
    setShowEmojis(false);
    
    // Stop typing status instantly on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping(false);
    updateTypingStatus(false);

    try {
      const messagesRef = collection(db, 'rides', rideId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: user.fullName,
        senderRole: user.role,
        message: text,
        read: false,
        createdAt: serverTimestamp()
      });

      await TelemetryService.logEvent('offer_sent', user.uid, user.role, {
        rideId,
        messageLength: text.length
      });
    } catch (error) {
      console.error('[ZENITH-CHAT-ERROR] Send failed:', error);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="flex flex-col h-[400px] md:h-[450px] bg-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl font-mono text-xs">
      {/* Header */}
      <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-left">
          <div className="w-2 h-2 bg-[#39FF14] rounded-full animate-pulse"></div>
          <div>
            <p className="font-black text-white uppercase tracking-wider text-[10px]">Canal de Comunicación Seguro</p>
            <p className="text-[9px] text-gray-500 uppercase">Encriptación Activa Zénith</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* Message Feed Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#020202]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-[#39FF14]" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-gray-600">
            <p className="uppercase tracking-widest text-[9px] font-black">Historial Vacío</p>
            <p className="text-[10px]">Escribe un mensaje para coordinar la partida del servicio.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user.uid;
            const timeStr = msg.createdAt?.seconds 
              ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[75%] p-3 rounded-2xl text-left ${
                    isMe 
                      ? 'bg-[#39FF14]/15 border border-[#39FF14]/30 text-white rounded-br-none' 
                      : 'bg-white/5 border border-white/10 text-white rounded-bl-none'
                  }`}
                >
                  <p className="text-[11px] leading-relaxed break-words">{msg.message}</p>
                </div>
                
                <div className="flex items-center gap-1.5 mt-1 text-[8px] text-gray-500 uppercase px-1">
                  <span>{timeStr}</span>
                  {isMe && (
                    <span className={msg.read ? 'text-[#39FF14]' : 'text-gray-600'}>
                      {msg.read ? <CheckCheck size={10} className="inline" /> : '•'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Real-time typing animation */}
        <AnimatePresence>
          {otherUserTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-left text-gray-500 uppercase text-[8px]"
            >
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-[#39FF14] rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-[#39FF14] rounded-full animate-bounce delay-100"></span>
                <span className="w-1 h-1 bg-[#39FF14] rounded-full animate-bounce delay-200"></span>
              </div>
              <span>El otro usuario está escribiendo...</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis Toolbar */}
      <div className="bg-[#050505] border-t border-white/5 p-1.5 flex gap-1.5 overflow-x-auto shrink-0 justify-start">
        {EMOJI_PRESETS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendMessage(emoji)}
            className="hover:bg-white/10 p-1 rounded-md text-sm transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <div className="p-3 bg-white/5 border-t border-white/5 flex items-center gap-2 relative shrink-0">
        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className={`p-2.5 rounded-xl border transition-all ${
            showEmojis ? 'bg-[#39FF14]/20 border-[#39FF14] text-[#39FF14]' : 'bg-black border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <Smile size={16} />
        </button>

        <input
          type="text"
          placeholder="Escribe un mensaje de coordinación..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-black border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-2.5 bg-[#39FF14] text-black hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 rounded-xl transition-all font-black flex items-center justify-center shrink-0"
        >
          <Send size={16} className="stroke-[2.5]" />
        </button>

        {/* Emoji Selector Overlay Popup */}
        <AnimatePresence>
          {showEmojis && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-16 left-3 bg-black border border-white/15 p-3 rounded-2xl shadow-2xl grid grid-cols-5 gap-2 z-40"
            >
              {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍'].map((emo) => (
                <button
                  key={emo}
                  onClick={() => insertEmoji(emo)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-lg transition-all"
                >
                  {emo}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
