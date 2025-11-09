import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="text-center">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
        <span className="text-blue-500">Nexx</span>
        <span className="text-red-500">Prompt</span>
      </h1>
      <p className="mt-2 text-lg text-slate-300">Tu Arquitecto Personal de Prompts IA</p>
    </header>
  );
};