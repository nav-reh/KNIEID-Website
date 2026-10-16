import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'KNIEID e.V. | Community portal',description:'KNIEID e.V. – Kultur, Netzwerk, Integration, Entwicklung, Inspiration und Diversität.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}</body></html>}
