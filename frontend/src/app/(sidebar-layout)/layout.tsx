import Sidebar from '@/components/Sidebar';

export default function SidebarLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-y-auto pb-16">
                {children}
            </main>
        </div>
    );
}
