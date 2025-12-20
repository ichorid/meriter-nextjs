"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleStickyHeader } from "@/components/organisms/ContextTopBar/ContextTopBar";
import { AdaptiveLayout } from "@/components/templates/AdaptiveLayout";
import { BrandButton, BrandInput, BrandFormControl } from "@/components/ui";
import { usePasskeys } from "@/hooks/usePasskeys";

type LogEntry = {
    timestamp: string;
    type: "info" | "success" | "error" | "json";
    message: string;
    data?: any;
};

export default function AuthnTestPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [username, setUsername] = useState("test_user_" + Math.floor(Math.random() * 1000));
    const { registerPasskey, loginWithPasskey, isWebAuthnSupported } = usePasskeys();
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addLog = (type: LogEntry["type"], message: string, data?: any) => {
        setLogs((prev) => [
            ...prev,
            {
                timestamp: new Date().toLocaleTimeString(),
                type,
                message,
                data,
            },
        ]);
    };

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleRegister = async () => {
        addLog("info", `Starting Registration for user: ${username}`);
        try {
            const result = await registerPasskey(username);
            addLog("success", "Registration Successful!");
            addLog("json", "Registration Result:", result);
        } catch (e: any) {
            addLog("error", "Registration Failed", e);
            addLog("json", "Error Details:", e);
        }
    };

    const handleLogin = async () => {
        addLog("info", `Starting Login for user: ${username}`);
        try {
            const result = await loginWithPasskey(username);
            addLog("success", "Login Successful!");
            addLog("json", "Login Result (User & JWT):", result);
        } catch (e: any) {
            addLog("error", "Login Failed", e);
            addLog("json", "Error Details:", e);
        }
    };

    const clearLogs = () => setLogs([]);

    return (
        <AdaptiveLayout>
            <SimpleStickyHeader
                title="WebAuthn Debugger"
                showBack={true}
                onBack={() => router.push('/tests')}
            />
            <div className="p-4 space-y-6 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
                {/* Controls */}
                <div className="p-4 bg-base-200 rounded-xl space-y-4 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${isWebAuthnSupported() ? 'bg-success' : 'bg-error'}`}></div>
                        <span className="text-sm font-medium">
                            WebAuthn Supported: {isWebAuthnSupported() ? "Yes" : "No"}
                        </span>
                    </div>

                    <BrandFormControl label="Test Username">
                        <BrandInput
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                        />
                    </BrandFormControl>

                    <div className="flex flex-wrap gap-2">
                        <BrandButton onClick={handleRegister} variant="primary">
                            Register Passkey
                        </BrandButton>
                        <BrandButton onClick={handleLogin} variant="secondary">
                            Login with Passkey
                        </BrandButton>
                        <BrandButton onClick={clearLogs} variant="ghost" className="ml-auto">
                            Clear Logs
                        </BrandButton>
                    </div>
                </div>

                {/* Console Output */}
                <div className="flex-grow bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 rounded-xl overflow-y-auto shadow-inner border border-base-300">
                    {logs.length === 0 && (
                        <div className="text-gray-500 italic text-center mt-10">
                            Ready... waiting for interaction.
                        </div>
                    )}
                    {logs.map((log, index) => (
                        <div key={index} className="mb-3 border-b border-gray-800 pb-2 last:border-0">
                            <div className="flex gap-2">
                                <span className="text-gray-500">[{log.timestamp}]</span>
                                <span
                                    className={`font-bold ${log.type === "error"
                                        ? "text-red-400"
                                        : log.type === "success"
                                            ? "text-green-400"
                                            : log.type === "json"
                                                ? "text-blue-300"
                                                : "text-white"
                                        }`}
                                >
                                    {log.type.toUpperCase()}:
                                </span>
                                <span>{log.message}</span>
                            </div>
                            {log.data && (
                                <pre className="mt-1 ml-6 p-2 bg-[#2d2d2d] rounded overflow-x-auto text-green-300">
                                    {JSON.stringify(log.data, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </AdaptiveLayout>
    );
}
