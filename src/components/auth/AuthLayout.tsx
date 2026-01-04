
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding with Avatar Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/lovable-uploads/1fab5331-8802-41ed-b1c5-5d8aab9b3268.png)' }}
        />
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60" />
        
        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8">
          {/* Top Section - Logo/Brand */}
          <div className="text-white">
            <h1 className="text-2xl font-bold mb-1">Chatty</h1>
            <p className="text-sm opacity-90">AI Business Chatbots</p>
          </div>

          {/* Bottom Section - Main Bio */}
          <div className="text-white space-y-4">
            <h2 className="text-3xl font-bold leading-tight">
              Intelligent Chatbots<br />
              For Your Business
            </h2>
            <p className="text-base opacity-80 max-w-md">
              Create smart business chatbots with product catalogs, knowledge bases,
              and industry-specific templates. Automate customer support effortlessly.
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 bg-background">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
