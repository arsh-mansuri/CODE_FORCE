import React from 'react';

export type NavTab = 'match' | 'explore' | 'reviews' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const items: { id: NavTab; label: string; icon: string }[] = [
    { id: 'match', label: 'Match', icon: 'favorite' },
    { id: 'explore', label: 'Explore', icon: 'apartment' },
    { id: 'reviews', label: 'Reviews', icon: 'verified_user' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        height: '56px',
        background: 'var(--color-surface-container-lowest)',
        borderTop: '1px solid var(--color-surface-variant)',
        boxShadow: '0 -2px 10px rgba(32, 27, 23, 0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
      }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              padding: '6px 16px',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <span
              className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}
              style={{
                fontSize: '22px',
                color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
