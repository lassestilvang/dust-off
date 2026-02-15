import React from 'react';
import { siReact, siNextdotjs, siTypescript, siJavascript, siVite, siPython, siVuedotjs, siPhp } from 'simple-icons';

// Helper component to render Simple Icons
const SimpleIcon = ({ icon, className }: { icon: any, className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <title>{icon.title}</title>
    <path d={icon.path} />
  </svg>
);

export const ReactIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siReact} className={className} />
);

export const NextjsIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siNextdotjs} className={className} />
);

export const TypeScriptIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siTypescript} className={className} />
);

export const JavaScriptIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siJavascript} className={className} />
);

export const ViteIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siVite} className={className} />
);

export const PythonIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siPython} className={className} />
);

export const VueIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siVuedotjs} className={className} />
);

export const PhpIcon = ({className}: {className?: string}) => (
  <SimpleIcon icon={siPhp} className={className} />
);