import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setUnauthorizedHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await AsyncStorage.multiRemove(['access', 'refresh']);
    setUser(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        if (await AsyncStorage.getItem('access')) {
          const { data } = await api.get('/me/');
          setUser(data);
        }
      } catch (e) {
        await logout();
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/login/', { email, password });
    await AsyncStorage.setItem('access', data.access);
    await AsyncStorage.setItem('refresh', data.refresh);
    setUser(data.user);
  };

  const refreshUser = async () => {
    const { data } = await api.get('/me/');
    setUser(data);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</Ctx.Provider>;
}