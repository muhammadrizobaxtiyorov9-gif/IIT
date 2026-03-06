import React, { useState } from 'react';
import { verifyAdmin, logSystemAction } from '../utils/db';
import { AdminUser, Language } from '../types';
import { Lock, User, LogIn, Eye, EyeOff, ShieldAlert, TrainFront } from 'lucide-react';
import { getTranslation } from '../utils/translations';

interface LoginPageProps {
  onLogin: (user: AdminUser) => void;
  lang: Language;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, lang }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await verifyAdmin(username.trim(), password.trim(), navigator.userAgent);
      if (user) {
        await logSystemAction('LOGIN', user.username, 'User logged in', user.role);
        onLogin(user);
      } else {
        setError(lang === 'uz' ? 'Login yoki parol noto\'g\'ri' : 'Неверный логин или пароль');
      }
    } catch (err) {
      setError(lang === 'uz' ? 'Tizim xatosi yuz berdi' : 'Произошла системная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#0B1121] overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-700">

        {/* Security Warning Banner */}
        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl backdrop-blur-md shadow-2xl">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200 leading-relaxed font-medium">
            <span className="font-bold text-red-400 uppercase tracking-wider block mb-1">
              {lang === 'uz' ? "Xavfsizlik Ogohlantirishi" : "Предупреждение безопасности"}
            </span>
            {lang === 'uz'
              ? "Ishni yakunlagach, tizimdan Chiqish (Log out) tugmasi orqali chiqishni unutmang. Parollaringizni hech kimga bermang."
              : "По завершении работы не забудьте выйти из системы (Log out). Никому не передавайте свои пароли."}
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden">

          {/* Card Top Highlight Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500"></div>

          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-indigo-500/20 to-blue-500/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <TrainFront className="w-10 h-10 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">ЕДЦ <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Аналитика</span></h1>
            <p className="text-slate-400 mt-2 font-medium text-sm">
              {getTranslation("login_subtitle", lang)}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">
                {getTranslation("login_label", lang)}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                  placeholder={getTranslation("enter_login", lang)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">
                {getTranslation("password_label", lang)}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3.5 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium tracking-wider"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-indigo-400 transition-colors focus:outline-none"
                  title={lang === 'uz' ? "Parolni ko'rish/yashirish" : "Показать/скрыть пароль"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3.5 rounded-xl text-center font-medium animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{getTranslation("processing", lang)}...</span>
                </div>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-3" />
                  {getTranslation("login_btn", lang)}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center text-slate-500 text-xs font-medium tracking-wide">
          &copy; {new Date().getFullYear()} Oʻzbekiston Temir Yoʻllari
        </div>
      </div>
    </div>
  );
};
