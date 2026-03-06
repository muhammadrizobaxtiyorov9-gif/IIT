import React, { useState } from 'react';
import { AdminUser, Language } from '../types';
import { changeUserCredentials } from '../utils/db';
import { Shield, X, Eye, EyeOff, Save, AlertCircle, Key, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { getTranslation } from '../utils/translations';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: AdminUser;
    onSuccess: (updatedUser: AdminUser) => void;
    lang: Language;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, currentUser, onSuccess, lang }) => {
    const [name, setName] = useState(currentUser.name || '');
    const [username, setUsername] = useState(currentUser.username || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showOldKey, setShowOldKey] = useState(false);
    const [showNewKey, setShowNewKey] = useState(false);
    const [showConfirmKey, setShowConfirmKey] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!oldPassword.trim()) {
            setErrorMsg(getTranslation("validation_error_old_pass", lang));
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            setErrorMsg(getTranslation("validation_error_mismatch", lang));
            return;
        }

        setIsSaving(true);
        try {
            const result = await changeUserCredentials(currentUser.username, oldPassword.trim(), newPassword.trim(), name.trim(), username.trim());

            if (result.success) {
                toast.success(result.message);

                const updatedObj: AdminUser = result.newUserObj || {
                    ...currentUser,
                    name: name.trim() || currentUser.name,
                    username: username.trim() || currentUser.username
                };

                // Note: password is intentionally not kept in plain-text currentUser state in production, 
                // but we update what we need for the UI.
                if (newPassword.trim()) {
                    updatedObj.password = newPassword.trim();
                }

                // Reset forms
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');

                onSuccess(updatedObj);
            } else {
                setErrorMsg(result.message);
            }
        } catch (err: any) {
            setErrorMsg(getTranslation("system_error", lang));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Profil Sozlamalari</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        disabled={isSaving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-3 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Username (Login) Field */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">{getTranslation("login_username", lang)} <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Shield className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} // No spaces in username
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-colors"
                                    placeholder={getTranslation("enter_new_login", lang)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Name Field */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">{getTranslation("full_name", lang)}</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-colors"
                                    placeholder={getTranslation("enter_name", lang)}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{getTranslation("security_password", lang)}</h3>

                            {/* Old Password */}
                            <div className="space-y-1.5 mb-4">
                                <label className="text-sm font-bold text-slate-700">{getTranslation("current_password", lang)} <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showOldKey ? "text" : "password"}
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-colors"
                                        placeholder={getTranslation("enter_current_password", lang)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOldKey(!showOldKey)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                    >
                                        {showOldKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400">{getTranslation("old_password_required", lang)}</p>
                            </div>

                            {/* New Password */}
                            <div className="space-y-1.5 mb-4">
                                <label className="text-sm font-bold text-slate-700">{getTranslation("new_password_opt", lang)}</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Shield className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showNewKey ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-colors"
                                        placeholder={getTranslation("enter_only_if_change", lang)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewKey(!showNewKey)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                    >
                                        {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            {newPassword && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-sm font-bold text-slate-700">{getTranslation("confirm_new_password", lang)} <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Shield className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input
                                            type={showConfirmKey ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-colors"
                                            placeholder={getTranslation("re_enter_new_password", lang)}
                                            required={newPassword.length > 0}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmKey(!showConfirmKey)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                        >
                                            {showConfirmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            disabled={isSaving}
                        >
                            {getTranslation("cancel", lang)}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:transform active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {getTranslation("save", lang)}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfileModal;
