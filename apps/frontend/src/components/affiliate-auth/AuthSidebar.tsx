interface AuthSidebarProps {
    title: string;
    description: string;
    imageSrc: string;
    features?: string[];
}

export default function AuthSidebar({ title, description, imageSrc, features }: AuthSidebarProps) {
    return (
        <div className="hidden lg:flex lg:w-1/2 h-screen sticky top-0 overflow-hidden bg-primary/10">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src={imageSrc}
                    alt="Professional visual"
                    className="object-cover w-full h-full"
                />
            </div>

            {/* Overlay for Brand Feel */}
            <div className="absolute inset-0 bg-primary/20 mix-blend-multiply"></div>

            {/* Branding content on top of image */}
            <div className="relative z-10 flex flex-col justify-between p-12 w-full text-white">
                <div className="flex items-center gap-3">
                    <div className="text-white size-8">
                        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                        </svg>
                    </div>
                    <span className="text-2xl font-bold tracking-tight font-display">247gbs affiliate</span>
                </div>

                <div className="max-w-md">
                    <h2 className="text-4xl font-bold leading-tight mb-6 tracking-tight font-display">
                        {title}
                    </h2>
                    {features ? (
                        <div className="space-y-6">
                            {features.map((feature, index) => (
                                <div key={index} className="flex gap-4">
                                    <span className="material-symbols-outlined text-white">check_circle</span>
                                    <p className="text-lg text-white font-medium">{feature}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-lg opacity-90 font-medium leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                <div className="text-sm opacity-70 font-bold uppercase tracking-widest font-display">
                    © 2026 247gbs affiliate professional marketplace
                </div>
            </div>
        </div>
    );
}
