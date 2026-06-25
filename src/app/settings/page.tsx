"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/hooks/useTheme";
import { KYCLimitManager } from "@/components/KYCLimitManager";
import { cn } from "@/lib/cn";

type SettingsSection = "profile" | "security" | "appearance" | "preferences";

export default function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");
  const [isSaved, setIsSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  });
  const [currency, setCurrency] = useState("USDC");

  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();

  // Handle deep linking
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SettingsSection;
    if (["profile", "security", "appearance", "preferences"].includes(hash)) {
      setActiveSection(hash);
    }
  }, []);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    // In a real app, this would call a server-side API
  };

  const handleReset = () => {
    setTheme("system");
    setLanguage("en");
    setNotifications({ email: true, push: false, marketing: false });
    setCurrency("USDC");
  };

  const navItems: { id: SettingsSection; label: string; icon: string }[] = [
    { id: "profile", label: t("settings.profile"), icon: "👤" },
    { id: "security", label: t("settings.security"), icon: "🔒" },
    { id: "appearance", label: t("settings.appearance"), icon: "🎨" },
    { id: "preferences", label: t("settings.preferences"), icon: "⚙️" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-8 italic text-white">
            {t("settings.title")}
          </h1>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  window.location.hash = item.id;
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border",
                  activeSection === item.id
                    ? "bg-[#c9a962] text-[#0a0a0a] border-[#c9a962]"
                    : "text-[#777] border-transparent hover:border-[#333] hover:text-white",
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="pt-8">
            <button
              onClick={handleReset}
              className="w-full px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-500 border border-red-900/30 hover:bg-red-900/10 transition-all"
            >
              {t("settings.reset")}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-[600px] border border-[#222] bg-[#0a0a0a] p-8 shadow-2xl relative">
          {isSaved && (
            <div className="absolute top-4 right-8 bg-green-500 text-[#0a0a0a] px-4 py-2 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4 duration-300">
              {t("settings.saved")}
            </div>
          )}

          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Profile Section */}
            {activeSection === "profile" && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1">
                    {t("settings.profile")}
                  </h2>
                  <p className="text-xs text-[#555] uppercase tracking-widest">
                    Manage your public presence and account details
                  </p>
                </header>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#777] uppercase tracking-widest">
                      Public Address
                    </label>
                    <div className="p-4 bg-[#111] border border-[#222] font-mono text-xs text-[#aaa] break-all">
                      GDUY...7J2L
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#777] uppercase tracking-widest">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter name..."
                      className="w-full bg-[#111] border border-[#333] px-4 py-3 text-xs text-white focus:outline-none focus:border-[#c9a962]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security / KYC Section */}
            {activeSection === "security" && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1">
                    {t("settings.security")}
                  </h2>
                  <p className="text-xs text-[#555] uppercase tracking-widest">
                    Identity verification and transaction limits
                  </p>
                </header>

                <KYCLimitManager userId="current-user" />
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === "appearance" && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1">
                    {t("settings.appearance")}
                  </h2>
                  <p className="text-xs text-[#555] uppercase tracking-widest">
                    Customize how the application looks
                  </p>
                </header>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-[#777] uppercase tracking-widest">
                      {t("settings.theme")}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["light", "dark", "system"] as const).map((tMode) => (
                        <button
                          key={tMode}
                          onClick={() => setTheme(tMode)}
                          className={cn(
                            "px-4 py-4 border text-[10px] font-bold uppercase tracking-widest transition-all",
                            theme === tMode
                              ? "border-[#c9a962] bg-[#c9a962]/5 text-[#c9a962]"
                              : "border-[#222] text-[#555] hover:border-[#444] hover:text-white",
                          )}
                        >
                          {t(`settings.${tMode}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Section */}
            {activeSection === "preferences" && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-1">
                    {t("settings.preferences")}
                  </h2>
                  <p className="text-xs text-[#555] uppercase tracking-widest">
                    System-wide behavior and localization
                  </p>
                </header>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-[#777] uppercase tracking-widest">
                      {t("settings.language")}
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full bg-[#111] border border-[#333] px-4 py-3 text-xs text-white focus:outline-none focus:border-[#c9a962] appearance-none"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="zh">中文</option>
                      <option value="pt">Português</option>
                      <option value="ar">العربية</option>
                      <option value="sw">Kiswahili</option>
                    </select>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-[#777] uppercase tracking-widest">
                      {t("settings.notifications")}
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-[#111] border border-[#222]">
                        <span className="text-xs text-[#aaa] font-medium">
                          {t("settings.email_notifications")}
                        </span>
                        <input
                          type="checkbox"
                          checked={notifications.email}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-[#c9a962]"
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[#111] border border-[#222]">
                        <span className="text-xs text-[#aaa] font-medium">
                          {t("settings.push_notifications")}
                        </span>
                        <input
                          type="checkbox"
                          checked={notifications.push}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              push: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-[#c9a962]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-[#222] flex justify-end">
            <button
              onClick={handleSave}
              className="px-12 py-4 bg-[#c9a962] text-[#0a0a0a] text-xs font-black uppercase tracking-[0.2em] hover:bg-[#d4b97a] transition-all shadow-[0_4px_20px_rgba(201,169,98,0.2)]"
            >
              {t("settings.save")}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
