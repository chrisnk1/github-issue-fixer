import './globals.css';

export const metadata = {
    title: 'Fix Together',
    description: 'Collaborative AI-powered GitHub issue fixer',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
