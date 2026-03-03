'use client'

import { useState, useEffect } from 'react'

export default function BottomNav() {
  const [activeTab, setActiveTab] = useState('home')

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'chart', icon: '📈', label: 'Chart' },
    { id: 'orders', icon: '🤖', label: 'Orders' },
    { id: 'savings', icon: '🐖', label: 'Savings' },
    { id: 'journal', icon: '📋', label: 'Journal' },
  ]

  const scrollTo = (id: string) => {
    setActiveTab(id)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex items-center justify-between">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className="flex flex-col items-center gap-1 group"
          >
            <span className={`text-xl transition-transform duration-200 ${activeTab === item.id ? 'scale-125' : 'opacity-40 group-hover:opacity-100'}`}>
              {item.icon}
            </span>
            <span className={`text-[10px] font-bold tracking-tight transition-colors ${activeTab === item.id ? 'text-amber-500' : 'text-white/30'}`}>
              {item.label}
            </span>
            {activeTab === item.id && (
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
