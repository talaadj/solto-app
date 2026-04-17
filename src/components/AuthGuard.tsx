import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoginView } from '../views/LoginView';
import { LayoutDashboard } from 'lucide-react';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
        <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-xl">
          <LayoutDashboard className="text-white w-7 h-7" />
        </div>
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Загрузка...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView onSignIn={signIn} onSignUp={signUp} />;
  }

  return <>{children}</>;
};
