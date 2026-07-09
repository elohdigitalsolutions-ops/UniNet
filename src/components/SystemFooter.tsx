import React from 'react';

export const SystemFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#222] bg-[#0A0A0B] py-4 px-6 mt-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[#555] font-mono-custom">
        <span>UniNet Mesh Platform Design System // High Density Theme</span>
        <span>Secure Peer Network Node Sandbox</span>
      </div>
    </footer>
  );
};
