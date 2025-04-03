import Sidebar from '@/components/Sidebar';

export default function SidebarLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-white">
            {/* Desktop sidebar */}
            <div className="hidden lg:block fixed left-0 top-0 h-screen">
                <Sidebar />
            </div>
            
            {/* Mobile sidebar */}
            <div className="lg:hidden">
                <Sidebar />
            </div>
            
            {/* Main content area with left padding on desktop to account for fixed sidebar */}
            <main className="lg:pl-[250px] pb-16 bg-white min-h-screen overflow-x-hidden">
                {children}
            </main>
        </div>
    );
}
