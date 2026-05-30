import React from 'react';

const SignalPanelSkeleton: React.FC = () => (
  <div className="glass-morphism rounded-[3rem] p-10 border border-white/5 animate-pulse space-y-6">
    <div className="flex gap-4">
      <div className="w-16 h-16 rounded-2xl bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-6 bg-white/5 rounded w-1/3" />
        <div className="h-3 bg-white/5 rounded w-1/4" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="h-20 bg-white/5 rounded-2xl" />
      <div className="h-20 bg-white/5 rounded-2xl" />
    </div>
    <div className="h-4 bg-white/5 rounded w-full" />
    <div className="h-4 bg-white/5 rounded w-5/6" />
    <div className="h-14 bg-blue-600/20 rounded-2xl" />
  </div>
);

export default SignalPanelSkeleton;
