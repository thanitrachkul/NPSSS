import React, { useState, useEffect, useRef } from 'react';
import { AdminUser } from '../types';
import api from '../services/api';
import { User, Eye, ShieldCheck, Wifi } from 'lucide-react';

interface OnlineUsersProps {
  currentUser: AdminUser;
}

const OnlineUsers: React.FC<OnlineUsersProps> = ({ currentUser }) => {
  const [onlineUsers, setOnlineUsers] = useState<Partial<AdminUser>[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const fetchOnlineUsers = async () => {
    try {
      const users = await api.getOnlineUsers();
      setOnlineUsers(users);
    } catch (error) {
      // Ignore errors for polling
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchOnlineUsers();

    // Poll every 30 seconds
    intervalRef.current = window.setInterval(fetchOnlineUsers, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (onlineUsers.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-sans no-print">
      <div 
        className="relative group"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {/* Collapsed Pill */}
        <button 
          className="bg-white/90 backdrop-blur-md border border-gray-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-xs font-bold text-gray-700">
             {onlineUsers.length} คนออนไลน์
          </span>
        </button>

        {/* Expanded List (Tooltip style) */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-in slide-in-from-bottom-2 fade-in duration-200 origin-bottom-left">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Wifi className="w-3 h-3" /> ผู้ใช้งานขณะนี้
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {onlineUsers.map((user) => {
                 const isMe = user.id === currentUser.id;
                 const isSuper = user.role === 'SUPER_ADMIN';
                 const isViewer = user.role === 'VIEWER';
                 
                 return (
                   <div key={user.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                          isSuper ? 'bg-black' : isViewer ? 'bg-gray-400' : 'bg-gradient-to-tr from-emerald-500 to-teal-600'
                      }`}>
                          {isViewer ? <Eye className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                              {user.name} {isMe && <span className="text-blue-600">(คุณ)</span>}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium truncate">{user.role}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                   </div>
                 );
              })}
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                อัปเดตอัตโนมัติทุก 30 วินาที
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineUsers;
