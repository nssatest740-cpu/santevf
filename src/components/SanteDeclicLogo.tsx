import React from 'react';

export const SanteDeclicLogo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Background Shield - Prevention */}
      <path 
        d="M50 5L15 20V45C15 67.5 30 88 50 95C70 88 85 67.5 85 45V20L50 5Z" 
        fill="url(#logo-gradient)" 
      />
      
      {/* Grid Pattern - Data/IT */}
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1"/>
        </pattern>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" /> {/* Emerald 500 */}
          <stop offset="1" stopColor="#0F172A" /> {/* Slate 900 */}
        </linearGradient>
      </defs>
      <path 
        d="M50 5L15 20V45C15 67.5 30 88 50 95C70 88 85 67.5 85 45V20L50 5Z" 
        fill="url(#grid)" 
      />

      {/* Hospital Silhouette - Etablissement */}
      <path 
        d="M40 70H60V85H40V70ZM35 75H40V85H35V75ZM60 75H65V85H60V75Z" 
        fill="white" 
        fillOpacity="0.3" 
      />
      
      {/* Pulse Line - Suivi */}
      <path 
        d="M25 50H35L40 35L50 65L55 50H75" 
        stroke="white" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="animate-pulse"
      />
      
      {/* Data Nodes - IT */}
      <circle cx="25" cy="50" r="2" fill="#4ADE80" />
      <circle cx="75" cy="50" r="2" fill="#4ADE80" />
      <circle cx="40" cy="35" r="2" fill="#4ADE80" />
      <circle cx="50" cy="65" r="2" fill="#4ADE80" />
    </svg>
  );
};
