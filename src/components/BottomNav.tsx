'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ScanLine, TrendingUp, User } from 'lucide-react';

const navItems = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/explore', icon: Search, label: 'Explore' },
  { href: '/scan', icon: ScanLine, label: 'Scan' },
  { href: '/impact', icon: TrendingUp, label: 'Impact' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on welcome page and kiosk
  if (pathname === '/' || pathname === '/welcome' || pathname === '/kiosk') return null;

  return (
    <nav className="bottom-nav" aria-label="Resident navigation">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/scan' && pathname.startsWith('/scan')) ||
            (item.href === '/impact' && pathname.startsWith('/impact'));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'active' : ''}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
