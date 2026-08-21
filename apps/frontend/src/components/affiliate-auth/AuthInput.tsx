import React from 'react';

interface AuthInputProps {
    label: string;
    icon?: string;
    id?: string;
    name?: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    disabled?: boolean;
    readOnly?: boolean;
    autoComplete?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    pattern?: string;
    children?: React.ReactNode;
}

export default function AuthInput({ label, icon, id, ...props }: AuthInputProps) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-bold text-text-main" htmlFor={id}>
                {label}
            </label>
            <div className="relative group">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">{icon}</span>
                    </div>
                )}
                <input
                    id={id}
                    className={`block w-full ${icon ? "pl-10" : "px-4"} pr-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-text-main placeholder-gray-400 transition-all outline-none font-medium`}
                    {...props}
                />
            </div>
        </div>
    );
}
